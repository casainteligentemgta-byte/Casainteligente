/**
 * Obligaciones del trabajador en cláusula PRIMERA del contrato laboral.
 * Las 1–5 son genéricas (plantilla); se complementan con tareas/conocimientos
 * del oficio (ficha rasa o Gaceta por código) cuando existan.
 */

import { CARGOS_OBREROS, cargoPorCodigo } from '@/lib/constants/cargosObreros';
import { fichaRequisitosPorCodigo } from '@/lib/constants/requisitosOficiosGaceta';
import { fichaOficioRaso, stripGradoOficio } from '@/lib/talento/oficiosRasosObligaciones';

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

type ComplementoParts = { tareas: string; conocimientos: string; denominacion: string };

function complementoDesdeFuentes(opts: ObligacionesOficioOpts): ComplementoParts | null {
  // 1) Oficio raso (sin grado): preferido para listados de obra.
  const raso = fichaOficioRaso(opts.cargoNombre);
  if (raso) {
    return {
      tareas: raso.tareas,
      conocimientos: raso.conocimientos,
      denominacion: raso.denominacion,
    };
  }

  // 2) Ficha Gaceta por código (cuando está detallada).
  const codigo = resolverCodigoOficioParaObligaciones(opts);
  if (codigo) {
    const ficha = fichaRequisitosPorCodigo(codigo);
    if (ficha.estado === 'detallada') {
      const tareas = (ficha.tareas ?? '').trim();
      const conocimientos = (ficha.conocimientos ?? '').trim();
      if (tareas || conocimientos) {
        const denomRaso = stripGradoOficio(opts.cargoNombre ?? '') || stripGradoOficio(cargoPorCodigo(codigo)?.nombre);
        return {
          tareas,
          conocimientos,
          denominacion:
            denomRaso ||
            cargoPorCodigo(codigo)?.nombre ||
            `código ${codigo}`,
        };
      }
    }
  }

  return null;
}

/**
 * Texto complementario (puntos 6+) según ficha del oficio (rasa o Gaceta).
 * Vacío si no hay tareas/conocimientos.
 */
export function obligacionesComplementariasPorOficio(opts: ObligacionesOficioOpts): string {
  const src = complementoDesdeFuentes(opts);
  if (!src) return '';

  const tareas = src.tareas.trim();
  const conocimientos = src.conocimientos.trim();
  if (!tareas && !conocimientos) return '';

  let n = Math.max(6, Math.floor(opts.desdeNumero ?? 6));
  const parts: string[] = [];
  const denom = src.denominacion.trim() || 'su oficio';

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
