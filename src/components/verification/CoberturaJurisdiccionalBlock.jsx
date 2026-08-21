// src/components/verification/CoberturaJurisdiccionalBlock.jsx
//
// U2 CAPA B (decisión del owner, 2026-08-21). La ruta cruza un tramo cuya
// jurisdicción no tiene límite cargado. INV-3.6: eso se declara, nunca se
// resuelve en silencio — un falso negativo silencioso es el modo de falla más
// peligroso del motor, porque no hay error ni aviso.
//
// Va en su PROPIO bloque y NUNCA entre las restricciones (S3(b)), y va DESPUÉS
// de `DriftCatalogoBlock`: los dos "no sabemos" quedan juntos y los dos detrás
// de los hechos reales de la ruta. Mezclarlo con las restricciones le daría una
// autoridad que no tiene.
//
// Su bandera está topada en U por el backend y vuelta a topar en la PWA. Nunca
// U+V: la ausencia de dato no es una prohibición.
//
// ─────────────────────────────────────────────────────────────────────────────
// ESTE COMPONENTE NO ESCRIBE EL TEXTO NORMATIVO, Y ES LA DIFERENCIA CON SU
// HERMANO. `capa_1` y `capa_2` vienen compuestas del backend desde §10 de
// CONTRATO_MOTOR.md, cotejadas contra el contrato en cada `npm test`. Acá se
// renderizan LITERALES. `DriftCatalogoBlock` sí escribe el suyo en el JSX y nadie
// lo coteja; eso no se copia y no se arregla desde acá (§4.8).
//
// EL TELÉFONO SE MUESTRA, y es firma del owner del 2026-08-21. INV-3.6 lo nombra
// para este caso exacto; el «sólo … en el punto de zarpe y recalada» de INV-10.1
// queda FALSO desde esta pieza. Lo que INV-10.1 persigue —no rotular como
// Capitanía un número que es de la Gobernación— lo cumple el rótulo, que sale de
// `capitanias[i].tipo` y no de un literal. Ancla que se pone roja el día que el
// contrato se enmiende: `cobertura-jurisdiccional.test.js`, y la fila
// SESION-u2-capa-b-2026-08-21::inv-101-solo-quedo-falso del declarativo.
//
// SIN `tel:`, a propósito. INV-10.1 sólo admite enlace si el número es atómico, y
// ese veredicto lo emite el motor en `telefono_atomico` — campo que el array
// `capitanias` de cobertura NO trae. Sin el veredicto no se arma el enlace: un
// `tel:` roto es peor que ninguno.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { avisosDeCobertura } from '../../hooks/useVoyageVerification.js';

const C = {
  marino: '#0A2647',
  ambar:  '#FFC107',
};

function AvisoCard({ a }) {
  return (
    <div style={styles.card}>
      {/* Capa 1 — literal del catálogo, vía backend. No se recompone acá. */}
      <p style={styles.titulo}>{a.capa_1}</p>
      {/* El largo es lo único propio de este bloque: da la magnitud del hueco,
          que es la parte que le cambia la decisión al patrón. */}
      {a.largo && <p style={styles.cuerpo}>Son {a.largo} de la ruta.</p>}
      {/* Capa 2 — literal del catálogo. Trae la derivación: con la Capitanía
          nombrada, o por VHF Canal 16 cuando no se la puede nombrar sin
          inventarla. Las dos ramas las eligió el backend, no este componente. */}
      <p style={styles.cuerpo}>{a.capa_2}</p>
      {a.contacto && (
        <p style={styles.contacto}>
          📞 {a.contacto.etiqueta} {a.contacto.nombre}
          {a.contacto.telefono && ` — ${a.contacto.telefono}`}
        </p>
      )}
    </div>
  );
}

export default function CoberturaJurisdiccionalBlock({ transitRestrictions }) {
  const cobertura = avisosDeCobertura(transitRestrictions);
  if (!cobertura) return null;

  // Un fallo de evaluación NO se muestra como "no hay nada": la bandera escaló a
  // U y el patrón tiene que poder leer por qué (INV-0.2).
  if (cobertura.estado === 'no_evaluada') {
    return (
      <section style={styles.bloque}>
        <h3 style={styles.encabezado}>⚠ Tramos por los que el motor no puede responder</h3>
        <div style={styles.card}>
          <p style={styles.titulo}>No pudimos comprobar la cobertura jurisdiccional de la ruta</p>
          <p style={styles.cuerpo}>
            La comprobación no se pudo completar
            {cobertura.motivo ? ` (${cobertura.motivo})` : ''}. Consulte con la
            Autoridad Marítima antes de zarpar.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section style={styles.bloque}>
      <h3 style={styles.encabezado}>
        ⚠ Tramos por los que el motor no puede responder ({cobertura.avisos.length})
      </h3>
      {cobertura.avisos.map((a) => <AvisoCard key={a.orden} a={a} />)}
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
  titulo:   { fontSize: 15, fontWeight: 700, color: C.marino, margin: '0 0 6px' },
  cuerpo:   { fontSize: 13, lineHeight: 1.45, color: '#37474f', margin: '0 0 6px' },
  contacto: { fontSize: 13, fontWeight: 600, color: C.marino, margin: '6px 0 0' },
};
