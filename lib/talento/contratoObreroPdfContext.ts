import type { SupabaseClient } from '@supabase/supabase-js';
import type { HojaVidaObreroCompleta } from '@/lib/talento/hojaVidaObreroCompleta';
import { emptyHojaVidaObreroCompleta } from '@/lib/talento/hojaVidaObreroCompleta';
import {
  compilarPlantillaContratoObrero,
  construirMapaVariablesContratoObrero,
  type DatoContratoFaltante,
  type FuentesContratoObrero,
} from '@/lib/talento/plantillaContratoObreroCompile';
import { obtenerCuerpoPlantillaContratoObrero } from '@/lib/talento/plantillaContratoObreroRepo';
import { CONTRATO_OBRERO_CUERPO_DEFAULT } from '@/lib/talento/plantillas/contratoObreroDefaultCuerpo';

function parseHoja(raw: unknown): HojaVidaObreroCompleta | null {
  if (!raw || typeof raw !== 'object') return null;
  try {
    return raw as HojaVidaObreroCompleta;
  } catch {
    return null;
  }
}

async function resolverPatronoDesdeEntidad(
  supabase: SupabaseClient,
  entidadId: string | null,
): Promise<{ nombre: string; domicilio: string; representante: string }> {
  const envNombre = (process.env.NEXT_PUBLIC_PATRON_NOMBRE ?? 'CASA INTELIGENTE').trim();
  const envDom = (process.env.NEXT_PUBLIC_PATRON_DOMICILIO ?? '').trim();
  const envRep = (process.env.NEXT_PUBLIC_PATRON_REPRESENTANTE ?? '').trim();
  const eid = (entidadId ?? '').trim();
  if (!eid) return { nombre: envNombre, domicilio: envDom, representante: envRep };

  const { data, error } = await supabase
    .from('ci_entidades')
    .select('nombre,direccion_fiscal,domicilio_fiscal,rep_legal_nombre')
    .eq('id', eid)
    .maybeSingle();
  if (error || !data) return { nombre: envNombre, domicilio: envDom, representante: envRep };

  const e = data as {
    nombre?: string | null;
    direccion_fiscal?: string | null;
    domicilio_fiscal?: string | null;
    rep_legal_nombre?: string | null;
  };
  return {
    nombre: strOpt(e.nombre) ?? envNombre,
    domicilio: strOpt(e.domicilio_fiscal) ?? strOpt(e.direccion_fiscal) ?? envDom,
    representante: strOpt(e.rep_legal_nombre) ?? envRep,
  };
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
      .select('nombre_completo,documento,cedula,direccion_habitacion,celular,telefono,hoja_vida_obrero')
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
    documento: string | null;
    cedula: string | null;
    direccion_habitacion?: string | null;
    celular?: string | null;
    telefono?: string | null;
    hoja_vida_obrero?: unknown;
  };

  const o = obra as {
    nombre: string;
    ubicacion_texto?: string | null;
    obra_ubicacion?: string | null;
    entidad_id?: string | null;
  };
  const ubic = (o.obra_ubicacion ?? o.ubicacion_texto ?? '').trim() || null;

  const hv = parseHoja(e.hoja_vida_obrero) ?? emptyHojaVidaObreroCompleta();

  const patron = await resolverPatronoDesdeEntidad(admin, strOpt(o.entidad_id));

  const fuentes: FuentesContratoObrero = {
    empleado: {
      nombre_completo: e.nombre_completo,
      documento: e.documento,
      cedula: e.cedula,
      direccion: strOpt(e.direccion_habitacion),
      celular: e.celular,
      telefono: e.telefono,
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
      domicilio: patron.domicilio,
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
      'nombre_completo,documento,cedula,direccion_habitacion,celular,telefono,hoja_vida_obrero,cargo_nombre,cargo_codigo,cargo_nivel,proyecto_modulo_id,recruitment_need_id',
    )
    .eq('id', eid)
    .maybeSingle();

  if (ee || !emp) {
    return { ok: false, error: ee?.message ?? 'Empleado no encontrado' };
  }

  const e = emp as {
    nombre_completo: string | null;
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

  const hv = parseHoja(e.hoja_vida_obrero) ?? emptyHojaVidaObreroCompleta();
  const dir = strOpt(e.direccion_habitacion);
  const patron = await resolverPatronoDesdeEntidad(supabase, entidadId);

  const fuentes: FuentesContratoObrero = {
    empleado: {
      nombre_completo: e.nombre_completo,
      documento: e.documento,
      cedula: e.cedula,
      direccion: dir,
      celular: e.celular,
      telefono: e.telefono,
    },
    hojaVida: hv,
    contrato,
    obra: { nombre: obraNombre, ubicacion: obraUbic },
    patron: {
      nombre: patron.nombre,
      domicilio: patron.domicilio,
      representante: patron.representante,
    },
  };

  return { ok: true, fuentes };
}

/**
 * Plantilla biblioteca + expediente del empleado (sin `contrato_id`). Usado por vista JSON y PDF RRHH.
 */
export async function compilarContratoObreroDesdeEmpleadoId(
  supabase: SupabaseClient,
  empleadoId: string,
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

  const mapa = construirMapaVariablesContratoObrero(fu.fuentes);
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

function str(v: unknown): string {
  if (v == null) return '';
  return String(v).trim();
}
