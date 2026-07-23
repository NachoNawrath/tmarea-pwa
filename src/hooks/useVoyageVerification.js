// src/hooks/useVoyageVerification.js
import { useState, useEffect, useCallback, useRef } from 'react';

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
function calcularVeredicto({ portStatus, weather, navigation }) {
  if (
    portStatus?.zarpe?.estado === 'rojo' ||
    portStatus?.recalada?.estado === 'rojo' ||
    weather?.condicion_puerto === 'temporal'
  ) return 'UV';

  if (
    portStatus?.zarpe?.estado === 'ambar' ||
    portStatus?.recalada?.estado === 'ambar' ||
    portStatus?.zarpe?.dato_viejo ||
    portStatus?.recalada?.dato_viejo ||
    weather?.condicion_puerto === 'mal_tiempo' ||
    weather?.alerta_nivel === 'alto' ||
    navigation?.autonomia_ok === false
  ) return 'U';

  return 'Q';
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
// FETCH NAVEGACIÓN — con caché y fallback
// ─────────────────────────────────────────────────────────────────────────────
async function fetchNavigation(voyageData, signal) {
  const { vessel, puerto_zarpe, destinos, fecha_zarpe, combustible_disponible } = voyageData;

  const ruta_puntos = [
    { lat: puerto_zarpe.ubicacion.lat, lng: puerto_zarpe.ubicacion.lng },
    ...(destinos || []).map((d) => ({
      lat: d.puerto?.ubicacion?.lat || d.marina?.lat || d.fondeadero?.lat || 0,
      lng: d.puerto?.ubicacion?.lng || d.marina?.lng || d.fondeadero?.lng || 0,
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

  const autonomia_ok =
    data.combustible_disponible_litros == null
      ? true
      : data.consumo_total_litros <= data.combustible_disponible_litros;

  const result = { ...data, autonomia_ok, error: null };
  cacheSet(cacheKey, result);
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// RECORDATORIOS NORMATIVOS — lógica local, sin red
// ─────────────────────────────────────────────────────────────────────────────
function buildNormativeReminders(voyageData) {
  const { vessel, is_sport_profile, license_validation, nearest_capitania } = voyageData;
  const licenseType = vessel?.licenseType || '';
  const reminders = [];

  reminders.push({
    id: 'radio_aviso', nivel: 'obligatorio',
    texto: `Avisar por radio a ${nearest_capitania?.name || 'la Capitanía más cercana'} al iniciar la navegación.`,
    canal: nearest_capitania?.vhf_primary ? `Canal VHF ${nearest_capitania.vhf_primary}` : null,
    telefono: nearest_capitania?.phone || null,
    norma: 'TM-006 Art. 3',
  });

  reminders.push({
    id: 'reporte_posicion', nivel: 'obligatorio',
    texto: 'Reportar posición en navegación según TM-011.',
    norma: 'TM-011',
  });

  if (voyageData.es_corredor_austral) {
    reminders.push({
      id: 'ruta_art45', nivel: 'obligatorio',
      texto: 'Navegar exclusivamente por rutas reglamentarias del Art. 45 (TM-008).',
      norma: 'TM-008 Art. 29 y 45',
    });
  }

  if (is_sport_profile) {
    reminders.push({
      id: 'zarpe_deportivo', nivel: 'obligatorio',
      texto: 'Solicitar autorización de zarpe ante la Capitanía antes de partir (Circular A-41/013).',
      norma: 'Circular A-41/013',
    });
    if (licenseType === 'patron_deportivo_bahia') {
      reminders.push({
        id: 'limite_bahia', nivel: 'limite',
        texto: 'Tu licencia (PDB) limita la navegación a bahías y canales interiores dentro de 2 mn de costa.',
        norma: 'DS 87/1997',
      });
    }
    if (licenseType === 'capitan_deportivo_costero') {
      reminders.push({
        id: 'limite_costero', nivel: 'limite',
        texto: 'Tu licencia (CDC) autoriza hasta 12 mn de la costa.',
        norma: 'DS 87/1997',
      });
    }
  }

  if (licenseType?.includes('artesanal') || licenseType?.includes('pesca')) {
    reminders.push({
      id: 'seguro_tripulacion', nivel: 'bloqueante',
      texto: 'Verificar que toda la tripulación cuente con seguro vigente antes de zarpar.',
      norma: 'DS 129/2013',
    });
    reminders.push({
      id: 'sernapesca', nivel: 'obligatorio',
      texto: 'Declarar zona de pesca y fecha de zarpe/recalada en Sernapesca.',
      norma: 'DS 129/2013',
    });
  }

  if (license_validation?.hasViolation) {
    reminders.push({
      id: 'licencia_alerta', nivel: 'critico',
      texto: license_validation.alerts?.[0]?.message || 'Verificar vigencia de licencia antes de zarpar.',
      norma: 'DL 2.222/1978',
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
    navigation: null,
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
      navigation: null,
      normative: null,
      veredicto: null,
      completedAt: null,
    }));

    try {
      const { puerto_zarpe, destinos } = voyageData;
    const puerto_recalada = destinos?.[0]?.puerto || destinos?.[0]?.marina || destinos?.[0]?.centro || null;

      const ruta_puntos = [
        { lat: puerto_zarpe.ubicacion.lat, lng: puerto_zarpe.ubicacion.lng },
        ...(destinos || []).map((d) => ({
          lat: d.puerto?.ubicacion?.lat || d.marina?.lat || d.fondeadero?.lat || 0,
          lng: d.puerto?.ubicacion?.lng || d.marina?.lng || d.fondeadero?.lng || 0,
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
              puerto_recalada.ubicacion || { lat: puerto_recalada.lat, lng: puerto_recalada.lng },
              signal
            )
          : Promise.resolve({ nombre: 'Sin destino definido', estado: 'ambar', restricciones: [], dato_viejo: true }),
        fetchWeather(ruta_puntos, signal),
        fetchNavigation(voyageData, signal),
      ]);

      // Si llegó una ejecución más nueva mientras esperábamos → descartar
      if (runIdRef.current !== currentRunId || signal.aborted) return;

      // Extraer resultados — si settled con 'rejected' usamos fallback conservador
      const [zarpeR, recaladaR, weatherR, navR] = results;

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

      // Paso 4 — Veredicto
      safeSetState((s) => ({ ...s, loadingStep: 3 }));

      const portStatus = { zarpe: zarpeStatus, recalada: recaladaStatus };
      const normative = buildNormativeReminders(voyageData);
      const veredicto = calcularVeredicto({ portStatus, weather: weatherData, navigation: navData });

      safeSetState(() => ({
        loading: false,
        loadingStep: 3,
        error: null,
        portStatus,
        weather: weatherData,
        navigation: navData,
        normative,
        veredicto,
        completedAt: new Date().toISOString(),
      }));

    } catch (err) {
      // Solo llega aquí si hay un error fuera de los fetch (bug en lógica interna)
      if (runIdRef.current !== currentRunId || signal.aborted) return;
      safeSetState((s) => ({ ...s, loading: false, error: err.message }));
    }
  }, [voyageData, safeSetState]);

  // Ejecutar al montar y cuando cambie voyageData
  useEffect(() => {
    mountedRef.current = true;
    run();

    return () => {
      // Cleanup: cancelar fetch en curso al desmontar o al cambiar voyageData
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, [run]);

  // Exponer retry manual (también cancela ejecución previa vía run())
  return { ...state, retry: run };
}
