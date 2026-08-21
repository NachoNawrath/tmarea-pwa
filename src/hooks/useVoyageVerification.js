// src/hooks/useVoyageVerification.js
import { useState, useEffect, useCallback, useRef } from 'react';
import { getCapitania } from '../utils/capitanias.js';
import { normalizeLicense } from '../utils/license-rules.js';

const BACKEND_URL = 'http://localhost:3000';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURACIÓN DE RESILIENCIA
// ─────────────────────────────────────────────────────────────────────────────
const CONFIG = {
  TIMEOUT_MS: 12000,        // 12s por llamada individual antes de abortar
  MAX_RETRIES: 2,           // reintentos automáticos en 429/503
  RETRY_BASE_DELAY_MS: 800, // backoff exponencial: 800ms, 1600ms
  CACHE_TTL_MS: 3 * 60 * 1000, // 3 min de caché en memoria (conectividad austral)
  DATO_VIEJO_MIN: 60,       // minutos antes de marcar SITPORT como desactualizado
};

// ─────────────────────────────────────────────────────────────────────────────
// CACHÉ EN MEMORIA (sobrevive navegación entre pantallas, muere con la sesión)
// ─────────────────────────────────────────────────────────────────────────────
const cache = new Map(); // key → { data, expiresAt }

function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { cache.delete(key); return null; }
  return entry.data;
}

function cacheSet(key, data) {
  cache.set(key, { data, expiresAt: Date.now() + CONFIG.CACHE_TTL_MS });
}

// ─────────────────────────────────────────────────────────────────────────────
// FETCH CON TIMEOUT + ABORT SIGNAL + RETRY CON BACKOFF EXPONENCIAL
// Nunca lanza — siempre retorna { ok, data, status, error }
// ─────────────────────────────────────────────────────────────────────────────
async function safeFetch(url, options = {}, { signal, retries = CONFIG.MAX_RETRIES } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    // Si el AbortController ya fue cancelado, detenemos inmediatamente
    if (signal?.aborted) {
      return { ok: false, data: null, status: 0, error: 'Cancelado por el usuario' };
    }

    // Timeout propio combinado con el signal externo (desmontaje)
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(
      () => timeoutController.abort(),
      CONFIG.TIMEOUT_MS
    );

    // Combinar ambas señales: timeout interno + abort externo
    const combinedSignal = anySignal([signal, timeoutController.signal].filter(Boolean));

    try {
      const res = await fetch(url, { ...options, signal: combinedSignal });
      clearTimeout(timeoutId);

      // Rate limiting o servidor caído → reintentar con backoff
      if ((res.status === 429 || res.status === 503) && attempt < retries) {
        const delay = CONFIG.RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
        await sleep(delay, signal);
        continue;
      }

      const data = res.ok ? await res.json().catch(() => null) : null;
      return { ok: res.ok, data, status: res.status, error: res.ok ? null : `HTTP ${res.status}` };

    } catch (err) {
      clearTimeout(timeoutId);

      // Cancelación explícita → no reintentar
      if (err.name === 'AbortError') {
        const msg = timeoutController.signal.aborted
          ? `Timeout tras ${CONFIG.TIMEOUT_MS / 1000}s`
          : 'Cancelado';
        return { ok: false, data: null, status: 0, error: msg };
      }

      // Red caída: reintentar si quedan intentos
      if (attempt < retries) {
        const delay = CONFIG.RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
        await sleep(delay, signal);
        continue;
      }

      return { ok: false, data: null, status: 0, error: err.message };
    }
  }
  return { ok: false, data: null, status: 0, error: 'Sin respuesta tras reintentos' };
}

// Util: esperar delay respetando abort externo
function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const id = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(id); reject(new DOMException('Cancelado', 'AbortError')); }, { once: true });
  });
}

// Util: AbortSignal que se dispara cuando CUALQUIERA de las señales se aborta
function anySignal(signals) {
  if (signals.length === 0) return undefined;
  if (signals.length === 1) return signals[0];
  const controller = new AbortController();
  for (const s of signals) {
    if (s.aborted) { controller.abort(); break; }
    s.addEventListener('abort', () => controller.abort(), { once: true });
  }
  return controller.signal;
}

// ─────────────────────────────────────────────────────────────────────────────
// LÓGICA DE NEGOCIO — VEREDICTO
// ─────────────────────────────────────────────────────────────────────────────
const SEVERIDAD = { Q: 0, U: 1, UV: 2 };

function maxVeredicto(...veredictos) {
  return veredictos.reduce(
    (max, v) => ((SEVERIDAD[v] ?? -1) > SEVERIDAD[max] ? v : max),
    'Q'
  );
}

// Escalamiento del veredicto por restricciones intermedias.
// Usa el veredicto pre-calculado por el backend (motor de reglas BRE).
// Fallback: si el backend no envió veredicto global, recorre evaluaciones individuales.
export function escalarPorTransito(transitRestrictions) {
  if (!transitRestrictions) return null;

  const veredictoBackend = transitRestrictions.bandera_final || transitRestrictions.veredicto;
  if (veredictoBackend === 'UV') return 'UV';
  if (veredictoBackend === 'U') return 'U';
  if (veredictoBackend === 'Q') return null;

  // Fallback por evaluación individual (nivel anidado bajo evaluacion por el endpoint)
  const lista = transitRestrictions.restricciones_intermedias || [];
  let nivel = null;
  for (const r of lista) {
    if (r.evaluacion?.nivel === 'UV') return 'UV';
    if (r.evaluacion?.nivel === 'U') nivel = 'U';
  }
  return nivel;
}

// ─────────────────────────────────────────────────────────────────────────────
// LA COMPUERTA DEL AVISO DE CIERRE — D-C7 · decisión del owner, 2026-08-17
//
// «El aviso de cierre sale si y sólo si `cierre.estado === 'cerrado'`.»
// `aviso_modo` NO decide si el aviso sale: decide, DENTRO de ese conjunto, si
// sale sólo el piso o el piso más el detalle. Medido sobre el sondaje versionado
// (444 filas / 213 restricciones): 335 filas / 167 restricciones cerradas, y 46
// restricciones con `sin_cierre_declarado` que NO reciben aviso tengan el
// `alcance` que tengan. De esas 46, 10 emiten `aviso_modo: 'detalle'` y habrían
// mostrado un alcance sin cierre que lo gobierne — aviso creíble y equivocado.
// Eso es lo que D-C7 corta.
//
// POR QUÉ NO PASA POR `estado` (Z2, decisión del owner, 2026-08-17). El camino
// `estado === 'rojo'` alimenta A LA VEZ este aviso y el veredicto de ZARPE, que
// deshabilita el CTA (P3:330-341). Encenderlo acá arrastraría el bloqueo de
// zarpe de contrabando, sin instrumento y con el sobre-alcance del filtro de
// puerto vivo (backend `sitport-routes.js:333-338`, subcadena y no palabra).
// El aviso no necesita `estado`: necesita `cierre`. Leyéndolo directo, este
// Tramo mueve CERO veredictos — hoy 'ambar' da 'U' en recalada y un 'rojo' de
// recalada también da 'U' por el tope del Art. 24: es el mismo valor.
// El zarpe es Tramo C y NO arranca hasta que el filtro esté resuelto (D-C9).
//
// `cierre` ausente (backend anterior a esta salida, o error) NO es lo mismo que
// `cierre: []` (el backend contestó y no hay cierre). Las dos dan `false`, pero
// por caminos distintos y sin colapsarse: un array que no es array no se
// interroga.
export function cierresDeclarados(puerto) {
  const cierre = puerto?.cierre;
  if (!Array.isArray(cierre)) return [];
  return cierre.filter((c) => c?.estado === 'cerrado');
}

export function hayCierreDeclarado(puerto) {
  return cierresDeclarados(puerto).length > 0;
}

export function calcularVeredicto({ portStatus, weather, navigation, transitRestrictions }) {
  const veredictoZarpe =
    portStatus?.zarpe?.estado === 'rojo' ? 'UV' :
    (portStatus?.zarpe?.estado === 'ambar' || portStatus?.zarpe?.dato_viejo) ? 'U' : 'Q';

  // Recalada: máximo U — UV se baja a U con flag (Art. 24 Regl. Despacho:
  // solo el zarpe es UV absoluto; recalada cerrada permite zarpe con declaración de alternativa)
  const recaladaRaw =
    portStatus?.recalada?.estado === 'rojo' ? 'UV' :
    (portStatus?.recalada?.estado === 'ambar' || portStatus?.recalada?.dato_viejo) ? 'U' : 'Q';

  // EL TOPE DEL ART. 24 SE CONSERVA INTACTO aunque hoy su rama no se alcance:
  // `estado === 'rojo'` no sale nunca todavía (ver `mapearRespuestaPuerto`), pero
  // el Tramo C lo enciende y el tope tiene que estar ahí cuando eso pase. Lo que
  // se separa acá es la BANDERA: dejó de ser un efecto lateral de este tope.
  let veredictoRecalada = recaladaRaw;
  if (recaladaRaw === 'UV') {
    veredictoRecalada = 'U';
  }

  // D-C7 · la bandera sale del DATO DE CIERRE del puerto de recalada, no del
  // veredicto. Antes se derivaba de `recaladaRaw === 'UV'`, que dependía de
  // `estado === 'rojo'`, que dependía de `nivel === 'cierre_total'` — un valor
  // que el backend NO produce (0 de 444 filas del sondaje lo traen) y que se
  // decidió explícitamente no producir. Por esa cadena de tres saltos muertos el
  // aviso de arribada forzosa NUNCA se renderizó.
  const arribadaForzosa = hayCierreDeclarado(portStatus?.recalada);

  const veredictoClima =
    weather?.condicion_puerto === 'temporal' ? 'UV' :
    (weather?.condicion_puerto === 'mal_tiempo' ||
     weather?.alerta_nivel === 'alto' ||
     navigation?.autonomia_ok === false) ? 'U' : 'Q';

  const veredictoTransito = escalarPorTransito(transitRestrictions) ?? 'Q';
  const veredictoDrift = escalarPorDrift(transitRestrictions, weather);
  const veredictoCobertura = escalarPorCobertura(transitRestrictions);

  return {
    veredicto: maxVeredicto(veredictoZarpe, veredictoRecalada, veredictoClima, veredictoTransito, veredictoDrift, veredictoCobertura),
    arribadaForzosa,
    detalles: {
      zarpe: veredictoZarpe,
      recalada: recaladaRaw,
      recalada_ajustada: veredictoRecalada,
      clima: veredictoClima,
      transito: veredictoTransito,
      drift_catalogo: veredictoDrift,
      cobertura_jurisdiccional: veredictoCobertura,
    },
  };
}

// A3 (decisión del owner, 2026-08-11). SITPORT publicó un dato bajo una bahía que
// nuestro catálogo no conoce y no se pudo descartar que sea de la ruta. Escala a
// **U y nunca a UV**: la ausencia de dato no es una prohibición. El backend ya
// topa su bandera; acá se vuelve a topar para que el tope no dependa de que la
// respuesta venga bien formada.
export function escalarPorDrift(transitRestrictions, weather) {
  const banderas = [transitRestrictions?.drift_catalogo, weather?.drift_catalogo]
    .filter(Boolean)
    .map(d => (d.estado === 'no_evaluado' ? 'U' : d.bandera));
  return banderas.some(b => b === 'U' || b === 'UV') ? 'U' : 'Q';
}

// INV-3.6. La ruta cruza una jurisdicción sin límite cargado: el motor no puede
// responder por esa zona. Escala a **U y nunca a UV** — la ausencia de dato no
// es una prohibición, y dejarlo en Q sería afirmar una condición que el motor no
// puede respaldar. CALCADO de `escalarPorDrift`, incluido el motivo por el que
// el tope se vuelve a poner acá: el backend ya topa su bandera, y este segundo
// tope existe para que no dependa de que la respuesta venga bien formada.
//
// `no_evaluada` cuenta como U, igual que en drift: un fallo de evaluación no se
// puede leer como "no hay nada que avisar" (INV-0.2), que es justo el falso
// negativo silencioso que INV-3.6 persigue.
//
// LO QUE ESTA FUNCIÓN NO HACE: escala la bandera y no dice por qué. El porqué lo
// pone la capa B —`avisosDeCobertura` acá abajo y `CoberturaJurisdiccionalBlock`
// en P3—, que entró el 2026-08-21 con el sitio y el texto firmados por el owner.
// [CORREGIDO EL 2026-08-21] Este párrafo decía «pieza aparte y decisión de
// producto pendiente: dónde va en P3». Lo volvió falso esta misma pieza, así que
// traza a lo que se pidió y se corrige en el mismo acto (§4.8, §0.1).
export function escalarPorCobertura(transitRestrictions) {
  const c = transitRestrictions?.cobertura_jurisdiccional;
  if (!c) return 'Q';
  const bandera = c.estado === 'no_evaluada' ? 'U' : c.bandera;
  return bandera === 'U' || bandera === 'UV' ? 'U' : 'Q';
}

// ─────────────────────────────────────────────────────────────────────────────
// LO QUE EL BLOQUE DE COBERTURA MUESTRA — U2 CAPA B, INV-3.6
//
// VIVE ACÁ Y NO DENTRO DEL COMPONENTE por el mismo motivo por el que
// `mapearRespuestaPuerto` salió de dentro de `fetchPortStatus`: para que un
// instrumento pueda medirlo sin red y sin React. La PWA no tiene runner, así que
// el rojo de §4.6 se corre sobre esta función desde el scratchpad de sesión.
//
// NO COMPONE TEXTO, Y ESO ES EL DISEÑO. `capa_1` y `capa_2` llegan ya compuestas
// del backend, que las transcribe de §10 de CONTRATO_MOTOR.md y las coteja contra
// el contrato en cada `npm test`. Escribir texto acá le daría DOS fuentes a un
// texto que tiene una — que es lo que `DriftCatalogoBlock` hace hoy, y no se copia.
// ─────────────────────────────────────────────────────────────────────────────

// El largo va ENTERO y con «unos» (decisión del owner, 2026-08-21): el dato sale
// de la discretización de la ruta, no de una medición del límite, y un decimal
// promete una precisión que no tiene. Y no caduca: 24,6449 y 24,6646 —los dos
// valores medidos del mismo tramo el 2026-08-21— dan los dos 25.
export function textoDeLargo(largoKm) {
  if (!Number.isFinite(largoKm) || largoKm <= 0) return null;
  const km = Math.round(largoKm);
  return km === 0 ? 'menos de 1 km' : `unos ${km} km`;
}

// EL CONTACTO SE MUESTRA CON LA MISMA CONDICIÓN CON LA QUE EL BACKEND ELIGIÓ EL
// TEXTO, y no es una decisión de este lado: `cobertura-jurisdiccional.js` usa
// `capitanias.length === 1` para elegir entre `capa_2_con_capitania` y
// `capa_2_sin_capitania`. Si el bloque mostrara teléfonos cuando el texto deriva
// al genérico, la tarjeta diría dos cosas distintas sobre a quién llamar.
//
// EL RÓTULO SALE DE `tipo`, nunca de un literal de acá. Es lo que hace que
// INV-10.1 se cumpla en su propósito —no rotular como Capitanía un número que es
// de la Gobernación— y no sólo en su letra. `etiquetaDeNivel` devuelve null en el
// tercer escalón, y ahí el campo no se muestra ni se sustituye por nada.
function contactoDelAviso(aviso) {
  const cs = aviso.capitanias || [];
  if (cs.length !== 1) return null;
  const etiqueta = etiquetaDeNivel(cs[0].tipo);
  if (!etiqueta || !cs[0].nombre) return null;
  return { etiqueta, nombre: cs[0].nombre, telefono: cs[0].telefono || null };
}

export function avisosDeCobertura(transitRestrictions) {
  const c = transitRestrictions?.cobertura_jurisdiccional;
  if (!c) return null;
  // Un fallo de evaluación NO se muestra como "no hay nada": es la misma regla con
  // la que `escalarPorCobertura` lo cuenta como U (INV-0.2). Sin esta rama la
  // bandera subiría a U sin nada debajo, que es el defecto que la capa B cierra.
  if (c.estado === 'no_evaluada') {
    return { estado: 'no_evaluada', motivo: c.motivo || null, avisos: [] };
  }
  const avisos = (c.avisos || []).map((a) => ({
    orden: a.orden_en_ruta,
    capa_1: a.capa_1,
    capa_2: a.capa_2,
    largo: textoDeLargo(a.largo_km),
    contacto: contactoDelAviso(a),
  }));
  return avisos.length > 0 ? { estado: 'evaluada', motivo: null, avisos } : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// EL PASAMANOS DE /api/sitport/restricciones
//
// Sale de dentro de `fetchPortStatus` para que un instrumento pueda medirlo sin
// red y sin React: el pasamanos es donde el dato se pierde, así que tiene que
// ser el sujeto de un control y no una parte inalcanzable de una función async.
// La lógica no cambia: son las mismas líneas, con `ahora` inyectable para que la
// medición sea determinística y no dependa del reloj de la corrida.
// ─────────────────────────────────────────────────────────────────────────────
export function mapearRespuestaPuerto(data, nombrePuerto, ahora = Date.now()) {
  const restricciones = data?.restricciones || [];
  const timestamp = data?.timestamp ? new Date(data.timestamp).getTime() : ahora;
  const edadMinutos = (ahora - timestamp) / 60000;
  const dato_viejo = edadMinutos > CONFIG.DATO_VIEJO_MIN;

  let estado = 'verde';
  if (dato_viejo) estado = 'ambar';
  // NO SE TOCA EN ESTE TRAMO, Y NO ES UN OLVIDO. `nivel` no existe en ninguna de
  // las 444 filas del sondaje, así que este `some` es `false` siempre y `estado`
  // NUNCA vale 'rojo'. Reemplazarlo por el dato de cierre enciende el veredicto
  // UV de ZARPE, que deshabilita el CTA — eso es Tramo C (Z3), y no arranca
  // hasta que el filtro de puerto del backend esté resuelto. D-C9: el despacho
  // ante la Autoridad Marítima es obligatorio y hay un funcionario entre la app
  // y el zarpe, así que un aviso equivocado se corrige ahí, pero un botón
  // apagado no lo destraba nadie. Por eso el aviso tolera el defecto de
  // atribución del filtro y el bloqueo no.
  if (restricciones.some((r) => r.nivel === 'cierre_total')) estado = 'rojo';
  else if (restricciones.length > 0) estado = 'ambar';

  return {
    nombre: nombrePuerto,
    estado,
    restricciones,
    timestamp: data?.timestamp || new Date().toISOString(),
    dato_viejo,
    edad_minutos: Math.round(edadMinutos),
    capitania: data?.capitania || null,
    gobernacion: data?.gobernacion || null,
    telefono: data?.telefono || null,
    // INV-10.1 ya resuelto por el motor (CONTRATO_MOTOR.md §5.1). Este pasamanos
    // COPIA CAMPO POR CAMPO: un campo que no se nombre acá no llega al
    // componente. Los tres de arriba se conservan porque P1 y P2 los leen.
    // El consumidor distingue DOS ausencias que no son la misma: `contacto`
    // en null es que el backend no lo mandó —anterior a dc7d63e, o error— y
    // habilita el fallback; `contacto.nivel` en null es el ESCALÓN 3, y ahí el
    // campo no se muestra y no se sustituye por nada.
    contacto: data?.contacto || null,
    // ESTADO DE CIERRE (D-C1). Array hermano de `restricciones`, alineado por
    // `IDRestriccion`, tal como lo emite `sitport-routes.js:362`. Se pasa TAL
    // CUAL VIENE y sin tocarle el `texto_original`: D-C4 dice que el texto de la
    // Capitanía sale sin parafrasear, y una normalización de paso acá sería una
    // paráfrasis silenciosa. Hasta este commit el campo no estaba nombrado, y
    // por eso el dato llegaba al navegador y moría en esta función.
    // `null` = el backend no lo mandó. `[]` = lo mandó y no hay nada. No se
    // colapsan: `cierresDeclarados` sólo interroga un array de verdad.
    cierre: data?.cierre || null,
    error: null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// FETCH SITPORT — con caché, timeout, retry y fallback conservador
// ─────────────────────────────────────────────────────────────────────────────
async function fetchPortStatus(nombrePuerto, ubicacion, signal) {
  const cacheKey = `port:${nombrePuerto}`;
  const cached = cacheGet(cacheKey);
  if (cached) return { ...cached, from_cache: true };

  const { ok, data, error } = await safeFetch(
    `${BACKEND_URL}/api/sitport/restricciones`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ puerto: nombrePuerto, ...ubicacion }),
    },
    { signal }
  );

  // Cancelado por el usuario → propagar sin escribir en caché
  if (!ok && error === 'Cancelado') {
    return { nombre: nombrePuerto, estado: 'ambar', restricciones: [], timestamp: null, dato_viejo: true, cancelado: true, error };
  }

  if (!ok || !data) {
    // Sin datos → ámbar conservador, nunca verde falso
    return { nombre: nombrePuerto, estado: 'ambar', restricciones: [], timestamp: null, dato_viejo: true, error: error || 'Sin respuesta' };
  }

  const result = mapearRespuestaPuerto(data, nombrePuerto);

  cacheSet(cacheKey, result);
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// MUESTREO DE RUTA PARA EL VIENTO SITPORT (misma lógica que P4_ActiveVoyage)
// El backend matchea bahías por proximidad contra cada punto de la ruta; con
// solo zarpe y recalada se pierden las bahías del corredor central. Se
// interpolan puntos equidistantes (~50 km) para que el weather-ruta traiga
// todos los tramos y no solo los extremos.
// ─────────────────────────────────────────────────────────────────────────────
function distanciaKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function construirRutaPuntos(zarpe, recalada, pasoKm = 50) {
  if (!recalada) return [{ lat: zarpe.lat, lng: zarpe.lng }];
  const distTotal = distanciaKm(zarpe.lat, zarpe.lng, recalada.lat, recalada.lng);
  const segmentos = Math.max(1, Math.ceil(distTotal / pasoKm));
  const puntos = [];
  for (let i = 0; i <= segmentos; i++) {
    const t = i / segmentos;
    puntos.push({
      lat: zarpe.lat + (recalada.lat - zarpe.lat) * t,
      lng: zarpe.lng + (recalada.lng - zarpe.lng) * t,
    });
  }
  return puntos; // incluye zarpe (i=0) y recalada (i=segmentos)
}

// Densifica una polilínea de puntos base (zarpe + destinos) interpolando
// ~50 km en cada tramo. Con un solo destino equivale exactamente a la ruta
// muestreada de P4; con varios, interpola tramo a tramo sin duplicar los
// vértices de unión.
function densificarRuta(puntos, pasoKm = 50) {
  if (!Array.isArray(puntos) || puntos.length < 2) return puntos;
  const out = [puntos[0]];
  for (let i = 0; i < puntos.length - 1; i++) {
    const seg = construirRutaPuntos(puntos[i], puntos[i + 1], pasoKm);
    for (let j = 1; j < seg.length; j++) out.push(seg[j]);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// FETCH CLIMA — con caché y fallback
// ─────────────────────────────────────────────────────────────────────────────
async function fetchWeather(ruta_puntos, signal) {
  const cacheKey = `weather:${JSON.stringify(ruta_puntos)}`;
  const cached = cacheGet(cacheKey);
  if (cached) return { ...cached, from_cache: true };

  const { ok, data, error } = await safeFetch(
    `${BACKEND_URL}/api/sitport/weather-ruta`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ruta_puntos }),
    },
    { signal }
  );

  if (!ok || !data) {
    return { error: error || 'Sin datos de clima', peor_tramo: null, condicion_puerto: null, alerta_nivel: null };
  }

  const result = { ...data, error: null };
  cacheSet(cacheKey, result);
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// FETCH RESTRICCIONES DE TRÁNSITO — restricciones SITPORT en bahías intermedias
// de la ruta (jurisdicciones que se cruzan, distintas de zarpe y recalada).
// Mismo patrón de resiliencia; si falla devuelve null y no bloquea el resto de P3.
// ─────────────────────────────────────────────────────────────────────────────
async function fetchTransitRestrictions(ruta_puntos, nave_ab, signal, { perfil_deportivo, navegacion_deportiva } = {}) {
  const depKey = perfil_deportivo ? `:${perfil_deportivo.licencia}:${perfil_deportivo.clasificacion_nave}` : '';
  const cacheKey = `transit:${JSON.stringify(ruta_puntos)}:${nave_ab ?? 'null'}${depKey}`;
  const cached = cacheGet(cacheKey);
  if (cached) return { ...cached, from_cache: true };

  const body = { ruta_puntos, nave_ab };
  if (perfil_deportivo) body.perfil_deportivo = perfil_deportivo;
  if (navegacion_deportiva) body.navegacion_deportiva = navegacion_deportiva;

  const { ok, data } = await safeFetch(
    `${BACKEND_URL}/api/sitport/restricciones-ruta`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    { signal }
  );

  if (!ok || !data || !data.success) return null;

  const result = {
    veredicto: data.veredicto || null,
    bandera_final: data.bandera_final || data.veredicto || null,
    veredicto_deportivo: data.veredicto_deportivo || null,
    motivo_principal: data.motivo_principal || null,
    ultimo_tramo_seguro: data.ultimo_tramo_seguro || null,
    fondeadero_sugerido: data.fondeadero_sugerido || null,
    restricciones_intermedias: data.restricciones_intermedias || [],
    total: data.total || 0,
    // A3. Se pasa tal cual viene: el campo trae su propio `estado`, y perderlo
    // haría que un fallo de evaluación se leyera como "no hay nada que avisar".
    drift_catalogo: data.drift_catalogo || null,
    // INV-3.6. CUARTA vez que este pasamanos deja morir un campo del backend, y
    // la tercera que hay que venir a nombrarlo a mano: antes fueron `cierre` y
    // `drift_catalogo`. Se pasa tal cual viene, con su `estado`, por el mismo
    // motivo que el de arriba. Medido el 2026-08-20: el backend mandó bandera U
    // con 1 aviso de 24,6646 km sobre Antofagasta -> Taltal y la pantalla dijo
    // «BANDERA Q — Zarpe autorizado».
    cobertura_jurisdiccional: data.cobertura_jurisdiccional || null,
  };
  cacheSet(cacheKey, result);
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// FETCH MAREA — con caché y fallback
// El backend expone lat/lon (no lat/lng) en la query string; las ubicaciones
// del frontend usan `.lng` (mismo campo que ya consumen fetchNavigation y
// P4_ActiveVoyage) — se traduce acá, no se asume `.lon` en ningún objeto de
// voyageData.
// ─────────────────────────────────────────────────────────────────────────────
async function fetchTide(lat, lng, datetimeISO, signal) {
  if (lat == null || lng == null) {
    return { error: 'Sin coordenadas', height_m: null, trend: null, next_high: null, next_low: null, station_used: null, distance_mn: null };
  }

  const cacheKey = `tide:${lat},${lng},${datetimeISO}`;
  const cached = cacheGet(cacheKey);
  if (cached) return { ...cached, from_cache: true };

  const params = new URLSearchParams({ lat, lon: lng, datetime: datetimeISO });
  const { ok, data, error } = await safeFetch(
    `${BACKEND_URL}/api/tide/predict?${params.toString()}`,
    {},
    { signal }
  );

  if (!ok || !data) {
    return { error: error || 'Sin datos de marea', height_m: null, trend: null, next_high: null, next_low: null, station_used: null, distance_mn: null };
  }

  const result = { ...data, error: null };
  cacheSet(cacheKey, result);
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// FETCH RUTA RASTER — verifica si el destino es alcanzable por agua
// Sin caché: el resultado depende de coordenadas exactas y calado; es rápido
// cuando el snap falla (no hay A*) y la verificación debe ser fresca.
// ─────────────────────────────────────────────────────────────────────────────
async function fetchRuta(origen, destino, licencia, signal) {
  if (!origen?.lat || !origen?.lng || !destino?.lat || !destino?.lng) {
    return { ok: false, error_code: 'SNAP_FAILED', error: 'Coordenadas de origen o destino no disponibles' };
  }
  const body = {
    lat_origen: origen.lat,
    lon_origen: origen.lng,
    lat_destino: destino.lat,
    lon_destino: destino.lng,
    licencia: licencia || 'PNM',
  };
  const { ok, data, error } = await safeFetch(
    `${BACKEND_URL}/api/rutas/calcular`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    { signal, retries: 0 }
  );
  if (!ok || !data) {
    return { ok: false, error_code: 'FETCH_FAILED', error: error || 'No se pudo contactar el servidor de rutas' };
  }
  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// FETCH NAVEGACIÓN — con caché y fallback
// ─────────────────────────────────────────────────────────────────────────────
async function fetchNavigation(voyageData, signal) {
  const { vessel, puerto_zarpe, destinos, fecha_zarpe, combustible_disponible } = voyageData;

  const ruta_puntos = [
    { lat: puerto_zarpe.ubicacion.lat, lng: puerto_zarpe.ubicacion.lng },
    ...(destinos || []).map((d) => ({
      lat: d.puerto?.ubicacion?.lat || d.marina?.lat || d.fondeadero?.lat || d.centro?.ubicacion?.lat || d.centro?.lat || 0, 
      lng: d.puerto?.ubicacion?.lng || d.marina?.lng || d.fondeadero?.lng || d.centro?.ubicacion?.lng || d.centro?.lng || 0,
    })),
  ].filter((p) => p.lat !== 0 && p.lng !== 0);

  const body = {
    tipo_embarcacion: vessel.tipo_embarcacion || 'lancha',
    eslora: vessel.eslora,
    manga: vessel.manga,
    velocidad_crucero_nominal: vessel.velocidad_crucero,
    consumo_nominal: vessel.consumo_nominal,
    ruta_puntos,
    peso_carga_adicional_ton: vessel.carga_ton || 0,
    fecha_hora_salida: fecha_zarpe,
    combustible_disponible_litros: combustible_disponible,
  };

  const cacheKey = `nav:${JSON.stringify(body)}`;
  const cached = cacheGet(cacheKey);
  if (cached) return { ...cached, from_cache: true };

  const { ok, data, error } = await safeFetch(
    `${BACKEND_URL}/api/navegacion/calculo`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    { signal }
  );

  if (!ok || !data) {
    return { error: error || 'Sin datos de navegación', autonomia_ok: null };
  }

const payload = data.data || data;
const resumen = payload.resumen || payload;

  const autonomia_ok =
    resumen.combustible_disponible_litros == null
      ? true
      : resumen.consumo_total_litros <= resumen.combustible_disponible_litros;

  const result = { ...resumen, segmentos: payload.segmentos, autonomia_ok, error: null };
  cacheSet(cacheKey, result);
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// RECORDATORIOS NORMATIVOS — sistema de reglas contextuales (local, sin red)
// Cada regla evalúa una condición del viaje concreto y solo se agrega si se
// cumple. Datos: voyageData + el resultado de los fetch (navigation, weather,
// portStatus). Niveles: 'alerta' (coral, R6), 'obligatorio', 'recomendado',
// 'informativo'. Referencias normativas por regla en el campo `norma`.
// ─────────────────────────────────────────────────────────────────────────────

// Umbral de viento (kt) según la categoría de la licencia/nave (Circular
// A-41/013): Alta Mar 30, Costera 26, Bahía 20. Se resuelve primero por la
// clasificación de la nave (P1) y, si no está, por el tipo de licencia.
function umbralVientoLicencia(vessel, licenseType) {
  const porClasificacion = {
    ALTA_MAR:    { umbral: 30, categoria: 'Alta Mar' },
    COSTERA_60:  { umbral: 26, categoria: 'Costera' },
    COSTERA_12:  { umbral: 26, categoria: 'Costera' },
    BAHIA_VELA:  { umbral: 20, categoria: 'Bahía' },
    BAHIA_MOTOR: { umbral: 20, categoria: 'Bahía' },
  };
  if (vessel?.clasificacion && porClasificacion[vessel.clasificacion]) {
    return porClasificacion[vessel.clasificacion];
  }

  const codigo = normalizeLicense(licenseType);
  const porLicencia = {
    CDAM: { umbral: 30, categoria: 'Alta Mar' },
    CDC:  { umbral: 26, categoria: 'Costera' },
    PDB:  { umbral: 20, categoria: 'Bahía' },
    PLDB: { umbral: 20, categoria: 'Bahía' },
  };
  return porLicencia[codigo] || { umbral: 26, categoria: 'Costera' };
}

// ─────────────────────────────────────────────────────────────────────────────
// EL RÓTULO DEL CONTACTO — INV-10.1
//
// EL ESCALÓN NO SE DECIDE ACÁ. Lo decide el motor y viaja resuelto en
// `contacto.nivel` (CONTRATO_MOTOR.md §5.1, `src/services/contacto-por-escalon.js`).
// Lo único que vive de este lado es CÓMO SE ESCRIBE cada nivel, y está en UNA
// sola función para que los dos consumidores —la tarjeta de zarpe y recalada y
// el recordatorio r1— no puedan divergir en el literal.
// ─────────────────────────────────────────────────────────────────────────────
export function etiquetaDeNivel(nivel) {
  if (nivel === 'capitania') return 'Capitanía de Puerto de';
  if (nivel === 'gobernacion') return 'Gobernación Marítima de';
  return null; // escalón 3 — el campo NO se muestra, y no se sustituye por nada
}

// Frase ya rotulada para un mensaje, o null si no hay a quién nombrar.
// `fallbackNombre` es la tabla de `utils/capitanias.js`, que §5.1 declara que
// NO ES FUENTE: sólo se consulta cuando el backend no mandó `contacto`, y
// resuelve a nivel Gobernación, así que se rotula como Gobernación.
export function rotularContacto(contacto, fallbackNombre) {
  if (contacto) {
    const etq = etiquetaDeNivel(contacto.nivel);
    return etq && contacto.nombre ? `la ${etq} ${contacto.nombre}` : null;
  }
  const n = fallbackNombre();
  return n ? `la ${etiquetaDeNivel('gobernacion')} ${n}` : null;
}

function buildNormativeReminders(voyageData, context = {}) {
  const { navigation, weather, portStatus } = context;
  const vessel = voyageData?.vessel || {};
  const licenseType = (vessel.licenseType || vessel.tipo_licencia || voyageData?.tipo_licencia || '').toString();
  const reminders = [];

  // Coordenadas de zarpe y recalada
  const zarpe = voyageData?.puerto_zarpe?.ubicacion || null;
  const recalada = portStatus?.recalada?.ubicacion || null;

  // ── R1 — SIEMPRE: aviso por radio a la Capitanía de zarpe ──────────────────
  // El NOMBRE y su RÓTULO salen del escalón que el motor ya resolvió; rotular
  // "Gobernación Marítima de" sobre el número de una Capitanía es el defecto que
  // INV-10.1 existe para cerrar.
  //
  // EL TELÉFONO NO VA, y no es una omisión: la PRIMERA FRASE de INV-10.1 dice
  // que el contacto se muestra "sólo en el punto de zarpe y en el de recalada,
  // nunca dentro de un mensaje normativo". El teléfono sigue en la tarjeta de
  // zarpe, que es donde el invariante lo pone. §10 lo dice con otras palabras:
  // los mensajes del catálogo no llevan teléfono.
  const contactoZarpe = portStatus?.zarpe?.contacto;
  const capZarpeRotulo = rotularContacto(
    contactoZarpe,
    () => (zarpe ? getCapitania(zarpe.lat, zarpe.lng)?.nombre : null)
  );
  reminders.push({
    id: 'r1_radio_aviso', nivel: 'obligatorio',
    texto: capZarpeRotulo
      ? `Avisar por radio a ${capZarpeRotulo} al iniciar la navegación`
      : 'Avisar por radio a la Capitanía más cercana al iniciar la navegación',
    canal: voyageData?.nearest_capitania?.vhf_primary ? `VHF Ch ${voyageData.nearest_capitania.vhf_primary}` : null,
    norma: 'TM-006 Art. 3',
  });

  // ── R2 — SIEMPRE: reporte de posición ──────────────────────────────────────
  reminders.push({
    id: 'r2_reporte_posicion', nivel: 'obligatorio',
    texto: 'Reportar posición en navegación según TM-011',
    norma: 'TM-011',
  });

  // ── R3 — ETA > 12 h: reportes cada 4 h ─────────────────────────────────────
  const etaHoras = navigation?.eta_horas;
  if (typeof etaHoras === 'number' && etaHoras > 12) {
    reminders.push({
      id: 'r3_larga_duracion', nivel: 'obligatorio',
      texto: `Viaje de larga duración (${Math.round(etaHoras)}h). Reportar posición cada 4 horas por canal VHF 16 a la Capitanía más cercana`,
      canal: 'VHF Ch 16',
      norma: 'TM-011',
    });
  }

  // ── R4 — Zarpe nocturno (20:00–06:00 hora local) ───────────────────────────
  // fecha_zarpe puede venir solo como fecha (sin hora) desde P2 — en ese caso
  // no se puede determinar la hora y la regla no se evalúa (evita falso positivo
  // por interpretar medianoche UTC como noche local).
  const fechaZarpe = voyageData?.fecha_zarpe;
  if (typeof fechaZarpe === 'string' && fechaZarpe.includes('T')) {
    const h = new Date(fechaZarpe).getHours();
    if (!isNaN(h) && (h >= 20 || h < 6)) {
      reminders.push({
        id: 'r4_nocturna', nivel: 'obligatorio',
        texto: 'Navegación nocturna. Verificar luces de navegación operativas y llevar equipo de señalización nocturna',
        norma: 'COLREG Regla 20',
      });
    }
  }

  // ── R5 — Corredor austral (lat de zarpe O recalada < -41.75) ───────────────
  const latZarpe = zarpe?.lat;
  const latRecalada = recalada?.lat;
  if ((latZarpe != null && latZarpe < -41.75) || (latRecalada != null && latRecalada < -41.75)) {
    reminders.push({
      id: 'r5_canales_australes', nivel: 'informativo',
      texto: 'Navegación en zona de canales australes. Las rutas autorizadas están definidas en el Art. 45 del TM-008',
      norma: 'TM-008 Art. 45',
    });
  }

  // ── R6 — Viento del peor tramo sobre el umbral de la licencia ──────────────
  const vientoPeor = weather?.peor_tramo?.velocidad_viento_kt;
  if (typeof vientoPeor === 'number') {
    const { umbral, categoria } = umbralVientoLicencia(vessel, licenseType);
    if (vientoPeor > umbral) {
      const nombreTramo = weather?.peor_tramo?.nombre || 'la ruta';
      reminders.push({
        id: 'r6_viento_umbral', nivel: 'alerta',
        texto: `Pronóstico de viento (${Math.round(vientoPeor)} kt en ${nombreTramo}) supera el umbral de tu categoría de licencia (${categoria}, ${umbral} kt)`,
        norma: 'Circular A-41/013',
      });
    }
  }

  // ── R7 — Licencia/uso artesanal o de pesca ─────────────────────────────────
  const licLower = licenseType.toLowerCase();
  if (licLower.includes('artesanal') || licLower.includes('pesca') || vessel?.uso === 'pesca') {
    reminders.push({
      id: 'r7_sernapesca', nivel: 'obligatorio',
      texto: 'Registrar zarpe y recalada también en plataforma Sernapesca. Verificar seguro de tripulación vigente',
      norma: 'DS 129/2013',
    });
  }

  // ── R8 — Larga distancia (> 100 mn) ────────────────────────────────────────
  const distancia = navigation?.distancia_total_mn;
  if (typeof distancia === 'number' && distancia > 100) {
    reminders.push({
      id: 'r8_autonomia', nivel: 'recomendado',
      texto: `Viaje de larga distancia (${Math.round(distancia)} mn). Verificar autonomía de combustible con margen de seguridad del 30%`,
      norma: 'Buenas prácticas',
    });
  }

  // ── R9 — Recalada con restricciones parciales (activas, no bloqueantes) ─────
  const recaladaStatus = portStatus?.recalada;
  if (recaladaStatus?.estado !== 'rojo' && (recaladaStatus?.restricciones?.length || 0) > 0) {
    reminders.push({
      id: 'r9_recalada_parcial', nivel: 'recomendado',
      texto: 'Puerto de recalada con restricciones parciales activas. Confirmar condiciones antes de llegar',
      norma: 'DGTM O-41/001',
    });
  }

  return reminders;
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK PRINCIPAL
// Protecciones implementadas:
//   1. AbortController por ejecución → cancela fetch si usuario navega hacia atrás
//   2. runIdRef → previene race condition entre ejecuciones concurrentes
//   3. mountedRef → previene setState en componente desmontado
//   4. Timeout por fetch individual (12s) → spinner nunca infinito
//   5. Retry con backoff exponencial en 429/503
//   6. Caché en memoria con TTL (3 min) → tolerante a reconexiones lentas
//   7. Fallback conservador por servicio → fallo parcial no rompe la pantalla
//   8. voyageData como dependencia estabilizada → evita re-ejecuciones fantasma
// ─────────────────────────────────────────────────────────────────────────────
export function useVoyageVerification(voyageData) {
  const [state, setState] = useState({
    loading: true,
    loadingStep: 0,
    error: null,
    portStatus: null,
    weather: null,
    transitRestrictions: null,
    navigation: null,
    tide: null,
    normative: null,
    veredicto: null,
    arribadaForzosa: false,
    ruta: null,
    completedAt: null,
  });

  // Ref para detectar componente desmontado
  const mountedRef = useRef(true);

  // Ref para identificar la ejecución activa y descartar ejecuciones previas
  const runIdRef = useRef(0);

  // Ref para el AbortController de la ejecución en curso
  const abortRef = useRef(null);

  // setState seguro: no actualiza si el componente ya se desmontó
  const safeSetState = useCallback((updater) => {
    if (mountedRef.current) {
      setState(updater);
    }
  }, []);

  const run = useCallback(async () => {
    if (!voyageData) return;

    // Cancelar ejecución anterior si aún está corriendo
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const signal = controller.signal;

    // Generar ID único para esta ejecución
    const currentRunId = ++runIdRef.current;

    safeSetState(() => ({
      loading: true,
      loadingStep: 0,
      error: null,
      portStatus: null,
      weather: null,
      transitRestrictions: null,
      navigation: null,
      tide: null,
      normative: null,
      veredicto: null,
      arribadaForzosa: false,
      ruta: null,
      completedAt: null,
    }));

    try {
      const { puerto_zarpe, destinos, fecha_zarpe } = voyageData;
    const puerto_recalada = destinos?.[0]?.puerto || destinos?.[0]?.marina || destinos?.[0]?.centro || null;

      // Ubicación de recalada: mismo fallback que usa fetchPortStatus más abajo
      // (algunos destinos traen `ubicacion.lat/lng`, otros lat/lng al nivel raíz).
      const recaladaUbicacion = puerto_recalada?.ubicacion || { lat: puerto_recalada?.lat, lng: puerto_recalada?.lng };

      const ruta_puntos = [
        { lat: puerto_zarpe.ubicacion.lat, lng: puerto_zarpe.ubicacion.lng },
        ...(destinos || []).map((d) => ({
          lat: d.puerto?.ubicacion?.lat || d.marina?.lat || d.fondeadero?.lat || d.centro?.ubicacion?.lat || d.centro?.lat || 0,
          lng: d.puerto?.ubicacion?.lng || d.marina?.lng || d.fondeadero?.lng || d.centro?.ubicacion?.lng || d.centro?.lng || 0,
        })),
      ].filter((p) => p.lat !== 0 && p.lng !== 0);

      // Paso 1 — SITPORT
      if (runIdRef.current !== currentRunId || signal.aborted) return;
      safeSetState((s) => ({ ...s, loadingStep: 0 }));

      // Paso 2 — Clima
      if (runIdRef.current !== currentRunId || signal.aborted) return;
      safeSetState((s) => ({ ...s, loadingStep: 1 }));

      // Paso 3 — Ruta
      if (runIdRef.current !== currentRunId || signal.aborted) return;
      safeSetState((s) => ({ ...s, loadingStep: 2 }));

      // La marea en recalada corresponde a la hora de LLEGADA, no de zarpe —
      // se encadena sobre navPromise (misma promesa referenciada dos veces,
      // no dispara un segundo cálculo) para usar eta_llegada_iso apenas esté
      // disponible; si el cálculo de navegación falla o no trae ETA, cae a
      // fecha_zarpe.
      const navPromise = fetchNavigation(voyageData, signal);
      const tideRecaladaPromise = navPromise
        .catch(() => null)
        .then((navResult) => {
          const etaLlegada = navResult?.eta_llegada_iso || fecha_zarpe;
          return fetchTide(recaladaUbicacion?.lat, recaladaUbicacion?.lng, etaLlegada, signal);
        });

      // Misma ruta densificada (~50 km) que consume el clima; se reutiliza para
      // las restricciones de tránsito para no interpolar dos veces.
      const rutaDensa = densificarRuta(ruta_puntos);

      // Verificación de navegabilidad raster: origen → primer destino.
      // Detecta si el destino (centro salmonero, mitílidos, GPS manual, etc.)
      // está fuera de zona navegable del raster antes de mostrar el veredicto.
      const rutaPromise = (() => {
        const rutaOrigen = ruta_puntos[0];
        const rutaDestino = ruta_puntos[ruta_puntos.length - 1];
        if (!rutaOrigen || !rutaDestino || ruta_puntos.length < 2) {
          return Promise.resolve({ ok: false, error_code: 'SNAP_FAILED', error: 'Sin coordenadas de destino' });
        }
        const licencia = normalizeLicense(voyageData?.vessel?.licenseType) || 'PNM';
        return fetchRuta(rutaOrigen, rutaDestino, licencia, signal);
      })();

      // Promise.allSettled → ningún fallo individual rompe todo el proceso
      // (a diferencia de Promise.all que aborta ante el primer rechazo)
      // restricciones-ruta se encadena DESPUÉS porque necesita los waypoints
      // reales del motor raster, no una interpolación en línea recta.
      const results = await Promise.allSettled([
        fetchPortStatus(
          puerto_zarpe.nombre,
          puerto_zarpe.ubicacion,
          signal
        ),
        puerto_recalada
          ? fetchPortStatus(
              puerto_recalada.nombre || puerto_recalada.nombre_marina || 'Destino',
              recaladaUbicacion,
              signal
            )
          : Promise.resolve({ nombre: 'Sin destino definido', estado: 'ambar', restricciones: [], dato_viejo: true }),
        fetchWeather(rutaDensa, signal),
        navPromise,
        fetchTide(puerto_zarpe.ubicacion?.lat, puerto_zarpe.ubicacion?.lng, fecha_zarpe, signal),
        tideRecaladaPromise,
        rutaPromise,
      ]);

      // Si llegó una ejecución más nueva mientras esperábamos → descartar
      if (runIdRef.current !== currentRunId) return;

      // Extraer resultados — si settled con 'rejected' usamos fallback conservador
      const [zarpeR, recaladaR, weatherR, navR, tideZarpeR, tideRecaladaR, rutaR] = results;

      const zarpeStatus = zarpeR.status === 'fulfilled'
        ? zarpeR.value
        : { nombre: puerto_zarpe.nombre, estado: 'ambar', restricciones: [], dato_viejo: true, error: zarpeR.reason?.message };

      const recaladaStatus = recaladaR.status === 'fulfilled'
        ? recaladaR.value
        : { nombre: 'Destino', estado: 'ambar', restricciones: [], dato_viejo: true, error: recaladaR.reason?.message };

      const weatherData = weatherR.status === 'fulfilled'
        ? weatherR.value
        : { error: weatherR.reason?.message, peor_tramo: null, condicion_puerto: null, alerta_nivel: null };

      const navData = navR.status === 'fulfilled'
        ? navR.value
        : { error: navR.reason?.message, autonomia_ok: null };

      const tideZarpe = tideZarpeR.status === 'fulfilled'
        ? tideZarpeR.value
        : { error: tideZarpeR.reason?.message || 'Sin datos de marea', height_m: null, trend: null, next_high: null, next_low: null, station_used: null, distance_mn: null };

      const tideRecalada = tideRecaladaR.status === 'fulfilled'
        ? tideRecaladaR.value
        : { error: tideRecaladaR.reason?.message || 'Sin datos de marea', height_m: null, trend: null, next_high: null, next_low: null, station_used: null, distance_mn: null };

      // Resultado del motor raster: indica si el destino es navegable.
      // FETCH_FAILED → fallo de red, no bloqueamos el resto de P3.
      const ruta = rutaR.status === 'fulfilled'
        ? rutaR.value
        : { ok: false, error_code: 'FETCH_FAILED', error: rutaR.reason?.message || 'Error al calcular ruta' };

      // Restricciones de tránsito — se llama de forma secuencial usando los
      // waypoints reales del motor raster (tramos sin aproximacion_final).
      // Si la ruta falló (SNAP_FAILED, NO_ROUTE, FETCH_FAILED) no se llama:
      // no tiene sentido evaluar restricciones sobre una ruta inexistente.
      const vessel = voyageData?.vessel;
      const isRecreativo = vessel?.uso === 'recreativo';
      let perfilDeportivo = null;
      let navegacionDeportiva = null;

      if (isRecreativo && vessel?.licencia && vessel?.clasificacion && vessel?.propulsion) {
        perfilDeportivo = {
          licencia: vessel.licencia,
          clasificacion_nave: vessel.clasificacion,
          propulsion: vessel.propulsion,
          motor_operativo: vessel.propulsion === 'vela' ? (vessel.motor_operativo === true) : undefined,
          eslora: parseFloat(vessel.eslora) || undefined,
          motor_hp: vessel.motor_hp ? parseFloat(vessel.motor_hp) : undefined,
          arqueo_bruto: vessel.ab ? parseFloat(vessel.ab) : undefined,
        };

        const maxDistCosta = ruta?.ok ? ruta.max_dist_costa_mn : null;
        const esBahia = vessel.clasificacion === 'BAHIA_VELA' || vessel.clasificacion === 'BAHIA_MOTOR';
        let ambitoMillas;
        if (esBahia) {
          ambitoMillas = 'bahia';
        } else if (maxDistCosta != null) {
          ambitoMillas = maxDistCosta;
        }
        navegacionDeportiva = ambitoMillas !== undefined ? { ambito_millas: ambitoMillas } : {};
      }

      let transitRestrictions = null;
      if (ruta?.ok && Array.isArray(ruta.tramos)) {
        const tramosRuta = ruta.tramos.filter(
          (t) => t.tipo !== 'aproximacion_final' && t.coords?.length >= 2
        );
        if (tramosRuta.length > 0 && !signal.aborted && runIdRef.current === currentRunId) {
          const rutaWaypoints = tramosRuta
            .flatMap((t) => t.coords)
            .map(([lng, lat]) => ({ lat, lng }));
          transitRestrictions = await fetchTransitRestrictions(
            rutaWaypoints,
            voyageData?.vessel?.ab,
            signal,
            { perfil_deportivo: perfilDeportivo, navegacion_deportiva: navegacionDeportiva }
          );
        }
      }

      if (runIdRef.current !== currentRunId) return;

      // Paso 4 — Veredicto
      safeSetState((s) => ({ ...s, loadingStep: 3 }));

      // Se adjunta la ubicación del puerto al estado — PortStatusBlock la usa
      // para resolver la Gobernación Marítima jurisdiccional (getCapitania).
      const portStatus = {
        zarpe:    { ...zarpeStatus,    ubicacion: puerto_zarpe.ubicacion },
        recalada: { ...recaladaStatus, ubicacion: recaladaUbicacion },
      };
      const tide = {
        zarpe: { ...tideZarpe, nombre_puerto: puerto_zarpe.nombre },
        recalada: { ...tideRecalada, nombre_puerto: puerto_recalada?.nombre || puerto_recalada?.nombre_marina || 'Destino' },
      };
      const normative = buildNormativeReminders(voyageData, {
        navigation: navData,
        weather: weatherData,
        portStatus,
      });
      const { veredicto, arribadaForzosa, detalles: _det } = calcularVeredicto({
        portStatus,
        weather: weatherData,
        navigation: navData,
        transitRestrictions,
      });

      safeSetState(() => ({
        loading: false,
        loadingStep: 3,
        error: null,
        portStatus,
        weather: weatherData,
        transitRestrictions,
        navigation: navData,
        tide,
        normative,
        veredicto,
        arribadaForzosa,
        ruta,
        completedAt: new Date().toISOString(),
      }));

    } catch (err) {
      // Solo llega aquí si hay un error fuera de los fetch (bug en lógica interna)
      if (runIdRef.current !== currentRunId || signal.aborted) return;
      safeSetState((s) => ({ ...s, loading: false, error: err.message }));
    }
  }, [voyageData]);

  // Ejecutar al montar y cuando cambie voyageData
  useEffect(() => {
    mountedRef.current = true;
    run();

    return () => {
      // Cleanup: cancelar fetch en curso al desmontar o al cambiar voyageData
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, [voyageData]);
  // Exponer retry manual (también cancela ejecución previa vía run())
  return { ...state, retry: run };
}
