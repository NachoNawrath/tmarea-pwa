import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const VESSEL_TYPES = [
  { value: 'lancha', label: 'Lancha' },
  { value: 'barcaza', label: 'Barcaza' },
  { value: 'remolcador', label: 'Remolcador' },
  { value: 'pesquero', label: 'Pesquero' },
  { value: 'workboat', label: 'Workboat / Nave de apoyo' },
  { value: 'otro', label: 'Otro' },
];

const EMPTY_FORM = {
  nombre: '',
  matricula: '',
  tipo: '',
  eslora: '',
  manga: '',
  trg: '',
  velocidad_crucero: '',
  consumo_nominal: '',
};

const estilos = {
  container: { maxWidth: '620px', margin: '0 auto', padding: '24px 20px', fontFamily: 'system-ui, sans-serif' },
  header: { marginBottom: '28px' },
  titulo: { margin: '0 0 4px', fontSize: '24px', fontWeight: '700', color: '#1a1a2e' },
  subtitulo: { margin: 0, color: '#555', fontSize: '14px' },
  label: { display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '14px', color: '#333' },
  input: { width: '100%', padding: '11px 14px', border: '1px solid #d0d0d0', borderRadius: '8px', boxSizing: 'border-box', fontSize: '15px', outline: 'none' },
  select: { width: '100%', padding: '11px 14px', border: '1px solid #d0d0d0', borderRadius: '8px', boxSizing: 'border-box', fontSize: '15px', background: 'white', outline: 'none' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' },
  seccion: { marginBottom: '20px' },
  errorField: { color: '#c62828', fontSize: '12px', marginTop: '4px' },
  errorBanner: { background: '#fdecea', border: '1px solid #f44336', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', color: '#c62828', fontSize: '14px' },
  successBanner: { background: '#e8f5e9', border: '1px solid #4caf50', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', color: '#2e7d32', fontSize: '14px' },
  acciones: { display: 'flex', gap: '12px', marginTop: '32px' },
  btnSecundario: { padding: '12px 20px', background: '#f5f5f5', border: '1px solid #ccc', borderRadius: '8px', cursor: 'pointer', fontSize: '15px', fontWeight: '500' },
  btnPrimario: { flex: 1, padding: '13px 20px', background: '#0052a3', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: '700' },
  hint: { fontSize: '12px', color: '#777', marginTop: '4px' },
  resumen: { background: '#f0f7ff', border: '1px solid #bbdefb', borderRadius: '8px', padding: '14px 16px', marginTop: '20px', fontSize: '13px', color: '#1565c0' },
};

function campoNumerico(valor, min, max, label) {
  if (!valor || valor === '') return `${label} es requerido`;
  if (isNaN(valor)) return `${label} debe ser un número`;
  if (Number(valor) <= 0) return `${label} debe ser mayor a 0`;
  if (min !== undefined && Number(valor) < min) return `${label} mínimo: ${min}`;
  if (max !== undefined && Number(valor) > max) return `${label} máximo: ${max}`;
  return null;
}

export default function P1_VesselProfile() {
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY_FORM);
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState(null);
  const [guardado, setGuardado] = useState(false);
  const [tieneDatoPrevio, setTieneDatoPrevio] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('vessel_profile');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setForm(parsed);
        setGuardado(true);
        setTieneDatoPrevio(true);
      } catch {
        localStorage.removeItem('vessel_profile');
      }
    }
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    setErrores(prev => ({ ...prev, [name]: null }));
    setGuardado(false);
    setErrorGeneral(null);
  };

  const validate = () => {
    const errs = {};
    if (!form.tipo) errs.tipo = 'Selecciona el tipo de embarcación';
    const eslora = campoNumerico(form.eslora, 1, 200, 'Eslora');
    if (eslora) errs.eslora = eslora;
    const manga = campoNumerico(form.manga, 0.5, 50, 'Manga');
    if (manga) errs.manga = manga;
    if (form.eslora && form.manga && Number(form.manga) > Number(form.eslora)) {
      errs.manga = 'La manga no puede ser mayor que la eslora';
    }
    const trg = campoNumerico(form.trg, 0.1, 100000, 'TRG');
    if (trg) errs.trg = trg;
    const vel = campoNumerico(form.velocidad_crucero, 1, 80, 'Velocidad crucero');
    if (vel) errs.velocidad_crucero = vel;
    const cons = campoNumerico(form.consumo_nominal, 0.1, 10000, 'Consumo nominal');
    if (cons) errs.consumo_nominal = cons;
    return errs;
  };

  const handleGuardar = () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrores(errs);
      setErrorGeneral('Corrige los campos marcados antes de guardar.');
      return;
    }
    try {
      localStorage.setItem('vessel_profile', JSON.stringify(form));
      setGuardado(true);
      setErrorGeneral(null);
      setErrores({});
    } catch {
      setErrorGeneral('Error al guardar. Verifica el espacio disponible en tu dispositivo.');
    }
  };

  const handleContinuar = () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrores(errs);
      setErrorGeneral('Completa todos los campos requeridos antes de continuar.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    try {
      localStorage.setItem('vessel_profile', JSON.stringify(form));
    } catch {
      setErrorGeneral('Error al guardar los datos. Intenta nuevamente.');
      return;
    }
    navigate('/voyage-setup');
  };

  const handleLimpiar = () => {
    if (!window.confirm('¿Seguro que quieres limpiar los datos de la nave?')) return;
    setForm(EMPTY_FORM);
    setErrores({});
    setGuardado(false);
    setTieneDatoPrevio(false);
    localStorage.removeItem('vessel_profile');
  };

  const autonomiaEstimada = form.velocidad_crucero && form.consumo_nominal &&
    !isNaN(form.velocidad_crucero) && !isNaN(form.consumo_nominal)
    ? Math.round((1000 / Number(form.consumo_nominal)) * Number(form.velocidad_crucero))
    : null;

  return (
    <div style={estilos.container}>
      <header style={estilos.header}>
        <h1 style={estilos.titulo}>Perfil de la Nave</h1>
        <p style={estilos.subtitulo}>
          {tieneDatoPrevio
            ? 'Revisa o actualiza los datos antes de iniciar el viaje.'
            : 'Configura los datos de la embarcación que operarás.'}
        </p>
      </header>

      {errorGeneral && <div style={estilos.errorBanner}>⚠ {errorGeneral}</div>}
      {guardado && !errorGeneral && <div style={estilos.successBanner}>✓ Datos guardados correctamente.</div>}

      {/* Datos opcionales */}
      <div style={estilos.grid2}>
        <div>
          <label style={estilos.label}>Nombre de la nave</label>
          <input name="nombre" value={form.nombre} onChange={handleChange}
            placeholder="Ej: Don Pancho" style={estilos.input} />
        </div>
        <div>
          <label style={estilos.label}>Matrícula</label>
          <input name="matricula" value={form.matricula} onChange={handleChange}
            placeholder="Ej: TN-1234" style={estilos.input} />
        </div>
      </div>

      {/* Tipo */}
      <div style={estilos.seccion}>
        <label style={estilos.label}>Tipo de embarcación *</label>
        <select name="tipo" value={form.tipo} onChange={handleChange}
          style={{ ...estilos.select, borderColor: errores.tipo ? '#f44336' : '#d0d0d0' }}>
          <option value="">Seleccionar...</option>
          {VESSEL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        {errores.tipo && <div style={estilos.errorField}>⚠ {errores.tipo}</div>}
      </div>

      {/* Dimensiones */}
      <div style={estilos.grid2}>
        <div>
          <label style={estilos.label}>Eslora (m) *</label>
          <input name="eslora" type="number" value={form.eslora} onChange={handleChange}
            placeholder="Ej: 18.5" min="1" step="0.1"
            style={{ ...estilos.input, borderColor: errores.eslora ? '#f44336' : '#d0d0d0' }} />
          {errores.eslora && <div style={estilos.errorField}>⚠ {errores.eslora}</div>}
        </div>
        <div>
          <label style={estilos.label}>Manga (m) *</label>
          <input name="manga" type="number" value={form.manga} onChange={handleChange}
            placeholder="Ej: 5.2" min="0.5" step="0.1"
            style={{ ...estilos.input, borderColor: errores.manga ? '#f44336' : '#d0d0d0' }} />
          {errores.manga && <div style={estilos.errorField}>⚠ {errores.manga}</div>}
        </div>
      </div>

      {/* TRG */}
      <div style={estilos.seccion}>
        <label style={estilos.label}>TRG — Tonelaje de Registro Grueso *</label>
        <input name="trg" type="number" value={form.trg} onChange={handleChange}
          placeholder="Ej: 45" min="0.1" step="0.1"
          style={{ ...estilos.input, borderColor: errores.trg ? '#f44336' : '#d0d0d0' }} />
        {errores.trg && <div style={estilos.errorField}>⚠ {errores.trg}</div>}
        <div style={estilos.hint}>El TRG define qué restricciones portuarias aplican a tu embarcación.</div>
      </div>

      {/* Operación */}
      <div style={estilos.grid2}>
        <div>
          <label style={estilos.label}>Velocidad crucero (nudos) *</label>
          <input name="velocidad_crucero" type="number" value={form.velocidad_crucero} onChange={handleChange}
            placeholder="Ej: 8" min="1" max="80" step="0.5"
            style={{ ...estilos.input, borderColor: errores.velocidad_crucero ? '#f44336' : '#d0d0d0' }} />
          {errores.velocidad_crucero && <div style={estilos.errorField}>⚠ {errores.velocidad_crucero}</div>}
        </div>
        <div>
          <label style={estilos.label}>Consumo nominal (L/hora) *</label>
          <input name="consumo_nominal" type="number" value={form.consumo_nominal} onChange={handleChange}
            placeholder="Ej: 25" min="0.1" step="0.1"
            style={{ ...estilos.input, borderColor: errores.consumo_nominal ? '#f44336' : '#d0d0d0' }} />
          {errores.consumo_nominal && <div style={estilos.errorField}>⚠ {errores.consumo_nominal}</div>}
        </div>
      </div>

      {/* Resumen calculado */}
      {autonomiaEstimada && (
        <div style={estilos.resumen}>
          🧮 Con estos datos, la autonomía estimada es de ~<strong>{autonomiaEstimada} millas náuticas</strong> por cada 1.000 litros de combustible.
        </div>
      )}

      {/* Acciones */}
      <div style={estilos.acciones}>
        {tieneDatoPrevio && (
          <button onClick={handleLimpiar}
            style={{ ...estilos.btnSecundario, color: '#c62828', borderColor: '#f44336' }}>
            Limpiar
          </button>
        )}
        <button onClick={handleGuardar} style={estilos.btnSecundario}>Guardar datos</button>
        <button onClick={handleContinuar} style={estilos.btnPrimario}>
          Continuar a configurar viaje →
        </button>
      </div>
    </div>
  );
}