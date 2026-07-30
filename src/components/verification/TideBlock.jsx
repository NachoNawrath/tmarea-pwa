// src/components/verification/TideBlock.jsx
import React from 'react';
import { useStationName } from '../../hooks/useStationName';

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

const DISTANCIA_LEJANA_MN = 30;
const REPUNTE_MIN_MINUTOS = 45;
const SIN_INDICADOR_MAX_MINUTOS = 120;

function formatHora(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('es-CL', {
    timeZone: 'America/Santiago',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatAltura(m) {
  if (m == null) return '—';
  return `${m.toFixed(2)} m`;
}

function trendConfig(trend) {
  if (trend === 'subiendo' || trend === 'rising') {
    return { texto: '▲ subiendo', color: C.turquesa };
  }
  if (trend === 'bajando' || trend === 'falling') {
    return { texto: '▼ bajando', color: C.electrico };
  }
  if (trend === 'slack') {
    return { texto: '≈ repunte', color: C.ambar };
  }
  return { texto: '—', color: '#999' };
}

// Indicador cualitativo de corriente estimada según la fase de marea.
// No mide corriente real (no hay correntómetro) — solo aproxima la fase
// usando los próximos pleamar/bajamar que ya entrega el backend.
function calcularRepunte(nextHigh, nextLow) {
  if (!nextHigh?.time || !nextLow?.time) return null;

  const now = Date.now();
  const tHigh = new Date(nextHigh.time).getTime();
  const tLow = new Date(nextLow.time).getTime();
  const minutosSoon = (Math.min(tHigh, tLow) - now) / 60000;
  const minutosFar = (Math.max(tHigh, tLow) - now) / 60000;

  if (minutosSoon < 0) return null; // dato desactualizado, no aventurar fase

  if (minutosSoon < REPUNTE_MIN_MINUTOS) {
    return {
      texto: 'Cerca de repunte — corriente mínima estimada en canales cercanos',
      color: C.turquesa,
    };
  }

  if (minutosSoon <= SIN_INDICADOR_MAX_MINUTOS) return null;

  const halfCycle = minutosFar - minutosSoon;
  if (halfCycle <= 0) return null;

  // Fracción transcurrida del semiciclo actual (0 = extremo anterior recién
  // ocurrido, 1 = a punto de llegar al próximo extremo), estimada a partir
  // de la separación entre los dos próximos extremos conocidos.
  const fraccion = (minutosFar - 2 * minutosSoon) / halfCycle;
  if (fraccion >= 1 / 3 && fraccion <= 2 / 3) {
    return {
      texto: 'Media marea — corriente más intensa en canales y pasos estrechos',
      color: C.ambar,
    };
  }

  return null;
}

function PuertoTideCard({ data, tipo, nombrePuerto }) {
  const stationName = useStationName(data?.station_used);

  if (!data || data.error) {
    return (
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <span style={styles.tipoLabel}>{tipo}</span>
          <span style={styles.nombrePuerto}>{nombrePuerto || '—'}</span>
        </div>
        <span style={styles.sinDatos}>
          Información de mareas no disponible para esta ubicación
        </span>
      </div>
    );
  }

  const trend = trendConfig(data.trend);
  const repunte = calcularRepunte(data.next_high, data.next_low);
  const estacionLejana = data.distance_mn != null && data.distance_mn > DISTANCIA_LEJANA_MN;

  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <span style={styles.tipoLabel}>{tipo}</span>
        <span style={styles.nombrePuerto}>{nombrePuerto || '—'}</span>
      </div>

      <div style={styles.alturaRow}>
        <span style={styles.alturaLabel}>Altura actual</span>
        <span style={styles.alturaValue}>
          {formatAltura(data.height_m)} <span style={{ color: trend.color, fontWeight: 700 }}>{trend.texto}</span>
        </span>
      </div>

      <div style={styles.extremoRow}>
        <span style={styles.extremoLabel}>Próxima pleamar</span>
        <span style={styles.extremoValue}>
          {formatHora(data.next_high?.time)} {data.next_high?.height_m != null && `(${formatAltura(data.next_high.height_m)})`}
        </span>
      </div>
      <div style={styles.extremoRow}>
        <span style={styles.extremoLabel}>Próxima bajamar</span>
        <span style={styles.extremoValue}>
          {formatHora(data.next_low?.time)} {data.next_low?.height_m != null && `(${formatAltura(data.next_low.height_m)})`}
        </span>
      </div>

      <div style={styles.estacionBox}>
        <span style={styles.estacionTexto}>
          Estación de ref: {stationName || '—'}{data.distance_mn != null ? ` (${data.distance_mn} mn)` : ''}
        </span>
        {estacionLejana && (
          <span style={{ ...styles.estacionTexto, color: C.ambar }}>
            ⚠ Estación distante — precisión reducida
          </span>
        )}
      </div>

      {repunte && (
        <p style={{ ...styles.repunteTexto, color: repunte.color }}>
          ℹ️ {repunte.texto}
        </p>
      )}
    </div>
  );
}

export default function TideBlock({ tide }) {
  if (!tide) return null;

  return (
    <div style={styles.block}>
      <div style={styles.blockHeader}>
        <span style={styles.blockIcon}>🌊</span>
        <span style={styles.blockTitle}>Mareas en zarpe y recalada</span>
      </div>

      <div style={styles.cardsContainer}>
        <PuertoTideCard data={tide.zarpe} tipo="ZARPE" nombrePuerto={tide.zarpe?.nombre_puerto} />
        <PuertoTideCard data={tide.recalada} tipo="RECALADA" nombrePuerto={tide.recalada?.nombre_puerto} />
      </div>

      <p style={styles.aviso}>
        Predicción basada en análisis armónico propio. No reemplaza información oficial del SHOA.
      </p>
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
  cardsContainer: {
    display: 'grid',
    // auto-fit + minmax en vez de @media: con estilos inline no hay breakpoint
    // fijo, así que el propio grid decide — colapsa a una columna cuando no
    // entran los 300px mínimos por card (celulares en el muelle, <768px
    // típico), y pasa a dos columnas apenas hay espacio real.
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: 10,
  },
  card: {
    borderRadius: 10,
    padding: '12px 12px',
    backgroundColor: 'rgba(26,110,189,0.05)',
    borderLeft: `3px solid ${C.electrico}`,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    minWidth: 0,
  },
  cardHeader: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  tipoLabel: {
    fontFamily: 'Arial',
    fontWeight: 700,
    fontSize: 10,
    letterSpacing: 2,
    color: '#888',
  },
  nombrePuerto: {
    fontFamily: 'Arial',
    fontWeight: 700,
    fontSize: 14,
    color: C.marino,
    overflowWrap: 'break-word',
  },
  sinDatos: {
    fontFamily: 'Arial',
    fontSize: 12,
    color: '#999',
    lineHeight: 1.4,
  },
  alturaRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  alturaLabel: {
    fontFamily: 'Arial',
    fontWeight: 600,
    fontSize: 10,
    letterSpacing: 0.5,
    color: '#888',
    textTransform: 'uppercase',
  },
  alturaValue: {
    fontFamily: 'Arial',
    fontWeight: 700,
    fontSize: 16,
    color: C.marino,
  },
  extremoRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
  },
  extremoLabel: {
    fontFamily: 'Arial',
    fontSize: 11,
    color: '#888',
  },
  extremoValue: {
    fontFamily: 'Arial',
    fontWeight: 600,
    fontSize: 13,
    color: C.marino,
  },
  estacionBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    paddingTop: 4,
    borderTop: '1px solid rgba(0,0,0,0.06)',
  },
  estacionTexto: {
    fontFamily: 'Arial',
    fontSize: 10,
    color: '#999',
    lineHeight: 1.4,
  },
  repunteTexto: {
    fontFamily: 'Arial',
    fontSize: 11,
    lineHeight: 1.4,
    margin: 0,
    fontWeight: 600,
  },
  aviso: {
    fontFamily: 'Arial',
    fontSize: 11,
    color: '#aaa',
    margin: 0,
    lineHeight: 1.4,
    borderTop: '1px solid #eee',
    paddingTop: 8,
  },
};
