import type { SupabaseClient } from '@supabase/supabase-js';
import { emptyHojaVidaObreroCompleta } from '@/lib/talento/hojaVidaObreroCompleta';
import {
  aplicarOverridesMapaContrato,
  compilarPlantillaContratoObrero,
  construirMapaVariablesContratoObrero,
  type DatoContratoFaltante,
  type FuentesContratoObrero,
} from '@/lib/talento/plantillaContratoObreroCompile';
import { obtenerCuerpoPlantillaContratoObrero } from '@/lib/talento/plantillaContratoObreroRepo';
import { CONTRATO_OBRERO_CUERPO_DEFAULT } from '@/lib/talento/plantillas/contratoObreroDefaultCuerpo';
import type { ContratoObreroPdfStructuredProps } from '@/lib/talento/ContratoObreroPdfStructured';
import { domicilioPatronoParaEntidad } from '@/lib/talento/patronoDomicilioReglas';
import {
  fusionarEmpleadoContratoDesdePlanilla,
  parseHojaVidaObrero,
  patronEmpresaDomicilioDesdeHojaJson,
} from '@/lib/talento/empleadoContratoDesdeHojaPlanilla';
import { resolvePlanillaPatronoPdf } from '@/lib/talento/resolvePlanillaPatronoPdf';

/**
 * Patrono para contrato / planilla: nombre y domicilio desde `ci_entidades`
 * vinculada al proyecto (`entidad_id`). Sin id de entidad se usan variables de entorno públicas.
 * Domicilio: `registro_mercantil.domicilio_empresa` y, si falta, domicilio/dirección fiscal.
 */
export async function resolverPatronoDesdeEntidad(
  supabase: SupabaseClient,
  entidadId: string | null,
): Promise<{ nombre: string; domicilio: string; representante: string }> {
  const envNombre = (process.env.NEXT_PUBLIC_PATRON_NOMBRE ?? 'CASA INTELIGENTE').trim();
  const envDom = (process.env.NEXT_PUBLIC_PATRON_DOMICILIO ?? '').trim();
  const envRep = (process.env.NEXT_PUBLIC_PATRON_REPRESENTANTE ?? '').trim();
  const eid = (entidadId ?? '').trim();
  if (!eid) return { nombre: envNombre, domicilio: envDom, representante: envRep };

  const { data, error } = await supabase.from('ci_entidades').select('*').eq('id', eid).maybeSingle();
  if (error || !data) return { nombre: envNombre, domicilio: envDom, representante: envRep };

  const e = data as Record<string, unknown>;
  const nombre =
    strOpt(e.nombre_legal) ?? strOpt(e.nombre as string | null | undefined) ?? envNombre;
  const domicilio =
    domicilioPatronoParaEntidad({
      nombre_legal: strOpt(e.nombre_legal),
      nombre: strOpt(e.nombre),
      domicilio_fiscal: strOpt(e.domicilio_fiscal),
      direccion_fiscal: strOpt(e.direccion_fiscal),
      registro_mercantil: e.registro_mercantil,
    }) ?? envDom;
  const representante =
    strOpt(e.rep_legal_nombre as string | null | undefined) ??
    strOpt(e.representante_legal as string | null | undefined) ??
    envRep;
  return { nombre, domicilio, representante };
}

export async function cargarFuentesContratoObreroPdf(
  admin: SupabaseClient,
  contratoId: string,
): Promise<{ ok: true; fuentes: FuentesContratoObrero; empleadoId: string } | { ok: false; error: string }> {
  const { data: c, error: ec } = await admin
    .from('ci_contratos_empleado_obra')
    .select(
      [
        'empleado_id',
        'obra_id',
        'proyecto_id',
        'cargo_oficio_desempeño',
        'lugar_prestacion_servicio',
        'objeto_contrato',
        'tipo_contrato',
        'jornada_trabajo',
        'salario_basico_diario_ves',
        'forma_pago',
        'lugar_pago',
        'fecha_ingreso',
        'numero_oficio_tabulador',
        'gaceta_denominacion_oficio',
      ].join(','),
    )
    .eq('id', contratoId.trim())
    .maybeSingle();

  if (ec || !c || typeof c !== 'object' || !('empleado_id' in c)) {
    return { ok: false, error: ec?.message ?? 'Contrato no encontrado' };
  }

  const row = c as unknown as {
    empleado_id: string;
    obra_id?: string | null;
    proyecto_id?: string | null;
    cargo_oficio_desempeño?: string | null;
    lugar_prestacion_servicio?: string | null;
    objeto_contrato?: string | null;
    tipo_contrato?: string | null;
    jornada_trabajo?: string | null;
    salario_basico_diario_ves?: number | null;
    forma_pago?: string | null;
    lugar_pago?: string | null;
    fecha_ingreso?: string | null;
    numero_oficio_tabulador?: string | null;
    gaceta_denominacion_oficio?: string | null;
  };

  const vinculo = row.obra_id ?? row.proyecto_id ?? null;
  if (!vinculo) {
    return { ok: false, error: 'El contrato no tiene obra ni proyecto vinculado.' };
  }

  const [{ data: emp, error: ee }, { data: obra, error: eo }] = await Promise.all([
    admin
      .from('ci_empleados')
      .select(
        'nombre_completo,nombres,documento,cedula,direccion_habitacion,celular,telefono,hoja_vida_obrero,proyecto_modulo_id',
      )
      .eq('id', row.empleado_id)
      .maybeSingle(),
    admin
      .from('ci_proyectos')
      .select('nombre,ubicacion_texto,obra_ubicacion,entidad_id')
      .eq('id', vinculo)
      .maybeSingle(),
  ]);

  if (ee || !emp) {
    return { ok: false, error: ee?.message ?? 'Empleado no encontrado' };
  }
  if (eo || !obra) {
    return { ok: false, error: eo?.message ?? 'Obra/proyecto no encontrado' };
  }

  const e = emp as {
    nombre_completo: string | null;
    nombres?: string | null;
    documento: string | null;
    cedula: string | null;
    direccion_habitacion?: string | null;
    celular?: string | null;
    telefono?: string | null;
    hoja_vida_obrero?: unknown;
    proyecto_modulo_id?: string | null;
  };

  const o = obra as {
    nombre: string;
    ubicacion_texto?: string | null;
    obra_ubicacion?: string | null;
    entidad_id?: string | null;
  };
  const ubic = (o.obra_ubicacion ?? o.ubicacion_texto ?? '').trim() || null;

  const hv = parseHojaVidaObrero(e.hoja_vida_obrero) ?? emptyHojaVidaObreroCompleta();
  const empleado = fusionarEmpleadoContratoDesdePlanilla(e, hv);

  const patron = await resolverPatronoDesdeEntidad(admin, strOpt(o.entidad_id));
  const domDesdeHoja = patronEmpresaDomicilioDesdeHojaJson(e.hoja_vida_obrero);
  const proyectoPlanilla = strOpt(e.proyecto_modulo_id) ?? vinculo;
  const planillaCampos = await resolvePlanillaPatronoPdf(admin, proyectoPlanilla);
  const domDesdePlanilla = strOpt(planillaCampos.empresaDomicilio);
  const domicilioPatrono = domDesdeHoja ?? domDesdePlanilla ?? patron.domicilio;

  const fuentes: FuentesContratoObrero = {
    empleado: {
      nombre_completo: empleado.nombre_completo,
      documento: empleado.documento,
      cedula: empleado.cedula,
      direccion: empleado.direccion,
      celular: empleado.celular,
      telefono: empleado.telefono,
    },
    hojaVida: hv,
    contrato: {
      cargo_oficio_desempeño: row.cargo_oficio_desempeño,
      lugar_prestacion_servicio: row.lugar_prestacion_servicio,
      objeto_contrato: row.objeto_contrato,
      tipo_contrato: row.tipo_contrato,
      jornada_trabajo: row.jornada_trabajo,
      salario_basico_diario_ves: row.salario_basico_diario_ves,
      forma_pago: row.forma_pago,
      lugar_pago: row.lugar_pago,
      fecha_ingreso: row.fecha_ingreso,
      numero_oficio_tabulador: row.numero_oficio_tabulador,
      gaceta_denominacion_oficio: row.gaceta_denominacion_oficio,
    },
    obra: { nombre: o.nombre, ubicacion: ubic },
    patron: {
      nombre: patron.nombre,
      domicilio: domicilioPatrono,
      representante: patron.representante,
    },
  };

  return { ok: true, fuentes, empleadoId: row.empleado_id };
}

type ContratoLaboralRow = {
  cargo_oficio_desempeño?: string | null;
  lugar_prestacion_servicio?: string | null;
  objeto_contrato?: string | null;
  tipo_contrato?: string | null;
  jornada_trabajo?: string | null;
  salario_basico_diario_ves?: number | null;
  forma_pago?: string | null;
  lugar_pago?: string | null;
  fecha_ingreso?: string | null;
  numero_oficio_tabulador?: string | null;
  gaceta_denominacion_oficio?: string | null;
};

function strOpt(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

/**
 * Arma fuentes del contrato para un empleado: hoja de empleo + último contrato si existe + obra por proyecto/vacante.
 * Sirve para vista previa RRHH sin `contrato_id`.
 */
export async function cargarFuentesContratoObreroPorEmpleadoId(
  supabase: SupabaseClient,
  empleadoId: string,
): Promise<{ ok: true; fuentes: FuentesContratoObrero } | { ok: false; error: string }> {
  const eid = empleadoId.trim();
  if (!eid) {
    return { ok: false, error: 'empleado_id requerido' };
  }

  const { data: emp, error: ee } = await supabase
    .from('ci_empleados')
    .select(
      'nombre_completo,nombres,documento,cedula,direccion_habitacion,celular,telefono,hoja_vida_obrero,cargo_nombre,cargo_codigo,cargo_nivel,proyecto_modulo_id,recruitment_need_id',
    )
    .eq('id', eid)
    .maybeSingle();

  if (ee || !emp) {
    return { ok: false, error: ee?.message ?? 'Empleado no encontrado' };
  }

  const e = emp as {
    nombre_completo: string | null;
    nombres?: string | null;
    documento: string | null;
    cedula: string | null;
    direccion_habitacion?: string | null;
    celular?: string | null;
    telefono?: string | null;
    hoja_vida_obrero?: unknown;
    cargo_nombre?: string | null;
    cargo_codigo?: string | null;
    cargo_nivel?: number | null;
    proyecto_modulo_id?: string | null;
    recruitment_need_id?: string | null;
  };

  let proyectoId = (e.proyecto_modulo_id ?? '').trim() || null;
  const needId = (e.recruitment_need_id ?? '').trim() || null;
  if (!proyectoId && needId) {
    const { data: need, error: needErr } = await supabase
      .from('recruitment_needs')
      .select('proyecto_modulo_id,proyecto_id')
      .eq('id', needId)
      .maybeSingle();
    if (needErr) {
      console.warn('[cargarFuentesContratoObreroPorEmpleadoId] recruitment_needs', needErr.message);
    } else {
      const n = need as { proyecto_modulo_id?: string | null; proyecto_id?: string | null } | null;
      proyectoId = (n?.proyecto_modulo_id ?? n?.proyecto_id ?? '').trim() || null;
    }
  }

  let obraNombre = 'Por definir';
  let obraUbic: string | null = null;
  let entidadId: string | null = null;
  if (proyectoId) {
    const { data: ob } = await supabase
      .from('ci_proyectos')
      .select('nombre,ubicacion_texto,obra_ubicacion,entidad_id')
      .eq('id', proyectoId)
      .maybeSingle();
    if (ob) {
      const o = ob as {
        nombre: string;
        ubicacion_texto?: string | null;
        obra_ubicacion?: string | null;
        entidad_id?: string | null;
      };
      obraNombre = o.nombre;
      obraUbic = (o.obra_ubicacion ?? o.ubicacion_texto ?? '').trim() || null;
      entidadId = strOpt(o.entidad_id);
    }
  }

  const { data: ctr, error: ctrErr } = await supabase
    .from('ci_contratos_empleado_obra')
    .select(
      'cargo_oficio_desempeño,lugar_prestacion_servicio,objeto_contrato,tipo_contrato,jornada_trabajo,salario_basico_diario_ves,forma_pago,lugar_pago,fecha_ingreso,numero_oficio_tabulador,gaceta_denominacion_oficio',
    )
    .eq('empleado_id', eid)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (ctrErr) {
    console.warn('[cargarFuentesContratoObreroPorEmpleadoId] ci_contratos_empleado_obra', ctrErr.message);
  }

  const c = (ctrErr ? null : ctr) as ContratoLaboralRow | null;

  const pick = (a: string | null | undefined, b: string | null | undefined): string | null | undefined => {
    const x = strOpt(a);
    if (x) return x;
    return strOpt(b) ?? null;
  };

  const contrato: FuentesContratoObrero['contrato'] = {
    cargo_oficio_desempeño: pick(c?.cargo_oficio_desempeño, e.cargo_nombre ?? null) ?? null,
    lugar_prestacion_servicio: pick(c?.lugar_prestacion_servicio, obraNombre) ?? null,
    objeto_contrato: c?.objeto_contrato ?? null,
    tipo_contrato: c?.tipo_contrato ?? null,
    jornada_trabajo: c?.jornada_trabajo ?? null,
    salario_basico_diario_ves: c?.salario_basico_diario_ves ?? null,
    forma_pago: c?.forma_pago ?? null,
    lugar_pago: c?.lugar_pago ?? null,
    fecha_ingreso: c?.fecha_ingreso ?? null,
    numero_oficio_tabulador: pick(c?.numero_oficio_tabulador, e.cargo_codigo ?? null) ?? null,
    gaceta_denominacion_oficio: c?.gaceta_denominacion_oficio ?? null,
  };

  const hv = parseHojaVidaObrero(e.hoja_vida_obrero) ?? emptyHojaVidaObreroCompleta();
  const empleado = fusionarEmpleadoContratoDesdePlanilla(e, hv);
  const patron = await resolverPatronoDesdeEntidad(supabase, entidadId);
  const domDesdeHoja = patronEmpresaDomicilioDesdeHojaJson(e.hoja_vida_obrero);
  const planillaCampos = await resolvePlanillaPatronoPdf(supabase, proyectoId);
  const domDesdePlanilla = strOpt(planillaCampos.empresaDomicilio);
  const domicilioPatrono = domDesdeHoja ?? domDesdePlanilla ?? patron.domicilio;

  const fuentes: FuentesContratoObrero = {
    empleado: {
      nombre_completo: empleado.nombre_completo,
      documento: empleado.documento,
      cedula: empleado.cedula,
      direccion: empleado.direccion,
      celular: empleado.celular,
      telefono: empleado.telefono,
    },
    hojaVida: hv,
    contrato,
    obra: { nombre: obraNombre, ubicacion: obraUbic },
    patron: {
      nombre: patron.nombre,
      domicilio: domicilioPatrono,
      representante: patron.representante,
    },
  };

  return { ok: true, fuentes };
}

const DIAS_MES_REF_SALARIO = 30;

/**
 * Props para {@link ContratoObreroPDF} (cláusulas fijas) a partir de empleado + contrato + tabulador opcional.
 */
export async function cargarPropsContratoObreroPdfEstructurado(
  supabase: SupabaseClient,
  empleadoId: string,
): Promise<{ ok: true; props: ContratoObreroPdfStructuredProps } | { ok: false; error: string }> {
  const fu = await cargarFuentesContratoObreroPorEmpleadoId(supabase, empleadoId.trim());
  if (!fu.ok) return fu;

  const f = fu.fuentes;
  const hv = f.hojaVida ?? emptyHojaVidaObreroCompleta();
  const dp = hv.datosPersonales;
  const nacionalidad = strOpt(dp?.nacionalidad) ?? null;
  const direccionHab = strOpt(f.empleado.direccion) ?? strOpt(dp?.direccionDomicilio);
  const cargoNom =
    strOpt(f.contrato.cargo_oficio_desempeño) ?? strOpt(hv.contratacion?.cargoUOficio) ?? null;
  const tareasEsp = strOpt(hv.contratacion?.cargoUOficio) ?? null;

  const entidad: ContratoObreroPdfStructuredProps['entidad'] = {
    nombre_legal: f.patron.nombre,
    domicilio_fiscal: f.patron.domicilio,
    representante_legal: f.patron.representante,
  };

  const empleado: ContratoObreroPdfStructuredProps['empleado'] = {
    nombres: f.empleado.nombre_completo,
    nacionalidad,
    cedula: f.empleado.cedula ?? f.empleado.documento,
    direccion_domicilio: direccionHab,
    cargo_nombre: cargoNom,
    tareas_especificas: tareasEsp,
  };

  let salarioMensual: number | null = null;
  let cestaMensual: number | null = null;
  let funcionesOficiales: string | null = strOpt(f.contrato.gaceta_denominacion_oficio);

  const codTab = strOpt(f.contrato.numero_oficio_tabulador);
  if (codTab) {
    const { data: nom } = await supabase
      .from('ci_config_nomina')
      .select('salario_base_mensual,cestaticket_mensual')
      .eq('cargo_codigo', codTab)
      .limit(1)
      .maybeSingle();
    if (nom && typeof nom === 'object') {
      const n = nom as { salario_base_mensual?: unknown; cestaticket_mensual?: unknown };
      const sm = Number(n.salario_base_mensual);
      const ce = Number(n.cestaticket_mensual);
      if (Number.isFinite(sm) && sm > 0) salarioMensual = sm;
      if (Number.isFinite(ce) && ce >= 0) cestaMensual = ce;
    }
  }

  const sbDia = f.contrato.salario_basico_diario_ves;
  if (salarioMensual == null && sbDia != null && Number.isFinite(Number(sbDia)) && Number(sbDia) > 0) {
    salarioMensual = Math.round(Number(sbDia) * DIAS_MES_REF_SALARIO * 100) / 100;
  }

  const configNomina: ContratoObreroPdfStructuredProps['configNomina'] = {
    funciones_oficiales: funcionesOficiales,
    salario_base_mensual: salarioMensual,
    cestaticket_mensual: cestaMensual,
  };

  const parametros: ContratoObreroPdfStructuredProps['parametros'] = {
    tipoPlazo: f.contrato.tipo_contrato,
    fechaIngreso: strOpt(f.contrato.fecha_ingreso),
  };

  return {
    ok: true,
    props: {
      expedienteId: null,
      empleado,
      entidad,
      configNomina,
      parametros,
    },
  };
}

/**
 * Plantilla biblioteca + expediente del empleado (sin `contrato_id`). Usado por vista JSON y PDF RRHH.
 */
export async function compilarContratoObreroDesdeEmpleadoId(
  supabase: SupabaseClient,
  empleadoId: string,
  overrides?: Record<string, string> | null,
): Promise<{ ok: true; texto: string; faltantes: DatoContratoFaltante[] } | { ok: false; error: string }> {
  const fu = await cargarFuentesContratoObreroPorEmpleadoId(supabase, empleadoId.trim());
  if (!fu.ok) {
    return { ok: false, error: fu.error };
  }

  const { data: pl, error: pe } = await supabase
    .from('ci_documento_plantillas')
    .select('cuerpo')
    .eq('codigo', 'contrato_obrero')
    .eq('activo', true)
    .maybeSingle();

  if (pe) {
    console.warn('[compilarContratoObreroDesdeEmpleadoId] plantilla', pe.message);
  }

  const cuerpoRaw = (pl as { cuerpo?: string } | null)?.cuerpo;
  const cuerpo =
    typeof cuerpoRaw === 'string' && cuerpoRaw.trim().length > 80 ? cuerpoRaw.trim() : CONTRATO_OBRERO_CUERPO_DEFAULT;

  const mapaBase = construirMapaVariablesContratoObrero(fu.fuentes);
  const mapa = aplicarOverridesMapaContrato(cuerpo, mapaBase, overrides ?? undefined);
  const { texto, faltantes } = compilarPlantillaContratoObrero(cuerpo, mapa);
  return { ok: true, texto, faltantes };
}

export type PreviewContratoObrero = {
  texto_compilado: string;
  datos_faltantes: DatoContratoFaltante[];
  planilla_completar_url: string | null;
};

/**
 * Compila la plantilla biblioteca con datos del contrato (misma lógica que el PDF).
 */
export async function previewContratoObreroPlantilla(
  admin: SupabaseClient,
  contratoId: string,
  opts: { planillaReturnPath: string },
): Promise<{ ok: true; preview: PreviewContratoObrero } | { ok: false; error: string }> {
  const base = await cargarFuentesContratoObreroPdf(admin, contratoId);
  if (!base.ok) return base;

  let cuerpo: string;
  try {
    cuerpo = await obtenerCuerpoPlantillaContratoObrero(admin);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Plantilla no disponible' };
  }

  const mapa = construirMapaVariablesContratoObrero(base.fuentes);
  const { texto, faltantes } = compilarPlantillaContratoObrero(cuerpo, mapa);

  const e = base.fuentes.empleado;
  const cedula = (e.cedula ?? e.documento ?? '').trim();
  const empleadoId = str(base.empleadoId);
  let planilla: string | null = null;
  if (empleadoId && cedula) {
    const volver = encodeURIComponent(opts.planillaReturnPath);
    planilla = `/registro/planilla?empleadoId=${encodeURIComponent(empleadoId)}&cedula=${encodeURIComponent(cedula)}&volver=${volver}`;
  }

  return {
    ok: true,
    preview: {
      texto_compilado: texto,
      datos_faltantes: faltantes,
      planilla_completar_url: planilla,
    },
  };
}

/**
 * Lee `{ overrides: Record<string, string> }` desde POST JSON (RRHH: datos manuales para la plantilla).
 * Solo acepta claves alfanuméricas en MAYÚSCULAS con guiones bajos (como placeholders `{{VAR}}`).
 */
export function parseOverridesContratoRequestBody(body: unknown): Record<string, string> | undefined {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return undefined;
  const raw = (body as { overrides?: unknown }).overrides;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof k !== 'string' || k.length > 120 || !/^[A-Z0-9_]+$/.test(k)) continue;
    out[k] = String(v ?? '');
  }
  return Object.keys(out).length ? out : undefined;
}

function str(v: unknown): string {
  if (v == null) return '';
  return String(v).trim();
}
