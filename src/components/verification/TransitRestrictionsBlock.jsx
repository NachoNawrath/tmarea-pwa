// src/components/verification/TransitRestrictionsBlock.jsx
//
// Restricciones SITPORT activas en las zonas INTERMEDIAS de la ruta (jurisdicción
// de Capitanías que el viaje cruza en tránsito, distintas del zarpe y la
// recalada, que ya cubre PortStatusBlock). La Condición de Puerto aplica a toda
// la jurisdicción, no solo a la recalada.
//
// Datos: transitRestrictions = { restricciones_intermedias: [...], total }
// (endpoint POST /api/sitport/restricciones-ruta). Solo se renderiza si total ≥ 1.

import React from 'react';
import { getCapitania } from '../../utils/capitanias.js';
import { evaluarRestriccionAB } from '../../utils/restricciones.js';

const C = {
  marino:    '#0A2647',
  electrico: '#1A6EBD',
  turquesa:  '#5DCAA5',
  coral:     '#E8512A',
  ambar:     '#FFC107',
  crema:     '#F1EFE8',
};

// Clasifica cada restricción en uno de los cuatro estados visuales según el
// cotejo de Arqueo Bruto con la nave.
//   no_afecta     → la nave supera el límite de AB (turquesa, informativo)
//   bloquea       → la nave está por debajo del límite (coral, sugiere fondeadero)
//   sin_ab        → hay límite de AB pero la nave no lo tiene cargado (ámbar)
//   indeterminado → la restricción no expresa un límite numérico de AB (ámbar)
function clasificar(restriccion, vessel) {
  const ab = evaluarRestriccionAB(restriccion, vessel);
  if (!ab) return { estado: 'indeterminado', ab: null };
  return { estado: ab.estado, ab };
}

const ESTADO_STYLE = {
  no_afecta:     { border: C.turquesa, bg: 'rgba(93,202,165,0.10)' },
  bloquea:       { border: C.coral,    bg: 'rgba(232,81,42,0.10)' },
  sin_ab:        { border: C.ambar,    bg: 'rgba(255,193,7,0.10)' },
  indeterminado: { border: C.ambar,    bg: 'rgba(255,193,7,0.10)' },
};

function TelefonoLinea({ lat, lng, gobernacion, telefono }) {
  // Part 4: los teléfonos salen de getCapitania() (jurisdicción por latitud).
  // Se cae al valor del backend solo si getCapitania no resuelve la coordenada.
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

function RestriccionCard({ r, vessel }) {
  const { estado, ab } = clasificar(r, vessel);
  const style = ESTADO_STYLE[estado] || ESTADO_STYLE.indeterminado;
  const abNave = ab?.limite != null ? vessel?.ab : null;

  // Encabezado según severidad.
  let header;
  if (estado === 'bloquea') {
    header = (
      <div style={styles.headerWrap}>
        <span style={{ ...styles.headerTitulo, color: C.coral }}>
          🔴 Restricción bloquea tu tránsito
        </span>
        {r.gobernacion && (
          <span style={styles.headerSub}>Gob. Marítima de {r.gobernacion}</span>
        )}
      </div>
    );
  } else if (estado === 'no_afecta') {
    header = (
      <span style={{ ...styles.headerTitulo, color: C.marino }}>
        ℹ Restricción en tránsito{r.gobernacion ? ` — Gob. de ${r.gobernacion}` : ''}
      </span>
    );
  } else {
    header = (
      <span style={{ ...styles.headerTitulo, color: C.marino }}>
        ⚠ Restricción en tránsito{r.gobernacion ? ` — Gob. de ${r.gobernacion}` : ''}
      </span>
    );
  }

  // Línea de estado del cotejo AB.
  let estadoLinea = null;
  if (estado === 'no_afecta') {
    estadoLinea = (
      <p style={{ ...styles.estadoLinea, color: C.turquesa }}>
        ✓ Tu embarcación (AB {abNave}) no está afectada
      </p>
    );
  } else if (estado === 'bloquea') {
    estadoLinea = (
      <p style={{ ...styles.estadoLinea, color: C.coral }}>
        ✗ Tu embarcación (AB {abNave}) no puede transitar
      </p>
    );
  } else if (estado === 'sin_ab') {
    estadoLinea = (
      <p style={{ ...styles.estadoLinea, color: '#8a6d00' }}>
        ⚠ Ingresa tu AB en el perfil para verificar si esta restricción te aplica
      </p>
    );
  } else {
    estadoLinea = (
      <p style={{ ...styles.estadoLinea, color: '#8a6d00' }}>
        ⚠ Confirma con la Capitanía si esta restricción afecta tu tránsito
      </p>
    );
  }

  return (
    <div style={{ ...styles.card, backgroundColor: style.bg, borderLeft: `3px solid ${style.border}` }}>
      {header}

      {r.condicion && (
        <span style={styles.condicion}>Condición de Puerto: {r.condicion}</span>
      )}

      {/* Texto oficial SITPORT de la restricción */}
      {r.observacion && <p style={styles.observacion}>“{r.observacion}”</p>}

      {estadoLinea}

      {/* Fondeadero previo — solo cuando la restricción bloquea a la nave */}
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

export default function TransitRestrictionsBlock({ transitRestrictions, vessel }) {
  const lista = transitRestrictions?.restricciones_intermedias || [];
  if (lista.length === 0) return null;

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

      <div style={styles.cardsContainer}>
        {lista.map((r, i) => (
          <RestriccionCard key={`${r.id_bahia}-${i}`} r={r} vessel={vessel} />
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
