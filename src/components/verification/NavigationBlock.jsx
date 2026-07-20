// src/components/verification/NavigationBlock.jsx
import React from 'react';

const C = {
  marino:    '#0A2647',
  electrico: '#1A6EBD',
  turquesa:  '#5DCAA5',
  coral:     '#E8512A',
  naranja:   '#F57C00',
  ambar:     '#FFC107',
};

function StatRow({ label, value, sub, alerta }) {
  return (
    <div style={styles.statRow}>
      <span style={styles.statLabel}>{label}</span>
      <div style={styles.statRight}>
        <span style={{ ...styles.statValue, color: alerta ? C.coral : C.marino }}>
          {value ?? '—'}
        </span>
        {sub && <span style={styles.statSub}>{sub}</span>}
      </div>
    </div>
  );
}

export default function NavigationBlock({ navigation, voyageData }) {
  if (!navigation) return null;

  const combustible_disponible =
    voyageData?.combustible_disponible ||
    navigation?.combustible_disponible_litros ||
    null;

  const consumo = navigation?.consumo_total_litros;
  const autonomia_ok = navigation?.autonomia_ok;

  // Porcentaje de combustible usado
  const pctCombustible =
    combustible_disponible && consumo
      ? Math.min(100, Math.round((consumo / combustible_disponible) * 100))
      : null;

  // Formatear ETA
  const etaLlegada = navigation?.eta_llegada_iso
    ? new Date(navigation.eta_llegada_iso).toLocaleString('es-CL', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  const etaHoras = navigation?.eta_horas
    ? `${Math.floor(navigation.eta_horas)}h ${Math.round((navigation.eta_horas % 1) * 60)}m`
    : null;

  return (
    <div style={styles.block}>
      <div style={styles.blockHeader}>
        <span style={styles.blockIcon}>⏱️</span>
        <span style={styles.blockTitle}>ETA y combustible</span>
      </div>

      {navigation.error && (
        <p style={{ fontFamily: 'Arial', fontSize: 13, color: C.ambar, margin: 0 }}>
          ⚠ No se pudo calcular ETA. Verificar parámetros de la embarcación.
        </p>
      )}

      {!navigation.error && (
        <>
          {/* Métricas principales */}
          <div style={styles.statsContainer}>
            <StatRow
              label="Distancia total"
              value={navigation.distancia_total_mn ? `${navigation.distancia_total_mn.toFixed(1)} mn` : null}
            />
            <StatRow
              label="Duración estimada"
              value={etaHoras}
            />
            <StatRow
              label="Llegada estimada"
              value={etaLlegada}
            />
            <StatRow
              label="Velocidad sobre el fondo"
              value={navigation.SOG_promedio ? `${navigation.SOG_promedio.toFixed(1)} kn` : null}
              sub="Promedio considerando corrientes"
            />
          </div>

          {/* Barra de combustible */}
          <div style={styles.combustibleSection}>
            <div style={styles.combustibleHeader}>
              <span style={styles.statLabel}>Combustible</span>
              <span
                style={{
                  ...styles.autonomiaTag,
                  backgroundColor: autonomia_ok ? 'rgba(93,202,165,0.15)' : 'rgba(232,81,42,0.15)',
                  color: autonomia_ok ? C.turquesa : C.coral,
                }}
              >
                {autonomia_ok === null ? '—' : autonomia_ok ? '✓ Autonomía suficiente' : '✗ Autonomía insuficiente'}
              </span>
            </div>

            {/* Barra de progreso */}
            {pctCombustible !== null && (
              <div style={styles.barContainer}>
                <div
                  style={{
                    ...styles.barFill,
                    width: `${pctCombustible}%`,
                    backgroundColor: pctCombustible > 80 ? C.coral : pctCombustible > 60 ? C.ambar : C.turquesa,
                  }}
                />
              </div>
            )}

            <div style={styles.combustibleDetalle}>
              <span style={styles.statSub}>
                Consumo estimado: {consumo ? `${Math.round(consumo)} L` : '—'}
              </span>
              <span style={styles.statSub}>
                Disponible: {combustible_disponible ? `${combustible_disponible} L` : '—'}
              </span>
            </div>

            {!autonomia_ok && (
              <p style={styles.alertaAutonomia}>
                ⚠ El combustible disponible no cubre la ruta completa. Verificar con el armador antes de zarpar.
              </p>
            )}
          </div>
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
  statsContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
    borderRadius: 10,
    overflow: 'hidden',
    border: '1px solid #eee',
  },
  statRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '11px 14px',
    borderBottom: '1px solid #f0f0f0',
    backgroundColor: '#fafafa',
  },
  statLabel: {
    fontFamily: 'Arial',
    fontSize: 13,
    color: '#666',
    fontWeight: 400,
  },
  statRight: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 1,
  },
  statValue: {
    fontFamily: 'Arial',
    fontWeight: 700,
    fontSize: 15,
  },
  statSub: {
    fontFamily: 'Arial',
    fontSize: 10,
    color: '#aaa',
  },
  combustibleSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: '12px 14px',
    backgroundColor: '#fafafa',
    borderRadius: 10,
    border: '1px solid #eee',
  },
  combustibleHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  autonomiaTag: {
    fontFamily: 'Arial',
    fontWeight: 600,
    fontSize: 11,
    borderRadius: 6,
    padding: '3px 8px',
    letterSpacing: 0.2,
  },
  barContainer: {
    height: 8,
    backgroundColor: '#e8e8e8',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
    transition: 'width 0.5s ease',
  },
  combustibleDetalle: {
    display: 'flex',
    justifyContent: 'space-between',
  },
  alertaAutonomia: {
    fontFamily: 'Arial',
    fontSize: 12,
    color: C.coral,
    margin: 0,
    lineHeight: 1.4,
    padding: '8px 0 0',
    borderTop: '1px solid rgba(232,81,42,0.2)',
  },
};
