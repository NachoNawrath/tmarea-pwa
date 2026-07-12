import React, { createContext, useState } from 'react';

export const AppContext = createContext();

export function AppProvider({ children }) {
  const [vessel, setVessel] = useState(null);
  const [voyage, setVoyage] = useState(null);
  const [user, setUser] = useState(null);

  return (
    <AppContext.Provider value={{ vessel, setVessel, voyage, setVoyage, user, setUser }}>
      {children}
    </AppContext.Provider>
  );
}
