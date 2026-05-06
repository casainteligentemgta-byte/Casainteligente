import type { HojaVidaObreroCompleta } from '@/lib/talento/hojaVidaObreroCompleta';

export type DatoContratoFaltante = {
  id: string;
  etiqueta: string;
  /** Texto corto para el obrero */
  ayuda: string;
};

const ETIQUETAS: Record<string, { etiqueta: string; ayuda: string }> = {
  PATRON_NOMBRE: { etiqueta: 'Nombre del patrono', ayuda: 'RRHH puede definirlo en la plantilla o datos de empresa.' },
  PATRON_DOMICILIO: {
    etiqueta: 'Domicilio fiscal del patrono',
    ayuda:
      'Se toma automáticamente de la entidad (`ci_entidades`) vinculada al proyecto (`entidad_id`). Complete dirección fiscal o domicilio en Configuración → Entidades si aparece vacío.',
  },
  PATRON_REPRESENTANTE: { etiqueta: 'Representante que firma', ayuda: 'Opcional; indique en plantilla o datos de obra.' },
  EMPLEADO_NOMBRE_COMPLETO: { etiqueta: 'Nombre completo del trabajador', ayuda: 'Revise su planilla de empleo.' },
  EMPLEADO_CEDULA: { etiqueta: 'Cédula o documento', ayuda: 'Indíquelo en la planilla de empleo.' },
  EMPLEADO_DIRECCION: { etiqueta: 'Domicilio del trabajador', ayuda: 'Planilla de empleo — datos personales.' },
  EMPLEADO_NACIONALIDAD: { etiqueta: 'Nacionalidad', ayuda: 'Planilla de empleo.' },
  EMPLEADO_ESTADO_CIVIL: { etiqueta: 'Estado civil', ayuda: 'Planilla de empleo.' },
  EMPLEADO_FECHA_NACIMIENTO: { etiqueta: 'Fecha de nacimiento', ayuda: 'Planilla de empleo.' },
  EMPLEADO_LUGAR_NACIMIENTO: { etiqueta: 'Lugar de nacimiento', ayuda: 'Planilla de empleo.' },
  EMPLEADO_CELULAR: { etiqueta: 'Teléfono celular', ayuda: 'Planilla de empleo.' },
  CONTRATO_CARGO_OFICIO: { etiqueta: 'Cargo u oficio del contrato', ayuda: 'RRHH al generar el contrato o tabulador.' },
  CONTRATO_LUGAR_PRESTACION: { etiqueta: 'Lugar de prestación de servicios', ayuda: 'Obra / proyecto en el contrato.' },
  CONTRATO_OBJETO: { etiqueta: 'Objeto del contrato', ayuda: 'Campo objeto en expediente del contrato.' },
  CONTRATO_TIPO_PLAZO: { etiqueta: 'Tipo de plazo (determinado/indeterminado)', ayuda: 'Datos laborales del contrato.' },
  CONTRATO_JORNADA: { etiqueta: 'Jornada de trabajo', ayuda: 'Datos laborales del contrato.' },
  CONTRATO_SALARIO_DIARIO_VES: { etiqueta: 'Salario básico diario (texto)', ayuda: 'Tabulador / contrato.' },
  CONTRATO_SALARIO_DIARIO_VES_NUM: { etiqueta: 'Salario diario (número)', ayuda: 'Tabulador / contrato.' },
  CONTRATO_FORMA_PAGO: { etiqueta: 'Forma de pago', ayuda: 'Datos del contrato.' },
  CONTRATO_LUGAR_PAGO_LINEA: { etiqueta: 'Lugar o detalle de pago', ayuda: 'Opcional en contrato.' },
  CONTRATO_FECHA_INGRESO: { etiqueta: 'Fecha de ingreso', ayuda: 'RRHH en expediente del contrato.' },
  CONTRATO_FECHA_EMISION: { etiqueta: 'Fecha de emisión del documento', ayuda: 'Se asigna al generar el PDF.' },
  CONTRATO_LUGAR_FIRMA: { etiqueta: 'Lugar de firma', ayuda: 'Por defecto ciudad de la obra o "Caracas".' },
  CONTRATO_NUMERO_OFICIO_TABULADOR: { etiqueta: 'Número de oficio tabulador', ayuda: 'Vacante / empleado cargo.' },
  CONTRATO_DENOMINACION_GACETA: { etiqueta: 'Denominación oficio Gaceta', ayuda: 'Vacante / contrato.' },
  OBRA_NOMBRE: { etiqueta: 'Nombre de la obra o proyecto', ayuda: 'Proyecto vinculado al contrato.' },
  OBRA_UBICACION: { etiqueta: 'Ubicación de la obra', ayuda: 'Datos del proyecto en ci_proyectos.' },
};

export function etiquetaPlaceholder(id: string): { etiqueta: string; ayuda: string } {
  return ETIQUETAS[id] ?? { etiqueta: id, ayuda: 'Complete el dato solicitado en su expediente o planilla.' };
}

/** Extrae claves únicas {{VAR}} del cuerpo. */
export function extraerPlaceholders(cuerpo: string): string[] {
  const re = /\{\{([A-Z0-9_]+)\}\}/g;
  const set = new Set<string>();
  let m: RegExpExecArray | null;
  const s = cuerpo ?? '';
  while ((m = re.exec(s)) !== null) {
    set.add(m[1]!);
  }
  return Array.from(set);
}

export type FuentesContratoObrero = {
  hojaVida: HojaVidaObreroCompleta | null;
  empleado: {
    nombre_completo: string | null;
    documento: string | null;
    cedula: string | null;
    direccion?: string | null;
    celular?: string | null;
    telefono?: string | null;
  };
  contrato: {
    cargo_oficio_desempeño?: string | null;
    lugar_prestacion_servicio?: string | null;
    objeto_contrato?: string | null;
    tipo_contrato?: string | null;
    jornada_trabajo?: string | null;
    salario_basico_diario_ves?: number | string | null;
    forma_pago?: string | null;
    lugar_pago?: string | null;
    fecha_ingreso?: string | null;
    numero_oficio_tabulador?: string | null;
    gaceta_denominacion_oficio?: string | null;
  };
  obra: { nombre: string; ubicacion?: string | null };
  /** Valores por defecto patrono (env o planilla). */
  patron: {
    nombre: string;
    domicilio: string;
    representante: string;
  };
};

function str(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return String(v).trim();
}

function fmtFecha(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-VE', { day: 'numeric', month: 'long', year: 'numeric' });
}

function tipoPlazoHuman(t?: string | null): string {
  const t0 = (t ?? '').trim().toLowerCase();
  if (t0.includes('indeterminado')) return 'indeterminado';
  if (t0.includes('determinado')) return 'determinado';
  if (t0) return t0.replace(/_/g, ' ');
  return '';
}

function jornadaHuman(j?: string | null): string {
  const j0 = (j ?? '').trim().toLowerCase();
  if (j0 === 'diurna' || j0 === 'nocturna' || j0 === 'mixta') return j0;
  if (j0) return j0.replace(/_/g, ' ');
  return '';
}

function formaPagoHuman(f?: string | null): string {
  const x = (f ?? '').trim();
  if (!x) return '';
  return x.replace(/_/g, ' ');
}

/**
 * Arma el mapa {{VAR}} → valor desde hoja de empleo, empleado, contrato y obra.
 */
export function construirMapaVariablesContratoObrero(f: FuentesContratoObrero): Record<string, string> {
  const hv = f.hojaVida;
  const dp = hv?.datosPersonales;
  const nombreDesdeHoja = [dp?.primerNombre, dp?.segundoNombre, dp?.primerApellido, dp?.segundoApellido]
    .map((x) => String(x ?? '').trim())
    .filter(Boolean)
    .join(' ')
    .trim();
  const nombreCompleto = nombreDesdeHoja || str(f.empleado.nombre_completo);

  const cedula = str(dp?.cedulaIdentidad) || str(f.empleado.cedula) || str(f.empleado.documento);
  const direccion = str(dp?.direccionDomicilio) || str(f.empleado.direccion);
  const celular = str(dp?.celular) || str(f.empleado.celular);
  const nacionalidad = str(dp?.nacionalidad);
  const estadoCivil = str(dp?.estadoCivil);
  const fechaNac = str(dp?.fechaNacimiento);
  const lugarNac = [str(dp?.lugarNacimiento), str(dp?.paisNacimiento)].filter(Boolean).join(', ');

  const sal = f.contrato.salario_basico_diario_ves;
  const salNum = typeof sal === 'number' ? sal : Number.parseFloat(String(sal ?? ''));
  const salTxt =
    Number.isFinite(salNum) && salNum > 0
      ? salNum.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
      : '';

  const lugarPago = str(f.contrato.lugar_pago);
  const lugarPagoLinea = lugarPago ? `, en ${lugarPago}` : '';

  const fechaIngreso = fmtFecha(f.contrato.fecha_ingreso);
  const fechaEmision = fmtFecha(new Date().toISOString().slice(0, 10));

  const lugarFirma =
    str(f.obra.ubicacion) || str(f.obra.nombre) || 'Caracas — República Bolivariana de Venezuela';

  return {
    PATRON_NOMBRE: str(f.patron.nombre),
    PATRON_DOMICILIO: str(f.patron.domicilio),
    PATRON_REPRESENTANTE: str(f.patron.representante),
    EMPLEADO_NOMBRE_COMPLETO: nombreCompleto,
    EMPLEADO_CEDULA: cedula,
    EMPLEADO_DIRECCION: direccion,
    EMPLEADO_NACIONALIDAD: nacionalidad,
    EMPLEADO_ESTADO_CIVIL: estadoCivil,
    EMPLEADO_FECHA_NACIMIENTO: fechaNac,
    EMPLEADO_LUGAR_NACIMIENTO: lugarNac,
    EMPLEADO_CELULAR: celular,
    CONTRATO_CARGO_OFICIO: str(f.contrato.cargo_oficio_desempeño) || str(hv?.contratacion?.cargoUOficio),
    CONTRATO_LUGAR_PRESTACION: str(f.contrato.lugar_prestacion_servicio) || str(f.obra.nombre),
    CONTRATO_OBJETO: str(f.contrato.objeto_contrato) ? ` ${str(f.contrato.objeto_contrato)}` : '',
    CONTRATO_TIPO_PLAZO: tipoPlazoHuman(f.contrato.tipo_contrato),
    CONTRATO_JORNADA: jornadaHuman(f.contrato.jornada_trabajo),
    CONTRATO_SALARIO_DIARIO_VES: salTxt,
    CONTRATO_SALARIO_DIARIO_VES_NUM: Number.isFinite(salNum) && salNum > 0 ? String(salNum) : '',
    CONTRATO_FORMA_PAGO: formaPagoHuman(f.contrato.forma_pago),
    CONTRATO_LUGAR_PAGO_LINEA: lugarPagoLinea,
    CONTRATO_FECHA_INGRESO: fechaIngreso,
    CONTRATO_FECHA_EMISION: fechaEmision,
    CONTRATO_LUGAR_FIRMA: lugarFirma,
    CONTRATO_NUMERO_OFICIO_TABULADOR: str(f.contrato.numero_oficio_tabulador),
    CONTRATO_DENOMINACION_GACETA: str(f.contrato.gaceta_denominacion_oficio),
    OBRA_NOMBRE: str(f.obra.nombre),
    OBRA_UBICACION: str(f.obra.ubicacion),
  };
}

const OVERRIDE_MAX_LEN = 8000;

/**
 * Fusiona valores manuales (RRHH) sobre el mapa de la plantilla.
 * Solo acepta claves que existan como `{{CLAVE}}` en el cuerpo y texto recortado no vacío.
 */
export function aplicarOverridesMapaContrato(
  cuerpo: string,
  mapa: Record<string, string>,
  overrides: Record<string, string> | null | undefined,
): Record<string, string> {
  const allowed = new Set(extraerPlaceholders(cuerpo));
  if (!overrides || typeof overrides !== 'object') return mapa;
  const out = { ...mapa };
  for (const [k, v] of Object.entries(overrides)) {
    if (!allowed.has(k)) continue;
    let t = String(v ?? '').trim();
    if (t.length > OVERRIDE_MAX_LEN) t = t.slice(0, OVERRIDE_MAX_LEN);
    if (t) out[k] = t;
  }
  return out;
}

export function compilarPlantillaContratoObrero(
  cuerpo: string,
  mapa: Record<string, string>,
): { texto: string; faltantes: DatoContratoFaltante[] } {
  const keys = extraerPlaceholders(cuerpo);
  const faltantes: DatoContratoFaltante[] = [];
  let texto = cuerpo;

  for (const k of keys) {
    const raw = mapa[k];
    const val = raw != null ? String(raw).trim() : '';
    if (!val) {
      const { etiqueta, ayuda } = etiquetaPlaceholder(k);
      faltantes.push({ id: k, etiqueta, ayuda });
      texto = texto.split(`{{${k}}}`).join(`[… COMPLETAR: ${etiqueta} …]`);
    } else {
      texto = texto.split(`{{${k}}}`).join(val);
    }
  }

  return { texto, faltantes };
}
