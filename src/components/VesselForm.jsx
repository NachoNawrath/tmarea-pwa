import React, { useState, useEffect } from 'react';
import '../styles/VesselForm.css';

const VESSEL_TYPES = {
  barcaza: 'Barcaza chata o gabarra',
  trasmallo: 'Trasmallo / Palangrera',
  motonave: 'Motonave carguera',
  catamarano: 'Catamarán de trabajo',
  otro: 'Otro tipo'
};

export default function VesselForm({ initialData, onSubmit, loading }) {
  const [form, setForm] = useState({
    nombre: '',
    trg: '',
    tipo_nave: 'trasmallo',
    eslora: '',
    manga: '',
    puntal: '',
    motor_hp: '',
    consumo_nominal: '',
    capacidad_fuel: ''
  });

  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  useEffect(() => {
    if (initialData) {
      setForm({
        nombre: initialData.nombre || '',
        trg: initialData.trg || '',
        tipo_nave: initialData.tipo_nave || 'trasmallo',
        eslora: initialData.eslora || '',
        manga: initialData.manga || '',
        puntal: initialData.puntal || '',
        motor_hp: initialData.motor_hp || '',
        consumo_nominal: initialData.consumo_nominal || '',
        capacidad_fuel: initialData.capacidad_fuel || ''
      });
    }
  }, [initialData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: value
    }));

    if (touched[name]) {
      validateField(name, value);
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));
    validateField(name, value);
  };

  const validateField = (name, value) => {
    const newErrors = { ...errors };

    if (name === 'nombre') {
      if (!value.trim()) {
        newErrors.nombre = 'Nombre requerido';
      } else {
        delete newErrors.nombre;
      }
    } else if (name === 'trg') {
      if (!value || isNaN(value) || parseFloat(value) <= 0 || parseFloat(value) > 100) {
        newErrors.trg = 'TRG debe ser entre 0 y 100';
      } else {
        delete newErrors.trg;
      }
    } else if (name === 'eslora') {
      if (!value || isNaN(value) || parseFloat(value) <= 0) {
        newErrors.eslora = 'Eslora requerida y positiva';
      } else {
        delete newErrors.eslora;
      }
    } else if (name === 'manga') {
      if (!value || isNaN(value) || parseFloat(value) <= 0) {
        newErrors.manga = 'Manga requerida y positiva';
      } else {
        delete newErrors.manga;
      }
    }

    setErrors(newErrors);
  };

  const validateForm = () => {
    const newErrors = {};

    if (!form.nombre.trim()) newErrors.nombre = 'Nombre requerido';
    if (!form.trg) newErrors.trg = 'TRG requerido';
    if (!form.eslora) newErrors.eslora = 'Eslora requerida';
    if (!form.manga) newErrors.manga = 'Manga requerida';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const payload = {
      nombre: form.nombre,
      trg: parseFloat(form.trg),
      tipo_nave: form.tipo_nave,
      eslora: parseFloat(form.eslora),
      manga: parseFloat(form.manga),
      puntal: form.puntal ? parseFloat(form.puntal) : null,
      motor_hp: form.motor_hp ? parseInt(form.motor_hp) : null,
      consumo_nominal: form.consumo_nominal ? parseFloat(form.consumo_nominal) : null,
      capacidad_fuel: form.capacidad_fuel ? parseInt(form.capacidad_fuel) : null
    };

    onSubmit(payload);
  };

  return (
    <form className="vessel-form" onSubmit={handleSubmit}>
      <fieldset className="form-section">
        <legend>📋 Datos Administrativos</legend>

        <div className="form-group">
          <label>Nombre de la Nave *</label>
          <input
            type="text"
            name="nombre"
            value={form.nombre}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="ej: María del Rosario"
          />
          {errors.nombre && <span className="error-msg">{errors.nombre}</span>}
        </div>

        <div className="form-group">
          <label>TRG (Toneladas de Registro) *</label>
          <input
            type="number"
            name="trg"
            value={form.trg}
            onChange={handleChange}
            onBlur={handleBlur}
            step="0.25"
            placeholder="ej: 46.25"
          />
          {errors.trg && <span className="error-msg">{errors.trg}</span>}
        </div>

        <div className="form-group">
          <label>Tipo de Nave *</label>
          <select name="tipo_nave" value={form.tipo_nave} onChange={handleChange}>
            {Object.entries(VESSEL_TYPES).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
      </fieldset>

      <fieldset className="form-section">
        <legend>📐 Dimensiones</legend>

        <div className="form-row">
          <div className="form-group">
            <label>Eslora (metros) *</label>
            <input
              type="number"
              name="eslora"
              value={form.eslora}
              onChange={handleChange}
              onBlur={handleBlur}
              step="0.1"
              placeholder="ej: 17.43"
            />
            {errors.eslora && <span className="error-msg">{errors.eslora}</span>}
          </div>

          <div className="form-group">
            <label>Manga (metros) *</label>
            <input
              type="number"
              name="manga"
              value={form.manga}
              onChange={handleChange}
              onBlur={handleBlur}
              step="0.1"
              placeholder="ej: 5.70"
            />
            {errors.manga && <span className="error-msg">{errors.manga}</span>}
          </div>

          <div className="form-group">
            <label>Puntal (metros) - Opcional</label>
            <input
              type="number"
              name="puntal"
              value={form.puntal}
              onChange={handleChange}
              step="0.1"
              placeholder="ej: 2.30"
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="form-section">
        <legend>⛽ Motor y Combustible</legend>

        <div className="form-row">
          <div className="form-group">
            <label>Potencia Motor (HP)</label>
            <input
              type="number"
              name="motor_hp"
              value={form.motor_hp}
              onChange={handleChange}
              placeholder="ej: 120"
            />
          </div>

          <div className="form-group">
            <label>Consumo Nominal (L/h)</label>
            <input
              type="number"
              name="consumo_nominal"
              value={form.consumo_nominal}
              onChange={handleChange}
              step="0.5"
              placeholder="ej: 30"
            />
          </div>

          <div className="form-group">
            <label>Capacidad Tanque (litros)</label>
            <input
              type="number"
              name="capacidad_fuel"
              value={form.capacidad_fuel}
              onChange={handleChange}
              placeholder="ej: 900"
            />
          </div>
        </div>
      </fieldset>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Guardando...' : 'Guardar Perfil'}
        </button>
      </div>
    </form>
  );
}
