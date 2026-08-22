// src/components/verification/SondaDerroteroBlock.jsx
//
// LA ÚNICA ADVERTENCIA DE SEGURIDAD FÍSICA QUE LA APP CALCULABA Y DESCARTABA.
// Paso 1 de la agenda de la marea. El backend compone el aviso cuando la ruta
// cruza un paso donde el Derrotero SHOA registra menos agua que la que la nave
// necesita; hasta esta pieza `advertencias` tenía CERO lectores en toda la PWA.
//
// SITIO (owner, 2026-08-21, corrigiendo su firma anterior): DEBAJO del bloque de
// mareas y ARRIBA del de ETA y combustible. El criterio es de decisión, no de
// tema: la marea define la hora de zarpe, la sonda es la condición del fondo, y
// las dos van antes del consumo, que es otro asunto. La prominencia de seguridad
// ya está pagada arriba, en la línea del veredicto.
//
// QUEDA PEGADO A MAREAS A PROPÓSITO —son las dos mitades del agua bajo la quilla—
// PERO NO SE FUSIONA CON ÉL, y eso es firma del owner: sin el datum que relacione
// el nivel medio del mareógrafo con el nivel de reducción de sondas del SHOA, las
// dos cifras NO SE PUEDEN SUMAR. Un solo bloque invitaría a sumarlas de cabeza.
//
// NO ESCRIBE EL TEXTO DEL AVISO. La frase llega compuesta del backend y se
// renderiza LITERAL. Se buscó primero si el catálogo la tenía: `zonas_aviso.json`
// no la tiene y §10 de CONTRATO_MOTOR.md tampoco, y §10 manda «NO inventar citas
// fuera de este catálogo».
//
// LA FUENTE VA ABAJO Y EN CHICO, y es decisión de producto del owner: la cita
// dentro de la frase la hacía leer como documento y no como aviso. El cuerpo dice
// «Según fuentes oficiales» y acá se ofrece la comprobación concreta a quien
// quiera verificarla. Medido antes de cambiarlo: NO le agrega un caso a S7 — el
// Derrotero está declarado en el contrato como fuente de DATOS, no como norma, y
// un «(p.291)» incrustado se leía como cita normativa sin serlo.
//
// LO QUE ESTE BLOQUE NO CIERRA, Y SE DICE EN VEZ DE TAPARSE: el caso mayoritario,
// donde no hay bloque y el patrón no lee nada sobre sonda. Dónde declara esta app
// sus límites en general es otra unidad del plan — no se contrabandea acá con un
// descargo permanente, que además saldría en casi todas las rutas y dejaría de
// leerse.

import React from 'react';
import { advertenciasDeSonda } from '../../hooks/useVoyageVerification.js';

const C = {
  marino: '#0A2647',
  ambar:  '#FFC107',
};

function AvisoCard({ a }) {
  return (
    <div style={styles.card}>
      {/* EL CANAL, COMO TITULO DE LA TARJETA (owner, 2026-08-21). Con dos avisos el
          patron leia dos parrafos que arrancan igual y ninguno decia de que canal
          hablaba: el de Chocoi dice «en este paso» sin que ningun paso este
          nombrado en el bloque. Sale de `a.canal`, que ya viaja como DATO — la
          alternativa era nombrarlo dentro del cuerpo, y eso deshacia lo que esta
          pieza hizo: sacar la identidad de la prosa y meterla en campos. Ademas
          habria vuelto a cruzar el borde por algo que es de pantalla.
          La forma se calca de `AvisoCard` de CoberturaJurisdiccionalBlock:
          titulo en negrita + cuerpo. NO es condicional: un titulo que aparece a
          veces deja al control midiendo una estructura que la pantalla no siempre
          respeta. */}
      {a.canal && <p style={styles.titulo}>{a.canal}</p>}
      {/* Literal del backend. No se recompone acá. */}
      <p style={styles.cuerpo}>{a.texto}</p>
      {/* La comprobación, para quien quiera ir a la fuente. Los dos campos vienen
          como DATO —`fuente` y `pagina`—, no se extraen del texto. */}
      {a.fuente && (
        <p style={styles.fuente}>
          Comprobar en: {a.fuente}{a.pagina ? `, p. ${a.pagina}` : ''}
        </p>
      )}
    </div>
  );
}

export default function SondaDerroteroBlock({ ruta }) {
  const avisos = advertenciasDeSonda(ruta);
  if (avisos.length === 0) return null;

  return (
    <section style={styles.bloque}>
      <h3 style={styles.encabezado}>
        ⚠ Poca agua documentada en su ruta ({avisos.length})
      </h3>
      {avisos.map((a, i) => <AvisoCard key={i} a={a} />)}
      <p style={styles.alcance}>
        Esta comprobación no cubre toda su ruta: el Derrotero registra la sonda
        sólo en algunos pasos, y la app únicamente puede avisarle en aquellos cuya
        posición sabe ubicar. No puede decirle en cuáles no pudo comprobar. Que no
        aparezca un aviso no significa que haya agua suficiente.
      </p>
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
  titulo:  { fontSize: 15, fontWeight: 700, color: C.marino, margin: '0 0 6px' },
  cuerpo:  { fontSize: 14, lineHeight: 1.5, color: '#37474f', margin: 0 },
  fuente:  { fontSize: 11, lineHeight: 1.4, color: '#78909c', margin: '8px 0 0' },
  alcance: { fontSize: 12, lineHeight: 1.45, color: '#5f6b70', margin: '4px 0 0' },
};
