// src/components/verification/TransitRestrictionsBlock.jsx
//
// Restricciones SITPORT activas en las zonas INTERMEDIAS de la ruta.
// Usa la evaluación pre-calculada del backend (motor de reglas BRE) en lugar
// de parsear el texto de la restricción en el frontend.

import React from 'react';
import { getCapitania } from '../../utils/capitanias.js';

const C = {
  marino:    '#0A2647',
  electrico: '#1A6EBD',
  turquesa:  '#5DCAA5',
  coral:     '#E8512A',
  ambar:     '#FFC107',
  crema:     '#F1EFE8',
};

const ESTADO_STYLE = {
  no_afecta:     { border: C.turquesa, bg: 'rgba(93,202,165,0.10)' },
  bloquea:       { border: C.coral,    bg: 'rgba(232,81,42,0.10)' },
  sin_ab:        { border: C.ambar,    bg: 'rgba(255,193,7,0.10)' },
  precaucion:    { border: C.ambar,    bg: 'rgba(255,193,7,0.10)' },
  indeterminado: { border: C.ambar,    bg: 'rgba(255,193,7,0.10)' },
};

function TelefonoLinea({ lat, lng, gobernacion, telefono }) {
  const cap = getCapitania(lat, lng);
  const nombre = cap?.nombre || gobernacion;
  const tel = cap?.telefono || telefono;
  if (!tel) return null;

  return (
    <div style={styles.telRow}>
      📞 Gob. Marítima de {nombre} —{' '}
      <a href={`tel:${tel.replace(/\s+/g, '')}`} style={styles.telLink}>
        {tel}
      </a>
    </div>
  );
}

function RestriccionCard({ r }) {
  const ev = r.evaluacion || {};
  const estado = ev.estado || 'indeterminado';
  const style = ESTADO_STYLE[estado] || ESTADO_STYLE.indeterminado;

  let header;
  if (estado === 'bloquea') {
    header = (
      <div style={styles.headerWrap}>
        <span style={{ ...styles.headerTitulo, color: C.coral }}>
          ⛔ Tu embarcación NO puede transitar por {r.nombre_bahia}
        </span>
        {r.gobernacion && (
          <span style={styles.headerSub}>Gob. Marítima de {r.gobernacion}</span>
        )}
      </div>
    );
  } else if (estado === 'no_afecta') {
    header = (
      <span style={{ ...styles.headerTitulo, color: C.marino }}>
        ✅ Tu embarcación no está afectada{r.gobernacion ? ` — Gob. de ${r.gobernacion}` : ''}
      </span>
    );
  } else {
    header = (
      <span style={{ ...styles.headerTitulo, color: C.marino }}>
        ⚠️ Restricción en tránsito{r.gobernacion ? ` — Gob. de ${r.gobernacion}` : ''}
      </span>
    );
  }

  let estadoLinea = null;
  if (ev.motivo) {
    const color =
      estado === 'no_afecta' ? C.turquesa :
      estado === 'bloquea' ? C.coral : '#8a6d00';
    estadoLinea = (
      <p style={{ ...styles.estadoLinea, color }}>
        {ev.motivo}
      </p>
    );
  } else if (estado === 'sin_ab') {
    estadoLinea = (
      <p style={{ ...styles.estadoLinea, color: '#8a6d00' }}>
        ⚠️ Carga tu AB en el perfil para verificar si esta restricción te aplica
      </p>
    );
  } else if (estado === 'indeterminado') {
    estadoLinea = (
      <p style={{ ...styles.estadoLinea, color: '#8a6d00' }}>
        ⚠️ Confirma con la Capitanía si esta restricción afecta tu tránsito
      </p>
    );
  }

  return (
    <div style={{ ...styles.card, backgroundColor: style.bg, borderLeft: `3px solid ${style.border}` }}>
      {header}

      {r.condicion_legible && (
        <span style={styles.condicion}>Condición de Puerto: {r.condicion_legible}</span>
      )}

      {r.observacion && <p style={styles.observacion}>"{r.observacion}"</p>}

      {estadoLinea}

      {estado === 'bloquea' && r.fondeadero_previo && (
        <div style={styles.fondeadero}>
          📍 Fondeadero previo: {r.fondeadero_previo.nombre}
          {r.fondeadero_previo.distancia_mn != null && ` (${r.fondeadero_previo.distancia_mn} mn)`}
          <span style={styles.fondeaderoSub}>Esperar condiciones favorables</span>
        </div>
      )}

      <TelefonoLinea
        lat={r.lat}
        lng={r.lng}
        gobernacion={r.gobernacion}
        telefono={r.telefono}
      />
    </div>
  );
}

export default function TransitRestrictionsBlock({ transitRestrictions }) {
  const lista = transitRestrictions?.restricciones_intermedias || [];
  if (lista.length === 0) return null;

  const ultimoTramo = transitRestrictions?.ultimo_tramo_seguro;

  return (
    <div style={styles.block}>
      <div style={styles.blockHeader}>
        <span style={styles.blockIcon}>⚠️</span>
        <span style={styles.blockTitle}>Restricciones en tránsito</span>
      </div>

      <p style={styles.intro}>
        La ruta cruza {lista.length} jurisdicción(es) con Condición de Puerto activa.
        Aplica al tránsito, no solo a la recalada.
      </p>

      {ultimoTramo && (
        <div style={styles.tramoSeguro}>
          📍 Puedes navegar hasta <strong>{ultimoTramo.bahia}</strong>. A partir de ahí, la zona está restringida.
        </div>
      )}

      <div style={styles.cardsContainer}>
        {lista.map((r, i) => (
          <RestriccionCard key={`${r.id_bahia}-${i}`} r={r} />
        ))}
      </div>
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
  intro: {
    fontFamily: 'Arial',
    fontSize: 12,
    color: '#888',
    margin: 0,
    lineHeight: 1.4,
  },
  tramoSeguro: {
    fontFamily: 'Arial',
    fontSize: 13,
    color: C.marino,
    backgroundColor: 'rgba(232,81,42,0.08)',
    borderRadius: 8,
    padding: '8px 12px',
    lineHeight: 1.4,
  },
  cardsContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  card: {
    borderRadius: 10,
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  headerWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  headerTitulo: {
    fontFamily: 'Arial',
    fontWeight: 700,
    fontSize: 14,
    lineHeight: 1.3,
  },
  headerSub: {
    fontFamily: 'Arial',
    fontWeight: 600,
    fontSize: 12,
    color: C.marino,
  },
  condicion: {
    fontFamily: 'Arial',
    fontSize: 11,
    fontWeight: 600,
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  observacion: {
    fontFamily: 'Arial',
    fontSize: 13,
    color: C.marino,
    margin: 0,
    lineHeight: 1.4,
    fontStyle: 'italic',
  },
  estadoLinea: {
    fontFamily: 'Arial',
    fontSize: 13,
    fontWeight: 600,
    margin: 0,
    lineHeight: 1.4,
  },
  fondeadero: {
    fontFamily: 'Arial',
    fontSize: 13,
    fontWeight: 600,
    color: C.marino,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 8,
    padding: '8px 10px',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  fondeaderoSub: {
    fontFamily: 'Arial',
    fontSize: 12,
    fontWeight: 400,
    color: '#777',
  },
  telRow: {
    fontFamily: 'Arial',
    fontSize: 12,
    color: '#888',
    lineHeight: 1.4,
  },
  telLink: {
    color: C.electrico,
    fontWeight: 700,
    textDecoration: 'none',
    whiteSpace: 'nowrap',
  },
};
