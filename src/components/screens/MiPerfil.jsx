import React, { useState, useEffect } from 'react';

const TIPOS_ACTIVIDAD = [
  { value: 'pesca_artesanal',      label: 'Pesca Artesanal' },
  { value: 'nave_menor_comercial', label: 'Patrón Nave Menor Comercial' },
  { value: 'deportivo_bahia',      label: 'Deportivo — Patrón de Bahía (PLDB/PDB)' },
  { value: 'capitan_costero',      label: 'Deportivo — Capitán Costero (CDC)' },
  { value: 'capitan_altamar',      label: 'Deportivo — Capitán Alta Mar (CDAM)' },
];

const STORAGE_KEY = 'tmarea_perfil_usuario';

const EMPTY = {
  nombre_completo: '',
  rut: '',
  tipo_actividad: '',
  telefono_emergencia: '',
};

function formatRut(raw) {
  const v = raw.replace(/[^0-9kK]/g, '');
  if (v.length === 0) return '';
  const ver  = v.slice(-1).toUpperCase();
  const body = v.slice(0, -1);
  if (body.length === 0) return ver;
  const parts = [];
  let rem = body;
  while (rem.length > 3) {
    parts.unshift(rem.slice(-3));
    rem = rem.slice(0, -3);
  }
  if (rem) parts.unshift(rem);
  return parts.join('.') + '-' + ver;
}

export default function MiPerfil({ onBack }) {
  const [form, setForm]       = useState(EMPTY);
  const [guardado, setGuardado] = useState(false);
  const [error, setError]     = useState('');

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try { setForm(JSON.parse(stored)); } catch {}
    }
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: name === 'rut' ? formatRut(value) : value,
    }));
    setGuardado(false);
    setError('');
  };

  const handleGuardar = () => {
    if (!form.nombre_completo.trim()) {
      setError('El nombre completo es requerido.');
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
    setGuardado(true);
  };

  return (
    <div style={estilos.container}>
      {/* Header — deja espacio al hamburger (top 12+40+8=60px) */}
      <header style={estilos.header}>
        {onBack && (
          <button onClick={onBack} style={estilos.btnVolver}>← Volver</button>
        )}
        <h1 style={estilos.titulo}>👤 Mi Perfil</h1>
        <p style={estilos.subtitulo}>Datos del patrón — guardados localmente en tu dispositivo</p>
      </header>

      {error    && <div style={estilos.errorBanner}>⚠ {error}</div>}
      {guardado && !error && <div style={estilos.successBanner}>✓ Perfil guardado correctamente.</div>}

      <div style={estilos.formGroup}>
        <label style={estilos.label}>Nombre completo</label>
        <input
          name="nombre_completo"
          value={form.nombre_completo}
          onChange={handleChange}
          placeholder="Ej: Juan Andrés Muñoz"
          style={estilos.input}
        />
      </div>

      <div style={estilos.formGroup}>
        <label style={estilos.label}>RUT</label>
        <input
          name="rut"
          value={form.rut}
          onChange={handleChange}
          placeholder="Ej: 12.345.678-9"
          style={estilos.input}
          maxLength={12}
          inputMode="numeric"
        />
      </div>

      <div style={estilos.formGroup}>
        <label style={estilos.label}>Tipo de actividad</label>
        <select
          name="tipo_actividad"
          value={form.tipo_actividad}
          onChange={handleChange}
          style={estilos.select}
        >
          <option value="">Seleccionar...</option>
          {TIPOS_ACTIVIDAD.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <p style={estilos.hint}>
          La Biblioteca Náutica usará este campo para filtrar contenido relevante a tu tipo de licencia.
        </p>
      </div>

      <div style={estilos.formGroup}>
        <label style={estilos.label}>Teléfono de emergencia</label>
        <input
          name="telefono_emergencia"
          type="tel"
          value={form.telefono_emergencia}
          onChange={handleChange}
          placeholder="Ej: +56 9 1234 5678"
          style={estilos.input}
        />
      </div>

      <div style={estilos.acciones}>
        <button onClick={handleGuardar} style={estilos.btnPrimario}>
          Guardar Perfil
        </button>
      </div>
    </div>
  );
}

const estilos = {
  container: {
    maxWidth: 560,
    margin: '0 auto',
    padding: '70px 20px 48px',
    fontFamily: 'system-ui, sans-serif',
  },
  header: {
    marginBottom: 28,
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
  },
  titulo: {
    margin: '0 0 4px',
    fontSize: 24,
    fontWeight: 700,
    color: '#0A2647',
  },
  subtitulo: {
    margin: 0,
    color: '#666',
    fontSize: 13,
  },
  errorBanner: {
    background: '#fdecea',
    border: '1px solid #f44336',
    borderRadius: 8,
    padding: '12px 16px',
    marginBottom: 20,
    color: '#c62828',
    fontSize: 14,
  },
  successBanner: {
    background: '#e8f5e9',
    border: '1px solid #4caf50',
    borderRadius: 8,
    padding: '12px 16px',
    marginBottom: 20,
    color: '#2e7d32',
    fontSize: 14,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    display: 'block',
    fontWeight: 600,
    marginBottom: 6,
    fontSize: 14,
    color: '#333',
  },
  input: {
    width: '100%',
    padding: '11px 14px',
    border: '1px solid #d0d0d0',
    borderRadius: 8,
    boxSizing: 'border-box',
    fontSize: 15,
    outline: 'none',
  },
  select: {
    width: '100%',
    padding: '11px 14px',
    border: '1px solid #d0d0d0',
    borderRadius: 8,
    boxSizing: 'border-box',
    fontSize: 15,
    background: 'white',
    outline: 'none',
  },
  hint: {
    margin: '4px 0 0',
    fontSize: 12,
    color: '#777',
  },
  acciones: {
    marginTop: 32,
  },
  btnPrimario: {
    width: '100%',
    padding: '13px 20px',
    background: '#0A2647',
    color: 'white',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 16,
    fontWeight: 700,
  },
};
