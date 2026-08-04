import React from 'react';

export default function ConceptoClave({ concepto }) {
  return (
    <div style={styles.container}>
      <div style={styles.titulo}>💡 {concepto.titulo}</div>
      <p style={styles.explicacion}>{concepto.explicacion}</p>
    </div>
  );
}

const styles = {
  container: {
    background: '#F1EFE8',
    borderLeft: '3px solid #1A6EBD',
    borderRadius: '0 8px 8px 0',
    padding: '12px 14px',
    marginTop: 10,
  },
  titulo: {
    fontWeight: 700,
    fontSize: 14,
    color: '#042C53',
    marginBottom: 6,
  },
  explicacion: {
    margin: 0,
    fontSize: 14,
    color: '#333',
    lineHeight: 1.5,
  },
};
