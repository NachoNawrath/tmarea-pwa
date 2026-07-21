// src/hooks/useRutasAustrales.js
// Tmarea — Hook para cargar rutas náuticas del corredor austral

import { useState, useEffect, useRef } from 'react';

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min (datos estáticos, no cambian frecuente)
let _memCache = null;
let _cacheTs  = 0;

export function useRutasAustrales() {
  const [rutas,      setRutas]      = useState([]);
  const [estaciones, setEstaciones] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    async function fetchRutas() {
      // Usar caché en memoria si está vigente
      if (_memCache && Date.now() - _cacheTs < CACHE_TTL_MS) {
        if (mountedRef.current) {
          setRutas(_memCache.rutas);
          setEstaciones(_memCache.estaciones);
          setLoading(false);
        }
        return;
      }

      try {
        const [resRutas, resEstaciones] = await Promise.all([
          fetch(`${import.meta.env.VITE_API_URL}/api/rutas`),
          fetch(`${import.meta.env.VITE_API_URL}/api/rutas/estaciones`),
        ]);

        if (!resRutas.ok || !resEstaciones.ok) {
          throw new Error('Error cargando rutas náuticas');
        }

        const [dataRutas, dataEstaciones] = await Promise.all([
          resRutas.json(),
          resEstaciones.json(),
        ]);

        const result = {
          rutas:      dataRutas.data      || [],
          estaciones: dataEstaciones.data || [],
        };

        // Guardar en caché
        _memCache = result;
        _cacheTs  = Date.now();

        if (mountedRef.current) {
          setRutas(result.rutas);
          setEstaciones(result.estaciones);
          setLoading(false);
        }
      } catch (err) {
        console.error('[useRutasAustrales]', err.message);
        if (mountedRef.current) {
          setError(err.message);
          setLoading(false);
        }
      }
    }

    fetchRutas();
    return () => { mountedRef.current = false; };
  }, []);

  return { rutas, estaciones, loading, error };
}
