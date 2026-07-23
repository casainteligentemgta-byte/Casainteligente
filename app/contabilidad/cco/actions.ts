'use server';

/**
 * Server Actions CCO → tabla `registros_gastos`.
 */
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';
import {
  createGastoCCO,
  deleteGastoCCO as deleteGastoCcoDb,
  getGastosCCO,
  getMetricasCCO,
  updateGastoCCO as updateGastoCcoDb,
  type GetGastosCcoOpts,
} from '@/lib/contabilidad/cco/registrosGastos';
import {
  importCsvToRegistrosGastos,
  type ImportCsvToSupabaseResult,
} from '@/lib/contabilidad/cco/importCsvToRegistrosGastos';
import type { CreateGastoCcoInput, GastoRegistro, MetricasCco } from '@/types/gastos';

function clientOrThrow() {
  const admin = supabaseAdminForRoute();
  if (!admin.ok) {
    throw new Error('Supabase admin no configurado (SUPABASE_SERVICE_ROLE_KEY).');
  }
  return admin.client;
}

export async function actionGetGastosCCO(
  opts?: GetGastosCcoOpts,
): Promise<{ rows: GastoRegistro[]; total: number }> {
  return getGastosCCO(clientOrThrow(), opts);
}

export async function actionGetMetricasCCO(): Promise<MetricasCco> {
  return getMetricasCCO(clientOrThrow());
}

export async function actionCreateGastoCCO(data: CreateGastoCcoInput): Promise<GastoRegistro> {
  return createGastoCCO(clientOrThrow(), data);
}

export async function updateGastoCCO(
  id: string | number,
  data: CreateGastoCcoInput,
): Promise<GastoRegistro> {
  return updateGastoCcoDb(clientOrThrow(), id, data);
}

export async function deleteGastoCCO(id: string | number): Promise<{ ok: true }> {
  await deleteGastoCcoDb(clientOrThrow(), id);
  return { ok: true };
}

/**
 * Importa CSV diario (texto o FormData con `file`) → `registros_gastos` de una obra.
 * Siempre reemplazo limpio por proyecto (no duplica al reimportar el acumulado).
 */
export async function importCSVToSupabase(
  input: string | FormData | { csvText: string; proyectoId: string },
  proyectoIdArg?: string,
): Promise<ImportCsvToSupabaseResult> {
  let csvText = '';
  let proyectoId = String(proyectoIdArg ?? '').trim();

  if (typeof input === 'string') {
    csvText = input;
  } else if (typeof FormData !== 'undefined' && input instanceof FormData) {
    const file = input.get('file');
    if (file instanceof File) {
      csvText = await file.text();
    } else if (typeof input.get('csvText') === 'string') {
      csvText = String(input.get('csvText'));
    }
    if (!proyectoId) {
      proyectoId = String(input.get('proyectoId') ?? input.get('proyecto_id') ?? '').trim();
    }
  } else {
    const obj = input as { csvText: string; proyectoId?: string };
    csvText = String(obj.csvText ?? '');
    if (!proyectoId) proyectoId = String(obj.proyectoId ?? '').trim();
  }

  if (!proyectoId) {
    throw new Error('proyectoId requerido para importar CSV.');
  }
  if (!csvText.trim()) {
    throw new Error('Falta el contenido CSV.');
  }

  return importCsvToRegistrosGastos(clientOrThrow(), csvText, { proyectoId });
}

