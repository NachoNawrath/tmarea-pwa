// src/components/voyage/TideCurvePanel.jsx
// Panel colapsable con la marea de la RUTA en P4, dibujada como una "línea
// continua del viaje": cada estación se dibuja SOLO durante el tramo de tiempo
// en que la nave está en su zona (desde su hora de paso hasta la de la
// siguiente estación), en un color distinto. El patrón lee de un vistazo la
// marea que va a experimentar tramo a tramo — "cuando llegue a Castro será
// bajamar, al pasar por Melinka estará subiendo" — en vez de 4 curvas de 24h
// superpuestas que se cruzaban sin sentido.
//
// El endpoint /api/tide/curve-ruta devuelve la curva completa de cada estación
// sobre la ventana del viaje; acá se RECORTA cada una a su tramo. No se toca la
// lógica de snapping/selección de estaciones (vive en el backend).
//
// Fetch asíncrono al abrir el panel, con skeleton de carga — nunca bloquea P4.
import React, { useEffect, useRef, useState } from 'react';
import { useStationName } from '../../hooks/useStationName';

const BACKEND_URL = 'http://localhost:3000';

const C = {
  marino:    '#0A2647',
  electrico: '#1A6EBD',
  turquesa:  '#5DCAA5',
  coral:     '#E8512A',
  ambar:     '#FFC107',
  crema:     '#F1EFE8',
  cierre:    '#A7B6C7', // gris azulado neutro para el cierre de la navegación
};

// Paleta suave y distinguible — una por estación, en orden de ruta.
const PALETTE = ['#5DCAA5', '#7FB3E8', '#C7A9DE', '#E8A87C', '#A8C686', '#E0C25A', '#D48FB5', '#79C9C0'];

const VB_W = 820;
const VB_H = 250;
const MARGIN = { top: 28, right: 16, bottom: 48, left: 100 };
const PLOT_W = VB_W - MARGIN.left - MARGIN.right;
const PLOT_H = VB_H - MARGIN.top - MARGIN.bottom;

function formatHora(iso) {
  return new Date(iso).toLocaleTimeString('es-CL', {
    timeZone: 'America/Santiago',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

// Reloj que avanza cada 60s para mover el marcador de progreso "AHORA" sin
// re-fetch. Solo corre mientras el panel está abierto.
function useNow(active) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 60 * 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

function useTideCurveRuta(rutaPuntos, horaZarpe, velocidadNudos, open) {
  const [state, setState] = useState({ loading: false, error: null, data: null });

  // Clave estable para no re-fetchear en cada render por identidad del array.
  const key = JSON.stringify({ rutaPuntos, horaZarpe, velocidadNudos });

  useEffect(() => {
    if (!open) return;
    if (!Array.isArray(rutaPuntos) || rutaPuntos.length < 1) {
      setState({ loading: false, error: 'Sin ruta definida', data: null });
      return;
    }
    if (!horaZarpe || !(velocidadNudos > 0)) {
      setState({ loading: false, error: 'Faltan datos de zarpe o velocidad', data: null });
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    setState({ loading: true, error: null, data: null });

    fetch(`${BACKEND_URL}/api/tide/curve-ruta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ruta_puntos: rutaPuntos, hora_zarpe: horaZarpe, velocidad_nudos: velocidadNudos }),
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data) => {
        if (cancelled) return;
        if (!data.ok || !Array.isArray(data.estaciones_ruta) || data.estaciones_ruta.length === 0) {
          setState({ loading: false, error: 'Sin estaciones de marea en el rango de la ruta', data: null });
          return;
        }
        setState({ loading: false, error: null, data });
      })
      .catch((err) => {
        if (!cancelled && err.name !== 'AbortError') {
          setState({ loading: false, error: err.message || 'Sin datos', data: null });
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [key, open]); // eslint-disable-line react-hooks/exhaustive-deps

  return state;
}

// Altura interpolada linealmente en `ms` a partir de la curva muestreada de la
// estación — para que cada tramo empiece/termine EXACTAMENTE en la hora de
// transición y los segmentos se toquen en X.
function interpAt(curva, ms) {
  const t0 = new Date(curva[0].time).getTime();
  const tN = new Date(curva[curva.length - 1].time).getTime();
  if (ms <= t0) return curva[0].height_m;
  if (ms >= tN) return curva[curva.length - 1].height_m;
  for (let i = 1; i < curva.length; i++) {
    const tb = new Date(curva[i].time).getTime();
    if (tb >= ms) {
      const ta = new Date(curva[i - 1].time).getTime();
      const f = (ms - ta) / (tb - ta || 1);
      return curva[i - 1].height_m + (curva[i].height_m - curva[i - 1].height_m) * f;
    }
  }
  return curva[curva.length - 1].height_m;
}

// Recorta la curva de una estación al tramo [segStart, segEnd] (ms), con los
// extremos interpolados exactos. Devuelve [{ms, h}].
function clipSegment(curva, segStart, segEnd) {
  if (segEnd <= segStart) return [];
  const pts = [{ ms: segStart, h: interpAt(curva, segStart) }];
  for (const p of curva) {
    const t = new Date(p.time).getTime();
    if (t > segStart && t < segEnd) pts.push({ ms: t, h: p.height_m });
  }
  pts.push({ ms: segEnd, h: interpAt(curva, segEnd) });
  return pts;
}

// Índice de la estación donde está la nave AHORA: la última cuyo paso estimado
// ya ocurrió. Antes del primer paso -> primera; después del último -> última.
function activeStationIndex(estaciones, nowMs) {
  let idx = 0;
  for (let i = 0; i < estaciones.length; i++) {
    if (new Date(estaciones[i].hora_estimada_paso).getTime() <= nowMs) idx = i;
  }
  return idx;
}

function JourneyChart({ estaciones, nowMs }) {
  const startMs = new Date(estaciones[0].curva[0].time).getTime();
  const refCurva = estaciones[0].curva;
  const endMs = new Date(refCurva[refCurva.length - 1].time).getTime();
  const totalMs = endMs - startMs || 1;

  // Tramo temporal de cada estación: [paso_i, paso_{i+1}] y la última hasta el
  // fin de la ventana (así la recalada muestra su marea tras la llegada).
  const segments = estaciones.map((e, i) => {
    const segStart = new Date(e.hora_estimada_paso).getTime();
    const segEnd = i < estaciones.length - 1 ? new Date(estaciones[i + 1].hora_estimada_paso).getTime() : endMs;
    return { estacion: e, idx: i, color: PALETTE[i % PALETTE.length], pts: clipSegment(e.curva, segStart, segEnd), segStart, segEnd };
  });

  // Escala Y sobre lo que realmente se ve (los tramos recortados), no sobre las
  // 24h completas de cada estación — así el eje aprovecha el alto disponible.
  let rawMin = Infinity;
  let rawMax = -Infinity;
  for (const s of segments) {
    for (const p of s.pts) {
      if (p.h < rawMin) rawMin = p.h;
      if (p.h > rawMax) rawMax = p.h;
    }
  }
  if (!isFinite(rawMin)) { rawMin = 0; rawMax = 1; }
  const range = rawMax - rawMin || 0.2;
  const pad = range * 0.1;
  const minH = rawMin - pad;
  const maxH = rawMax + pad;

  const xScale = (ms) => MARGIN.left + ((ms - startMs) / totalMs) * PLOT_W;
  const yScale = (h) => MARGIN.top + (1 - (h - minH) / (maxH - minH)) * PLOT_H;
  const bottomY = MARGIN.top + PLOT_H;

  const activeIdx = activeStationIndex(estaciones, nowMs);

  // Ticks de X: intervalo según la duración de la ventana (~4-6 marcas).
  const totalH = totalMs / 3600000;
  const intervalH = totalH <= 36 ? 6 : totalH <= 72 ? 12 : 24;
  const xTicks = [];
  for (let h = 0; h <= totalH + 0.001; h += intervalH) {
    const ms = startMs + h * 3600 * 1000;
    xTicks.push({ x: xScale(ms), label: formatHora(new Date(ms).toISOString()) });
  }

  // Ticks de Y (4 niveles) en metros
  const yTicks = [];
  for (let i = 0; i <= 3; i++) {
    const h = minH + ((maxH - minH) * i) / 3;
    yTicks.push({ y: yScale(h), label: h.toFixed(1) });
  }

  const nowX = xScale(Math.min(Math.max(nowMs, startMs), endMs));
  const endX = xScale(endMs); // extremo derecho: fin de la ventana / última estación

  const pathOf = (pts) => 'M ' + pts.map((p) => `${xScale(p.ms)},${yScale(p.h)}`).join(' L ');

  return (
    <svg viewBox={`0 0 ${VB_W} ${VB_H}`} style={{ width: '100%', height: '100%', display: 'block' }}>
      {/* Eje Y — label horizontal (2 líneas) centrado verticalmente, sin rotar */}
      <text x={2} y={MARGIN.top + PLOT_H / 2 - 4} fill={C.crema} fillOpacity={0.85} fontSize={13} fontWeight={700} textAnchor="start">Altura de</text>
      <text x={2} y={MARGIN.top + PLOT_H / 2 + 12} fill={C.crema} fillOpacity={0.85} fontSize={13} fontWeight={700} textAnchor="start">marea (m)</text>
      {yTicks.map((t, i) => (
        <g key={`y${i}`}>
          <line x1={MARGIN.left} y1={t.y} x2={VB_W - MARGIN.right} y2={t.y} stroke={C.crema} strokeOpacity={0.1} strokeWidth={1} />
          <text x={MARGIN.left - 8} y={t.y + 4} fill={C.crema} fillOpacity={0.7} fontSize={12} textAnchor="end">{t.label}</text>
        </g>
      ))}

      {/* Eje X — rejilla + horas + label de contexto */}
      {xTicks.map((t, i) => (
        <g key={`x${i}`}>
          <line x1={t.x} y1={MARGIN.top} x2={t.x} y2={bottomY} stroke={C.crema} strokeOpacity={0.08} strokeWidth={1} />
          {/* Primera/última etiqueta ancladas al borde para no desbordar el área de dibujo */}
          <text
            x={t.x} y={bottomY + 15} fill={C.crema} fillOpacity={0.7} fontSize={12}
            textAnchor={i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle'}
          >
            {t.label}
          </text>
        </g>
      ))}
      <text x={MARGIN.left + PLOT_W / 2} y={VB_H - 4} fill={C.crema} fillOpacity={0.7} fontSize={12} fontWeight={700} textAnchor="middle">
        Horas de navegación
      </text>

      {/* Línea continua del viaje: un tramo de color por estación */}
      {segments.map((s) =>
        s.pts.length >= 2 ? (
          <path
            key={`seg${s.idx}`}
            d={pathOf(s.pts)}
            fill="none"
            stroke={s.color}
            strokeWidth={s.idx === activeIdx ? 3.5 : 2.5}
            strokeOpacity={s.idx === activeIdx ? 1 : 0.9}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : null
      )}

      {/* Puntos de transición + nombre de zona. Zarpe (⚓) en el primero,
          recalada (🏁) en el último; los intermedios llevan solo el nombre. */}
      {segments.map((s) => {
        const x = xScale(s.segStart);
        if (s.segStart < startMs || s.segStart > endMs || s.pts.length === 0) return null;
        const y = yScale(s.pts[0].h);
        const isFirst = s.idx === 0;
        const isLast = s.idx === estaciones.length - 1;
        const prefix = isFirst ? '⚓ ' : isLast ? '🏁 ' : '';
        const labelY = MARGIN.top - 11; // todos a la misma altura (línea horizontal uniforme)
        // El nombre se centra en el punto medio del rango temporal de la zona
        // (no al inicio del tramo); la línea y el punto de transición quedan en
        // el borde de entrada a la zona.
        const labelX = xScale((s.segStart + Math.min(s.segEnd, endMs)) / 2);
        return (
          <g key={`tr${s.idx}`}>
            <line x1={x} y1={MARGIN.top} x2={x} y2={bottomY} stroke={s.color} strokeOpacity={0.28} strokeWidth={1} strokeDasharray="2,3" />
            <circle cx={x} cy={y} r={3.5} fill={s.color} stroke={C.marino} strokeWidth={1} />
            <text x={labelX} y={labelY} fill={s.color} fontSize={13} fontWeight={700} textAnchor="middle">
              {prefix}{s.estacion.nombre}
            </text>
          </g>
        );
      })}

      {/* Inicio de la navegación — línea de referencia (ex-AHORA); texto abajo */}
      <line x1={nowX} y1={MARGIN.top} x2={nowX} y2={bottomY} stroke={C.coral} strokeWidth={1.5} strokeDasharray="4,3" />
      <text
        x={nowX + 4} y={bottomY - 6} fill={C.coral} fontSize={12} fontWeight="700" textAnchor="start"
        stroke={C.marino} strokeWidth={2.5} strokeLinejoin="round" style={{ paintOrder: 'stroke' }}
      >
        Inicio de la navegación
      </text>

      {/* Final de la navegación — extremo derecho (fin de la última estación) */}
      <line x1={endX} y1={MARGIN.top} x2={endX} y2={bottomY} stroke={C.cierre} strokeWidth={1.5} strokeDasharray="4,3" />
      <text
        x={endX - 4} y={bottomY - 6} fill={C.cierre} fontSize={12} fontWeight="700" textAnchor="end"
        stroke={C.marino} strokeWidth={2.5} strokeLinejoin="round" style={{ paintOrder: 'stroke' }}
      >
        Final de la navegación
      </text>
    </svg>
  );
}

// Ítem de leyenda en flujo de ruta: swatch + nombre + (rol HH:MM) + nota de
// precisión al lado si corresponde. `role` ∈ {zarpe, paso, recalada}.
function LegendStation({ estacion, color, role }) {
  const nombre = useStationName(estacion.station_id) || estacion.nombre;
  const rolTxt = role === 'zarpe' ? `zarpe ${formatHora(estacion.hora_estimada_paso)}`
    : role === 'recalada' ? `recalada ~${formatHora(estacion.hora_estimada_paso)}`
    : `paso ~${formatHora(estacion.hora_estimada_paso)}`;
  return (
    <span style={styles.legendItem}>
      <span style={{ ...styles.legendSwatch, background: color }} />
      <span style={styles.legendName}>{nombre}</span>
      <span style={styles.legendMeta}>({rolTxt})</span>
      {estacion.precision_reducida && <span style={styles.legendPrecision}>· precisión reducida</span>}
    </span>
  );
}

export default function TideCurvePanel({ open, onClose, rutaPuntos, horaZarpe, velocidadNudos }) {
  const { loading, error, data } = useTideCurveRuta(rutaPuntos, horaZarpe, velocidadNudos, open);
  const now = useNow(open);

  if (!open) return null;

  const estaciones = data?.estaciones_ruta || [];
  const roleOf = (i) => (i === 0 ? 'zarpe' : i === estaciones.length - 1 ? 'recalada' : 'paso');

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <span style={styles.headerTitle}>Marea en ruta — durante el viaje</span>
        <button style={styles.closeBtn} onClick={onClose}>×</button>
      </div>

      <div style={styles.chartWrap}>
        {loading && (
          <div style={styles.skeleton}>
            <div style={styles.skeletonBar} />
            <span style={styles.centerText}>Cargando curvas de marea…</span>
          </div>
        )}
        {!loading && error && <span style={styles.centerText}>{error}</span>}
        {!loading && !error && estaciones.length > 0 && <JourneyChart estaciones={estaciones} nowMs={now} />}
      </div>

      {!loading && !error && estaciones.length > 0 && (
        <div style={styles.legend}>
          {estaciones.map((e, i) => (
            <React.Fragment key={e.station_id + i}>
              {i > 0 && <span style={styles.legendArrow}>→</span>}
              <LegendStation estacion={e} color={PALETTE[i % PALETTE.length]} role={roleOf(i)} />
            </React.Fragment>
          ))}
        </div>
      )}

      {!loading && !error && estaciones.length > 0 && velocidadNudos > 0 && horaZarpe && (
        <span style={styles.sourceNote}>
          Estimación basada en tu velocidad de crucero ({velocidadNudos} nudos) y hora de zarpe ({formatHora(horaZarpe)}).
          Los tiempos de paso son aproximados.
        </span>
      )}

      <span style={styles.footer}>Predicción armónica. No reemplaza información oficial del SHOA.</span>
    </div>
  );
}

const styles = {
  panel: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    zIndex: 12,
    height: 340,
    backgroundColor: 'rgba(10,38,71,0.94)',
    borderRadius: '16px 16px 0 0',
    display: 'flex',
    flexDirection: 'column',
    padding: '8px 12px 6px',
    boxSizing: 'border-box',
    fontFamily: 'Arial',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    color: C.crema,
    fontSize: 12,
    fontWeight: 700,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: C.crema,
    fontSize: 20,
    lineHeight: 1,
    cursor: 'pointer',
    padding: '0 4px',
  },
  chartWrap: {
    flex: 1,
    position: 'relative',
    minHeight: 0,
    marginTop: 2,
  },
  skeleton: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  skeletonBar: {
    width: '80%',
    height: 6,
    borderRadius: 3,
    background: 'linear-gradient(90deg, rgba(255,255,255,0.08) 25%, rgba(255,255,255,0.18) 50%, rgba(255,255,255,0.08) 75%)',
    backgroundSize: '200% 100%',
    animation: 'tideShimmer 1.2s linear infinite',
  },
  centerText: {
    color: C.crema,
    fontSize: 12,
    opacity: 0.7,
    whiteSpace: 'nowrap',
    textAlign: 'center',
  },
  legend: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '3px 6px',
    padding: '5px 0 3px',
    maxHeight: 66,
    overflowY: 'auto',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 12,
    color: C.crema,
  },
  legendArrow: {
    color: C.crema,
    opacity: 0.5,
    fontSize: 12,
  },
  legendSwatch: {
    width: 12,
    height: 4,
    borderRadius: 2,
    display: 'inline-block',
    flexShrink: 0,
  },
  legendName: {
    whiteSpace: 'nowrap',
    fontWeight: 700,
  },
  legendMeta: {
    opacity: 0.7,
    fontSize: 9.5,
    whiteSpace: 'nowrap',
  },
  legendPrecision: {
    opacity: 0.6,
    fontSize: 9,
    fontStyle: 'italic',
    color: C.ambar,
    whiteSpace: 'nowrap',
  },
  sourceNote: {
    color: C.crema,
    opacity: 0.7,
    fontSize: 9.5,
    marginTop: 3,
    lineHeight: 1.35,
  },
  footer: {
    color: C.crema,
    opacity: 0.5,
    fontSize: 9,
    marginTop: 2,
  },
};

// Keyframes del shimmer del skeleton — inyectados una vez (styles inline no
// soportan @keyframes).
if (typeof document !== 'undefined' && !document.getElementById('tide-shimmer-kf')) {
  const styleEl = document.createElement('style');
  styleEl.id = 'tide-shimmer-kf';
  styleEl.textContent = '@keyframes tideShimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }';
  document.head.appendChild(styleEl);
}
