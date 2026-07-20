/**
 * license-rules.js
 * Validador de restricciones de navegación deportiva según DIRECTEMAR
 * Arts. 51-54 Reglamento General de Deportes Náuticos
 *
 * Tipos de licencia deportiva reconocidos:
 *   PDB  — Patrón Deportivo de Bahía
 *   CDC  — Capitán Deportivo Costero
 *   CDAM — Capitán Deportivo de Alta Mar
 *
 * Tipos de licencia NO deportiva que NO aplican estas reglas:
 *   PNM  — Patrón de Nave Menor
 *   PNMa — Patrón de Nave Mayor
 *   PN   — Capitán de Nave
 */

import {
  haversineKm,
  estimateDistanceToCoastNM,
  getMaxCoastDistanceOnRoute,
  nauticalMilesToKm,
} from './maritime-geo.js';

// ─── CONSTANTES REGULATORIAS ─────────────────────────────────────────────────

export const LICENSE_TYPES = {
  PDB:  'PDB',   // Patrón Deportivo de Bahía
  CDC:  'CDC',   // Capitán Deportivo Costero
  CDAM: 'CDAM', // Capitán Deportivo de Alta Mar
};

// Licencias deportivas que activan esta lógica
const SPORT_LICENSE_SET = new Set([
  LICENSE_TYPES.PDB,
  LICENSE_TYPES.CDC,
  LICENSE_TYPES.CDAM,
  'Patrón Deportivo de Bahía',
  'Capitán Deportivo Costero',
  'Capitán Deportivo de Alta Mar',
  'patron_deportivo_bahia',
  'capitan_deportivo_costero',
  'capitan_deportivo_alta_mar',
]);

// Mapeo alias → código interno
const LICENSE_ALIAS_MAP = {
  'Patrón Deportivo de Bahía':      LICENSE_TYPES.PDB,
  'Capitán Deportivo Costero':       LICENSE_TYPES.CDC,
  'Capitán Deportivo de Alta Mar':   LICENSE_TYPES.CDAM,
  'patron_deportivo_bahia':          LICENSE_TYPES.PDB,
  'capitan_deportivo_costero':       LICENSE_TYPES.CDC,
  'capitan_deportivo_alta_mar':      LICENSE_TYPES.CDAM,
  PDB:  LICENSE_TYPES.PDB,
  CDC:  LICENSE_TYPES.CDC,
  CDAM: LICENSE_TYPES.CDAM,
};

const PDB_MAX_DISTANCE_NM  = 2;    // 2 MN desde puerto de zarpe
const CDC_MAX_COAST_NM     = 12;   // 12 MN desde la costa

// ─── HELPERS ─────────────────────────────────────────────────────────────────

/**
 * Normaliza el tipo de licencia al código interno (PDB / CDC / CDAM).
 * @param {string} licenseType
 * @returns {string|null}
 */
export function normalizeLicense(licenseType) {
  return LICENSE_ALIAS_MAP[licenseType] ?? null;
}

/**
 * Indica si el tipo de licencia del usuario es deportivo.
 * @param {string} licenseType
 * @returns {boolean}
 */
export function isSportLicense(licenseType) {
  return SPORT_LICENSE_SET.has(licenseType);
}

// ─── VALIDADORES ─────────────────────────────────────────────────────────────

/**
 * Valida restricción PDB (Patrón de Bahía).
 * Regla: no puede alejarse más de 2 MN del puerto de zarpe.
 *
 * @param {{ lat: number, lng: number }} origin — coordenadas del zarpe
 * @param {{ lat: number, lng: number }} destination — coordenadas del destino
 * @param {Array<{lat,lng}>} waypoints — puntos intermedios (opcional)
 * @returns {{ violation: boolean, distanceKm: number, distanceNM: number, message: string|null }}
 */
function validatePDB(origin, destination, waypoints = []) {
  const allPoints = [destination, ...waypoints];
  let maxDistKm = 0;

  for (const pt of allPoints) {
    const d = haversineKm(origin.lat, origin.lng, pt.lat, pt.lng);
    if (d > maxDistKm) maxDistKm = d;
  }

  const maxDistNM = maxDistKm / 1.852;
  const violation = maxDistNM > PDB_MAX_DISTANCE_NM;

  return {
    violation,
    distanceKm: Math.round(maxDistKm * 10) / 10,
    distanceNM: Math.round(maxDistNM * 10) / 10,
    message: violation
      ? `Tu ruta alcanza ${maxDistNM.toFixed(1)} MN desde el zarpe. Tu licencia PDB autoriza hasta ${PDB_MAX_DISTANCE_NM} MN dentro de la bahía.`
      : null,
  };
}

/**
 * Valida restricción CDC (Costero).
 * Regla: ningún punto de la ruta puede superar 12 MN de la costa.
 *
 * @param {{ lat: number, lng: number }} destination
 * @param {Array<{lat,lng}>} waypoints
 * @returns {{ violation: boolean, maxDistNM: number, message: string|null }}
 */
function validateCDC(destination, waypoints = []) {
  const allPoints = [destination, ...waypoints];
  const { maxDistNM } = getMaxCoastDistanceOnRoute(allPoints);
  const violation = maxDistNM > CDC_MAX_COAST_NM;

  return {
    violation,
    maxDistNM: Math.round(maxDistNM * 10) / 10,
    message: violation
      ? `Tu ruta se aleja ${maxDistNM.toFixed(1)} MN de la costa. Tu licencia CDC solo permite navegar hasta ${CDC_MAX_COAST_NM} MN de la costa.`
      : null,
  };
}

// ─── FUNCIÓN PRINCIPAL ───────────────────────────────────────────────────────

/**
 * Valida si un viaje es legal según el tipo de licencia del usuario.
 *
 * @param {string} licenseType — tipo de licencia (alias o código)
 * @param {{ lat: number, lng: number }} origin
 * @param {{ lat: number, lng: number }} destination
 * @param {Array<{lat,lng}>} waypoints — puntos intermedios (vacío si ruta directa)
 * @returns {{
 *   licenseCode: string,
 *   isSport: boolean,
 *   hasViolation: boolean,
 *   severity: 'none' | 'warning' | 'illegal',
 *   alerts: Array<{ code: string, severity: string, message: string }>
 * }}
 */
export function validateLicenseRoute(licenseType, origin, destination, waypoints = []) {
  const licenseCode = normalizeLicense(licenseType);
  const isSport = isSportLicense(licenseType);

  // Si no es perfil deportivo, no aplican estas reglas
  if (!isSport || !licenseCode) {
    return {
      licenseCode: licenseCode ?? licenseType,
      isSport: false,
      hasViolation: false,
      severity: 'none',
      alerts: [],
    };
  }

  // CDAM — sin restricciones geográficas
  if (licenseCode === LICENSE_TYPES.CDAM) {
    return {
      licenseCode,
      isSport: true,
      hasViolation: false,
      severity: 'none',
      alerts: [],
    };
  }

  const alerts = [];

  if (licenseCode === LICENSE_TYPES.PDB) {
    const result = validatePDB(origin, destination, waypoints);
    if (result.violation) {
      alerts.push({
        code: 'WARNING_RESTRICTION',
        severity: 'warning',
        message: result.message,
        detail: `Distancia máxima detectada: ${result.distanceNM} MN`,
      });
    }
  }

  if (licenseCode === LICENSE_TYPES.CDC) {
    const result = validateCDC(destination, waypoints);
    if (result.violation) {
      alerts.push({
        code: 'ALERT_ILLEGAL_ZONE',
        severity: 'illegal',
        message: result.message,
        detail: `Máxima distancia a costa: ${result.maxDistNM} MN`,
      });
    }
  }

  const hasViolation = alerts.length > 0;
  const severity = alerts.some((a) => a.severity === 'illegal')
    ? 'illegal'
    : alerts.length > 0
    ? 'warning'
    : 'none';

  return { licenseCode, isSport: true, hasViolation, severity, alerts };
}

// ─── CHECKLIST DE EQUIPAMIENTO ───────────────────────────────────────────────

/**
 * Items del checklist de seguridad obligatorio (DIRECTEMAR, naves menores deportivas).
 * Estructura lista para renderizar en React con useState.
 */
export const SAFETY_CHECKLIST_ITEMS = [
  {
    id: 'life_jackets',
    label: 'Chalecos Salvavidas',
    detail: 'Aprobados por DIRECTEMAR, 1 por tripulante.',
    required: true,
  },
  {
    id: 'vhf_radio',
    label: 'Equipo de Comunicaciones',
    detail: 'Radio VHF fija o portátil en banda marina.',
    required: true,
  },
  {
    id: 'flares',
    label: 'Señales de Auxilio',
    detail: 'Mínimo 3 bengalas de mano vigentes.',
    required: true,
  },
  {
    id: 'bilge_pump',
    label: 'Sistema de Achique',
    detail: 'Bomba de achique manual/eléctrica o balde.',
    required: true,
  },
  {
    id: 'documents',
    label: 'Documentación a Bordo',
    detail: 'Matrícula de la nave y Licencia Deportiva vigente del Patrón.',
    required: true,
  },
];
