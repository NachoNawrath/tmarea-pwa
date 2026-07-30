// src/hooks/useStationName.js
import { useEffect, useState } from 'react';
import { getStationName, loadStationNames } from '../utils/tideStations';

// Devuelve el nombre formateado del id de estación de inmediato (fallback
// desde el propio id) y lo actualiza al nombre oficial en cuanto
// /api/tide/stations resuelve, sin bloquear el primer render.
export function useStationName(id) {
  const [name, setName] = useState(() => getStationName(id));

  useEffect(() => {
    let active = true;
    setName(getStationName(id));
    loadStationNames().then(() => {
      if (active) setName(getStationName(id));
    });
    return () => { active = false; };
  }, [id]);

  return name;
}
