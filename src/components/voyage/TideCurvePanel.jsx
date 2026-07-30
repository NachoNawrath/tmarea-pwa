// src/components/voyage/TideCurvePanel.jsx
// Panel colapsable con la curva de marea 24h del puerto de recalada.
// El fetch a /api/tide/curve se dispara recién al abrir el panel (no al
// cargar P4) — devuelve ~144 puntos para 24h/10min, suficiente para un SVG
// inline sin librerías de charting.
import React, { useEffect, useState } from 'react';
import { useStationName } from '../../hooks/useStationName';

const BACKEND_URL = 'http://localhost:3000';

const C = {
  marino:    '#0A2647',
  electrico: '#1A6EBD',
  turquesa:  '#5DCAA5',
  coral:     '#E8512A',
  ambar:     '#FFC107',
  crema:     '#F1EFE8',
};

const VB_W = 800;
const VB_H = 120;
const MARGIN = { top: 10, right: 10, bottom: 20, left: 34 };
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

// Detecta máximos/mínimos locales en la serie de puntos — /api/tide/curve
// no entrega pleamar/bajamar directamente, solo la serie muestreada.
function detectExtremes(points) {
  const extremes = [];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1].height_m;
    const cur = points[i].height_m;
    const next = points[i + 1].height_m;
    if (cur >= prev && cur >= next && cur > prev) extremes.push({ ...points[i], tipo: 'alta' });
    else if (cur <= prev && cur <= next && cur < prev) extremes.push({ ...points[i], tipo: 'baja' });
  }
  return extremes;
}

function useTideCurve(lat, lng, open) {
  const [state, setState] = useState({ loading: false, error: null, data: null });

  useEffect(() => {
    if (!open) return;
    if (lat == null || lng == null) {
      setState({ loading: false, error: 'Sin coordenadas de recalada', data: null });
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    setState({ loading: true, error: null, data: null });

    const from = new Date().toISOString();
    const params = new URLSearchParams({ lat, lon: lng, from, hours: 24 });

    fetch(`${BACKEND_URL}/api/tide/curve?${params.toString()}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data) => {
        if (!cancelled) setState({ loading: false, error: null, data });
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
  }, [lat, lng, open]);

  return state;
}

function TideChart({ points }) {
  if (!points || points.length < 2) return null;

  const startMs = new Date(points[0].time).getTime();
  const endMs = new Date(points[points.length - 1].time).getTime();
  const totalMs = endMs - startMs || 1;

  const heights = points.map((p) => p.height_m);
  const rawMin = Math.min(...heights);
  const rawMax = Math.max(...heights);
  const range = rawMax - rawMin || 0.2;
  const pad = range * 0.1;
  const minH = rawMin - pad;
  const maxH = rawMax + pad;

  const xScale = (ms) => MARGIN.left + (ms / totalMs) * PLOT_W;
  const yScale = (h) => MARGIN.top + (1 - (h - minH) / (maxH - minH)) * PLOT_H;
  const bottomY = MARGIN.top + PLOT_H;

  const linePoints = points.map((p) => `${xScale(new Date(p.time).getTime() - startMs)},${yScale(p.height_m)}`);
  const linePath = `M ${linePoints.join(' L ')}`;
  const areaPath = `${linePath} L ${xScale(endMs - startMs)},${bottomY} L ${xScale(0)},${bottomY} Z`;

  // Marcas de eje X cada 3h
  const ticks = [];
  for (let h = 0; h <= 24; h += 3) {
    const ms = h * 3600 * 1000;
    if (ms > totalMs) break;
    ticks.push({ x: xScale(ms), label: formatHora(new Date(startMs + ms).toISOString()) });
  }

  const nowMs = Math.min(Math.max(Date.now() - startMs, 0), totalMs);
  const nowX = xScale(nowMs);

  const extremes = detectExtremes(points);

  return (
    <svg viewBox={`0 0 ${VB_W} ${VB_H}`} style={{ width: '100%', height: '100%', display: 'block' }}>
      {/* Área bajo la curva */}
      <path d={areaPath} fill={C.turquesa} opacity={0.15} stroke="none" />
      {/* Curva */}
      <path d={linePath} fill="none" stroke={C.turquesa} strokeWidth={2} />

      {/* Eje X */}
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={t.x} y1={MARGIN.top} x2={t.x} y2={bottomY} stroke={C.crema} strokeOpacity={0.12} strokeWidth={1} />
          <text x={t.x} y={VB_H - 4} fill={C.crema} fontSize={9} textAnchor="middle">{t.label}</text>
        </g>
      ))}

      {/* Línea AHORA */}
      <line x1={nowX} y1={MARGIN.top} x2={nowX} y2={bottomY} stroke={C.coral} strokeWidth={1} strokeDasharray="4,3" />
      <text x={nowX} y={MARGIN.top - 2} fill={C.coral} fontSize={9} fontWeight="700" textAnchor="middle">AHORA</text>

      {/* Pleamar/bajamar */}
      {extremes.map((e, i) => {
        const x = xScale(new Date(e.time).getTime() - startMs);
        const y = yScale(e.height_m);
        const color = e.tipo === 'alta' ? C.turquesa : C.electrico;
        const labelY = e.tipo === 'alta' ? y - 14 : y + 20;
        return (
          <g key={i}>
            <circle cx={x} cy={y} r={3.5} fill={color} stroke="#fff" strokeWidth={1} />
            <text x={x} y={labelY} fill={C.crema} fontSize={9} textAnchor="middle">{formatHora(e.time)}</text>
            <text x={x} y={labelY + 10} fill={color} fontSize={9} fontWeight="700" textAnchor="middle">{e.height_m.toFixed(2)} m</text>
          </g>
        );
      })}
    </svg>
  );
}

export default function TideCurvePanel({ open, onClose, lat, lng }) {
  const { loading, error, data } = useTideCurve(lat, lng, open);
  const stationName = useStationName(data?.station_used);

  if (!open) return null;

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <span style={styles.headerTitle}>
          Marea en {stationName || '…'} — próximas 24h
        </span>
        <button style={styles.closeBtn} onClick={onClose}>×</button>
      </div>

      <div style={styles.chartWrap}>
        {loading && <span style={styles.centerText}>Cargando curva de marea…</span>}
        {!loading && error && <span style={styles.centerText}>Curva de mareas no disponible</span>}
        {!loading && !error && data && <TideChart points={data.points} />}
      </div>

      {!loading && !error && data && (
        <span style={styles.footer}>
          Est. ref: {stationName || '—'} a {data.distance_mn} mn · Predicción armónica, no reemplaza SHOA
        </span>
      )}
    </div>
  );
}

const styles = {
  panel: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    zIndex: 12,
    height: 180,
    backgroundColor: 'rgba(10,38,71,0.92)',
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
  },
  centerText: {
    position: 'absolute',
    top: '50%', left: '50%',
    transform: 'translate(-50%, -50%)',
    color: C.crema,
    fontSize: 12,
    opacity: 0.7,
    whiteSpace: 'nowrap',
  },
  footer: {
    color: C.crema,
    opacity: 0.55,
    fontSize: 10,
    marginTop: 2,
  },
};
