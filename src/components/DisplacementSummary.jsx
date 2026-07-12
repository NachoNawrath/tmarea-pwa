import React from 'react';
import '../styles/DisplacementSummary.css';

export default function DisplacementSummary({ vessel }) {
  const formatNumber = (n, decimals = 2) => {
    if (n === null || n === undefined) return '—';
    return parseFloat(n).toFixed(decimals);
  };

  const { cb_asignado, desplazamiento_vacio, calado_vacio_aprox, validacion } = vessel;

  return (
    <div className="displacement-summary">
      <h3>📊 Resumen Técnico</h3>

      <div className="summary-grid">
        <div className="summary-item">
          <span className="label">Desplazamiento (vacío)</span>
          <span className="value">{formatNumber(desplazamiento_vacio)} t</span>
        </div>

        <div className="summary-item">
          <span className="label">Calado aprox (vacío)</span>
          <span className="value">{formatNumber(calado_vacio_aprox, 3)} m</span>
        </div>

        <div className="summary-item">
          <span className="label">Coeficiente Bloque (Cb)</span>
          <span className="value">{formatNumber(cb_asignado, 3)}</span>
        </div>
      </div>

      {validacion?.warning && (
        <div className="alert alert-warning">
          <strong>⚠️ Revisión Recomendada</strong>
          <p>{validacion.message}</p>
        </div>
      )}

      {!validacion?.warning && (
        <div className="alert alert-success">
          ✓ Desplazamiento validado
        </div>
      )}
    </div>
  );
}
