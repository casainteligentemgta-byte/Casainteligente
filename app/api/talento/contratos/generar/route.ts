import type { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import {
  denominacionOficioGaceta,
  lugarPrestacionServicio,
  objetoContratoDesdeOficio,
  parseFormaPago,
  parseJornada,
  parseTipoContrato,
  salarioBasicoDiarioVesDesdeNivel,
} from '@/lib/talento/contratoGacetaLaboral';
import { generarTextoLegalCentauro } from '@/lib/talento/contract-centauro';
import { supabaseForRoute } from '@/lib/talento/supabase-route';

type SitioResuelto = {
  nombre: string;
  ubicacion: string | null;
};

function trimBase(u: string): string {
  return u.trim().replace(/\/$/, '');
}

function publicBaseFromPostReq(req: Request): string {
  const origin = trimBase(req.headers.get('origin') ?? '');
  if (origin && /^https?:\/\//i.test(origin)) return origin;
  const env = trimBase(process.env.NEXT_PUBLIC_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? '');
  if (env && /^https?:\/\//i.test(env)) return env;
  return '';
}

async function resolverSitioObraOProyecto(supabase: SupabaseClient, sitioId: string): Promise<SitioResuelto | null> {
  const { data: pr } = await supabase
    .from('ci_proyectos')
    .select('nombre,ubicacion_texto,obra_ubicacion')
    .eq('id', sitioId)
    .maybeSingle();
  if (!pr) return null;
  const r = pr as { nombre: string; ubicacion_texto: string | null; obra_ubicacion: string | null };
  const ubic = (r.obra_ubicacion ?? r.ubicacion_texto ?? '').trim() || null;
  return { nombre: r.nombre, ubicacion: ubic };
}

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
      /** Opcional: si RRHH ya define ingreso al generar (sino queda null y se completa con PATCH). */
      fecha_ingreso?: string | null;
      forma_pago?: string | null;
      lugar_pago?: string | null;
      jornada_trabajo?: string | null;
      tipo_contrato?: string | null;
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
      .select(
        'id,nombre_completo,documento,estado,recruitment_need_id,cargo_codigo,cargo_nombre,cargo_nivel,rol_buscado',
      )
      .eq('id', empId)
      .single();

    const emp = empRaw as {
      id: string;
      nombre_completo: string;
      documento: string | null;
      estado: string;
      recruitment_need_id: string | null;
      cargo_codigo: string | null;
      cargo_nombre: string | null;
      cargo_nivel: number | null;
      rol_buscado: string | null;
    } | null;

    if (e1 || !emp) {
      return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
    }

    if (emp.estado !== 'aprobado') {
      return NextResponse.json({ error: 'Solo empleados en estado aprobado' }, { status: 400 });
    }

    const sitio = await resolverSitioObraOProyecto(supabase, obraId);
    if (!sitio) {
      return NextResponse.json({ error: 'Obra o proyecto no encontrado para el id indicado' }, { status: 404 });
    }

    type NeedRow = {
      id: string;
      cargo_codigo: string | null;
      cargo_nombre: string | null;
      cargo_nivel: number | null;
    };
    let need: NeedRow | null = null;
    const nid = (emp.recruitment_need_id ?? '').trim();
    if (nid) {
      const { data: n } = await supabase
        .from('recruitment_needs')
        .select('id,cargo_codigo,cargo_nombre,cargo_nivel')
        .eq('id', nid)
        .maybeSingle();
      need = (n ?? null) as NeedRow | null;
    }

    const codigoTab = ((need?.cargo_codigo ?? emp.cargo_codigo) ?? '').trim();
    const nivelTab = need?.cargo_nivel ?? emp.cargo_nivel ?? null;
    const cargoOficio = ((need?.cargo_nombre ?? emp.cargo_nombre ?? emp.rol_buscado) ?? '').trim() || 'Obrero';
    const denGaceta = denominacionOficioGaceta(codigoTab) ?? cargoOficio;
    const salarioVes = salarioBasicoDiarioVesDesdeNivel(nivelTab);
    const lugarPrest = lugarPrestacionServicio(sitio.nombre, sitio.ubicacion);
    const objeto = objetoContratoDesdeOficio({
      denominacionTrabajo: cargoOficio,
      codigoTabulador: codigoTab || null,
    });

    const tipoContrato = parseTipoContrato(body.tipo_contrato) ?? 'tiempo_determinado';
    const formaPago = parseFormaPago(body.forma_pago);
    const jornada = parseJornada(body.jornada_trabajo);
    const lugarPago = (body.lugar_pago ?? '').trim() || null;

    let fechaIngreso: string | null = null;
    if (body.fecha_ingreso != null && String(body.fecha_ingreso).trim()) {
      const d = new Date(String(body.fecha_ingreso).trim());
      if (!Number.isNaN(d.getTime())) {
        fechaIngreso = d.toISOString().slice(0, 10);
      }
    }

    const laboralInsert = {
      recruitment_need_id: (need?.id ?? nid) || null,
      cargo_oficio_desempeño: cargoOficio,
      tabulador_nivel: nivelTab != null && nivelTab >= 1 && nivelTab <= 9 ? nivelTab : null,
      salario_basico_diario_ves: salarioVes,
      lugar_prestacion_servicio: lugarPrest,
      tipo_contrato: tipoContrato,
      objeto_contrato: objeto,
      numero_oficio_tabulador: codigoTab || null,
      gaceta_denominacion_oficio: denGaceta,
      fecha_ingreso: fechaIngreso,
      forma_pago: formaPago,
      lugar_pago: lugarPago,
      jornada_trabajo: jornada,
    };

    const fechaEmision = new Date().toLocaleDateString('es-VE', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const texto = generarTextoLegalCentauro({
      empleadoNombre: emp.nombre_completo as string,
      empleadoDocumento: emp.documento as string | null,
      obraNombre: sitio.nombre,
      obraUbicacion: sitio.ubicacion,
      clienteObra: null,
      montoAcordadoUsd: monto,
      porcentajeInicial: pct,
      fechaEmision,
    });

    const baseInsert = {
      empleado_id: empId,
      monto_acordado_usd: monto,
      porcentaje_inicial: pct,
      texto_legal: texto,
      ...laboralInsert,
    };

    let ctrRaw: unknown = null;
    let e3: { message: string } | null = null;

    const intentoObra = await supabase
      .from('ci_contratos_empleado_obra')
      .insert({ ...baseInsert, obra_id: obraId } as never)
      .select('id')
      .single();

    ctrRaw = intentoObra.data;
    e3 = intentoObra.error;

    if (e3 && /obra_id|violates|column|foreign key/i.test(e3.message)) {
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

    const { data: tr } = await supabase.from('ci_empleados').select('token_registro').eq('id', empId).maybeSingle();
    const regTok = String((tr as { token_registro?: string | null } | null)?.token_registro ?? '').trim();
    const base = publicBaseFromPostReq(req);
    const contrato_portal_obrero_url =
      base && regTok ? `${base}/registro/contrato-laboral/${ctr.id}?token=${encodeURIComponent(regTok)}` : null;

    return NextResponse.json({
      id: ctr.id,
      texto_legal: texto,
      contrato_portal_obrero_url,
      laboral: {
        ...laboralInsert,
        salario_basico_diario_ves: salarioVes,
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
