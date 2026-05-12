import { createClient } from '@/lib/supabase/server';
import { FastContratosExpressTable, type ContratoExpressListItem } from './FastContratosExpressTable';

const selectFull = `
  id,
  created_at,
  obrero_cedula,
  obrero_nombre,
  proyecto_id,
  bono_manual_ves,
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
  bono_manual_ves,
  salario_base_mensual_snapshot,
  pdf_storage_path,
  formalizado_empleado_id,
  ci_proyectos (
    nombre,
    ci_entidades ( nombre, rif )
  )
`;

export default async function FastContratosExpressListPage() {
  const supabase = await createClient();

  const full = await supabase.from('ci_contratos_express').select(selectFull).order('created_at', { ascending: false });

  let rows: unknown[] = full.data ?? [];
  let err: string | null = full.error?.message ?? null;

  if (
    full.error &&
    /formalizado_empleado_id|\bformalizado\b|does not exist|schema cache/i.test(full.error.message)
  ) {
    const lite = await supabase.from('ci_contratos_express').select(selectLite).order('created_at', { ascending: false });
    rows = lite.data ?? [];
    err = lite.error?.message ?? null;
  }

  return <FastContratosExpressTable initialData={rows as ContratoExpressListItem[]} fetchError={err} />;
}
