/**
 * license-rules.js
 * Validador de restricciones de navegación deportiva según DIRECTEMAR
 * TM-002 (D.S. (M) N° 214/2015, mod. D.S. (M) N° 126/2022), Art. 14
 *
 * Tipos de licencia deportiva reconocidos:
 *   PLDB — Patrón de Lancha Deportiva de Bahía (solo a motor)
 *   PDB  — Patrón Deportivo de Bahía (vela y motor)
 *   CDC  — Capitán Deportivo Costero
 *   CDAM — Capitán Deportivo de Alta Mar
 *
 * Tipos de licencia NO deportiva que NO aplican estas reglas:
 *   PNM  — Patrón de Nave Menor
 *   PNMa — Patrón de Nave Mayor
 *   PN   — Capitán de Nave
 */

import {
  estimateDistanceToCoastNM,
  getMaxCoastDistanceOnRoute,
  nauticalMilesToKm,
} from './maritime-geo.js';

// ─── CONSTANTES REGULATORIAS ─────────────────────────────────────────────────

export const LICENSE_TYPES = {
  PLDB: 'PLDB', // Patrón de Lancha Deportiva de Bahía
  PDB:  'PDB',   // Patrón Deportivo de Bahía
  CDC:  'CDC',   // Capitán Deportivo Costero
  CDAM: 'CDAM', // Capitán Deportivo de Alta Mar
};

// Licencias deportivas que activan esta lógica. Solo determina si las
// reglas de este archivo aplican — el ámbito deportivo/comercial de la
// nave se deriva de su uso declarado (§15.3 del spec), no de este set.
export const LICENCIAS_DEPORTIVAS = new Set([
  LICENSE_TYPES.PLDB,
  LICENSE_TYPES.PDB,
  LICENSE_TYPES.CDC,
  LICENSE_TYPES.CDAM,
  'Patrón de Lancha Deportiva de Bahía',
  'Patrón Deportivo de Bahía',
  'Capitán Deportivo Costero',
  'Capitán Deportivo de Alta Mar',
  'patron_lancha_deportiva_bahia',
  'patron_deportivo_bahia',
  'capitan_deportivo_costero',
  'capitan_deportivo_alta_mar',
]);

// Mapeo alias → código interno
const LICENSE_ALIAS_MAP = {
  'Patrón de Lancha Deportiva de Bahía': LICENSE_TYPES.PLDB,
  'Patrón Deportivo de Bahía':      LICENSE_TYPES.PDB,
  'Capitán Deportivo Costero':       LICENSE_TYPES.CDC,
  'Capitán Deportivo de Alta Mar':   LICENSE_TYPES.CDAM,
  'patron_lancha_deportiva_bahia':   LICENSE_TYPES.PLDB,
  'patron_deportivo_bahia':          LICENSE_TYPES.PDB,
  'capitan_deportivo_costero':       LICENSE_TYPES.CDC,
  'capitan_deportivo_alta_mar':      LICENSE_TYPES.CDAM,
  PLDB: LICENSE_TYPES.PLDB,
  PDB:  LICENSE_TYPES.PDB,
  CDC:  LICENSE_TYPES.CDC,
  CDAM: LICENSE_TYPES.CDAM,
};

const MN_60_M           = 111120;  // 60 MN en metros
const MN_12_M           = 22224;   // 12 MN en metros
const CDC_MAX_COAST_NM  = 60;      // TM-002 Art. 14 c — corrige el 12 del reglamento derogado

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
  return LICENCIAS_DEPORTIVAS.has(licenseType);
}

// ─── VALIDADORES ─────────────────────────────────────────────────────────────

/**
 * Valida restricción CDC (Costero).
 * Regla: ningún punto de la ruta puede superar 60 MN de la costa (TM-002 Art. 14 c).
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

  // PLDB y PDB: no existe límite nacional de bahía (TM-002 delega el número
  // en la Autoridad Marítima competente). Sin corte automático de distancia;
  // se muestra la advertencia como único límite práctico (spec §6.2/§14).
  if (licenseCode === LICENSE_TYPES.PLDB || licenseCode === LICENSE_TYPES.PDB) {
    alerts.push({
      code: 'WARNING_RESTRICTION',
      severity: 'warning',
      message: 'El límite de tu zona de bahía lo fija tu Capitanía de Puerto. Verifícalo antes de zarpar.',
      detail: 'No existe un límite nacional vigente para licencias de bahía (TM-002).',
    });
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

// ─── LÍMITE EFECTIVO POR LICENCIA × CLASIFICACIÓN DE NAVE (spec §6.2/§15.4) ──

// Clasificación de la embarcación (Circular D.G.T.M. y M.M. A-41/014) y su
// límite propio de distancia a costa, en metros. null = sin límite propio.
const LIMITE_POR_CLASIFICACION = {
  ALTA_MAR:    null,
  COSTERA_60:  MN_60_M,
  COSTERA_12:  MN_12_M,
  BAHIA_VELA:  null,
  BAHIA_MOTOR: null,
};

/**
 * Límite efectivo de distancia a costa, en metros.
 * Aplica el mínimo entre licencia y clasificación de nave, más el tope de
 * 12 MN por vela sin motor auxiliar operativo (spec §6.2/§15.4).
 *
 * @param {string} licencia — tipo de licencia (alias o código)
 * @param {string} clasificacion — 'ALTA_MAR'|'COSTERA_60'|'COSTERA_12'|'BAHIA_VELA'|'BAHIA_MOTOR'
 * @param {{ propulsion?: string, motor_operativo?: boolean }} nave
 * @returns {number|null} límite en metros, o null si no hay corte aplicable
 */
export function limiteEfectivoM(licencia, clasificacion, nave = {}) {
  const licenciaCodigo = normalizeLicense(licencia) ?? licencia;

  // PLDB, PDB (bahía, sin valor nacional), CDAM (sin límite) y PNM (comercial,
  // sin corte de distancia propio) devuelven null aquí — ver tabla spec §15.4.
  const limiteLicencia = licenciaCodigo === LICENSE_TYPES.CDC ? MN_60_M : null;

  const limiteClasificacion = LIMITE_POR_CLASIFICACION[clasificacion] ?? null;

  const topeVela = nave?.propulsion === 'vela' && !nave?.motor_operativo
    ? MN_12_M
    : null;

  const limites = [limiteLicencia, limiteClasificacion, topeVela].filter((v) => v !== null);
  return limites.length > 0 ? Math.min(...limites) : null;
}

// ─── DERIVACIÓN DE AB DESDE ESLORA (TM-002 Art. 28) ──────────────────────────

// Tabla del Art. 28, embarcaciones deportivas < 24 m. Ordenada ascendente por
// eslora máxima; se usa la primera fila que la eslora declarada no supere.
const TABLA_AB_ESLORA = [
  { esloraMaxM: 8,     ab: 5.0 },
  { esloraMaxM: 10,    ab: 10.0 },
  { esloraMaxM: 12,    ab: 15.0 },
  { esloraMaxM: 13,    ab: 17.5 },
  { esloraMaxM: 15,    ab: 22.3 },
  { esloraMaxM: 16,    ab: 25.0 },
  { esloraMaxM: 18,    ab: 30.5 },
  { esloraMaxM: 20,    ab: 36.5 },
  { esloraMaxM: 22,    ab: 42.5 },
  { esloraMaxM: 23.99, ab: 50.0 },
];

/**
 * Arqueo bruto derivado de la eslora, para embarcaciones deportivas < 24 m
 * (TM-002 Art. 28). Devuelve null fuera de rango — esas naves requieren
 * certificado de arqueo.
 * @param {number} eslora_m
 * @returns {number|null}
 */
export function arqueoBrutoDesdeEslora(eslora_m) {
  if (!eslora_m || eslora_m <= 0) return null;
  const fila = TABLA_AB_ESLORA.find((f) => eslora_m <= f.esloraMaxM);
  return fila ? fila.ab : null;
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
