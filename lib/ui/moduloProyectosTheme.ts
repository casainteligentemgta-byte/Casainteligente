import type { CSSProperties } from 'react';

/** Contenedor principal del módulo integral de proyectos (fondo claro / papel). */
export const moduloProyectosPageShell: CSSProperties = {
  minHeight: '100vh',
  background: '#F3F4F6',
  paddingBottom: '110px',
};

export const moduloProyectosStickyHeader: CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 50,
  background: 'rgba(255,255,255,0.92)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  padding: '16px 20px',
  borderBottom: '1px solid #E2E8F0',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: '12px',
};

export const moduloProyectosGlass: CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid #E2E8F0',
  borderRadius: '20px',
  boxShadow: '0 8px 24px rgba(15,23,42,0.06)',
};

export const moduloProyectosInput: CSSProperties = {
  width: '100%',
  background: '#F8FAFC',
  border: '1px solid #E2E8F0',
  borderRadius: '12px',
  padding: '10px 14px',
  color: '#0F172A',
  fontSize: '14px',
  outline: 'none',
};
