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
    <div style={{
      ...styles.pill,
      borderColor:     alerta ? C.ambar : '#e0e0e0',
      backgroundColor: alerta ? 'rgba(255,193,7,0.07)' : '#fafafa',
    }}>
      <span style={styles.pillLabel}>{label}</span>
      <span style={{ ...styles.pillValue, color: alerta ? C.ambar : C.marino }}>
        {value ?? '—'} <span style={styles.pillUnit}>{unit}</span>
      </span>
    </div>
  );
}

export default function WeatherBlock({ weather }) {
  if (!weather) return null;

  const peor = weather.peor_tramo || null;

  const condicionColor =
    weather.condicion_puerto === 'temporal'   ? C.coral  :
    weather.condicion_puerto === 'mal_tiempo' ? C.ambar  :
    weather.condicion_puerto === 'tiempo_variable' ? C.naranja :
    C.turquesa;

  const condicionLabel =
    weather.condicion_puerto === 'temporal'        ? '🔴 Temporal activo' :
    weather.condicion_puerto === 'mal_tiempo'      ? '🟡 Mal Tiempo'      :
    weather.condicion_puerto === 'tiempo_variable' ? '🟠 Tiempo Variable' :
    '🟢 Condición Normal';

  // Viento en nudos con un decimal
  const vientoKt = peor?.velocidad_viento_kt != null
    ? Math.round(peor.velocidad_viento_kt * 10) / 10
    : null;

  // Dirección: texto cardinal preferido, sino grados
  const dirViento = peor?.direccion_viento || null;

  // Temperatura
  const tempC = peor?.temperatura_c != null
    ? Math.round(peor.temperatura_c * 10) / 10
    : null;

  // Presión
  const presionHpa = peor?.presion_hpa != null
    ? Math.round(peor.presion_hpa)
    : null;

  // Lluvia
  const lluviaMm = peor?.lluvia_mm != null
    ? Math.round(peor.lluvia_mm * 10) / 10
    : null;

  // Alerta viento: A-41/013 umbral nave menor costera = 26 kt
  const alertaViento = vientoKt != null && vientoKt >= 26;

  return (
    <div style={styles.block}>
      {/* Header */}
      <div style={styles.blockHeader}>
        <span style={styles.blockIcon}>🌊</span>
        <span style={styles.blockTitle}>Clima y oleaje de la ruta</span>
      </div>

      {/* Condición de puerto */}
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
      {!weather.error && peor && (
        <>
          <p style={styles.peorTramoLabel}>
            📍 Peor tramo de la ruta
            {peor.nombre ? ` — ${peor.nombre}` : ''}
          </p>
          <div style={styles.pillsGrid}>
            <MetricPill
              label="Viento"
              value={vientoKt}
              unit="kt"
              alerta={alertaViento}
            />
            <MetricPill
              label="Dirección"
              value={dirViento}
              unit=""
              alerta={false}
            />
            <MetricPill
              label="Temperatura"
              value={tempC}
              unit="°C"
              alerta={false}
            />
            <MetricPill
              label="Presión"
              value={presionHpa}
              unit="hPa"
              alerta={false}
            />
            {lluviaMm !== null && (
              <MetricPill
                label="Lluvia"
                value={lluviaMm}
                unit="mm"
                alerta={lluviaMm > 5}
              />
            )}
          </div>

          {/* Nota: oleaje y visibilidad no disponibles en SITPORT */}
          <p style={styles.notaTexto}>
            ℹ Oleaje y visibilidad no disponibles vía SITPORT — verificar en DIRECTEMAR antes de zarpar.
          </p>
        </>
      )}

      {/* Sin peor tramo pero sin error = sin cobertura en la ruta */}
      {!weather.error && !peor && (
        <p style={styles.errorText}>
          Sin cobertura meteorológica SITPORT para esta ruta. Verificar condiciones directamente.
        </p>
      )}

      {/* Bahías en ruta (detalle colapsable futuro) */}
      {weather.bahias_en_ruta?.length > 0 && (
        <p style={styles.notaTexto}>
          {weather.bahias_en_ruta.length} bahía(s) SITPORT en la ruta consultadas.
        </p>
      )}

      {/* Fuente */}
      <span style={styles.fuente}>
        Fuente: {weather.fuente || 'SITPORT/DIRECTEMAR'} · Respaldo institucional: SITPORT
      </span>
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
    color: '#0A2647',
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
  notaTexto: {
    fontFamily: 'Arial',
    fontSize: 11,
    color: '#999',
    margin: 0,
    lineHeight: 1.4,
  },
  resumenTexto: {
    fontFamily: 'Arial',
    fontSize: 13,
    color: '#0A2647',
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
    color: '#FFC107',
    margin: 0,
  },
};