import { diasHastaVencimiento } from '@/lib/configuracion/validarEntidadPatrono';
import type { PermisologiaCi } from '@/types/ci-entidad';

export const PERMISOLOGIA_CAMPOS = [
  'ivss_vence',
  'inces_vence',
  'solvencia_laboral_vence',
] as const;

export type PermisologiaCampo = (typeof PERMISOLOGIA_CAMPOS)[number];

export const PERMISOLOGIA_ETIQUETAS: Record<PermisologiaCampo, string> = {
  ivss_vence: 'IVSS',
  inces_vence: 'INCES',
  solvencia_laboral_vence: 'Solvencia laboral',
};

/** Ventanas de alerta (días restantes): 30 / 15 / 5 / 0 (hoy o vencido). */
export type PermisologiaAlertDays = 0 | 5 | 15 | 30;

export type PermisologiaVencimientoItem = {
  entidad_id: string;
  entidad_nombre: string;
  entidad_rif: string | null;
  campo: PermisologiaCampo;
  etiqueta: string;
  fecha_vence: string;
  dias_restantes: number;
  alert_days: PermisologiaAlertDays;
  estado: 'vencido' | 'hoy' | 'proximo';
};

export function parsePermisologia(raw: unknown): PermisologiaCi {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const pick = (k: string): string | undefined => {
    const v = o[k];
    return typeof v === 'string' && v.trim() ? v.trim().slice(0, 10) : undefined;
  };
  return {
    ivss_vence: pick('ivss_vence'),
    inces_vence: pick('inces_vence'),
    solvencia_laboral_vence: pick('solvencia_laboral_vence'),
  };
}

export function bucketAlertDays(dias: number): PermisologiaAlertDays | null {
  if (dias <= 0) return 0;
  if (dias <= 5) return 5;
  if (dias <= 15) return 15;
  if (dias <= 30) return 30;
  return null;
}

export function estadoDesdeDias(dias: number): PermisologiaVencimientoItem['estado'] {
  if (dias < 0) return 'vencido';
  if (dias === 0) return 'hoy';
  return 'proximo';
}

export function extraerVencimientosEntidad(params: {
  id: string;
  nombre: string;
  rif: string | null;
  permisologia: unknown;
}): PermisologiaVencimientoItem[] {
  const perm = parsePermisologia(params.permisologia);
  const out: PermisologiaVencimientoItem[] = [];

  for (const campo of PERMISOLOGIA_CAMPOS) {
    const fecha = perm[campo];
    if (!fecha) continue;
    const dias = diasHastaVencimiento(fecha);
    if (dias == null) continue;
    const alert_days = bucketAlertDays(dias);
    if (alert_days == null) continue;
    out.push({
      entidad_id: params.id,
      entidad_nombre: params.nombre,
      entidad_rif: params.rif,
      campo,
      etiqueta: PERMISOLOGIA_ETIQUETAS[campo],
      fecha_vence: fecha,
      dias_restantes: dias,
      alert_days,
      estado: estadoDesdeDias(dias),
    });
  }

  return out;
}

export function textoDiasRestantes(dias: number): string {
  if (dias < 0) return `vencido hace ${Math.abs(dias)} día${Math.abs(dias) === 1 ? '' : 's'}`;
  if (dias === 0) return 'vence hoy';
  return `vence en ${dias} día${dias === 1 ? '' : 's'}`;
}
