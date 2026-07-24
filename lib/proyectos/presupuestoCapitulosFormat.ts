/** Formato numérico y texto para reporte «Presupuesto por capítulos» (estilo Lulo). */

function hasta999(n: number): string {
  const unidades = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
  const especiales = [
    'diez', 'once', 'doce', 'trece', 'catorce', 'quince',
    'dieciseis', 'diecisiete', 'dieciocho', 'diecinueve',
  ];
  const decenas = ['', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
  const centenas = [
    '', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos',
    'seiscientos', 'setecientos', 'ochocientos', 'novecientos',
  ];

  function hasta99(x: number): string {
    if (x < 10) return unidades[x] ?? 'cero';
    if (x < 20) return especiales[x - 10] ?? 'cero';
    if (x < 30) return x === 20 ? 'veinte' : `veinti${unidades[x - 20] ?? ''}`;
    const d = Math.floor(x / 10);
    const u = x % 10;
    return u === 0 ? decenas[d] ?? '' : `${decenas[d] ?? ''} y ${unidades[u] ?? ''}`;
  }

  if (n === 0) return 'cero';
  if (n === 100) return 'cien';
  if (n < 100) return hasta99(n);
  const c = Math.floor(n / 100);
  const r = n % 100;
  return r === 0 ? (centenas[c] ?? '') : `${centenas[c] ?? ''} ${hasta99(r)}`;
}

function bloqueMiles(n: number): string {
  if (n < 1000) return hasta999(n);
  const miles = Math.floor(n / 1000);
  const resto = n % 1000;
  const pref = miles === 1 ? 'mil' : `${hasta999(miles)} mil`;
  return resto === 0 ? pref : `${pref} ${hasta999(resto)}`;
}

function enteroALetras(n: number): string {
  const x = Math.floor(Math.abs(n));
  if (x < 1_000_000) return bloqueMiles(x);
  const millones = Math.floor(x / 1_000_000);
  const resto = x % 1_000_000;
  const pref = millones === 1 ? 'un millón' : `${bloqueMiles(millones)} millones`;
  return resto === 0 ? pref : `${pref} ${bloqueMiles(resto)}`;
}

/** Ej: 761.602,56 → SETECIENTOS SESENTA Y UN MIL SEISCIENTOS DOS CON 56/100 */
export function montoUsdEnLetrasMayus(valor: number): string {
  const abs = Math.abs(Number.isFinite(valor) ? valor : 0);
  const enteros = Math.floor(abs);
  const cent = Math.round((abs - enteros) * 100);
  let txt = enteroALetras(enteros).toUpperCase();
  if (cent > 0) txt += ` CON ${String(cent).padStart(2, '0')}/100`;
  return txt;
}

/** Separador miles «.» y decimales «,» (es-VE / Lulo). */
export function fmtMontoLulo(n: number, dec = 2): string {
  return n.toLocaleString('es-VE', {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
}

export function fmtPorcentajeLulo(n: number): string {
  return n.toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function nombreCapituloLulo(descripcion: string, codigo: string): string {
  const d = descripcion.trim();
  if (d) return d.toUpperCase();
  const c = codigo.trim();
  return c ? `CAPÍTULO ${c}`.toUpperCase() : 'SIN CAPÍTULO';
}

export function rangoPartidasLulo(desde: number, hasta: number): string {
  if (desde <= 0 || hasta <= 0) return '';
  if (desde === hasta) return `(${desde})`;
  return `(${desde} al ${hasta})`;
}
