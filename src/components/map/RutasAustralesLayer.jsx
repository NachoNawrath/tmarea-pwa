// src/components/map/RutasAustralesLayer.jsx
// Tmarea — Capa de rutas náuticas australes sobre MapLibre GL JS
// Dibuja líneas de ruta + markers de estaciones de prácticos

import { useEffect, useRef } from 'react';
import { useRutasAustrales } from '../../hooks/useRutasAustrales';

// Colores por área geográfica (paleta Tmarea)
const AREA_COLOR = {
  chiloe_aysen: '#0077B6',  // azul Tmarea
  patagonica:   '#00B4D8',  // celeste
  fueguina:     '#90E0EF',  // azul claro
};

const DEFAULT_COLOR = '#0077B6';

export function RutasAustralesLayer({ map, visible = true }) {
  const { rutas, estaciones, loading, error } = useRutasAustrales();
  const addedRef = useRef(false);
  const popupsRef = useRef([]);

  useEffect(() => {
    if (!map || loading || error || rutas.length === 0) return;
    if (addedRef.current) return; // ya añadidas

    // ── 1. GeoJSON de líneas (rutas con ≥ 2 waypoints) ──────────────────
    const lineFeatures = rutas
      .filter(r => r.waypoints && r.waypoints.length >= 2)
      .map(r => ({
        type: 'Feature',
        properties: {
          id:                   r.id,
          nombre:               r.nombre,
          art45:                r.art45,
          area:                 r.area,
          pilotaje_obligatorio: r.pilotaje_obligatorio,
          notas:                r.notas,
          color:                AREA_COLOR[r.area] || DEFAULT_COLOR,
        },
        geometry: {
          type: 'LineString',
          coordinates: r.waypoints.map(w => [w.lon, w.lat]),
        },
      }));

    // ── 2. GeoJSON de estaciones de prácticos ────────────────────────────
    const stationFeatures = estaciones.map(e => ({
      type: 'Feature',
      properties: {
        id:     e.id,
        nombre: e.nombre,
        ref:    e.ref,
        grupo:  e.grupo,
      },
      geometry: {
        type: 'Point',
        coordinates: [e.lon, e.lat],
      },
    }));

    // ── 3. GeoJSON de waypoints intermedios ──────────────────────────────
    const waypointFeatures = [];
    rutas.forEach(r => {
      r.waypoints.forEach(w => {
        waypointFeatures.push({
          type: 'Feature',
          properties: { nombre: w.nombre, ruta: r.nombre },
          geometry: {
            type: 'Point',
            coordinates: [w.lon, w.lat],
          },
        });
      });
    });

    // ── Añadir fuentes ────────────────────────────────────────────────────
    if (!map.getSource('rutas-australes-lines')) {
      map.addSource('rutas-australes-lines', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: lineFeatures },
      });
    }

    if (!map.getSource('rutas-australes-stations')) {
      map.addSource('rutas-australes-stations', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: stationFeatures },
      });
    }

    if (!map.getSource('rutas-australes-waypoints')) {
      map.addSource('rutas-australes-waypoints', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: waypointFeatures },
      });
    }

    // ── Añadir capas ──────────────────────────────────────────────────────

    // Líneas de ruta (halo blanco + línea de color)
    if (!map.getLayer('rutas-halo')) {
      map.addLayer({
        id:     'rutas-halo',
        type:   'line',
        source: 'rutas-australes-lines',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#ffffff',
          'line-width': 4,
          'line-opacity': 0.6,
        },
      });
    }

    if (!map.getLayer('rutas-lineas')) {
      map.addLayer({
        id:     'rutas-lineas',
        type:   'line',
        source: 'rutas-australes-lines',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 2.5,
          'line-dasharray': [4, 2],
          'line-opacity': 0.85,
        },
      });
    }

    // Waypoints intermedios — círculos pequeños
    if (!map.getLayer('rutas-waypoints')) {
      map.addLayer({
        id:     'rutas-waypoints',
        type:   'circle',
        source: 'rutas-australes-waypoints',
        paint: {
          'circle-radius': 3,
          'circle-color':  '#ffffff',
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#0077B6',
          'circle-opacity': 0.8,
        },
      });
    }

    // Estaciones de prácticos — círculos más visibles
    if (!map.getLayer('rutas-estaciones')) {
      map.addLayer({
        id:     'rutas-estaciones',
        type:   'circle',
        source: 'rutas-australes-stations',
        paint: {
          'circle-radius': 7,
          'circle-color':  '#FF6B35',  // naranja para destacar
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.9,
        },
      });
    }

    // Labels de estaciones (solo zoom ≥ 10)
    if (!map.getLayer('rutas-estaciones-labels')) {
      map.addLayer({
        id:     'rutas-estaciones-labels',
        type:   'symbol',
        source: 'rutas-australes-stations',
        minzoom: 10,
        layout: {
          'text-field':  ['get', 'nombre'],
          'text-font':   ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-size':   11,
          'text-offset': [0, 1.5],
          'text-anchor': 'top',
        },
        paint: {
          'text-color':       '#023E8A',
          'text-halo-color':  '#ffffff',
          'text-halo-width':  1.5,
        },
      });
    }

    // ── Popups en click sobre líneas ──────────────────────────────────────
    const handleLineClick = (e) => {
      if (!e.features || e.features.length === 0) return;
      const f = e.features[0].properties;

      const popupEl = document.createElement('div');
      popupEl.innerHTML = `
        <div style="font-family:sans-serif;font-size:13px;max-width:220px;padding:4px">
          <strong style="color:#023E8A">${f.nombre}</strong><br/>
          <span style="color:#666;font-size:11px">Art. 45 literal ${f.art45?.toUpperCase()}</span><br/>
          <span style="font-size:11px">${f.notas || ''}</span>
          ${f.pilotaje_obligatorio
            ? '<br/><span style="background:#FF6B35;color:#fff;padding:2px 6px;border-radius:3px;font-size:10px;margin-top:4px;display:inline-block">Pilotaje obligatorio (nave mayor)</span>'
            : '<br/><span style="background:#0077B6;color:#fff;padding:2px 6px;border-radius:3px;font-size:10px;margin-top:4px;display:inline-block">Referencia de seguridad</span>'
          }
        </div>
      `;

      // Importar maplibre-gl dinámicamente para crear Popup sin import circular
      import('maplibre-gl').then(({ Popup }) => {
        const popup = new Popup({ closeButton: true, maxWidth: '260px' })
          .setLngLat(e.lngLat)
          .setDOMContent(popupEl)
          .addTo(map);
        popupsRef.current.push(popup);
      });
    };

    const handleStationClick = (e) => {
      if (!e.features || e.features.length === 0) return;
      const f = e.features[0].properties;

      import('maplibre-gl').then(({ Popup }) => {
        const popup = new Popup({ closeButton: true, maxWidth: '240px' })
          .setLngLat(e.lngLat)
          .setHTML(`
            <div style="font-family:sans-serif;font-size:13px;padding:4px">
              <strong style="color:#023E8A">⚓ ${f.nombre}</strong><br/>
              <span style="font-size:11px;color:#555">${f.ref || ''}</span>
            </div>
          `)
          .addTo(map);
        popupsRef.current.push(popup);
      });
    };

    map.on('click', 'rutas-lineas',    handleLineClick);
    map.on('click', 'rutas-estaciones', handleStationClick);

    // Cursor pointer al hover
    map.on('mouseenter', 'rutas-lineas',    () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'rutas-lineas',    () => { map.getCanvas().style.cursor = ''; });
    map.on('mouseenter', 'rutas-estaciones', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'rutas-estaciones', () => { map.getCanvas().style.cursor = ''; });

    addedRef.current = true;

    // ── Cleanup ───────────────────────────────────────────────────────────
    return () => {
      popupsRef.current.forEach(p => p.remove());
      popupsRef.current = [];

      ['rutas-estaciones-labels','rutas-estaciones','rutas-waypoints','rutas-lineas','rutas-halo'].forEach(id => {
        if (map.getLayer(id)) map.removeLayer(id);
      });
      ['rutas-australes-lines','rutas-australes-stations','rutas-australes-waypoints'].forEach(id => {
        if (map.getSource(id)) map.removeSource(id);
      });
      addedRef.current = false;
    };
  }, [map, rutas, estaciones, loading, error]);

  // Toggle visibilidad
  useEffect(() => {
    if (!map || !addedRef.current) return;
    const layerIds = ['rutas-halo','rutas-lineas','rutas-waypoints','rutas-estaciones','rutas-estaciones-labels'];
    const vis = visible ? 'visible' : 'none';
    layerIds.forEach(id => {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis);
    });
  }, [map, visible]);

  return null; // componente sin DOM propio
}
