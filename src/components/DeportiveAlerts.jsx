/**
 * DeportiveAlerts.jsx
 * Componentes de alertas y cumplimiento normativo — Perfil Deportivo Tmarea
 *
 * Exports:
 *   <DepartureModal>        Modal de zarpe con VHF y teléfono de capitanía
 *   <ActiveCapitaniaWidget> Banner/widget dinámico de jurisdicción activa
 *   <SafetyChecklist>       Checklist pre-zarpe obligatorio DIRECTEMAR
 *   <LicenseAlert>          Alerta de restricción geográfica por licencia
 *   <ArrivalReminder>       Aviso de recalada al llegar al destino
 */

import { useState, useEffect, useRef } from 'react';
import { SAFETY_CHECKLIST_ITEMS } from '../utils/license-rules.js';

// ─── ESTILOS BASE ─────────────────────────────────────────────────────────────
// Paleta Tmarea: azul marino profundo, blanco, ámbar de alerta, rojo de bloqueo

const styles = {
  // Modal overlay
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(8, 24, 48, 0.75)',
    backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    zIndex: 1000,
    padding: '0 0 env(safe-area-inset-bottom) 0',
  },
  sheet: {
    background: '#0D2137',
    borderRadius: '20px 20px 0 0',
    width: '100%', maxWidth: '480px',
    padding: '24px 20px 32px',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  sheetHandle: {
    width: 40, height: 4,
    background: 'rgba(255,255,255,0.2)',
    borderRadius: 2, margin: '0 auto 20px',
  },

  // Tipografía
  title: { color: '#FFFFFF', fontSize: 18, fontWeight: 700, marginBottom: 4 },
  subtitle: { color: 'rgba(255,255,255,0.55)', fontSize: 13, marginBottom: 20 },
  label: { color: 'rgba(255,255,255,0.5)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 },
  value: { color: '#FFFFFF', fontSize: 16, fontWeight: 600 },
  body: { color: 'rgba(255,255,255,0.8)', fontSize: 14, lineHeight: 1.5 },

  // Tarjetas de info
  infoCard: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 12, padding: '12px 16px', marginBottom: 12,
  },
  row: { display: 'flex', alignItems: 'center', gap: 12 },

  // Botones
  btnPrimary: {
    width: '100%', padding: '14px',
    background: '#1A6FD4', color: '#FFFFFF',
    border: 'none', borderRadius: 12,
    fontSize: 15, fontWeight: 700,
    cursor: 'pointer', marginTop: 16,
    letterSpacing: '0.02em',
  },
  btnSecondary: {
    width: '100%', padding: '12px',
    background: 'transparent', color: 'rgba(255,255,255,0.5)',
    border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12,
    fontSize: 14, cursor: 'pointer', marginTop: 8,
  },

  // Alertas
  alertWarning: {
    background: 'rgba(245, 158, 11, 0.12)',
    border: '1px solid rgba(245, 158, 11, 0.35)',
    borderRadius: 12, padding: '12px 16px', marginBottom: 12,
  },
  alertDanger: {
    background: 'rgba(239, 68, 68, 0.12)',
    border: '1px solid rgba(239, 68, 68, 0.35)',
    borderRadius: 12, padding: '12px 16px', marginBottom: 12,
  },
  alertSuccess: {
    background: 'rgba(34, 197, 94, 0.1)',
    border: '1px solid rgba(34, 197, 94, 0.3)',
    borderRadius: 12, padding: '12px 16px',
  },

  // Checklist items
  checkItem: {
    display: 'flex', alignItems: 'flex-start', gap: 12,
    padding: '12px 0',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    border: '2px solid rgba(255,255,255,0.25)',
    background: 'transparent', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, marginTop: 1,
    transition: 'all 0.15s ease',
  },
  checkboxChecked: {
    background: '#22C55E', borderColor: '#22C55E',
  },

  // Widget flotante capitanía
  widget: {
    background: '#0D2137',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 14, padding: '10px 14px',
    display: 'flex', alignItems: 'center', gap: 10,
    boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
  },
  widgetDot: {
    width: 10, height: 10, borderRadius: '50%',
    background: '#22C55E', flexShrink: 0,
    boxShadow: '0 0 6px #22C55E',
  },
  widgetDotWarn: { background: '#F59E0B', boxShadow: '0 0 6px #F59E0B' },

  // VHF badge
  vhfBadge: {
    background: 'rgba(26, 111, 212, 0.25)',
    border: '1px solid rgba(26, 111, 212, 0.4)',
    borderRadius: 6, padding: '3px 8px',
    color: '#60A5FA', fontSize: 12, fontWeight: 700,
    display: 'inline-flex', alignItems: 'center', gap: 4,
  },
};

// ─── 1. MODAL DE ZARPE ────────────────────────────────────────────────────────

/**
 * Modal bottom-sheet que aparece al pulsar "Iniciar Navegación".
 * Muestra VHF, teléfono y tips de la capitanía más cercana al zarpe.
 *
 * @param {object} props
 * @param {boolean} props.isOpen
 * @param {object} props.capitania — objeto de maritime_data.json
 * @param {string} props.destinationType — 'PORT' | 'MARINA' | 'ANCHORAGE' | 'CIRCULAR'
 * @param {Function} props.onConfirm — callback: usuario confirma y zarpa
 * @param {Function} props.onClose
 */
export function DepartureModal({ isOpen, capitania, destinationType, onConfirm, onClose }) {
  if (!isOpen || !capitania) return null;

  const isCircular = destinationType === 'CIRCULAR';

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div style={styles.sheetHandle} />

        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>⚓</div>
          <h2 style={styles.title}>Aviso de Zarpe Obligatorio</h2>
          <p style={styles.subtitle}>
            {isCircular
              ? 'Antes de salir a pasear, avisa tu zarpe a la Autoridad Marítima.'
              : 'Antes de soltar amarras, da aviso a la Capitanía más cercana.'}
          </p>
        </div>

        {/* Datos de capitanía */}
        <div style={styles.infoCard}>
          <div style={{ ...styles.label, marginBottom: 4 }}>Autoridad Marítima</div>
          <div style={{ ...styles.value, marginBottom: 12 }}>{capitania.name}</div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <span style={styles.vhfBadge}>
              📡 VHF Ch {capitania.vhf_primary} (guardia)
            </span>
            {capitania.vhf_secondary && (
              <span style={styles.vhfBadge}>
                📡 VHF Ch {capitania.vhf_secondary}
              </span>
            )}
          </div>

          {capitania.phone && (
            <div style={styles.row}>
              <span style={{ fontSize: 16 }}>📞</span>
              <a
                href={`tel:${capitania.phone}`}
                style={{ color: '#60A5FA', fontSize: 14, textDecoration: 'none', fontWeight: 600 }}
              >
                {capitania.phone}
              </a>
            </div>
          )}
        </div>

        {/* Tip local */}
        {capitania.tips && (
          <div style={styles.alertWarning}>
            <div style={{ ...styles.label, color: '#F59E0B', marginBottom: 4 }}>
              ⚠️ Nota local
            </div>
            <p style={{ ...styles.body, color: 'rgba(245,158,11,0.9)', margin: 0, fontSize: 13 }}>
              {capitania.tips}
            </p>
          </div>
        )}

        {/* Recordatorio e-Zarpe */}
        <div style={{ ...styles.infoCard, borderColor: 'rgba(26,111,212,0.3)' }}>
          <p style={{ ...styles.body, margin: 0, fontSize: 13 }}>
            💡 <strong>e-Zarpe:</strong> Si realizas una travesía costera, genera tu zarpe digital en{' '}
            <strong>ezarpe.directemar.cl</strong> o avisa por radio en canal de guardia.
          </p>
        </div>

        <button style={styles.btnPrimary} onClick={onConfirm}>
          Entendido — Zarpar
        </button>
        <button style={styles.btnSecondary} onClick={onClose}>
          Volver al setup
        </button>
      </div>
    </div>
  );
}

// ─── 2. WIDGET CAPITANÍA ACTIVA ───────────────────────────────────────────────

/**
 * Widget flotante que muestra la jurisdicción activa durante la navegación.
 * Se actualiza dinámicamente cuando el usuario cruza hacia otra capitanía.
 *
 * @param {object} props
 * @param {object} props.capitania — objeto activo de maritime_data.json
 * @param {boolean} props.isWithinJurisdiction — si está dentro del radio oficial
 * @param {number} props.distanceKm — distancia al centro de la capitanía
 * @param {boolean} props.collapsed — versión compacta para mapa
 */
export function ActiveCapitaniaWidget({ capitania, isWithinJurisdiction, distanceKm, collapsed = false }) {
  const [expanded, setExpanded] = useState(!collapsed);

  if (!capitania) return null;

  const distNM = (distanceKm / 1.852).toFixed(1);

  if (!expanded) {
    return (
      <button
        style={{ ...styles.widget, cursor: 'pointer', border: 'none' }}
        onClick={() => setExpanded(true)}
        aria-label="Ver datos de capitanía activa"
      >
        <div style={{ ...styles.widgetDot, ...(isWithinJurisdiction ? {} : styles.widgetDotWarn) }} />
        <span style={{ color: '#FFFFFF', fontSize: 13, fontWeight: 600 }}>
          VHF {capitania.vhf_primary}
        </span>
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
          {capitania.name.split(' ').slice(-1)[0]}
        </span>
      </button>
    );
  }

  return (
    <div style={styles.widget}>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <div style={{ ...styles.widgetDot, ...(isWithinJurisdiction ? {} : styles.widgetDotWarn) }} />
          <span style={{ ...styles.label, margin: 0, fontSize: 10 }}>
            {isWithinJurisdiction ? 'Jurisdicción activa' : 'Capitanía más cercana'}
          </span>
        </div>

        <div style={{ ...styles.value, fontSize: 14, marginBottom: 8 }}>
          {capitania.name}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          <span style={styles.vhfBadge}>Ch {capitania.vhf_primary}</span>
          {capitania.vhf_secondary && (
            <span style={{ ...styles.vhfBadge, opacity: 0.7 }}>Ch {capitania.vhf_secondary}</span>
          )}
        </div>

        {capitania.phone && (
          <a
            href={`tel:${capitania.phone}`}
            style={{ color: '#60A5FA', fontSize: 12, textDecoration: 'none' }}
          >
            📞 {capitania.phone}
          </a>
        )}

        <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 6 }}>
          {distNM} MN desde tu posición
        </div>
      </div>

      <button
        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', padding: 4 }}
        onClick={() => setExpanded(false)}
        aria-label="Colapsar widget"
      >
        ✕
      </button>
    </div>
  );
}

// ─── 3. CHECKLIST DE SEGURIDAD ────────────────────────────────────────────────

/**
 * Checklist obligatorio pre-zarpe DIRECTEMAR.
 * El botón de confirmar solo se habilita cuando todos los items están marcados.
 *
 * @param {object} props
 * @param {Function} props.onAllChecked — callback cuando el checklist está completo
 * @param {Function} props.onCancel
 */
export function SafetyChecklist({ onAllChecked, onCancel }) {
  const [checked, setChecked] = useState(
    () => Object.fromEntries(SAFETY_CHECKLIST_ITEMS.map((item) => [item.id, false]))
  );

  const allChecked = Object.values(checked).every(Boolean);

  const toggle = (id) => setChecked((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <div style={styles.sheet}>
      <div style={styles.sheetHandle} />

      <div style={{ fontSize: 28, marginBottom: 8 }}>🛡️</div>
      <h2 style={styles.title}>Verificación de Seguridad</h2>
      <p style={styles.subtitle}>
        Confirma que tu embarcación cuenta con el equipamiento mínimo exigido por DIRECTEMAR.
      </p>

      <div>
        {SAFETY_CHECKLIST_ITEMS.map((item) => (
          <div
            key={item.id}
            style={styles.checkItem}
            role="checkbox"
            aria-checked={checked[item.id]}
            tabIndex={0}
            onClick={() => toggle(item.id)}
            onKeyDown={(e) => e.key === ' ' && toggle(item.id)}
          >
            <div style={{ ...styles.checkbox, ...(checked[item.id] ? styles.checkboxChecked : {}) }}>
              {checked[item.id] && (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: checked[item.id] ? 'rgba(255,255,255,0.5)' : '#FFFFFF', fontSize: 14, fontWeight: 600, marginBottom: 2, transition: 'color 0.15s' }}>
                {item.label}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>{item.detail}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Progress indicator */}
      <div style={{ marginTop: 16, marginBottom: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ ...styles.label, margin: 0 }}>Progreso</span>
          <span style={{ color: allChecked ? '#22C55E' : 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: 700 }}>
            {Object.values(checked).filter(Boolean).length} / {SAFETY_CHECKLIST_ITEMS.length}
          </span>
        </div>
        <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2 }}>
          <div style={{
            height: '100%',
            width: `${(Object.values(checked).filter(Boolean).length / SAFETY_CHECKLIST_ITEMS.length) * 100}%`,
            background: allChecked ? '#22C55E' : '#1A6FD4',
            borderRadius: 2, transition: 'all 0.3s ease',
          }} />
        </div>
      </div>

      <button
        style={{
          ...styles.btnPrimary,
          opacity: allChecked ? 1 : 0.4,
          cursor: allChecked ? 'pointer' : 'not-allowed',
        }}
        disabled={!allChecked}
        onClick={onAllChecked}
      >
        {allChecked ? 'Todo listo — Continuar' : 'Marca todos los ítems para continuar'}
      </button>
      <button style={styles.btnSecondary} onClick={onCancel}>
        Volver
      </button>
    </div>
  );
}

// ─── 4. ALERTA DE LICENCIA ────────────────────────────────────────────────────

/**
 * Alerta inline que se muestra en el setup cuando la ruta viola la licencia.
 *
 * @param {object} props
 * @param {Array} props.alerts — array de { code, severity, message, detail }
 * @param {string} props.licenseCode — PDB | CDC | CDAM
 */
export function LicenseAlert({ alerts, licenseCode }) {
  if (!alerts?.length) return null;

  const hasIllegal = alerts.some((a) => a.severity === 'illegal');
  const containerStyle = hasIllegal ? styles.alertDanger : styles.alertWarning;
  const icon = hasIllegal ? '🚫' : '⚠️';
  const color = hasIllegal ? '#FCA5A5' : '#FCD34D';

  const licenseLabels = {
    PDB: 'Patrón Deportivo de Bahía',
    CDC: 'Capitán Deportivo Costero',
    CDAM: 'Capitán Deportivo de Alta Mar',
  };

  return (
    <div style={containerStyle}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span style={{ fontSize: 20, flexShrink: 0 }}>{icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ color, fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
            Restricción de licencia — {licenseLabels[licenseCode] ?? licenseCode}
          </div>
          {alerts.map((alert, i) => (
            <div key={i} style={{ marginBottom: i < alerts.length - 1 ? 8 : 0 }}>
              <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, margin: '0 0 2px' }}>
                {alert.message}
              </p>
              {alert.detail && (
                <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, margin: 0 }}>
                  {alert.detail}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── 5. AVISO DE RECALADA ─────────────────────────────────────────────────────

/**
 * Notificación de cierre de viaje al detectar llegada al destino.
 * Se activa desde P4 cuando el GPS entra en la geocerca del destino.
 *
 * @param {object} props
 * @param {boolean} props.isVisible
 * @param {object} props.capitania — capitanía del puerto de recalada
 * @param {string} props.destinationName
 * @param {Function} props.onDismiss
 */
export function ArrivalReminder({ isVisible, capitania, destinationName, onDismiss }) {
  if (!isVisible) return null;

  return (
    <div style={{ ...styles.overlay, alignItems: 'flex-end' }}>
      <div style={{ ...styles.sheet, background: '#0A2E1A', borderTop: '3px solid #22C55E' }}>
        <div style={styles.sheetHandle} />

        <div style={{ fontSize: 36, marginBottom: 8 }}>🏁</div>
        <h2 style={styles.title}>¡Llegaste a {destinationName}!</h2>
        <p style={styles.subtitle}>
          Da aviso de recalada de inmediato para cerrar tu bitácora SAR.
        </p>

        {capitania && (
          <div style={{ ...styles.infoCard, borderColor: 'rgba(34,197,94,0.3)' }}>
            <div style={{ ...styles.label, marginBottom: 6 }}>Avisar a</div>
            <div style={{ ...styles.value, marginBottom: 10 }}>{capitania.name}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              <span style={styles.vhfBadge}>📡 VHF Ch {capitania.vhf_primary}</span>
            </div>
            {capitania.phone && (
              <a
                href={`tel:${capitania.phone}`}
                style={{ color: '#4ADE80', fontSize: 14, textDecoration: 'none', fontWeight: 600 }}
              >
                📞 {capitania.phone}
              </a>
            )}
          </div>
        )}

        <div style={{ ...styles.alertWarning, borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)' }}>
          <p style={{ color: '#FCA5A5', fontSize: 13, margin: 0 }}>
            ⚠️ No dar aviso de recalada puede activar un protocolo de búsqueda y rescate (SAR) innecesario.
          </p>
        </div>

        <button style={{ ...styles.btnPrimary, background: '#16A34A' }} onClick={onDismiss}>
          Recalada confirmada
        </button>
      </div>
    </div>
  );
}

// ─── HOOK: useCapitaniaTracker ────────────────────────────────────────────────

/**
 * Hook para trackear la capitanía activa durante la navegación.
 * Actualiza automáticamente al cambiar posición GPS.
 *
 * @param {Array} capitanias — array de maritime_data.json
 * @returns {{ activeCapitania, distanceKm, isWithinJurisdiction, prevCapitaniaId }}
 */
export function useCapitaniaTracker(capitanias) {
  const [state, setState] = useState({
    activeCapitania: null,
    distanceKm: null,
    isWithinJurisdiction: false,
    prevCapitaniaId: null,
  });

  // Importación dinámica para evitar dependencia circular en bundle
  const updatePosition = (lat, lng) => {
    if (!capitanias?.length || lat == null || lng == null) return;

    // Inline de getActiveCapitania para evitar import dinámico
    const { haversineKm } = require('./maritime-geo.js');

    let activeMatch = null;
    let minDistInside = Infinity;

    for (const cap of capitanias) {
      const dist = haversineKm(lat, lng, cap.lat, cap.lng);
      if (dist <= cap.radius_km && dist < minDistInside) {
        minDistInside = dist;
        activeMatch = { capitania: cap, distanceKm: dist, isWithinJurisdiction: true };
      }
    }

    if (!activeMatch) {
      let minDist = Infinity;
      let nearest = null;
      for (const cap of capitanias) {
        const dist = haversineKm(lat, lng, cap.lat, cap.lng);
        if (dist < minDist) { minDist = dist; nearest = cap; }
      }
      activeMatch = { capitania: nearest, distanceKm: minDist, isWithinJurisdiction: false };
    }

    setState((prev) => ({
      ...activeMatch,
      prevCapitaniaId: prev.activeCapitania?.id ?? null,
    }));
  };

  return { ...state, updatePosition };
}
