import { NextResponse } from 'next/server';
import { requireAccesoLegal } from '@/lib/legal/requireAccesoLegal';
import {
  ESTADO_CONTRATO_EXITOSO,
  TIPO_CONTRATO_AD,
  type ContratoAdResumen,
} from '@/lib/proyectos/contratoAdministracionDelegada';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type ContratoRow = {
  id: string;
  proyecto_id: string;
  entidad_ejecutora_id: string | null;
  honorarios_admin_pct: number | null;
  estado: string;
  created_at: string;
  entidad: { nombre: string } | { nombre: string }[] | null;
};

/** GET — obras del CRM con estado del Contrato AD (solo Legal integrado / entidad). */
export async function GET() {
  const gate = await requireAccesoLegal();
  if (!gate.ok) return gate.response;

  if (gate.acceso.modoProducto === 'standalone') {
    return NextResponse.json(
      {
        error:
          'Contratos AD de obra solo están disponibles en Legal de la entidad (Casa Inteligente).',
        code: 'legal_integrado_required',
      },
      { status: 403 },
    );
  }

  const { data: proyectosRaw, error: proyErr } = await gate.admin
    .from('ci_proyectos')
    .select('id, nombre, entidad_id, created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  if (proyErr) {
    return NextResponse.json({ error: proyErr.message }, { status: 500 });
  }

  const proyectos = proyectosRaw ?? [];
  const entidadIds = Array.from(
    new Set(
      proyectos
        .map((p) => (p.entidad_id != null ? String(p.entidad_id) : ''))
        .filter(Boolean),
    ),
  );

  const entidadNombreById = new Map<string, string>();
  if (entidadIds.length > 0) {
    const { data: ents } = await gate.admin
      .from('ci_entidades')
      .select('id, nombre')
      .in('id', entidadIds);
    for (const e of ents ?? []) {
      entidadNombreById.set(String(e.id), String(e.nombre ?? 'Entidad'));
    }
  }

  const proyectoIds = proyectos.map((p) => String(p.id));
  const contratoByProyecto = new Map<string, ContratoAdResumen>();

  if (proyectoIds.length > 0) {
    const { data: contratos, error: cErr } = await gate.admin
      .from('ci_contratos_express')
      .select(
        `
        id,
        proyecto_id,
        entidad_ejecutora_id,
        honorarios_admin_pct,
        estado,
        created_at,
        entidad:ci_entidades ( nombre )
      `,
      )
      .in('proyecto_id', proyectoIds)
      .eq('tipo_contrato', TIPO_CONTRATO_AD)
      .order('created_at', { ascending: false });

    if (cErr && cErr.code !== '42P01' && cErr.code !== '42703') {
      return NextResponse.json({ error: cErr.message }, { status: 500 });
    }

    for (const row of (contratos ?? []) as ContratoRow[]) {
      const pid = String(row.proyecto_id);
      if (contratoByProyecto.has(pid)) continue;
      const entRaw = row.entidad;
      const ent = Array.isArray(entRaw) ? entRaw[0] : entRaw;
      contratoByProyecto.set(pid, {
        id: String(row.id),
        entidad_ejecutora_id: row.entidad_ejecutora_id ?? null,
        honorarios_admin_pct:
          row.honorarios_admin_pct != null ? Number(row.honorarios_admin_pct) : null,
        estado: String(row.estado ?? ''),
        created_at: String(row.created_at),
        entidad: ent ?? null,
      });
    }
  }

  const items = proyectos.map((p) => {
    const id = String(p.id);
    const contrato = contratoByProyecto.get(id) ?? null;
    const autorizado = contrato?.estado === ESTADO_CONTRATO_EXITOSO;
    const entidadId = p.entidad_id != null ? String(p.entidad_id) : null;
    return {
      id,
      nombre: String(p.nombre ?? 'Proyecto'),
      entidad_id: entidadId,
      entidad_nombre: entidadId ? (entidadNombreById.get(entidadId) ?? null) : null,
      autorizado,
      contrato,
      created_at: p.created_at != null ? String(p.created_at) : null,
    };
  });

  const pendientes = items.filter((i) => !i.autorizado).length;

  return NextResponse.json({
    ok: true,
    proyectos: items,
    total: items.length,
    pendientes,
  });
}
