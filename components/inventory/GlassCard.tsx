'use client';

import { ReactNode } from 'react';

interface GlassCardProps {
    children?: ReactNode;
    className?: string;
}

const panelStyle: React.CSSProperties = {
    background: 'rgba(28, 28, 30, 0.6)',
    backdropFilter: 'blur(24px) saturate(180%)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '24px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
};

/** Tarjeta estática (sin animación) para evitar errores de hidratación con Framer Motion. */
export const GlassCard = ({ children, className = '' }: GlassCardProps) => {
    return (
        <div className={`glass overflow-hidden ${className}`} style={panelStyle}>
            {children}
        </div>
    );
};
