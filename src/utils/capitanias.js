// src/utils/capitanias.js
// Jurisdicción de las Gobernaciones Marítimas de Chile por rango de latitud.
//
// Chile tiene 16 Gobernaciones Marítimas. Cada puerto queda bajo la
// jurisdicción de una de ellas; el patrón necesita saber a qué Gobernación
// llamar para dar el aviso de zarpe / reportar novedades.
//
// Este mapa es una aproximación por FRANJAS DE LATITUD del continente (la costa
// chilena es casi norte-sur), no un polígono de jurisdicción real. Es suficiente
// para orientar la llamada; ante duda, siempre prima lo que indique la Autoridad
// Marítima. Distinto de getNearestCapitania() en maritime-geo.js, que resuelve
// la Capitanía deportiva más cercana por distancia y entrega canales VHF: acá se
// entrega la Gobernación jurisdiccional con su teléfono fijo.

// Rangos ordenados de norte (lat menos negativa) a sur (lat más negativa).
// lat_norte es el borde norte de la franja, lat_sur el borde sur; ambos negativos.
const GOBERNACIONES = [
  { nombre: 'Arica',           lat_norte: -17.5, lat_sur: -19.5, tel: '+56 58 220 6402' },
  { nombre: 'Iquique',         lat_norte: -19.5, lat_sur: -22.0, tel: '+56 57 240 1902' },
  { nombre: 'Antofagasta',     lat_norte: -22.0, lat_sur: -25.5, tel: '+56 55 263 0000' },
  { nombre: 'Caldera',         lat_norte: -25.5, lat_sur: -29.0, tel: '+56 52 231 5276' },
  { nombre: 'Coquimbo',        lat_norte: -29.0, lat_sur: -31.5, tel: '+56 51 255 8100' },
  { nombre: 'Valparaíso',      lat_norte: -31.5, lat_sur: -33.3, tel: '+56 32 220 8905' },
  { nombre: 'San Antonio',     lat_norte: -33.3, lat_sur: -35.5, tel: '+56 35 258 4802' },
  { nombre: 'Talcahuano',      lat_norte: -35.5, lat_sur: -39.0, tel: '+56 41 226 6100' },
  { nombre: 'Valdivia',        lat_norte: -39.0, lat_sur: -41.0, tel: '+56 63 227 6905' },
  { nombre: 'Puerto Montt',    lat_norte: -41.0, lat_sur: -42.0, tel: '+56 65 256 1100' },
  { nombre: 'Castro',          lat_norte: -42.0, lat_sur: -44.0, tel: '+56 65 262 9405' },
  { nombre: 'Aysén',           lat_norte: -44.0, lat_sur: -49.0, tel: '+56 67 233 1405' },
  { nombre: 'Punta Arenas',    lat_norte: -49.0, lat_sur: -54.0, tel: '+56 61 220 1102' },
  { nombre: 'Puerto Williams', lat_norte: -54.0, lat_sur: -56.0, tel: '+56 61 262 4270' },
];

// Isla de Pascua: fuera del rango continental de longitud. Se detecta por lon.
const HANGA_ROA = { nombre: 'Hanga Roa', tel: '+56 32 210 0222' };

/**
 * Devuelve la Gobernación Marítima jurisdiccional de una coordenada.
 * @param {number} lat — latitud (negativa en el hemisferio sur)
 * @param {number} lon — longitud (negativa al oeste)
 * @returns {{ nombre: string, telefono: string, direccion: string|null } | null}
 *          null si la latitud queda fuera de todos los rangos conocidos.
 */
export function getCapitania(lat, lon) {
  if (lat == null || isNaN(lat)) return null;

  // Isla de Pascua / territorio insular oceánico (lon muy al oeste).
  if (lon != null && !isNaN(lon) && lon < -100) {
    return { nombre: HANGA_ROA.nombre, telefono: HANGA_ROA.tel, direccion: null };
  }

  // La franja contiene la latitud si está entre su borde sur y su borde norte.
  const match = GOBERNACIONES.find((g) => lat <= g.lat_norte && lat > g.lat_sur);
  if (!match) return null;

  return { nombre: match.nombre, telefono: match.tel, direccion: null };
}

export { GOBERNACIONES };
