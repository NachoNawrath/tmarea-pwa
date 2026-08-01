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
// Escalamiento del veredicto por restricciones intermedias.
// Usa el veredicto pre-calculado por el backend (motor de reglas BRE).
// Fallback: si el backend no envió veredicto, recorre las evaluaciones individuales.
export function escalarPorTransito(transitRestrictions) {
  if (!transitRestrictions) return null;

  const veredictoBackend = transitRestrictions.veredicto;
  if (veredictoBackend === 'UV') return 'UV';
  if (veredictoBackend === 'U') return 'U';
  if (veredictoBackend === 'Q') return null;

  // Fallback por evaluación individual (si el backend no envió veredicto global)
  const lista = transitRestrictions.restricciones_intermedias || [];
  let nivel = null;
  for (const r of lista) {
    const ev = r.evaluacion;
    if (!ev) continue;
    if (ev.nivel === 'UV') return 'UV';
    if (ev.nivel === 'U') nivel = 'U';
  }
  return nivel;
}

function calcularVeredicto({ portStatus, weather, navigation, transitRestrictions }) {
  const rank = { Q: 0, U: 1, UV: 2 };

  let base = 'Q';
  if (
    portStatus?.zarpe?.estado === 'rojo' ||
    portStatus?.recalada?.estado === 'rojo' ||
    weather?.condicion_puerto === 'temporal'
  ) {
    base = 'UV';
  } else if (
    portStatus?.zarpe?.estado === 'ambar' ||
    portStatus?.recalada?.estado === 'ambar' ||
    portStatus?.zarpe?.dato_viejo ||
    portStatus?.recalada?.dato_viejo ||
    weather?.condicion_puerto === 'mal_tiempo' ||
    weather?.alerta_nivel === 'alto' ||
    navigation?.autonomia_ok === false
  ) {
    base = 'U';
  }

  const esc = escalarPorTransito(transitRestrictions);
  return esc && rank[esc] > rank[base] ? esc : base;
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

  const restricciones = data?.restricciones || [];
  const ahora = Date.now();
  const timestamp = data?.timestamp ? new Date(data.timestamp).getTime() : ahora;
  const edadMinutos = (ahora - timestamp) / 60000;
  const dato_viejo = edadMinutos > CONFIG.DATO_VIEJO_MIN;

  let estado = 'verde';
  if (dato_viejo) estado = 'ambar';
  if (restricciones.some((r) => r.nivel === 'cierre_total')) estado = 'rojo';
  else if (restricciones.length > 0) estado = 'ambar';

  const result = {
    nombre: nombrePuerto,
    estado,
    restricciones,
    timestamp: data?.timestamp || new Date().toISOString(),
    dato_viejo,
    edad_minutos: Math.round(edadMinutos),
    error: null,
  };

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
async function fetchTransitRestrictions(ruta_puntos, nave_ab, signal) {
  const cacheKey = `transit:${JSON.stringify(ruta_puntos)}:${nave_ab ?? 'null'}`;
  const cached = cacheGet(cacheKey);
  if (cached) return { ...cached, from_cache: true };

  const { ok, data } = await safeFetch(
    `${BACKEND_URL}/api/sitport/restricciones-ruta`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ruta_puntos, nave_ab }),
    },
    { signal }
  );

  if (!ok || !data || !data.success) return null;

  const result = {
    veredicto: data.veredicto || null,
    motivo_principal: data.motivo_principal || null,
    ultimo_tramo_seguro: data.ultimo_tramo_seguro || null,
    fondeadero_sugerido: data.fondeadero_sugerido || null,
    restricciones_intermedias: data.restricciones_intermedias || [],
    total: data.total || 0,
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

function buildNormativeReminders(voyageData, context = {}) {
  const { navigation, weather, portStatus } = context;
  const vessel = voyageData?.vessel || {};
  const licenseType = (vessel.licenseType || vessel.tipo_licencia || voyageData?.tipo_licencia || '').toString();
  const reminders = [];

  // Coordenadas de zarpe y recalada
  const zarpe = voyageData?.puerto_zarpe?.ubicacion || null;
  const recalada = portStatus?.recalada?.ubicacion || null;

  // ── R1 — SIEMPRE: aviso por radio a la Capitanía de zarpe ──────────────────
  const capZarpe = zarpe ? getCapitania(zarpe.lat, zarpe.lng) : null;
  reminders.push({
    id: 'r1_radio_aviso', nivel: 'obligatorio',
    texto: capZarpe
      ? `Avisar por radio a la Gobernación Marítima de ${capZarpe.nombre} al iniciar la navegación`
      : 'Avisar por radio a la Capitanía más cercana al iniciar la navegación',
    canal: voyageData?.nearest_capitania?.vhf_primary ? `VHF Ch ${voyageData.nearest_capitania.vhf_primary}` : null,
    telefono: capZarpe?.telefono || null,
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

      // Promise.allSettled → ningún fallo individual rompe todo el proceso
      // (a diferencia de Promise.all que aborta ante el primer rechazo)
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
        fetchTransitRestrictions(rutaDensa, voyageData?.vessel?.ab, signal),
      ]);

      // Si llegó una ejecución más nueva mientras esperábamos → descartar
      if (runIdRef.current !== currentRunId) return;

      // Extraer resultados — si settled con 'rejected' usamos fallback conservador
      const [zarpeR, recaladaR, weatherR, navR, tideZarpeR, tideRecaladaR, transitR] = results;

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

      // Restricciones de tránsito — null si falló o no hubo ninguna intermedia;
      // el bloque no se muestra y no bloquea el resto de P3.
      const transitRestrictions = transitR.status === 'fulfilled' ? transitR.value : null;

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
      const veredicto = calcularVeredicto({
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
