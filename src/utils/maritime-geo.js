/**
 * maritime-geo.js
 * Utilidades de geolocalización para Tmarea - Perfil Deportivo
 * Fórmula de Haversine + detección de Capitanía + validación de costa
 */

const EARTH_RADIUS_KM = 6371;
const NM_TO_KM = 1.852;

// ─── HAVERSINE BASE ──────────────────────────────────────────────────────────

/**
 * Calcula distancia en km entre dos puntos geográficos.
 * @param {number} lat1
 * @param {number} lng1
 * @param {number} lat2
 * @param {number} lng2
 * @returns {number} distancia en km
 */
export function haversineKm(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Convierte km a millas náuticas.
 * @param {number} km
 * @returns {number}
 */
export function kmToNauticalMiles(km) {
  return km / NM_TO_KM;
}

/**
 * Convierte millas náuticas a km.
 * @param {number} nm
 * @returns {number}
 */
export function nauticalMilesToKm(nm) {
  return nm * NM_TO_KM;
}

// ─── CAPITANÍAS ──────────────────────────────────────────────────────────────

/**
 * Retorna la capitanía más cercana a una coordenada dada.
 * @param {number} lat
 * @param {number} lng
 * @param {Array} capitanias - array de maritime_data.json
 * @returns {{ capitania: object, distanceKm: number }}
 */
export function getNearestCapitania(lat, lng, capitanias) {
  if (!capitanias?.length) return null;

  let nearest = null;
  let minDist = Infinity;

  for (const cap of capitanias) {
    const dist = haversineKm(lat, lng, cap.lat, cap.lng);
    if (dist < minDist) {
      minDist = dist;
      nearest = cap;
    }
  }

  return { capitania: nearest, distanceKm: minDist };
}

/**
 * Retorna la capitanía cuya jurisdicción (radius_km) contiene la coordenada dada.
 * Si ninguna la contiene, retorna la más cercana como fallback.
 * @param {number} lat
 * @param {number} lng
 * @param {Array} capitanias
 * @returns {{ capitania: object, distanceKm: number, isWithinJurisdiction: boolean }}
 */
export function getActiveCapitania(lat, lng, capitanias) {
  if (!capitanias?.length) return null;

  let activeMatch = null;
  let minDistInside = Infinity;

  for (const cap of capitanias) {
    const dist = haversineKm(lat, lng, cap.lat, cap.lng);
    if (dist <= cap.radius_km && dist < minDistInside) {
      minDistInside = dist;
      activeMatch = { capitania: cap, distanceKm: dist, isWithinJurisdiction: true };
    }
  }

  if (activeMatch) return activeMatch;

  // Fallback: la más cercana aunque no esté dentro del radio
  const { capitania, distanceKm } = getNearestCapitania(lat, lng, capitanias);
  return { capitania, distanceKm, isWithinJurisdiction: false };
}

// ─── DISTANCIA A LA COSTA ────────────────────────────────────────────────────

/**
 * Estima distancia a la costa usando una línea de puntos costeros de Chile.
 * Para MVP: aproximación por puntos costeros de referencia.
 * En producción reemplazar con GeoJSON oficial de SHOA/IGM.
 *
 * @param {number} lat
 * @param {number} lng
 * @returns {number} distancia estimada en millas náuticas
 */
export function estimateDistanceToCoastNM(lat, lng) {
  // Puntos costeros de referencia Chile (lat, lng) — costa principal
  // Cobertura: Arica a Punta Arenas, ~cada 30-50km de costa
  const COAST_REFERENCE_POINTS = [
    [-18.48, -70.32], // Arica
    [-20.21, -70.15], // Iquique
    [-23.65, -70.40], // Antofagasta
    [-27.37, -70.65], // Caldera
    [-29.96, -71.34], // La Serena
    [-32.78, -71.52], // Quintero
    [-33.02, -71.63], // Valparaíso
    [-33.36, -71.66], // Algarrobo
    [-33.61, -71.64], // San Antonio
    [-35.43, -72.36], // Constitución
    [-36.62, -72.97], // Tomé
    [-37.03, -73.16], // Talcahuano
    [-38.74, -73.58], // Lebu
    [-39.85, -73.70], // Valdivia (boca)
    [-40.57, -73.92], // San Carlos de Osorno (aprox)
    [-41.47, -72.94], // Puerto Montt
    [-41.86, -73.96], // Ancud
    [-42.48, -73.76], // Castro
    [-43.70, -74.06], // Quellón
    [-45.57, -72.70], // Puerto Aysén
    [-51.73, -72.52], // Punta Arenas
  ];

  let minDistKm = Infinity;
  for (const [cLat, cLng] of COAST_REFERENCE_POINTS) {
    const d = haversineKm(lat, lng, cLat, cLng);
    if (d < minDistKm) minDistKm = d;
  }

  return kmToNauticalMiles(minDistKm);
}

// ─── ANÁLISIS DE RUTA ────────────────────────────────────────────────────────

/**
 * Analiza si un destino activa modo CIRCULAR (mismo origen).
 * Umbral: < 0.5 km de diferencia.
 * @param {{ lat, lng }} origin
 * @param {{ lat, lng }} destination
 * @returns {boolean}
 */
export function isCircularRoute(origin, destination) {
  if (!origin || !destination) return false;
  return haversineKm(origin.lat, origin.lng, destination.lat, destination.lng) < 0.5;
}

/**
 * Calcula la distancia total de una ruta por puntos (array de {lat, lng}).
 * @param {Array<{lat: number, lng: number}>} waypoints
 * @returns {number} distancia total en km
 */
export function routeTotalKm(waypoints) {
  if (!waypoints || waypoints.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    total += haversineKm(
      waypoints[i].lat, waypoints[i].lng,
      waypoints[i + 1].lat, waypoints[i + 1].lng
    );
  }
  return total;
}

/**
 * Retorna el peor punto de la ruta respecto a distancia a la costa.
 * Útil para validar licencia CDC (12 MN).
 * @param {Array<{lat: number, lng: number}>} waypoints
 * @returns {{ worstPoint: object, maxDistNM: number }}
 */
export function getMaxCoastDistanceOnRoute(waypoints) {
  if (!waypoints?.length) return { worstPoint: null, maxDistNM: 0 };

  let maxDistNM = 0;
  let worstPoint = null;

  for (const wp of waypoints) {
    const distNM = estimateDistanceToCoastNM(wp.lat, wp.lng);
    if (distNM > maxDistNM) {
      maxDistNM = distNM;
      worstPoint = wp;
    }
  }

  return { worstPoint, maxDistNM };
}
