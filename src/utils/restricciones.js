// src/utils/restricciones.js
// Cotejo de restricciones SITPORT contra el Arqueo Bruto (AB) de la nave.
// Compartido entre PortStatusBlock (puertos de zarpe/recalada) y
// TransitRestrictionsBlock (restricciones en zonas intermedias de la ruta).

const C = {
  turquesa: '#5DCAA5',
  coral:    '#E8512A',
  ambar:    '#FFC107',
};

// Extrae el texto libre de la restricción, sin importar el origen del objeto:
// SITPORT crudo (Observacion / MotivoRestriccion) o el shape del endpoint
// restricciones-ruta (observacion / restriccion).
function textoRestriccion(restriccion) {
  return (
    restriccion?.Observacion ||
    restriccion?.observacion ||
    restriccion?.MotivoRestriccion ||
    restriccion?.restriccion ||
    restriccion?.descripcion ||
    restriccion?.motivo ||
    ''
  );
}

/**
 * Coteja una restricción de Arqueo Bruto (AB) contra el AB de la nave.
 * SITPORT publica restricciones tipo "CERRADO PARA EEMM A 25 AB SECTOR ..." —
 * embarcaciones menores a 25 AB no pueden navegar ahí. Si la restricción no
 * menciona AB, retorna null (no aplica este cotejo).
 *
 * @returns {{ estado: 'bloquea'|'no_afecta'|'sin_ab', color, icono, mensaje, limite } | null}
 */
export function evaluarRestriccionAB(restriccion, vessel) {
  const texto = textoRestriccion(restriccion);

  // "EEMM A 25 AB" (formato SITPORT) o cualquier "<número> AB".
  const match = texto.match(/EEMM\s*A\s*(\d+)\s*AB/i) || texto.match(/(\d+)\s*AB\b/i);
  if (!match) return null;

  const limite = parseInt(match[1], 10);
  const abRaw = vessel?.ab;
  const ab_nave = abRaw != null && abRaw !== '' && !isNaN(abRaw) ? Number(abRaw) : null;

  if (ab_nave == null) {
    return {
      estado: 'sin_ab',
      color: C.ambar,
      icono: '⚠',
      limite,
      mensaje:
        'Verifica si esta restricción aplica a tu embarcación — ingresa tu Arqueo Bruto (AB) en el perfil para cotejo automático',
    };
  }

  if (ab_nave < limite) {
    return {
      estado: 'bloquea',
      color: C.coral,
      icono: '⚠',
      limite,
      mensaje: `Esta restricción aplica a tu embarcación (AB ${ab_nave} < ${limite} AB)`,
    };
  }

  return {
    estado: 'no_afecta',
    color: C.turquesa,
    icono: 'ℹ',
    limite,
    mensaje: `Tu embarcación (AB ${ab_nave}) no está afectada por esta restricción`,
  };
}
