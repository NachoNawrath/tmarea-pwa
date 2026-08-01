// src/components/verification/VoyageVerdict.jsx
import React from 'react';

const C = {
  marino:    '#0A2647',
  electrico: '#1A6EBD',
  turquesa:  '#5DCAA5',
  coral:     '#E8512A',
  naranja:   '#F57C00',
  ambar:     '#FFC107',
};

const VEREDICTO_CONFIG = {
  Q: {
    bandera: '🟩',
    label: 'Bandera Q',
    titulo: 'Zarpe autorizado',
    subtitulo: 'Condiciones favorables para navegar.',
    bg: 'linear-gradient(135deg, #0f3d1c 0%, #1a5c2a 100%)',
    border: C.turquesa,
    color: C.turquesa,
  },
  U: {
    bandera: '🟨',
    label: 'Bandera U',
    titulo: 'Navegar con precaución',
    subtitulo: 'Hay restricciones o condiciones que requieren atención antes de zarpar.',
    bg: 'linear-gradient(135deg, #3d2d00 0%, #5c4200 100%)',
    border: C.ambar,
    color: C.ambar,
  },
  UV: {
    bandera: '🟥',
    label: 'Bandera U + V',
    titulo: 'Navegación no recomendada',
    subtitulo: 'Puerto cerrado, mal tiempo o riesgo de autonomía. No zarpar.',
    bg: 'linear-gradient(135deg, #3d0a0a 0%, #5c1010 100%)',
    border: C.coral,
    color: C.coral,
  },
};

export default function VoyageVerdict({ veredicto, portStatus, weather, navigation, transitRestrictions }) {
  const cfg = VEREDICTO_CONFIG[veredicto] || VEREDICTO_CONFIG.U;

  const razones = [];

  // Restricciones de tránsito que BLOQUEAN — usa la evaluación del backend (BRE)
  const transitBloqueantes = (transitRestrictions?.restricciones_intermedias || [])
    .filter((r) => r.evaluacion?.bloquea);
  for (const r of transitBloqueantes) {
    razones.push(`Restricción de tránsito en zona intermedia (${r.nombre_bahia})`);
  }

  // Restricciones de tránsito con precaución (sin AB cargado o VARIABLE)
  const transitPrecaucion = (transitRestrictions?.restricciones_intermedias || [])
    .filter((r) => r.evaluacion?.estado === 'sin_ab');
  for (const r of transitPrecaucion) {
    razones.push(`Restricción en ${r.nombre_bahia} — verifica tu AB`);
  }

  if (portStatus?.zarpe?.estado === 'rojo') {
    razones.push(`Puerto de zarpe "${portStatus.zarpe.nombre}" cerrado`);
  } else if (portStatus?.zarpe?.estado === 'ambar') {
    razones.push(`Puerto de zarpe "${portStatus.zarpe.nombre}" con restricciones`);
  }

  if (portStatus?.recalada?.estado === 'rojo') {
    razones.push(`Puerto de recalada "${portStatus.recalada.nombre}" cerrado`);
  } else if (portStatus?.recalada?.estado === 'ambar') {
    razones.push(`Puerto de recalada "${portStatus.recalada.nombre}" con restricciones`);
  }

  if (weather?.condicion_puerto === 'temporal') {
    razones.push('Condición de Puerto: Temporal activo');
  } else if (weather?.condicion_puerto === 'mal_tiempo') {
    razones.push('Condición de Puerto: Mal Tiempo');
  }

  if (weather?.alerta_nivel === 'alto') {
    razones.push('Oleaje o viento en peor tramo supera umbral de seguridad');
  }

  if (navigation?.autonomia_ok === false) {
    razones.push('Combustible insuficiente para completar la ruta');
  }

  if (portStatus?.zarpe?.dato_viejo || portStatus?.recalada?.dato_viejo) {
    razones.push('Dato SITPORT desactualizado — verificar con Capitanía');
  }

  // Último tramo seguro (del motor de reglas)
  const ultimoTramo = transitRestrictions?.ultimo_tramo_seguro;

  return (
    <div
      style={{
        ...styles.container,
        background: cfg.bg,
        borderLeft: `4px solid ${cfg.border}`,
      }}
    >
      {/* Bandera + título */}
      <div style={styles.topRow}>
        <div style={styles.flagWrap}>
          <span style={{ fontSize: 28 }}>{cfg.bandera}</span>
          <span style={{ ...styles.flagLabel, color: cfg.color }}>{cfg.label}</span>
        </div>
        <div style={styles.titleWrap}>
          <h2 style={{ ...styles.titulo, color: cfg.color }}>{cfg.titulo}</h2>
          <p style={styles.subtitulo}>{cfg.subtitulo}</p>
        </div>
      </div>

      {/* Razones */}
      {razones.length > 0 && (
        <div style={styles.razonesContainer}>
          {razones.map((r, i) => (
            <div key={i} style={styles.razonRow}>
              <span style={{ color: cfg.color, fontSize: 12 }}>▸</span>
              <span style={styles.razonText}>{r}</span>
            </div>
          ))}
        </div>
      )}

      {/* Último tramo seguro */}
      {ultimoTramo && veredicto === 'UV' && (
        <div style={styles.tramoSeguro}>
          <span style={styles.razonText}>
            Puedes navegar hasta {ultimoTramo.bahia}. A partir de ahí, la zona está restringida.
          </span>
        </div>
      )}

      {/* Si todo ok — mensaje positivo */}
      {razones.length === 0 && veredicto === 'Q' && (
        <p style={{ ...styles.razonText, color: C.turquesa, marginTop: 8 }}>
          ✓ Puertos despejados · Clima dentro de límites · Autonomía suficiente
        </p>
      )}
    </div>
  );
}

const styles = {
  container: {
    margin: '12px 16px 0',
    borderRadius: 14,
    padding: '16px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  topRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 14,
  },
  flagWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    minWidth: 52,
  },
  flagLabel: {
    fontFamily: 'Arial',
    fontWeight: 700,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  titleWrap: {
    flex: 1,
  },
  titulo: {
    fontFamily: 'Arial',
    fontWeight: 700,
    fontSize: 18,
    margin: 0,
    lineHeight: 1.2,
  },
  subtitulo: {
    fontFamily: 'Arial',
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
    margin: '4px 0 0',
    lineHeight: 1.4,
  },
  razonesContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    paddingTop: 4,
    borderTop: '1px solid rgba(255,255,255,0.1)',
  },
  razonRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
  },
  razonText: {
    fontFamily: 'Arial',
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 1.4,
  },
  tramoSeguro: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
    padding: '8px 10px',
    marginTop: 2,
  },
};
