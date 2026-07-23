// src/screens/P4_ActiveVoyage.jsx
// Pantalla de navegación activa con mapa MapLibre + capas PostGIS
import React, { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import VoyageReportButton from '../components/VoyageReportButton';
import { RutasAustralesLayer } from '../components/map/RutasAustralesLayer';
import { ConcesionesLayer, ConcesionesControl } from '../components/map/ConcesionesLayer';

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
  const markerRef    = useRef(null);

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

  // Estado del viaje
  const [sheetOpen,    setSheetOpen]    = useState(false);
  const [showClose,    setShowClose]    = useState(false);
  const [tramos,       setTramos]       = useState([]);
  const [tramoActivo,  setTramoActivo]  = useState(null);
  const [closingData,  setClosingData]  = useState(null); // datos al cerrar viaje
  const [showReport,   setShowReport]   = useState(false);
  const [gruposVisibles, setGruposVisibles] = useState(['MOLUSCOS', 'SALMONES', 'ALGAS', 'PECES', 'ABALONES o EQUINODERMOS']);

  // Inicio del viaje
  const inicioRef = useRef(new Date().toISOString());

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

// ── Ruta del viaje (motor náutico por tramos) ──
const { puerto_zarpe, destinos } = voyageData || {};
const TRAMO_COLORES = { VERDE: '#2ecc71', AMARILLO: '#f39c12', ROJO: '#e74c3c' };

['ruta-verde', 'ruta-amarillo', 'ruta-rojo'].forEach(id => {
  if (map.getLayer(id)) map.removeLayer(id);
  if (map.getSource(id)) map.removeSource(id);
});

const latOrigen  = puerto_zarpe?.ubicacion?.lat;
const lonOrigen  = puerto_zarpe?.ubicacion?.lng;
const destino    = (destinos || [])[0];
const latDestino = destino?.puerto?.ubicacion?.lat || destino?.marina?.lat || destino?.fondeadero?.lat;
const lonDestino = destino?.puerto?.ubicacion?.lng || destino?.marina?.lng || destino?.fondeadero?.lng;

if (latOrigen && lonOrigen && latDestino && lonDestino) {
fetch(BACKEND_URL + '/api/rutas/calcular', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      lat_origen: latOrigen, lon_origen: lonOrigen,
      lat_destino: latDestino, lon_destino: lonDestino
    })
  })
  .then(r => r.json())
  .then(data => {
    if (!data.ok || !data.tramos) return;
    const grupos = { VERDE: [], AMARILLO: [], ROJO: [] };
    for (const tramo of data.tramos) {
      const c = tramo.confianza || 'AMARILLO';
      if (grupos[c]) grupos[c].push(tramo.coords);
    }
    Object.entries(grupos).forEach(([confianza, coordSets]) => {
      if (coordSets.length === 0) return;
      const id = `ruta-${confianza.toLowerCase()}`;
      const geojson = {
        type: 'FeatureCollection',
        features: coordSets.map(coords => ({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: coords }
        }))
      };
      map.addSource(id, { type: 'geojson', data: geojson });
      map.addLayer({
        id,
        type: 'line',
        source: id,
        paint: {
          'line-color': TRAMO_COLORES[confianza],
          'line-width': confianza === 'VERDE' ? 3 : 2.5,
          'line-dasharray': confianza === 'VERDE' ? [1] : [3, 2],
          'line-opacity': 0.9
        }
      });
    });
  })
  .catch(err => console.warn('[ruta náutica]', err.message));}
}

    if (map.loaded()) {
      addCapas();
    } else {
      map.on('load', addCapas);
    }
  }, [capas, voyageData]);

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
      <RutasAustralesLayer map={mapRef.current} visible={true} />
      <ConcesionesLayer map={mapRef.current} bbox={bbox} gruposVisibles={gruposVisibles} />
      <ConcesionesControl gruposVisibles={gruposVisibles} onToggle={g => setGruposVisibles(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g])} />

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

