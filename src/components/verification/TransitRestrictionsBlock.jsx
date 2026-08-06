// src/components/verification/TransitRestrictionsBlock.jsx
//
// Restricciones SITPORT activas en las zonas INTERMEDIAS de la ruta.
// Usa la evaluación pre-calculada del backend (motor de reglas BRE) en lugar
// de parsear el texto de la restricción en el frontend.

import React from 'react';

const C = {
  marino:    '#0A2647',
  electrico: '#1A6EBD',
  turquesa:  '#5DCAA5',
  coral:     '#E8512A',
  ambar:     '#FFC107',
  crema:     '#F1EFE8',
};

const ESTADO_STYLE = {
  no_afecta:     { border: '#90a4ae', bg: 'rgba(144,164,174,0.08)' },
  bloquea:       { border: C.coral,   bg: 'rgba(232,81,42,0.10)' },
  sin_ab:        { border: C.ambar,   bg: 'rgba(255,193,7,0.10)' },
  precaucion:    { border: C.ambar,   bg: 'rgba(255,193,7,0.10)' },
  indeterminado: { border: C.ambar,   bg: 'rgba(255,193,7,0.10)' },
};

function RestriccionCard({ r }) {
  const ev = r.evaluacion || {};
  const estado = ev.estado || 'indeterminado';
  const style = ESTADO_STYLE[estado] || ESTADO_STYLE.indeterminado;

  const esInformativa = r.aplica_a_mi_embarcacion === false || estado === 'no_afecta';

  // Línea 3: mensaje de restricción según estado
  let mensajeColor, mensajeTexto;
  if (estado === 'bloquea') {
    mensajeColor = C.coral;
    mensajeTexto = '⛔ Tu embarcación NO puede transitar';
  } else if (esInformativa) {
    mensajeColor = '#546e7a';
    mensajeTexto = '⚠ Restricción activa en zona de tránsito';
  } else {
    mensajeColor = C.marino;
    mensajeTexto = '⚠️ Restricción activa en tránsito';
  }

  // Línea 4: motivo del BRE o texto de estado fallback
  let motivoTexto = null;
  let motivoColor = '#8a6d00';
  if (esInformativa) {
    motivoTexto = ev.motivo || 'No afecta a tu embarcación, pero se recomienda precaución al transitar.';
    motivoColor = '#546e7a';
  } else if (ev.motivo) {
    motivoTexto = ev.motivo;
    motivoColor = estado === 'bloquea' ? C.coral : '#8a6d00';
  } else if (estado === 'sin_ab') {
    motivoTexto = '⚠️ Carga tu AB en el perfil para verificar si esta restricción te aplica';
  } else if (estado === 'indeterminado') {
    motivoTexto = '⚠️ Confirma con la Capitanía si esta restricción afecta tu tránsito';
  }

  // Teléfono: usar datos del backend directamente
  const nombreCap = r.capitania || r.gobernacion;
  const tel = r.telefono;

  return (
    <div style={{ ...styles.card, backgroundColor: style.bg, borderLeft: `3px solid ${style.border}` }}>

      {/* Línea 1 — nombre de la bahía (prominente) */}
      <span style={styles.nombreBahia}>{r.nombre_bahia || 'Bahía'}</span>

      {/* Línea 2 — capitanía + teléfono clickable */}
      {nombreCap && (
        <div style={styles.telRow}>
          📞 {nombreCap}
          {tel && (
            <>
              {' — '}
              <a href={`tel:${tel.replace(/\s+/g, '')}`} style={styles.telLink}>
                {tel}
              </a>
            </>
          )}
        </div>
      )}

      {/* Línea 3 — mensaje de restricción */}
      <span style={{ ...styles.mensajeRestriccion, color: mensajeColor }}>
        {mensajeTexto}
      </span>

      {/* Línea 4 — condición y motivo */}
      {r.condicion_legible && (
        <span style={styles.condicion}>Condición: {r.condicion_legible}</span>
      )}
      {motivoTexto && (
        <p style={{ ...styles.estadoLinea, color: motivoColor }}>
          {motivoTexto}
        </p>
      )}

      {r.observacion && <p style={styles.observacion}>"{r.observacion}"</p>}

      {estado === 'bloquea' && r.fondeadero_previo && (
        <div style={styles.fondeadero}>
          📍 Fondeadero previo: {r.fondeadero_previo.nombre}
          {r.fondeadero_previo.distancia_mn != null && ` (${r.fondeadero_previo.distancia_mn} mn)`}
          <span style={styles.fondeaderoSub}>Esperar condiciones favorables</span>
        </div>
      )}
    </div>
  );
}

export default function TransitRestrictionsBlock({ transitRestrictions }) {
  const lista = transitRestrictions?.restricciones_intermedias || [];
  if (lista.length === 0) return null;

  const ultimoTramo = transitRestrictions?.ultimo_tramo_seguro;
  const nAplican = lista.filter(r => r.aplica_a_mi_embarcacion !== false && (r.evaluacion?.estado || '') !== 'no_afecta').length;
  const nInfo    = lista.length - nAplican;

  let introTexto;
  if (nAplican > 0 && nInfo > 0) {
    introTexto = `La ruta cruza ${nAplican} zona(s) con restricciones que afectan tu embarcación y ${nInfo} informativa(s).`;
  } else if (nAplican > 0) {
    introTexto = `La ruta cruza ${nAplican} jurisdicción(es) con Condición de Puerto activa que afecta tu embarcación.`;
  } else {
    introTexto = `La ruta pasa por ${nInfo} zona(s) con restricciones activas. Ninguna afecta tu embarcación, pero se recomienda precaución.`;
  }

  return (
    <div style={styles.block}>
      <div style={styles.blockHeader}>
        <span style={styles.blockIcon}>⚠️</span>
        <span style={styles.blockTitle}>Restricciones en tránsito</span>
      </div>

      <p style={styles.intro}>{introTexto}</p>

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
  nombreBahia: {
    fontFamily: 'Arial',
    fontWeight: 700,
    fontSize: 17,
    color: C.marino,
    lineHeight: 1.2,
  },
  mensajeRestriccion: {
    fontFamily: 'Arial',
    fontWeight: 700,
    fontSize: 14,
    lineHeight: 1.3,
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
