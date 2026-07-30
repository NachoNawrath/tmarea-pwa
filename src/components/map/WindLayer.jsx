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

// ── Punto de ruta más cercano a una bahía ───────────────────────────────────
// Corrige la longitud por cos(lat) para que la distancia sea razonable en el
// corredor austral; suficiente para elegir el punto interpolado más cercano.
function puntoMasCercano(lat, lng, puntos) {
  if (!Array.isArray(puntos) || puntos.length === 0) return null;
  const kx = Math.cos((lat * Math.PI) / 180);
  let mejor = null;
  let mejorD = Infinity;
  for (const p of puntos) {
    const dLat = p.lat - lat;
    const dLng = (p.lng - lng) * kx;
    const d = dLat * dLat + dLng * dLng;
    if (d < mejorD) { mejorD = d; mejor = p; }
  }
  return mejor;
}

// ── Color por intensidad (paleta Tmarea) ────────────────────────────────────
function colorPorVelocidad(kt) {
  if (kt >= 25) return '#E8512A'; // coral — fuerte
  if (kt >= 15) return '#F57C00'; // naranja — moderado
  return '#5DCAA5';               // turquesa — calma/suave
}

// ── Tamaño proporcional a la velocidad (30px a 40px) ────────────────────────
// Mínimo 30px para que la flecha sea claramente más grande que las boyas
// (seamarks) naranjas del mapa y no se confunda con ellas.
function tamanoPorVelocidad(kt) {
  const v = Number(kt) || 0;
  return Math.round(Math.max(30, Math.min(40, 30 + (v / 25) * 10)));
}

// ── Elemento DOM de una flecha (disco + arrow SVG + etiqueta de velocidad) ──
function crearElementoFlecha(bahia) {
  const kt    = Number(bahia.velocidad_viento_kt) || 0;
  const dir   = (bahia.direccion_viento || '').toUpperCase().trim();
  const grados = DIRECCION_GRADOS[dir] ?? 0;

  // La flecha SVG base apunta al norte (arriba). La dirección indica DE DÓNDE
  // viene el viento; la flecha debe apuntar hacia DÓNDE VA. Por eso 180° + dir:
  // viento N (0°) → rotación 180° → la flecha apunta al sur.
  const rotacion = 180 + grados;
  const size  = tamanoPorVelocidad(kt);
  const color = colorPorVelocidad(kt);

  const wrap = document.createElement('div');
  // z-index alto: las flechas quedan por encima de las boyas/seamarks del mapa.
  wrap.style.cssText = 'display:flex;align-items:center;gap:5px;pointer-events:none;z-index:5;';

  // Disco de fondo (NO rota): blanco semi-transparente con borde del color de
  // intensidad. Separa visualmente la flecha del fondo y de las boyas naranjas.
  const disc = document.createElement('div');
  disc.style.cssText =
    `width:${size}px;height:${size}px;border-radius:50%;box-sizing:border-box;` +
    `background:rgba(255,255,255,0.7);border:2px solid ${color};` +
    'box-shadow:0 1px 4px rgba(0,0,0,0.45);' +
    'display:flex;align-items:center;justify-content:center;';

  const arrowSize = Math.round(size * 0.68);
  const arrow = document.createElement('div');
  arrow.style.cssText =
    `width:${arrowSize}px;height:${arrowSize}px;` +
    `transform:rotate(${rotacion}deg);transform-origin:center;`;
  arrow.innerHTML =
    `<svg viewBox="0 0 24 24" width="${arrowSize}" height="${arrowSize}" xmlns="http://www.w3.org/2000/svg">` +
    `<path d="M12 2 L18 20 L12 15 L6 20 Z" fill="${color}" stroke="#ffffff" ` +
    `stroke-width="1.5" stroke-linejoin="round"/></svg>`;
  disc.appendChild(arrow);

  // Etiqueta de velocidad — pill oscuro para que "15 kt" se lea sin hover
  // sobre cualquier zona del mapa (claro u oscuro).
  const label = document.createElement('span');
  label.textContent = `${Math.round(kt)} kt`;
  label.style.cssText =
    'font:700 11px Arial,sans-serif;color:#F1EFE8;white-space:nowrap;' +
    'background:rgba(10,38,71,0.78);padding:2px 6px;border-radius:6px;' +
    'text-shadow:0 1px 2px rgba(0,0,0,0.6);';

  wrap.appendChild(disc);
  wrap.appendChild(label);
  return wrap;
}

// ── Componente ──────────────────────────────────────────────────────────────
export function WindLayer({ map, windData, rutaPuntos = [], visible = true }) {
  const markersRef = useRef([]);

  // Crea / recrea los markers cuando cambian el mapa, los datos o la ruta
  useEffect(() => {
    if (!map || !Array.isArray(windData) || windData.length === 0) return;

    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    windData.forEach(bahia => {
      const lat = Number(bahia.lat);
      const lng = Number(bahia.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      // El viento es el de la estación SITPORT, pero la flecha se dibuja sobre
      // la línea de ruta: se snappea al punto interpolado más cercano. Si no hay
      // ruta, cae a la posición de la bahía (costa).
      const snap = puntoMasCercano(lat, lng, rutaPuntos) || { lat, lng };

      const el = crearElementoFlecha(bahia);
      el.style.display = visible ? '' : 'none';
      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([snap.lng, snap.lat])
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
  }, [map, windData, rutaPuntos]);

  // Toggle de visibilidad sin recrear los markers
  useEffect(() => {
    markersRef.current.forEach(m => {
      const el = m.getElement();
      if (el) el.style.display = visible ? '' : 'none';
    });
  }, [visible, windData]);

  return null; // componente sin DOM propio
}
