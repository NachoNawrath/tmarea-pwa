import React, { useState } from 'react';
import { useBiblioteca } from '../../hooks/useBiblioteca';
import ChecklistItem from '../biblioteca/ChecklistItem';
import ConceptoClave from '../biblioteca/ConceptoClave';

import emergencias_01 from '../../data/Biblioteca/emergencias_01.json';
import equipamiento_01 from '../../data/Biblioteca/equipamiento_01.json';
import radio_vhf_01 from '../../data/Biblioteca/radio_vhf_01.json';
import balizamiento_01 from '../../data/Biblioteca/balizamiento_01.json';
import ripa_01 from '../../data/Biblioteca/ripa_01.json';
import paux_01 from '../../data/Biblioteca/paux_01.json';
import maniobras_01 from '../../data/Biblioteca/maniobras_01.json';
import reglamentos_01 from '../../data/Biblioteca/reglamentos_01.json';

const MODULOS_MAP = {
  emergencias_01,
  equipamiento_01,
  radio_vhf_01,
  balizamiento_01,
  ripa_01,
  paux_01,
  maniobras_01,
  reglamentos_01,
};

// ─── Renderizadores de campo ─────────────────────────────────────────────────

function CampoLista({ items, style }) {
  return (
    <ol style={{ margin: '8px 0 0', paddingLeft: 20 }}>
      {items.map((it, i) => (
        <li key={i} style={{ fontSize: 14, color: '#333', lineHeight: 1.5, marginBottom: 4 }}>{it}</li>
      ))}
    </ol>
  );
}

function RendSeccion({ seccion }) {
  const {
    accion_inmediata, que_no_hacer, pasos, protocolo, puntos_clave,
    regla_practica, accion, jerarquia, radio_vhf, uso, ejemplo,
    detalles, caracteristicas, significado, maniobra_rescate,
    conceptos_clave,
  } = seccion;

  return (
    <div style={styles.seccionBody}>
      {accion_inmediata && (
        <div style={{ ...styles.bloque, background: '#E8F5E9' }}>
          <div style={styles.bloqueLabel}>Acción Inmediata</div>
          <CampoLista items={accion_inmediata} />
        </div>
      )}

      {maniobra_rescate && (
        <div style={{ ...styles.bloque, background: '#FFFDE7' }}>
          <div style={styles.bloqueLabel}>Maniobra de Rescate</div>
          <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
            {maniobra_rescate.map((it, i) => (
              <li key={i} style={{ fontSize: 14, color: '#333', lineHeight: 1.5, marginBottom: 4 }}>{it}</li>
            ))}
          </ul>
        </div>
      )}

      {que_no_hacer && (
        <div style={{ ...styles.bloque, background: '#FFEBEE' }}>
          <div style={styles.bloqueLabel}>⛔ Qué NO Hacer</div>
          <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
            {que_no_hacer.map((it, i) => (
              <li key={i} style={{ fontSize: 14, color: '#333', lineHeight: 1.5, marginBottom: 4 }}>{it}</li>
            ))}
          </ul>
        </div>
      )}

      {pasos && (
        <div style={styles.bloque}>
          <CampoLista items={pasos} />
        </div>
      )}

      {uso && (
        <p style={styles.textoNormal}>{uso}</p>
      )}

      {protocolo && (
        <div style={{ ...styles.bloque, background: '#FFEBEE' }}>
          <div style={styles.bloqueLabel}>Protocolo</div>
          <ol style={{ margin: '8px 0 0', paddingLeft: 20 }}>
            {protocolo.map((it, i) => (
              <li key={i} style={{ fontSize: 14, color: '#333', lineHeight: 1.6, marginBottom: 4, fontFamily: 'monospace' }}>{it}</li>
            ))}
          </ol>
        </div>
      )}

      {puntos_clave && (
        <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
          {puntos_clave.map((it, i) => (
            <li key={i} style={{ fontSize: 14, color: '#333', lineHeight: 1.5, marginBottom: 6 }}>{it}</li>
          ))}
        </ul>
      )}

      {regla_practica && (
        <p style={{ ...styles.textoNormal, fontWeight: 700 }}>{regla_practica}</p>
      )}

      {accion && (
        <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
          {accion.map((it, i) => (
            <li key={i} style={{ fontSize: 14, color: '#333', lineHeight: 1.5, marginBottom: 4 }}>{it}</li>
          ))}
        </ul>
      )}

      {jerarquia && (
        <div style={{ ...styles.bloque, background: '#E3F2FD' }}>
          <div style={styles.bloqueLabel}>Jerarquía</div>
          <ol style={{ margin: '8px 0 0', paddingLeft: 20 }}>
            {jerarquia.map((it, i) => (
              <li key={i} style={{ fontSize: 14, color: '#333', lineHeight: 1.5, marginBottom: 4 }}>{it}</li>
            ))}
          </ol>
        </div>
      )}

      {radio_vhf && (
        <div style={{ ...styles.bloque, background: '#FFCDD2', border: '1px solid #EF9A9A' }}>
          <div style={{ ...styles.bloqueLabel, color: '#B71C1C' }}>📻 Radio</div>
          <p style={{ margin: '6px 0 0', fontSize: 14, fontWeight: 600, color: '#B71C1C' }}>{radio_vhf}</p>
        </div>
      )}

      {ejemplo && (
        <div style={{ ...styles.bloque, background: '#F5F5F5' }}>
          <div style={styles.bloqueLabel}>Ejemplo</div>
          <blockquote style={{ margin: '6px 0 0', paddingLeft: 12, borderLeft: '3px solid #bbb', fontSize: 14, color: '#555', fontStyle: 'italic' }}>
            {ejemplo}
          </blockquote>
        </div>
      )}

      {detalles && (
        <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
          {detalles.map((it, i) => (
            <li key={i} style={{ fontSize: 14, color: '#333', lineHeight: 1.5, marginBottom: 4 }}>{it}</li>
          ))}
        </ul>
      )}

      {caracteristicas && (
        <p style={styles.textoNormal}>{caracteristicas}</p>
      )}

      {significado && (
        <p style={styles.textoNormal}>{significado}</p>
      )}

      {conceptos_clave && conceptos_clave.map((c, i) => (
        <ConceptoClave key={i} concepto={c} />
      ))}
    </div>
  );
}

// ─── Acordeón por sección ────────────────────────────────────────────────────

function Acordeon({ seccion }) {
  const [abierto, setAbierto] = useState(false);

  return (
    <div style={styles.acordeon}>
      <button
        onClick={() => setAbierto(p => !p)}
        style={styles.acordeonBtn}
        aria-expanded={abierto}
      >
        <span style={styles.acordeonTitulo}>{seccion.titulo}</span>
        <span style={styles.acordeonChevron}>{abierto ? '▲' : '▼'}</span>
      </button>
      {abierto && <RendSeccion seccion={seccion} />}
    </div>
  );
}

// ─── Vista equipamiento (checklist agrupado) ─────────────────────────────────

function EquipamientoView({ items }) {
  const grupos = items.reduce((acc, item) => {
    if (!acc[item.categoria]) acc[item.categoria] = [];
    acc[item.categoria].push(item);
    return acc;
  }, {});

  return (
    <div>
      {Object.entries(grupos).map(([cat, catItems]) => (
        <div key={cat} style={styles.categoriaBloque}>
          <div style={styles.categoriaTitulo}>{cat}</div>
          {catItems.map(item => (
            <ChecklistItem key={item.item_id} item={item} />
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── ModuloView principal ────────────────────────────────────────────────────

export default function ModuloView({ moduloId, onBack }) {
  const { filtrarPorPerfil } = useBiblioteca();
  const modulo = MODULOS_MAP[moduloId];

  if (!modulo) {
    return (
      <div style={styles.container}>
        <button onClick={onBack} style={styles.btnVolver}>← Volver</button>
        <p style={{ color: '#c62828', padding: 20 }}>Módulo no encontrado: {moduloId}</p>
      </div>
    );
  }

  const esChecklist = Array.isArray(modulo.items_checklist);

  const itemsFiltrados = esChecklist
    ? filtrarPorPerfil(modulo.items_checklist)
    : null;

  const seccionesFiltradas = !esChecklist
    ? filtrarPorPerfil(modulo.secciones)
    : null;

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <button onClick={onBack} style={styles.btnVolver}>← Volver</button>
        <h1 style={styles.titulo}>{modulo.titulo}</h1>
      </header>

      {esChecklist ? (
        <EquipamientoView items={itemsFiltrados} />
      ) : (
        <div>
          {seccionesFiltradas.length === 0 && (
            <p style={{ color: '#999', fontSize: 14, padding: '20px 0' }}>
              Sin contenido para tu perfil de actividad.
            </p>
          )}
          {seccionesFiltradas.map(s => (
            <Acordeon key={s.seccion_id} seccion={s} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Estilos ─────────────────────────────────────────────────────────────────

const styles = {
  container: {
    maxWidth: 640,
    margin: '0 auto',
    padding: '70px 16px 48px',
    fontFamily: 'system-ui, sans-serif',
  },
  header: {
    marginBottom: 24,
  },
  btnVolver: {
    background: 'none',
    border: 'none',
    color: '#1A6EBD',
    fontSize: 14,
    cursor: 'pointer',
    padding: '0 0 12px',
    fontWeight: 600,
    display: 'block',
    minHeight: 44,
  },
  titulo: {
    margin: 0,
    fontSize: 22,
    fontWeight: 700,
    color: '#042C53',
  },
  acordeon: {
    border: '1px solid #d8e4f0',
    borderRadius: 10,
    marginBottom: 10,
    overflow: 'hidden',
  },
  acordeonBtn: {
    width: '100%',
    minHeight: 52,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 16px',
    background: '#fff',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    boxSizing: 'border-box',
  },
  acordeonTitulo: {
    fontSize: 15,
    fontWeight: 600,
    color: '#042C53',
    flex: 1,
    paddingRight: 12,
  },
  acordeonChevron: {
    fontSize: 11,
    color: '#1A6EBD',
    flexShrink: 0,
  },
  seccionBody: {
    padding: '0 16px 16px',
    background: '#FAFBFD',
    borderTop: '1px solid #e8eef5',
  },
  bloque: {
    borderRadius: 8,
    padding: '10px 12px',
    marginTop: 10,
  },
  bloqueLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: '#042C53',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textoNormal: {
    margin: '8px 0 0',
    fontSize: 14,
    color: '#333',
    lineHeight: 1.5,
  },
  categoriaBloque: {
    marginBottom: 20,
  },
  categoriaTitulo: {
    fontSize: 13,
    fontWeight: 700,
    color: '#1A6EBD',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottom: '2px solid #1A6EBD',
  },
};
