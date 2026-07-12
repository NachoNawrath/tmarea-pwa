import React, { useState } from 'react';
import { useContext } from 'react';
import { AppContext } from '../../context/AppContext';
import styles from '../../styles/S0_5Registro.module.css';

export default function S0_5Registro({ onComplete }) {
  const { setUser } = useContext(AppContext);
  const [email, setEmail] = useState('');
  const [nombre, setNombre] = useState('');
  const [licenseType, setLicenseType] = useState('');
  const [licenseExpiration, setLicenseExpiration] = useState('');
  const [error, setError] = useState('');

  const licenseOptions = [
    { value: 'patron_nave_menor', label: 'Patrón de Nave Menor (Comercial)' },
    { value: 'patron_pesca_artesanal', label: 'Patrón de Pesca Artesanal (Comercial)' },
    { value: 'patron_deportivo_bahia', label: 'Patrón Deportivo de Bahía (Recreativo)' },
    { value: 'capitan_deportivo_costero', label: 'Capitán Deportivo Costero (Recreativo)' },
    { value: 'capitan_deportivo_alta_mar', label: 'Capitán Deportivo de Alta Mar (Recreativo)' }
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!email || !nombre || !licenseType || !licenseExpiration) {
      setError('Todos los campos son requeridos');
      return;
    }

    const userData = {
      email,
      nombre,
      licenseType,
      licenseExpiration,
      registered_at: new Date().toISOString()
    };

    localStorage.setItem('user_profile', JSON.stringify(userData));
    setUser(userData);
    onComplete();
  };

  const isValid = email && nombre && licenseType && licenseExpiration;

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <h1>Tmarea</h1>
          <p className={styles.tagline}>Navega con Certeza</p>
        </div>

        <h2 className={styles.heading}>Crea tu Perfil de Patrón</h2>
        <p className={styles.subtitle}>
          Completa tus datos para acceder a Tmarea
        </p>

        <form onSubmit={handleSubmit}>
          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.formGroup}>
            <label htmlFor="email">Email *</label>
            <input
              id="email"
              type="email"
              placeholder="tu.email@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={styles.input}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="nombre">Nombre Completo *</label>
            <input
              id="nombre"
              type="text"
              placeholder="Tu nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className={styles.input}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="licenseType">Tipo de Licencia DIRECTEMAR *</label>
            <select
              id="licenseType"
              value={licenseType}
              onChange={(e) => setLicenseType(e.target.value)}
              className={styles.select}
            >
              <option value="">Selecciona tu licencia</option>
              {licenseOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="licenseExpiration">Vencimiento de Licencia *</label>
            <input
              id="licenseExpiration"
              type="date"
              value={licenseExpiration}
              onChange={(e) => setLicenseExpiration(e.target.value)}
              className={styles.input}
            />
          </div>

          <button
            type="submit"
            className={`${styles.button} ${isValid ? styles.buttonEnabled : styles.buttonDisabled}`}
            disabled={!isValid}
          >
            Continuar a Perfil de Nave
          </button>
        </form>

        <p className={styles.footer}>
          Tus datos se guardan localmente y se sincronizarán cuando adquieras un plan.
        </p>
      </div>
    </div>
  );
}
