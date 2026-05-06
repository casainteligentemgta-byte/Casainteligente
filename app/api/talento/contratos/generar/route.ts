import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import {
  denominacionOficioGaceta,
  objetoContratoDesdeOficio,
  salarioBasicoDiarioVesDesdeNivel,
} from '@/lib/talento/contratoGacetaLaboral';
import { domicilioPatronoParaEntidad } from '@/lib/talento/patronoDomicilioReglas';

function strOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  return t.length ? t : null;
}

function toUpperSafe(value: string | null | undefined, fallback: string): string {
  return strOrNull(value)?.toUpperCase() ?? fallback;
}

function soloDosDecimales(n: number): string {
  return Number.isFinite(n) ? n.toFixed(2) : '0.00';
}

function numeroALetrasHastaMiles(valor: number): string {
  const n = Math.floor(Math.abs(valor));
  const unidades = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
  const especiales = ['diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciseis', 'diecisiete', 'dieciocho', 'diecinueve'];
  const decenas = ['', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
  const centenas = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

  function hasta99(x: number): string {
    if (x < 10) return unidades[x] ?? 'cero';
    if (x < 20) return especiales[x - 10] ?? 'cero';
    if (x < 30) return x === 20 ? 'veinte' : `veinti${unidades[x - 20] ?? ''}`;
    const d = Math.floor(x / 10);
    const u = x % 10;
    return u === 0 ? decenas[d] ?? '' : `${decenas[d] ?? ''} y ${unidades[u] ?? ''}`;
  }

  function hasta999(x: number): string {
    if (x === 0) return 'cero';
    if (x === 100) return 'cien';
    if (x < 100) return hasta99(x);
    const c = Math.floor(x / 100);
    const r = x % 100;
    return r === 0 ? (centenas[c] ?? '') : `${centenas[c] ?? ''} ${hasta99(r)}`;
  }

  if (n < 1000) return hasta999(n);
  if (n < 1000000) {
    const miles = Math.floor(n / 1000);
    const resto = n % 1000;
    const pref = miles === 1 ? 'mil' : `${hasta999(miles)} mil`;
    return resto === 0 ? pref : `${pref} ${hasta999(resto)}`;
  }
  return String(n);
}

function montoVesEnLetras(valor: number): string {
  const abs = Math.abs(Number.isFinite(valor) ? valor : 0);
  const enteros = Math.floor(abs);
  const dec = Math.round((abs - enteros) * 100);
  const enterosTxt = numeroALetrasHastaMiles(enteros);
  const decTxt = String(dec).padStart(2, '0');
  return `${enterosTxt} con ${decTxt}/100`;
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      empleadoId,
      empleado_id,
      fechaIngreso,
      fecha_ingreso,
      tipoPlazo,
      tipo_contrato,
      jornadaTrabajo,
      jornada_trabajo,
      forma_pago,
      lugar_pago,
      cuenta_bancaria,
      banco,
    } = (await req.json()) as {
      empleadoId?: string;
      empleado_id?: string;
      fechaIngreso?: string;
      fecha_ingreso?: string;
      tipoPlazo?: string;
      tipo_contrato?: string;
      jornadaTrabajo?: string;
      jornada_trabajo?: string;
      forma_pago?: string;
      lugar_pago?: string;
      cuenta_bancaria?: string;
      banco?: string;
    };

    const empleadoIdFinal = strOrNull(empleadoId) ?? strOrNull(empleado_id);
    if (!empleadoIdFinal) {
      throw new Error('ID de empleado requerido');
    }

    const { data: workerRaw, error: workerError } = await supabase
      .from('ci_empleados')
      .select(`
        *,
        ci_proyectos (id, entidad_id, nombre, ubicacion, ubicacion_texto, obra_ubicacion),
        ci_entidades (nombre_legal, nombre, domicilio_fiscal, direccion_fiscal, representante_legal, rep_legal_nombre, registro_mercantil)
      `)
      .eq('id', empleadoIdFinal)
      .single();

    const worker = workerRaw as {
      nombres?: string | null;
      nombre_completo?: string | null;
      nacionalidad?: string | null;
      cedula?: string | null;
      documento?: string | null;
      direccion_domicilio?: string | null;
      direccion_habitacion?: string | null;
      tareas_especificas?: string | null;
      cargo_nombre?: string | null;
      cargo_codigo?: string | null;
      cargo_nivel?: number | null;
      hoja_vida_obrero?: unknown;
      ci_entidades?: {
        nombre_legal?: string | null;
        nombre?: string | null;
        domicilio_fiscal?: string | null;
        direccion_fiscal?: string | null;
        representante_legal?: string | null;
        rep_legal_nombre?: string | null;
        registro_mercantil?: unknown;
      } | null;
      ci_proyectos?: {
        id?: string | null;
        entidad_id?: string | null;
        nombre?: string | null;
        ubicacion?: string | null;
        ubicacion_texto?: string | null;
        obra_ubicacion?: string | null;
      } | null;
    } | null;

    if (workerError || !worker) {
      throw new Error('Error buscando empleado o relaciones incompletas');
    }

    const { data: cargoConfig } = await supabase
      .from('ci_config_nomina')
      .select('funciones_oficiales, salario_base_mensual, cargo_codigo')
      .ilike('cargo_nombre', worker.cargo_nombre ?? '')
      .maybeSingle();

    const conf = (cargoConfig ?? null) as {
      funciones_oficiales?: string | null;
      salario_base_mensual?: number | null;
      cargo_codigo?: string | null;
    } | null;

    const entDir = worker.ci_entidades;
    let nombreEntidad =
      strOrNull(entDir?.nombre_legal) ?? strOrNull(entDir?.nombre) ?? 'LA ENTIDAD';
    let domicilioEntidad = entDir
      ? domicilioPatronoParaEntidad({
          nombre_legal: entDir.nombre_legal,
          nombre: entDir.nombre,
          domicilio_fiscal: entDir.domicilio_fiscal,
          direccion_fiscal: entDir.direccion_fiscal,
          registro_mercantil: entDir.registro_mercantil,
        })
      : null;

    // Fallback: si la relación directa no trae entidad, resolver por la entidad vinculada al proyecto.
    const entidadIdProyecto = strOrNull(worker.ci_proyectos?.entidad_id);
    if (entidadIdProyecto && (!domicilioEntidad || nombreEntidad === 'LA ENTIDAD')) {
      const { data: entidadProyecto } = await supabase
        .from('ci_entidades')
        .select('nombre_legal,nombre,domicilio_fiscal,direccion_fiscal,registro_mercantil')
        .eq('id', entidadIdProyecto)
        .maybeSingle();

      const ep = (entidadProyecto ?? null) as
        | {
            nombre_legal?: string | null;
            nombre?: string | null;
            domicilio_fiscal?: string | null;
            direccion_fiscal?: string | null;
            registro_mercantil?: unknown;
          }
        | null;

      if (ep) {
        nombreEntidad = strOrNull(ep.nombre_legal) ?? strOrNull(ep.nombre) ?? nombreEntidad;
        domicilioEntidad =
          domicilioPatronoParaEntidad(ep) ?? domicilioEntidad;
      }
    }

    const salarioBase = Number(conf?.salario_base_mensual ?? 0);
    const salarioDiarioNum = salarioBase > 0 ? salarioBase / 30 : Number(salarioBasicoDiarioVesDesdeNivel(worker.cargo_nivel) ?? 0);
    const salarioDiario = soloDosDecimales(salarioDiarioNum);
    const salarioDiarioLetras = montoVesEnLetras(salarioDiarioNum);
    const funcionesTexto =
      (conf?.funciones_oficiales ?? worker.tareas_especificas ?? '').toString().trim() || 'Labores inherentes al cargo';

    nombreEntidad = nombreEntidad.toUpperCase();
    domicilioEntidad = domicilioEntidad ?? '[DOMICILIO FISCAL NO REGISTRADO]';
    const nacionalidad = strOrNull(worker.nacionalidad) ?? 'venezolana';
    const domicilioTrabajador = strOrNull(worker.direccion_domicilio) ?? strOrNull(worker.direccion_habitacion) ?? 'Nueva Esparta';
    const cargoNombre = worker.cargo_nombre?.toUpperCase() || 'OBRERO';
    const nombreProyecto = worker.ci_proyectos?.nombre || 'OBRA NO REGISTRADA';
    const ubicacionProyecto =
      worker.ci_proyectos?.ubicacion || worker.ci_proyectos?.ubicacion_texto || worker.ci_proyectos?.obra_ubicacion || 'UBICACION NO REGISTRADA';
    const tipo = toUpperSafe(tipoPlazo ?? tipo_contrato, 'DETERMINADO');
    const jornada = toUpperSafe(jornadaTrabajo ?? jornada_trabajo, 'DIURNA');
    const fecha = strOrNull(fechaIngreso ?? fecha_ingreso) ?? 'POR DEFINIR';
    const nombreTrabajador = worker.nombres || worker.nombre_completo || 'TRABAJADOR NO REGISTRADO';
    const cedula = worker.cedula || worker.documento || 'NO REGISTRADA';
    const codigoTabulador = strOrNull(conf?.cargo_codigo) ?? strOrNull(worker.cargo_codigo) ?? 'NO DEFINIDO';
    const denominacionGaceta = denominacionOficioGaceta(strOrNull(worker.cargo_codigo) ?? strOrNull(conf?.cargo_codigo)) ?? cargoNombre;
    const objetoContrato = objetoContratoDesdeOficio({
      denominacionTrabajo: denominacionGaceta,
      codigoTabulador: codigoTabulador === 'NO DEFINIDO' ? null : codigoTabulador,
    });

    const hv = (worker.hoja_vida_obrero ?? null) as Record<string, unknown> | null;
    const pagoBanco = strOrNull(banco) ?? strOrNull((hv?.['banco'] as string | undefined) ?? '');
    const pagoCuenta = strOrNull(cuenta_bancaria) ?? strOrNull((hv?.['cuenta_bancaria'] as string | undefined) ?? '');
    const formaPago = toUpperSafe(forma_pago ?? 'transferencia', 'TRANSFERENCIA');
    const detallePago = pagoBanco || pagoCuenta
      ? `${pagoBanco ? `Banco: ${pagoBanco}` : ''}${pagoBanco && pagoCuenta ? ' · ' : ''}${pagoCuenta ? `Cuenta: ${pagoCuenta}` : ''}`
      : 'Datos bancarios del trabajador por completar';
    const lugarPago = strOrNull(lugar_pago) ?? ubicacionProyecto;

    const contratoMarkdown = `
# CONTRATO INDIVIDUAL DE TRABAJO

ENTRE **${nombreEntidad}**, domiciliada en **${domicilioEntidad}**, de aquí en adelante "**EL EMPLEADOR**", por una parte, y el(la) ciudadano(a) **${nombreTrabajador}**, de nacionalidad **${nacionalidad}**, mayor de edad, hábil en el ejercicio de sus derechos civiles, titular de la cédula de identidad N° **${cedula}**, domiciliado(a) en **${domicilioTrabajador}**, en adelante "**EL TRABAJADOR**", por la otra parte, han convenido celebrar el presente contrato individual de trabajo, sujeto a las siguientes cláusulas:

### PRIMERA: OBJETO
**EL TRABAJADOR** se obliga a prestar sus servicios personales en el cargo u oficio de **${cargoNombre}**, con las funciones inherentes al mismo, tales como: "${funcionesTexto}".

### SEGUNDA: TIPO Y PLAZO
El presente contrato se celebra por tiempo **${tipo}**.

### TERCERA: JORNADA DE TRABAJO
**EL TRABAJADOR** cumplirá una jornada **${jornada}**.

### CUARTA: TABULADOR Y DENOMINACION DEL OFICIO (GACETA)
Cargo en tabulador: **${codigoTabulador}**. Denominacion oficial segun Gaceta: **${denominacionGaceta}**.

### QUINTA: OBJETO DEL CONTRATO
${objetoContrato}

### SEXTA: REMUNERACION
**EL EMPLEADOR** pagara a **EL TRABAJADOR** un salario basico diario de **${salarioDiario} VES** (**${salarioDiarioLetras} bolivares**).

### SEPTIMA: FORMA Y LUGAR DE PAGO
Forma de pago: **${formaPago}**. Detalle: **${detallePago}**.
Lugar del pago: **${lugarPago}**.

### OCTAVA: FECHA DE INGRESO Y LUGAR DE TRABAJO
**EL TRABAJADOR** iniciara la prestacion de sus servicios a partir del **${fecha}**. Las labores se prestaran en el proyecto **${nombreProyecto}**, ubicado en: **${ubicacionProyecto}**.
`;

    return NextResponse.json({ success: true, contrato: contratoMarkdown.trim() });
  } catch (error) {
    console.error('Error generando contrato:', error);
    const message = error instanceof Error ? error.message : 'Error interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
