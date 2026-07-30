// src/screens/P4_ActiveVoyage.jsx
// Pantalla de navegación activa con mapa MapLibre + capas PostGIS
import React, { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import VoyageReportButton from '../components/VoyageReportButton';
import { RutasAustralesLayer } from '../components/map/RutasAustralesLayer';
import { ConcesionesLayer, ConcesionesControl } from '../components/map/ConcesionesLayer';
import { WindLayer } from '../components/map/WindLayer';
import { normalizeLicense } from '../utils/license-rules.js';
import TideCurvePanel from '../components/voyage/TideCurvePanel';

const BACKEND_URL = 'http://localhost:3000';

// ── Paleta Tmarea ──────────────────────────────────────────────────────────
const C = {
  marino:    '#0A2647',
  profundo:  '#042C53',
  electrico: '#1A6EBD',
  turquesa:  '#5DCAA5',
  coral:     '#E8512A',
  naranja:   '#F57C00',
  ambar:     '#FFC107',
  crema:     '#F1EFE8',
};

// ── Ruta muestreada para el viento SITPORT (P4 §3) ──────────────────────────
// El backend matchea bahías por proximidad contra cada punto de la ruta; con
// solo zarpe y recalada se pierden las bahías del corredor central. Interpolamos
// puntos equidistantes (~50 km) en línea recta entre ambos extremos.
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

// ── Hook: GPS del dispositivo ──────────────────────────────────────────────
function useGPS() {
  const [pos, setPos] = useState(null);
  const [heading, setHeading] = useState(null);
  const watchRef = useRef(null);

  useEffect(() => {
    if (!navigator.geolocation) return;

    watchRef.current = navigator.geolocation.watchPosition(
      (p) => {
        setPos({ lat: p.coords.latitude, lng: p.coords.longitude });
        if (p.coords.heading != null) setHeading(p.coords.heading);
      },
      (err) => console.warn('[GPS]', err.message),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );

    return () => {
      if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current);
    };
  }, []);

  return { pos, heading };
}

// ── Hook: carga capas PostGIS ──────────────────────────────────────────────
function useMapLayers(voyageData) {
  const [capas, setCapas] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  useEffect(() => {
    if (!voyageData?.puerto_zarpe) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const { puerto_zarpe, destinos } = voyageData;
    const destino = destinos?.[0]?.puerto || destinos?.[0]?.marina || null;

    const lat1 = puerto_zarpe.ubicacion?.lat;
    const lng1 = puerto_zarpe.ubicacion?.lng;
    const lat2 = destino?.ubicacion?.lat || destino?.lat || lat1;
    const lng2 = destino?.ubicacion?.lng || destino?.lng || lng1;

    setLoading(true);

    fetch(
      `${BACKEND_URL}/api/mapa/capas?lat1=${lat1}&lng1=${lng1}&lat2=${lat2}&lng2=${lng2}&buffer_mn=15`,
      { signal: controller.signal }
    )
      .then(r => r.json())
      .then(data => {
        if (!controller.signal.aborted) {
          setCapas(data);
          setLoading(false);
        }
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [voyageData]);

  return { capas, loading, error };
}

// ── Componente principal ───────────────────────────────────────────────────
export default function P4_ActiveVoyage({ voyageData, onVoyageComplete, onCancel }) {
  const mapContainer = useRef(null);
  const mapRef       = useRef(null);
  const mapLoadedRef = useRef(false); // ver nota junto a map.once('load', ...) en la inicialización del mapa
  const markerRef    = useRef(null);
  const rutaMarkersRef = useRef([]); // markers A/B + cambios de rumbo de la ruta calculada

  const { pos, heading }        = useGPS();
  const gpsCenteredRef = useRef(false);

useEffect(() => {
  if (!pos || !mapRef.current || gpsCenteredRef.current) return;
  gpsCenteredRef.current = true;
  mapRef.current.flyTo({
    center: [pos.lng, pos.lat],
    zoom: 11,
    duration: 1500
  });
}, [pos]);
  const { capas, loading: loadingCapas } = useMapLayers(voyageData);
  const bbox = React.useMemo(() => {
  if (!voyageData?.puerto_zarpe) return null;
  const lat1 = voyageData.puerto_zarpe.ubicacion?.lat;
  const lng1 = voyageData.puerto_zarpe.ubicacion?.lng;
  const destino = voyageData.destinos?.[0]?.puerto || voyageData.destinos?.[0]?.centro || voyageData.destinos?.[0]?.marina || null;
  const lat2 = destino?.ubicacion?.lat || destino?.lat || lat1;
  const lng2 = destino?.ubicacion?.lng || destino?.lng || lng1;
  if (!lat1 || !lng1) return null;
  return { lat1, lng1, lat2, lng2 };
}, [voyageData]);

  // Coordenadas de recalada para la curva de marea (P4 §2). A diferencia de
  // bbox, NO cae de vuelta a zarpe si falta el destino -- mostrar la marea
  // de zarpe rotulada como recalada sería incorrecto, mejor "no disponible".
  const recaladaCoords = React.useMemo(() => {
    const destino = voyageData?.destinos?.[0]?.puerto || voyageData?.destinos?.[0]?.centro ||
      voyageData?.destinos?.[0]?.marina || voyageData?.destinos?.[0]?.fondeadero || null;
    const lat = destino?.ubicacion?.lat ?? destino?.lat;
    const lng = destino?.ubicacion?.lng ?? destino?.lng;
    if (lat == null || lng == null) return null;
    return { lat, lng };
  }, [voyageData]);

  // Origen/destino para el cálculo de ruta (motor raster) — hoisted para
  // reutilizar entre el efecto que dibuja el mapa y el de comparación.
  const origenDestino = React.useMemo(() => {
    const { puerto_zarpe, destinos } = voyageData || {};
    const latOrigen = puerto_zarpe?.ubicacion?.lat;
    const lonOrigen = puerto_zarpe?.ubicacion?.lng;
    const destino = (destinos || [])[0];
    const latDestino = destino?.puerto?.ubicacion?.lat || destino?.marina?.lat || destino?.fondeadero?.lat;
    const lonDestino = destino?.puerto?.ubicacion?.lng || destino?.marina?.lng || destino?.fondeadero?.lng;
    if (!latOrigen || !lonOrigen || !latDestino || !lonDestino) return null;
    return { latOrigen, lonOrigen, latDestino, lonDestino };
  }, [voyageData]);

  // Estado del viaje
  const [sheetOpen,    setSheetOpen]    = useState(false);
  const [showClose,    setShowClose]    = useState(false);
  const [tramos,       setTramos]       = useState([]);
  const [tramoActivo,  setTramoActivo]  = useState(null);
  const [closingData,  setClosingData]  = useState(null); // datos al cerrar viaje
  const [showReport,   setShowReport]   = useState(false);
  const [gruposVisibles, setGruposVisibles] = useState(['MOLUSCOS', 'SALMONES', 'ALGAS', 'PECES', 'ABALONES o EQUINODERMOS']);

  // Motor raster (Fase 3 redefinida, docs/handoff-fase2.md) — P4 consume
  // /calcular-v2. rutaV2 alimenta el panel de detalles (distancia_mn,
  // pct_en_resguardo, pct_batimetria). compararMotores es un toggle
  // TEMPORAL para QA visual contra /calcular (motor viejo) — se saca
  // cuando la ruta nueva quede verificada en pantalla.
  const [rutaV2, setRutaV2] = useState(null);
  const [compararMotores, setCompararMotores] = useState(false);
  const [tidePanelOpen, setTidePanelOpen] = useState(false);

  // Viento SITPORT por bahía a lo largo de la ruta (P4 §3). Visible por
  // defecto: el viento es información que el patrón quiere ver de entrada.
  const [windData, setWindData] = useState([]);
  const [windVisible, setWindVisible] = useState(true);

  // Puntos muestreados de la ruta (~50 km). Se usan para el fetch de viento y
  // también para posicionar las flechas sobre la línea de ruta (WindLayer las
  // snappea al punto más cercano en vez de dibujarlas en la costa).
  const rutaPuntos = React.useMemo(() => {
    const zarpe = voyageData?.puerto_zarpe?.ubicacion;
    if (zarpe?.lat == null || zarpe?.lng == null || !recaladaCoords) return [];
    return construirRutaPuntos(zarpe, recaladaCoords, 50);
  }, [voyageData, recaladaCoords]);

  // Inicio del viaje
  const inicioRef = useRef(new Date().toISOString());

  // ── Viento SITPORT en ruta (P4 §3) ──────────────────────────────────────
  // Se pide UNA vez al montar (y se refresca cada 30 min mientras P4 siga
  // montado — SITPORT actualiza ~cada 25-35 min). Si falla, no se muestran
  // flechas y no se emite error visible.
  useEffect(() => {
    const zarpe = voyageData?.puerto_zarpe?.ubicacion;
    if (zarpe?.lat == null || zarpe?.lng == null) return;

    if (rutaPuntos.length < 2) return; // sin corredor que muestrear
    const ruta_puntos = rutaPuntos;

    const controller = new AbortController();

    const fetchViento = () => {
      fetch(`${BACKEND_URL}/api/sitport/weather-ruta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ruta_puntos }),
        signal: controller.signal,
      })
        .then(r => r.json())
        .then(data => {
          if (data?.success && Array.isArray(data.bahias_en_ruta)) {
            setWindData(data.bahias_en_ruta);
          }
        })
        .catch(() => { /* sin flechas, sin error visible */ });
    };

    fetchViento();
    const intervalo = setInterval(fetchViento, 30 * 60 * 1000);

    return () => {
      controller.abort();
      clearInterval(intervalo);
    };
  }, [voyageData, recaladaCoords, rutaPuntos]);

  // ── Inicializar mapa ────────────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current || !mapContainer.current) return;

    const { puerto_zarpe } = voyageData;
    const centerLat = puerto_zarpe?.ubicacion?.lat || -41.47;
    const centerLng = puerto_zarpe?.ubicacion?.lng || -72.94;

    mapRef.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'osm-tiles': {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors',
          },
          'openseamap': {
            type: 'raster',
            tiles: ['https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png'],
            tileSize: 256,
          },
        },
        layers: [
          { id: 'osm', type: 'raster', source: 'osm-tiles', minzoom: 0, maxzoom: 19 },
          { id: 'seamark', type: 'raster', source: 'openseamap', minzoom: 8, maxzoom: 19 },
        ],
      },
      center: [centerLng, centerLat],
      zoom: 9,
    });

    mapRef.current.addControl(new maplibregl.NavigationControl(), 'top-right');

    // map.loaded() no sirve para saber si el evento 'load' YA se disparó --
    // puede volver a false despues, mientras haya tiles pendientes (churn
    // normal de un mapa raster). El efecto que agrega capas necesitaba
    // saber "ya cargó una vez", no "está reposado ahora mismo"; con
    // map.loaded() se quedaba esperando un 'load' que ya habia pasado y
    // nunca agregaba la ruta. mapLoadedRef guarda ese hecho una sola vez.
    mapRef.current.once('load', () => {
      mapLoadedRef.current = true;

      // Encuadre inicial (P4 §2): mostrar zarpe y recalada juntos en vez de
      // arrancar centrado solo en el zarpe (en viajes largos el destino
      // quedaba fuera de pantalla). Se ejecuta UNA sola vez, en 'load'; si el
      // patrón mueve el mapa después, no se vuelve a forzar. Sin recalada
      // conocida se mantiene el center/zoom de inicialización (fallback).
      const map = mapRef.current;
      const zLat = puerto_zarpe?.ubicacion?.lat;
      const zLng = puerto_zarpe?.ubicacion?.lng;
      if (map && recaladaCoords && zLat != null && zLng != null) {
        const sw = [Math.min(zLng, recaladaCoords.lng), Math.min(zLat, recaladaCoords.lat)];
        const ne = [Math.max(zLng, recaladaCoords.lng), Math.max(zLat, recaladaCoords.lat)];
        map.fitBounds([sw, ne], { padding: 60, duration: 0 });
      }
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // ── Agregar capas PostGIS al mapa ───────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !capas) return;

    const map = mapRef.current;

    const addCapas = () => {
      // ── Batimetría ──
      if (capas.batimetria?.features?.length > 0) {
        if (map.getSource('batimetria')) {
          map.getSource('batimetria').setData(capas.batimetria);
        } else {
          map.addSource('batimetria', { type: 'geojson', data: capas.batimetria });
          map.addLayer({
            id: 'batimetria-lines',
            type: 'line',
            source: 'batimetria',
            paint: {
              'line-color': '#1A6EBD',
              'line-width': 0.8,
              'line-opacity': 0.5,
            },
          });
        }
      }

      // ── Costa (polígonos) ──
      if (capas.mapa_base?.features?.length > 0) {
        if (map.getSource('costa')) {
          map.getSource('costa').setData(capas.mapa_base);
        } else {
          map.addSource('costa', { type: 'geojson', data: capas.mapa_base });
          map.addLayer({
            id: 'costa-fill',
            type: 'fill',
            source: 'costa',
            paint: {
              'fill-color': '#C8D8A0',
              'fill-opacity': 0.6,
            },
          });
          map.addLayer({
            id: 'costa-line',
            type: 'line',
            source: 'costa',
            paint: {
              'line-color': '#5a7a3a',
              'line-width': 1,
            },
          });
        }
      }

      // ── Seamarks (balizas y faros) ──
      if (capas.seamarks?.features?.length > 0) {
        if (map.getSource('seamarks')) {
          map.getSource('seamarks').setData(capas.seamarks);
        } else {
          map.addSource('seamarks', { type: 'geojson', data: capas.seamarks });
          map.addLayer({
            id: 'seamarks-circle',
            type: 'circle',
            source: 'seamarks',
            paint: {
              'circle-radius': 5,
              'circle-color': '#F57C00',
              'circle-stroke-color': '#fff',
              'circle-stroke-width': 1.5,
            },
          });
        }
      }

// ── Ruta del viaje: motor raster (Fase 3 redefinida, docs/handoff-fase2.md) ──
// P4 consume /calcular-v2. Los tramos NO tipo 'aproximacion_final' se
// concatenan en UNA sola polilínea (todavía sin diferenciar
// confianza_batimetrica por color — queda para un refinamiento posterior,
// spec §7.5). Los tramos 'aproximacion_final' (spec §7.3: snap del punto
// real a la celda navegable más cercana) se dibujan PUNTEADOS y por
// separado — no son la ruta trazada, quedan a criterio del patrón.
['ruta-verde', 'ruta-amarillo', 'ruta-rojo', 'ruta-halo', 'ruta-calculada',
 'ruta-v2-halo', 'ruta-v2', 'ruta-v2-aprox',
 'ruta-v1-compare-halo', 'ruta-v1-compare'].forEach(id => {
  if (map.getLayer(id)) map.removeLayer(id);
  if (map.getSource(id)) map.removeSource(id);
});
rutaMarkersRef.current.forEach(m => m.remove());
rutaMarkersRef.current = [];

const makeMarker = (lon, lat, label, bg) => {
  const el = document.createElement('div');
  el.style.cssText = `
    width: 22px; height: 22px; border-radius: 50%;
    background: ${bg}; border: 2px solid #fff;
    box-shadow: 0 1px 4px rgba(0,0,0,0.4);
    display: flex; align-items: center; justify-content: center;
    color: #fff; font: bold 11px sans-serif;
  `;
  el.textContent = label;
  const marker = new maplibregl.Marker({ element: el }).setLngLat([lon, lat]).addTo(map);
  rutaMarkersRef.current.push(marker);
};

if (origenDestino) {
  const { latOrigen, lonOrigen, latDestino, lonDestino } = origenDestino;

  // calado_m: vessel_profile de localStorage (P1.1). OJO: el campo
  // calado_m no existe hoy en el formulario de P1 -- si falta (undefined),
  // no se manda en el body y el backend aplica su default (1.5 m).
  // licencia: user_profile.licenseType normalizado a los codigos que
  // espera el backend (PDB/CDC/CDAM); las licencias comerciales y
  // cualquier valor no reconocido caen a 'PNM' (perfiles-costo.js las
  // trata igual que PNM de todos modos en esta fase).
  let calado_m;
  let licencia = 'PNM';
  try {
    const vessel = JSON.parse(localStorage.getItem('vessel_profile') || 'null');
    if (vessel?.calado_m) calado_m = parseFloat(vessel.calado_m);
  } catch { /* localStorage corrupto -- se usa el default del backend */ }
  try {
    const user = JSON.parse(localStorage.getItem('user_profile') || 'null');
    licencia = normalizeLicense(user?.licenseType) || 'PNM';
  } catch { /* idem */ }

  fetch(BACKEND_URL + '/api/rutas/calcular-v2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      lat_origen: latOrigen, lon_origen: lonOrigen,
      lat_destino: latDestino, lon_destino: lonDestino,
      ...(calado_m ? { calado_m } : {}),
      licencia,
    }),
  })
    .then(r => r.json())
    .then(data => {
      setRutaV2(data);
      if (!data.ok || !data.tramos) return;

      const tramosRuta  = data.tramos.filter(t => t.tipo !== 'aproximacion_final' && t.coords?.length >= 2);
      const tramosAprox = data.tramos.filter(t => t.tipo === 'aproximacion_final' && t.coords?.length >= 2);

      if (tramosRuta.length > 0) {
        const coordsConcatenadas = tramosRuta.flatMap(t => t.coords);
        map.addSource('ruta-v2', {
          type: 'geojson',
          data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coordsConcatenadas } },
        });
        map.addLayer({
          id: 'ruta-v2-halo', type: 'line', source: 'ruta-v2',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#ffffff', 'line-width': 5, 'line-opacity': 0.7 },
        });
        map.addLayer({
          id: 'ruta-v2', type: 'line', source: 'ruta-v2',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': C.electrico, 'line-width': 3, 'line-opacity': 0.95 },
        });
      }

      // Nota: no se aplica turf.simplify sobre esta geometría — varios
      // tramos incluyen vértices insertados a propósito por el backend
      // (string-pulling, land-masking). Simplificar sin volver a validar
      // contra la costa podría reabrir un cruce de tierra.

      if (tramosAprox.length > 0) {
        map.addSource('ruta-v2-aprox', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: tramosAprox.map(t => ({
              type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: t.coords },
            })),
          },
        });
        map.addLayer({
          id: 'ruta-v2-aprox', type: 'line', source: 'ruta-v2-aprox',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': C.electrico, 'line-width': 2.5, 'line-opacity': 0.75, 'line-dasharray': [2, 2] },
        });
      }

      makeMarker(lonOrigen, latOrigen, 'A', C.electrico);
      makeMarker(lonDestino, latDestino, 'B', C.coral);
    })
    .catch(err => console.warn('[ruta v2/raster]', err.message));

  // ── Comparación temporal con el motor viejo ───────────────────────────
  // Toggle de QA (botón "Comparar motores" en el mapa). Se saca junto con
  // nautical-graph-router.js/coastline-guard.js una vez verificada la ruta
  // nueva en pantalla — por ahora ninguno de los dos se toca ni se borra.
  if (compararMotores) {
    fetch(BACKEND_URL + '/api/rutas/calcular', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lat_origen: latOrigen, lon_origen: lonOrigen,
        lat_destino: latDestino, lon_destino: lonDestino,
      }),
    })
      .then(r => r.json())
      .then(data => {
        if (!data.ok || !data.tramos) return;
        const coordsV1 = data.tramos.filter(t => t.coords?.length >= 2).flatMap(t => t.coords);
        if (coordsV1.length < 2) return;

        map.addSource('ruta-v1-compare', {
          type: 'geojson',
          data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coordsV1 } },
        });
        map.addLayer({
          id: 'ruta-v1-compare-halo', type: 'line', source: 'ruta-v1-compare',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#ffffff', 'line-width': 5, 'line-opacity': 0.6 },
        });
        map.addLayer({
          id: 'ruta-v1-compare', type: 'line', source: 'ruta-v1-compare',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': C.naranja, 'line-width': 3, 'line-opacity': 0.9 },
        });
      })
      .catch(err => console.warn('[ruta v1/comparación]', err.message));
  }
}
}

    if (mapLoadedRef.current) {
      addCapas();
    } else {
      map.once('load', addCapas);
    }
  }, [capas, voyageData, origenDestino, compararMotores]);

  // ── Actualizar posición GPS en el mapa ─────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !pos) return;

    if (markerRef.current) {
      markerRef.current.setLngLat([pos.lng, pos.lat]);
    } else {
      // Icono de embarcación
      const el = document.createElement('div');
      el.style.cssText = `
        width: 28px; height: 28px;
        background: ${C.naranja};
        border: 3px solid #fff;
        border-radius: 50%;
        box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        transform: rotate(${heading || 0}deg);
      `;

      markerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([pos.lng, pos.lat])
        .addTo(mapRef.current);
    }

    // Rotar según heading
    if (heading != null && markerRef.current._element) {
      markerRef.current._element.style.transform = `rotate(${heading}deg)`;
    }
  }, [pos, heading]);

  // ── Registrar tramo ────────────────────────────────────────────────────
  const registrarTramo = useCallback((registrado) => {
    if (!tramoActivo) return;
    const ahora = new Date().toISOString();
    const duracion_min = (new Date(ahora) - new Date(tramoActivo.inicio)) / 60000;

    setTramos(prev => [...prev, {
      desde:        tramoActivo.desde,
      hasta:        tramoActivo.hasta,
      inicio:       tramoActivo.inicio,
      fin:          ahora,
      duracion_min: Math.round(duracion_min),
      distancia_mn: tramoActivo.distancia_mn || null,
      registrado,
      nota:         registrado ? null : 'Tramo navegado de memoria — excluido del informe',
    }]);
    setTramoActivo(null);
  }, [tramoActivo]);

  // ── Cerrar viaje ───────────────────────────────────────────────────────
  const [combPropulsion, setCombPropulsion] = useState('');
  const [combGenerador,  setCombGenerador]  = useState('');
  const [horaLlegada,    setHoraLlegada]    = useState('');
  const [obsPatron,      setObsPatron]      = useState('');

  const handleCerrarViaje = () => {
    const closing = {
      fecha_zarpe_real:           inicioRef.current,
      fecha_llegada_real:         horaLlegada || new Date().toISOString(),
      combustible_propulsion_real: parseFloat(combPropulsion) || null,
      combustible_generador_real:  parseFloat(combGenerador)  || null,
      tramos_registrados:          tramos,
      observaciones_patron:        obsPatron || null,
      destino_final: voyageData?.destinos?.[0]?.puerto ||
                     voyageData?.destinos?.[0]?.marina || null,
    };
    setClosingData(closing);
    setShowReport(true);
  };

  // ── ETA restante (estimado simple) ─────────────────────────────────────
  const etaRestante = () => {
    const etaTotal = voyageData?.navegacion_estimada?.eta_horas;
    if (!etaTotal) return null;
    const transcurrido = (Date.now() - new Date(inicioRef.current)) / 3600000;
    const restante = etaTotal - transcurrido;
    if (restante <= 0) return '0h 0m';
    return `${Math.floor(restante)}h ${Math.round((restante % 1) * 60)}m`;
  };

  // ── RENDER ──────────────────────────────────────────────────────────────
  return (
    <div style={styles.container}>

      {/* ── Header ── */}
      <div style={styles.header}>
        <button style={styles.cancelBtn} onClick={() => setShowClose(true)}>✕</button>
        <div style={styles.headerCenter}>
          <span style={styles.headerTitle}>
            T<span style={{ color: C.electrico }}>m</span>area
          </span>
          <span style={styles.headerSub}>NAVEGACIÓN ACTIVA</span>
        </div>
        <div style={styles.gpsIndicator}>
          <span style={{ ...styles.gpsDot, backgroundColor: pos ? C.turquesa : '#666' }} />
          <span style={styles.gpsLabel}>{pos ? 'GPS' : 'Sin GPS'}</span>
        </div>
      </div>

      {/* ── Mapa ── */}
      <div ref={mapContainer} style={styles.map} />

      {/* Flechas de viento SITPORT por bahía (P4 §3) — snapeadas a la ruta */}
      <WindLayer map={mapRef.current} windData={windData} rutaPuntos={rutaPuntos} visible={windVisible} />
      {/* Oculta durante navegación activa — capa esquemática de referencia (Art.45),
          redundante con la ruta calculada real y confunde la lectura del mapa.
          Se preserva para volver a mostrarla como overlay opcional (toggle) más adelante. */}
      {/* <RutasAustralesLayer map={mapRef.current} visible={true} /> */}
      {/* Oculta durante navegación activa — se reutiliza para alertas de proximidad a centros acuícolas (bioseguridad) */}
      {/* <ConcesionesLayer map={mapRef.current} bbox={bbox} gruposVisibles={gruposVisibles} /> */}
      {/* <ConcesionesControl gruposVisibles={gruposVisibles} onToggle={g => setGruposVisibles(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g])} /> */}

      {/* ── Toggle temporal de comparación de motores (QA Fase 3) ──
          Se saca cuando la ruta nueva quede verificada — ver
          docs/handoff-fase2.md y la nota junto a compararMotores arriba. */}
      <div style={styles.compararWrap}>
        <button
          style={{ ...styles.compararBtn, ...(compararMotores ? styles.compararBtnActivo : {}) }}
          onClick={() => setCompararMotores(v => !v)}
        >
          🔬 {compararMotores ? 'Comparando motores' : 'Comparar motores'}
        </button>
        {compararMotores && (
          <div style={styles.compararLeyenda}>
            <span style={styles.compararLeyendaItem}>
              <span style={{ ...styles.compararSwatch, background: C.electrico }} /> Nuevo (raster)
            </span>
            <span style={styles.compararLeyendaItem}>
              <span style={{ ...styles.compararSwatch, background: C.naranja }} /> Anterior (grafo)
            </span>
          </div>
        )}
      </div>

      {/* ── Toggles de capas: viento (flechas) y marea (curva de recalada) ── */}
      <div style={styles.tideToggleWrap}>
        <button
          style={{ ...styles.compararBtn, ...(windVisible ? styles.compararBtnActivo : {}) }}
          onClick={() => setWindVisible((v) => !v)}
        >
          💨 Viento
        </button>
        <button
          style={{ ...styles.compararBtn, ...(tidePanelOpen ? styles.compararBtnActivo : {}) }}
          onClick={() => setTidePanelOpen((v) => !v)}
        >
          🌊 Marea
        </button>
      </div>

      <TideCurvePanel
        open={tidePanelOpen}
        onClose={() => setTidePanelOpen(false)}
        lat={recaladaCoords?.lat}
        lng={recaladaCoords?.lng}
      />

      {/* ── Loading capas ── */}
      {loadingCapas && (
        <div style={styles.loadingOverlay}>
          <span style={styles.loadingText}>🗺️ Cargando capas náuticas…</span>
        </div>
      )}

      {/* ── Bottom Sheet ── */}
      <div style={{ ...styles.sheet, height: sheetOpen ? '55%' : '120px' }}>

        {/* Handle */}
        <div style={styles.sheetHandle} onClick={() => setSheetOpen(s => !s)}>
          <div style={styles.sheetBar} />
          <span style={styles.sheetHint}>{sheetOpen ? '▼ Ocultar' : '▲ Detalles'}</span>
        </div>

        {/* Métricas rápidas — siempre visibles */}
        <div style={styles.metricsRow}>
          <div style={styles.metric}>
            <span style={styles.metricLabel}>ETA restante</span>
            <span style={styles.metricValue}>{etaRestante() || '—'}</span>
          </div>
          <div style={styles.metric}>
            <span style={styles.metricLabel}>Rumbo</span>
            <span style={styles.metricValue}>{heading != null ? `${Math.round(heading)}°` : '—'}</span>
          </div>
          <div style={styles.metric}>
            <span style={styles.metricLabel}>Posición</span>
            <span style={styles.metricValue}>
              {pos ? `${pos.lat.toFixed(3)}, ${pos.lng.toFixed(3)}` : '—'}
            </span>
          </div>
        </div>

        {/* Contenido expandido */}
        {sheetOpen && (
          <div style={styles.sheetContent}>

            {/* Ruta calculada (motor raster) — campos nuevos que el motor
                anterior no tenía. pct_batimetria es el que importa: el
                patrón lo tiene que ver ANTES de zarpar (docs/handoff-fase2.md,
                Fase 3 — hoy es 100% ROJO, no hay fuente de batimetría de eje
                verificada para los canales chilenos). */}
            <div style={styles.sectionTitle}>Ruta calculada</div>
            {!rutaV2 && <span style={styles.rutaCalculandoText}>Calculando ruta…</span>}
            {rutaV2 && !rutaV2.ok && (
              <span style={styles.rutaCalculandoText}>No se pudo calcular la ruta: {rutaV2.error || 'error desconocido'}</span>
            )}
            {rutaV2?.ok && (
              <div style={styles.rutaMetrics}>
                <div style={styles.metricsRow}>
                  <div style={styles.metric}>
                    <span style={styles.metricLabel}>Distancia</span>
                    <span style={styles.metricValue}>{rutaV2.distancia_mn} mn</span>
                  </div>
                  <div style={styles.metric}>
                    <span style={styles.metricLabel}>En resguardo</span>
                    <span style={styles.metricValue}>{Math.round((rutaV2.pct_en_resguardo || 0) * 100)}%</span>
                  </div>
                </div>
                <div style={styles.batimetriaBox}>
                  <span style={styles.batimetriaLabel}>Confianza batimétrica de la ruta</span>
                  <div style={styles.batimetriaBar}>
                    {['verde', 'amarillo', 'rojo'].map(nivel => {
                      const pct = Math.round((rutaV2.pct_batimetria?.[nivel] || 0) * 100);
                      if (pct === 0) return null;
                      const color = nivel === 'verde' ? '#2ecc71' : nivel === 'amarillo' ? '#f39c12' : '#e74c3c';
                      return <div key={nivel} style={{ ...styles.batimetriaSeg, width: `${pct}%`, background: color }} />;
                    })}
                  </div>
                  <span style={styles.batimetriaPctRojo}>
                    {Math.round((rutaV2.pct_batimetria?.rojo || 0) * 100)}% sin dato de profundidad verificado — navegue con sonda
                  </span>
                </div>
              </div>
            )}

            {/* Tramos */}
            <div style={styles.sectionTitle}>Control de tramos</div>
            {tramoActivo ? (
              <div style={styles.tramoActivo}>
                <span style={styles.tramoAcLabel}>
                  Tramo activo: {tramoActivo.desde} → {tramoActivo.hasta}
                </span>
                <div style={styles.tramoBtns}>
                  <button style={{ ...styles.tramoBtn, backgroundColor: C.turquesa }}
                    onClick={() => registrarTramo(true)}>
                    ✓ Registrar
                  </button>
                  <button style={{ ...styles.tramoBtn, backgroundColor: '#666' }}
                    onClick={() => registrarTramo(false)}>
                    Excluir (memoria)
                  </button>
                </div>
              </div>
            ) : (
              <button style={styles.nuevoTramoBtn}
                onClick={() => setTramoActivo({
                  desde: voyageData?.puerto_zarpe?.nombre || 'Punto A',
                  hasta: voyageData?.destinos?.[0]?.puerto?.nombre || 'Punto B',
                  inicio: new Date().toISOString(),
                })}>
                + Iniciar nuevo tramo
              </button>
            )}

            {/* Historial de tramos */}
            {tramos.length > 0 && (
              <div style={styles.tramosHistorial}>
                {tramos.map((t, i) => (
                  <div key={i} style={{
                    ...styles.tramoRow,
                    borderLeftColor: t.registrado ? C.turquesa : '#666',
                  }}>
                    <span style={styles.tramoRowText}>
                      {t.desde} → {t.hasta}
                    </span>
                    <span style={styles.tramoRowSub}>
                      {Math.round(t.duracion_min)} min · {t.registrado ? '✓ Registrado' : '⊘ Excluido'}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Botón cerrar viaje */}
            <button style={styles.cerrarViajeBtn} onClick={() => setShowClose(true)}>
              🏁 Cerrar viaje y generar informe
            </button>
          </div>
        )}
      </div>

      {/* ── Modal cierre de viaje ── */}
      {showClose && !showReport && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h2 style={styles.modalTitle}>Cerrar viaje</h2>

            <label style={styles.inputLabel}>Hora de llegada real</label>
            <input
              type="datetime-local"
              style={styles.input}
              onChange={e => setHoraLlegada(new Date(e.target.value).toISOString())}
            />

            <label style={styles.inputLabel}>Combustible propulsión consumido (L)</label>
            <input
              type="number"
              placeholder="Ej: 580"
              style={styles.input}
              value={combPropulsion}
              onChange={e => setCombPropulsion(e.target.value)}
            />

            <label style={styles.inputLabel}>Combustible generador consumido (L)</label>
            <input
              type="number"
              placeholder="Ej: 120"
              style={styles.input}
              value={combGenerador}
              onChange={e => setCombGenerador(e.target.value)}
            />

            <label style={styles.inputLabel}>Observaciones del patrón (opcional)</label>
            <textarea
              placeholder="Novedades, condiciones reales, incidentes..."
              style={{ ...styles.input, height: 70, resize: 'none' }}
              value={obsPatron}
              onChange={e => setObsPatron(e.target.value)}
            />

            <div style={styles.modalBtns}>
              <button style={styles.modalBtnCancel} onClick={() => setShowClose(false)}>
                Volver al mapa
              </button>
              <button style={styles.modalBtnConfirm} onClick={handleCerrarViaje}>
                Generar informe →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal informe ── */}
      {showReport && closingData && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h2 style={styles.modalTitle}>Viaje completado</h2>
            <p style={styles.modalSub}>
              Descarga el informe operacional antes de cerrar.
            </p>
            <VoyageReportButton
              reportData={{ ...voyageData, ...closingData }}
            />
            <button
              style={{ ...styles.modalBtnConfirm, marginTop: 12 }}
              onClick={() => onVoyageComplete(closingData)}
            >
              Finalizar y nuevo viaje
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

// ── Estilos ────────────────────────────────────────────────────────────────
const styles = {
  container: {
    position: 'relative',
    width: '100%',
    height: '100vh',
    overflow: 'hidden',
    fontFamily: 'Arial',
    backgroundColor: '#000',
  },
  header: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    zIndex: 10,
    backgroundColor: 'rgba(10,38,71,0.92)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px',
  },
  cancelBtn: {
    background: 'none', border: 'none',
    color: '#fff', fontSize: 18, cursor: 'pointer',
    width: 36,
  },
  headerCenter: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
  },
  headerTitle: {
    color: '#fff', fontWeight: 800, fontSize: 18,
  },
  headerSub: {
    color: 'rgba(255,255,255,0.5)', fontSize: 9, letterSpacing: 2,
  },
  gpsIndicator: {
    display: 'flex', alignItems: 'center', gap: 5, width: 60, justifyContent: 'flex-end',
  },
  gpsDot: {
    width: 8, height: 8, borderRadius: '50%', transition: 'background 0.5s',
  },
  gpsLabel: {
    color: '#fff', fontSize: 10, fontWeight: 600,
  },
  map: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 1,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 60, left: '50%', transform: 'translateX(-50%)',
    zIndex: 20,
    backgroundColor: 'rgba(10,38,71,0.85)',
    borderRadius: 20,
    padding: '8px 16px',
  },
  loadingText: {
    color: '#fff', fontSize: 12,
  },
  compararWrap: {
    position: 'absolute',
    top: 62, right: 10,
    zIndex: 15,
    display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6,
  },
  compararBtn: {
    background: 'rgba(10,38,71,0.85)', color: '#fff',
    borderWidth: 1, borderStyle: 'solid', borderColor: 'rgba(255,255,255,0.25)', borderRadius: 20,
    padding: '7px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
    boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
  },
  compararBtnActivo: {
    background: '#F57C00', borderColor: '#F57C00',
  },
  compararLeyenda: {
    background: 'rgba(255,255,255,0.95)', borderRadius: 10,
    padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: 4,
    boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
  },
  compararLeyendaItem: {
    display: 'flex', alignItems: 'center', gap: 6,
    fontSize: 10, color: '#0A2647', fontWeight: 600, whiteSpace: 'nowrap',
  },
  compararSwatch: {
    width: 12, height: 3, borderRadius: 2, display: 'inline-block',
  },
  tideToggleWrap: {
    position: 'absolute',
    top: 62, left: 10,
    zIndex: 15,
    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6,
  },
  sheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    zIndex: 10,
    backgroundColor: '#fff',
    borderRadius: '20px 20px 0 0',
    boxShadow: '0 -4px 20px rgba(0,0,0,0.2)',
    transition: 'height 0.3s ease',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  sheetHandle: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '10px 0 4px', cursor: 'pointer',
  },
  sheetBar: {
    width: 40, height: 4, backgroundColor: '#ddd', borderRadius: 2,
  },
  sheetHint: {
    fontSize: 10, color: '#aaa', marginTop: 3,
  },
  metricsRow: {
    display: 'flex', justifyContent: 'space-around',
    padding: '8px 16px',
    borderBottom: '1px solid #f0f0f0',
  },
  metric: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
  },
  metricLabel: {
    fontSize: 9, color: '#999', letterSpacing: 0.5, textTransform: 'uppercase',
  },
  metricValue: {
    fontSize: 14, fontWeight: 700, color: '#0A2647',
  },
  sheetContent: {
    flex: 1, overflowY: 'auto', padding: '12px 16px',
    display: 'flex', flexDirection: 'column', gap: 10,
  },
  sectionTitle: {
    fontSize: 11, fontWeight: 700, color: '#888',
    letterSpacing: 1, textTransform: 'uppercase',
  },
  rutaCalculandoText: {
    fontSize: 12, color: '#999', fontStyle: 'italic',
  },
  rutaMetrics: {
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  batimetriaBox: {
    display: 'flex', flexDirection: 'column', gap: 5,
    backgroundColor: 'rgba(231,76,60,0.06)', borderRadius: 10, padding: '9px 12px',
  },
  batimetriaLabel: {
    fontSize: 10, color: '#888', fontWeight: 700,
    letterSpacing: 0.3, textTransform: 'uppercase',
  },
  batimetriaBar: {
    display: 'flex', width: '100%', height: 8, borderRadius: 4, overflow: 'hidden',
    backgroundColor: '#eee',
  },
  batimetriaSeg: {
    height: '100%',
  },
  batimetriaPctRojo: {
    fontSize: 11, color: '#c0392b', fontWeight: 700,
  },
  tramoActivo: {
    backgroundColor: 'rgba(26,110,189,0.07)',
    borderRadius: 10, padding: '10px 12px',
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  tramoAcLabel: { fontSize: 13, color: '#0A2647', fontWeight: 600 },
  tramoBtns: { display: 'flex', gap: 8 },
  tramoBtn: {
    flex: 1, padding: '9px 0', border: 'none', borderRadius: 8,
    color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer',
  },
  nuevoTramoBtn: {
    backgroundColor: '#0A2647', color: '#fff', border: 'none',
    borderRadius: 10, padding: '11px 0', fontWeight: 700, fontSize: 13,
    cursor: 'pointer', width: '100%',
  },
  tramosHistorial: {
    display: 'flex', flexDirection: 'column', gap: 6,
  },
  tramoRow: {
    borderLeft: '3px solid',
    paddingLeft: 10,
    display: 'flex', flexDirection: 'column', gap: 1,
  },
  tramoRowText: { fontSize: 12, color: '#0A2647', fontWeight: 600 },
  tramoRowSub:  { fontSize: 10, color: '#999' },
  cerrarViajeBtn: {
    backgroundColor: '#F57C00', color: '#fff', border: 'none',
    borderRadius: 12, padding: '13px 0', fontWeight: 700, fontSize: 14,
    cursor: 'pointer', width: '100%', marginTop: 4,
  },
  modalOverlay: {
    position: 'absolute', inset: 0, zIndex: 50,
    backgroundColor: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'flex-end',
  },
  modal: {
    width: '100%', backgroundColor: '#fff',
    borderRadius: '20px 20px 0 0',
    padding: '24px 20px 36px',
    display: 'flex', flexDirection: 'column', gap: 10,
    maxHeight: '85vh', overflowY: 'auto',
  },
  modalTitle: {
    fontSize: 18, fontWeight: 700, color: '#0A2647', margin: 0,
  },
  modalSub: {
    fontSize: 13, color: '#888', margin: 0,
  },
  inputLabel: {
    fontSize: 11, fontWeight: 700, color: '#888',
    letterSpacing: 0.5, textTransform: 'uppercase',
    marginBottom: -6,
  },
  input: {
    border: '1px solid #ddd', borderRadius: 8,
    padding: '10px 12px', fontSize: 14, color: '#0A2647',
    fontFamily: 'Arial', outline: 'none', width: '100%',
    boxSizing: 'border-box',
  },
  modalBtns: { display: 'flex', gap: 10, marginTop: 4 },
  modalBtnCancel: {
    flex: 1, padding: '12px 0', border: '1px solid #ddd',
    borderRadius: 10, backgroundColor: '#fff',
    color: '#888', fontWeight: 600, fontSize: 14, cursor: 'pointer',
  },
  modalBtnConfirm: {
    flex: 2, padding: '12px 0', border: 'none',
    borderRadius: 10, backgroundColor: '#F57C00',
    color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer',
  },
};

