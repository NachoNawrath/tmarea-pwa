import React, { useState } from 'react';

const MENU_ITEMS = [
  { icon: '👤', label: 'Mi Perfil',            screen: 'perfil' },
  { icon: '🚢', label: 'Mi Embarcación',        screen: 'p1' },
  { icon: '🧭', label: 'Planificar Navegación', screen: 'p2' },
  { icon: '📚', label: 'Biblioteca Náutica',    screen: 'biblioteca' },
  { icon: '⚠️', label: 'Reportar Problema',     screen: 'reportar' },
];

// Map every app screen to the matching sidebar entry
const SCREEN_TO_MENU = {
  perfil:     'perfil',
  p1:         'p1',
  p2:         'p2',
  p3:         'p2',
  p4:         'p2',
  biblioteca: 'biblioteca',
  reportar:   'reportar',
};

export default function AppSidebar({ currentScreen, onNavigate }) {
  const [open, setOpen] = useState(false);
  const activeMenu = SCREEN_TO_MENU[currentScreen];

  const handleNavigate = (screen) => {
    setOpen(false);
    onNavigate(screen);
  };

  return (
    <>
      {/* Hamburger button — fixed top-left on all screens */}
      <button
        onClick={() => setOpen(true)}
        style={styles.hamburger}
        aria-label="Abrir menú"
      >
        ☰
      </button>

      {/* Semi-transparent overlay */}
      {open && (
        <div style={styles.overlay} onClick={() => setOpen(false)} />
      )}

      {/* Sliding drawer */}
      <div style={{ ...styles.drawer, transform: open ? 'translateX(0)' : 'translateX(-100%)' }}>
        <div style={styles.drawerHeader}>
          <span style={styles.logo}>
            T<span style={{ color: '#1A6EBD' }}>m</span>area
          </span>
          <button onClick={() => setOpen(false)} style={styles.closeBtn} aria-label="Cerrar menú">
            ✕
          </button>
        </div>

        <nav style={styles.nav}>
          {MENU_ITEMS.map((item) => (
            <button
              key={item.screen}
              onClick={() => handleNavigate(item.screen)}
              style={{
                ...styles.navItem,
                ...(activeMenu === item.screen ? styles.navItemActive : {}),
              }}
            >
              <span style={styles.navIcon}>{item.icon}</span>
              <span style={styles.navLabel}>{item.label}</span>
            </button>
          ))}
        </nav>

        <div style={styles.drawerFooter}>
          <p style={styles.footerText}>Tmarea — Navega con Certeza</p>
        </div>
      </div>
    </>
  );
}

const styles = {
  hamburger: {
    position: 'fixed',
    top: 12,
    left: 12,
    zIndex: 200,
    background: 'rgba(4,44,83,0.88)',
    border: 'none',
    borderRadius: 8,
    color: '#fff',
    fontSize: 22,
    width: 40,
    height: 40,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
    lineHeight: 1,
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.52)',
    zIndex: 300,
  },
  drawer: {
    position: 'fixed',
    top: 0,
    left: 0,
    bottom: 0,
    width: '80%',
    maxWidth: 320,
    backgroundColor: '#042C53',
    zIndex: 400,
    display: 'flex',
    flexDirection: 'column',
    transition: 'transform 300ms ease',
    boxShadow: '4px 0 24px rgba(0,0,0,0.45)',
  },
  drawerHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 20px 16px',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
  },
  logo: {
    fontFamily: 'Arial',
    fontWeight: 800,
    fontSize: 24,
    color: '#fff',
    letterSpacing: 0,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'rgba(255,255,255,0.5)',
    fontSize: 18,
    cursor: 'pointer',
    padding: 4,
    lineHeight: 1,
  },
  nav: {
    flex: 1,
    padding: '10px 0',
    overflowY: 'auto',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    width: '100%',
    padding: '14px 20px 14px 17px',  // 17px = 20px - 3px border width
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderLeftWidth: 3,
    borderLeftStyle: 'solid',
    borderLeftColor: 'transparent',
    color: '#b8cfe0',
    fontSize: 15,
    fontFamily: 'system-ui, Arial, sans-serif',
    cursor: 'pointer',
    textAlign: 'left',
    boxSizing: 'border-box',
    outline: 'none',
  },
  navItemActive: {
    backgroundColor: 'rgba(26,110,189,0.22)',
    borderLeftColor: '#1A6EBD',
    color: '#fff',
  },
  navIcon: {
    fontSize: 20,
    minWidth: 28,
    textAlign: 'center',
  },
  navLabel: {
    fontWeight: 500,
  },
  drawerFooter: {
    padding: '16px 20px',
    borderTop: '1px solid rgba(255,255,255,0.08)',
  },
  footerText: {
    margin: 0,
    color: 'rgba(255,255,255,0.25)',
    fontSize: 12,
    fontFamily: 'Arial',
  },
};
