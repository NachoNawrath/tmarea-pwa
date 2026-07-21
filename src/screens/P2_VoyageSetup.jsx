import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
// react-router-dom eliminado
import caletasData from '../data/caletas_chile.json';
import maritimeData from '../data/maritime_data.json';                        // ← NUEVO
import { isSportLicense, validateLicenseRoute } from '../utils/license-rules.js'; // ← NUEVO
import { getNearestCapitania, isCircularRoute } from '../utils/maritime-geo.js';   // ← NUEVO
import { LicenseAlert, DepartureModal, SafetyChecklist } from '../components/DeportiveAlerts.jsx'; // ← NUEVO

const API_BASE = 'http://localhost:3000';
const DEBOUNCE_MS = 350;

// ─── Búsqueda local sobre caletas_chile.json ─────────────────────────────────
function buscarCaletasLocal(query, limit = 8) {
  if (!query || query.length < 2) return [];
  const q = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return caletasData
    .filter(c => {
      const nombre  = (c.nombre  || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const comuna  = (c.comuna  || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const region  = (c.region  || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return nombre.includes(q) || comuna.includes(q) || region.includes(q);
    })
    .slice(0, limit);
}

// ─── Búsqueda local sobre destinos_deportivos de maritime_data.json ──────────  ← NUEVO
function buscarDestinosDeportivos(query, limit = 6) {
  if (!query || query.length < 2) return [];
  const q = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return maritimeData.destinos_deportivos
    .filter(d => {
      const nombre = d.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return nombre.includes(q);
    })
    .slice(0, limit);
}

function useDebounce(fn, delay) {
  const timer = useRef(null);
  return useCallback((...args) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => fn(...args), delay);
  }, [fn, delay]);
}

// ─── Tipos de destino — comercial/artesanal (sin cambios) ────────────────────
const TIPOS_DESTINO = [
  { id: 'puerto',      label: 'Puerto o caleta',      emoji: '⚓' },
  { id: 'salmon',      label: 'Centro salmonero',      emoji: '🐟' },
  { id: 'mitilido',    label: 'Centro mitílidos',      emoji: '🦪' },
  { id: 'caladero',    label: 'Caladero / Zona pesca', emoji: '🎣' },
  { id: 'coordenadas', label: 'Coordenadas GPS',       emoji: '📌' },
];

// ─── Tipos de destino deportivo ──────────────────────────────────────────────  ← NUEVO
const TIPOS_DESTINO_DEPORTIVO = [
  { id: 'puerto',      label: 'Puerto / Caleta',       emoji: '⚓' },
  { id: 'marina',      label: 'Marina / Club Náutico', emoji: '⛵' },
  { id: 'fondeadero',  label: 'Fondeadero / Bahía',    emoji: '🏖️' },
  { id: 'circular',    label: 'Paseo Circular',        emoji: '🔄' },
  { id: 'coordenadas', label: 'Coordenadas GPS',       emoji: '📌' },
];

const TIPOS_CON_ESPECIE = ['caladero', 'coordenadas'];

const CONFIG_BUSQUEDA = {
  puerto: {
    placeholder: 'Ej: Puerto Montt, Quellón, Dalcahue...',
    helper: 'Busca por nombre del puerto o caleta',
    endpoint: (q) => `${API_BASE}/api/puertos?search=${encodeURIComponent(q)}&limit=8`,
    parseResponse: (data) => data.data || [],
    renderItem: (p) => ({
      linea1: p.nombre,
      linea2: `${p.provincia} · ${p.ubicacion?.lat?.toFixed(4)}°S, ${Math.abs(p.ubicacion?.lng ?? 0).toFixed(4)}°O`,
    }),
    labelSeleccionado: (p) => `${p.nombre} — ${p.provincia}`,
    queryInicial: (v) => v?.nombre || '',
  },
  salmon: {
    placeholder: 'Ej: Marine Harvest, Cermaq, Los Fiordos...',
    helper: 'Busca por nombre de empresa o ubicación geográfica del centro',
    endpoint: (q) => `${API_BASE}/api/centros?search=${encodeURIComponent(q)}&limit=10`,
    parseResponse: (data) => data.data || data.centros || [],
    renderItem: (c) => ({
      linea1: c.nombre,
      linea2: c.empresa,
      linea3: `${c.region || c.comuna} · ${c.lat?.toFixed(4) ?? ''}°S`,
    }),
    labelSeleccionado: (c) => `${c.nombre} — ${c.empresa}`,
    queryInicial: (v) => v ? `${v.nombre} — ${v.empresa}` : '',
  },
  mitilido: {
    placeholder: 'Ej: 100339, Low Oyarzun, Putemún, Quellón...',
    helper: 'Busca por código RNA/SERNAPESCA, apellido del titular o sector geográfico',
    endpoint: (q) => `${API_BASE}/api/mitilidos/search?q=${encodeURIComponent(q)}`,
    parseResponse: (data) => data.data || [],
    renderItem: (m) => ({
      linea1: m.codigo_centro ? `Código ${m.codigo_centro}` : m.ubicacion || 'Sin nombre',
      linea2: m.titular,
      linea3: `${m.comuna || m.region} · ${m.especies?.split(',')[0]?.trim() || ''}`,
    }),
    labelSeleccionado: (m) => `Cód. ${m.codigo_centro} — ${m.titular}`,
    queryInicial: (v) => v ? `Cód. ${v.codigo_centro} — ${v.titular}` : '',
  },
  caladero: {
    placeholder: 'Ej: Caramucho, Dalcahue, Carelmapu...',
    helper: 'Busca por nombre de caleta, sector o comuna — cobertura nacional',
    endpoint: null,
    parseResponse: () => [],
    renderItem: (c) => ({
      linea1: c.nombre,
      linea2: `${c.comuna} · ${c.region}`,
      linea3: c.latitud ? `${c.latitud}°S, ${Math.abs(c.longitud)}°O` : null,
    }),
    labelSeleccionado: (c) => c?.nombre ? `${c.nombre} — ${c.comuna}` : '',
    queryInicial: (v) => v?.nombre ? `${v.nombre} — ${v.comuna}` : '',
  },
  // ← NUEVO: marina y fondeadero buscan en destinos_deportivos
  marina: {
    placeholder: 'Ej: Club de Yates, Marina Anahuac, Cofradía...',
    helper: 'Busca por nombre de marina o club náutico',
    endpoint: null,
    parseResponse: () => [],
    renderItem: (d) => ({
      linea1: d.name,
      linea2: d.safety_tips,
    }),
    labelSeleccionado: (d) => d?.name || '',
    queryInicial: (v) => v?.name || '',
  },
  fondeadero: {
    placeholder: 'Ej: Tunquén, bahía, playa...',
    helper: 'Busca por nombre de fondeadero o bahía',
    endpoint: null,
    parseResponse: () => [],
    renderItem: (d) => ({
      linea1: d.name,
      linea2: d.safety_tips,
    }),
    labelSeleccionado: (d) => d?.name || '',
    queryInicial: (v) => v?.name || '',
  },
};

const estilos = {
  container:    { maxWidth: '620px', margin: '0 auto', padding: '24px 20px', fontFamily: 'system-ui, sans-serif' },
  titulo:       { margin: '0 0 4px', fontSize: '24px', fontWeight: '700', color: '#1a1a2e' },
  subtitulo:    { margin: 0, color: '#555', fontSize: '14px' },
  nave:         { display: 'inline-block', marginTop: '8px', padding: '6px 12px', background: '#e8f4fd', borderRadius: '20px', fontSize: '13px', color: '#1565c0', fontWeight: '500' },
  seccion:      { marginBottom: '24px' },
  label:        { display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '14px', color: '#333' },
  input:        { width: '100%', padding: '11px 14px', border: '1px solid #d0d0d0', borderRadius: '8px', boxSizing: 'border-box', fontSize: '15px', outline: 'none' },
  grid2:        { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
  dropdown:     { position: 'absolute', zIndex: 100, width: '100%', background: 'white', border: '1px solid #d0d0d0', borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', marginTop: '2px', maxHeight: '260px', overflowY: 'auto' },
  dropdownItem: { padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f0f0f0' },
  seleccionado: { marginTop: '6px', padding: '8px 12px', background: '#e8f5e9', borderRadius: '6px', fontSize: '13px', color: '#2e7d32', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  helper:       { fontSize: '12px', color: '#1565c0', marginTop: '5px', fontStyle: 'italic' },
  errorField:   { color: '#c62828', fontSize: '12px', marginTop: '4px' },
  errorBanner:  { background: '#fdecea', border: '1px solid #f44336', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', color: '#c62828', fontSize: '14px' },
  btnTipo:      (activo) => ({
    padding: '10px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px',
    fontWeight: activo ? '700' : '500',
    border: activo ? '2px solid #0052a3' : '1px solid #d0d0d0',
    background: activo ? '#e8f4fd' : 'white',
    color: activo ? '#0052a3' : '#333',
    transition: 'all .15s', flex: 1, textAlign: 'center',
  }),
  btnAgregar:   { padding: '8px 16px', background: 'white', border: '1px dashed #0052a3', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', color: '#0052a3', fontWeight: '500', marginTop: '8px' },
  btnQuitar:    { background: 'none', border: 'none', color: '#c62828', cursor: 'pointer', fontSize: '13px', padding: 0 },
  acciones:     { display: 'flex', gap: '12px', marginTop: '32px' },
  btnSecundario:{ padding: '12px 20px', background: '#f5f5f5', border: '1px solid #ccc', borderRadius: '8px', cursor: 'pointer', fontSize: '15px' },
  btnPrimario:  { flex: 1, padding: '13px 20px', background: '#0052a3', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: '700' },
  divider:      { borderTop: '1px dashed #e0e0e0', paddingTop: '16px', marginTop: '8px' },
  hint:         { fontSize: '12px', color: '#777', marginTop: '4px', fontStyle: 'italic' },
  sinConexion:  { fontSize: '12px', color: '#c62828', marginTop: '4px' },
  buscando:     { position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: '#888' },
  btnLimpiar:   { position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#c62828', cursor: 'pointer', fontSize: '13px', padding: 0 },
  especieBloque: { marginTop: '14px', background: '#fff8e1', border: '1px solid #ffe082', borderRadius: '8px', padding: '14px' },
  especieLabel: { display: 'block', fontWeight: '600', fontSize: '13px', color: '#5d4037', marginBottom: '8px' },
  especieSelect: { width: '100%', padding: '10px 14px', border: '1px solid #ffb300', borderRadius: '8px', fontSize: '14px', background: 'white', color: '#333', outline: 'none', cursor: 'pointer', boxSizing: 'border-box' },
  especieHint: { fontSize: '11px', color: '#795548', marginTop: '6px', fontStyle: 'italic' },
  especieSeleccionada: { marginTop: '8px', padding: '8px 12px', background: '#fff3e0', borderRadius: '6px', fontSize: '12px', color: '#e65100', fontStyle: 'italic' },

  // ← NUEVO: estilos bloque deportivo
  deportivoCard: { marginTop: '14px', background: '#f0f7ff', border: '1px solid #bbdefb', borderRadius: '10px', padding: '14px' },
  deportivoTip:  { fontSize: '12px', color: '#1565c0', marginTop: '8px', fontStyle: 'italic', lineHeight: '1.5' },
  circularBox:   { marginTop: '12px', background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: '8px', padding: '12px' },
  duracionGrid:  { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginTop: '8px' },
  btnDuracion:   (activo) => ({
    padding: '10px 4px', borderRadius: '8px', cursor: 'pointer', textAlign: 'center',
    fontWeight: '700', fontSize: '14px',
    background: activo ? '#e8f4fd' : 'white',
    border: activo ? '2px solid #0052a3' : '1px solid #d0d0d0',
    color: activo ? '#0052a3' : '#555',
  }),
  capitaniaBox:  { marginTop: '10px', background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px' },
  vhfBadge:      { display: 'inline-block', background: '#e3f2fd', border: '1px solid #90caf9', borderRadius: '6px', padding: '3px 8px', color: '#1565c0', fontSize: '12px', fontWeight: '700' },
};

// ─── Buscador genérico (sin cambios, excepto soporte marina/fondeadero) ───────
function Buscador({ tipo, value, onSelect, onClear, error }) {
  const cfg = CONFIG_BUSQUEDA[tipo];
  const [query, setQuery]             = useState(cfg.queryInicial(value));
  const [sugerencias, setSugerencias] = useState([]);
  const [buscando, setBuscando]       = useState(false);
  const [sinConexion, setSinConexion] = useState(false);
  const [hoverIdx, setHoverIdx]       = useState(-1);
  const abortRef   = useRef(null);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setSugerencias([]);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => { setQuery(cfg.queryInicial(value)); }, [value]);

  const buscar = async (texto) => {
    if (texto.length < 2) { setSugerencias([]); return; }

    if (tipo === 'caladero') {
      setSugerencias(buscarCaletasLocal(texto));
      return;
    }

    // ← NUEVO: marina y fondeadero usan búsqueda local en maritime_data
    if (tipo === 'marina') {
      const todos = maritimeData.destinos_deportivos.filter(d => d.type === 'MARINA');
      const q = texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      setSugerencias(todos.filter(d => d.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(q)));
      return;
    }
    if (tipo === 'fondeadero') {
      const todos = maritimeData.destinos_deportivos.filter(d => d.type === 'ANCHORAGE');
      const q = texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      setSugerencias(todos.filter(d => d.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(q)));
      return;
    }

    if (!cfg.endpoint) return;
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    setBuscando(true);
    try {
      const res = await fetch(cfg.endpoint(texto), { signal: abortRef.current.signal });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      setSugerencias(cfg.parseResponse(data));
      setSinConexion(false);
    } catch (e) {
      if (e.name === 'AbortError') return;
      setSinConexion(true);
      setSugerencias([]);
    } finally { setBuscando(false); }
  };

  const buscarD = useDebounce(buscar, DEBOUNCE_MS);

  const handleSelect = (item) => {
    onSelect(item);
    setQuery(cfg.labelSeleccionado(item));
    setSugerencias([]);
    setHoverIdx(-1);
  };

  const handleLimpiar = () => { setQuery(''); onClear(); setSugerencias([]); };

  const handleChangeCaladero = (texto) => {
    setQuery(texto);
    onClear();
    buscarD(texto);
  };

  const esLocalSinSeleccion = ['caladero', 'marina', 'fondeadero'].includes(tipo);

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <input
          value={query}
          onChange={e => {
            if (esLocalSinSeleccion) {
              handleChangeCaladero(e.target.value);
            } else {
              setQuery(e.target.value);
              onClear();
              buscarD(e.target.value);
            }
          }}
          onKeyDown={e => {
            if (e.key === 'ArrowDown')  { e.preventDefault(); setHoverIdx(i => Math.min(i + 1, sugerencias.length - 1)); }
            if (e.key === 'ArrowUp')    { e.preventDefault(); setHoverIdx(i => Math.max(i - 1, 0)); }
            if (e.key === 'Enter' && hoverIdx >= 0) handleSelect(sugerencias[hoverIdx]);
            if (e.key === 'Escape')     setSugerencias([]);
          }}
          placeholder={cfg.placeholder}
          autoComplete="off"
          style={{ ...estilos.input, borderColor: error ? '#f44336' : '#d0d0d0', paddingRight: value ? '36px' : '14px' }}
        />
        {value && <button onClick={handleLimpiar} style={estilos.btnLimpiar}>✕</button>}
        {buscando && !value && <span style={estilos.buscando}>buscando...</span>}
      </div>

      <div style={estilos.helper}>ℹ {cfg.helper}</div>
      {sinConexion && <div style={estilos.sinConexion}>⚠ Sin conexión al servidor</div>}

      {sugerencias.length > 0 && (
        <div style={estilos.dropdown}>
          {sugerencias.map((item, i) => {
            const r = cfg.renderItem(item);
            return (
              <div
                key={item.id || item.codigo_centro || item.codigo || i}
                onMouseDown={() => handleSelect(item)}
                onMouseEnter={() => setHoverIdx(i)}
                style={{ ...estilos.dropdownItem, background: i === hoverIdx ? '#f0f7ff' : 'white' }}
              >
                <div style={{ fontWeight: '600', fontSize: '14px' }}>{r.linea1}</div>
                {r.linea2 && <div style={{ fontSize: '12px', color: '#1565c0', fontWeight: '500' }}>{r.linea2}</div>}
                {r.linea3 && <div style={{ fontSize: '11px', color: '#777' }}>{r.linea3}</div>}
              </div>
            );
          })}
        </div>
      )}

      {value && (
        <div style={estilos.seleccionado}>
          <span>✓ <strong>{cfg.labelSeleccionado(value)}</strong></span>
        </div>
      )}
    </div>
  );
}

// ─── SelectorEspecie (sin cambios) ───────────────────────────────────────────
function SelectorEspecie({ especieId, onSelect, error }) {
  const [especies, setEspecies] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errCarga, setErrCarga] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/marine-weather/especies`)
      .then(r => r.json())
      .then(data => { setEspecies(data.data || []); setCargando(false); })
      .catch(() => {
        setEspecies([
          { id: 1, especie: 'Merluza del Sur',          nombre_cientifico: 'Merluccius australis' },
          { id: 2, especie: 'Reineta',                   nombre_cientifico: 'Brama australis' },
          { id: 3, especie: 'Congrio Dorado',            nombre_cientifico: 'Genypterus blacodes' },
          { id: 4, especie: 'Erizo rojo',                nombre_cientifico: 'Loxechinus albus' },
          { id: 5, especie: 'Pez Espada / Albacora',    nombre_cientifico: 'Xiphias gladius' },
          { id: 6, especie: 'Loco',                      nombre_cientifico: 'Concholepas concholepas' },
          { id: 7, especie: 'Sardina Común / Anchoveta', nombre_cientifico: 'Strangomera bentincki / Engraulis ringens' },
        ]);
        setCargando(false);
        setErrCarga('Usando listado local — sin conexión al servidor');
      });
  }, []);

  const especieActual = especies.find(e => e.id === Number(especieId));

  return (
    <div style={estilos.especieBloque}>
      <label style={estilos.especieLabel}>🐠 ¿Qué recurso busca explotar?</label>
      {cargando ? (
        <div style={{ fontSize: '13px', color: '#888', padding: '8px 0' }}>Cargando especies...</div>
      ) : (
        <select
          value={especieId || ''}
          onChange={e => onSelect(e.target.value ? Number(e.target.value) : null)}
          style={{ ...estilos.especieSelect, borderColor: error ? '#f44336' : '#ffb300' }}
        >
          <option value="">— Selecciona la especie objetivo —</option>
          {especies.map(esp => (
            <option key={esp.id} value={esp.id}>{esp.especie} ({esp.nombre_cientifico})</option>
          ))}
        </select>
      )}
      {errCarga && <div style={estilos.especieHint}>⚠ {errCarga}</div>}
      {!errCarga && !cargando && (
        <div style={estilos.especieHint}>Al verificar condiciones recibirás temperatura del mar, clorofila y alertas normativas para esta especie en el punto de destino.</div>
      )}
      {especieActual && (
        <div style={estilos.especieSeleccionada}>📋 {especieActual.especie} · <em>{especieActual.nombre_cientifico}</em></div>
      )}
      {error && <div style={estilos.errorField}>⚠ {error}</div>}
    </div>
  );
}

// ─── InputCoordenadas (sin cambios) ──────────────────────────────────────────
function InputCoordenadas({ value, onChange, error }) {
  const [mostrarCalc, setMostrarCalc] = useState(false);
  const [dms, setDms] = useState({ latG: '', latM: '', latS: '', lngG: '', lngM: '', lngS: '' });
  const [resultadoCalc, setResultadoCalc] = useState(null);

  const dmsADecimal = (g, m, s) => {
    const gn = parseFloat(g) || 0, mn = parseFloat(m) || 0, sn = parseFloat(s) || 0;
    if (!g) return null;
    return parseFloat((gn + mn / 60 + sn / 3600).toFixed(6));
  };

  const calcular = () => {
    const lat = dmsADecimal(dms.latG, dms.latM, dms.latS);
    const lng = dmsADecimal(dms.lngG, dms.lngM, dms.lngS);
    if (lat === null || lng === null) return;
    setResultadoCalc({ lat: -Math.abs(lat), lng: -Math.abs(lng) });
  };

  const usarResultado = () => {
    if (!resultadoCalc) return;
    onChange({ ...value, lat: String(resultadoCalc.lat), lng: String(resultadoCalc.lng) });
    setMostrarCalc(false);
    setResultadoCalc(null);
  };

  const ec = {
    caja:     { marginTop: '12px', background: '#f0f7ff', border: '1px solid #bbdefb', borderRadius: '8px', padding: '14px' },
    titulo:   { fontSize: '13px', fontWeight: '700', color: '#1565c0', marginBottom: '10px' },
    fila:     { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '8px' },
    inputDms: { width: '100%', padding: '8px 10px', border: '1px solid #90caf9', borderRadius: '6px', boxSizing: 'border-box', fontSize: '14px', textAlign: 'center' },
    labelDms: { fontSize: '11px', color: '#555', marginBottom: '3px', display: 'block', textAlign: 'center' },
    btnCalc:  { padding: '8px 16px', background: '#1565c0', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', marginTop: '4px' },
    resultado:{ marginTop: '10px', padding: '8px 12px', background: '#e8f5e9', borderRadius: '6px', fontSize: '13px', color: '#2e7d32' },
    btnUsar:  { marginTop: '6px', padding: '7px 14px', background: '#2e7d32', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' },
    ejemplo:  { fontSize: '11px', color: '#555', marginTop: '8px', lineHeight: '1.6', background: '#fff', borderRadius: '6px', padding: '8px 10px', border: '1px solid #e3f2fd' },
  };

  return (
    <div>
      <div style={estilos.grid2}>
        <div>
          <label style={{ ...estilos.label, fontWeight: '500' }}>Latitud (°S)</label>
          <input type="number" placeholder="Ej: -42.4567" step="0.0001"
            value={value?.lat || ''}
            onChange={e => onChange({ ...value, lat: e.target.value })}
            style={{ ...estilos.input, borderColor: error ? '#f44336' : '#d0d0d0' }} />
        </div>
        <div>
          <label style={{ ...estilos.label, fontWeight: '500' }}>Longitud (°O)</label>
          <input type="number" placeholder="Ej: -73.1234" step="0.0001"
            value={value?.lng || ''}
            onChange={e => onChange({ ...value, lng: e.target.value })}
            style={{ ...estilos.input, borderColor: error ? '#f44336' : '#d0d0d0' }} />
        </div>
      </div>
      <div style={estilos.helper}>ℹ Ingresa coordenadas en grados decimales negativos (Sur/Oeste)</div>
      {value?.lat && value?.lng && !isNaN(value.lat) && !isNaN(value.lng) && (
        <div style={{ ...estilos.seleccionado, marginTop: '6px' }}>
          <span>✓ {parseFloat(value.lat).toFixed(6)}°S, {parseFloat(value.lng).toFixed(6)}°O</span>
        </div>
      )}
      <button onClick={() => setMostrarCalc(v => !v)}
        style={{ marginTop: '10px', padding: '6px 14px', background: 'white', border: '1px solid #1565c0', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#1565c0', fontWeight: '600' }}>
        {mostrarCalc ? '✕ Cerrar calculadora' : '🧮 Tengo coordenadas en grados, minutos y segundos (WGS84)'}
      </button>
      {mostrarCalc && (
        <div style={ec.caja}>
          <div style={ec.titulo}>Convertidor Datum WGS84 → Grados decimales</div>
          <div style={ec.ejemplo}><strong>Ejemplo:</strong> 42° 6′ 14.19″ S → 42 + 6/60 + 14.19/3600 = <strong>−42.103942°</strong></div>
          <div style={{ marginTop: '12px', marginBottom: '4px', fontSize: '12px', fontWeight: '700', color: '#333' }}>Latitud Sur</div>
          <div style={ec.fila}>
            {[['latG','Grados °','42'],['latM','Minutos ′','6'],['latS','Segundos ″','14.19']].map(([k,lbl,ph]) => (
              <div key={k}><label style={ec.labelDms}>{lbl}</label><input type="number" placeholder={ph} value={dms[k]} onChange={e => setDms(d => ({ ...d, [k]: e.target.value }))} style={ec.inputDms} /></div>
            ))}
          </div>
          <div style={{ marginBottom: '4px', fontSize: '12px', fontWeight: '700', color: '#333' }}>Longitud Oeste</div>
          <div style={ec.fila}>
            {[['lngG','Grados °','73'],['lngM','Minutos ′','7'],['lngS','Segundos ″','55.2']].map(([k,lbl,ph]) => (
              <div key={k}><label style={ec.labelDms}>{lbl}</label><input type="number" placeholder={ph} value={dms[k]} onChange={e => setDms(d => ({ ...d, [k]: e.target.value }))} style={ec.inputDms} /></div>
            ))}
          </div>
          <button onClick={calcular} style={ec.btnCalc}>Convertir →</button>
          {resultadoCalc && (
            <div style={ec.resultado}>
              <div>📍 Latitud: <strong>{resultadoCalc.lat}°</strong></div>
              <div>📍 Longitud: <strong>{resultadoCalc.lng}°</strong></div>
              <button onClick={usarResultado} style={ec.btnUsar}>✓ Usar estas coordenadas</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── SelectorDestino — detecta perfil y muestra tabs correctos ───────────────
function SelectorDestino({ idx, destino, onChange, onQuitar, mostrarQuitar, error, errores, isSport }) {
  const { tipo } = destino;
  const tiposActivos = isSport ? TIPOS_DESTINO_DEPORTIVO : TIPOS_DESTINO; // ← NUEVO

  const setTipo = (t) => onChange({
    tipo: t,
    puerto: null, centro: null, coordenadas: null,
    caladero: null, marina: null, fondeadero: null, // ← NUEVO: marina/fondeadero
    especie_id: null,
    duracion_circular: null,                        // ← NUEVO
  });

  const mostrarEspecie = !isSport && TIPOS_CON_ESPECIE.includes(tipo);
  const esCircular     = isSport && tipo === 'circular'; // ← NUEVO

  return (
    <div style={idx > 0 ? estilos.divider : {}}>
      {mostrarQuitar && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '13px', fontWeight: '600', color: '#555' }}>Destino {idx + 1}</span>
          <button onClick={onQuitar} style={{ ...estilos.btnQuitar, fontSize: '13px' }}>Quitar destino</button>
        </div>
      )}

      {/* Tabs de tipo */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
        {tiposActivos.map(t => (
          <button key={t.id} onClick={() => setTipo(t.id)} style={estilos.btnTipo(tipo === t.id)}>
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      {/* Buscadores */}
      {(tipo === 'puerto' || tipo === 'salmon' || tipo === 'mitilido' || tipo === 'caladero') && (
        <Buscador
          tipo={tipo}
          value={tipo === 'puerto' ? destino.puerto : tipo === 'caladero' ? destino.caladero : destino.centro}
          onSelect={item => {
            if (tipo === 'puerto')        onChange({ ...destino, puerto: item });
            else if (tipo === 'caladero') onChange({ ...destino, caladero: item });
            else                          onChange({ ...destino, centro: item });
          }}
          onClear={() => {
            if (tipo === 'puerto')        onChange({ ...destino, puerto: null });
            else if (tipo === 'caladero') onChange({ ...destino, caladero: null });
            else                          onChange({ ...destino, centro: null });
          }}
          error={!mostrarEspecie ? error : null}
        />
      )}

      {/* ← NUEVO: marina */}
      {tipo === 'marina' && (
        <Buscador
          tipo="marina"
          value={destino.marina}
          onSelect={item => onChange({ ...destino, marina: item })}
          onClear={() => onChange({ ...destino, marina: null })}
          error={error}
        />
      )}

      {/* ← NUEVO: fondeadero */}
      {tipo === 'fondeadero' && (
        <Buscador
          tipo="fondeadero"
          value={destino.fondeadero}
          onSelect={item => onChange({ ...destino, fondeadero: item })}
          onClear={() => onChange({ ...destino, fondeadero: null })}
          error={error}
        />
      )}

      {/* ← NUEVO: circular — solo muestra selector de duración */}
      {esCircular && (
        <div style={estilos.circularBox}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: '#2e7d32', marginBottom: '6px' }}>
            🔄 Paseo circular — regresarás al mismo punto de zarpe
          </div>
          <div style={{ fontSize: '12px', color: '#555', marginBottom: '8px' }}>¿Cuánto tiempo estimas navegar?</div>
          <div style={estilos.duracionGrid}>
            {['1h', '2h', '3h', '4h+'].map(opt => (
              <button key={opt} onClick={() => onChange({ ...destino, duracion_circular: opt })}
                style={estilos.btnDuracion(destino.duracion_circular === opt)}>
                {opt}
              </button>
            ))}
          </div>
          {!destino.duracion_circular && error && (
            <div style={{ ...estilos.errorField, marginTop: '8px' }}>⚠ Selecciona la duración estimada</div>
          )}
        </div>
      )}

      {/* ← NUEVO: tip de seguridad para marina/fondeadero seleccionado */}
      {(tipo === 'marina' && destino.marina?.safety_tips) && (
        <div style={estilos.deportivoCard}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: '#1565c0', marginBottom: '4px' }}>💡 Nota de seguridad</div>
          <div style={estilos.deportivoTip}>{destino.marina.safety_tips}</div>
        </div>
      )}
      {(tipo === 'fondeadero' && destino.fondeadero?.safety_tips) && (
        <div style={estilos.deportivoCard}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: '#1565c0', marginBottom: '4px' }}>💡 Nota de seguridad</div>
          <div style={estilos.deportivoTip}>{destino.fondeadero.safety_tips}</div>
        </div>
      )}

      {tipo === 'coordenadas' && (
        <InputCoordenadas
          value={destino.coordenadas}
          onChange={c => onChange({ ...destino, coordenadas: c })}
          error={!mostrarEspecie ? error : null}
        />
      )}

      {mostrarEspecie && (
        <SelectorEspecie
          especieId={destino.especie_id}
          onSelect={id => onChange({ ...destino, especie_id: id })}
          error={errores?.[`destino_${idx}_especie`]}
        />
      )}

      {error && !esCircular && <div style={estilos.errorField}>⚠ {error}</div>}
    </div>
  );
}

// ─── Pantalla principal P2 ───────────────────────────────────────────────────
const DESTINO_VACIO = {
  tipo: 'puerto',
  puerto: null, centro: null, coordenadas: null,
  caladero: null, marina: null, fondeadero: null, // ← NUEVO
  especie_id: null,
  duracion_circular: null,                        // ← NUEVO
};

export default function P2_VoyageSetup({ onComplete }) {
  // navigate eliminado
  const [vessel, setVessel]             = useState(null);
  const [puertoZarpe, setPuertoZarpe]   = useState(null);
  const [destinos, setDestinos]         = useState([{ ...DESTINO_VACIO }]);
  const [form, setForm]                 = useState({ fecha_zarpe: '', fecha_recalada: '', combustible_disponible: '' });
  const [errores, setErrores]           = useState({});
  const [errorGeneral, setErrorGeneral] = useState(null);

  // ← NUEVO: estado para modales deportivos
  const [showDepartureModal, setShowDepartureModal] = useState(false);
  const [showChecklist, setShowChecklist]           = useState(false);
  const [licenseValidation, setLicenseValidation]   = useState(null);

    useEffect(() => {
    const storedVessel = localStorage.getItem('vessel_profile');
    const storedUser   = localStorage.getItem('user_profile');
    if (!storedVessel) { navigate('/vessel-profile'); return; }
    const vessel = JSON.parse(storedVessel);
    const user   = storedUser ? JSON.parse(storedUser) : {};
    setVessel({ ...vessel, licenseType: user.licenseType || '' });

    const draft = localStorage.getItem('voyage_setup_draft');
    if (draft) {
      try {
        const d = JSON.parse(draft);
        if (d.puerto_zarpe) setPuertoZarpe(d.puerto_zarpe);
        if (d.destinos)     setDestinos(d.destinos);
        if (d.form)         setForm(d.form);
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (!vessel) return;
    localStorage.setItem('voyage_setup_draft', JSON.stringify({ puerto_zarpe: puertoZarpe, destinos, form }));
  }, [puertoZarpe, destinos, form]);

  // ← NUEVO: detectar perfil deportivo
  const isSport = useMemo(() => vessel ? isSportLicense(vessel.licenseType || '') : false, [vessel]);

  // ← NUEVO: capitanía más cercana al zarpe
  const nearestCapitania = useMemo(() => {
    if (!isSport || !puertoZarpe) return null;
    const lat = puertoZarpe.ubicacion?.lat ?? puertoZarpe.lat;
    const lng = puertoZarpe.ubicacion?.lng ?? puertoZarpe.lng;
    if (!lat || !lng) return null;
    const result = getNearestCapitania(lat, lng, maritimeData.capitanias);
    return result?.capitania ?? null;
  }, [isSport, puertoZarpe]);

  // ← NUEVO: validación de licencia en tiempo real
  useEffect(() => {
    if (!isSport || !puertoZarpe || !destinos[0]) { setLicenseValidation(null); return; }

    const origin = {
      lat: puertoZarpe.ubicacion?.lat ?? puertoZarpe.lat,
      lng: puertoZarpe.ubicacion?.lng ?? puertoZarpe.lng,
    };

    // Destino principal (primer destino)
    const d = destinos[0];
    let destCoords = null;
    if (d.tipo === 'puerto'     && d.puerto)      destCoords = { lat: d.puerto.ubicacion?.lat, lng: d.puerto.ubicacion?.lng };
    if (d.tipo === 'marina'     && d.marina)       destCoords = { lat: d.marina.lat, lng: d.marina.lng };
    if (d.tipo === 'fondeadero' && d.fondeadero)   destCoords = { lat: d.fondeadero.lat, lng: d.fondeadero.lng };
    if (d.tipo === 'coordenadas' && d.coordenadas) destCoords = { lat: parseFloat(d.coordenadas.lat), lng: parseFloat(d.coordenadas.lng) };
    if (d.tipo === 'circular')                     destCoords = origin; // circular = mismo punto

    if (!destCoords?.lat || !destCoords?.lng || !origin.lat || !origin.lng) { setLicenseValidation(null); return; }

    const result = validateLicenseRoute(vessel.licenseType || '', origin, destCoords, []);
    setLicenseValidation(result);
  }, [isSport, puertoZarpe, destinos, vessel]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    setErrores(prev => ({ ...prev, [name]: null }));
    setErrorGeneral(null);
  };

  const actualizarDestino = (idx, nuevo) => {
    const updated = [...destinos];
    updated[idx] = nuevo;
    setDestinos(updated);
    setErrores(prev => ({ ...prev, [`destino_${idx}`]: null, [`destino_${idx}_especie`]: null }));
  };

  const agregarDestino = () => setDestinos(prev => [...prev, { ...DESTINO_VACIO, tipo: isSport ? 'puerto' : 'puerto' }]);
  const quitarDestino  = (idx) => setDestinos(prev => prev.filter((_, i) => i !== idx));

  const destinoValido = (d) => {
    if (d.tipo === 'puerto')                          return !!d.puerto;
    if (d.tipo === 'salmon' || d.tipo === 'mitilido') return !!d.centro;
    if (d.tipo === 'coordenadas')                     return d.coordenadas?.lat && d.coordenadas?.lng && !isNaN(d.coordenadas.lat) && !isNaN(d.coordenadas.lng);
    if (d.tipo === 'caladero')                        return !!d.caladero?.nombre;
    if (d.tipo === 'marina')                          return !!d.marina;      // ← NUEVO
    if (d.tipo === 'fondeadero')                      return !!d.fondeadero;  // ← NUEVO
    if (d.tipo === 'circular')                        return !!d.duracion_circular; // ← NUEVO
    return false;
  };

  const validate = () => {
    const errs = {};
    if (!puertoZarpe) errs.zarpe = 'Selecciona el puerto de zarpe';

    destinos.forEach((d, i) => {
      if (!destinoValido(d)) errs[`destino_${i}`] = 'Completa este destino';
      if (!isSport && TIPOS_CON_ESPECIE.includes(d.tipo) && !d.especie_id)
        errs[`destino_${i}_especie`] = 'Selecciona el recurso que vas a explotar';
    });

    if (!form.fecha_zarpe)    errs.fecha_zarpe    = 'Ingresa la fecha de zarpe';
    if (!form.fecha_recalada) errs.fecha_recalada = 'Ingresa la fecha de recalada';
    if (form.fecha_zarpe && form.fecha_recalada && form.fecha_recalada < form.fecha_zarpe)
      errs.fecha_recalada = 'La recalada debe ser posterior al zarpe';
    if (!form.combustible_disponible || isNaN(form.combustible_disponible) || Number(form.combustible_disponible) <= 0)
      errs.combustible_disponible = 'Ingresa un valor válido en litros';
    return errs;
  };

  // ← NUEVO: flujo de confirmación deportivo pasa por checklist → modal zarpe
  const handleConfirmar = () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrores(errs);
      setErrorGeneral('Revisa los campos marcados antes de continuar.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (isSport) {
      // Perfil deportivo: primero checklist de seguridad
      setShowChecklist(true);
      return;
    }

    guardarYNavegar();
  };

  const guardarYNavegar = () => {
    const voyageData = {
      vessel,
      puerto_zarpe:           puertoZarpe,
      destinos,
      fecha_zarpe:            form.fecha_zarpe,
      fecha_recalada:         form.fecha_recalada,
      combustible_disponible: parseFloat(form.combustible_disponible),
      timestamp:              new Date().toISOString(),
      // ← NUEVO: datos deportivos
      is_sport_profile:       isSport,
      license_validation:     licenseValidation,
      nearest_capitania:      nearestCapitania,
    };

    localStorage.setItem('voyage_setup', JSON.stringify(voyageData));
    localStorage.removeItem('voyage_setup_draft');
    if (onComplete) onComplete(voyageData);
  };

  if (!vessel) return <div style={{ padding: '40px', textAlign: 'center', color: '#888' }}>Cargando...</div>;

  const hoy = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];
  const autonomia = vessel.consumo_nominal && form.combustible_disponible && !isNaN(form.combustible_disponible)
    ? Math.round((form.combustible_disponible / vessel.consumo_nominal) * vessel.velocidad_crucero)
    : null;

  return (
    <div style={estilos.container}>
      <header style={{ marginBottom: '28px' }}>
        <h1 style={estilos.titulo}>Configurar Viaje</h1>
        <p style={estilos.subtitulo}>Ingresa los datos del viaje que vas a realizar.</p>
        <span style={estilos.nave}>🚢 {vessel.nombre || vessel.tipo} · {vessel.eslora}m · {vessel.trg} TRG · {vessel.velocidad_crucero} kn</span>
        {/* ← NUEVO: badge perfil deportivo */}
        {isSport && (
          <span style={{ display: 'inline-block', marginTop: '6px', marginLeft: '8px', padding: '4px 10px', background: '#e8f5e9', borderRadius: '20px', fontSize: '12px', color: '#2e7d32', fontWeight: '600' }}>
            ⛵ Perfil Deportivo · {vessel.tipo_licencia}
          </span>
        )}
      </header>

      {errorGeneral && <div style={estilos.errorBanner}>⚠ {errorGeneral}</div>}

      {/* ← NUEVO: alerta de licencia inline (solo deportivo) */}
      {isSport && licenseValidation?.hasViolation && (
        <LicenseAlert alerts={licenseValidation.alerts} licenseCode={licenseValidation.licenseCode} />
      )}

      {/* Puerto de zarpe */}
      <div style={estilos.seccion}>
        <label style={estilos.label}>⚓ Puerto de Zarpe *</label>
        <Buscador
          tipo="puerto"
          value={puertoZarpe}
          onSelect={p => { setPuertoZarpe(p); setErrores(e => ({ ...e, zarpe: null })); }}
          onClear={() => setPuertoZarpe(null)}
          error={errores.zarpe}
        />
        {errores.zarpe && <div style={estilos.errorField}>⚠ {errores.zarpe}</div>}

        {/* ← NUEVO: capitanía del zarpe (solo deportivo) */}
        {isSport && nearestCapitania && (
          <div style={estilos.capitaniaBox}>
            <span style={{ fontSize: '18px' }}>📡</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '12px', color: '#555', marginBottom: '2px' }}>Capitanía de zarpe</div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#1a1a2e', marginBottom: '4px' }}>{nearestCapitania.name}</div>
              <span style={estilos.vhfBadge}>VHF Ch {nearestCapitania.vhf_primary}</span>
              {nearestCapitania.vhf_secondary && (
                <span style={{ ...estilos.vhfBadge, marginLeft: '6px', opacity: 0.7 }}>Ch {nearestCapitania.vhf_secondary}</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Destinos */}
      <div style={estilos.seccion}>
        <label style={estilos.label}>
          🗺 ¿A dónde va?
          {destinos.length > 1 && (
            <span style={{ marginLeft: '8px', fontSize: '12px', background: '#e3f2fd', color: '#1565c0', padding: '2px 8px', borderRadius: '12px', fontWeight: '600' }}>
              {destinos.length} destinos
            </span>
          )}
        </label>

        {destinos.map((destino, idx) => (
          <SelectorDestino
            key={idx}
            idx={idx}
            destino={destino}
            onChange={(nuevo) => actualizarDestino(idx, nuevo)}
            onQuitar={() => quitarDestino(idx)}
            mostrarQuitar={destinos.length > 1}
            error={errores[`destino_${idx}`]}
            errores={errores}
            isSport={isSport}  // ← NUEVO
          />
        ))}

        {/* Ocultar "agregar destino" en circular (no tiene sentido) */}
        {!(isSport && destinos[0]?.tipo === 'circular') && (
          <button onClick={agregarDestino} style={estilos.btnAgregar}>+ Agregar otro destino</button>
        )}
      </div>

      {/* Fechas */}
      <div style={{ ...estilos.seccion, ...estilos.grid2 }}>
        <div>
          <label style={estilos.label}>📅 Fecha de zarpe *</label>
          <input type="date" name="fecha_zarpe" value={form.fecha_zarpe} min={hoy} onChange={handleChange}
            style={{ ...estilos.input, borderColor: errores.fecha_zarpe ? '#f44336' : '#d0d0d0' }} />
          {errores.fecha_zarpe && <div style={estilos.errorField}>⚠ {errores.fecha_zarpe}</div>}
        </div>
        <div>
          <label style={estilos.label}>📅 Fecha de recalada *</label>
          <input type="date" name="fecha_recalada" value={form.fecha_recalada} min={form.fecha_zarpe || hoy} onChange={handleChange}
            style={{ ...estilos.input, borderColor: errores.fecha_recalada ? '#f44336' : '#d0d0d0' }} />
          {errores.fecha_recalada && <div style={estilos.errorField}>⚠ {errores.fecha_recalada}</div>}
        </div>
      </div>

      {/* Combustible */}
      <div style={estilos.seccion}>
        <label style={estilos.label}>⛽ Combustible disponible a bordo (litros) *</label>
        <input type="number" name="combustible_disponible" value={form.combustible_disponible} onChange={handleChange}
          placeholder="Ej: 800" min="1"
          style={{ ...estilos.input, borderColor: errores.combustible_disponible ? '#f44336' : '#d0d0d0' }} />
        {errores.combustible_disponible && <div style={estilos.errorField}>⚠ {errores.combustible_disponible}</div>}
        {autonomia && <div style={estilos.hint}>Autonomía estimada: ~{autonomia} millas náuticas</div>}
      </div>

      {/* Acciones */}
      <div style={estilos.acciones}>
        <button onClick={() => navigate('/vessel-profile')} style={estilos.btnSecundario}>← Volver</button>
        <button onClick={handleConfirmar} style={{
          ...estilos.btnPrimario,
          // ← NUEVO: bloquear si hay violación ilegal de licencia
          opacity: licenseValidation?.severity === 'illegal' ? 0.5 : 1,
          cursor:  licenseValidation?.severity === 'illegal' ? 'not-allowed' : 'pointer',
        }}
          disabled={licenseValidation?.severity === 'illegal'}
        >
          {isSport ? 'Verificar viaje deportivo →' : 'Verificar condiciones del viaje →'}
        </button>
      </div>

      {/* ← NUEVO: Checklist de seguridad (modal paso 1 deportivo) */}
      {showChecklist && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 999 }}>
          <div style={{ width: '100%', maxWidth: '480px', background: '#0D2137', borderRadius: '20px 20px 0 0', padding: '24px 20px 32px' }}>
            <SafetyChecklist
              onAllChecked={() => { setShowChecklist(false); setShowDepartureModal(true); }}
              onCancel={() => setShowChecklist(false)}
            />
          </div>
        </div>
      )}

      {/* ← NUEVO: Modal de zarpe (modal paso 2 deportivo) */}
      <DepartureModal
        isOpen={showDepartureModal}
        capitania={nearestCapitania}
        destinationType={destinos[0]?.tipo?.toUpperCase()}
        onConfirm={() => { setShowDepartureModal(false); guardarYNavegar(); }}
        onClose={() => setShowDepartureModal(false)}
      />
    </div>
  );
}
