'use client';

import { etiquetaPreferenciaTema, siguientePreferenciaTema, type PreferenciaTema } from '@/lib/tema/tema';
import { tinta } from '@/lib/tema/tinta';
import { usePreferenciaTema } from './usePreferenciaTema';

function Icono({ preferencia }: { preferencia: PreferenciaTema }) {
  const comun = {
    width: 15,
    height: 15,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  if (preferencia === 'claro') {
    return (
      <svg {...comun}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    );
  }
  if (preferencia === 'oscuro') {
    return (
      <svg {...comun}>
        <path d="M20.5 14.5A8.5 8.5 0 019.5 3.5a8.5 8.5 0 1011 11z" />
      </svg>
    );
  }
  // Automático: medio círculo relleno.
  return (
    <svg {...comun}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 010 18z" fill="currentColor" />
    </svg>
  );
}

/**
 * Botón de tema: cada toque pasa de automático (el del teléfono) a claro, a oscuro y de vuelta.
 */
export default function BotonTema({ compacto = false }: { /** Solo el icono, para cabeceras con poco espacio. */ compacto?: boolean }) {
  const { preferencia, cambiar } = usePreferenciaTema();
  const siguiente = siguientePreferenciaTema(preferencia);

  return (
    <button
      type="button"
      onClick={() => cambiar(siguiente)}
      aria-label={`Tema: ${etiquetaPreferenciaTema(preferencia)}. Tocar para cambiar a ${etiquetaPreferenciaTema(siguiente)}.`}
      title="Tema claro u oscuro"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        height: '36px',
        width: compacto ? '36px' : undefined,
        justifyContent: 'center',
        padding: compacto ? 0 : '0 12px',
        borderRadius: '18px',
        border: `1px solid ${tinta(0.13)}`,
        background: tinta(0.07),
        color: 'var(--label-primary)',
        fontSize: '12px',
        fontWeight: 600,
        fontFamily: 'inherit',
        cursor: 'pointer',
        flexShrink: 0,
      }}
    >
      <Icono preferencia={preferencia} />
      {compacto ? null : <span suppressHydrationWarning>{etiquetaPreferenciaTema(preferencia)}</span>}
    </button>
  );
}
