import { unstable_noStore as noStore } from 'next/cache';
import { createSupabaseAdminOnlyClient } from '@/lib/supabase/adminOnlyClient';
import { createClient } from '@/lib/supabase/server';
import { FastContratosExpressTable, type ContratoExpressListItem } from './FastContratosExpressTable';

/** Evita listado “vacío” por caché RSC cuando el query usa solo service_role (sin leer cookies). */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const selectFull = `
  id,
  created_at,
  obrero_cedula,
  obrero_nombre,
  proyecto_id,
  bono_manual_usd,
  salario_base_mensual_snapshot,
  pdf_storage_path,
  formalizado,
  formalizado_empleado_id,
  ci_proyectos (
    nombre,
    ci_entidades ( nombre, rif )
  )
`;

const selectLite = `
  id,
  created_at,
  obrero_cedula,
  obrero_nombre,
  proyecto_id,
  bono_manual_usd,
  salario_base_mensual_snapshot,
  pdf_storage_path,
  formalizado_empleado_id,
  ci_proyectos (
    nombre,
    ci_entidades ( nombre, rif )
  )
`;

const selectBareUsd = `
  id,
  created_at,
  obrero_cedula,
  obrero_nombre,
  proyecto_id,
  bono_manual_usd,
  salario_base_mensual_snapshot,
  pdf_storage_path,
  formalizado,
  formalizado_empleado_id
`;

const selectBare118 = `
  id,
  created_at,
  obrero_cedula,
  obrero_nombre,
  proyecto_id,
  bono_manual_usd,
  salario_base_mensual_snapshot,
  pdf_storage_path
`;

/** Columnas migración 127; si aún no existen, fallan los intentos y se usan selects sin ellas. */
function withFirmadoCols(sel: string): string {
  if (sel.includes('pdf_firmado_storage_path')) return sel;
  return sel.replace(
    /\bpdf_storage_path\b(\s*,)?/,
    (_m, comma: string | undefined) =>
      comma
        ? 'pdf_storage_path,\n  pdf_firmado_storage_path,\n  pdf_firmado_subido_at,'
        : 'pdf_storage_path,\n  pdf_firmado_storage_path,\n  pdf_firmado_subido_at',
  );
}

function replaceBonoUsdByVes(sel: string): string {
  return sel.replace(/\bbono_manual_usd\b/g, 'bono_manual_ves');
}

function normalizeExpressListRow(row: unknown): ContratoExpressListItem {
  const r = row as Record<string, unknown>;
  const bono =
    (r.bono_manual_usd as ContratoExpressListItem['bono_manual_usd']) ??
    (r.bono_manual_ves as ContratoExpressListItem['bono_manual_usd']) ??
    null;
  const { bono_manual_ves: _drop, ...rest } = r;
  return { ...(rest as ContratoExpressListItem), bono_manual_usd: bono };
}

export default async function FastContratosExpressListPage() {
  noStore();
  const userSb = await createClient();
  const admin = createSupabaseAdminOnlyClient();
  const supabase = admin ?? userSb;

  const attempts: { select: string }[] = [
    { select: withFirmadoCols(selectFull) },
    { select: withFirmadoCols(selectLite) },
    { select: withFirmadoCols(replaceBonoUsdByVes(selectFull)) },
    { select: withFirmadoCols(replaceBonoUsdByVes(selectLite)) },
    { select: withFirmadoCols(selectBareUsd) },
    { select: withFirmadoCols(replaceBonoUsdByVes(selectBareUsd)) },
    { select: withFirmadoCols(selectBare118) },
    { select: withFirmadoCols(replaceBonoUsdByVes(selectBare118)) },
    { select: selectFull },
    { select: selectLite },
    { select: replaceBonoUsdByVes(selectFull) },
    { select: replaceBonoUsdByVes(selectLite) },
    { select: selectBareUsd },
    { select: replaceBonoUsdByVes(selectBareUsd) },
    { select: selectBare118 },
    { select: replaceBonoUsdByVes(selectBare118) },
  ];

  let rows: unknown[] = [];
  let err: string | null = null;

  for (const { select } of attempts) {
    const res = await supabase.from('ci_contratos_express').select(select).order('created_at', { ascending: false });
    if (!res.error) {
      rows = (res.data ?? []).map(normalizeExpressListRow);
      err = null;
      break;
    }
    err = res.error.message;
  }

  return <FastContratosExpressTable initialData={rows as ContratoExpressListItem[]} fetchError={err} />;
}
