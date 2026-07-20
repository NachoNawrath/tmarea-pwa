// src/components/VoyageReportButton.jsx
// Botón de descarga del informe — se monta en P4 al cerrar el viaje
import React, { useState } from 'react';

const BACKEND_URL = 'http://localhost:3000';

const C = {
  marino:    '#0A2647',
  electrico: '#1A6EBD',
  turquesa:  '#5DCAA5',
  naranja:   '#F57C00',
  coral:     '#E8512A',
  crema:     '#F1EFE8',
};

/**
 * reportData = objeto completo del viaje ya cerrado
 * (VoyageSetup + datos reales ingresados por el patrón al llegar)
 */
export default function VoyageReportButton({ reportData }) {
  const [estado, setEstado] = useState('idle'); // idle | loading | error
  const [errorMsg, setErrorMsg] = useState(null);

  async function descargar(formato) {
    if (estado === 'loading') return;
    setEstado('loading');
    setErrorMsg(null);

    try {
      const res = await fetch(
        `${BACKEND_URL}/api/viaje/informe?formato=${formato}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(reportData),
          signal: AbortSignal.timeout(30000), // 30s para PDFs grandes
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detalle || `Error ${res.status}`);
      }

      // Descargar archivo
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `tmarea_viaje_${reportData?.puerto_zarpe?.nombre || 'informe'}_${new Date().toISOString().slice(0,10)}.${formato}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setEstado('idle');

    } catch (err) {
      setEstado('error');
      setErrorMsg(err.message || 'No se pudo generar el informe');
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.icon}>📄</span>
        <div>
          <div style={styles.titulo}>Informe de viaje</div>
          <div style={styles.subtitulo}>Descarga el registro operacional de esta navegación</div>
        </div>
      </div>

      {/* Nota sobre tramos excluidos */}
      {reportData?.tramos_registrados?.some(t => t.registrado === false) && (
        <div style={styles.nota}>
          ℹ️ Los tramos navegados de memoria fueron excluidos del informe.
        </div>
      )}

      {/* Botones de descarga */}
      <div style={styles.btnsRow}>
        <button
          style={{
            ...styles.btn,
            backgroundColor: estado === 'loading' ? '#ccc' : C.marino,
            cursor: estado === 'loading' ? 'not-allowed' : 'pointer',
          }}
          onClick={() => descargar('pdf')}
          disabled={estado === 'loading'}
        >
          {estado === 'loading' ? '⏳ Generando...' : '⬇ PDF'}
        </button>

        <button
          style={{
            ...styles.btn,
            backgroundColor: estado === 'loading' ? '#ccc' : C.electrico,
            cursor: estado === 'loading' ? 'not-allowed' : 'pointer',
          }}
          onClick={() => descargar('csv')}
          disabled={estado === 'loading'}
        >
          {estado === 'loading' ? '⏳ Generando...' : '⬇ Excel / CSV'}
        </button>
      </div>

      {/* Error */}
      {estado === 'error' && (
        <div style={styles.errorBox}>
          <span>⚠️ {errorMsg}</span>
          <button style={styles.retryBtn} onClick={() => setEstado('idle')}>
            Reintentar
          </button>
        </div>
      )}

      <p style={styles.disclaimer}>
        El informe incluye datos operacionales del viaje. No reemplaza documentación oficial de zarpe.
      </p>
    </div>
  );
}

const styles = {
  container: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
    fontFamily: 'Arial',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
  },
  icon: { fontSize: 22, marginTop: 1 },
  titulo: {
    fontWeight: 700,
    fontSize: 15,
    color: C.marino,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  subtitulo: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
    lineHeight: 1.4,
  },
  nota: {
    backgroundColor: 'rgba(26,110,189,0.07)',
    borderRadius: 8,
    padding: '8px 12px',
    fontSize: 12,
    color: C.electrico,
    lineHeight: 1.4,
  },
  btnsRow: {
    display: 'flex',
    gap: 10,
  },
  btn: {
    flex: 1,
    padding: '13px 0',
    border: 'none',
    borderRadius: 10,
    color: '#fff',
    fontFamily: 'Arial',
    fontWeight: 700,
    fontSize: 14,
    transition: 'opacity 0.2s',
  },
  errorBox: {
    backgroundColor: 'rgba(232,81,42,0.08)',
    borderRadius: 8,
    padding: '10px 12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: 13,
    color: C.coral,
  },
  retryBtn: {
    background: 'none',
    border: `1px solid ${C.coral}`,
    borderRadius: 6,
    color: C.coral,
    fontFamily: 'Arial',
    fontWeight: 600,
    fontSize: 12,
    padding: '4px 10px',
    cursor: 'pointer',
  },
  disclaimer: {
    fontSize: 11,
    color: '#aaa',
    margin: 0,
    lineHeight: 1.4,
    borderTop: '1px solid #eee',
    paddingTop: 8,
  },
};
