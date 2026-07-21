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

// ─────────────────────────────────────────────────────────────────────────────
// PANTALLAS DEL FLUJO
// s0_onboarding → s0_registro → p1 → p2 → p3 → p4
// ─────────────────────────────────────────────────────────────────────────────

function AppFlow() {
  const [screen, setScreen]         = useState('loading');
  const [voyageData, setVoyageData] = useState(null);  // P2 → P3 → P4
  const [reportData, setReportData] = useState(null);  // P4 → informe

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

  // P4 → cierre: viaje terminado, guardar datos para informe
  const handleVoyageComplete = (closingData) => {
    // Fusionar voyageData (setup) con closingData (datos reales al llegar)
    setReportData({ ...voyageData, ...closingData });
    setScreen('p2'); // volver a inicio para nuevo viaje
  };

  // P4 → P2: cancelar viaje en curso
  const handleCancelVoyage = () => {
    setVoyageData(null);
    setScreen('p2');
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

  if (screen === 's0_onboarding') {
    return <S0Onboarding onAccept={handleLegalAccept} />;
  }

  if (screen === 's0_registro') {
    return <S0_5Registro onComplete={handleRegistroComplete} />;
  }

  if (screen === 'p1') {
    return (
      <P1_VesselProfile
        onComplete={handleP1Complete}
      />
    );
  }

  if (screen === 'p2') {
    return (
      <P2_VoyageSetup
        onComplete={handleP2Complete}
        onEditProfile={() => setScreen('p1')}
      />
    );
  }

  if (screen === 'p3') {
    return (
      <VoyageVerification
        voyageData={voyageData}
        onStartVoyage={handleStartVoyage}
        onBack={handleBackToP2}
      />
    );
  }

  if (screen === 'p4') {
    return (
      <P4_ActiveVoyage
        voyageData={voyageData}
        onVoyageComplete={handleVoyageComplete}
        onCancel={handleCancelVoyage}
      />
    );
  }

  // Fallback
  return (
    <div style={styles.loading}>
      <p style={{ color: '#fff', fontFamily: 'Arial' }}>
        Estado desconocido: {screen}
      </p>
    </div>
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
};
