// src/pages/VoyageVerification.jsx
import React from 'react';
import { useVoyageVerification } from '../hooks/useVoyageVerification';
import PortStatusBlock from '../components/verification/PortStatusBlock';
import TransitRestrictionsBlock from '../components/verification/TransitRestrictionsBlock';
import DriftCatalogoBlock from '../components/verification/DriftCatalogoBlock';
import WeatherBlock from '../components/verification/WeatherBlock';
import TideBlock from '../components/verification/TideBlock';
import NavigationBlock from '../components/verification/NavigationBlock';
import NormativeBlock from '../components/verification/NormativeBlock';
import VoyageVerdict from '../components/verification/VoyageVerdict';

// ── Paleta Tmarea ──────────────────────────────────────────────────────────
const C = {
  marino:    '#0A2647',
  profundo:  '#042C53',
  electrico: '#1A6EBD',
  turquesa:  '#5DCAA5',
  coral:     '#E8512A',
  naranja:   '#F57C00',
  ambar:     '#FFC107',
  crema:     '#F1EFE8',
};

// ── Mensajes de carga dinámica ─────────────────────────────────────────────
const LOADING_STEPS = [
  { icon: '⚓', texto: 'Conectando con SITPORT (Armada de Chile)…' },
  { icon: '🌊', texto: 'Consultando condiciones meteorológicas de la ruta…' },
  { icon: '🗺️', texto: 'Trazando ruta según reglamento TM-008…' },
  { icon: '🏁', texto: 'Calculando veredicto de navegación…' },
];

// ── Pantalla de carga ──────────────────────────────────────────────────────
function LoadingScreen({ step }) {
  return (
    <div style={styles.loadingContainer}>
      <div style={styles.loadingCard}>
        {/* Logo / título */}
        <div style={styles.loadingHeader}>
          <span style={styles.loadingTitle}>
            T<span style={{ color: C.electrico }}>m</span>area
          </span>
          <span style={styles.loadingTagline}>NAVEGA CON CERTEZA</span>
        </div>

        {/* Spinner */}
        <div style={styles.spinnerWrap}>
          <div style={styles.spinner} />
        </div>

        {/* Steps dinámicos */}
        <div style={styles.stepsContainer}>
          {LOADING_STEPS.map((s, i) => {
            const done    = i < step;
            const current = i === step;
            return (
              <div
                key={i}
                style={{
                  ...styles.stepRow,
                  opacity: done || current ? 1 : 0.3,
                }}
              >
                <span style={styles.stepIcon}>{done ? '✅' : s.icon}</span>
                <span
                  style={{
                    ...styles.stepText,
                    color: current ? C.ambar : done ? C.turquesa : '#fff',
                    fontWeight: current ? 600 : 400,
                  }}
                >
                  {s.texto}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Pantalla de error ──────────────────────────────────────────────────────
function ErrorScreen({ message, onRetry }) {
  return (
    <div style={styles.errorContainer}>
      <div style={styles.errorCard}>
        <span style={{ fontSize: 40 }}>⚠️</span>
        <h2 style={{ color: C.coral, marginTop: 12, fontFamily: 'Arial', fontWeight: 700 }}>
          Sin datos actualizados
        </h2>
        <p style={{ color: '#fff', fontFamily: 'Arial', fontSize: 14, textAlign: 'center', lineHeight: 1.5 }}>
          No se pudo obtener información de las fuentes oficiales.
          Verificar condiciones directamente con la Capitanía de Puerto antes de zarpar.
        </p>
        <p style={{ color: C.ambar, fontSize: 12, fontFamily: 'Arial', marginTop: 8 }}>
          {message}
        </p>
        <button style={styles.retryBtn} onClick={onRetry}>
          Reintentar
        </button>
      </div>
    </div>
  );
}

// ── Bloque de error de ruta (snap o sin camino) ───────────────────────────
function RouteErrorBlock({ ruta, onBack }) {
  const esSnap = ruta?.error_code === 'SNAP_FAILED';
  const esNoRoute = ruta?.error_code === 'NO_ROUTE';
  if (!esSnap && !esNoRoute) return null;

  const mensaje = esSnap
    ? 'El destino seleccionado está fuera de zona navegable conocida. El punto está a más de 5 km de aguas navegables según la carta del motor de rutas. Intenta seleccionar un punto más cercano a un canal o bahía, o usa Coordenadas GPS para ajustar manualmente.'
    : 'No se encontró ruta navegable entre los puntos seleccionados. Verifica los puertos de zarpe y recalada.';

  return (
    <div style={stylesRouteError.container}>
      <div style={stylesRouteError.icon}>⚠️</div>
      <div style={stylesRouteError.body}>
        <p style={stylesRouteError.titulo}>No se pudo trazar la ruta</p>
        <p style={stylesRouteError.texto}>{mensaje}</p>
      </div>
      <button style={stylesRouteError.btn} onClick={onBack}>
        ← Modificar viaje
      </button>
    </div>
  );
}

const stylesRouteError = {
  container: {
    margin: '12px 16px 0',
    backgroundColor: 'rgba(232,81,42,0.10)',
    border: `1.5px solid ${C.coral}`,
    borderRadius: 14,
    padding: '16px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  icon: { fontSize: 28, textAlign: 'center' },
  body: { display: 'flex', flexDirection: 'column', gap: 6 },
  titulo: {
    fontFamily: 'Arial', fontWeight: 700, fontSize: 16,
    color: C.coral, margin: 0,
  },
  texto: {
    fontFamily: 'Arial', fontSize: 13, color: '#333',
    margin: 0, lineHeight: 1.5,
  },
  btn: {
    marginTop: 4,
    backgroundColor: C.marino,
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    padding: '11px 20px',
    fontFamily: 'Arial',
    fontWeight: 700,
    fontSize: 14,
    cursor: 'pointer',
    alignSelf: 'flex-start',
  },
};

// ── Componente principal ───────────────────────────────────────────────────
export default function VoyageVerification({ voyageData, onStartVoyage, onBack }) {
  const {
    loading,
    loadingStep,
    error,
    portStatus,
    weather,
    transitRestrictions,
    navigation,
    tide,
    normative,
    veredicto,
    arribadaForzosa,
    ruta,
    completedAt,
    retry,
  } = useVoyageVerification(voyageData);

  if (loading) return <LoadingScreen step={loadingStep} />;
  if (error && !portStatus) return <ErrorScreen message={error} onRetry={retry} />;

  const { vessel, puerto_zarpe, destinos } = voyageData;
  const destino = destinos?.[0];

  // Ruta no navegable: SNAP_FAILED o NO_ROUTE. FETCH_FAILED (error de red)
  // no bloquea — degradación silenciosa igual que el resto de servicios.
  const rutaFallida = ruta && !ruta.ok &&
    (ruta.error_code === 'SNAP_FAILED' || ruta.error_code === 'NO_ROUTE');

  return (
    <div style={styles.page}>
      {/* ── Header ── */}
      <div style={styles.header}>
        <button style={styles.backBtn} onClick={onBack}>‹ Volver</button>
        <div style={styles.headerTitle}>
          <span style={{ color: '#fff', fontWeight: 700 }}>
            T<span style={{ color: C.electrico }}>m</span>area
          </span>
          <span style={styles.headerSub}>Condiciones de la navegación</span>
        </div>
        <div style={{ width: 60 }} />
      </div>

      {/* ── Ruta resumen ── */}
      <div style={styles.routeSummary}>
        <span style={styles.routePort}>{puerto_zarpe?.nombre || '—'}</span>
        <span style={styles.routeArrow}>→</span>
        <span style={styles.routePort}>
        {destino?.puerto?.nombre || destino?.centro?.nombre || destino?.marina?.nombre_marina || destino?.fondeadero?.nombre || '-'}
        </span>
      </div>

      {/* ── Error de ruta (destino fuera de zona navegable) ── */}
      {rutaFallida && <RouteErrorBlock ruta={ruta} onBack={onBack} />}

      {/* ── Veredicto principal — solo cuando la ruta es válida ── */}
      {!rutaFallida && (
        <VoyageVerdict
          veredicto={veredicto}
          portStatus={portStatus}
          weather={weather}
          navigation={navigation}
          transitRestrictions={transitRestrictions}
        />
      )}

      {/* ── Aviso de arribada forzosa — recalada cerrada, zarpe posible ── */}
      {!rutaFallida && arribadaForzosa && (() => {
        const rec = portStatus?.recalada;
        const nombre = rec?.capitania || rec?.gobernacion || rec?.nombre || 'destino';
        const tel = rec?.telefono || null;
        return (
          <div style={styles.arribadaAviso}>
            <div style={styles.arribadaIcono}>⚠️</div>
            <div>
              <div style={styles.arribadaTitulo}>Puerto de recalada con restricciones</div>
              <div style={styles.arribadaCuerpo}>
                Tu puerto de destino tiene restricciones activas. Podés zarpar, pero podrías
                necesitar declarar un puerto alternativo o solicitar arribada forzosa.
              </div>
              <div style={styles.arribadaCuerpo}>
                Contactá a la{' '}
                <strong>Capitanía de Puerto de {nombre}</strong>{' '}
                por VHF Canal 16 antes de recalar.
                {tel && (
                  <>
                    {' '}Teléfono:{' '}
                    <a href={`tel:${tel.replace(/\s+/g, '')}`} style={styles.arribadaTel}>
                      {tel}
                    </a>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Bloques de detalle ── */}
      <div style={styles.blocksContainer}>
        {/* Estado de puertos siempre visible (es independiente de la ruta) */}
        <PortStatusBlock portStatus={portStatus} vessel={vessel} />

        {/* Resto de secciones solo cuando hay ruta navegable */}
        {!rutaFallida && (
          <>
            <TransitRestrictionsBlock transitRestrictions={transitRestrictions} />
            {/* A3: va DESPUÉS de las restricciones y en su propio bloque —
                un "no sabemos" no se mezcla con las restricciones reales. */}
            <DriftCatalogoBlock
              drifts={[transitRestrictions?.drift_catalogo, weather?.drift_catalogo]}
            />
            <WeatherBlock weather={weather} ruta={voyageData} />
            <TideBlock tide={tide} />
            <NavigationBlock navigation={navigation} voyageData={voyageData} />
            <NormativeBlock reminders={normative} licenseType={vessel?.licenseType} />
          </>
        )}
      </div>

      {/* ── Timestamp del dato ── */}
      {completedAt && (
        <p style={styles.timestamp}>
          Datos obtenidos: {new Date(completedAt).toLocaleTimeString('es-CL')}
          {portStatus?.zarpe?.dato_viejo && (
            <span style={{ color: C.ambar }}> · ⚠ Dato SITPORT desactualizado</span>
          )}
        </p>
      )}

      {/* ── CTA zarpe — oculto cuando la ruta falló ── */}
      {!rutaFallida && (
        <div style={styles.ctaContainer}>
          <p style={styles.disclaimer}>
            Tmarea informa. El zarpe y la navegación son responsabilidad exclusiva del patrón.
          </p>
          <button
            style={{
              ...styles.ctaBtn,
              backgroundColor: veredicto === 'UV' ? '#555' : C.naranja,
              cursor: veredicto === 'UV' ? 'not-allowed' : 'pointer',
            }}
            onClick={veredicto !== 'UV' ? onStartVoyage : undefined}
            disabled={veredicto === 'UV'}
          >
            {veredicto === 'UV' ? 'Navegación no recomendada' : 'Iniciar navegación →'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Estilos ────────────────────────────────────────────────────────────────
const styles = {
  // Loading
  loadingContainer: {
    minHeight: '100vh',
    backgroundColor: C.profundo,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingCard: {
    width: '100%',
    maxWidth: 380,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 24,
  },
  loadingHeader: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
  },
  loadingTitle: {
    fontFamily: 'Arial',
    fontWeight: 800,
    fontSize: 36,
    color: '#fff',
  },
  loadingTagline: {
    fontFamily: 'Arial',
    fontWeight: 600,
    fontSize: 11,
    letterSpacing: 4,
    color: C.naranja,
  },
  spinnerWrap: {
    width: 56,
    height: 56,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    width: 48,
    height: 48,
    border: `4px solid rgba(255,255,255,0.15)`,
    borderTopColor: C.electrico,
    borderRadius: '50%',
    animation: 'spin 0.9s linear infinite',
  },
  stepsContainer: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  stepRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    transition: 'opacity 0.3s',
  },
  stepIcon: {
    fontSize: 18,
    minWidth: 24,
  },
  stepText: {
    fontFamily: 'Arial',
    fontSize: 14,
    lineHeight: 1.4,
    transition: 'color 0.3s',
  },

  // Error
  errorContainer: {
    minHeight: '100vh',
    backgroundColor: C.profundo,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 28,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
  },
  retryBtn: {
    marginTop: 16,
    backgroundColor: C.electrico,
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    padding: '12px 28px',
    fontFamily: 'Arial',
    fontWeight: 700,
    fontSize: 15,
    cursor: 'pointer',
  },

  // Página principal
  page: {
    minHeight: '100vh',
    backgroundColor: C.crema,
    display: 'flex',
    flexDirection: 'column',
    fontFamily: 'Arial',
  },
  header: {
    backgroundColor: C.marino,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 16px',
  },
  backBtn: {
    background: 'none',
    border: 'none',
    color: C.turquesa,
    fontFamily: 'Arial',
    fontWeight: 600,
    fontSize: 16,
    cursor: 'pointer',
    width: 60,
    textAlign: 'left',
  },
  headerTitle: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
  },
  headerSub: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  routeSummary: {
    backgroundColor: C.marino,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: '10px 16px 16px',
    borderBottom: `2px solid ${C.electrico}`,
  },
  routePort: {
    color: '#fff',
    fontWeight: 700,
    fontSize: 15,
    letterSpacing: 0.5,
  },
  routeArrow: {
    color: C.turquesa,
    fontSize: 18,
    fontWeight: 700,
  },
  blocksContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    padding: '12px 16px',
  },
  timestamp: {
    color: '#888',
    fontSize: 11,
    textAlign: 'center',
    padding: '0 16px 4px',
    fontFamily: 'Arial',
  },
  ctaContainer: {
    padding: '12px 16px 32px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  disclaimer: {
    color: '#888',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 1.4,
    margin: 0,
  },
  ctaBtn: {
    width: '100%',
    padding: '16px 0',
    border: 'none',
    borderRadius: 14,
    fontFamily: 'Arial',
    fontWeight: 700,
    fontSize: 17,
    color: '#fff',
    letterSpacing: 0.3,
  },
  arribadaAviso: {
    display: 'flex',
    gap: 12,
    margin: '0 16px 16px',
    padding: '14px 16px',
    borderRadius: 12,
    backgroundColor: 'rgba(255,193,7,0.12)',
    border: '1.5px solid #FFC107',
  },
  arribadaIcono: {
    fontSize: 22,
    flexShrink: 0,
    paddingTop: 1,
  },
  arribadaTitulo: {
    fontWeight: 700,
    fontSize: 14,
    color: '#FFC107',
    marginBottom: 6,
  },
  arribadaCuerpo: {
    fontSize: 13,
    color: '#ddd',
    lineHeight: 1.5,
    marginBottom: 4,
  },
  arribadaTel: {
    color: '#5DCAA5',
    fontWeight: 600,
    textDecoration: 'none',
  },
};

// Inyectar keyframes para el spinner
if (typeof document !== 'undefined') {
  const styleTag = document.createElement('style');
  styleTag.innerHTML = `@keyframes spin { to { transform: rotate(360deg); } }`;
  document.head.appendChild(styleTag);
}
