/**
 * Tema claro / oscuro de la aplicación.
 *
 * Cada persona elige entre «automático» (lo que tenga su teléfono), «claro» u «oscuro».
 * La elección se guarda en su navegador. En la página queda como `data-theme="light"` o
 * `data-theme="dark"` sobre <html>, y los colores salen de variables CSS (app/globals.css
 * y app/tema-claro.css).
 *
 * El tema claro se va activando módulo por módulo: solo las rutas de RUTAS_CON_TEMA lo
 * muestran; las demás siguen en oscuro hasta que se revisen.
 */

export type PreferenciaTema = 'auto' | 'claro' | 'oscuro';
export type TemaResuelto = 'light' | 'dark';

/** Clave en localStorage. */
export const CLAVE_TEMA = 'ci-tema';

/** Aviso entre componentes de la misma pestaña cuando cambia la preferencia. */
export const EVENTO_TEMA = 'ci-tema-cambio';

/** Módulos ya revisados en claro y oscuro. Una ruta entra aquí cuando se ha visto en ambos. */
export const RUTAS_CON_TEMA = ['/clientes', '/productos', '/presupuestos', '/ventas'] as const;

/**
 * Dentro de esos módulos, pantallas que conservan su propio aspecto: la vista previa del
 * presupuesto es el documento que se imprime y se envía, siempre en papel blanco.
 */
export const RUTAS_SIN_TEMA = ['/ventas/preview'] as const;

const ORDEN: PreferenciaTema[] = ['auto', 'claro', 'oscuro'];

export function leerPreferenciaTema(valor: unknown): PreferenciaTema {
  return valor === 'claro' || valor === 'oscuro' ? valor : 'auto';
}

export function resolverTema(preferencia: PreferenciaTema, telefonoEnOscuro: boolean): TemaResuelto {
  if (preferencia === 'claro') return 'light';
  if (preferencia === 'oscuro') return 'dark';
  return telefonoEnOscuro ? 'dark' : 'light';
}

/** El botón recorre: automático → claro → oscuro → automático. */
export function siguientePreferenciaTema(actual: PreferenciaTema): PreferenciaTema {
  return ORDEN[(ORDEN.indexOf(actual) + 1) % ORDEN.length];
}

export function etiquetaPreferenciaTema(preferencia: PreferenciaTema): string {
  if (preferencia === 'claro') return 'Claro';
  if (preferencia === 'oscuro') return 'Oscuro';
  return 'Auto';
}

/** ¿Esta pantalla ya tiene tema claro? */
export function rutaConTema(pathname: string | null | undefined): boolean {
  const p = String(pathname ?? '');
  const bajo = (r: string) => p === r || p.startsWith(`${r}/`);
  return RUTAS_CON_TEMA.some(bajo) && !RUTAS_SIN_TEMA.some(bajo);
}

/**
 * Se ejecuta en <head> antes de pintar, para que la página no parpadee en oscuro y luego
 * cambie a claro. Hace lo mismo que `resolverTema` (hay una prueba que lo comprueba).
 * Si algo falla (navegador sin almacenamiento), queda en oscuro, como siempre fue.
 */
export const SCRIPT_TEMA_INICIAL = `(function(){var d=document.documentElement;try{var p=localStorage.getItem('${CLAVE_TEMA}');var o=window.matchMedia('(prefers-color-scheme: dark)').matches;d.setAttribute('data-theme',p==='claro'?'light':p==='oscuro'?'dark':(o?'dark':'light'));}catch(e){d.setAttribute('data-theme','dark');}})();`;
