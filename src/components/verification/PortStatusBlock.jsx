// src/components/verification/PortStatusBlock.jsx
import React, { useState } from 'react';
import { getCapitania } from '../../utils/capitanias.js';
import { etiquetaDeNivel } from '../../hooks/useVoyageVerification.js';
import { evaluarRestriccionAB } from '../../utils/restricciones.js';

const C = {
  marino:    '#0A2647',
  electrico: '#1A6EBD',
  turquesa:  '#5DCAA5',
  coral:     '#E8512A',
  naranja:   '#F57C00',
  ambar:     '#FFC107',
  crema:     '#F1EFE8',
};

const ESTADO_CONFIG = {
  verde: {
    color: C.turquesa,
    icon: '🟢',
    label: 'Abierto',
    bg: 'rgba(93,202,165,0.10)',
  },
  ambar: {
    color: C.ambar,
    icon: '🟡',
    label: 'Con restricciones',
    bg: 'rgba(255,193,7,0.10)',
  },
  rojo: {
    color: C.coral,
    icon: '🔴',
    label: 'Cerrado',
    bg: 'rgba(232,81,42,0.10)',
  },
};

/**
 * Evalúa si la restricción aplica al TRG de la embarcación.
 * Retorna { aplica: bool, mensaje: string }
 */
function evaluarRestriccionTRG(restriccion, vessel) {
  const trg_nave = vessel?.trg || vessel?.tonelaje_bruto || null;
  const trg_limite = restriccion?.trg_minimo || restriccion?.limite_trg || null;

  if (!trg_nave || !trg_limite) {
    // Sin datos de TRG — mostrar restricción genérica
    return {
      aplica: true,
      mensaje: restriccion.Observacion || restriccion.MotivoRestriccion || restriccion.descripcion || 'Restricción activa — verificar con Capitanía.',
    };
  }

  if (trg_nave >= trg_limite) {
    return {
      aplica: false,
      mensaje: `Puerto cerrado para naves < ${trg_limite} TRG. Tu embarcación (${trg_nave} TRG) puede navegar siguiendo las indicaciones.`,
    };
  } else {
    return {
      aplica: true,
      mensaje: `Puerto cerrado para naves < ${trg_limite} TRG. Tu embarcación (${trg_nave} TRG) NO puede navegar. Comunicar a jefe de operaciones.`,
    };
  }
}

function PuertoCard({ data, tipo, vessel }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = ESTADO_CONFIG[data?.estado] || ESTADO_CONFIG.ambar;

  const restricciones = data?.restricciones || [];
  const tieneRestricciones = restricciones.length > 0;

  // CONTACTO — INV-10.1. La prelación la resuelve el motor y llega resuelta en
  // `data.contacto`; acá NO se elige escalón, se rotula el que ya vino.
  //   nivel 'capitania'   -> "Capitanía de Puerto de X"
  //   nivel 'gobernacion' -> "Gobernación Marítima de X"
  //   nivel null          -> ESCALÓN 3: el campo NO SE MUESTRA, sin texto de
  //                          reemplazo y sin mensaje sustituto.
  //
  // Las DOS ausencias no son la misma. `contacto` ausente es que el backend no
  // lo mandó —anterior a `dc7d63e`, o sin respuesta—: recién ahí se cae a
  // getCapitania(lat,lng), que CONTRATO_MOTOR.md §5.1 declara que NO ES FUENTE y
  // que sólo vale como fallback. Ese fallback resuelve a nivel Gobernación y por
  // eso se rotula como Gobernación, nunca como Capitanía.
  const contacto = data?.contacto;
  let capitania = null;
  if (contacto) {
    const etiqueta = etiquetaDeNivel(contacto.nivel);
    // `telefono_atomico` lo decide el motor con el mismo criterio versionado que
    // usa el resto del frente de contacto. Sin ese veredicto no se arma el
    // enlace: INV-10.1 dice que un `tel:` roto es peor que ninguno.
    if (etiqueta && contacto.nombre) {
      capitania = { etiqueta, nombre: contacto.nombre, telefono: contacto.telefono, atomico: contacto.telefono_atomico === true };
    }
  } else {
    const fb = data?.ubicacion ? getCapitania(data.ubicacion.lat, data.ubicacion.lng) : null;
    if (fb?.nombre) capitania = { etiqueta: etiquetaDeNivel('gobernacion'), nombre: fb.nombre, telefono: fb.telefono || null, atomico: false };
  }

  return (
    <div style={{ ...styles.puertoCard, backgroundColor: cfg.bg, borderLeft: `3px solid ${cfg.color}` }}>
      {/* Fila principal */}
      <div style={styles.puertoRow}>
        <div style={styles.puertoInfo}>
          <span style={styles.puertoTipo}>{tipo}</span>
          <span style={styles.puertoNombre}>{data?.nombre || '—'}</span>
        </div>
        <div style={styles.estadoBadge}>
          <span style={{ fontSize: 18 }}>{cfg.icon}</span>
          <span style={{ ...styles.estadoLabel, color: cfg.color }}>{cfg.label}</span>
        </div>
      </div>

      {/* Contacto de la autoridad — INV-10.1. La ETIQUETA sale del dato, no de un
          literal del JSX: el nivel lo resolvió el motor. Teléfono clickeable
          (tel:) SÓLO si el motor lo declaró atómico; si no, va como texto.
          Sin nivel no hay fila: el escalón 3 se resuelve callando el campo. */}
      {capitania && (
        <div style={styles.capitaniaRow}>
          📞 {capitania.etiqueta} {capitania.nombre}
          {capitania.telefono && (
            <>
              {' — '}
              {capitania.atomico ? (
                <a
                  href={`tel:${capitania.telefono.replace(/\s+/g, '')}`}
                  style={styles.capitaniaTel}
                >
                  {capitania.telefono}
                </a>
              ) : (
                <span style={styles.capitaniaTel}>{capitania.telefono}</span>
              )}
            </>
          )}
        </div>
      )}

      {/* Timestamp */}
      {data?.timestamp && (
        <span style={styles.timestamp}>
          Actualizado: {new Date(data.timestamp).toLocaleTimeString('es-CL')}
          {data.dato_viejo && <span style={{ color: C.ambar }}> · ⚠ Dato desactualizado</span>}
        </span>
      )}
      {data?.error && (
        <span style={{ ...styles.timestamp, color: C.ambar }}>
          ⚠ No se pudo conectar con SITPORT
        </span>
      )}

      {/* Restricciones expandibles */}
      {tieneRestricciones && (
        <>
          <button
            style={styles.expandBtn}
            onClick={() => setExpanded((e) => !e)}
          >
            {expanded ? '▲ Ocultar restricciones' : `▼ Ver ${restricciones.length} restricción(es)`}
          </button>

          {expanded && (
            <div style={styles.restriccionesContainer}>
              {restricciones.map((r, i) => {
                const eval_trg = evaluarRestriccionTRG(r, vessel);
                const eval_ab = evaluarRestriccionAB(r, vessel);
                return (
                  <div
                    key={i}
                    style={{
                      ...styles.restriccionRow,
                      borderLeft: `2px solid ${eval_trg.aplica ? C.coral : C.ambar}`,
                    }}
                  >
                    <p style={styles.restriccionTexto}>{eval_trg.mensaje}</p>
                    {/* Cotejo de Arqueo Bruto (AB) — solo si la restricción
                        menciona un límite de AB. */}
                    {eval_ab && (
                      <p style={{ ...styles.restriccionAB, color: eval_ab.color }}>
                        {eval_ab.icono} {eval_ab.mensaje}
                      </p>
                    )}
                    {r.vigente_desde && (
                      <span style={styles.restriccionFecha}>
                        Desde: {r.vigente_desde}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Sin restricciones */}
      {!tieneRestricciones && data?.estado === 'verde' && (
        <span style={{ ...styles.timestamp, color: C.turquesa }}>
          Sin restricciones activas
        </span>
      )}
    </div>
  );
}

export default function PortStatusBlock({ portStatus, vessel }) {
  if (!portStatus) return null;

  return (
    <div style={styles.block}>
      {/* Header del bloque */}
      <div style={styles.blockHeader}>
        <span style={styles.blockIcon}>⚓</span>
        <span style={styles.blockTitle}>Condición de puertos</span>
      </div>

      {/* Cards de zarpe y recalada */}
      <div style={styles.cardsContainer}>
        <PuertoCard data={portStatus.zarpe}   tipo="ZARPE"   vessel={vessel} />
        <PuertoCard data={portStatus.recalada} tipo="RECALADA" vessel={vessel} />
      </div>

      {/* Aviso honestidad del dato */}
      <p style={styles.aviso}>
        El estado refleja la información disponible en SITPORT (Armada de Chile).
        Siempre verificar con la Capitanía antes de zarpar.
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
  blockIcon: {
    fontSize: 18,
  },
  blockTitle: {
    fontFamily: 'Arial',
    fontWeight: 700,
    fontSize: 15,
    color: C.marino,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardsContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  puertoCard: {
    borderRadius: 10,
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  puertoRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  puertoInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  puertoTipo: {
    fontFamily: 'Arial',
    fontWeight: 700,
    fontSize: 10,
    letterSpacing: 2,
    color: '#888',
  },
  puertoNombre: {
    fontFamily: 'Arial',
    fontWeight: 700,
    fontSize: 16,
    color: C.marino,
  },
  estadoBadge: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
  },
  estadoLabel: {
    fontFamily: 'Arial',
    fontWeight: 600,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  timestamp: {
    fontFamily: 'Arial',
    fontSize: 11,
    color: '#999',
  },
  capitaniaRow: {
    fontFamily: 'Arial',
    fontSize: 12,
    color: '#888',
    lineHeight: 1.4,
  },
  capitaniaTel: {
    color: C.electrico,
    fontWeight: 700,
    textDecoration: 'none',
    whiteSpace: 'nowrap',
  },
  restriccionAB: {
    fontFamily: 'Arial',
    fontSize: 12,
    fontWeight: 600,
    margin: '2px 0 0',
    lineHeight: 1.4,
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
  restriccionesContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    marginTop: 4,
  },
  restriccionRow: {
    paddingLeft: 10,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  restriccionTexto: {
    fontFamily: 'Arial',
    fontSize: 13,
    color: C.marino,
    margin: 0,
    lineHeight: 1.4,
  },
  restriccionFecha: {
    fontFamily: 'Arial',
    fontSize: 11,
    color: '#999',
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
