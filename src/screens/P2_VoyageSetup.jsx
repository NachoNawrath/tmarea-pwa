import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE = 'http://localhost:3000';
const DEBOUNCE_MS = 350;

function useDebounce(fn, delay) {
  const timer = useRef(null);
  return useCallback((...args) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => fn(...args), delay);
  }, [fn, delay]);
}

const TIPOS_DESTINO = [
  { id: 'puerto',    label: 'Puerto o caleta',   emoji: '⚓' },
  { id: 'salmon',    label: 'Centro salmonero',   emoji: '🐟' },
  { id: 'mitilido',  label: 'Centro mitílidos',   emoji: '🦪' },
  { id: 'coordenadas', label: 'Coordenadas GPS',  emoji: '📌' },
];

// Configuración de búsqueda por tipo de destino
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
};

// ─── Buscador genérico — sirve para puerto, salmon y mitilido ───────────────
function Buscador({ tipo, value, onSelect, onClear, error }) {
  const cfg = CONFIG_BUSQUEDA[tipo];
  const [query, setQuery]           = useState(cfg.queryInicial(value));
  const [sugerencias, setSugerencias] = useState([]);
  const [buscando, setBuscando]     = useState(false);
  const [sinConexion, setSinConexion] = useState(false);
  const [hoverIdx, setHoverIdx]     = useState(-1);
  const abortRef   = useRef(null);
  const wrapperRef = useRef(null);

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setSugerencias([]);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Sincronizar si el valor externo cambia
  useEffect(() => { setQuery(cfg.queryInicial(value)); }, [value]);

  const buscar = async (texto) => {
    if (texto.length < 2) { setSugerencias([]); return; }
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

  const handleLimpiar = () => {
    setQuery('');
    onClear();
    setSugerencias([]);
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      {/* Input */}
      <div style={{ position: 'relative' }}>
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); onClear(); buscarD(e.target.value); }}
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
        {value   && <button onClick={handleLimpiar} style={estilos.btnLimpiar}>✕</button>}
        {buscando && !value && <span style={estilos.buscando}>buscando...</span>}
      </div>

      {/* Helper text — siempre visible debajo del input */}
      <div style={estilos.helper}>ℹ {cfg.helper}</div>

      {/* Error de conexión */}
      {sinConexion && <div style={estilos.sinConexion}>⚠ Sin conexión al servidor</div>}

      {/* Dropdown de sugerencias */}
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

      {/* Confirmación de selección */}
      {value && (
        <div style={estilos.seleccionado}>
          <span>✓ <strong>{cfg.labelSeleccionado(value)}</strong></span>
        </div>
      )}
    </div>
  );
}

// ─── Input de coordenadas GPS con calculadora DMS ───────────────────────────
function InputCoordenadas({ value, onChange, error }) {
  const [mostrarCalc, setMostrarCalc] = useState(false);
  const [dms, setDms] = useState({
    latG: '', latM: '', latS: '',
    lngG: '', lngM: '', lngS: '',
  });
  const [resultadoCalc, setResultadoCalc] = useState(null);

  const dmsADecimal = (g, m, s) => {
    const gn = parseFloat(g) || 0;
    const mn = parseFloat(m) || 0;
    const sn = parseFloat(s) || 0;
    if (!g) return null;
    return parseFloat((gn + mn / 60 + sn / 3600).toFixed(6));
  };

  const calcular = () => {
    const lat = dmsADecimal(dms.latG, dms.latM, dms.latS);
    const lng = dmsADecimal(dms.lngG, dms.lngM, dms.lngS);
    if (lat === null || lng === null) return;
    const resultado = { lat: -Math.abs(lat), lng: -Math.abs(lng) };
    setResultadoCalc(resultado);
  };

  const usarResultado = () => {
    if (!resultadoCalc) return;
    onChange({ ...value, lat: String(resultadoCalc.lat), lng: String(resultadoCalc.lng) });
    setMostrarCalc(false);
    setResultadoCalc(null);
  };

  const estilosCalc = {
    caja:       { marginTop: '12px', background: '#f0f7ff', border: '1px solid #bbdefb', borderRadius: '8px', padding: '14px' },
    titulo:     { fontSize: '13px', fontWeight: '700', color: '#1565c0', marginBottom: '10px' },
    fila:       { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '8px' },
    inputDms:   { width: '100%', padding: '8px 10px', border: '1px solid #90caf9', borderRadius: '6px', boxSizing: 'border-box', fontSize: '14px', textAlign: 'center' },
    labelDms:   { fontSize: '11px', color: '#555', marginBottom: '3px', display: 'block', textAlign: 'center' },
    btnCalc:    { padding: '8px 16px', background: '#1565c0', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', marginTop: '4px' },
    resultado:  { marginTop: '10px', padding: '8px 12px', background: '#e8f5e9', borderRadius: '6px', fontSize: '13px', color: '#2e7d32' },
    btnUsar:    { marginTop: '6px', padding: '7px 14px', background: '#2e7d32', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' },
    ejemplo:    { fontSize: '11px', color: '#555', marginTop: '8px', lineHeight: '1.6', background: '#fff', borderRadius: '6px', padding: '8px 10px', border: '1px solid #e3f2fd' },
  };

  return (
    <div>
      {/* Inputs decimales directos */}
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

      {/* Confirmación */}
      {value?.lat && value?.lng && !isNaN(value.lat) && !isNaN(value.lng) && (
        <div style={{ ...estilos.seleccionado, marginTop: '6px' }}>
          <span>✓ {parseFloat(value.lat).toFixed(6)}°S, {parseFloat(value.lng).toFixed(6)}°O</span>
        </div>
      )}

      {/* Botón calculadora */}
      <button
        onClick={() => setMostrarCalc(v => !v)}
        style={{ marginTop: '10px', padding: '6px 14px', background: 'white', border: '1px solid #1565c0', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#1565c0', fontWeight: '600' }}>
        {mostrarCalc ? '✕ Cerrar calculadora' : '🧮 Tengo coordenadas en grados, minutos y segundos (WGS84)'}
      </button>

      {/* Calculadora DMS */}
      {mostrarCalc && (
        <div style={estilosCalc.caja}>
          <div style={estilosCalc.titulo}>Convertidor Datum WGS84 → Grados decimales</div>

          <div style={estilosCalc.ejemplo}>
            <strong>Ejemplo:</strong> 42° 6′ 14.19″ S se convierte así:<br />
            • Grados: <strong>42</strong> (se quedan igual)<br />
            • Minutos ÷ 60: 6 ÷ 60 = <strong>0.1</strong><br />
            • Segundos ÷ 3600: 14.19 ÷ 3600 = <strong>0.003942</strong><br />
            • Resultado: 42 + 0.1 + 0.003942 = <strong>−42.103942°</strong> (negativo porque es Sur)
          </div>

          {/* Latitud DMS */}
          <div style={{ marginTop: '12px', marginBottom: '4px', fontSize: '12px', fontWeight: '700', color: '#333' }}>Latitud Sur</div>
          <div style={estilosCalc.fila}>
            <div>
              <label style={estilosCalc.labelDms}>Grados °</label>
              <input type="number" min="0" max="90" placeholder="42" value={dms.latG}
                onChange={e => setDms(d => ({ ...d, latG: e.target.value }))}
                style={estilosCalc.inputDms} />
            </div>
            <div>
              <label style={estilosCalc.labelDms}>Minutos ′</label>
              <input type="number" min="0" max="59" placeholder="6" value={dms.latM}
                onChange={e => setDms(d => ({ ...d, latM: e.target.value }))}
                style={estilosCalc.inputDms} />
            </div>
            <div>
              <label style={estilosCalc.labelDms}>Segundos ″</label>
              <input type="number" min="0" max="59.999" step="0.01" placeholder="14.19" value={dms.latS}
                onChange={e => setDms(d => ({ ...d, latS: e.target.value }))}
                style={estilosCalc.inputDms} />
            </div>
          </div>

          {/* Longitud DMS */}
          <div style={{ marginBottom: '4px', fontSize: '12px', fontWeight: '700', color: '#333' }}>Longitud Oeste</div>
          <div style={estilosCalc.fila}>
            <div>
              <label style={estilosCalc.labelDms}>Grados °</label>
              <input type="number" min="0" max="180" placeholder="73" value={dms.lngG}
                onChange={e => setDms(d => ({ ...d, lngG: e.target.value }))}
                style={estilosCalc.inputDms} />
            </div>
            <div>
              <label style={estilosCalc.labelDms}>Minutos ′</label>
              <input type="number" min="0" max="59" placeholder="7" value={dms.lngM}
                onChange={e => setDms(d => ({ ...d, lngM: e.target.value }))}
                style={estilosCalc.inputDms} />
            </div>
            <div>
              <label style={estilosCalc.labelDms}>Segundos ″</label>
              <input type="number" min="0" max="59.999" step="0.01" placeholder="55.2" value={dms.lngS}
                onChange={e => setDms(d => ({ ...d, lngS: e.target.value }))}
                style={estilosCalc.inputDms} />
            </div>
          </div>

          <button onClick={calcular} style={estilosCalc.btnCalc}>Convertir →</button>

          {resultadoCalc && (
            <div style={estilosCalc.resultado}>
              <div>📍 Latitud: <strong>{resultadoCalc.lat}°</strong></div>
              <div>📍 Longitud: <strong>{resultadoCalc.lng}°</strong></div>
              <button onClick={usarResultado} style={estilosCalc.btnUsar}>✓ Usar estas coordenadas</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Selector de un destino (tipo + buscador) ───────────────────────────────
function SelectorDestino({ idx, destino, onChange, onQuitar, mostrarQuitar, error }) {
  const { tipo } = destino;
  const setTipo = (t) => onChange({ tipo: t, puerto: null, centro: null, coordenadas: null });

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
        {TIPOS_DESTINO.map(t => (
          <button key={t.id} onClick={() => setTipo(t.id)} style={estilos.btnTipo(tipo === t.id)}>
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      {/* Buscador según tipo */}
      {(tipo === 'puerto' || tipo === 'salmon' || tipo === 'mitilido') && (
        <Buscador
          tipo={tipo}
          value={tipo === 'puerto' ? destino.puerto : destino.centro}
          onSelect={item => onChange({ ...destino, [tipo === 'puerto' ? 'puerto' : 'centro']: item })}
          onClear={() => onChange({ ...destino, [tipo === 'puerto' ? 'puerto' : 'centro']: null })}
          error={error}
        />
      )}

      {tipo === 'coordenadas' && (
        <InputCoordenadas
          value={destino.coordenadas}
          onChange={c => onChange({ ...destino, coordenadas: c })}
          error={error}
        />
      )}

      {error && <div style={estilos.errorField}>⚠ {error}</div>}
    </div>
  );
}

// ─── Pantalla principal P2 ──────────────────────────────────────────────────
const DESTINO_VACIO = { tipo: 'puerto', puerto: null, centro: null, coordenadas: null };

export default function P2_VoyageSetup() {
  const navigate = useNavigate();
  const [vessel, setVessel]           = useState(null);
  const [puertoZarpe, setPuertoZarpe] = useState(null);
  const [destinos, setDestinos]       = useState([{ ...DESTINO_VACIO }]);
  const [form, setForm]               = useState({ fecha_zarpe: '', fecha_recalada: '', combustible_disponible: '' });
  const [errores, setErrores]         = useState({});
  const [errorGeneral, setErrorGeneral] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem('vessel_profile');
    if (!stored) { navigate('/vessel-profile'); return; }
    setVessel(JSON.parse(stored));

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
    setErrores(prev => ({ ...prev, [`destino_${idx}`]: null }));
  };

  const agregarDestino  = () => setDestinos(prev => [...prev, { ...DESTINO_VACIO }]);
  const quitarDestino   = (idx) => setDestinos(prev => prev.filter((_, i) => i !== idx));

  const destinoValido = (d) => {
    if (d.tipo === 'puerto')                     return !!d.puerto;
    if (d.tipo === 'salmon' || d.tipo === 'mitilido') return !!d.centro;
    if (d.tipo === 'coordenadas')                return d.coordenadas?.lat && d.coordenadas?.lng && !isNaN(d.coordenadas.lat) && !isNaN(d.coordenadas.lng);
    return false;
  };

  const validate = () => {
    const errs = {};
    if (!puertoZarpe) errs.zarpe = 'Selecciona el puerto de zarpe';
    destinos.forEach((d, i) => {
      if (!destinoValido(d)) errs[`destino_${i}`] = 'Completa este destino';
    });
    if (!form.fecha_zarpe)    errs.fecha_zarpe    = 'Ingresa la fecha de zarpe';
    if (!form.fecha_recalada) errs.fecha_recalada = 'Ingresa la fecha de recalada';
    if (form.fecha_zarpe && form.fecha_recalada && form.fecha_recalada < form.fecha_zarpe)
      errs.fecha_recalada = 'La recalada debe ser posterior al zarpe';
    if (!form.combustible_disponible || isNaN(form.combustible_disponible) || Number(form.combustible_disponible) <= 0)
      errs.combustible_disponible = 'Ingresa un valor válido en litros';
    return errs;
  };

  const handleConfirmar = () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrores(errs);
      setErrorGeneral('Revisa los campos marcados antes de continuar.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const voyageData = {
      vessel,
      puerto_zarpe: puertoZarpe,
      destinos,
      fecha_zarpe:           form.fecha_zarpe,
      fecha_recalada:        form.fecha_recalada,
      combustible_disponible: parseFloat(form.combustible_disponible),
      timestamp:             new Date().toISOString(),
    };
    localStorage.setItem('voyage_setup', JSON.stringify(voyageData));
    localStorage.removeItem('voyage_setup_draft');
    navigate('/voyage-check');
  };

  if (!vessel) return <div style={{ padding: '40px', textAlign: 'center', color: '#888' }}>Cargando...</div>;

  const hoy = new Date().toISOString().split('T')[0];
  const autonomia = vessel.consumo_nominal && form.combustible_disponible && !isNaN(form.combustible_disponible)
    ? Math.round((form.combustible_disponible / vessel.consumo_nominal) * vessel.velocidad_crucero)
    : null;

  return (
    <div style={estilos.container}>
      <header style={{ marginBottom: '28px' }}>
        <h1 style={estilos.titulo}>Configurar Viaje</h1>
        <p style={estilos.subtitulo}>Ingresa los datos del viaje que vas a realizar.</p>
        <span style={estilos.nave}>🚢 {vessel.nombre || vessel.tipo} · {vessel.eslora}m · {vessel.trg} TRG · {vessel.velocidad_crucero} kn</span>
      </header>

      {errorGeneral && <div style={estilos.errorBanner}>⚠ {errorGeneral}</div>}

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
          />
        ))}

        <button onClick={agregarDestino} style={estilos.btnAgregar}>+ Agregar otro destino</button>
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
        <button onClick={handleConfirmar} style={estilos.btnPrimario}>Verificar condiciones del viaje →</button>
      </div>
    </div>
  );
}
