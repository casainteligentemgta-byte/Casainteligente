'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CLAVE_TEMA,
  EVENTO_TEMA,
  leerPreferenciaTema,
  resolverTema,
  type PreferenciaTema,
} from '@/lib/tema/tema';

function preferenciaGuardada(): PreferenciaTema {
  try {
    return leerPreferenciaTema(window.localStorage.getItem(CLAVE_TEMA));
  } catch {
    return 'auto';
  }
}

function telefonoEnOscuro(): boolean {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return true;
  }
}

/** Pone en <html> el tema que corresponde a la preferencia actual. */
export function aplicarTema(preferencia: PreferenciaTema = preferenciaGuardada()): void {
  document.documentElement.setAttribute('data-theme', resolverTema(preferencia, telefonoEnOscuro()));
}

/**
 * Preferencia de tema de esta persona en este navegador.
 * Antes de montar devuelve «auto» para que servidor y navegador pinten lo mismo.
 */
export function usePreferenciaTema(): {
  preferencia: PreferenciaTema;
  cambiar: (nueva: PreferenciaTema) => void;
} {
  const [preferencia, setPreferencia] = useState<PreferenciaTema>('auto');

  useEffect(() => {
    const sincronizar = () => {
      const p = preferenciaGuardada();
      setPreferencia(p);
      aplicarTema(p);
    };
    sincronizar();

    // Cambia el teléfono de claro a oscuro, otra pestaña cambia la preferencia, u otro botón de esta página.
    let medio: MediaQueryList | null = null;
    try {
      medio = window.matchMedia('(prefers-color-scheme: dark)');
      medio.addEventListener('change', sincronizar);
    } catch {
      medio = null;
    }
    window.addEventListener('storage', sincronizar);
    window.addEventListener(EVENTO_TEMA, sincronizar);
    return () => {
      medio?.removeEventListener('change', sincronizar);
      window.removeEventListener('storage', sincronizar);
      window.removeEventListener(EVENTO_TEMA, sincronizar);
    };
  }, []);

  const cambiar = useCallback((nueva: PreferenciaTema) => {
    try {
      if (nueva === 'auto') window.localStorage.removeItem(CLAVE_TEMA);
      else window.localStorage.setItem(CLAVE_TEMA, nueva);
    } catch {
      // Sin almacenamiento: el cambio vale mientras la página siga abierta.
    }
    setPreferencia(nueva);
    aplicarTema(nueva);
    window.dispatchEvent(new Event(EVENTO_TEMA));
  }, []);

  return { preferencia, cambiar };
}
