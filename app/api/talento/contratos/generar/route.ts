import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

function strOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  return t.length ? t : null;
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      empleadoId,
      fechaIngreso,
      tipoPlazo,
      jornadaTrabajo,
    } = (await req.json()) as {
      empleadoId?: string;
      fechaIngreso?: string;
      tipoPlazo?: string;
      jornadaTrabajo?: string;
    };

    if (!empleadoId?.trim()) {
      throw new Error('ID de empleado requerido');
    }

    const { data: workerRaw, error: workerError } = await supabase
      .from('ci_empleados')
      .select(`
        *,
        ci_proyectos (id, entidad_id, nombre, ubicacion, ubicacion_texto, obra_ubicacion),
        ci_entidades (nombre_legal, domicilio_fiscal, direccion_fiscal, representante_legal, rep_legal_nombre, datos_registro)
      `)
      .eq('id', empleadoId.trim())
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
      ci_entidades?: {
        nombre_legal?: string | null;
        domicilio_fiscal?: string | null;
        direccion_fiscal?: string | null;
        representante_legal?: string | null;
        rep_legal_nombre?: string | null;
        datos_registro?: string | null;
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
      .select('funciones_oficiales, salario_base_mensual')
      .ilike('cargo_nombre', worker.cargo_nombre ?? '')
      .single();

    const conf = (cargoConfig ?? null) as {
      funciones_oficiales?: string | null;
      salario_base_mensual?: number | null;
    } | null;

    let nombreEntidad = strOrNull(worker.ci_entidades?.nombre_legal) ?? 'LA ENTIDAD';
    let domicilioEntidad =
      strOrNull(worker.ci_entidades?.domicilio_fiscal) ??
      strOrNull(worker.ci_entidades?.direccion_fiscal);

    // Fallback: si la relación directa no trae entidad, resolver por la entidad vinculada al proyecto.
    const entidadIdProyecto = strOrNull(worker.ci_proyectos?.entidad_id);
    if (entidadIdProyecto && (!domicilioEntidad || nombreEntidad === 'LA ENTIDAD')) {
      const { data: entidadProyecto } = await supabase
        .from('ci_entidades')
        .select('nombre_legal,nombre,domicilio_fiscal,direccion_fiscal')
        .eq('id', entidadIdProyecto)
        .maybeSingle();

      const ep = (entidadProyecto ?? null) as
        | {
            nombre_legal?: string | null;
            nombre?: string | null;
            domicilio_fiscal?: string | null;
            direccion_fiscal?: string | null;
          }
        | null;

      if (ep) {
        nombreEntidad = strOrNull(ep.nombre_legal) ?? strOrNull(ep.nombre) ?? nombreEntidad;
        domicilioEntidad =
          strOrNull(ep.domicilio_fiscal) ??
          strOrNull(ep.direccion_fiscal) ??
          domicilioEntidad;
      }
    }

    const salarioBase = Number(conf?.salario_base_mensual ?? 0);
    const salarioDiario = (salarioBase / 30).toFixed(2);
    const funcionesTexto =
      (conf?.funciones_oficiales ?? worker.tareas_especificas ?? '').toString().trim() || 'Labores inherentes al cargo';

    nombreEntidad = nombreEntidad.toUpperCase();
    domicilioEntidad = domicilioEntidad ?? '[DOMICILIO FISCAL NO REGISTRADO]';
    const nacionalidad = worker.nacionalidad || 'venezolana';
    const domicilioTrabajador = worker.direccion_domicilio || worker.direccion_habitacion || 'Nueva Esparta';
    const cargoNombre = worker.cargo_nombre?.toUpperCase() || 'OBRERO';
    const nombreProyecto = worker.ci_proyectos?.nombre || 'OBRA NO REGISTRADA';
    const ubicacionProyecto =
      worker.ci_proyectos?.ubicacion || worker.ci_proyectos?.ubicacion_texto || worker.ci_proyectos?.obra_ubicacion || 'UBICACION NO REGISTRADA';
    const tipo = (tipoPlazo ?? '').toUpperCase() || 'DETERMINADO';
    const jornada = (jornadaTrabajo ?? '').toUpperCase() || 'DIURNA';
    const fecha = (fechaIngreso ?? '').trim() || 'POR DEFINIR';
    const nombreTrabajador = worker.nombres || worker.nombre_completo || 'TRABAJADOR NO REGISTRADO';
    const cedula = worker.cedula || worker.documento || 'NO REGISTRADA';

    const contratoMarkdown = `
# CONTRATO INDIVIDUAL DE TRABAJO

ENTRE **${nombreEntidad}**, domiciliada en **${domicilioEntidad}**, de aquí en adelante "**EL EMPLEADOR**", por una parte, y el(la) ciudadano(a) **${nombreTrabajador}**, de nacionalidad **${nacionalidad}**, mayor de edad, hábil en el ejercicio de sus derechos civiles, titular de la cédula de identidad N° **${cedula}**, domiciliado(a) en **${domicilioTrabajador}**, en adelante "**EL TRABAJADOR**", por la otra parte, han convenido celebrar el presente contrato individual de trabajo, sujeto a las siguientes cláusulas:

### PRIMERA: OBJETO
**EL TRABAJADOR** se obliga a prestar sus servicios personales en el cargo u oficio de **${cargoNombre}**, con las funciones inherentes al mismo, tales como: "${funcionesTexto}".

### SEGUNDA: TIPO Y PLAZO
El presente contrato se celebra por tiempo **${tipo}**.

### TERCERA: JORNADA DE TRABAJO
**EL TRABAJADOR** cumplirá una jornada **${jornada}**.

### CUARTA: REMUNERACION
**EL EMPLEADOR** pagara a **EL TRABAJADOR** un salario basico diario de **${salarioDiario} VES**, pagadero mediante transferencia bancaria y entregando recibo en Obra.

### QUINTA: FECHA DE INGRESO Y LUGAR DE TRABAJO
**EL TRABAJADOR** iniciara la prestacion de sus servicios a partir del **${fecha}**. Las labores se prestaran en el proyecto **${nombreProyecto}**, ubicado en: **${ubicacionProyecto}**.
`;

    return NextResponse.json({ success: true, contrato: contratoMarkdown.trim() });
  } catch (error) {
    console.error('Error generando contrato:', error);
    const message = error instanceof Error ? error.message : 'Error interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
