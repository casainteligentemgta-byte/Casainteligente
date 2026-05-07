import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import {
  denominacionOficioGaceta,
  objetoContratoDesdeOficio,
  salarioBasicoDiarioVesDesdeNivel,
} from '@/lib/talento/contratoGacetaLaboral';
import { domicilioPatronoParaEntidad } from '@/lib/talento/patronoDomicilioReglas';
import { emptyHojaVidaObreroCompleta } from '@/lib/talento/hojaVidaObreroCompleta';
import {
  fusionarEmpleadoContratoDesdePlanilla,
  parseHojaVidaObrero,
  patronEmpresaDomicilioDesdeHojaJson,
} from '@/lib/talento/empleadoContratoDesdeHojaPlanilla';
import { resolvePlanillaPatronoParaEmpleado } from '@/lib/talento/resolvePlanillaPatronoPdf';

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

/** Primer representante en `registro_mercantil.representantes[]` (jsonb). */
function primerRepresentanteRegistroMercantil(raw: unknown): {
  nombre?: string;
  cedula?: string;
  cargo?: string;
  profesion?: string;
} {
  try {
    let o: unknown = raw;
    if (typeof raw === 'string') {
      try {
        o = JSON.parse(raw) as unknown;
      } catch {
        return {};
      }
    }
    if (!o || typeof o !== 'object' || Array.isArray(o)) return {};
    const arr = (o as { representantes?: unknown }).representantes;
    if (!Array.isArray(arr) || !arr[0] || typeof arr[0] !== 'object' || Array.isArray(arr[0])) return {};
    const r = arr[0] as Record<string, unknown>;
    return {
      nombre: typeof r.nombre === 'string' ? r.nombre : undefined,
      cedula: typeof r.cedula === 'string' ? r.cedula : undefined,
      cargo: typeof r.cargo === 'string' ? r.cargo : undefined,
      profesion: typeof r.profesion === 'string' ? r.profesion : undefined,
    };
  } catch {
    return {};
  }
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
      duracion_valor,
      duracion_unidad,
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
      duracion_valor?: number;
      duracion_unidad?: 'dias' | 'meses';
    };

    const empleadoIdFinal = strOrNull(empleadoId) ?? strOrNull(empleado_id);
    if (!empleadoIdFinal) {
      throw new Error('ID de empleado requerido');
    }

    const { data: workerRaw, error: workerError } = await supabase
      .from('ci_empleados')
      .select(`
        *,
        ci_proyectos (
          id,
          entidad_id,
          nombre,
          ubicacion,
          ubicacion_texto,
          obra_ubicacion,
          ci_entidades (
            nombre_legal,
            nombre,
            domicilio_fiscal,
            direccion_fiscal,
            representante_legal,
            rep_legal_nombre,
            rep_legal_cedula,
            rep_legal_cargo,
            registro_mercantil
          )
        )
      `)
      .eq('id', empleadoIdFinal)
      .maybeSingle();

    type EntidadPatronoRow = {
      nombre_legal?: string | null;
      nombre?: string | null;
      domicilio_fiscal?: string | null;
      direccion_fiscal?: string | null;
      representante_legal?: string | null;
      rep_legal_nombre?: string | null;
      rep_legal_cedula?: string | null;
      rep_legal_cargo?: string | null;
      registro_mercantil?: unknown;
    };

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
      ci_proyectos?: {
        id?: string | null;
        entidad_id?: string | null;
        nombre?: string | null;
        ubicacion?: string | null;
        ubicacion_texto?: string | null;
        obra_ubicacion?: string | null;
        ci_entidades?: EntidadPatronoRow | EntidadPatronoRow[] | null;
      } | null;
    } | null;

    if (workerError) {
      throw new Error(workerError.message || 'Error al consultar el empleado');
    }
    if (!worker) {
      throw new Error('Empleado no encontrado');
    }

    const entidadDesdeProyecto = (() => {
      const nested = worker.ci_proyectos?.ci_entidades;
      if (!nested) return null;
      return Array.isArray(nested) ? (nested[0] ?? null) : nested;
    })();

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

    const entDir = entidadDesdeProyecto;
    let entPatrono: EntidadPatronoRow | null = entDir ?? null;
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
        .select(
          'nombre_legal,nombre,domicilio_fiscal,direccion_fiscal,registro_mercantil,representante_legal,rep_legal_nombre,rep_legal_cedula,rep_legal_cargo',
        )
        .eq('id', entidadIdProyecto)
        .maybeSingle();

      const ep = (entidadProyecto ?? null) as
        | {
            nombre_legal?: string | null;
            nombre?: string | null;
            domicilio_fiscal?: string | null;
            direccion_fiscal?: string | null;
            registro_mercantil?: unknown;
            representante_legal?: string | null;
            rep_legal_nombre?: string | null;
            rep_legal_cedula?: string | null;
            rep_legal_cargo?: string | null;
          }
        | null;

      if (ep) {
        nombreEntidad = strOrNull(ep.nombre_legal) ?? strOrNull(ep.nombre) ?? nombreEntidad;
        domicilioEntidad =
          domicilioPatronoParaEntidad(ep) ?? domicilioEntidad;
        if (!entPatrono) {
          entPatrono = ep;
        }
      }
    }

    const salarioBase = Number(conf?.salario_base_mensual ?? 0);
    const salarioDiarioNum = salarioBase > 0 ? salarioBase / 30 : Number(salarioBasicoDiarioVesDesdeNivel(worker.cargo_nivel) ?? 0);
    const salarioDiario = soloDosDecimales(salarioDiarioNum);
    const salarioDiarioLetras = montoVesEnLetras(salarioDiarioNum);

    const domDesdeHoja = patronEmpresaDomicilioDesdeHojaJson(worker.hoja_vida_obrero);
    const planillaPatronoGen = await resolvePlanillaPatronoParaEmpleado(
      supabase,
      worker as unknown as Record<string, unknown>,
      { proyectoModuloIdAlternativo: strOrNull(worker.ci_proyectos?.id ?? undefined) },
    );
    const domPlanilla = String(planillaPatronoGen.empresaDomicilio ?? '').trim() || null;
    domicilioEntidad = domDesdeHoja ?? domPlanilla ?? domicilioEntidad ?? '[DOMICILIO FISCAL NO REGISTRADO]';

    nombreEntidad = nombreEntidad.toUpperCase();

    const hvPlanilla = parseHojaVidaObrero(worker.hoja_vida_obrero) ?? emptyHojaVidaObreroCompleta();
    const empPlanilla = fusionarEmpleadoContratoDesdePlanilla(worker, hvPlanilla);

    const nacionalidad = empPlanilla.nacionalidad ?? strOrNull(worker.nacionalidad) ?? 'venezolana';
    const domicilioTrabajador =
      empPlanilla.direccion ??
      strOrNull(worker.direccion_domicilio) ??
      strOrNull(worker.direccion_habitacion) ??
      'Nueva Esparta';
    const cargoMayus = worker.cargo_nombre?.toUpperCase() || 'TRABAJADOR';
    const funcionesManual =
      strOrNull(conf?.funciones_oficiales) ??
      'las tareas inherentes a su cargo y aquellas asignadas por su supervisor inmediato';
    const nombreProyecto = worker.ci_proyectos?.nombre || 'OBRA NO REGISTRADA';
    const ubicacionProyecto =
      worker.ci_proyectos?.ubicacion || worker.ci_proyectos?.ubicacion_texto || worker.ci_proyectos?.obra_ubicacion || 'UBICACION NO REGISTRADA';
    const tipoRaw = strOrNull(tipoPlazo ?? tipo_contrato) ?? 'DETERMINADO';
    const tipoNorm = tipoRaw.trim().toLowerCase();
    const esIndeterminado = tipoNorm.includes('indetermin');
    const tipo = toUpperSafe(tipoPlazo ?? tipo_contrato, 'DETERMINADO');
    const jornada = toUpperSafe(jornadaTrabajo ?? jornada_trabajo, 'DIURNA');
    const dv = Number(duracion_valor);
    const du = (duracion_unidad ?? '').trim().toLowerCase();
    const duracionTexto =
      !esIndeterminado &&
      Number.isFinite(dv) &&
      dv > 0 &&
      (du === 'dias' || du === 'meses')
        ? ` La duración pactada es de **${Math.floor(dv)}** ${du === 'meses' ? 'mes(es) calendario' : 'día(s) calendario'}.`
        : '';
    const fecha = strOrNull(fechaIngreso ?? fecha_ingreso) ?? 'POR DEFINIR';
    const nombreTrabajador = empPlanilla.nombre_completo ?? worker.nombres ?? worker.nombre_completo ?? 'TRABAJADOR NO REGISTRADO';
    const cedula = empPlanilla.cedula ?? empPlanilla.documento ?? worker.cedula ?? worker.documento ?? 'NO REGISTRADA';
    const codigoTabulador = strOrNull(conf?.cargo_codigo) ?? strOrNull(worker.cargo_codigo) ?? 'NO DEFINIDO';
    const denominacionGaceta = denominacionOficioGaceta(strOrNull(worker.cargo_codigo) ?? strOrNull(conf?.cargo_codigo)) ?? cargoMayus;
    const objetoContrato = objetoContratoDesdeOficio({
      denominacionTrabajo: denominacionGaceta,
      codigoTabulador: codigoTabulador === 'NO DEFINIDO' ? null : codigoTabulador,
    });

    const rmRep = primerRepresentanteRegistroMercantil(entPatrono?.registro_mercantil);
    const cargoRep =
      strOrNull(entPatrono?.rep_legal_cargo) ?? strOrNull(rmRep.cargo) ?? 'Administrador';
    const nombreRep =
      strOrNull(entPatrono?.rep_legal_nombre) ??
      strOrNull(entPatrono?.representante_legal) ??
      strOrNull(rmRep.nombre) ??
      '[REPRESENTANTE NO REGISTRADO]';
    const cedulaRep =
      strOrNull(entPatrono?.rep_legal_cedula) ?? strOrNull(rmRep.cedula) ?? '[CÉDULA NO REGISTRADA]';
    const profesionRep = strOrNull(rmRep.profesion) ?? 'Empresario';
    const nombreTrabajadorUpper = toUpperSafe(worker.nombres ?? worker.nombre_completo, 'EL TRABAJADOR');

    const encabezadoLegal = `Entre la empresa **${nombreEntidad}**, representada en este acto por su **${cargoRep}**, **${nombreRep}**, venezolano, mayor de edad, de profesión **${profesionRep}**, titular de la cédula de identidad Nº **${cedulaRep}**, domiciliado en **${domicilioEntidad}**; quien en lo adelante y a efectos del presente contrato se denominará "**EL EMPLEADOR**" por una parte y por la otra, el Ciudadano **${nombreTrabajadorUpper}**, de nacionalidad **${nacionalidad}**, mayor de edad, hábil en el ejercicio de sus derechos civiles, domiciliado en **${domicilioTrabajador}** y titular de la cédula de identidad N° **${cedula}**, en adelante "**EL TRABAJADOR**", se ha convenido en celebrar el **CONTRATO DE TRABAJO POR TIEMPO ${tipo}**, que se regirá por las siguientes cláusulas:`;

    const clausulaObjeto = `### PRIMERA: OBJETO
**EL TRABAJADOR** se obliga a prestar sus servicios personales en el cargo u oficio de **${cargoMayus}**, con las funciones inherentes al mismo, ejecutando específicamente: **${funcionesManual}**, de conformidad con el Manual de Cargos de la empresa y las instrucciones impartidas por **EL EMPLEADOR**.`;

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

${encabezadoLegal}

${clausulaObjeto}

### SEGUNDA: TIPO Y PLAZO
El presente contrato se celebra por tiempo **${tipo}**.${duracionTexto}

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
