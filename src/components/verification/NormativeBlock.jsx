// src/components/verification/NormativeBlock.jsx
import React, { useState } from 'react';

const C = {
  marino:    '#0A2647',
  electrico: '#1A6EBD',
  turquesa:  '#5DCAA5',
  coral:     '#E8512A',
  naranja:   '#F57C00',
  ambar:     '#FFC107',
};

const NIVEL_CONFIG = {
  critico: {
    icon: '🚨',
    color: C.coral,
    bg: 'rgba(232,81,42,0.08)',
    border: C.coral,
    label: 'CRÍTICO',
  },
  bloqueante: {
    icon: '⛔',
    color: C.coral,
    bg: 'rgba(232,81,42,0.06)',
    border: C.coral,
    label: 'BLOQUEANTE',
  },
  obligatorio: {
    icon: '📋',
    color: C.electrico,
    bg: 'rgba(26,110,189,0.06)',
    border: C.electrico,
    label: 'OBLIGATORIO',
  },
  limite: {
    icon: '⚠️',
    color: C.ambar,
    bg: 'rgba(255,193,7,0.08)',
    border: C.ambar,
    label: 'LÍMITE DE LICENCIA',
  },
};

function ReminderCard({ reminder }) {
  const cfg = NIVEL_CONFIG[reminder.nivel] || NIVEL_CONFIG.obligatorio;

  return (
    <div
      style={{
        ...styles.card,
        backgroundColor: cfg.bg,
        borderLeft: `3px solid ${cfg.border}`,
      }}
    >
      <div style={styles.cardRow}>
        <span style={{ fontSize: 16 }}>{cfg.icon}</span>
        <div style={styles.cardContent}>
          <div style={styles.cardTop}>
            <span style={{ ...styles.nivelTag, color: cfg.color }}>{cfg.label}</span>
            {reminder.norma && (
              <span style={styles.normaTag}>{reminder.norma}</span>
            )}
          </div>
          <p style={styles.cardTexto}>{reminder.texto}</p>

          {/* Canal VHF o teléfono si existe */}
          {(reminder.canal || reminder.telefono) && (
            <div style={styles.contactoRow}>
              {reminder.canal && (
                <span style={styles.contactoPill}>📻 {reminder.canal}</span>
              )}
              {reminder.telefono && (
                <span style={styles.contactoPill}>📞 {reminder.telefono}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function NormativeBlock({ reminders, licenseType }) {
  const [expanded, setExpanded] = useState(false);

  if (!reminders || reminders.length === 0) return null;

  // Separar críticos/bloqueantes del resto
  const criticos = reminders.filter((r) => r.nivel === 'critico' || r.nivel === 'bloqueante');
  const resto = reminders.filter((r) => r.nivel !== 'critico' && r.nivel !== 'bloqueante');

  // Siempre mostrar críticos; el resto se expande
  const visibles = expanded ? reminders : criticos.concat(resto.slice(0, 2));
  const hayMas = reminders.length > visibles.length;

  return (
    <div style={styles.block}>
      <div style={styles.blockHeader}>
        <span style={styles.blockIcon}>📋</span>
        <div style={styles.blockTitleWrap}>
          <span style={styles.blockTitle}>Recordatorios normativos</span>
          {licenseType && (
            <span style={styles.licenseTag}>{formatLicense(licenseType)}</span>
          )}
        </div>
      </div>

      <div style={styles.cardsContainer}>
        {visibles.map((r) => (
          <ReminderCard key={r.id} reminder={r} />
        ))}
      </div>

      {/* Expandir / colapsar */}
      {(hayMas || expanded) && (
        <button
          style={styles.expandBtn}
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded
            ? '▲ Ver menos'
            : `▼ Ver ${reminders.length - visibles.length} recordatorio(s) más`}
        </button>
      )}

      <p style={styles.disclaimer}>
        El cumplimiento normativo es responsabilidad exclusiva del patrón. Tmarea recuerda, no autoriza.
      </p>
    </div>
  );
}

function formatLicense(licenseType) {
  const map = {
    patron_nave_menor:          'Patrón de Nave Menor',
    patron_deportivo_bahia:     'Patrón Deportivo de Bahía',
    capitan_deportivo_costero:  'Capitán Deportivo Costero',
    capitan_deportivo_alta_mar: 'Capitán Deportivo de Alta Mar',
    patron_nave_mayor:          'Patrón de Nave Mayor',
  };
  return map[licenseType] || licenseType;
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
    alignItems: 'flex-start',
    gap: 8,
  },
  blockIcon: { fontSize: 18, marginTop: 1 },
  blockTitleWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
  },
  blockTitle: {
    fontFamily: 'Arial',
    fontWeight: 700,
    fontSize: 15,
    color: C.marino,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  licenseTag: {
    fontFamily: 'Arial',
    fontSize: 11,
    color: C.electrico,
    fontWeight: 600,
    backgroundColor: 'rgba(26,110,189,0.08)',
    borderRadius: 4,
    padding: '2px 6px',
    alignSelf: 'flex-start',
  },
  cardsContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  card: {
    borderRadius: 10,
    padding: '10px 12px',
  },
  cardRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
  },
  cardContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  cardTop: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  nivelTag: {
    fontFamily: 'Arial',
    fontWeight: 700,
    fontSize: 10,
    letterSpacing: 1,
  },
  normaTag: {
    fontFamily: 'Arial',
    fontSize: 10,
    color: '#bbb',
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    padding: '1px 5px',
  },
  cardTexto: {
    fontFamily: 'Arial',
    fontSize: 13,
    color: C.marino,
    margin: 0,
    lineHeight: 1.5,
  },
  contactoRow: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 2,
  },
  contactoPill: {
    fontFamily: 'Arial',
    fontSize: 12,
    color: C.marino,
    backgroundColor: 'rgba(10,38,71,0.06)',
    borderRadius: 6,
    padding: '3px 8px',
    fontWeight: 600,
  },
  expandBtn: {
    background: 'none',
    border: 'none',
    fontFamily: 'Arial',
    fontWeight: 600,
    fontSize: 12,
    color: C.electrico,
    cursor: 'pointer',
    padding: '2px 0',
    textAlign: 'left',
  },
  disclaimer: {
    fontFamily: 'Arial',
    fontSize: 11,
    color: '#aaa',
    margin: 0,
    lineHeight: 1.4,
    borderTop: '1px solid #eee',
    paddingTop: 8,
  },
};
