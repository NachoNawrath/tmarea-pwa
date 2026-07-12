import React, { useState } from 'react';
import styles from '../../styles/S0Onboarding.module.css';

export default function S0Onboarding({ onAccept }) {
  const [checkedTC, setCheckedTC] = useState(false);
  const [checkedDescargo, setCheckedDescargo] = useState(false);
  const [expandedTC, setExpandedTC] = useState(false);
  const [expandedDescargo, setExpandedDescargo] = useState(false);

  const handleAccept = () => {
    if (checkedTC && checkedDescargo) {
      localStorage.setItem('s0_accepted', JSON.stringify({
        accepted: true,
        accepted_at: new Date().toISOString()
      }));
      onAccept();
    }
  };

  const isEnabled = checkedTC && checkedDescargo;

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <h1>Tmarea</h1>
          <p className={styles.tagline}>Navega con Certeza</p>
        </div>

        <p className={styles.intro}>
          Verifica condiciones de navegación antes de ejecutar tu zarpe autorizado.
        </p>

        <div className={styles.accordion}>
          <button className={styles.accordionHeader} onClick={() => setExpandedTC(!expandedTC)}>
            <span>📋 Términos y Condiciones</span>
            <span className={styles.chevron}>{expandedTC ? '▼' : '▶'}</span>
          </button>

          {expandedTC && (
            <div className={styles.accordionContent}>
              <div className={styles.legalText}>
                <h4>Términos y Condiciones de Uso</h4>
                <p>Tmarea es una herramienta digital de apoyo a la decisión navegacional. Su uso está sujeto a estos términos.</p>
                <h5>1. Aceptación de Términos</h5>
                <p>Al usar Tmarea, aceptas estos términos en su totalidad.</p>
                <h5>2. Licencia de Uso</h5>
                <p>Se te otorga una licencia no exclusiva, revocable para usar Tmarea según estos términos.</p>
                <h5>3. Responsabilidades del Usuario</h5>
                <p>Eres responsable de tu cuenta y de toda actividad en ella.</p>
                <h5>4. Modificaciones</h5>
                <p>Nos reservamos el derecho de modificar estos términos en cualquier momento.</p>
              </div>
              <a href="https://tmarea.cl/terminos" target="_blank" rel="noopener noreferrer" className={styles.link}>
                Ver versión completa →
              </a>
            </div>
          )}
        </div>

        <div className={styles.accordion}>
          <button className={styles.accordionHeader} onClick={() => setExpandedDescargo(!expandedDescargo)}>
            <span>⚠️ Descargo de Responsabilidad Navegacional</span>
            <span className={styles.chevron}>{expandedDescargo ? '▼' : '▶'}</span>
          </button>

          {expandedDescargo && (
            <div className={styles.accordionContent}>
              <div className={styles.legalText}>
                <h4>Descargo de Responsabilidad Navegacional</h4>
                <p>Tmarea NO autoriza tu zarpe. Esa responsabilidad es exclusiva del armador y DIRECTEMAR.</p>
                <h5>1. Limitación de Responsabilidad</h5>
                <p>MisilUp SpA no es responsable por decisiones de navegación, accidentes, o inexactitud de datos.</p>
                <h5>2. Fuentes de Datos</h5>
                <p>Tmarea consume datos públicos de DIRECTEMAR, Open-Meteo y OpenStreetMap.</p>
                <h5>3. Tu Responsabilidad</h5>
                <p>Verifica todo contra fuentes oficiales antes de zarpar.</p>
              </div>
              <a href="https://tmarea.cl/descargo" target="_blank" rel="noopener noreferrer" className={styles.link}>
                Ver versión completa →
              </a>
            </div>
          )}
        </div>

        <div className={styles.checkboxes}>
          <label className={styles.checkbox}>
            <input type="checkbox" checked={checkedTC} onChange={(e) => setCheckedTC(e.target.checked)} />
            <span>Acepto los Términos y Condiciones</span>
          </label>
          <label className={styles.checkbox}>
            <input type="checkbox" checked={checkedDescargo} onChange={(e) => setCheckedDescargo(e.target.checked)} />
            <span>Acepto el Descargo de Responsabilidad Navegacional</span>
          </label>
        </div>

        <button className={`${styles.button} ${isEnabled ? styles.buttonEnabled : styles.buttonDisabled}`} onClick={handleAccept} disabled={!isEnabled}>
          Continuar a Crear Perfil
        </button>

        <p className={styles.footer}>
          Esta aplicación se rige bajo Ley de Navegación DL 2.222/1978 y normativas de DIRECTEMAR.
        </p>
      </div>
    </div>
  );
}
