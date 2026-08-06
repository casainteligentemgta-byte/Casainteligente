/**
 * Obligaciones del trabajador en cláusula PRIMERA del contrato laboral.
 * Las 1–5 son genéricas (plantilla); se complementan con tareas/conocimientos
 * del oficio según ficha Gaceta (`requisitosOficiosGaceta`) cuando existan.
 */

import { CARGOS_OBREROS, cargoPorCodigo } from '@/lib/constants/cargosObreros';
import { fichaRequisitosPorCodigo } from '@/lib/constants/requisitosOficiosGaceta';

/** Puntos 1–5 fijos (texto tras «se obliga a:»). */
export const OBLIGACIONES_GENERICAS_NUMERADAS =
  '1.- Poner a disposición su capacidad normal de trabajo en forma exclusiva y en las labores anexas complementarias. 2.- Ejecutar las actividades inherentes al cargo, incluyendo recibir, procesar y pesar materia prima cuando sea requerido. 3.- Usar obligatoriamente el uniforme y equipos de protección (guantes, lentes, botas, etc.) según la LOPCYMAT. 4.- Mantener el orden del área asignada y el buen estado de maquinarias y herramientas. 5.- No prestar servicios a otros empleadores ni trabajar por cuenta propia en funciones inherentes al cargo.';

function normOficioKey(raw: string | null | undefined): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.\u00B7]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Normaliza código tabulador (`2.1`, `2,1`, `2-1` → `2.1`). */
export function normalizarCodigoOficioTabulador(raw: string | null | undefined): string | null {
  const t = String(raw ?? '').trim();
  if (!t) return null;
  const m = t.match(/^(\d{1,2})\s*[.\-,]\s*(\d{1,2})$/);
  if (m) return `${Number(m[1])}.${Number(m[2])}`;
  if (/^\d{1,2}\.\d{1,2}$/.test(t)) return t;
  return t;
}

/** Resuelve código Gaceta desde código o denominación del oficio. */
export function resolverCodigoOficioParaObligaciones(opts: {
  cargoCodigo?: string | null;
  cargoNombre?: string | null;
}): string | null {
  const fromCod = normalizarCodigoOficioTabulador(opts.cargoCodigo);
  if (fromCod && cargoPorCodigo(fromCod)) return fromCod;

  const nombre = normOficioKey(opts.cargoNombre);
  if (!nombre) return fromCod;

  for (const c of CARGOS_OBREROS) {
    if (normOficioKey(c.nombre) === nombre) return c.codigo;
  }
  // Coincidencia parcial (p. ej. «Carpintero» vs «CARPINTERO DE 2da.»)
  let best: { codigo: string; score: number } | null = null;
  for (const c of CARGOS_OBREROS) {
    const cn = normOficioKey(c.nombre);
    if (!cn) continue;
    if (nombre.includes(cn) || cn.includes(nombre)) {
      const score = Math.min(nombre.length, cn.length) / Math.max(nombre.length, cn.length);
      if (!best || score > best.score) best = { codigo: c.codigo, score };
    }
  }
  if (best && best.score >= 0.45) return best.codigo;
  return fromCod;
}

export type ObligacionesOficioOpts = {
  cargoCodigo?: string | null;
  cargoNombre?: string | null;
  /** Primer número del complemento (tras las 5 genéricas). Default 6. */
  desdeNumero?: number;
};

/**
 * Texto complementario (puntos 6+) según ficha del oficio.
 * Vacío si no hay tareas/conocimientos en la referencia Gaceta.
 */
export function obligacionesComplementariasPorOficio(opts: ObligacionesOficioOpts): string {
  const codigo = resolverCodigoOficioParaObligaciones(opts);
  if (!codigo) return '';

  const ficha = fichaRequisitosPorCodigo(codigo);
  if (ficha.estado !== 'detallada') return '';

  const tareas = (ficha.tareas ?? '').trim();
  const conocimientos = (ficha.conocimientos ?? '').trim();
  if (!tareas && !conocimientos) return '';

  const denom =
    (opts.cargoNombre ?? '').trim() ||
    cargoPorCodigo(codigo)?.nombre ||
    `código ${codigo}`;

  let n = Math.max(6, Math.floor(opts.desdeNumero ?? 6));
  const parts: string[] = [];

  if (tareas) {
    parts.push(
      `${n}.- Ejecutar las tareas propias del oficio de ${denom} conforme al tabulador de la Convención Colectiva, a saber: ${tareas.replace(/\.$/, '')}.`,
    );
    n += 1;
  }
  if (conocimientos) {
    parts.push(
      `${n}.- Aplicar los conocimientos técnicos propios de dicho oficio (${conocimientos.replace(/\.$/, '')}) en las labores asignadas por LA ENTIDAD DE TRABAJO.`,
    );
  }

  return parts.join(' ');
}

/**
 * Bloque completo tras «se obliga a:»: genéricas + complemento por oficio (si hay).
 */
export function textoObligacionesTrabajadorContrato(opts: ObligacionesOficioOpts): string {
  const complemento = obligacionesComplementariasPorOficio(opts);
  if (!complemento) return OBLIGACIONES_GENERICAS_NUMERADAS;
  return `${OBLIGACIONES_GENERICAS_NUMERADAS} ${complemento}`;
}
