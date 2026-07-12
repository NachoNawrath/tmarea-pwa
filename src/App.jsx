import React, { useEffect, useState } from 'react';
import { AppProvider } from './context/AppContext';
import S0Onboarding from './components/screens/S0Onboarding';
import S0_5Registro from './components/screens/S0_5Registro';

function AppFlow() {
  const [hasAcceptedLegal, setHasAcceptedLegal] = useState(false);
  const [hasRegistered, setHasRegistered] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const s0Data = localStorage.getItem('s0_accepted');
    const userProfile = localStorage.getItem('user_profile');
    if (s0Data) {
      setHasAcceptedLegal(true);
    }
    if (userProfile) {
      setHasRegistered(true);
    }
    setLoading(false);
  }, []);

  const handleLegalAccept = () => {
    setHasAcceptedLegal(true);
  };

  const handleRegistroComplete = () => {
    setHasRegistered(true);
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <p>Cargando Tmarea...</p>
    </div>;
  }

  if (!hasAcceptedLegal) {
    return <S0Onboarding onAccept={handleLegalAccept} />;
  }

  if (!hasRegistered) {
    return <S0_5Registro onComplete={handleRegistroComplete} />;
  }

  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h1>Tmarea</h1>
      <p>Bienvenido. S0 (Onboarding Legal) y S0.5 (Registro) completados.</p>
      <p>Próximo: P1 (Perfil de Nave) en desarrollo...</p>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppFlow />
    </AppProvider>
  );
}
