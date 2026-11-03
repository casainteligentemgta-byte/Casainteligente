import { round2 } from '@/lib/proyectos/jornales/calcularJornalesSemana';
import { montoFuenteAUsd } from '@/lib/proyectos/desviacion/montoAUsd';
import type {
  DesviacionAlerta,
  DesviacionCapitulo,
  DesviacionPresupuestariaPayload,
  SaludDesviacion,
} from '@/types/desviacion';

export const UMBRAL_DESVIACION_DEFAULT_PCT = 15;

export function saludPorConsumo(pctConsumido: number | null): SaludDesviacion {
  if (pctConsumido == null || !Number.isFinite(pctConsumido)) return 'verde';
  if (pctConsumido < 85) return 'verde';
  if (pctConsumido <= 100) return 'ambar';
  return 'rojo';
}

export function pctONull(numerador: number, denominador: number): number | null {
  if (!Number.isFinite(numerador) || !Number.isFinite(denominador) || denominador <= 0) {
    return null;
  }
  return round2((numerador / denominador) * 100);
}

export function desviacionPct(ejecutado: number, presupuesto: number): number | null {
  if (!Number.isFinite(ejecutado) || !Number.isFinite(presupuesto) || presupuesto <= 0) {
    return null;
  }
  return round2(((ejecutado - presupuesto) / presupuesto) * 100);
}

export type PartidaPresupuesto = {
  codigo?: string | null;
  descripcion?: string | null;
  capitulo_codigo?: string | null;
  capitulo_descripcion?: string | null;
  monto_total_estimado: number;
};

export type CompraDesviacion = {
  monto_usd?: number | null;
  monto_ves?: number | null;
  total_amount?: number | null;
  moneda?: string | null;
  moneda_original?: string | null;
  tasa_bcv_ves_por_usd?: number | null;
};

export function resolverPresupuestoUsd(args: {
  partidas: PartidaPresupuesto[];
  montoAproximado?: number | null;
  moneda?: string | null;
  obraPrecioVentaUsd?: number | null;
  obraPresupuestoVes?: number | null;
  tasaBcv: number;
}): { presupuestoUsd: number; fuente: string } {
  const sumaPartidas = round2(
    args.partidas.reduce((s, p) => s + (Number(p.monto_total_estimado) || 0), 0),
  );
  if (sumaPartidas > 0) {
    return { presupuestoUsd: sumaPartidas, fuente: 'ci_presupuesto_partidas' };
  }

  const precioUsd = Number(args.obraPrecioVentaUsd ?? 0);
  if (Number.isFinite(precioUsd) && precioUsd > 0) {
    return { presupuestoUsd: round2(precioUsd), fuente: 'ci_proyectos.obra_precio_venta_usd' };
  }

  const aprox = Number(args.montoAproximado ?? 0);
  if (Number.isFinite(aprox) && aprox > 0) {
    const mon = String(args.moneda ?? 'USD').toUpperCase();
    if (mon === 'VES') {
      const tasa = args.tasaBcv > 0 ? args.tasaBcv : 0;
      if (!tasa) return { presupuestoUsd: 0, fuente: 'ci_proyectos.monto_aproximado' };
      return {
        presupuestoUsd: round2(aprox / tasa),
        fuente: 'ci_proyectos.monto_aproximado (VES→USD)',
      };
    }
    return { presupuestoUsd: round2(aprox), fuente: 'ci_proyectos.monto_aproximado' };
  }

  const ves = Number(args.obraPresupuestoVes ?? 0);
  if (Number.isFinite(ves) && ves > 0 && args.tasaBcv > 0) {
    return {
      presupuestoUsd: round2(ves / args.tasaBcv),
      fuente: 'ci_proyectos.obra_presupuesto_ves (VES→USD)',
    };
  }

  return { presupuestoUsd: 0, fuente: 'sin_presupuesto' };
}

export function materialesComprasUsd(
  compras: CompraDesviacion[],
  tasaFallback: number,
): number {
  return round2(
    compras.reduce(
      (s, c) =>
        s +
        montoFuenteAUsd({
          montoUsd: c.monto_usd,
          montoVes: c.monto_ves,
          totalAmount: c.total_amount,
          moneda: c.moneda_original ?? c.moneda,
          tasaAlmacenada: c.tasa_bcv_ves_por_usd,
          tasaFallback,
        }),
      0,
    ),
  );
}

function claveCapitulo(p: PartidaPresupuesto): { codigo: string; descripcion: string } {
  const codigo = String(p.capitulo_codigo ?? '').trim() || 'SIN-CAP';
  const descripcion =
    String(p.capitulo_descripcion ?? '').trim() ||
    (codigo === 'SIN-CAP' ? 'Sin capítulo' : `Capítulo ${codigo}`);
  return { codigo, descripcion };
}

export function esCapituloManoObra(descripcion: string, codigo: string): boolean {
  const t = `${codigo} ${descripcion}`.toLowerCase();
  return /mano\s*de\s*obra|instalaci[oó]n|jornal|n[oó]mina|cctv/.test(t);
}

export function presupuestoPorCapitulo(partidas: PartidaPresupuesto[]): DesviacionCapitulo[] {
  const map = new Map<string, DesviacionCapitulo>();
  for (const p of partidas) {
    const { codigo, descripcion } = claveCapitulo(p);
    const prev = map.get(codigo);
    const monto = Number(p.monto_total_estimado) || 0;
    if (prev) {
      prev.presupuesto_usd = round2(prev.presupuesto_usd + monto);
    } else {
      map.set(codigo, {
        codigo,
        descripcion,
        presupuesto_usd: round2(monto),
        ejecutado_usd: 0,
        diferencia_usd: 0,
        desviacion_pct: null,
        pct_consumido: null,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.codigo.localeCompare(b.codigo, 'es'));
}

export type JornadasEspecialidad = {
  especialidad: string;
  jornadas: number;
  limite: number | null;
};

export type CalcularDesviacionInput = {
  proyectoId: string;
  proyectoNombre: string;
  presupuestoUsd: number;
  fuentePresupuesto: string;
  laborUsd: number;
  materialesUsd: number;
  egresosUsd: number;
  presupuestoManoObraUsd: number;
  presupuestoMaterialesUsd: number;
  umbralPct?: number;
  umbralMaterialesPct?: number;
  umbralManoObraPct?: number;
  limiteJornadasInstalacion?: number | null;
  especialidadLimite?: string | null;
  capitulos?: DesviacionCapitulo[];
  ejecutadoPorCapitulo?: Array<{ codigo: string; ejecutadoUsd: number }>;
  jornadasPorEspecialidad?: JornadasEspecialidad[];
  tasaBcv: number;
};

function cerrarCapitulo(c: DesviacionCapitulo): DesviacionCapitulo {
  return {
    ...c,
    ejecutado_usd: round2(c.ejecutado_usd),
    presupuesto_usd: round2(c.presupuesto_usd),
    diferencia_usd: round2(c.ejecutado_usd - c.presupuesto_usd),
    desviacion_pct: desviacionPct(c.ejecutado_usd, c.presupuesto_usd),
    pct_consumido: pctONull(c.ejecutado_usd, c.presupuesto_usd),
  };
}

export function construirAlertasDesviacion(args: {
  nombreProyecto: string;
  desviacionPct: number | null;
  pctConsumido?: number | null;
  umbralPct: number;
  materialesUsd: number;
  presupuestoMaterialesUsd: number;
  umbralMaterialesPct: number;
  laborUsd: number;
  presupuestoManoObraUsd: number;
  umbralManoObraPct: number;
  jornadasPorEspecialidad: JornadasEspecialidad[];
  especialidadLimite: string | null;
  limiteJornadasInstalacion: number | null;
}): DesviacionAlerta[] {
  const alertas: DesviacionAlerta[] = [];
  const nombre = args.nombreProyecto.trim() || 'el proyecto';

  if (args.pctConsumido != null && args.pctConsumido > 100) {
    alertas.push({
      id: 'sobrepresupuesto',
      severidad: 'alerta',
      mensaje: `Alerta: el gasto ejecutado supera el presupuesto estimado del proyecto ${nombre}.`,
    });
  } else if (args.desviacionPct != null && args.desviacionPct > args.umbralPct) {
    const signo = args.desviacionPct > 0 ? '+' : '';
    alertas.push({
      id: 'desviacion-global',
      severidad: 'alerta',
      mensaje: `Alerta: la desviación presupuestaria es ${signo}${args.desviacionPct.toFixed(0)}% en el proyecto ${nombre} (umbral ${args.umbralPct}%).`,
    });
  }

  if (args.presupuestoMaterialesUsd > 0) {
    const desvMat = desviacionPct(args.materialesUsd, args.presupuestoMaterialesUsd);
    if (desvMat != null && desvMat > args.umbralMaterialesPct) {
      alertas.push({
        id: 'materiales',
        severidad: 'alerta',
        mensaje: `Alerta: El costo de materiales excede el ${args.umbralMaterialesPct}% de lo estimado en el proyecto ${nombre}.`,
      });
    }
  }

  if (args.presupuestoManoObraUsd > 0) {
    const desvMo = desviacionPct(args.laborUsd, args.presupuestoManoObraUsd);
    if (desvMo != null && desvMo > args.umbralManoObraPct) {
      alertas.push({
        id: 'mano-obra',
        severidad: 'advertencia',
        mensaje: `Advertencia: el costo de jornales supera el ${args.umbralManoObraPct}% de lo estimado en mano de obra del proyecto ${nombre}.`,
      });
    }
  }

  const especialidad = (args.especialidadLimite ?? 'Instalador CCTV').trim();
  const limite = args.limiteJornadasInstalacion;
  if (limite != null && limite > 0) {
    const match = args.jornadasPorEspecialidad.find(
      (j) => j.especialidad.trim().toLowerCase() === especialidad.toLowerCase(),
    );
    const jornadas = match?.jornadas ?? 0;
    if (jornadas > limite) {
      alertas.push({
        id: 'jornadas-cctv',
        severidad: 'advertencia',
        mensaje: `Advertencia: jornadas de instalación de CCTV superan el límite del contrato (${jornadas} vs ${limite}).`,
      });
    }
  }

  return alertas;
}

export function calcularDesviacionPresupuestaria(
  input: CalcularDesviacionInput,
): DesviacionPresupuestariaPayload {
  const umbral = Number.isFinite(input.umbralPct)
    ? Math.max(0, Number(input.umbralPct))
    : UMBRAL_DESVIACION_DEFAULT_PCT;
  const umbralMat = Number.isFinite(input.umbralMaterialesPct)
    ? Math.max(0, Number(input.umbralMaterialesPct))
    : umbral;
  const umbralMo = Number.isFinite(input.umbralManoObraPct)
    ? Math.max(0, Number(input.umbralManoObraPct))
    : umbral;

  const labor = round2(Math.max(0, input.laborUsd));
  const materiales = round2(Math.max(0, input.materialesUsd));
  const egresos = round2(Math.max(0, input.egresosUsd));
  const ejecutado = round2(labor + materiales + egresos);
  const presupuesto = round2(Math.max(0, input.presupuestoUsd));
  const diferencia = round2(ejecutado - presupuesto);
  const desv = desviacionPct(ejecutado, presupuesto);
  const consumido = pctONull(ejecutado, presupuesto);

  const capitulos = (input.capitulos ?? []).map((c) => ({ ...c }));
  for (const e of input.ejecutadoPorCapitulo ?? []) {
    const hit = capitulos.find((c) => c.codigo === e.codigo);
    if (hit) hit.ejecutado_usd = round2(hit.ejecutado_usd + e.ejecutadoUsd);
  }
  const capitulosCerrados = capitulos.map(cerrarCapitulo);

  const especialidadLimite = input.especialidadLimite ?? 'Instalador CCTV';
  const alertas = construirAlertasDesviacion({
    nombreProyecto: input.proyectoNombre,
    desviacionPct: desv,
    pctConsumido: consumido,
    umbralPct: umbral,
    materialesUsd: materiales,
    presupuestoMaterialesUsd: input.presupuestoMaterialesUsd,
    umbralMaterialesPct: umbralMat,
    laborUsd: labor,
    presupuestoManoObraUsd: input.presupuestoManoObraUsd,
    umbralManoObraPct: umbralMo,
    jornadasPorEspecialidad: input.jornadasPorEspecialidad ?? [],
    especialidadLimite,
    limiteJornadasInstalacion: input.limiteJornadasInstalacion ?? null,
  });

  return {
    proyecto_id: input.proyectoId,
    proyecto_nombre: input.proyectoNombre,
    presupuesto_estimado_usd: presupuesto,
    fuente_presupuesto: input.fuentePresupuesto,
    gasto_ejecutado_usd: ejecutado,
    diferencia_usd: diferencia,
    desviacion_pct: desv,
    pct_consumido: consumido,
    salud: saludPorConsumo(consumido),
    desglose: {
      mano_obra_usd: labor,
      materiales_usd: materiales,
      egresos_almacen_usd: egresos,
    },
    capitulos: capitulosCerrados,
    umbral_pct: umbral,
    umbral_materiales_pct: umbralMat,
    umbral_mano_obra_pct: umbralMo,
    limite_jornadas_instalacion: input.limiteJornadasInstalacion ?? null,
    especialidad_limite: especialidadLimite,
    alertas,
    tasa_bcv_ves_por_usd: input.tasaBcv,
  };
}
