// src/components/map/WindLayer.jsx
// Tmarea — Capa de flechas de viento SITPORT sobre MapLibre GL JS
// Dibuja una flecha por bahía SITPORT usando maplibregl.Marker (HTML/SVG
// custom). Son pocos puntos (<20) y estáticos, por eso markers y no
// source/layer GeoJSON: permiten SVG a medida sin tocar el estilo del mapa.

import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';

// Texto de dirección → grados (convención náutica, desde donde viene el viento)
const DIRECCION_GRADOS = {
  N: 0,    NNE: 22.5,  NE: 45,   ENE: 67.5,
  E: 90,   ESE: 112.5, SE: 135,  SSE: 157.5,
  S: 180,  SSW: 202.5, SW: 225,  WSW: 247.5,
  W: 270,  WNW: 292.5, NW: 315,  NNW: 337.5,
};

// ── Color por intensidad (paleta Tmarea) ────────────────────────────────────
function colorPorVelocidad(kt) {
  if (kt >= 25) return '#E8512A'; // coral — fuerte
  if (kt >= 15) return '#F57C00'; // naranja — moderado
  return '#5DCAA5';               // turquesa — calma/suave
}

// ── Tamaño proporcional a la velocidad (20px a 40px) ────────────────────────
function tamanoPorVelocidad(kt) {
  const v = Number(kt) || 0;
  return Math.round(Math.max(20, Math.min(40, 20 + (v / 25) * 20)));
}

// ── Elemento DOM de una flecha (arrow SVG + etiqueta de velocidad) ──────────
function crearElementoFlecha(bahia) {
  const kt    = Number(bahia.velocidadViento) || 0;
  const dir   = (bahia.textoDireccionViento || '').toUpperCase().trim();
  const grados = DIRECCION_GRADOS[dir] ?? 0;

  // La flecha SVG base apunta al norte (arriba). La dirección indica DE DÓNDE
  // viene el viento; la flecha debe apuntar hacia DÓNDE VA. Por eso 180° + dir:
  // viento N (0°) → rotación 180° → la flecha apunta al sur.
  const rotacion = 180 + grados;
  const size  = tamanoPorVelocidad(kt);
  const color = colorPorVelocidad(kt);

  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;align-items:center;gap:4px;pointer-events:none;';

  const arrow = document.createElement('div');
  arrow.style.cssText =
    `width:${size}px;height:${size}px;transform:rotate(${rotacion}deg);` +
    'transform-origin:center;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.5));';
  arrow.innerHTML =
    `<svg viewBox="0 0 24 24" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">` +
    `<path d="M12 2 L18 20 L12 15 L6 20 Z" fill="${color}" stroke="#ffffff" ` +
    `stroke-width="1" stroke-linejoin="round"/></svg>`;

  const label = document.createElement('span');
  label.textContent = `${Math.round(kt)} kt`;
  label.style.cssText =
    'font:600 11px Arial,sans-serif;color:#F1EFE8;white-space:nowrap;' +
    'text-shadow:0 1px 2px rgba(0,0,0,0.85),0 0 3px rgba(0,0,0,0.6);';

  wrap.appendChild(arrow);
  wrap.appendChild(label);
  return wrap;
}

// ── Componente ──────────────────────────────────────────────────────────────
export function WindLayer({ map, windData, visible = true }) {
  const markersRef = useRef([]);

  // Crea / recrea los markers cuando cambian el mapa o los datos de viento
  useEffect(() => {
    if (!map || !Array.isArray(windData) || windData.length === 0) return;

    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    windData.forEach(bahia => {
      const lat = Number(bahia.lat);
      const lng = Number(bahia.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      const el = crearElementoFlecha(bahia);
      el.style.display = visible ? '' : 'none';
      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([lng, lat])
        .addTo(map);
      markersRef.current.push(marker);
    });

    // Limpieza: al desmontar P4 o antes de recrear, se sacan los markers
    return () => {
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
    };
    // `visible` se aplica en el efecto de abajo; no recreamos por él a propósito
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, windData]);

  // Toggle de visibilidad sin recrear los markers
  useEffect(() => {
    markersRef.current.forEach(m => {
      const el = m.getElement();
      if (el) el.style.display = visible ? '' : 'none';
    });
  }, [visible, windData]);

  return null; // componente sin DOM propio
}
