/**
 * Escala el documento de presupuesto para caber en una sola hoja A4 al imprimir / “Guardar como PDF”.
 * Chrome/Edge: `zoom` afecta la paginación. Otros: `transform` + colapso del espacio sobrante.
 */

export type FitPrintOnePageOptions = {
  /** Selector del bloque a medir (documento). */
  rootSelector?: string;
  /** Altura útil A4 en mm (297 − márgenes superior e inferior del @page). */
  usableHeightMm?: number;
  /** Factor de seguridad para evitar un segundo folio por redondeo. */
  safety?: number;
  /** Escala mínima (sigue siendo legible; por debajo el contenido ya es muy denso). */
  minScale?: number;
};

const DEFAULT_ROOT = '.sheet, .preview-doc';

/** Clase(s) de densidad según cantidad de ítems (HTML de impresión). */
export function sheetModifierForItemCount(nItems: number): string {
  if (nItems > 22) return ' sheet--compact sheet--many sheet--ultra';
  if (nItems > 14) return ' sheet--compact sheet--many';
  if (nItems > 7) return ' sheet--compact';
  return '';
}

export function fitPresupuestoPrintToOnePage(options?: FitPrintOnePageOptions): number {
  if (typeof document === 'undefined') return 1;

  const rootSelector = options?.rootSelector ?? DEFAULT_ROOT;
  const usableHeightMm = options?.usableHeightMm ?? 297 - 12;
  const safety = options?.safety ?? 0.985;
  const minScale = options?.minScale ?? 0.42;

  const el = document.querySelector(rootSelector) as HTMLElement | null;
  if (!el) return 1;

  resetFitStyles(el);

  void el.offsetHeight;

  const pxPerMm = 96 / 25.4;
  const usablePx = usableHeightMm * pxPerMm;
  const contentH = el.getBoundingClientRect().height;
  if (!(contentH > 0)) return 1;

  let scale = Math.min(1, (usablePx / contentH) * safety);
  scale = Math.max(minScale, scale);
  if (scale >= 0.999) return 1;

  const htmlStyle = document.documentElement.style as CSSStyleDeclaration & { zoom?: string };
  if (typeof htmlStyle.zoom !== 'undefined') {
    htmlStyle.zoom = String(scale);
  } else {
    el.style.transformOrigin = 'top left';
    el.style.transform = `scale(${scale})`;
    el.style.width = `${100 / scale}%`;
    const scaledH = contentH * scale;
    el.style.marginBottom = `${scaledH - contentH}px`;
  }
  return scale;
}

function resetFitStyles(el: HTMLElement) {
  const htmlStyle = document.documentElement.style as CSSStyleDeclaration & { zoom?: string };
  if (typeof htmlStyle.zoom !== 'undefined') htmlStyle.zoom = '';
  el.style.transform = '';
  el.style.transformOrigin = '';
  el.style.width = '';
  el.style.marginBottom = '';
}

/** Suscribe before/afterprint. Devuelve cleanup. */
export function attachFitPresupuestoPrintToOnePage(
  options?: FitPrintOnePageOptions,
): () => void {
  if (typeof window === 'undefined') return () => undefined;

  const rootSelector = options?.rootSelector ?? DEFAULT_ROOT;

  const run = () => {
    fitPresupuestoPrintToOnePage(options);
  };

  const after = () => {
    const el = document.querySelector(rootSelector) as HTMLElement | null;
    if (el) resetFitStyles(el);
    else {
      const htmlStyle = document.documentElement.style as CSSStyleDeclaration & { zoom?: string };
      if (typeof htmlStyle.zoom !== 'undefined') htmlStyle.zoom = '';
    }
  };

  window.addEventListener('beforeprint', run);
  window.addEventListener('afterprint', after);

  const mql = window.matchMedia?.('print');
  const onMql = (e: MediaQueryListEvent) => {
    if (e.matches) run();
    else after();
  };
  mql?.addEventListener?.('change', onMql);

  return () => {
    window.removeEventListener('beforeprint', run);
    window.removeEventListener('afterprint', after);
    mql?.removeEventListener?.('change', onMql);
    after();
  };
}

/**
 * Script embebible en el HTML de `/api/budgets/.../pdf`.
 * Misma lógica que `fitPresupuestoPrintToOnePage` (sin imports).
 */
export const PRESUPUESTO_PRINT_FIT_SCRIPT = `(function(){
  var ROOT = '.sheet';
  var USABLE_MM = 297 - 12;
  var SAFETY = 0.985;
  var MIN = 0.42;
  function reset(el){
    try { document.documentElement.style.zoom = ''; } catch (e) {}
    el.style.transform = '';
    el.style.transformOrigin = '';
    el.style.width = '';
    el.style.marginBottom = '';
  }
  function fit(){
    var el = document.querySelector(ROOT);
    if (!el) return;
    reset(el);
    void el.offsetHeight;
    var pxPerMm = 96 / 25.4;
    var usablePx = USABLE_MM * pxPerMm;
    var h = el.getBoundingClientRect().height;
    if (!(h > 0)) return;
    var scale = Math.min(1, (usablePx / h) * SAFETY);
    scale = Math.max(MIN, scale);
    if (scale >= 0.999) return;
    var htmlStyle = document.documentElement.style;
    if (typeof htmlStyle.zoom !== 'undefined') {
      htmlStyle.zoom = String(scale);
    } else {
      el.style.transformOrigin = 'top left';
      el.style.transform = 'scale(' + scale + ')';
      el.style.width = (100 / scale) + '%';
      el.style.marginBottom = ((h * scale) - h) + 'px';
    }
  }
  function after(){
    var el = document.querySelector(ROOT);
    if (el) reset(el);
    else try { document.documentElement.style.zoom = ''; } catch (e) {}
  }
  window.addEventListener('beforeprint', fit);
  window.addEventListener('afterprint', after);
  if (window.matchMedia) {
    try {
      var mql = window.matchMedia('print');
      if (mql && mql.addEventListener) {
        mql.addEventListener('change', function(e){ if (e.matches) fit(); else after(); });
      }
    } catch (e) {}
  }
})();`;
