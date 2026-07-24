/** Número entero no negativo menor a 1.000.000 a palabras en español (minúsculas). */
export function numeroALetrasHastaMiles(valor: number): string {
  const n = Math.floor(Math.abs(valor));
  const unidades = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
  const especiales = [
    'diez',
    'once',
    'doce',
    'trece',
    'catorce',
    'quince',
    'dieciseis',
    'diecisiete',
    'dieciocho',
    'diecinueve',
  ];
  const decenas = ['', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
  const centenas = [
    '',
    'ciento',
    'doscientos',
    'trescientos',
    'cuatrocientos',
    'quinientos',
    'seiscientos',
    'setecientos',
    'ochocientos',
    'novecientos',
  ];

  function hasta99(x: number): string {
    if (x < 10) return unidades[x] ?? 'cero';
    if (x < 20) return especiales[x - 10] ?? 'cero';
    if (x < 30) return x === 20 ? 'veinte' : `veinti${unidades[x - 20] ?? ''}`;
    const d = Math.floor(x / 10);
    const u = x % 10;
    return u === 0 ? decenas[d] ?? '' : `${decenas[d] ?? ''} y ${unidades[u] ?? ''}`;
  }

  function hasta999(x: number): string {
    if (x === 0) return 'cero';
    if (x === 100) return 'cien';
    if (x < 100) return hasta99(x);
    const c = Math.floor(x / 100);
    const r = x % 100;
    return r === 0 ? (centenas[c] ?? '') : `${centenas[c] ?? ''} ${hasta99(r)}`;
  }

  if (n < 1000) return hasta999(n);
  if (n < 1000000) {
    const miles = Math.floor(n / 1000);
    const resto = n % 1000;
    const pref = miles === 1 ? 'mil' : `${hasta999(miles)} mil`;
    return resto === 0 ? pref : `${pref} ${hasta999(resto)}`;
  }
  return String(n);
}

function tituloPalabras(s: string): string {
  return s
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Formato tipo acta: «Seiscientos Ochenta Bolívares con Cuarenta Céntimos» + cifras «(680,40 Bs.)».
 */
export function montoBolivaresSemanalFormalLetrasYCifras(bs: number): { enLetras: string; enCifrasParentesis: string } {
  const abs = Math.abs(Number.isFinite(bs) ? bs : 0);
  const enteros = Math.floor(abs);
  const cent = Math.round((abs - enteros) * 100);
  const entTit = tituloPalabras(numeroALetrasHastaMiles(enteros));
  let enLetras: string;
  if (cent === 0) {
    enLetras = `${entTit} Bolívares`;
  } else if (cent === 1) {
    enLetras = `${entTit} Bolívares con Un Céntimo`;
  } else {
    enLetras = `${entTit} Bolívares con ${tituloPalabras(numeroALetrasHastaMiles(cent))} Céntimos`;
  }
  const cif = abs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return { enLetras, enCifrasParentesis: `(${cif} Bs.)` };
}
