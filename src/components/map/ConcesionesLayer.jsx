import { useEffect, useRef, useState } from 'react';

const API_BASE = 'http://localhost:3000';

// ─────────────────────────────────────────────
//  Colores y emojis por grupo
// ─────────────────────────────────────────────
const GRUPO_CONFIG = {
  'MOLUSCOS':               { color: '#4A90D9', emoji: '🦪', label: 'Moluscos' },
  'SALMONES':               { color: '#E74C3C', emoji: '🐟', label: 'Salmones' },
  'ALGAS':                  { color: '#27AE60', emoji: '🌿', label: 'Algas' },
  'PECES':                  { color: '#F39C12', emoji: '🐠', label: 'Peces' },
  'ABALONES o EQUINODERMOS':{ color: '#8E44AD', emoji: '🐚', label: 'Abalones' },
};
const DEFAULT_COLOR = '#0077B6';

// ─────────────────────────────────────────────
//  Hook de carga por grupo
// ─────────────────────────────────────────────
function useConcesiones(grupos, bbox) {
  const [data, setData]       = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  useEffect(() => {
    if (!bbox || grupos.length === 0) return;
    let cancelled = false;
    setLoading(true);

    const { lat1, lng1, lat2, lng2 } = bbox;
    const centerLat = (lat1 + lat2) / 2;
    const centerLng = (lng1 + lng2) / 2;
    const radioKm   = 150;

    Promise.all(
      grupos.map(grupo =>
        fetch(`${API_BASE}/api/concesiones/proximidad?lat=${centerLat}&lng=${centerLng}&radio=${radioKm}&grupo=${encodeURIComponent(grupo)}`)
          .then(r => r.json())
          .then(j => ({ grupo, features: j.data || [] }))
          .catch(() => ({ grupo, features: [] }))
      )
    ).then(results => {
      if (cancelled) return;
      const byGrupo = {};
      for (const { grupo, features } of results) byGrupo[grupo] = features;
      setData(byGrupo);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [grupos.join(','), bbox?.lat1]);

  return { data, loading, error };
}

// ─────────────────────────────────────────────
//  Componente principal
// ─────────────────────────────────────────────
export function ConcesionesLayer({ map, bbox, gruposVisibles = Object.keys(GRUPO_CONFIG) }) {
  const addedRef  = useRef(false);
  const popupsRef = useRef([]);
  const { data, loading } = useConcesiones(gruposVisibles, bbox);

  useEffect(() => {
    if (!map || loading || Object.keys(data).length === 0) return;
    if (addedRef.current) {
      // Actualizar datos existentes
      for (const grupo of gruposVisibles) {
        const sourceId = `concesiones-${grupo.replace(/\s+/g, '-')}`;
        const source = map.getSource(sourceId);
        if (source) source.setData(buildGeoJSON(grupo, data[grupo] || []));
      }
      return;
    }

    addedRef.current = true;

    for (const grupo of Object.keys(GRUPO_CONFIG)) {
      const safeId  = grupo.replace(/\s+/g, '-');
      const sourceId = `concesiones-${safeId}`;
      const layerId  = `concesiones-layer-${safeId}`;
      const cfg      = GRUPO_CONFIG[grupo];
      const features = data[grupo] || [];

      if (features.length === 0) continue;

      map.addSource(sourceId, {
        type: 'geojson',
        data: buildGeoJSON(grupo, features),
      });

      map.addLayer({
        id: layerId,
        type: 'circle',
        source: sourceId,
        layout: { visibility: gruposVisibles.includes(grupo) ? 'visible' : 'none' },
        paint: {
          'circle-radius': 5,
          'circle-color': cfg.color,
          'circle-opacity': 0.75,
          'circle-stroke-width': 1,
          'circle-stroke-color': '#ffffff',
        },
      });

      // Popup al click
      map.on('click', layerId, e => {
        const props = e.features[0].properties;
        const cfg2  = GRUPO_CONFIG[props.grupo] || {};
        const popup = new window.maplibregl.Popup({ closeButton: true, maxWidth: '280px' })
          .setLngLat(e.lngLat)
          .setHTML(`
            <div style="font-family:sans-serif;font-size:13px;line-height:1.5">
              <div style="font-weight:700;margin-bottom:4px">${cfg2.emoji || ''} ${props.grupo}</div>
              <div><b>Titular:</b> ${props.titular || '—'}</div>
              <div><b>Especies:</b> ${props.especies || '—'}</div>
              <div><b>Ubicación:</b> ${props.ubicacion_nombre || '—'}</div>
              <div><b>Comuna:</b> ${props.comuna || '—'}</div>
              <div><b>Superficie:</b> ${props.superficie_ha ? props.superficie_ha + ' ha' : '—'}</div>
              <div><b>Estado:</b> ${props.estado_tramite || '—'}</div>
            </div>
          `)
          .addTo(map);
        popupsRef.current.push(popup);
      });

      map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = ''; });
    }

    return () => {
      popupsRef.current.forEach(p => p.remove());
      popupsRef.current = [];
    };
  }, [map, loading, data]);

  // Togglear visibilidad cuando cambia gruposVisibles
  useEffect(() => {
    if (!map || !addedRef.current) return;
    for (const grupo of Object.keys(GRUPO_CONFIG)) {
      const layerId = `concesiones-layer-${grupo.replace(/\s+/g, '-')}`;
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility',
          gruposVisibles.includes(grupo) ? 'visible' : 'none'
        );
      }
    }
  }, [map, gruposVisibles]);

  return null;
}

function buildGeoJSON(grupo, features) {
  return {
    type: 'FeatureCollection',
    features: features.map(f => ({
      type: 'Feature',
      properties: {
        id:               f.id,
        titular:          f.titular,
        especies:         f.especies,
        grupo:            f.grupo,
        ubicacion_nombre: f.ubicacion_nombre,
        estado_tramite:   f.estado_tramite,
        superficie_ha:    f.superficie_ha,
        comuna:           f.comuna,
        region:           f.region,
      },
      geometry: { type: 'Point', coordinates: [f.lng, f.lat] },
    })),
  };
}

// ─────────────────────────────────────────────
//  Panel de control de capas (toggle por grupo)
// ─────────────────────────────────────────────
export function ConcesionesControl({ gruposVisibles, onToggle }) {
  return (
    <div style={{
      position: 'absolute', bottom: 80, right: 12,
      background: 'rgba(0,0,0,0.75)', borderRadius: 10,
      padding: '8px 12px', color: '#fff', fontSize: 12,
      display: 'flex', flexDirection: 'column', gap: 6, zIndex: 10,
    }}>
      <div style={{ fontWeight: 700, marginBottom: 2, fontSize: 11, opacity: 0.7 }}>CONCESIONES</div>
      {Object.entries(GRUPO_CONFIG).map(([grupo, cfg]) => (
        <label key={grupo} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={gruposVisibles.includes(grupo)}
            onChange={() => onToggle(grupo)}
            style={{ accentColor: cfg.color }}
          />
          <span style={{ color: cfg.color }}>{cfg.emoji}</span>
          <span>{cfg.label}</span>
        </label>
      ))}
    </div>
  );
}

export { GRUPO_CONFIG };
