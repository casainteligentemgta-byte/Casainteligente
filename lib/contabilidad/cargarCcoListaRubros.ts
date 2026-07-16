import type { SupabaseClient } from '@supabase/supabase-js';
import { IMPUTACION_ENTIDAD } from '@/lib/contabilidad/imputacionCompra';
import { clasificarTipoGasto, CCO_TIPOS_GASTO } from '@/lib/contabilidad/ccoClasificarGasto';
import {
  agruparPartidasPorCapitulo,
  agruparPartidasPorRubro,
  getRubroDisciplinaKey,
} from '@/lib/proyectos/luloVistaAgrupada';

export const MESES_CORTO = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
] as const;

export type CcoRubroNivel = 'capitulo' | 'rubro' | 'partida';

export type CcoRubroNodo = {
  id: string;
  nivel: CcoRubroNivel;
  codigo: string;
  nombre: string;
  descripcion: string;
  presupuesto: number;
  meses: number[];
  total: number;
  hijos: CcoRubroNodo[];
};

export type CcoRubroOpcion = { value: string; label: string };

export type CcoListaRubros = {
  proyectoId: string | null;
  anio: number;
  aniosDisponibles: number[];
  fuente: 'lulo' | 'compras';
  nodos: CcoRubroNodo[];
  rubrosFiltro: CcoRubroOpcion[];
};

type PartidaRow = {
  id: string;
  codigo_partida: string;
  descripcion: string;
  monto_total_estimado?: number | null;
  capitulo_codigo?: string | null;
  capitulo_descripcion?: string | null;
  capitulo_orden?: number | null;
};

type GastoRow = {
  fecha?: string | null;
  disciplina?: string | null;
  descripcion?: string | null;
  costo?: number | null;
  tipo?: string | null;
};

type CompraRow = {
  fecha?: string | null;
  monto_usd?: number | null;
  supplier_name?: string | null;
  proyecto_id?: string | null;
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function emptyMeses(): number[] {
  return Array.from({ length: 12 }, () => 0);
}

function sumMeses(meses: number[]): number {
  return meses.reduce((a, b) => a + b, 0);
}

function addMeses(a: number[], b: number[]): number[] {
  return a.map((v, i) => v + (b[i] ?? 0));
}

function ymParts(fecha: string | null | undefined): { anio: number; mes: number } | null {
  const s = String(fecha ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const anio = Number(s.slice(0, 4));
  const mes = Number(s.slice(5, 7));
  if (!Number.isFinite(anio) || mes < 1 || mes > 12) return null;
  return { anio, mes };
}

function norm(s: string): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}

function rollupHijos(hijos: CcoRubroNodo[]): { meses: number[]; total: number; presupuesto: number } {
  const meses = emptyMeses();
  let presupuesto = 0;
  for (const h of hijos) {
    for (let i = 0; i < 12; i++) meses[i] += h.meses[i] ?? 0;
    presupuesto += h.presupuesto;
  }
  return { meses, total: sumMeses(meses), presupuesto };
}

async function cargarPartidas(
  supabase: SupabaseClient,
  proyectoId: string,
): Promise<PartidaRow[]> {
  const q = await supabase
    .from('ci_presupuesto_partidas')
    .select(
      'id,codigo_partida,descripcion,monto_total_estimado,capitulo_codigo,capitulo_descripcion,capitulo_orden',
    )
    .eq('proyecto_id', proyectoId)
    .order('capitulo_orden', { ascending: true })
    .order('codigo_partida')
    .limit(8000);

  if (!q.error) return (q.data ?? []) as PartidaRow[];

  const msg = q.error.message ?? '';
  if (msg.includes('capitulo_') || q.error.code === '42703') {
    const basico = await supabase
      .from('ci_presupuesto_partidas')
      .select('id,codigo_partida,descripcion,monto_total_estimado')
      .eq('proyecto_id', proyectoId)
      .order('codigo_partida')
      .limit(8000);
    if (!basico.error) return (basico.data ?? []) as PartidaRow[];
  }
  if (msg.includes('does not exist') || msg.includes('schema cache') || q.error.code === '42P01') {
    return [];
  }
  return [];
}

async function cargarGastosObra(
  supabase: SupabaseClient,
  proyectoId: string,
): Promise<GastoRow[]> {
  const q = await supabase
    .from('gastos_obra')
    .select('fecha,disciplina,descripcion,costo,tipo')
    .eq('proyecto_id', proyectoId)
    .limit(8000);
  if (!q.error) return (q.data ?? []) as GastoRow[];
  return [];
}

function acumularPorAnioMes(
  rows: { fecha?: string | null; monto: number }[],
  anio: number,
): number[] {
  const meses = emptyMeses();
  for (const r of rows) {
    const p = ymParts(r.fecha);
    if (!p || p.anio !== anio) continue;
    meses[p.mes - 1] += r.monto;
  }
  return meses;
}

function buildDesdeCompras(
  compras: CompraRow[],
  anio: number,
  nombrePorProyecto: Map<string, string>,
  agruparPorProyecto: boolean,
): CcoRubroNodo[] {
  /** tipo -> (clave hijo -> { nombre, desc, rows }) */
  type HijoAcc = { nombre: string; descripcion: string; montos: { fecha?: string | null; monto: number }[] };
  const porTipo = new Map<string, Map<string, HijoAcc>>();

  for (const c of compras) {
    const p = ymParts(c.fecha);
    if (!p || p.anio !== anio) continue;
    const tipo = clasificarTipoGasto(String(c.supplier_name ?? ''));
    const pid = String(c.proyecto_id ?? '').trim();
    const hijoKey = agruparPorProyecto
      ? pid || 'sin-obra'
      : norm(String(c.supplier_name ?? '').trim() || 'Sin proveedor');
    const hijoNombre = agruparPorProyecto
      ? nombrePorProyecto.get(pid) ?? (pid ? pid.slice(0, 8) : 'Sin obra')
      : String(c.supplier_name ?? '').trim() || 'Sin proveedor';

    if (!porTipo.has(tipo)) porTipo.set(tipo, new Map());
    const m = porTipo.get(tipo)!;
    if (!m.has(hijoKey)) {
      m.set(hijoKey, {
        nombre: hijoNombre,
        descripcion: agruparPorProyecto ? 'Obra / capítulo' : 'Proveedor',
        montos: [],
      });
    }
    m.get(hijoKey)!.montos.push({ fecha: c.fecha, monto: num(c.monto_usd) });
  }

  const nodos: CcoRubroNodo[] = [];
  let idx = 1;
  for (const tipo of CCO_TIPOS_GASTO) {
    const hijosMap = porTipo.get(tipo);
    if (!hijosMap || hijosMap.size === 0) continue;
    const hijos: CcoRubroNodo[] = Array.from(hijosMap.entries())
      .map(([key, acc]) => {
        const meses = acumularPorAnioMes(acc.montos, anio);
        return {
          id: `compra-${tipo}-${key}`,
          nivel: 'partida' as const,
          codigo: key.length <= 12 ? key : key.slice(0, 12),
          nombre: acc.nombre,
          descripcion: acc.descripcion,
          presupuesto: 0,
          meses,
          total: sumMeses(meses),
          hijos: [],
        };
      })
      .filter((h) => h.total > 0)
      .sort((a, b) => b.total - a.total);

    if (hijos.length === 0) continue;
    const roll = rollupHijos(hijos);
    nodos.push({
      id: `tipo-${tipo}`,
      nivel: 'capitulo',
      codigo: String(idx),
      nombre: `${idx}-${tipo}`,
      descripcion: 'Tipo de gasto (libro CI)',
      presupuesto: 0,
      meses: roll.meses,
      total: roll.total,
      hijos: [
        {
          id: `rubro-${tipo}`,
          nivel: 'rubro',
          codigo: String(idx),
          nombre: tipo,
          descripcion: 'Agrupación por tipo',
          presupuesto: 0,
          meses: roll.meses,
          total: roll.total,
          hijos,
        },
      ],
    });
    idx += 1;
  }
  return nodos;
}

function gastoMatchRubro(gasto: GastoRow, rubroKey: string, rubroLabel: string): boolean {
  const disc = norm(String(gasto.disciplina ?? ''));
  const desc = norm(String(gasto.descripcion ?? ''));
  const key = norm(rubroKey);
  const label = norm(rubroLabel);
  if (!disc && !desc) return false;
  if (disc === key || disc === label) return true;
  if (key && (disc.includes(key) || desc.includes(key))) return true;
  if (label && disc.includes(label.slice(0, 24))) return true;
  const discAsKey = getRubroDisciplinaKey(String(gasto.disciplina ?? ''));
  if (norm(discAsKey) === key) return true;
  return false;
}

function gastoMatchPartida(gasto: GastoRow, codigo: string, nombre: string): boolean {
  const cod = norm(codigo);
  const nom = norm(nombre).slice(0, 32);
  const disc = norm(String(gasto.disciplina ?? ''));
  const desc = norm(String(gasto.descripcion ?? ''));
  if (cod && (disc.includes(cod) || desc.includes(cod))) return true;
  if (nom.length >= 6 && (disc.includes(nom) || desc.includes(nom))) return true;
  return false;
}

function buildDesdeLulo(
  partidas: PartidaRow[],
  gastos: GastoRow[],
  compras: CompraRow[],
  anio: number,
): CcoRubroNodo[] {
  const gastosAnio = gastos.filter((g) => {
    const p = ymParts(g.fecha);
    return p?.anio === anio;
  });
  const usados = new Set<GastoRow>();

  const partidasNorm = partidas.map((p) => ({
    ...p,
    descripcion: p.descripcion ?? '',
    monto_total_estimado: num(p.monto_total_estimado),
  }));

  const caps = agruparPartidasPorCapitulo(partidasNorm);
  const nodos: CcoRubroNodo[] = caps.map((cap, capIdx) => {
    const rubros = agruparPartidasPorRubro(cap.items);
    const hijosRubro: CcoRubroNodo[] = rubros.map((rubro) => {
      const partidasNodo: CcoRubroNodo[] = rubro.items.map((p) => {
        const montosPartida = gastosAnio
          .filter((g) => gastoMatchPartida(g, p.codigo_partida, p.descripcion))
          .map((g) => {
            usados.add(g);
            return { fecha: g.fecha, monto: num(g.costo) };
          });
        const meses = acumularPorAnioMes(montosPartida, anio);
        const partidaId = String((p as PartidaRow).id ?? p.codigo_partida);
        return {
          id: `par-${partidaId}`,
          nivel: 'partida' as const,
          codigo: p.codigo_partida,
          nombre: p.descripcion?.trim() || p.codigo_partida,
          descripcion: `Presupuesto ${num(p.monto_total_estimado).toLocaleString('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 0,
          })}`,
          presupuesto: num(p.monto_total_estimado),
          meses,
          total: sumMeses(meses),
          hijos: [],
        };
      });

      const montosRubro = gastosAnio
        .filter((g) => !usados.has(g) && gastoMatchRubro(g, rubro.clave, rubro.etiqueta))
        .map((g) => {
          usados.add(g);
          return { fecha: g.fecha, monto: num(g.costo) };
        });
      const mesesRubroDirecto = acumularPorAnioMes(montosRubro, anio);
      const rollPartidas = rollupHijos(partidasNodo);
      const meses = addMeses(rollPartidas.meses, mesesRubroDirecto);

      return {
        id: `rub-${cap.clave}-${rubro.clave}`,
        nivel: 'rubro' as const,
        codigo: rubro.clave,
        nombre: rubro.etiqueta,
        descripcion: `${rubro.items.length} partida(s)`,
        presupuesto: rollPartidas.presupuesto,
        meses,
        total: sumMeses(meses),
        hijos: partidasNodo,
      };
    });

    const roll = rollupHijos(hijosRubro);
    return {
      id: `cap-${cap.clave}`,
      nivel: 'capitulo' as const,
      codigo: cap.clave || String(capIdx + 1),
      nombre: cap.etiqueta,
      descripcion: `${hijosRubro.length} rubro(s)`,
      presupuesto: roll.presupuesto,
      meses: roll.meses,
      total: roll.total,
      hijos: hijosRubro,
    };
  });

  // Gastos Lulo sin match + compras del año como capítulo auxiliar
  const restos = gastosAnio.filter((g) => !usados.has(g));
  const comprasMeses = acumularPorAnioMes(
    compras.map((c) => ({ fecha: c.fecha, monto: num(c.monto_usd) })),
    anio,
  );
  const restosMeses = acumularPorAnioMes(
    restos.map((g) => ({ fecha: g.fecha, monto: num(g.costo) })),
    anio,
  );
  const extrasMeses = addMeses(comprasMeses, restosMeses);
  if (sumMeses(extrasMeses) > 0) {
    nodos.push({
      id: 'cap-ejecucion-ci',
      nivel: 'capitulo',
      codigo: 'CI',
      nombre: 'EJECUCIÓN CI / SIN PARTIDA',
      descripcion: 'Compras e imputaciones no enlazadas a partida Lulo',
      presupuesto: 0,
      meses: extrasMeses,
      total: sumMeses(extrasMeses),
      hijos: [
        {
          id: 'rub-ejecucion-ci',
          nivel: 'rubro',
          codigo: 'CI',
          nombre: 'Gastos libro CI',
          descripcion: 'contabilidad_compras + gastos_obra sin match',
          presupuesto: 0,
          meses: extrasMeses,
          total: sumMeses(extrasMeses),
          hijos: [],
        },
      ],
    });
  }

  return nodos;
}

function collectRubrosFiltro(nodos: CcoRubroNodo[]): CcoRubroOpcion[] {
  const out: CcoRubroOpcion[] = [];
  for (const cap of nodos) {
    for (const rub of cap.hijos) {
      if (rub.nivel === 'rubro') {
        out.push({ value: rub.id, label: `${rub.codigo} · ${rub.nombre}` });
      }
    }
  }
  return out.sort((a, b) => a.label.localeCompare(b.label, 'es'));
}

function aniosDesdeFechas(fechas: (string | null | undefined)[]): number[] {
  const set = new Set<number>();
  for (const f of fechas) {
    const p = ymParts(f);
    if (p) set.add(p.anio);
  }
  return Array.from(set).sort((a, b) => b - a);
}

export async function cargarCcoListaRubros(
  supabase: SupabaseClient,
  params?: { proyectoId?: string | null; anio?: number | null },
): Promise<CcoListaRubros> {
  const proyectoId = params?.proyectoId?.trim() || null;

  const { data: proyectosRows } = await supabase
    .from('ci_proyectos')
    .select('id,nombre')
    .order('nombre')
    .limit(500);
  const nombrePorProyecto = new Map(
    (proyectosRows ?? []).map((p) => [
      String((p as { id: string }).id),
      String((p as { nombre?: string }).nombre ?? 'Obra').trim() || 'Obra',
    ]),
  );

  let comprasQ = supabase
    .from('contabilidad_compras')
    .select('id,fecha,proyecto_id,monto_usd,imputacion,supplier_name')
    .not('proyecto_id', 'is', null)
    .neq('imputacion', IMPUTACION_ENTIDAD)
    .order('fecha', { ascending: true })
    .limit(8000);
  if (proyectoId) comprasQ = comprasQ.eq('proyecto_id', proyectoId);
  const { data: comprasData, error: cErr } = await comprasQ;
  if (cErr) throw cErr;
  const compras = (comprasData ?? []) as CompraRow[];

  let partidas: PartidaRow[] = [];
  let gastos: GastoRow[] = [];
  if (proyectoId) {
    [partidas, gastos] = await Promise.all([
      cargarPartidas(supabase, proyectoId),
      cargarGastosObra(supabase, proyectoId),
    ]);
  }

  const aniosDisponibles = aniosDesdeFechas([
    ...compras.map((c) => c.fecha),
    ...gastos.map((g) => g.fecha),
  ]);
  if (aniosDisponibles.length === 0) {
    aniosDisponibles.push(new Date().getFullYear());
  }

  const anio =
    params?.anio && aniosDisponibles.includes(params.anio)
      ? params.anio
      : aniosDisponibles[0];

  const fuente: 'lulo' | 'compras' = partidas.length > 0 ? 'lulo' : 'compras';
  const nodos =
    fuente === 'lulo'
      ? buildDesdeLulo(partidas, gastos, compras, anio)
      : buildDesdeCompras(compras, anio, nombrePorProyecto, !proyectoId);

  return {
    proyectoId,
    anio,
    aniosDisponibles,
    fuente,
    nodos,
    rubrosFiltro: collectRubrosFiltro(nodos),
  };
}
