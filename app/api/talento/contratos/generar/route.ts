import { NextResponse } from 'next/server';
import { generarTextoLegalCentauro } from '@/lib/talento/contract-centauro';
import { supabaseForRoute } from '@/lib/talento/supabase-route';

export async function POST(req: Request) {
  try {
    const sb = supabaseForRoute();
    if (!sb.ok) return sb.response;
    const supabase = sb.client;
    const body = (await req.json()) as {
      empleado_id?: string;
      obra_id?: string;
      monto_acordado_usd?: number;
      porcentaje_inicial?: number;
    };

    const empId = body.empleado_id?.trim();
    const obraId = body.obra_id?.trim();
    const monto = Number(body.monto_acordado_usd);
    const pct = Number(body.porcentaje_inicial);

    if (!empId || !obraId || Number.isNaN(monto) || monto <= 0 || Number.isNaN(pct) || pct < 0 || pct > 100) {
      return NextResponse.json({ error: 'empleado_id, obra_id, monto_acordado_usd y porcentaje_inicial válidos requeridos' }, { status: 400 });
    }

    const { data: empRaw, error: e1 } = await supabase
      .from('ci_empleados')
      .select('id,nombre_completo,documento,estado')
      .eq('id', empId)
      .single();

    const emp = empRaw as {
      id: string;
      nombre_completo: string;
      documento: string | null;
      estado: string;
    } | null;

    if (e1 || !emp) {
      return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
    }

    if (emp.estado !== 'aprobado') {
      return NextResponse.json({ error: 'Solo empleados en estado aprobado' }, { status: 400 });
    }

    const { data: obraRaw, error: e2 } = await supabase
      .from('ci_obras')
      .select('id,nombre,ubicacion,cliente')
      .eq('id', obraId)
      .single();

    const obra = obraRaw as {
      id: string;
      nombre: string;
      ubicacion: string | null;
      cliente: string | null;
    } | null;

    if (e2 || !obra) {
      return NextResponse.json({ error: 'Obra no encontrada' }, { status: 404 });
    }

    const fechaEmision = new Date().toLocaleDateString('es-VE', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const texto = generarTextoLegalCentauro({
      empleadoNombre: emp.nombre_completo as string,
      empleadoDocumento: emp.documento as string | null,
      obraNombre: obra.nombre as string,
      obraUbicacion: obra.ubicacion as string | null,
      clienteObra: obra.cliente as string | null,
      montoAcordadoUsd: monto,
      porcentajeInicial: pct,
      fechaEmision,
    });

    const baseInsert = {
      empleado_id: empId,
      monto_acordado_usd: monto,
      porcentaje_inicial: pct,
      texto_legal: texto,
    } as const;

    let ctrRaw: unknown = null;
    let e3: { message: string } | null = null;

    const intentoObra = await supabase
      .from('ci_contratos_empleado_obra')
      .insert({ ...baseInsert, obra_id: obraId } as never)
      .select('id')
      .single();

    ctrRaw = intentoObra.data;
    e3 = intentoObra.error;

    if (e3 && /obra_id/i.test(e3.message)) {
      const intentoProyecto = await supabase
        .from('ci_contratos_empleado_obra')
        .insert({ ...baseInsert, proyecto_id: obraId } as never)
        .select('id')
        .single();
      ctrRaw = intentoProyecto.data;
      e3 = intentoProyecto.error;
    }

    if (e3) {
      console.error(e3);
      return NextResponse.json({ error: e3.message }, { status: 500 });
    }

    const ctr = ctrRaw as { id: string } | null;
    if (!ctr) {
      return NextResponse.json({ error: 'No se pudo crear el contrato' }, { status: 500 });
    }

    return NextResponse.json({ id: ctr.id, texto_legal: texto });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
