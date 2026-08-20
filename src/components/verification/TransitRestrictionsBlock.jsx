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

  const esInformativa = r.aplica === false || estado === 'no_afecta';

  // Línea 3: mensaje de restricción según estado
  let mensajeColor, mensajeTexto;
  if (estado === 'bloquea') {
    mensajeColor = C.coral;
    // UN BARCO NAVEGA, NO TRANSITA. Decisión del owner, 2026-08-20, vista en
    // pantalla: «transitar» es vocabulario de tránsito terrestre y suena a auto.
    // SE CORRIGE EL VERBO, NO EL SUSTANTIVO. «tránsito» como nombre de la
    // categoría se queda —es la palabra de la norma: D.L. 2222 Art. 32 habla de
    // prohibir el TRÁNSITO por aguas jurisdiccionales— y por eso las tres
    // cadenas de abajo, y el título del bloque, no se tocan.
    // La app ya se contradecía sola: dos líneas más abajo, el motivo que emite
    // el BRE dice «tu embarcación (AB 10) no puede navegar». Medido en pantalla.
    mensajeTexto = '⛔ Tu embarcación NO puede navegar en esta zona';
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
    // Mismo verbo, misma decisión del owner. Este es el fallback: sólo sale
    // cuando el BRE no manda motivo, así que en pantalla se ve poco — y por eso
    // mismo se corrige ahora, que es cuando alguien lo está mirando.
    motivoTexto = ev.motivo || 'No afecta a tu embarcación, pero se recomienda precaución al navegar.';
    motivoColor = '#546e7a';
  } else if (ev.motivo) {
    motivoTexto = ev.motivo;
    motivoColor = estado === 'bloquea' ? C.coral : '#8a6d00';
  } else if (estado === 'sin_ab') {
    motivoTexto = '⚠️ Carga tu AB en el perfil para verificar si esta restricción te aplica';
  } else if (estado === 'indeterminado') {
    // LA BORDERLINE, resuelta por el owner el 2026-08-20: «tu tránsito» lleva
    // posesivo, y eso la pone del lado del VERBO —es lo que hace el patrón, no
    // el nombre de la categoría—. Pasa a «tu navegación». Las otras cadenas con
    // el sustantivo se quedan.
    motivoTexto = '⚠️ Confirma con la Capitanía si esta restricción afecta tu navegación';
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

  // Separar: bloqueantes/precaución primero, informativas después
  const aplican    = lista.filter(r => r.aplica !== false && (r.evaluacion?.estado || '') !== 'no_afecta');
  const informativas = lista.filter(r => r.aplica === false || (r.evaluacion?.estado || '') === 'no_afecta');
  const listaOrdenada = [...aplican, ...informativas];
  const nAplican = aplican.length;
  const nInfo    = informativas.length;

  let introTexto;
  if (nAplican > 0 && nInfo > 0) {
    introTexto = `La ruta cruza ${nAplican} zona(s) con restricciones que afectan tu embarcación y ${nInfo} zona(s) con restricciones activas que no te afectan.`;
  } else if (nAplican > 0) {
    introTexto = `La ruta cruza ${nAplican} jurisdicción(es) con Condición de Puerto activa que afecta tu embarcación.`;
  } else {
    introTexto = `La ruta pasa por ${nInfo} zona(s) con restricciones activas. Ninguna afecta tu embarcación, pero se recomienda precaución.`;
  }

  return (
    <div style={styles.block}>
      <div style={styles.blockHeader}>
        <span style={styles.blockIcon}>⚠️</span>
        {/*
          EL RÓTULO DE LA SECCIÓN — cambiado por el owner el 2026-08-20.
          «RESTRICCIONES EN TRÁNSITO» -> «RESTRICCIONES DURANTE LA NAVEGACIÓN».

          El agente había recomendado MANTENERLO, con dos argumentos, y los dos
          quedan escritos acá junto con su descarte porque no eran malos:
            (a) «tránsito» es la palabra de la norma — el D.L. 2222 Art. 32, que
                §10 del contrato cita, habla de prohibir el TRÁNSITO por aguas
                jurisdiccionales;
            (b) en español marítimo «tránsito de naves» significa TRÁFICO, y ése
                es el uso correcto del sustantivo.
          EL OWNER LOS DESCARTA, y el motivo es de producto: esto es el TÍTULO DE
          UNA SECCIÓN DE LA APP, no una cita normativa. El patrón que lo lee no
          está leyendo el decreto, y el rótulo tiene que decirle CUÁNDO aplican
          estas restricciones — que es exactamente lo que las separa del bloque
          de arriba.

          Y se descartó «Restricciones de puerto durante la navegación» POR
          PANTALLA: justo encima está «Condición de puertos», y repetir «puerto»
          acerca dos bloques que responden preguntas distintas.

          SÓLO EL RÓTULO. El nombre del componente, las claves de la API y
          `restricciones_intermedias` NO se tocan: renombrarlos es refactor.
        */}
        <span style={styles.blockTitle}>Restricciones durante la navegación</span>
      </div>

      <p style={styles.intro}>{introTexto}</p>

      {ultimoTramo && (
        <div style={styles.tramoSeguro}>
          📍 Puedes navegar hasta <strong>{ultimoTramo.bahia}</strong>. A partir de ahí, la zona está restringida.
        </div>
      )}

      <div style={styles.cardsContainer}>
        {aplican.map((r, i) => (
          <RestriccionCard key={`apl-${r.id_bahia}-${i}`} r={r} />
        ))}

        {nInfo > 0 && (
          <>
            {nAplican > 0 && <div style={styles.separadorInfo}>Restricciones activas — no afectan tu embarcación</div>}
            {informativas.map((r, i) => (
              <RestriccionCard key={`inf-${r.id_bahia}-${i}`} r={r} />
            ))}
          </>
        )}
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
  separadorInfo: {
    fontFamily: 'Arial',
    fontSize: 11,
    fontWeight: 600,
    color: '#90a4ae',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingTop: 4,
    borderTop: '1px solid rgba(144,164,174,0.3)',
    marginTop: 2,
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
