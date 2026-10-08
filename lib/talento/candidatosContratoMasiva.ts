/**
 * Contratación masiva desde enlaces (HV), no desde Excel.
 * El obrero ya trajo identidad; RRHH solo aplica datos del lote.
 */

import {
  hojaVidaDesdeRow,
  nombreCompletoDesde,
  type HojaVidaObreroCompleta,
} from '@/lib/talento/hojaVidaObreroCompleta';
import { empleadoTieneHojaVidaCargada } from '@/lib/rrhh/fetchEmpleadosHojasVida';
import { empleadoTieneEvaluacionCompleta } from '@/lib/rrhh/evaluacionObrero';
import { normCedulaToken } from '@/lib/talento/cedulaAuth';

export type NominaCargoOpt = {
  id: string;
  cargo_nombre: string;
  cargo_codigo?: string | null;
};

export type CandidatoContratoMasiva = {
  empleadoId: string;
  nombres: string;
  apellidos: string;
  nombreCompleto: string;
  cedula: string;
  direccion: string | null;
  estadoCivil: string | null;
  cargo: string | null;
  cargoCodigo: string | null;
  semaforo: string | null;
  statusEvaluacion: string | null;
  tieneHv: boolean;
  evaluacionLista: boolean;
  yaContratado: boolean;
  /** HV + cédula + nombre y aún no tiene contrato express en la obra. */
  listo: boolean;
};

export type DefaultsLoteContratoMasiva = {
  proyectoId: string;
  configNominaId?: string | null;
  fechaIngreso: string;
  jornada: string;
  horario?: string | null;
  bonoUsd?: number;
  estadoCivilDefault?: string | null;
};

export type PayloadContratoDesdeCandidato = {
  proyecto_id: string;
  config_nomina_id: string;
  obrero_nombres: string;
  obrero_apellidos: string;
  obrero_nombre: string;
  obrero_cedula: string;
  obrero_direccion: string;
  estado_civil: string;
  fecha_ingreso: string;
  jornada_trabajo: string;
  horario_semanal_texto: string | null;
  bono_manual_usd: number;
  formalizado_empleado_id: string;
};

export function normCargoTxt(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

export function codigoGoECorto(raw?: string | null): string {
  return String(raw ?? '')
    .trim()
    .replace(',', '.')
    .replace(/\s+/g, '');
}

export function resolverNominaIdPorCargo(
  nominas: NominaCargoOpt[],
  opts: { cargoCodigo?: string | null; cargoNombre?: string | null; defaultId?: string | null },
): string | null {
  const cod = codigoGoECorto(opts.cargoCodigo);
  if (cod) {
    const byCod = nominas.find((n) => codigoGoECorto(n.cargo_codigo) === cod);
    if (byCod) return byCod.id;
  }
  const target = normCargoTxt(opts.cargoNombre ?? '');
  if (target) {
    const exact = nominas.find((n) => normCargoTxt(n.cargo_nombre) === target);
    if (exact) return exact.id;
    const partial = nominas.find((n) => {
      const nrm = normCargoTxt(n.cargo_nombre);
      return nrm.includes(target) || target.includes(nrm);
    });
    if (partial) return partial.id;
  }
  return (opts.defaultId ?? '').trim() || null;
}

function str(v: unknown): string {
  return v == null ? '' : String(v).trim();
}

function partirNombre(full: string): { nombres: string; apellidos: string } {
  const parts = full.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { nombres: parts[0] ?? '', apellidos: '' };
  if (parts.length === 2) return { nombres: parts[0]!, apellidos: parts[1]! };
  const mid = Math.ceil(parts.length / 2);
  return {
    nombres: parts.slice(0, mid).join(' '),
    apellidos: parts.slice(mid).join(' '),
  };
}

export function nombresDesdeHojaOFila(
  row: Record<string, unknown>,
  hv: HojaVidaObreroCompleta,
): { nombres: string; apellidos: string; nombreCompleto: string } {
  const dp = hv.datosPersonales;
  const nombresHv = [dp.primerNombre, dp.segundoNombre].map((s) => s.trim()).filter(Boolean).join(' ');
  const apellidosHv = [dp.primerApellido, dp.segundoApellido].map((s) => s.trim()).filter(Boolean).join(' ');
  if (nombresHv && apellidosHv) {
    return { nombres: nombresHv, apellidos: apellidosHv, nombreCompleto: `${nombresHv} ${apellidosHv}`.trim() };
  }

  const nombresCol = [str(row.primer_nombre), str(row.segundo_nombre), str(row.nombres)]
    .filter(Boolean)
    .join(' ');
  const apellidosCol = [str(row.primer_apellido), str(row.segundo_apellido)].filter(Boolean).join(' ');
  if (nombresCol && apellidosCol) {
    return { nombres: nombresCol, apellidos: apellidosCol, nombreCompleto: `${nombresCol} ${apellidosCol}`.trim() };
  }

  const full = nombreCompletoDesde(hv) || str(row.nombre_completo);
  const parted = partirNombre(full);
  return { ...parted, nombreCompleto: full };
}

export function candidatoDesdeEmpleadoRow(
  row: Record<string, unknown>,
  opts: { yaContratado: boolean },
): CandidatoContratoMasiva {
  const hv = hojaVidaDesdeRow(row);
  const { nombres, apellidos, nombreCompleto } = nombresDesdeHojaOFila(row, hv);
  const cedula = normCedulaToken(
    hv.datosPersonales.cedulaIdentidad || str(row.cedula) || str(row.documento),
  );
  const direccion =
    hv.datosPersonales.direccionDomicilio.trim() ||
    str(row.domicilio_declarado) ||
    str(row.direccion_domicilio) ||
    str(row.direccion_habitacion) ||
    null;
  const estadoCivil =
    hv.datosPersonales.estadoCivil.trim() || str(row.estado_civil) || null;
  const cargo =
    hv.contratacion.cargoUOficio.trim() || str(row.cargo_nombre) || str(row.rol_buscado) || null;
  const cargoCodigo = str(row.cargo_codigo) || null;
  const tieneHv = empleadoTieneHojaVidaCargada({
    hoja_vida_obrero: row.hoja_vida_obrero,
    estado_proceso: str(row.estado_proceso) || null,
  });
  const evaluacionLista = empleadoTieneEvaluacionCompleta({
    examen_completado_at: str(row.examen_completado_at) || null,
    puntaje_total: typeof row.puntaje_total === 'number' ? row.puntaje_total : null,
    status_evaluacion: str(row.status_evaluacion) || null,
    semaforo: str(row.semaforo) || null,
  });
  const listo =
    tieneHv && Boolean(cedula) && nombreCompleto.length >= 2 && !opts.yaContratado;

  return {
    empleadoId: str(row.id),
    nombres,
    apellidos,
    nombreCompleto,
    cedula,
    direccion,
    estadoCivil,
    cargo,
    cargoCodigo,
    semaforo: str(row.semaforo) || null,
    statusEvaluacion: str(row.status_evaluacion) || null,
    tieneHv,
    evaluacionLista,
    yaContratado: opts.yaContratado,
    listo,
  };
}

export function payloadContratoDesdeCandidato(
  c: CandidatoContratoMasiva,
  defaults: DefaultsLoteContratoMasiva,
  nominas: NominaCargoOpt[],
): { ok: true; payload: PayloadContratoDesdeCandidato } | { ok: false; error: string } {
  if (!c.listo) {
    if (c.yaContratado) return { ok: false, error: 'Ya tiene contrato en esta obra' };
    if (!c.tieneHv) return { ok: false, error: 'Sin hoja de vida' };
    return { ok: false, error: 'Faltan nombre o cédula' };
  }
  const nomina = resolverNominaIdPorCargo(nominas, {
    cargoCodigo: c.cargoCodigo,
    cargoNombre: c.cargo,
    defaultId: defaults.configNominaId,
  });
  if (!nomina) {
    return {
      ok: false,
      error: c.cargo
        ? `Cargo «${c.cargo}» no está en el tabulador; elija un cargo por defecto`
        : 'Seleccione un cargo por defecto del tabulador',
    };
  }
  return {
    ok: true,
    payload: {
      proyecto_id: defaults.proyectoId,
      config_nomina_id: nomina,
      obrero_nombres: c.nombres || c.nombreCompleto,
      obrero_apellidos: c.apellidos || '—',
      obrero_nombre: c.nombreCompleto,
      obrero_cedula: c.cedula,
      obrero_direccion: (c.direccion ?? '').trim() || 'de este domicilio',
      estado_civil: (c.estadoCivil ?? '').trim() || (defaults.estadoCivilDefault ?? '').trim() || 'Soltero',
      fecha_ingreso: defaults.fechaIngreso,
      jornada_trabajo: defaults.jornada,
      horario_semanal_texto: defaults.horario?.trim() || null,
      bono_manual_usd: defaults.bonoUsd ?? 0,
      formalizado_empleado_id: c.empleadoId,
    },
  };
}
