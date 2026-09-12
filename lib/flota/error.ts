import { NextResponse } from 'next/server';
import { formatErrorMessage } from '@/lib/utils/formatErrorMessage';
import { FLOTA_MIGRACION } from '@/lib/flota/utils';

type ErrorConCodigo = {
  code?: string | number;
  message?: string;
  details?: string;
  hint?: string;
};

function codigoDe(err: unknown): string {
  if (!err || typeof err !== 'object') return '';
  const code = (err as ErrorConCodigo).code;
  return code == null ? '' : String(code);
}

function textoDe(err: unknown): string {
  return `${codigoDe(err)} ${formatErrorMessage(err)}`.toLowerCase();
}

export function mensajeErrorFlota(err: unknown, fallback = 'Error en flota'): string {
  const raw = formatErrorMessage(err);
  const code = codigoDe(err);
  const text = textoDe(err);

  if (code === '23505' || /duplicate key|unique constraint|already exists/.test(text)) {
    if (/cedula|cédula|numero_cedula/.test(text)) {
      return 'Ya existe un conductor con esta cédula.';
    }
    return 'Ya existe un registro con esos datos.';
  }
  if (code === '23503' || /foreign key|violates foreign key/.test(text)) {
    return 'La entidad o el vehículo asignado no existe.';
  }
  if (
    code === '42P01' ||
    code === 'PGRST205' ||
    /relation .* does not exist|could not find the table/.test(text)
  ) {
    return `Falta aplicar la migración ${FLOTA_MIGRACION} en Supabase SQL Editor y ejecutar notify pgrst, 'reload schema';`;
  }
  if (code === '42501' || /row-level security|permission denied|rls/.test(text)) {
    return 'No tiene permiso para esta operación.';
  }

  if (!raw || raw === 'Error desconocido') return fallback;
  return raw;
}

export function throwFlotaError(err: unknown, fallback = 'Error en flota'): never {
  throw new Error(mensajeErrorFlota(err, fallback));
}

export function jsonErrorFlota(err: unknown, fallback: string, status?: number): NextResponse {
  const msg = mensajeErrorFlota(err, fallback);
  const resolved =
    status ?? (/requerido|inválid|JSON|Ya existe/i.test(msg) ? 400 : 500);
  return NextResponse.json({ error: msg }, { status: resolved });
}
