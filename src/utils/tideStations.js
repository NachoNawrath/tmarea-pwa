// src/utils/tideStations.js
// GET /api/tide/predict y /api/tide/curve solo devuelven `station_used` (id,
// ej. "puerto_montt") — el nombre legible vive en /api/tide/stations. Se
// resuelve acá con una caché de módulo (una sola llamada por sesión) en vez
// de pedir el listado completo en cada bloque que necesita mostrar el nombre.
const BACKEND_URL = 'http://localhost:3000';

let namesById = null;
let fetchPromise = null;

function fallbackName(id) {
  if (!id) return null;
  return id
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function getStationName(id) {
  if (!id) return null;
  return (namesById && namesById[id]) || fallbackName(id);
}

export function loadStationNames() {
  if (namesById) return Promise.resolve(namesById);
  if (fetchPromise) return fetchPromise;

  fetchPromise = fetch(`${BACKEND_URL}/api/tide/stations`)
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      const map = {};
      (data?.stations || []).forEach((s) => { map[s.id] = s.name; });
      namesById = map;
      return namesById;
    })
    .catch(() => {
      namesById = {};
      return namesById;
    });

  return fetchPromise;
}
