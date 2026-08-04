import React, { useState, useEffect } from 'react';

export default function ChecklistItem({ item }) {
  const storageKey = `tmarea_checklist_${item.item_id}`;
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setChecked(localStorage.getItem(storageKey) === 'true');
  }, [storageKey]);

  const toggle = () => {
    const next = !checked;
    setChecked(next);
    localStorage.setItem(storageKey, String(next));
  };

  return (
    <button onClick={toggle} style={{ ...styles.item, ...(checked ? styles.itemChecked : {}) }}>
      <span style={{ ...styles.checkbox, ...(checked ? styles.checkboxChecked : {}) }}>
        {checked ? '✓' : ''}
      </span>
      <span style={styles.nombre}>{item.nombre}</span>
    </button>
  );
}

const styles = {
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    minHeight: 44,
    padding: '10px 14px',
    background: '#fff',
    border: '1px solid #e0e0e0',
    borderRadius: 8,
    cursor: 'pointer',
    textAlign: 'left',
    boxSizing: 'border-box',
    marginBottom: 8,
    transition: 'background 0.15s',
  },
  itemChecked: {
    background: '#F1F8F1',
    borderColor: '#81C784',
  },
  checkbox: {
    flexShrink: 0,
    width: 24,
    height: 24,
    borderRadius: 6,
    border: '2px solid #bbb',
    background: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    fontWeight: 700,
    color: '#2e7d32',
  },
  checkboxChecked: {
    background: '#4CAF50',
    borderColor: '#388E3C',
    color: '#fff',
  },
  nombre: {
    fontSize: 14,
    color: '#042C53',
    lineHeight: 1.4,
  },
};
