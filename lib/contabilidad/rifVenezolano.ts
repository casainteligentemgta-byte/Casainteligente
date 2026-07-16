/**
 * RIF / cédula venezolana para compras.
 * Válido solo si empieza por V, J, E, G o P (persona / jurídico / gobierno / pasaporte).
 */

const RIF_CON_DIGITO = /^([VEJPG])-?(\d{6,8})-(\d)$/i;
const RIF_SIN_DIGITO = /^([VEJPG])-?(\d{6,9})$/i;
const RIF_EN_TEXTO = /\b([VEJPG])[-.\s]?(\d{6,9})(?:[-.\s](\d))?\b/i;

/** True si el texto es un RIF/CI venezolano (empieza por V/J/E/G/P + dígitos). */
export function esRifVenezolano(raw: string | null | undefined): boolean {
  return Boolean(normalizarRifVenezolano(raw));
}

/** Formato canónico `V-12345678` o `J-12345678-9`. Vacío si no es RIF. */
export function normalizarRifVenezolano(raw: string | null | undefined): string {
  const s = String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s.]+/g, '');
  if (!s) return '';

  // Con guión de dígito verificador: J-12345678-9
  const con = s.match(RIF_CON_DIGITO);
  if (con) return `${con[1]!.toUpperCase()}-${con[2]}-${con[3]}`;

  // Compacto 9 dígitos tras letra → último es verificador (J123456789)
  const solo = s.replace(/-/g, '');
  const m9 = solo.match(/^([VEJPG])(\d{8})(\d)$/i);
  if (m9) return `${m9[1]!.toUpperCase()}-${m9[2]}-${m9[3]}`;

  const sin = s.match(RIF_SIN_DIGITO);
  if (sin) return `${sin[1]!.toUpperCase()}-${sin[2]}`;

  return '';
}

/** Extrae un RIF embebido en un nombre u otro texto. */
export function extraerRifDeTexto(raw: string | null | undefined): string {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  const directo = normalizarRifVenezolano(s);
  if (directo) return directo;
  const m = s.match(RIF_EN_TEXTO);
  if (!m) return '';
  return normalizarRifVenezolano(`${m[1]}${m[2]}${m[3] ?? ''}`);
}

/**
 * Separa proveedor vs RIF cuando vienen mezclados o en columnas cruzadas.
 * - RIF solo acepta V/J/E/G/P…
 * - Si la columna RIF trae un nombre, se usa como proveedor
 * - Si el proveedor trae un RIF embebido, se extrae
 */
export function resolverProveedorYRif(input: {
  proveedor: string;
  rif: string;
}): { supplier_name: string; supplier_rif: string } {
  let nombre = String(input.proveedor ?? '').trim();
  let rifRaw = String(input.rif ?? '').trim();

  let rif = normalizarRifVenezolano(rifRaw);
  if (!rif) {
    rif = extraerRifDeTexto(rifRaw);
  }

  // Columna RIF trae un nombre (no empieza por V/J…)
  if (!rif && rifRaw && !esRifVenezolano(rifRaw)) {
    if (!nombre) nombre = rifRaw;
    rifRaw = '';
  }

  // Proveedor es en realidad un RIF y el nombre está en la otra columna
  if (!nombre && rif) {
    /* nombre queda vacío */
  } else if (nombre && esRifVenezolano(nombre) && !rif) {
    rif = normalizarRifVenezolano(nombre);
    nombre = rifRaw && !esRifVenezolano(rifRaw) ? rifRaw : '';
  } else if (nombre && !rif) {
    const embebido = extraerRifDeTexto(nombre);
    if (embebido) {
      rif = embebido;
      nombre = nombre
        .replace(RIF_EN_TEXTO, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
  }

  return {
    supplier_name: nombre,
    supplier_rif: rif,
  };
}

/** Placeholder al guardar si aún no hay RIF (cumple letra V/J; no es un nombre). */
export const RIF_PENDIENTE_PLACEHOLDER = 'V-00000000-0';

export function rifParaGuardarCompra(raw: string | null | undefined): string {
  return normalizarRifVenezolano(raw) || RIF_PENDIENTE_PLACEHOLDER;
}

/** Para UI: oculta placeholders y textos que no son RIF. */
export function etiquetaRifCompra(raw: string | null | undefined): string {
  const s = String(raw ?? '').trim();
  if (!s) return '—';
  if (/^SIN[-_]?RIF$/i.test(s)) return '—';
  if (s === RIF_PENDIENTE_PLACEHOLDER) return '—';
  const n = normalizarRifVenezolano(s);
  return n || '—';
}
