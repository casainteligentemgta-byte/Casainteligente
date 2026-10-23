import { NextResponse } from 'next/server';
import { requireAccesoLegal } from '@/lib/legal/requireAccesoLegal';
import {
  extraerVencimientosEntidad,
  type PermisologiaVencimientoItem,
} from '@/lib/legal/permisologiaVencimientos';
import { EntidadConNombre, SELECT_NOMBRE_ENTIDAD, conNombreEntidad, conNombreFila, nombreEntidad } from '@/lib/entidades/nombreEntidad';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** GET — vencimientos de permisología de patronos (IVSS / INCES / solvencia) para el Departamento Legal. */
export async function GET() {
  const gate = await requireAccesoLegal();
  if (!gate.ok) return gate.response;

  const { data, error } = await gate.admin
    .from('ci_entidades')
    .select(`${SELECT_NOMBRE_ENTIDAD}, rif, permisologia`);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const items: PermisologiaVencimientoItem[] = [];
  const entidades = conNombreEntidad(data as EntidadConNombre[] | null).map((row) => {
    const vencimientos = extraerVencimientosEntidad({
      id: String(row.id),
      nombre: row.nombre,
      rif: row.rif == null ? null : String(row.rif),
      permisologia: row.permisologia,
    });
    items.push(...vencimientos);
    return {
      id: String(row.id),
      nombre: row.nombre,
      rif: row.rif == null ? null : String(row.rif),
      permisologia: row.permisologia ?? null,
      alertas: vencimientos,
    };
  });

  items.sort((a, b) => a.dias_restantes - b.dias_restantes);

  return NextResponse.json({
    ok: true,
    entidades,
    alertas: items,
    total_alertas: items.length,
  });
}
