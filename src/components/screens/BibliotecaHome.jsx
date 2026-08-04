import React, { useState } from 'react';

const MODULOS = [
  { emoji: '🆘', titulo: 'Emergencias a Bordo',     desc: 'Hombre al agua, incendio, varadura',    id: 'emergencias_01' },
  { emoji: '☑️', titulo: 'Equipamiento Obligatorio', desc: 'Checklist pre-zarpe por categoría',    id: 'equipamiento_01' },
  { emoji: '📻', titulo: 'Radio VHF',                desc: 'MAYDAY, PAN-PAN, SÉCURITÉ',           id: 'radio_vhf_01' },
  { emoji: '🏥', titulo: 'Primeros Auxilios',        desc: 'Hipotermia, traumas, anzuelos',        id: 'paux_01' },
  { emoji: '⚖️', titulo: 'Reglamentos',              desc: 'Normativa según tu licencia',          id: 'reglamentos_01' },
  { emoji: '🔴', titulo: 'Balizamiento IALA B',      desc: 'Marcas laterales, especiales',         id: 'balizamiento_01' },
  { emoji: '⛵', titulo: 'RIPA — Reglas de Paso',    desc: 'Cruces, jerarquía, canales',           id: 'ripa_01' },
  { emoji: '⚓', titulo: 'Maniobras Náuticas',       desc: 'Fondeo, pesca, vela',                 id: 'maniobras_01' },
];

export default function BibliotecaHome({ onSelectModulo, onBack }) {
  const [busqueda, setBusqueda] = useState('');

  const filtrados = MODULOS.filter(m =>
    m.titulo.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        {onBack && (
          <button onClick={onBack} style={styles.btnVolver}>← Volver</button>
        )}
        <h1 style={styles.titulo}>📚 Biblioteca Náutica</h1>
        <p style={styles.subtitulo}>Guías y protocolos para tu actividad — disponibles offline</p>
      </header>

      <div style={styles.searchWrapper}>
        <input
          type="search"
          placeholder="Buscar módulo..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          style={styles.searchInput}
        />
      </div>

      <div style={styles.grid}>
        {filtrados.map(m => (
          <button
            key={m.id}
            onClick={() => onSelectModulo(m.id)}
            style={styles.card}
          >
            <span style={styles.cardEmoji}>{m.emoji}</span>
            <span style={styles.cardTitulo}>{m.titulo}</span>
            <span style={styles.cardDesc}>{m.desc}</span>
          </button>
        ))}

        {filtrados.length === 0 && (
          <p style={styles.sinResultados}>Sin resultados para "{busqueda}"</p>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: 640,
    margin: '0 auto',
    padding: '70px 16px 48px',
    fontFamily: 'system-ui, sans-serif',
  },
  header: {
    marginBottom: 20,
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
    margin: '0 0 4px',
    fontSize: 24,
    fontWeight: 700,
    color: '#042C53',
  },
  subtitulo: {
    margin: 0,
    color: '#555',
    fontSize: 13,
  },
  searchWrapper: {
    marginBottom: 20,
  },
  searchInput: {
    width: '100%',
    padding: '11px 14px',
    border: '1px solid #d0d0d0',
    borderRadius: 10,
    fontSize: 15,
    boxSizing: 'border-box',
    outline: 'none',
    color: '#042C53',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 12,
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 6,
    padding: '16px 14px',
    background: '#fff',
    border: '1px solid #d8e4f0',
    borderRadius: 12,
    cursor: 'pointer',
    textAlign: 'left',
    minHeight: 100,
    boxShadow: '0 1px 4px rgba(4,44,83,0.06)',
    transition: 'box-shadow 0.15s, border-color 0.15s',
  },
  cardEmoji: {
    fontSize: 28,
    lineHeight: 1,
  },
  cardTitulo: {
    fontSize: 14,
    fontWeight: 700,
    color: '#042C53',
    lineHeight: 1.3,
  },
  cardDesc: {
    fontSize: 12,
    color: '#666',
    lineHeight: 1.4,
  },
  sinResultados: {
    gridColumn: '1 / -1',
    textAlign: 'center',
    color: '#999',
    fontSize: 14,
    padding: '32px 0',
  },
};
