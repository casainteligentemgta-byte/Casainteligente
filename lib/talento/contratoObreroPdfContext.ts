import type { SupabaseClient } from '@supabase/supabase-js';
import { PRESUPUESTO_BRAND } from '@/lib/presupuesto/brand';
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
import type { RepresentanteMercantilCi } from '@/types/ci-entidad';
import {
  domicilioLineaComparecenciaPatrono,
  domicilioPatronoParaEntidad,
  ubicacionEmpresaResueltaParaPdf,
} from '@/lib/talento/patronoDomicilioReglas';
import {
  fusionarEmpleadoContratoDesdePlanilla,
  parseHojaVidaObrero,
  patronEmpresaDomicilioDesdeHojaJson,
} from '@/lib/talento/empleadoContratoDesdeHojaPlanilla';
import { resolvePlanillaPatronoParaEmpleado } from '@/lib/talento/resolvePlanillaPatronoPdf';
import { resolverTextoHorarioSemanalObra } from '@/lib/talento/horarioSemanalContratoPdf';
import { camposRegistroMercantilDesdeRecord, parseRegistroMercantilRecord } from '@/lib/talento/registroMercantilCamposPdf';
import {
  formatearUsdContratoPdf,
  ingresoSemanalConsolidadoUsdDesdeNivelGaceta,
  ingresoSemanalConsolidadoUsdDesdeNivelGacetaCestaticketUsd40,
  nivelGacetaDesdeCodigoOficio,
  nivelGacetaDesdeSalarioBasicoDiarioVes,
} from '@/lib/talento/ingresoSemanalUsdTabuladorConstruccion';
import { textoPuntoEncuentroTransporteClausulaSex } from '@/lib/talento/puntoEncuentroTransporteClausulaSex';

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
        'duracion_referencial_semanas',
        'horario_semanal_texto',
        'fecha_firma_contrato',
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
    duracion_referencial_semanas?: string | null;
    horario_semanal_texto?: string | null;
    fecha_firma_contrato?: string | null;
  };

  const vinculo = row.obra_id ?? row.proyecto_id ?? null;
  if (!vinculo) {
    return { ok: false, error: 'El contrato no tiene obra ni proyecto vinculado.' };
  }

  const [{ data: emp, error: ee }, proyectoRes] = await Promise.all([
    admin
      .from('ci_empleados')
      .select(
        'nombre_completo,nombres,documento,cedula,direccion_domicilio,direccion_habitacion,nacionalidad,estado_civil,celular,telefono,hoja_vida_obrero,proyecto_modulo_id,recruitment_need_id',
      )
      .eq('id', row.empleado_id)
      .maybeSingle(),
    fetchCiProyectoCamposContratoPdf(admin, vinculo),
  ]);
  const obra = proyectoRes.data;
  const eo = proyectoRes.error;

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
    direccion_domicilio?: string | null;
    direccion_habitacion?: string | null;
    nacionalidad?: string | null;
    estado_civil?: string | null;
    celular?: string | null;
    telefono?: string | null;
    hoja_vida_obrero?: unknown;
    proyecto_modulo_id?: string | null;
    recruitment_need_id?: string | null;
  };

  const o = obra as {
    nombre: string;
    ubicacion_texto?: string | null;
    obra_ubicacion?: string | null;
    entidad_id?: string | null;
    horario_semanal_obra_default?: string | null;
    punto_encuentro_transporte_contrato?: string | null;
  };
  const ubic = (o.obra_ubicacion ?? o.ubicacion_texto ?? '').trim() || null;

  const hv = parseHojaVidaObrero(e.hoja_vida_obrero) ?? emptyHojaVidaObreroCompleta();
  const empleado = fusionarEmpleadoContratoDesdePlanilla(e, hv);

  const horarioSemanalResuelto = resolverTextoHorarioSemanalObra({
    horarioContrato: row.horario_semanal_texto,
    horarioProyectoDefault: strOpt(o.horario_semanal_obra_default),
    jornadaTrabajo: row.jornada_trabajo,
  });

  const patronBase = await resolverPatronoDesdeEntidad(admin, strOpt(o.entidad_id));
  const domDesdeHoja = patronEmpresaDomicilioDesdeHojaJson(e.hoja_vida_obrero);
  const planillaCampos = await resolvePlanillaPatronoParaEmpleado(
    admin,
    {
      proyecto_modulo_id: e.proyecto_modulo_id,
      recruitment_need_id: e.recruitment_need_id,
      hoja_vida_obrero: e.hoja_vida_obrero,
    } as Record<string, unknown>,
    { proyectoModuloIdAlternativo: vinculo },
  );
  const domDesdePlanilla = strOpt(planillaCampos.empresaDomicilio);
  const domicilioPatrono = domDesdeHoja ?? domDesdePlanilla ?? patronBase.domicilio;
  const patronExtra = await fetchPatronoEntidadExtraParaPlantilla(admin, strOpt(o.entidad_id));
  const patron: FuentesContratoObrero['patron'] = {
    nombre: patronBase.nombre,
    domicilio: domicilioPatrono,
    representante: patronBase.representante,
    ...patronExtra,
  };

  const fuentes: FuentesContratoObrero = {
    empleado: {
      nombre_completo: empleado.nombre_completo,
      documento: empleado.documento,
      cedula: empleado.cedula,
      direccion: empleado.direccion,
      nacionalidad: empleado.nacionalidad,
      estado_civil: empleado.estado_civil,
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
      duracion_referencial_semanas: row.duracion_referencial_semanas,
      horario_semanal_texto: horarioSemanalResuelto,
      fecha_firma_contrato: row.fecha_firma_contrato,
    },
    obra: {
      nombre: o.nombre,
      ubicacion: ubic,
      punto_encuentro_transporte_contrato: strOpt(o.punto_encuentro_transporte_contrato),
    },
    patron: {
      ...patron,
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
  duracion_referencial_semanas?: string | null;
  horario_semanal_texto?: string | null;
  fecha_firma_contrato?: string | null;
};

function strOpt(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

/** Campos de obra/proyecto para PDF; se prueba de más completo a más mínimo (columnas opcionales 086/115/117/123/124). */
const CI_PROYECTO_SELECT_CANDIDATES = [
  'nombre,ubicacion_texto,obra_ubicacion,entidad_id,horario_semanal_obra_default,punto_encuentro_transporte_contrato',
  'nombre,ubicacion_texto,entidad_id,horario_semanal_obra_default,punto_encuentro_transporte_contrato',
  'nombre,ubicacion_texto,obra_ubicacion,entidad_id,horario_semanal_obra_default',
  'nombre,ubicacion_texto,entidad_id,horario_semanal_obra_default',
  'nombre,ubicacion_texto,obra_ubicacion,entidad_id,punto_encuentro_transporte_contrato',
  'nombre,ubicacion_texto,entidad_id,punto_encuentro_transporte_contrato',
  'nombre,ubicacion_texto,obra_ubicacion,entidad_id',
  'nombre,ubicacion_texto,entidad_id',
] as const;

async function fetchCiProyectoCamposContratoPdf(
  supabase: SupabaseClient,
  proyectoId: string,
): Promise<{ data: unknown; error: { message: string } | null }> {
  const id = proyectoId.trim();
  if (!id) return { data: null, error: { message: 'proyecto_id vacío' } };

  let lastErr: { message: string } | null = null;
  for (const sel of CI_PROYECTO_SELECT_CANDIDATES) {
    const attempt = await supabase.from('ci_proyectos').select(sel).eq('id', id).maybeSingle();
    if (!attempt.error) {
      return { data: attempt.data, error: null };
    }
    lastErr = attempt.error;
  }
  return { data: null, error: lastErr };
}

/**
 * Columnas de `ci_entidades` para PDF express / estructurado.
 * Si no existe migración 125 (`domicilio_fiscal` / `municipio_fiscal` / `estado_fiscal`), PostgREST falla con el SELECT largo;
 * se reintenta con listas más cortas (misma idea que `CI_PROYECTO_SELECT_CANDIDATES`).
 */
const CI_ENTIDAD_SELECT_CANDIDATES = [
  'nombre,nombre_legal,nombre_comercial,rif,direccion_fiscal,domicilio_fiscal,municipio_fiscal,estado_fiscal,rep_legal_nombre,rep_legal_cedula,rep_legal_cargo,registro_mercantil',
  'nombre,nombre_legal,nombre_comercial,rif,direccion_fiscal,rep_legal_nombre,rep_legal_cedula,rep_legal_cargo,registro_mercantil',
  'nombre,rif,direccion_fiscal,rep_legal_nombre,rep_legal_cedula,rep_legal_cargo,registro_mercantil',
] as const;

async function fetchCiEntidadCamposContratoPdf(
  supabase: SupabaseClient,
  entidadId: string,
): Promise<{ data: unknown; error: { message: string } | null }> {
  const id = entidadId.trim();
  if (!id) return { data: null, error: { message: 'entidad_id vacío' } };
  let lastErr: { message: string } | null = null;
  for (const sel of CI_ENTIDAD_SELECT_CANDIDATES) {
    const attempt = await supabase.from('ci_entidades').select(sel).eq('id', id).maybeSingle();
    if (!attempt.error) {
      return { data: attempt.data, error: null };
    }
    lastErr = attempt.error;
  }
  return { data: null, error: lastErr };
}

const PATRON_ENTIDAD_EXTRA_SELECT_CANDIDATES = [
  'nombre_legal,rif,rep_legal_nombre,rep_legal_cedula,municipio_fiscal,estado_fiscal,registro_mercantil',
  'nombre_legal,rif,rep_legal_nombre,rep_legal_cedula,registro_mercantil',
  'nombre_legal,rif,rep_legal_nombre,rep_legal_cedula',
] as const;

/** RIF y representante legal desde `ci_entidades` para la plantilla biblioteca (comparecencia). */
async function fetchPatronoEntidadExtraParaPlantilla(
  supabase: SupabaseClient,
  entidadId: string | null,
): Promise<Partial<FuentesContratoObrero['patron']>> {
  const eid = (entidadId ?? '').trim();
  if (!eid) return {};
  for (const sel of PATRON_ENTIDAD_EXTRA_SELECT_CANDIDATES) {
    const { data, error } = await supabase.from('ci_entidades').select(sel).eq('id', eid).maybeSingle();
    if (error || !data || typeof data !== 'object') continue;
    const r = data as Record<string, unknown>;
    const ubi = ubicacionEmpresaResueltaParaPdf(r.registro_mercantil, {
      direccion_fiscal: strOpt(r.direccion_fiscal as string | null | undefined),
      domicilio_fiscal: strOpt(r.domicilio_fiscal as string | null | undefined),
    });
    const rmRep = (() => {
      const rm = r.registro_mercantil;
      if (!rm || typeof rm !== 'object' || Array.isArray(rm)) return null;
      const arr = (rm as { representantes?: unknown }).representantes;
      if (!Array.isArray(arr) || !arr[0] || typeof arr[0] !== 'object') return null;
      return arr[0] as Record<string, unknown>;
    })();
    return {
      nombre_legal: strOpt(r.nombre_legal) ?? undefined,
      rif: strOpt(r.rif) ?? undefined,
      rep_legal_nombre: strOpt(r.rep_legal_nombre) ?? strOpt(rmRep?.nombre as string | undefined) ?? undefined,
      rep_legal_cedula: strOpt(r.rep_legal_cedula) ?? strOpt(rmRep?.cedula as string | undefined) ?? undefined,
      rep_legal_cargo: strOpt(r.rep_legal_cargo) ?? strOpt(rmRep?.cargo as string | undefined) ?? undefined,
      rep_nacionalidad: strOpt(rmRep?.nacionalidad as string | undefined) ?? undefined,
      rep_estado_civil: strOpt(rmRep?.estado_civil as string | undefined) ?? undefined,
      rep_legal_femenino: rmRep?.genero === 'F' || r.rep_legal_femenino === true,
      registro_mercantil: r.registro_mercantil,
      municipio: ubi.municipio ?? strOpt(r.municipio_fiscal) ?? undefined,
      estado_geo: ubi.estado ?? strOpt(r.estado_fiscal) ?? undefined,
      sector_geo: ubi.sector ?? undefined,
    };
  }
  return {};
}

function pickRepCampoLoose(rep: Record<string, unknown>, ...candidatos: string[]): string | undefined {
  for (const c of candidatos) {
    const direct = rep[c];
    if (typeof direct === 'string' && direct.trim()) return direct.trim();
    const low = c.toLowerCase();
    for (const [k, v] of Object.entries(rep)) {
      if (k.toLowerCase() === low && typeof v === 'string' && v.trim()) return v.trim();
    }
  }
  return undefined;
}

function normalizarGeneroRepresentanteRM(v: unknown): 'M' | 'F' | undefined {
  const s = String(v ?? '').trim().toUpperCase();
  if (!s) return undefined;
  if (s === 'F' || s === 'FEMENINO' || s === 'FEMENINA') return 'F';
  if (s === 'M' || s === 'MASCULINO') return 'M';
  return undefined;
}

function primerRepresentanteRegistro(raw: unknown): RepresentanteMercantilCi | undefined {
  if (!raw) return undefined;
  let o: unknown = raw;
  if (typeof raw === 'string') {
    try {
      o = JSON.parse(raw) as unknown;
    } catch {
      return undefined;
    }
  }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return undefined;
  const reps = (o as { representantes?: unknown }).representantes;
  if (!Array.isArray(reps) || !reps[0] || typeof reps[0] !== 'object' || Array.isArray(reps[0])) return undefined;
  const row = reps[0] as Record<string, unknown>;
  const genero =
    normalizarGeneroRepresentanteRM(pickRepCampoLoose(row, 'genero', 'sexo')) ??
    normalizarGeneroRepresentanteRM(row.genero) ??
    normalizarGeneroRepresentanteRM(row.sexo);
  return {
    nombre: pickRepCampoLoose(row, 'nombre'),
    cedula: pickRepCampoLoose(row, 'cedula'),
    edad: pickRepCampoLoose(row, 'edad'),
    estado_civil: pickRepCampoLoose(row, 'estado_civil', 'estadoCivil', 'Estado_civil'),
    nacionalidad: pickRepCampoLoose(row, 'nacionalidad', 'Nacionalidad'),
    cargo: pickRepCampoLoose(row, 'cargo'),
    domicilio: pickRepCampoLoose(row, 'domicilio'),
    municipio_residencia: pickRepCampoLoose(row, 'municipio_residencia', 'municipioResidencia'),
    estado_residencia: pickRepCampoLoose(row, 'estado_residencia', 'estadoResidencia'),
    profesion: pickRepCampoLoose(row, 'profesion'),
    genero: genero ?? 'M',
  };
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
      'nombre_completo,nombres,documento,cedula,direccion_domicilio,direccion_habitacion,nacionalidad,estado_civil,celular,telefono,hoja_vida_obrero,cargo_nombre,cargo_codigo,cargo_nivel,proyecto_modulo_id,recruitment_need_id',
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
    direccion_domicilio?: string | null;
    direccion_habitacion?: string | null;
    nacionalidad?: string | null;
    estado_civil?: string | null;
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
  let horarioProyectoDefault: string | null = null;
  let puntoEncTransporteProyecto: string | null = null;
  if (proyectoId) {
    const { data: ob } = await fetchCiProyectoCamposContratoPdf(supabase, proyectoId);
    if (ob) {
      const o = ob as {
        nombre: string;
        ubicacion_texto?: string | null;
        obra_ubicacion?: string | null;
        entidad_id?: string | null;
        horario_semanal_obra_default?: string | null;
        punto_encuentro_transporte_contrato?: string | null;
      };
      obraNombre = o.nombre;
      obraUbic = (o.obra_ubicacion ?? o.ubicacion_texto ?? '').trim() || null;
      entidadId = strOpt(o.entidad_id);
      horarioProyectoDefault = strOpt(o.horario_semanal_obra_default);
      puntoEncTransporteProyecto = strOpt(o.punto_encuentro_transporte_contrato);
    }
  }

  const { data: ctr, error: ctrErr } = await supabase
    .from('ci_contratos_empleado_obra')
    .select(
      'cargo_oficio_desempeño,lugar_prestacion_servicio,objeto_contrato,tipo_contrato,jornada_trabajo,salario_basico_diario_ves,forma_pago,lugar_pago,fecha_ingreso,numero_oficio_tabulador,gaceta_denominacion_oficio,duracion_referencial_semanas,horario_semanal_texto,fecha_firma_contrato',
    )
    .eq('empleado_id', eid)
    .order('id', { ascending: false })
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

  const horarioSemanalResueltoEmpleado = resolverTextoHorarioSemanalObra({
    horarioContrato: c?.horario_semanal_texto,
    horarioProyectoDefault: horarioProyectoDefault,
    jornadaTrabajo: c?.jornada_trabajo,
  });

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
    duracion_referencial_semanas: c?.duracion_referencial_semanas ?? null,
    horario_semanal_texto: horarioSemanalResueltoEmpleado,
    fecha_firma_contrato: c?.fecha_firma_contrato ?? null,
  };

  const hv = parseHojaVidaObrero(e.hoja_vida_obrero) ?? emptyHojaVidaObreroCompleta();
  const empleado = fusionarEmpleadoContratoDesdePlanilla(e, hv);
  const patronBase = await resolverPatronoDesdeEntidad(supabase, entidadId);
  const domDesdeHoja = patronEmpresaDomicilioDesdeHojaJson(e.hoja_vida_obrero);
  const planillaCampos = await resolvePlanillaPatronoParaEmpleado(
    supabase,
    {
      proyecto_modulo_id: e.proyecto_modulo_id,
      recruitment_need_id: e.recruitment_need_id,
      hoja_vida_obrero: e.hoja_vida_obrero,
    } as Record<string, unknown>,
    { proyectoModuloIdAlternativo: proyectoId },
  );
  const domDesdePlanilla = strOpt(planillaCampos.empresaDomicilio);
  const domicilioPatrono = domDesdeHoja ?? domDesdePlanilla ?? patronBase.domicilio;
  const patronExtra = await fetchPatronoEntidadExtraParaPlantilla(supabase, entidadId);
  const patron: FuentesContratoObrero['patron'] = {
    nombre: patronBase.nombre,
    domicilio: domicilioPatrono,
    representante: patronBase.representante,
    ...patronExtra,
  };

  const fuentes: FuentesContratoObrero = {
    empleado: {
      nombre_completo: empleado.nombre_completo,
      documento: empleado.documento,
      cedula: empleado.cedula,
      direccion: empleado.direccion,
      nacionalidad: empleado.nacionalidad,
      estado_civil: empleado.estado_civil,
      celular: empleado.celular,
      telefono: empleado.telefono,
    },
    hojaVida: hv,
    contrato,
    obra: {
      nombre: obraNombre,
      ubicacion: obraUbic,
      punto_encuentro_transporte_contrato: puntoEncTransporteProyecto,
    },
    patron: {
      ...patron,
      domicilio: domicilioPatrono,
    },
  };

  return { ok: true, fuentes };
}

const DIAS_MES_REF_SALARIO = 30;

/**
 * Patrono (`ci_entidades.id`) para el PDF estructurado: primero el proyecto del empleado
 * (`proyecto_modulo_id` / vacante); si ahí no hay `entidad_id`, el de la obra del último contrato
 * (`ci_contratos_empleado_obra.obra_id` → `ci_proyectos.entidad_id`), donde suele estar el RM en Talento.
 */
/** Datos de RM y representante legal usados en contratos cuando el patrono es CASA INTELIGENTE y faltan campos en BD. */
const DEFAULT_RM_PATRONO_CASA_INTELIGENTE = {
  rm_tomo: '56',
  rm_numero: '76',
  rm_fecha: '2015-03-15',
  rep_legal_nombre: 'Luis Vicente Mata Ortiz',
  rep_legal_cedula: 'V1384818688',
  rep_legal_cargo: 'Presidente',
  rif: PRESUPUESTO_BRAND.rifEmpresa,
} as const;

function textoSugierePatronoCasaInteligente(...partes: (string | null | undefined)[]): boolean {
  for (const p of partes) {
    if ((p ?? '').toLowerCase().includes('casa inteligente')) return true;
  }
  return false;
}

function rellenarEntidadCasaInteligenteContratoPdf(
  entidad: ContratoObreroPdfStructuredProps['entidad'],
  entidadRow: Record<string, unknown> | null,
  patronNombrePlanilla: string,
): void {
  if (
    !textoSugierePatronoCasaInteligente(
      strOpt(entidadRow?.nombre_legal),
      strOpt(entidadRow?.nombre),
      strOpt(entidad.nombre_legal),
      strOpt(entidad.nombre),
      patronNombrePlanilla,
    )
  ) {
    return;
  }
  const d = DEFAULT_RM_PATRONO_CASA_INTELIGENTE;
  if (!strOpt(entidad.rif)) entidad.rif = d.rif;
  if (!strOpt(entidad.rm_tomo)) entidad.rm_tomo = d.rm_tomo;
  if (!strOpt(entidad.rm_numero)) entidad.rm_numero = d.rm_numero;
  if (!strOpt(entidad.rm_fecha)) entidad.rm_fecha = d.rm_fecha;
  if (!strOpt(entidad.rep_legal_nombre)) entidad.rep_legal_nombre = d.rep_legal_nombre;
  if (!strOpt(entidad.rep_legal_cedula)) entidad.rep_legal_cedula = d.rep_legal_cedula;
  if (!strOpt(entidad.rep_legal_cargo)) entidad.rep_legal_cargo = d.rep_legal_cargo;
}

async function resolverEntidadIdPatronoParaPdfEstructurado(
  supabase: SupabaseClient,
  empleadoId: string,
): Promise<string | null> {
  const eid = empleadoId.trim();
  const { data: empProyecto } = await supabase
    .from('ci_empleados')
    .select('proyecto_modulo_id,recruitment_need_id')
    .eq('id', eid)
    .maybeSingle();
  const ep = (empProyecto ?? null) as { proyecto_modulo_id?: string | null; recruitment_need_id?: string | null } | null;
  let proyectoId = strOpt(ep?.proyecto_modulo_id);
  if (!proyectoId) {
    const needId = strOpt(ep?.recruitment_need_id);
    if (needId) {
      const { data: need } = await supabase
        .from('recruitment_needs')
        .select('proyecto_modulo_id,proyecto_id')
        .eq('id', needId)
        .maybeSingle();
      const n = need as { proyecto_modulo_id?: string | null; proyecto_id?: string | null } | null;
      proyectoId = strOpt(n?.proyecto_modulo_id) ?? strOpt(n?.proyecto_id);
    }
  }
  if (proyectoId) {
    const { data: pr } = await supabase.from('ci_proyectos').select('entidad_id').eq('id', proyectoId).maybeSingle();
    const fromProyecto = strOpt((pr as { entidad_id?: string | null } | null)?.entidad_id);
    if (fromProyecto) return fromProyecto;
  }
  const { data: ctr } = await supabase
    .from('ci_contratos_empleado_obra')
    .select('obra_id')
    .eq('empleado_id', eid)
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();
  const obraId = strOpt((ctr as { obra_id?: string | null } | null)?.obra_id);
  if (!obraId) return null;
  const { data: prOb } = await supabase.from('ci_proyectos').select('entidad_id').eq('id', obraId).maybeSingle();
  return strOpt((prOb as { entidad_id?: string | null } | null)?.entidad_id);
}

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
  const nacionalidad = strOpt(dp?.nacionalidad) ?? strOpt(f.empleado.nacionalidad);
  const direccionHab = strOpt(f.empleado.direccion) ?? strOpt(dp?.direccionDomicilio);
  const cargoNom =
    strOpt(f.contrato.cargo_oficio_desempeño) ?? strOpt(hv.contratacion?.cargoUOficio) ?? null;
  const tareasEsp = strOpt(hv.contratacion?.cargoUOficio) ?? null;

  const entidadId = await resolverEntidadIdPatronoParaPdfEstructurado(supabase, empleadoId.trim());
  const entidadRes = entidadId ? await fetchCiEntidadCamposContratoPdf(supabase, entidadId) : { data: null };
  const entidadRow = (entidadRes.data ?? null) as Record<string, unknown> | null;
  const domPatronoFull = entidadRow
    ? domicilioPatronoParaEntidad({
        nombre_legal: strOpt(entidadRow.nombre_legal),
        nombre: strOpt(entidadRow.nombre),
        domicilio_fiscal: strOpt(entidadRow.domicilio_fiscal),
        direccion_fiscal: strOpt(entidadRow.direccion_fiscal),
        registro_mercantil: entidadRow.registro_mercantil,
      })
    : null;
  const domicilioLineaComparecencia = entidadRow
    ? domicilioLineaComparecenciaPatrono({
        registro_mercantil: entidadRow.registro_mercantil,
        domicilio_fiscal: strOpt(entidadRow.domicilio_fiscal),
        direccion_fiscal: strOpt(entidadRow.direccion_fiscal),
      })
    : null;
  const domicilioEmpresaSegunRegistro = domicilioLineaComparecencia ?? domPatronoFull;
  const ubiRm = entidadRow
    ? ubicacionEmpresaResueltaParaPdf(entidadRow.registro_mercantil, {
        direccion_fiscal: strOpt(entidadRow.direccion_fiscal),
        domicilio_fiscal: strOpt(entidadRow.domicilio_fiscal),
      })
    : { estado: null, municipio: null, sector: null };
  const municipioComparecencia = ubiRm.municipio ?? strOpt(entidadRow?.municipio_fiscal);
  const estadoComparecencia = ubiRm.estado ?? strOpt(entidadRow?.estado_fiscal);
  const rmRep = primerRepresentanteRegistro(entidadRow?.registro_mercantil);
  const rm = parseRegistroMercantilRecord(entidadRow?.registro_mercantil);
  const rmCampos = camposRegistroMercantilDesdeRecord(rm);

  const entidad: ContratoObreroPdfStructuredProps['entidad'] = {
    nombre_legal: strOpt(entidadRow?.nombre_legal) ?? strOpt(entidadRow?.nombre) ?? f.patron.nombre,
    nombre: strOpt(entidadRow?.nombre),
    domicilio_fiscal: domicilioEmpresaSegunRegistro ?? f.patron.domicilio,
    direccion_fiscal: strOpt(entidadRow?.direccion_fiscal),
    municipio_fiscal: municipioComparecencia ?? undefined,
    estado_fiscal: estadoComparecencia ?? undefined,
    sector_domicilio_registro: ubiRm.sector ?? undefined,
    representante_legal: strOpt(entidadRow?.representante_legal) ?? f.patron.representante,
    rep_legal_nombre: strOpt(entidadRow?.rep_legal_nombre) ?? strOpt(rmRep?.nombre),
    rep_legal_cedula: strOpt(entidadRow?.rep_legal_cedula) ?? strOpt(rmRep?.cedula),
    rep_legal_cargo: strOpt(entidadRow?.rep_legal_cargo) ?? strOpt(rmRep?.cargo),
    rep_legal_nacionalidad:
      strOpt(entidadRow?.['rep_legal_nacionalidad']) ?? strOpt(rmRep?.nacionalidad) ?? undefined,
    rep_legal_estado_civil:
      strOpt(entidadRow?.['rep_legal_estado_civil']) ?? strOpt(rmRep?.estado_civil) ?? undefined,
    rep_legal_femenino: rmRep?.genero === 'F' || entidadRow?.['rep_legal_femenino'] === true,
    rep_legal_domicilio: strOpt(rmRep?.domicilio) || undefined,
    rep_legal_municipio_residencia: strOpt(rmRep?.municipio_residencia) || undefined,
    rep_legal_estado_residencia: strOpt(rmRep?.estado_residencia) || undefined,
    rif: strOpt(entidadRow?.rif),
    rm_oficina: strOpt(rmCampos.circunscripcion) || null,
    rm_fecha: strOpt(rmCampos.fecha) || null,
    rm_numero: strOpt(rmCampos.numero) || null,
    rm_tomo: strOpt(rmCampos.tomo) || null,
  };
  rellenarEntidadCasaInteligenteContratoPdf(entidad, entidadRow, f.patron.nombre);

  const empleado: ContratoObreroPdfStructuredProps['empleado'] = {
    nombres: f.empleado.nombre_completo,
    nacionalidad,
    estado_civil: strOpt(f.empleado.estado_civil),
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
    const { data: nomList, error: nomErr } = await supabase
      .from('ci_config_nomina')
      .select('salario_base_mensual,cestaticket_mensual,vigencia_desde')
      .ilike('cargo_codigo', codTab)
      .order('vigencia_desde', { ascending: false })
      .limit(1);
    if (nomErr) {
      console.warn('[cargarPropsContratoObreroPdfEstructurado] ci_config_nomina', nomErr.message);
    }
    const nom = Array.isArray(nomList) && nomList[0] && typeof nomList[0] === 'object' ? nomList[0] : null;
    if (nom) {
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

  const salarioDiarioNum =
    sbDia != null && Number.isFinite(Number(sbDia)) && Number(sbDia) > 0 ? Number(sbDia) : null;

  const nivelGaceta =
    nivelGacetaDesdeCodigoOficio(codTab) ?? nivelGacetaDesdeSalarioBasicoDiarioVes(salarioDiarioNum);
  const ingresoUsdNum =
    nivelGaceta != null ? ingresoSemanalConsolidadoUsdDesdeNivelGaceta(nivelGaceta, cestaMensual) : null;
  const ingresoSemanalUsdTabulador =
    ingresoUsdNum != null && Number.isFinite(ingresoUsdNum) ? formatearUsdContratoPdf(ingresoUsdNum) : null;

  const configNomina: ContratoObreroPdfStructuredProps['configNomina'] = {
    funciones_oficiales: funcionesOficiales,
    salario_base_mensual: salarioMensual,
    cestaticket_mensual: cestaMensual,
    salario_basico_diario_ves: salarioDiarioNum,
  };

  const parametros: ContratoObreroPdfStructuredProps['parametros'] = {
    tipoPlazo: f.contrato.tipo_contrato,
    fechaIngreso: strOpt(f.contrato.fecha_ingreso),
    duracionSemanasReferencial: strOpt(f.contrato.duracion_referencial_semanas),
    horarioSemanal: strOpt(f.contrato.horario_semanal_texto),
    fechaFirmaContratoIso: strOpt(f.contrato.fecha_firma_contrato) ?? strOpt(f.contrato.fecha_ingreso),
    ingresoSemanalConsolidadoUsdTexto: ingresoSemanalUsdTabulador,
    textoPuntoEncuentroTransporteSex: textoPuntoEncuentroTransporteClausulaSex(
      f.obra.punto_encuentro_transporte_contrato,
    ),
  };

  const obraDenomRaw = (f.obra.nombre ?? '').trim();
  const obraDenominadaPdf =
    obraDenomRaw.length > 0 && obraDenomRaw.toLowerCase() !== 'por definir' ? obraDenomRaw : null;

  const contratoPdf: ContratoObreroPdfStructuredProps['contrato'] = {
    objeto_contrato: strOpt(f.contrato.objeto_contrato),
    lugar_prestacion_servicio: strOpt(f.contrato.lugar_prestacion_servicio),
    obra_denominada: obraDenominadaPdf,
  };

  return {
    ok: true,
    props: {
      expedienteId: null,
      empleado,
      entidad,
      configNomina,
      parametros,
      contrato: contratoPdf,
    },
  };
}

/** Entrada manual para contrato express (sin `ci_empleados`). */
export type ContratoExpressManualInput = {
  obreroNombre: string;
  obreroCedula: string;
  obreroDireccion?: string | null;
  nacionalidad?: string | null;
  estadoCivil?: string | null;
  fechaIngreso?: string | null;
  fechaFirmaContratoIso?: string | null;
  objetoContrato?: string | null;
  jornadaTrabajo?: string | null;
  tipoContrato?: string | null;
  /** Detalle de horario (texto tras las 40 h. en cláusula CUARTA); prioridad sobre default de obra/jornada. */
  horarioSemanalTexto?: string | null;
  /** Comparecencia: municipio de residencia del trabajador. */
  obreroMunicipioResidencia?: string | null;
  /** Comparecencia: estado de residencia del trabajador. */
  obreroEstadoResidencia?: string | null;
  /** Bono especial no salarial en USD (cláusula SEXTA del PDF). */
  bonoManualUsd?: number | null;
};

/**
 * Props para {@link ContratoObreroPDF} cuando no hay empleado registrado: proyecto + fila del tabulador + datos manuales.
 */
export async function cargarPropsContratoObreroPdfExpress(
  supabase: SupabaseClient,
  proyectoId: string,
  configNominaId: string,
  manual: ContratoExpressManualInput,
  opts?: { entidadPatronoId?: string | null },
): Promise<{ ok: true; props: ContratoObreroPdfStructuredProps } | { ok: false; error: string }> {
  const pid = proyectoId.trim();
  const nid = configNominaId.trim();
  if (!pid || !nid) {
    return { ok: false, error: 'proyecto_id y config_nomina_id son obligatorios.' };
  }

  const [proyectoRes, { data: nomRow, error: en }] = await Promise.all([
    fetchCiProyectoCamposContratoPdf(supabase, pid),
    supabase
      .from('ci_config_nomina')
      .select('cargo_nombre,cargo_codigo,salario_base_mensual,cestaticket_mensual,nivel_salarial,vigencia_desde')
      .eq('id', nid)
      .maybeSingle(),
  ]);
  const obra = proyectoRes.data;
  const eo = proyectoRes.error;

  if (eo || !obra) {
    return { ok: false, error: eo?.message ?? 'Proyecto no encontrado.' };
  }
  if (en || !nomRow || typeof nomRow !== 'object') {
    return { ok: false, error: en?.message ?? 'Cargo / tabulador no encontrado.' };
  }

  const o = obra as {
    nombre: string;
    ubicacion_texto?: string | null;
    obra_ubicacion?: string | null;
    entidad_id?: string | null;
    horario_semanal_obra_default?: string | null;
    punto_encuentro_transporte_contrato?: string | null;
  };

  const nom = nomRow as {
    cargo_nombre?: string | null;
    cargo_codigo?: string | null;
    salario_base_mensual?: unknown;
    cestaticket_mensual?: unknown;
    nivel_salarial?: number | null;
  };

  const entidadIdProyecto = strOpt(o.entidad_id);
  const entidadId = strOpt(opts?.entidadPatronoId) ?? entidadIdProyecto;
  const entidadRes = entidadId ? await fetchCiEntidadCamposContratoPdf(supabase, entidadId) : { data: null };
  const entidadRow = (entidadRes.data ?? null) as Record<string, unknown> | null;
  const patronBase = await resolverPatronoDesdeEntidad(supabase, entidadId);
  const domPatronoFull = entidadRow
    ? domicilioPatronoParaEntidad({
        nombre_legal: strOpt(entidadRow.nombre_legal),
        nombre: strOpt(entidadRow.nombre),
        domicilio_fiscal: strOpt(entidadRow.domicilio_fiscal),
        direccion_fiscal: strOpt(entidadRow.direccion_fiscal),
        registro_mercantil: entidadRow.registro_mercantil,
      })
    : null;
  const domicilioLineaComparecencia = entidadRow
    ? domicilioLineaComparecenciaPatrono({
        registro_mercantil: entidadRow.registro_mercantil,
        domicilio_fiscal: strOpt(entidadRow.domicilio_fiscal),
        direccion_fiscal: strOpt(entidadRow.direccion_fiscal),
      })
    : null;
  const domicilioEmpresaSegunRegistro = domicilioLineaComparecencia ?? domPatronoFull;
  const ubiRm = entidadRow
    ? ubicacionEmpresaResueltaParaPdf(entidadRow.registro_mercantil, {
        direccion_fiscal: strOpt(entidadRow.direccion_fiscal),
        domicilio_fiscal: strOpt(entidadRow.domicilio_fiscal),
      })
    : { estado: null, municipio: null, sector: null };
  const municipioComparecencia = ubiRm.municipio ?? strOpt(entidadRow?.municipio_fiscal);
  const estadoComparecencia = ubiRm.estado ?? strOpt(entidadRow?.estado_fiscal);
  const rmRep = primerRepresentanteRegistro(entidadRow?.registro_mercantil);
  const rm = parseRegistroMercantilRecord(entidadRow?.registro_mercantil);
  const rmCampos = camposRegistroMercantilDesdeRecord(rm);
  const patronExtra = await fetchPatronoEntidadExtraParaPlantilla(supabase, entidadId);

  const entidad: ContratoObreroPdfStructuredProps['entidad'] = {
    nombre_legal: strOpt(entidadRow?.nombre_legal) ?? strOpt(entidadRow?.nombre) ?? patronBase.nombre,
    nombre: strOpt(entidadRow?.nombre),
    domicilio_fiscal: domicilioEmpresaSegunRegistro ?? patronBase.domicilio,
    direccion_fiscal: strOpt(entidadRow?.direccion_fiscal),
    municipio_fiscal: municipioComparecencia ?? undefined,
    estado_fiscal: estadoComparecencia ?? undefined,
    sector_domicilio_registro: ubiRm.sector ?? undefined,
    representante_legal: patronBase.representante,
    rep_legal_nombre: strOpt(entidadRow?.rep_legal_nombre) ?? strOpt(rmRep?.nombre) ?? patronExtra.rep_legal_nombre,
    rep_legal_cedula: strOpt(entidadRow?.rep_legal_cedula) ?? strOpt(rmRep?.cedula) ?? patronExtra.rep_legal_cedula,
    rep_legal_cargo: strOpt(entidadRow?.rep_legal_cargo) ?? strOpt(rmRep?.cargo),
    rep_legal_nacionalidad:
      strOpt(entidadRow?.['rep_legal_nacionalidad']) ?? strOpt(rmRep?.nacionalidad) ?? undefined,
    rep_legal_estado_civil:
      strOpt(entidadRow?.['rep_legal_estado_civil']) ?? strOpt(rmRep?.estado_civil) ?? undefined,
    rep_legal_femenino: rmRep?.genero === 'F' || entidadRow?.['rep_legal_femenino'] === true,
    rep_legal_domicilio: strOpt(rmRep?.domicilio) || undefined,
    rep_legal_municipio_residencia: strOpt(rmRep?.municipio_residencia) || undefined,
    rep_legal_estado_residencia: strOpt(rmRep?.estado_residencia) || undefined,
    rif: strOpt(entidadRow?.rif) ?? patronExtra.rif,
    rm_oficina: strOpt(rmCampos.circunscripcion) || null,
    rm_fecha: strOpt(rmCampos.fecha) || null,
    rm_numero: strOpt(rmCampos.numero) || null,
    rm_tomo: strOpt(rmCampos.tomo) || null,
  };
  rellenarEntidadCasaInteligenteContratoPdf(entidad, entidadRow, patronBase.nombre);

  const ubic = (o.obra_ubicacion ?? o.ubicacion_texto ?? '').trim() || null;
  const horarioSemanalResuelto = resolverTextoHorarioSemanalObra({
    horarioContrato: strOpt(manual.horarioSemanalTexto),
    horarioProyectoDefault: strOpt(o.horario_semanal_obra_default),
    jornadaTrabajo: manual.jornadaTrabajo,
  });

  const cargoNom = strOpt(nom.cargo_nombre);
  const nombreObrero = manual.obreroNombre.trim();
  const cedulaObrero = manual.obreroCedula.trim();
  const dirObrero = strOpt(manual.obreroDireccion);

  const empleado: ContratoObreroPdfStructuredProps['empleado'] = {
    nombres: nombreObrero,
    nombre_completo: nombreObrero,
    cedula: cedulaObrero,
    documento: cedulaObrero,
    direccion_domicilio: dirObrero ?? undefined,
    direccion_habitacion: dirObrero ?? undefined,
    nacionalidad: strOpt(manual.nacionalidad) ?? undefined,
    estado_civil: strOpt(manual.estadoCivil) ?? undefined,
    municipio_domicilio: strOpt(manual.obreroMunicipioResidencia) ?? undefined,
    estado_domicilio: strOpt(manual.obreroEstadoResidencia) ?? undefined,
    cargo_nombre: cargoNom,
    tareas_especificas: cargoNom,
  };

  const smRaw = Number(nom.salario_base_mensual);
  const ceRaw = Number(nom.cestaticket_mensual);
  const salarioMensual = Number.isFinite(smRaw) && smRaw > 0 ? smRaw : null;
  const cestaMensual = Number.isFinite(ceRaw) && ceRaw >= 0 ? ceRaw : null;

  const salarioDiarioNum =
    salarioMensual != null
      ? Math.round((salarioMensual / DIAS_MES_REF_SALARIO) * 10000) / 10000
      : null;

  const codTab = strOpt(nom.cargo_codigo);
  const nivelTab = nom.nivel_salarial;
  const nivelDesdeTab =
    nivelTab != null && Number.isFinite(Number(nivelTab)) && Number(nivelTab) >= 1 && Number(nivelTab) <= 9
      ? Number(nivelTab)
      : null;
  const nivelGaceta =
    nivelDesdeTab ??
    nivelGacetaDesdeCodigoOficio(codTab) ??
    nivelGacetaDesdeSalarioBasicoDiarioVes(salarioDiarioNum);

  const ingresoUsdNum =
    nivelGaceta != null ? ingresoSemanalConsolidadoUsdDesdeNivelGacetaCestaticketUsd40(nivelGaceta) : null;
  const ingresoSemanalUsdTabulador =
    ingresoUsdNum != null && Number.isFinite(ingresoUsdNum) ? formatearUsdContratoPdf(ingresoUsdNum) : null;

  const configNomina: ContratoObreroPdfStructuredProps['configNomina'] = {
    funciones_oficiales: cargoNom,
    salario_base_mensual: salarioMensual,
    cestaticket_mensual: cestaMensual,
    salario_basico_diario_ves: salarioDiarioNum,
  };

  const fechaIngreso = strOpt(manual.fechaIngreso);
  const fechaFirma = strOpt(manual.fechaFirmaContratoIso) ?? fechaIngreso;

  const parametros: ContratoObreroPdfStructuredProps['parametros'] = {
    tipoPlazo: strOpt(manual.tipoContrato),
    fechaIngreso: fechaIngreso ?? undefined,
    horarioSemanal: horarioSemanalResuelto,
    fechaFirmaContratoIso: fechaFirma ?? fechaIngreso ?? undefined,
    ingresoSemanalConsolidadoUsdTexto: ingresoSemanalUsdTabulador,
    bonoManualUsd:
      manual.bonoManualUsd != null && Number.isFinite(Number(manual.bonoManualUsd))
        ? Math.max(0, Number(manual.bonoManualUsd))
        : 0,
    textoPuntoEncuentroTransporteSex: textoPuntoEncuentroTransporteClausulaSex(
      strOpt(o.punto_encuentro_transporte_contrato),
    ),
  };

  const obraNombre = (o.nombre ?? '').trim();
  const obraDenominadaPdf =
    obraNombre.length > 0 && obraNombre.toLowerCase() !== 'por definir' ? obraNombre : null;
  const lugarPrestacion = ubic || obraNombre || null;

  const contratoPdf: ContratoObreroPdfStructuredProps['contrato'] = {
    objeto_contrato: strOpt(manual.objetoContrato),
    lugar_prestacion_servicio: lugarPrestacion,
    obra_denominada: obraDenominadaPdf,
  };

  return {
    ok: true,
    props: {
      expedienteId: null,
      esContratoExpress: true,
      empleado,
      entidad,
      configNomina,
      parametros,
      contrato: contratoPdf,
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
