/**
 * Rendición de cuentas de una obra bajo administración delegada.
 *
 * Toma los movimientos del CCO (aportes del cliente y gastos de obra) y los corta
 * por período: semana, mes o toda la obra. Mismas fórmulas que los KPIs oficiales:
 *
 *   HONORARIOS  = Σ honorarios de cada gasto del período
 *   TOTAL       = GASTOS + HONORARIOS
 *   SALDO FINAL = SALDO ANTERIOR + APORTES − TOTAL
 *
 * Sin acceso a base de datos: todo lo de aquí se prueba con datos en memoria.
 */

export type PeriodoRendicion = 'semana' | 'mes' | 'obra';
export type VersionRendicion = 'interna' | 'cliente';

export type RangoRendicion = {
  tipo: PeriodoRendicion;
  /** Primer día incluido (YYYY-MM-DD); null en «toda la obra». */
  desde: string | null;
  /** Último día incluido (YYYY-MM-DD); null en «toda la obra». */
  hasta: string | null;
  etiqueta: string;
};

export type MovimientoRendicion = {
  id: string;
  clase: 'GASTO' | 'INGRESO';
  /** YYYY-MM-DD; null si el registro no tiene fecha. */
  fecha: string | null;
  proveedor: string;
  concepto: string;
  factura: string | null;
  tipo: string;
  capitulo: string;
  /** Monto del gasto o del aporte, en USD. */
  baseUsd: number;
  /** Honorarios de administración de este gasto (0 en aportes). */
  honorariosUsd: number;
  /** false si los honorarios se calcularon aquí con el % pactado (no venían guardados). */
  honorariosGuardados: boolean;
  estado: string;
  formaPago: string | null;
  /** El gasto tiene factura o soporte adjunto. */
  tieneSoporte: boolean;
};

export type TotalesRendicion = {
  aportes: number;
  gastos: number;
  honorarios: number;
  /** gastos + honorarios */
  total: number;
  nAportes: number;
  nGastos: number;
};

export type GrupoRendicion = { nombre: string; gastos: number; honorarios: number; total: number; n: number };

export type MesRendicion = {
  /** YYYY-MM */
  periodo: string;
  etiqueta: string;
  aportes: number;
  gastos: number;
  honorarios: number;
  total: number;
  /** Saldo en caja al cierre del mes. */
  saldo: number;
};

export type ControlInternoRendicion = {
  /** Gastos del período sin factura ni soporte adjunto. */
  sinSoporte: { n: number; monto: number };
  /** Gastos del período cuyo estado no es PAGADO. */
  noPagados: { n: number; monto: number };
  /** Gastos del período sin honorarios guardados: se calcularon con el % pactado. */
  honorariosCalculados: { n: number; monto: number; honorarios: number };
  /** Gastos del período con un % de honorarios distinto al pactado. */
  pctDistinto: { n: number; monto: number };
  /** Movimientos sin fecha: solo entran en «toda la obra». */
  sinFecha: { n: number; monto: number };
  proveedores: GrupoRendicion[];
  porEstado: Array<{ nombre: string; n: number; monto: number }>;
};

export type RendicionHonorarios = {
  rango: RangoRendicion;
  /** % de honorarios pactado para la obra. */
  pctPactado: number;
  /** % que resulta de honorarios / gastos en el período. */
  pctEfectivo: number;
  /** Saldo en caja antes del primer día del período (0 en «toda la obra»). */
  saldoAnterior: number;
  periodo: TotalesRendicion;
  /** saldoAnterior + aportes − total */
  saldoFinal: number;
  /** Toda la obra hasta el último día del período. */
  acumulado: TotalesRendicion & { saldo: number };
  porTipo: GrupoRendicion[];
  porCapitulo: GrupoRendicion[];
  /** Mes a mes; solo en «toda la obra». */
  porMes: MesRendicion[];
  aportes: MovimientoRendicion[];
  gastos: MovimientoRendicion[];
  control: ControlInternoRendicion;
  /** Fecha del último movimiento con fecha (para saltar a un período con datos). */
  ultimoMovimiento: string | null;
};

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

const RE_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

export function esFechaIso(v: string | null | undefined): v is string {
  if (!v) return false;
  const m = RE_FECHA.exec(v);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
}

function aUtc(fecha: string): Date {
  const m = RE_FECHA.exec(fecha)!;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function aIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function sumarDias(fecha: string, dias: number): string {
  const d = aUtc(fecha);
  d.setUTCDate(d.getUTCDate() + dias);
  return aIso(d);
}

/** 2026-07-13 → «13/07/2026» */
export function fechaCorta(fecha: string | null | undefined): string {
  const m = RE_FECHA.exec(String(fecha ?? ''));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '—';
}

/** Hoy en Venezuela (UTC−4, sin horario de verano) como YYYY-MM-DD. */
export function hoyCaracas(ahora: Date = new Date()): string {
  return new Date(ahora.getTime() - 4 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * Rango del período que contiene `fechaRef`.
 * La semana va de lunes a domingo; el mes es el mes calendario.
 */
export function rangoRendicion(tipo: PeriodoRendicion, fechaRef: string): RangoRendicion {
  if (tipo === 'obra') {
    return { tipo, desde: null, hasta: null, etiqueta: 'Toda la obra' };
  }
  const ref = esFechaIso(fechaRef) ? fechaRef : hoyCaracas();

  if (tipo === 'semana') {
    const dia = aUtc(ref).getUTCDay(); // 0 = domingo
    const desde = sumarDias(ref, -((dia + 6) % 7));
    const hasta = sumarDias(desde, 6);
    return { tipo, desde, hasta, etiqueta: `Semana del ${fechaCorta(desde)} al ${fechaCorta(hasta)}` };
  }

  const [anio, mes] = [Number(ref.slice(0, 4)), Number(ref.slice(5, 7))];
  const desde = `${ref.slice(0, 7)}-01`;
  const hasta = aIso(new Date(Date.UTC(anio, mes, 0)));
  return { tipo, desde, hasta, etiqueta: `${MESES[mes - 1]![0]!.toUpperCase()}${MESES[mes - 1]!.slice(1)} de ${anio}` };
}

/** Fecha de referencia del período anterior (−1) o siguiente (+1). */
export function moverPeriodo(tipo: PeriodoRendicion, fechaRef: string, pasos: number): string {
  const ref = esFechaIso(fechaRef) ? fechaRef : hoyCaracas();
  if (tipo === 'semana') return sumarDias(ref, 7 * pasos);
  if (tipo === 'mes') {
    const d = aUtc(`${ref.slice(0, 7)}-01`);
    d.setUTCMonth(d.getUTCMonth() + pasos);
    return aIso(d);
  }
  return ref;
}

export function etiquetaMes(periodo: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(periodo);
  if (!m) return periodo;
  return `${MESES[Number(m[2]) - 1] ?? m[2]} ${m[1]}`;
}

function redondear(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function totalesVacios(): TotalesRendicion {
  return { aportes: 0, gastos: 0, honorarios: 0, total: 0, nAportes: 0, nGastos: 0 };
}

function acumular(t: TotalesRendicion, m: MovimientoRendicion): void {
  if (m.clase === 'INGRESO') {
    t.aportes += m.baseUsd;
    t.nAportes += 1;
    return;
  }
  t.gastos += m.baseUsd;
  t.honorarios += m.honorariosUsd;
  t.nGastos += 1;
}

function cerrar(t: TotalesRendicion): TotalesRendicion {
  return {
    aportes: redondear(t.aportes),
    gastos: redondear(t.gastos),
    honorarios: redondear(t.honorarios),
    total: redondear(t.gastos + t.honorarios),
    nAportes: t.nAportes,
    nGastos: t.nGastos,
  };
}

function agrupar(gastos: MovimientoRendicion[], clave: (m: MovimientoRendicion) => string): GrupoRendicion[] {
  const mapa = new Map<string, GrupoRendicion>();
  for (const g of gastos) {
    const nombre = clave(g).trim() || '—';
    const fila = mapa.get(nombre) ?? { nombre, gastos: 0, honorarios: 0, total: 0, n: 0 };
    fila.gastos += g.baseUsd;
    fila.honorarios += g.honorariosUsd;
    fila.n += 1;
    mapa.set(nombre, fila);
  }
  return Array.from(mapa.values())
    .map((f) => ({
      ...f,
      gastos: redondear(f.gastos),
      honorarios: redondear(f.honorarios),
      total: redondear(f.gastos + f.honorarios),
    }))
    .sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre));
}

function porFecha(a: MovimientoRendicion, b: MovimientoRendicion): number {
  return (
    String(a.fecha ?? '').localeCompare(String(b.fecha ?? '')) ||
    a.proveedor.localeCompare(b.proveedor) ||
    a.id.localeCompare(b.id)
  );
}

export function construirRendicion(opts: {
  movimientos: MovimientoRendicion[];
  rango: RangoRendicion;
  pctPactado: number;
}): RendicionHonorarios {
  const { rango } = opts;
  const pctPactado = Number(opts.pctPactado) > 0 ? Number(opts.pctPactado) : 15;
  const esObra = rango.tipo === 'obra' || !rango.desde || !rango.hasta;

  const anterior = totalesVacios();
  const periodo = totalesVacios();
  const acumulado = totalesVacios();
  const aportes: MovimientoRendicion[] = [];
  const gastos: MovimientoRendicion[] = [];
  const sinFecha = { n: 0, monto: 0 };
  let ultimoMovimiento: string | null = null;

  for (const m of opts.movimientos) {
    if (!(m.baseUsd > 0)) continue;
    const fecha = esFechaIso(m.fecha) ? m.fecha : null;
    if (fecha && (!ultimoMovimiento || fecha > ultimoMovimiento)) ultimoMovimiento = fecha;

    if (!fecha) {
      sinFecha.n += 1;
      sinFecha.monto += m.baseUsd;
      // Sin fecha no se puede ubicar en una semana o un mes: solo cuenta en toda la obra.
      if (!esObra) continue;
    }

    if (esObra) {
      acumular(periodo, m);
      acumular(acumulado, m);
      (m.clase === 'INGRESO' ? aportes : gastos).push(m);
      continue;
    }

    if (fecha! < rango.desde!) {
      acumular(anterior, m);
      acumular(acumulado, m);
    } else if (fecha! <= rango.hasta!) {
      acumular(periodo, m);
      acumular(acumulado, m);
      (m.clase === 'INGRESO' ? aportes : gastos).push(m);
    }
  }

  aportes.sort(porFecha);
  gastos.sort(porFecha);

  const tAnterior = cerrar(anterior);
  const tPeriodo = cerrar(periodo);
  const tAcumulado = cerrar(acumulado);
  const saldoAnterior = redondear(tAnterior.aportes - tAnterior.total);
  const saldoFinal = redondear(saldoAnterior + tPeriodo.aportes - tPeriodo.total);

  const porMes: MesRendicion[] = [];
  if (esObra) {
    const meses = new Map<string, TotalesRendicion>();
    for (const m of [...aportes, ...gastos]) {
      if (!esFechaIso(m.fecha)) continue;
      const clave = m.fecha.slice(0, 7);
      const t = meses.get(clave) ?? totalesVacios();
      acumular(t, m);
      meses.set(clave, t);
    }
    let saldo = 0;
    for (const clave of Array.from(meses.keys()).sort()) {
      const t = cerrar(meses.get(clave)!);
      saldo = redondear(saldo + t.aportes - t.total);
      porMes.push({
        periodo: clave,
        etiqueta: etiquetaMes(clave),
        aportes: t.aportes,
        gastos: t.gastos,
        honorarios: t.honorarios,
        total: t.total,
        saldo,
      });
    }
  }

  const sinSoporte = gastos.filter((g) => !g.tieneSoporte);
  const noPagados = gastos.filter((g) => !/^PAGADO$/i.test(g.estado.trim()));
  const calculados = gastos.filter((g) => !g.honorariosGuardados);
  const pctDistinto = gastos.filter(
    (g) => g.baseUsd > 0 && Math.abs((g.honorariosUsd / g.baseUsd) * 100 - pctPactado) > 0.05,
  );
  const suma = (l: MovimientoRendicion[]) => redondear(l.reduce((a, g) => a + g.baseUsd, 0));

  const estados = new Map<string, { nombre: string; n: number; monto: number }>();
  for (const g of gastos) {
    const nombre = g.estado.trim().toUpperCase() || 'SIN ESTADO';
    const fila = estados.get(nombre) ?? { nombre, n: 0, monto: 0 };
    fila.n += 1;
    fila.monto += g.baseUsd;
    estados.set(nombre, fila);
  }

  return {
    rango,
    pctPactado,
    pctEfectivo:
      tPeriodo.gastos > 0 ? Math.round((tPeriodo.honorarios / tPeriodo.gastos) * 10000) / 100 : pctPactado,
    saldoAnterior,
    periodo: tPeriodo,
    saldoFinal,
    acumulado: { ...tAcumulado, saldo: redondear(tAcumulado.aportes - tAcumulado.total) },
    porTipo: agrupar(gastos, (g) => g.tipo),
    porCapitulo: agrupar(gastos, (g) => g.capitulo),
    porMes,
    aportes,
    gastos,
    control: {
      sinSoporte: { n: sinSoporte.length, monto: suma(sinSoporte) },
      noPagados: { n: noPagados.length, monto: suma(noPagados) },
      honorariosCalculados: {
        n: calculados.length,
        monto: suma(calculados),
        honorarios: redondear(calculados.reduce((a, g) => a + g.honorariosUsd, 0)),
      },
      pctDistinto: { n: pctDistinto.length, monto: suma(pctDistinto) },
      sinFecha: { n: sinFecha.n, monto: redondear(sinFecha.monto) },
      proveedores: agrupar(gastos, (g) => g.proveedor).slice(0, 10),
      porEstado: Array.from(estados.values())
        .map((e) => ({ ...e, monto: redondear(e.monto) }))
        .sort((a, b) => b.monto - a.monto),
    },
    ultimoMovimiento,
  };
}

/** 1234.5 → «1,234.50» (mismo formato que el resto del CCO). */
export function fmtUsd(n: number): string {
  return (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Nombre de archivo seguro para la descarga. */
export function nombreArchivoRendicion(obra: string, rango: RangoRendicion, version: VersionRendicion): string {
  const limpio = obra
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  const periodo =
    rango.tipo === 'obra' || !rango.desde || !rango.hasta
      ? 'toda_la_obra'
      : rango.tipo === 'mes'
        ? rango.desde.slice(0, 7)
        : `${rango.desde}_a_${rango.hasta}`;
  return `Rendicion_${limpio || 'obra'}_${periodo}_${version}.pdf`;
}
