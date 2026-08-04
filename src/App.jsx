import React, { useEffect, useState } from 'react';
import { AppProvider } from './context/AppContext';

// Pantallas S0
import S0Onboarding from './components/screens/S0Onboarding';
import S0_5Registro from './components/screens/S0_5Registro';

// Pantallas principales
import P1_VesselProfile from './screens/P1_VesselProfile';
import P2_VoyageSetup   from './screens/P2_VoyageSetup';
import VoyageVerification from './screens/P3_VoyageVerification';
import P4_ActiveVoyage  from './screens/P4_ActiveVoyage';

// Nuevas pantallas
import MiPerfil from './components/screens/MiPerfil';
import BibliotecaHome from './components/screens/BibliotecaHome';
import ModuloView from './components/screens/ModuloView';
import ReportarProblema from './components/screens/ReportarProblema';
import AppSidebar from './components/AppSidebar';

// ─────────────────────────────────────────────────────────────────────────────
// PANTALLAS DEL FLUJO
// s0_onboarding → s0_registro → p1 → p2 → p3 → p4
// Nuevas: perfil, biblioteca, reportar
// ─────────────────────────────────────────────────────────────────────────────

// Screens where the sidebar hamburger is shown
const SIDEBAR_SCREENS = ['p1', 'p2', 'p3', 'p4', 'perfil', 'biblioteca', 'biblioteca_modulo', 'reportar'];

function AppFlow() {
  const [screen, setScreen]         = useState('loading');
  const [voyageData, setVoyageData] = useState(null);  // P2 → P3 → P4
  const [reportData, setReportData] = useState(null);  // P4 → informe
  const [moduloId, setModuloId]     = useState(null);  // Biblioteca → módulo

  // ── Inicialización: detectar estado guardado ──────────────────────────────
  useEffect(() => {
    const s0Data      = localStorage.getItem('s0_accepted');
    const userProfile = localStorage.getItem('user_profile');

    if (!s0Data)      { setScreen('s0_onboarding'); return; }
    if (!userProfile) { setScreen('s0_registro');   return; }
    setScreen('p1');
  }, []);

  // ── Handlers de navegación ────────────────────────────────────────────────

  const handleLegalAccept = () => setScreen('s0_registro');

  const handleRegistroComplete = () => setScreen('p1');

  const handleP1Complete = () => setScreen('p2');

  // P2 → P3: recibe el voyageData completo del setup
  const handleP2Complete = (data) => {
    setVoyageData(data);
    setScreen('p3');
  };

  // P3 → P4: el patrón confirma que va a zarpar
  const handleStartVoyage = () => setScreen('p4');

  // P3 → P2: volver a editar el viaje
  const handleBackToP2 = () => setScreen('p2');

  // P4 → P3: cancelar navegación activa (conserva voyageData para que P3 lo muestre)
  const handleCancelVoyage = () => setScreen('p3');

  // P4 → cierre: viaje terminado, guardar datos para informe
  const handleVoyageComplete = (closingData) => {
    setReportData({ ...voyageData, ...closingData });
    setScreen('p2'); // volver a inicio para nuevo viaje
  };

  // ── Sidebar: navegación entre secciones ──────────────────────────────────
  const handleSidebarNavigate = (targetScreen) => {
    // No permitir navegar fuera de P4 sin confirmación — la confirmación
    // ya ocurre dentro de P4 (botón "Cancelar navegación"). El sidebar en P4
    // solo debería navegar si el usuario lo acepta; por ahora lo permitimos
    // directamente (el patrón eligió conscientemente la opción del menú).
    setScreen(targetScreen);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (screen === 'loading') {
    return (
      <div style={styles.loading}>
        <div style={styles.loadingInner}>
          <span style={styles.loadingLogo}>
            T<span style={{ color: '#1A6EBD' }}>m</span>area
          </span>
          <span style={styles.loadingTagline}>NAVEGA CON CERTEZA</span>
          <div style={styles.loadingDot} />
        </div>
      </div>
    );
  }

  const showSidebar = SIDEBAR_SCREENS.includes(screen);

  return (
    <>
      {showSidebar && (
        <AppSidebar currentScreen={screen} onNavigate={handleSidebarNavigate} />
      )}

      {screen === 's0_onboarding' && (
        <S0Onboarding onAccept={handleLegalAccept} />
      )}

      {screen === 's0_registro' && (
        <S0_5Registro onComplete={handleRegistroComplete} />
      )}

      {screen === 'p1' && (
        <P1_VesselProfile onComplete={handleP1Complete} />
      )}

      {screen === 'p2' && (
        <P2_VoyageSetup
          onComplete={handleP2Complete}
          onEditProfile={() => setScreen('p1')}
        />
      )}

      {screen === 'p3' && (
        <VoyageVerification
          voyageData={voyageData}
          onStartVoyage={handleStartVoyage}
          onBack={handleBackToP2}
        />
      )}

      {screen === 'p4' && (
        <P4_ActiveVoyage
          voyageData={voyageData}
          onVoyageComplete={handleVoyageComplete}
          onCancel={handleCancelVoyage}
        />
      )}

      {screen === 'perfil' && (
        <MiPerfil onBack={() => setScreen('p1')} />
      )}

      {screen === 'biblioteca' && (
        <BibliotecaHome
          onSelectModulo={(id) => { setModuloId(id); setScreen('biblioteca_modulo'); }}
          onBack={() => setScreen('p1')}
        />
      )}

      {screen === 'biblioteca_modulo' && (
        <ModuloView
          moduloId={moduloId}
          onBack={() => setScreen('biblioteca')}
        />
      )}

      {screen === 'reportar' && (
        <ReportarProblema onBack={() => setScreen('p1')} />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <AppProvider>
      <AppFlow />
    </AppProvider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ESTILOS
// ─────────────────────────────────────────────────────────────────────────────
const styles = {
  loading: {
    minHeight: '100vh',
    backgroundColor: '#042C53',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingInner: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
  },
  loadingLogo: {
    fontFamily: 'Arial',
    fontWeight: 800,
    fontSize: 40,
    color: '#fff',
  },
  loadingTagline: {
    fontFamily: 'Arial',
    fontWeight: 600,
    fontSize: 11,
    letterSpacing: 4,
    color: '#F57C00',
  },
  loadingDot: {
    marginTop: 16,
    width: 8,
    height: 8,
    borderRadius: '50%',
    backgroundColor: '#5DCAA5',
    animation: 'pulse 1.2s ease-in-out infinite',
  },
  placeholder: {
    minHeight: '100vh',
    padding: '80px 20px 40px',
    maxWidth: 560,
    margin: '0 auto',
    fontFamily: 'system-ui, sans-serif',
  },
  placeholderTitle: {
    fontSize: 24,
    fontWeight: 700,
    color: '#0A2647',
    margin: '0 0 12px',
  },
  placeholderText: {
    color: '#666',
    fontSize: 15,
    margin: 0,
  },
};
