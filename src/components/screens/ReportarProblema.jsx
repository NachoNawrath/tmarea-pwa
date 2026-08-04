import React, { useState, useEffect, useRef } from 'react';

const STORAGE_KEY   = 'tmarea_perfil_usuario';
const VERSION_APP   = '0.1.0-beta';
const API_BASE      = import.meta.env.VITE_API_URL || '';

const PANTALLAS = [
  { value: '',           label: 'Seleccionar...' },
  { value: 'p1',        label: 'P1 — Embarcación' },
  { value: 'p2',        label: 'P2 — Planificación' },
  { value: 'p3',        label: 'P3 — Condiciones' },
  { value: 'p4',        label: 'P4 — Navegación' },
  { value: 'biblioteca', label: 'Biblioteca' },
  { value: 'otro',      label: 'Otro' },
];

function parseBrowser(ua) {
  if (/Edg\/(\d+)/.test(ua))                         return `Edge ${RegExp.$1}`;
  if (/OPR\/(\d+)/.test(ua))                         return `Opera ${RegExp.$1}`;
  if (/Chrome\/(\d+)/.test(ua))                      return `Chrome ${RegExp.$1}`;
  if (/Firefox\/(\d+)/.test(ua))                     return `Firefox ${RegExp.$1}`;
  if (/Version\/[\d.]+ Safari\//.test(ua))           return 'Safari';
  return ua.slice(0, 80);
}

async function comprimirImagen(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1200;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
          else                { width  = Math.round(width  * MAX / height); height = MAX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width  = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ReportarProblema({ onBack }) {
  // Datos auto-completados
  const [nombreUsuario, setNombreUsuario]   = useState('');
  const [perfilUsuario, setPerfilUsuario]   = useState('');
  const [fechaHora]                          = useState(new Date().toLocaleString('es-CL'));
  const [navegador]                          = useState(parseBrowser(navigator.userAgent));
  const [gps, setGps]                        = useState(null);

  // Campos editables
  const [pantalla, setPantalla]              = useState('');
  const [descripcion, setDescripcion]        = useState('');
  const [screenshot, setScreenshot]          = useState(null);   // base64
  const [screenshotPreview, setPreview]      = useState(null);
  const [screenshotError, setScreenshotError]= useState('');

  // Estado de envío
  const [enviando, setEnviando]              = useState(false);
  const [resultado, setResultado]            = useState(null);   // { ok, id, mensaje }

  const fileRef = useRef();

  // Cargar perfil del localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const perfil = JSON.parse(stored);
        setNombreUsuario(perfil.nombre_completo || '');
        setPerfilUsuario(perfil.tipo_actividad  || '');
      }
    } catch {}
  }, []);

  // GPS
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setGps({ lat: pos.coords.latitude.toFixed(5), lon: pos.coords.longitude.toFixed(5) }),
      ()    => setGps(null),
      { timeout: 8000 }
    );
  }, []);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScreenshotError('');
    if (file.size > 2 * 1024 * 1024) {
      setScreenshotError('La imagen supera los 2 MB. Elige una más pequeña.');
      e.target.value = '';
      return;
    }
    try {
      const b64 = await comprimirImagen(file);
      setScreenshot(b64);
      setPreview(b64);
    } catch {
      setScreenshotError('No se pudo procesar la imagen. Intenta con otro archivo.');
    }
  };

  const handleEnviar = async () => {
    if (!descripcion.trim()) return;
    setEnviando(true);
    setResultado(null);
    try {
      const resp = await fetch(`${API_BASE}/api/support/report`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          descripcion,
          screenshot_base64: screenshot || undefined,
          metadata: {
            pantalla,
            navegador,
            coordenadas:    gps || null,
            version_app:    VERSION_APP,
            nombre_usuario: nombreUsuario || null,
            perfil_usuario: perfilUsuario || null,
          },
        }),
      });
      const json = await resp.json();
      if (resp.ok && json.success) {
        setResultado({ ok: true, id: json.id, mensaje: json.message });
      } else {
        setResultado({ ok: false, mensaje: json.error || 'Error desconocido.' });
      }
    } catch {
      setResultado({ ok: false, mensaje: 'No se pudo conectar con el servidor. Verifica tu conexión.' });
    } finally {
      setEnviando(false);
    }
  };

  // ── Pantalla de éxito ────────────────────────────────────────────────────
  if (resultado?.ok) {
    return (
      <div style={st.container}>
        <div style={st.successCard}>
          <p style={st.successIcon}>✅</p>
          <h2 style={st.successTitle}>Reporte #{resultado.id} recibido</h2>
          <p style={st.successText}>{resultado.mensaje}</p>
          <button onClick={onBack} style={st.btnPrimario}>
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  const charCount    = descripcion.length;
  const overLimit    = charCount > 500;
  const canSubmit    = descripcion.trim().length > 0 && !overLimit && !enviando;

  return (
    <div style={st.container}>
      {/* Header */}
      <header style={st.header}>
        {onBack && (
          <button onClick={onBack} style={st.btnVolver}>← Volver</button>
        )}
        <h1 style={st.titulo}>⚠️ Reportar un Problema</h1>
        <p style={st.subtitulo}>Ayúdanos a mejorar Tmarea</p>
      </header>

      {/* Datos automáticos */}
      <section style={st.autoSection}>
        <p style={st.autoSectionLabel}>Información detectada automáticamente</p>
        <div style={st.autoGrid}>
          <AutoRow label="Nombre"    value={nombreUsuario || 'No registrado'} />
          <AutoRow label="Actividad" value={perfilUsuario || 'No registrada'} />
          <AutoRow label="Fecha"     value={fechaHora} />
          <AutoRow label="Versión"   value={VERSION_APP} />
          <AutoRow label="Navegador" value={navegador} />
          <AutoRow
            label="GPS"
            value={gps ? `${gps.lat}, ${gps.lon}` : 'No disponible'}
          />
        </div>
      </section>

      {/* Pantalla donde ocurrió */}
      <div style={st.formGroup}>
        <label style={st.label}>Pantalla donde ocurrió el problema</label>
        <select
          value={pantalla}
          onChange={(e) => setPantalla(e.target.value)}
          style={st.select}
        >
          {PANTALLAS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </div>

      {/* Descripción */}
      <div style={st.formGroup}>
        <label style={st.label}>
          Descripción del problema <span style={st.required}>*</span>
        </label>
        <textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Describe brevemente qué pasó o qué no funciona. Sé conciso."
          maxLength={520}
          rows={4}
          style={{ ...st.textarea, borderColor: overLimit ? '#f44336' : '#d0d0d0' }}
        />
        <p style={{ ...st.charCounter, color: overLimit ? '#f44336' : '#888' }}>
          {charCount}/500
        </p>
        {overLimit && (
          <p style={st.fieldError}>Reduce el texto a 500 caracteres máximo.</p>
        )}
      </div>

      {/* Screenshot */}
      <div style={st.formGroup}>
        <label style={st.label}>Captura de pantalla (opcional)</label>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          style={st.btnScreenshot}
        >
          📷 {screenshotPreview ? 'Cambiar captura' : 'Adjuntar captura de pantalla'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFile}
        />
        {screenshotError && <p style={st.fieldError}>{screenshotError}</p>}
        {screenshotPreview && (
          <div style={st.previewWrap}>
            <img src={screenshotPreview} alt="Vista previa" style={st.previewImg} />
            <button
              type="button"
              onClick={() => { setScreenshot(null); setPreview(null); if (fileRef.current) fileRef.current.value = ''; }}
              style={st.btnRemoveImg}
            >
              ✕ Quitar imagen
            </button>
          </div>
        )}
        <p style={st.hint}>Máximo 2 MB. Se comprimirá automáticamente.</p>
      </div>

      {/* Aviso */}
      <div style={st.aviso}>
        <p style={st.avisoText}>
          📬 Los reportes se revisan en un plazo de <strong>24 a 72 horas hábiles</strong>.
          Si tu problema es urgente y afecta la seguridad de la navegación, comunícate
          directamente con la <strong>Capitanía de Puerto</strong>.
        </p>
      </div>

      {/* Error de envío */}
      {resultado && !resultado.ok && (
        <div style={st.errorBanner}>
          ❌ {resultado.mensaje}
        </div>
      )}

      {/* Botón enviar */}
      <button
        onClick={handleEnviar}
        disabled={!canSubmit}
        style={{ ...st.btnPrimario, opacity: canSubmit ? 1 : 0.45 }}
      >
        {enviando ? 'Enviando...' : 'Enviar Reporte'}
      </button>
    </div>
  );
}

function AutoRow({ label, value }) {
  return (
    <div style={st.autoRow}>
      <span style={st.autoLabel}>{label}</span>
      <span style={st.autoValue}>{value}</span>
    </div>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────
const st = {
  container: {
    maxWidth:   560,
    margin:     '0 auto',
    padding:    '70px 20px 56px',
    fontFamily: 'system-ui, sans-serif',
  },
  header: {
    marginBottom: 24,
  },
  btnVolver: {
    background:  'none',
    border:      'none',
    color:       '#1A6EBD',
    fontSize:    14,
    cursor:      'pointer',
    padding:     '0 0 12px',
    fontWeight:  600,
    display:     'block',
  },
  titulo: {
    margin:     '0 0 4px',
    fontSize:   24,
    fontWeight: 700,
    color:      '#0A2647',
  },
  subtitulo: {
    margin:   0,
    color:    '#666',
    fontSize: 13,
  },

  // Sección auto
  autoSection: {
    background:   '#f0f5fb',
    border:       '1px solid #c8ddf0',
    borderRadius: 10,
    padding:      '14px 16px',
    marginBottom: 24,
  },
  autoSectionLabel: {
    margin:     '0 0 10px',
    fontSize:   11,
    fontWeight: 700,
    color:      '#1A6EBD',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  autoGrid: {
    display:       'flex',
    flexDirection: 'column',
    gap:           6,
  },
  autoRow: {
    display:        'flex',
    justifyContent: 'space-between',
    gap:            8,
    fontSize:       13,
  },
  autoLabel: {
    color:      '#555',
    fontWeight: 600,
    minWidth:   80,
  },
  autoValue: {
    color:     '#222',
    textAlign: 'right',
    wordBreak: 'break-all',
  },

  formGroup: {
    marginBottom: 20,
  },
  label: {
    display:      'block',
    fontWeight:   600,
    marginBottom: 6,
    fontSize:     14,
    color:        '#333',
  },
  required: {
    color: '#d32f2f',
  },
  select: {
    width:        '100%',
    padding:      '11px 14px',
    border:       '1px solid #d0d0d0',
    borderRadius: 8,
    boxSizing:    'border-box',
    fontSize:     15,
    background:   'white',
    outline:      'none',
  },
  textarea: {
    width:        '100%',
    padding:      '11px 14px',
    border:       '1px solid #d0d0d0',
    borderRadius: 8,
    boxSizing:    'border-box',
    fontSize:     15,
    outline:      'none',
    resize:       'vertical',
    fontFamily:   'system-ui, sans-serif',
    lineHeight:   1.5,
  },
  charCounter: {
    margin:    '4px 0 0',
    fontSize:  12,
    textAlign: 'right',
  },
  fieldError: {
    margin:   '4px 0 0',
    fontSize: 12,
    color:    '#f44336',
  },

  // Screenshot
  btnScreenshot: {
    display:      'block',
    padding:      '11px 18px',
    border:       '1.5px dashed #1A6EBD',
    borderRadius: 8,
    background:   'transparent',
    color:        '#1A6EBD',
    fontSize:     14,
    fontWeight:   600,
    cursor:       'pointer',
    minHeight:    44,
    width:        '100%',
    textAlign:    'left',
  },
  previewWrap: {
    marginTop: 10,
  },
  previewImg: {
    maxWidth:     '100%',
    maxHeight:    200,
    borderRadius: 8,
    border:       '1px solid #d0d0d0',
    display:      'block',
    marginBottom: 6,
  },
  btnRemoveImg: {
    background:  'none',
    border:      'none',
    color:       '#888',
    fontSize:    12,
    cursor:      'pointer',
    padding:     0,
  },
  hint: {
    margin:   '6px 0 0',
    fontSize: 12,
    color:    '#777',
  },

  // Aviso
  aviso: {
    background:   '#e3f0fb',
    border:       '1px solid #90c3e8',
    borderRadius: 10,
    padding:      '14px 16px',
    marginBottom: 24,
  },
  avisoText: {
    margin:     0,
    fontSize:   14,
    color:      '#0A2647',
    lineHeight: 1.55,
  },

  // Banners
  errorBanner: {
    background:   '#fdecea',
    border:       '1px solid #f44336',
    borderRadius: 8,
    padding:      '12px 16px',
    marginBottom: 16,
    color:        '#c62828',
    fontSize:     14,
  },

  // Botón principal
  btnPrimario: {
    width:        '100%',
    padding:      '14px 20px',
    background:   '#0A2647',
    color:        'white',
    border:       'none',
    borderRadius: 8,
    cursor:       'pointer',
    fontSize:     16,
    fontWeight:   700,
    minHeight:    44,
  },

  // Pantalla de éxito
  successCard: {
    textAlign:    'center',
    padding:      '60px 20px 40px',
  },
  successIcon: {
    fontSize:     52,
    margin:       '0 0 16px',
  },
  successTitle: {
    fontSize:     22,
    fontWeight:   700,
    color:        '#0A2647',
    margin:       '0 0 12px',
  },
  successText: {
    color:        '#444',
    fontSize:     15,
    lineHeight:   1.55,
    margin:       '0 0 32px',
  },
};
