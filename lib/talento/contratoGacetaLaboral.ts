import { cargoPorCodigo } from '@/lib/constants/cargosObreros';
import { SALARIO_BASICO_DIARIO_VES_POR_NIVEL } from '@/lib/nomina/tabuladorSalariosConstruccion2023';

export const FORMAS_PAGO = ['transferencia', 'efectivo', 'pago_movil'] as const;
export type FormaPagoContrato = (typeof FORMAS_PAGO)[number];

export const JORNADAS_TRABAJO = ['diurna', 'nocturna', 'mixta'] as const;
export type JornadaTrabajoContrato = (typeof JORNADAS_TRABAJO)[number];

export const TIPOS_CONTRATO = ['tiempo_determinado', 'tiempo_indeterminado'] as const;
export type TipoContratoLaboral = (typeof TIPOS_CONTRATO)[number];

export function salarioBasicoDiarioVesDesdeNivel(nivel: number | null | undefined): number | null {
  if (nivel == null || !Number.isFinite(nivel)) return null;
  const n = Math.round(Number(nivel));
  if (n < 1 || n > 9) return null;
  return SALARIO_BASICO_DIARIO_VES_POR_NIVEL[n - 1] ?? null;
}

/** Denominación oficial del tabulador si el código existe en catálogo Gaceta 2023. */
export function denominacionOficioGaceta(codigo: string | null | undefined): string | null {
  const c = (codigo ?? '').trim();
  if (!c) return null;
  const row = cargoPorCodigo(c);
  return row?.nombre ?? null;
}

export function objetoContratoDesdeOficio(params: {
  denominacionTrabajo: string;
  codigoTabulador: string | null | undefined;
}): string {
  const den = params.denominacionTrabajo.trim() || 'el oficio contratado';
  const cod = (params.codigoTabulador ?? '').trim();
  const suf = cod
    ? ` Corresponde al oficio código ${cod} del tabulador de la Gaceta Oficial (Convención Colectiva de la Construcción).`
    : ' Aplica el tabulador de oficios y salarios de la Convención Colectiva de la Construcción vigente.';
  return `El objeto del presente contrato es la prestación de servicios personales para ejecutar las labores propias de ${den}.${suf}`;
}

export function lugarPrestacionServicio(nombreSitio: string, ubicacion: string | null | undefined): string {
  const n = nombreSitio.trim();
  const u = (ubicacion ?? '').trim();
  if (n && u) return `${n} — ${u}`;
  return n || u || '—';
}

export function parseFormaPago(v: unknown): FormaPagoContrato | null {
  const s = String(v ?? '').trim().toLowerCase();
  return (FORMAS_PAGO as readonly string[]).includes(s) ? (s as FormaPagoContrato) : null;
}

export function parseJornada(v: unknown): JornadaTrabajoContrato | null {
  const s = String(v ?? '').trim().toLowerCase();
  return (JORNADAS_TRABAJO as readonly string[]).includes(s) ? (s as JornadaTrabajoContrato) : null;
}

export function parseTipoContrato(v: unknown): TipoContratoLaboral | null {
  const s = String(v ?? '').trim().toLowerCase();
  return (TIPOS_CONTRATO as readonly string[]).includes(s) ? (s as TipoContratoLaboral) : null;
}
