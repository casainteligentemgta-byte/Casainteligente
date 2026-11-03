import type {
  JornalAsistenciaDia,
  JornalColaboradorFila,
  JornalesKpis,
  JornalesSemanaPayload,
} from '@/types/jornales';
import { fechasDeSemana } from '@/lib/proyectos/jornales/semanaJornales';

export function round2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

export function costoSemanalJornal(diasAsistidos: number, jornalDiarioUsd: number): number {
  const dias = Number.isFinite(diasAsistidos) ? Math.max(0, diasAsistidos) : 0;
  const jornal = Number.isFinite(jornalDiarioUsd) ? Math.max(0, jornalDiarioUsd) : 0;
  return round2(dias * jornal);
}

export type AsistenciaRaw = {
  empleado_id: string;
  fecha: string;
  costo_jornal: number;
};

export type ColaboradorRoster = {
  empleado_id: string;
  nombre_completo: string;
  cargo_nombre: string | null;
  jornal_diario_usd: number;
};

export function armarFilaColaborador(
  colab: ColaboradorRoster,
  diasSemana: string[],
  asistencias: AsistenciaRaw[],
): JornalColaboradorFila {
  const porFecha = new Map<string, AsistenciaRaw>();
  for (const a of asistencias) {
    if (a.empleado_id !== colab.empleado_id) continue;
    porFecha.set(a.fecha.slice(0, 10), a);
  }

  const celdas: JornalAsistenciaDia[] = diasSemana.map((fecha) => {
    const hit = porFecha.get(fecha);
    return {
      fecha,
      presente: Boolean(hit),
      costo_jornal: hit ? round2(Number(hit.costo_jornal) || 0) : null,
    };
  });

  const diasAsistidos = celdas.filter((c) => c.presente).length;
  const jornal = round2(Math.max(0, Number(colab.jornal_diario_usd) || 0));
  const costoSemanal = celdas.reduce((s, c) => {
    if (!c.presente) return s;
    const costo = c.costo_jornal != null && c.costo_jornal > 0 ? c.costo_jornal : jornal;
    return s + costo;
  }, 0);

  return {
    empleado_id: colab.empleado_id,
    nombre_completo: colab.nombre_completo,
    cargo_nombre: colab.cargo_nombre,
    jornal_diario_usd: jornal,
    asistencias: celdas,
    dias_asistidos: diasAsistidos,
    costo_semanal_usd: round2(costoSemanal),
  };
}

export function kpisJornales(args: {
  filas: JornalColaboradorFila[];
  costoAcumuladoProyectoUsd: number;
}): JornalesKpis {
  const trabajadoresActivos = args.filas.filter((f) => f.dias_asistidos > 0).length;
  const costoSemana = round2(args.filas.reduce((s, f) => s + f.costo_semanal_usd, 0));
  const totalDias = args.filas.reduce((s, f) => s + f.dias_asistidos, 0);
  const promedio = totalDias > 0 ? round2(costoSemana / totalDias) : 0;
  return {
    trabajadores_activos: trabajadoresActivos,
    costo_mano_obra_acumulado_usd: round2(Math.max(0, args.costoAcumuladoProyectoUsd)),
    costo_semana_usd: costoSemana,
    promedio_por_jornal_usd: promedio,
  };
}

export function construirPayloadJornalesSemana(args: {
  proyectoId: string;
  proyectoNombre: string;
  semanaInicio: string;
  roster: ColaboradorRoster[];
  asistenciasSemana: AsistenciaRaw[];
  costoAcumuladoProyectoUsd: number;
}): JornalesSemanaPayload {
  const dias = fechasDeSemana(args.semanaInicio);
  const semanaInicio = dias[0];
  const semanaFin = dias[6];
  const colaboradores = args.roster.map((c) =>
    armarFilaColaborador(c, dias, args.asistenciasSemana),
  );
  return {
    proyecto_id: args.proyectoId,
    proyecto_nombre: args.proyectoNombre,
    semana_inicio: semanaInicio,
    semana_fin: semanaFin,
    dias,
    colaboradores,
    kpis: kpisJornales({
      filas: colaboradores,
      costoAcumuladoProyectoUsd: args.costoAcumuladoProyectoUsd,
    }),
  };
}

export function esMigracionJornalesPendiente(message: string | undefined): boolean {
  const m = (message ?? '').toLowerCase();
  if (!m) return false;
  return (
    (m.includes('ci_jornales_obra_asistencias') ||
      m.includes('ci_jornales_obra_tarifas') ||
      m.includes('ci_proyecto_desviacion_config')) &&
    (m.includes('does not exist') || m.includes('schema cache') || m.includes('could not find'))
  );
}
