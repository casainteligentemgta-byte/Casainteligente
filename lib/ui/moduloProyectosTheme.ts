import type { CSSProperties } from 'react';

/** Contenedor principal del módulo integral de proyectos (alineado a Presupuestos / tema iOS oscuro). */
export const moduloProyectosPageShell: CSSProperties = {
  minHeight: '100vh',
  background: 'var(--bg-primary)',
  paddingBottom: '110px',
};

export const moduloProyectosStickyHeader: CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 50,
  background: 'rgba(0,0,0,0.85)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  padding: '16px 20px',
  borderBottom: '1px solid rgba(255,255,255,0.1)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: '12px',
};

export const moduloProyectosGlass: CSSProperties = {
  background: 'rgba(28, 28, 30, 0.7)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: '20px',
};

export const moduloProyectosInput: CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '12px',
  padding: '10px 14px',
  color: 'white',
  fontSize: '14px',
  outline: 'none',
};
