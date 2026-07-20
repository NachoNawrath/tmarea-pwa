// src/components/verification/WeatherBlock.jsx
import React from 'react';

const C = {
  marino:    '#0A2647',
  electrico: '#1A6EBD',
  turquesa:  '#5DCAA5',
  coral:     '#E8512A',
  naranja:   '#F57C00',
  ambar:     '#FFC107',
};

function MetricPill({ label, value, unit, alerta }) {
  return (
    <div
      style={{
        ...styles.pill,
        borderColor: alerta ? C.ambar : '#e0e0e0',
        backgroundColor: alerta ? 'rgba(255,193,7,0.07)' : '#fafafa',
      }}
    >
      <span style={styles.pillLabel}>{label}</span>
      <span style={{ ...styles.pillValue, color: alerta ? C.ambar : C.marino }}>
        {value ?? '—'} <span style={styles.pillUnit}>{unit}</span>
      </span>
    </div>
  );
}

export default function WeatherBlock({ weather }) {
  if (!weather) return null;

  const peor = weather.peor_tramo || weather;
  const condicionColor =
    weather.condicion_puerto === 'temporal'   ? C.coral :
    weather.condicion_puerto === 'mal_tiempo' ? C.ambar :
    C.turquesa;

  const condicionLabel =
    weather.condicion_puerto === 'temporal'   ? '🔴 Temporal activo' :
    weather.condicion_puerto === 'mal_tiempo' ? '🟡 Mal Tiempo' :
    '🟢 Condición Normal';

  return (
    <div style={styles.block}>
      <div style={styles.blockHeader}>
        <span style={styles.blockIcon}>🌊</span>
        <span style={styles.blockTitle}>Clima y oleaje de la ruta</span>
      </div>

      {/* Condición de puerto (dato institucional) */}
      <div style={{ ...styles.condicionRow, borderColor: condicionColor }}>
        <span style={{ ...styles.condicionLabel, color: condicionColor }}>
          {condicionLabel}
        </span>
        <span style={styles.condicionSub}>
          Condición de Puerto · SITPORT/DIRECTEMAR
        </span>
      </div>

      {/* Error de carga */}
      {weather.error && (
        <p style={styles.errorText}>
          ⚠ No se pudo obtener datos de clima. Verificar condiciones directamente.
        </p>
      )}

      {/* Métricas del peor tramo */}
      {!weather.error && (
        <>
          <p style={styles.peorTramoLabel}>
            📍 Peor tramo de la ruta
            {peor.sector ? ` — ${peor.sector}` : ''}
          </p>
          <div style={styles.pillsGrid}>
            <MetricPill
              label="Viento"
              value={peor.viento_nudos ?? peor.wind_speed_10m}
              unit="kn"
              alerta={(peor.viento_nudos ?? peor.wind_speed_10m) > 25}
            />
            <MetricPill
              label="Oleaje"
              value={peor.altura_ola_m ?? peor.wave_height}
              unit="m"
              alerta={(peor.altura_ola_m ?? peor.wave_height) > 2.5}
            />
            <MetricPill
              label="Visibilidad"
              value={peor.visibilidad_km ?? peor.visibility}
              unit="km"
              alerta={(peor.visibilidad_km ?? peor.visibility) < 3}
            />
            <MetricPill
              label="Dirección"
              value={peor.dir_viento ?? peor.wind_direction_10m}
              unit="°"
              alerta={false}
            />
          </div>

          {/* Texto interpretado (tip de seguridad) */}
          {weather.resumen_texto && (
            <p style={styles.resumenTexto}>💬 {weather.resumen_texto}</p>
          )}

          {/* Fuente */}
          <span style={styles.fuente}>
            Fuente: {weather.fuente || 'Open-Meteo Marine'} · Respaldo institucional: SITPORT
          </span>
        </>
      )}
    </div>
  );
}

const styles = {
  block: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
  },
  blockHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  blockIcon: { fontSize: 18 },
  blockTitle: {
    fontFamily: 'Arial',
    fontWeight: 700,
    fontSize: 15,
    color: C.marino,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  condicionRow: {
    borderLeft: '3px solid',
    paddingLeft: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  condicionLabel: {
    fontFamily: 'Arial',
    fontWeight: 700,
    fontSize: 15,
  },
  condicionSub: {
    fontFamily: 'Arial',
    fontSize: 11,
    color: '#999',
  },
  peorTramoLabel: {
    fontFamily: 'Arial',
    fontWeight: 600,
    fontSize: 12,
    color: '#666',
    margin: 0,
  },
  pillsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 8,
  },
  pill: {
    border: '1px solid',
    borderRadius: 10,
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
  },
  pillLabel: {
    fontFamily: 'Arial',
    fontWeight: 600,
    fontSize: 10,
    letterSpacing: 1.5,
    color: '#888',
    textTransform: 'uppercase',
  },
  pillValue: {
    fontFamily: 'Arial',
    fontWeight: 700,
    fontSize: 20,
  },
  pillUnit: {
    fontFamily: 'Arial',
    fontWeight: 400,
    fontSize: 12,
    color: '#999',
  },
  resumenTexto: {
    fontFamily: 'Arial',
    fontSize: 13,
    color: C.marino,
    backgroundColor: 'rgba(10,38,71,0.05)',
    borderRadius: 8,
    padding: '10px 12px',
    margin: 0,
    lineHeight: 1.5,
  },
  fuente: {
    fontFamily: 'Arial',
    fontSize: 10,
    color: '#bbb',
    letterSpacing: 0.3,
  },
  errorText: {
    fontFamily: 'Arial',
    fontSize: 13,
    color: C.ambar,
    margin: 0,
  },
};
