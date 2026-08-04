import { useState, useEffect } from 'react';

export function useBiblioteca() {
  const [perfilUsuario, setPerfilUsuario] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem('tmarea_perfil_usuario');
    if (stored) {
      try { setPerfilUsuario(JSON.parse(stored)); } catch {}
    }
  }, []);

  const tipoActividad = perfilUsuario?.tipo_actividad || 'ALL';

  function filtrarPorPerfil(secciones) {
    if (!secciones) return [];
    return secciones.filter(s => {
      const perfiles = s.perfiles_permitidos || [];
      return (
        tipoActividad === 'ALL' ||
        perfiles.includes('ALL') ||
        perfiles.includes(tipoActividad)
      );
    });
  }

  return { perfilUsuario, tipoActividad, filtrarPorPerfil };
}
