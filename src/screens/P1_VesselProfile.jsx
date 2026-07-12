import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import VesselForm from '../components/VesselForm';
import DisplacementSummary from '../components/DisplacementSummary';
import '../styles/P1_VesselProfile.css';

export default function P1_VesselProfile() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [vessel, setVessel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  useEffect(() => {
    fetchLastVessel();
  }, []);

  const fetchLastVessel = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/vessels/me', {
        headers: {
          'Authorization': `Bearer ${user?.token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setVessel(data.vessel);
      } else if (response.status === 404) {
        setVessel(null);
      } else {
        throw new Error('Error cargando nave');
      }
    } catch (err) {
      console.error('Error fetchLastVessel:', err);
      setError('Error cargando datos de la nave');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveVessel = async (formData) => {
    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);

      const response = await fetch('/api/vessels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.token}`
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Error guardando nave');
      }

      const data = await response.json();

      if (data.job_id) {
        // Polling para resultado
        let jobComplete = false;
        while (!jobComplete) {
          const statusRes = await fetch(`/api/vessels/job/${data.job_id}`, {
            headers: { 'Authorization': `Bearer ${user?.token}` }
          });
          const statusData = await statusRes.json();

          if (statusData.state === 'completed') {
            setVessel(statusData.vessel);
            setSuccessMessage('Nave guardada correctamente');
            jobComplete = true;
          } else if (statusData.state === 'failed') {
            throw new Error('Error en cálculo de desplazamiento');
          } else {
            await new Promise(r => setTimeout(r, 1000));
          }
        }
      }

      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Error handleSaveVessel:', err);
      setError(err.message || 'Error guardando nave');
    } finally {
      setSaving(false);
    }
  };

  const handleContinue = () => {
    if (vessel) {
      localStorage.setItem('active_vessel_id', vessel.id);
      navigate('/voyage-setup');
    }
  };

  if (loading) {
    return (
      <div className="screen-p1">
        <p>Cargando datos de la nave...</p>
      </div>
    );
  }

  return (
    <div className="screen-p1">
      <header className="p1-header">
        <h1>Perfil de la Nave (P1.1)</h1>
        <p className="subtitle">
          Información técnica de tu embarcación.
        </p>
      </header>

      {error && (
        <div className="alert alert-error">
          <strong>Error:</strong> {error}
        </div>
      )}

      {successMessage && (
        <div className="alert alert-success">
          ✓ {successMessage}
        </div>
      )}

      <div className="p1-content">
        <VesselForm
          initialData={vessel}
          onSubmit={handleSaveVessel}
          loading={saving}
        />

        {vessel && (
          <>
            <DisplacementSummary vessel={vessel} />

            <div className="p1-actions">
              <button
                className="btn btn-primary btn-lg"
                onClick={handleContinue}
                disabled={saving}
              >
                Continuar a Configurar Viaje →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
