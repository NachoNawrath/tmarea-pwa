import React, { useEffect, useState } from 'react';
import { AppProvider } from './context/AppContext';
import S0Onboarding from './components/screens/S0Onboarding';

export default function App() {
  const [hasAcceptedLegal, setHasAcceptedLegal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const s0Data = localStorage.getItem('s0_accepted');
    if (s0Data) {
      setHasAcceptedLegal(true);
    }
    setLoading(false);
  }, []);

  const handleLegalAccept = () => {
    setHasAcceptedLegal(true);
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <p>Cargando Tmarea...</p>
    </div>;
  }

  if (!hasAcceptedLegal) {
    return <S0Onboarding onAccept={handleLegalAccept} />;
  }

  return (
    <AppProvider>
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h1>Tmarea</h1>
        <p>Bienvenido. S0 (Onboarding Legal) completado.</p>
        <p>Próximo: P1 (Perfil de Nave) en desarrollo...</p>
      </div>
    </AppProvider>
  );
}
