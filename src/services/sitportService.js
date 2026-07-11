// Servicio para consumir SITPORT API (orion.directemar.cl)
const SITPORT_BASE = 'https://orion.directemar.cl/sitport/back/users';
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutos

const cache = {};

async function fetchSitport(endpoint, payload = {}) {
  const cacheKey = `${endpoint}`;

  // Retornar de cache si existe y no expiró
  if (cache[cacheKey] && Date.now() - cache[cacheKey].timestamp < CACHE_DURATION) {
    return cache[cacheKey].data;
  }

  try {
    const response = await fetch(`${SITPORT_BASE}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error(`SITPORT error: ${response.status}`);
    const data = await response.json();

    // Guardar en cache
    cache[cacheKey] = { data, timestamp: Date.now() };
    return data;
  } catch (error) {
    console.error('SITPORT fetch error:', error);
    throw error;
  }
}

export const sitportService = {
  getRestrictions: () => fetchSitport('consultaRestricciones'),
  getBays: () => fetchSitport('consultaBahias'),
  getZones: () => fetchSitport('consultaZonas'),
  getWeatherForecast: () => fetchSitport('Totalpronostico'),
  getGeneralStatus: () => fetchSitport('Totalgeneral'),
};
