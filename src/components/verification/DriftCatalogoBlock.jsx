// src/components/verification/DriftCatalogoBlock.jsx
//
// A3 (decisión del owner, 2026-08-11). SITPORT publicó un dato de una bahía que
// nuestro catálogo no conoce, y la Capitanía de esa bahía está en la ruta —o no
// se pudo determinar—. No sabemos qué decía ese dato.
//
// Va en su PROPIO bloque y NUNCA entre las restricciones: mezclar un "no sabemos"
// con las restricciones reales de la ruta le daría una autoridad que no tiene
// (mismo criterio que INV-3.6 fija para la jurisdicción sin límite cargado).
//
// Su bandera está topada en U por el backend. Nunca U+V: la ausencia de dato no
// es una prohibición.

import React from 'react';

const C = {
  marino: '#0A2647',
  ambar:  '#FFC107',
  crema:  '#F1EFE8',
};

function limpiarNombreCapitania(nombre) {
  if (!nombre) return null;
  return nombre.replace(/^CAPITAN[ÍI]A DE PUERTO\s+/i, '').trim();
}

function AvisoCard({ a }) {
  const capitania = limpiarNombreCapitania(a.capitania_sitport);
  const deDondeVino = a.origenes?.includes('totalPronostico') && a.origenes?.includes('consultaRestricciones')
    ? 'una restricción y un pronóstico'
    : a.origenes?.includes('totalPronostico') ? 'un pronóstico' : 'una restricción';

  return (
    <div style={styles.card}>
      <p style={styles.titulo}>
        {capitania
          ? `Hay un dato de la Capitanía de ${capitania} que no pudimos leer`
          : 'Hay un dato de SITPORT que no pudimos leer'}
      </p>
      <p style={styles.cuerpo}>
        La Autoridad Marítima publicó {deDondeVino} para una bahía que todavía no
        está en nuestro catálogo
        {a.nombre_sitport ? ` (${a.nombre_sitport})` : ''}
        {a.causa === 'no_ubicable' && ', y no pudimos determinar a qué Capitanía corresponde'}
        .{' '}
        <strong>No sabemos qué decía.</strong>
      </p>
      <p style={styles.cuerpo}>
        Esto <strong>no significa que exista una restricción, ni que no exista</strong>:
        significa que el motor no puede responder por ese dato. Consultá con la
        Autoridad Marítima antes de zarpar, o por VHF Canal 16.
      </p>
      <p style={styles.sinCita}>
        Sin cita legal: esta situación no la produce una norma sino un dato que nos falta.
      </p>
    </div>
  );
}

// Recibe los bloques de drift de los DOS endpoints que pueden producirlo
// (restricciones-ruta y weather-ruta) y los une por bahía: una misma bahía vista
// por los dos es un aviso, no dos.
export default function DriftCatalogoBlock({ drifts = [] }) {
  const presentes = drifts.filter(Boolean);
  if (presentes.length === 0) return null;

  // `estado` siempre viene explícito. Un fallo de evaluación NO se muestra como
  // "no hay nada": se dice.
  const noEvaluado = presentes.find(d => d.estado === 'no_evaluado');
  if (noEvaluado) {
    return (
      <section style={styles.bloque}>
        <h3 style={styles.encabezado}>⚠ Datos de la Autoridad Marítima</h3>
        <div style={styles.card}>
          <p style={styles.titulo}>No pudimos verificar si quedó algún dato sin leer</p>
          <p style={styles.cuerpo}>
            La comprobación no se pudo completar
            {noEvaluado.motivo ? ` (${noEvaluado.motivo})` : ''}. Consultá con la
            Autoridad Marítima antes de zarpar.
          </p>
          <p style={styles.sinCita}>
            Sin cita legal: esta situación no la produce una norma sino un dato que nos falta.
          </p>
        </div>
      </section>
    );
  }

  const porBahia = new Map();
  for (const d of presentes) {
    for (const a of d.avisos || []) {
      const previo = porBahia.get(a.id_bahia);
      if (!previo) { porBahia.set(a.id_bahia, { ...a, origenes: [...(a.origenes || [])] }); continue; }
      previo.origenes = [...new Set([...previo.origenes, ...(a.origenes || [])])];
      if (!previo.nombre_sitport && a.nombre_sitport) previo.nombre_sitport = a.nombre_sitport;
    }
  }
  const avisos = [...porBahia.values()].sort((a, b) => a.id_bahia - b.id_bahia);
  if (avisos.length === 0) return null;

  return (
    <section style={styles.bloque}>
      <h3 style={styles.encabezado}>
        ⚠ Datos de la Autoridad Marítima que no pudimos leer ({avisos.length})
      </h3>
      {avisos.map(a => <AvisoCard key={a.id_bahia} a={a} />)}
    </section>
  );
}

const styles = {
  bloque:     { marginBottom: 20 },
  encabezado: { fontSize: 15, fontWeight: 700, color: C.marino, margin: '0 0 10px' },
  card: {
    border: `1px solid ${C.ambar}`,
    background: 'rgba(255,193,7,0.10)',
    borderRadius: 10,
    padding: '12px 14px',
    marginBottom: 10,
  },
  titulo: { fontSize: 15, fontWeight: 700, color: C.marino, margin: '0 0 6px' },
  cuerpo: { fontSize: 13, lineHeight: 1.45, color: '#37474f', margin: '0 0 6px' },
  sinCita: { fontSize: 11, fontStyle: 'italic', color: '#78909c', margin: 0 },
};
