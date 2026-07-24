import type { SupabaseClient } from '@supabase/supabase-js';
import type { LuloMdbFullDump, LuloMdbTableDump } from '@/lib/proyectos/extractLuloFull';
import { formatErrorMessage } from '@/lib/utils/formatErrorMessage';

const BATCH = 200;

type TipoInsumoDb = 'Material' | 'ManoDeObra' | 'Equipo';

export type PersistirLuloCatalogoResult = {
  capitulos: number;
  insumos: number;
  partidas: number;
  partidaInsumos: number;
};

function table(dump: LuloMdbFullDump, name: string): LuloMdbTableDump | undefined {
  return dump.tables.find((t) => t.name === name);
}

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function str(v: unknown): string {
  return String(v ?? '').trim();
}

function parseCapitulos(dump: LuloMdbFullDump, codigoObra?: string): { num_cap: number; descripcion: string }[] {
  const capi = table(dump, 'ObraCapi');
  if (!capi) return [];

  const filtro = codigoObra?.trim().toUpperCase();
  const seen = new Set<number>();
  const out: { num_cap: number; descripcion: string }[] = [];

  for (const raw of capi.rows) {
    if (filtro && str(raw.CodObr).toUpperCase() !== filtro) continue;
    const numCap = Math.floor(num(raw.CodCap, 0));
    if (numCap <= 0 || seen.has(numCap)) continue;
    seen.add(numCap);
    const descripcion = str(raw.DesCap) || `Capítulo ${numCap}`;
    out.push({ num_cap: numCap, descripcion: descripcion.slice(0, 500) });
  }

  return out.sort((a, b) => a.num_cap - b.num_cap);
}

function mapPartidaCapitulo(
  dump: LuloMdbFullDump,
  codigoObra?: string,
): Map<string, number> {
  const capiPart = table(dump, 'ObraCapiPart');
  const map = new Map<string, number>();
  if (!capiPart) return map;

  const filtro = codigoObra?.trim().toUpperCase();
  for (const raw of capiPart.rows) {
    if (filtro && str(raw.CodObr).toUpperCase() !== filtro) continue;
    const codPar = str(raw.CodPar).toUpperCase();
    const numCap = Math.floor(num(raw.CodCap, 0));
    if (!codPar || numCap <= 0) continue;
    if (!map.has(codPar)) map.set(codPar, numCap);
  }
  return map;
}

const INSUMO_SOURCES: {
  table: string;
  codCol: string;
  uniCol?: string;
  preCol: string;
  tipo: TipoInsumoDb;
  defaultUni: string;
}[] = [
  { table: 'ObraMate', codCol: 'CodMat', uniCol: 'UniMat', preCol: 'CosMat', tipo: 'Material', defaultUni: 'UND' },
  { table: 'ObraMano', codCol: 'CodMan', preCol: 'Salari', tipo: 'ManoDeObra', defaultUni: 'JOR' },
  { table: 'ObraEqui', codCol: 'CodEqu', preCol: 'CosEqu', tipo: 'Equipo', defaultUni: 'HORA' },
];

function parseInsumos(dump: LuloMdbFullDump): Array<{
  codigo: string;
  descripcion: string;
  unidad: string;
  tipo: TipoInsumoDb;
  precio_unitario: number;
  bono_diario: number;
}> {
  const seen = new Set<string>();
  const out: Array<{
    codigo: string;
    descripcion: string;
    unidad: string;
    tipo: TipoInsumoDb;
    precio_unitario: number;
    bono_diario: number;
  }> = [];

  for (const src of INSUMO_SOURCES) {
    const t = table(dump, src.table);
    if (!t) continue;
    for (const raw of t.rows) {
      const codigo = str(raw[src.codCol]);
      if (!codigo) continue;
      const key = codigo.toUpperCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const uni = src.uniCol ? str(raw[src.uniCol]) : '';
      out.push({
        codigo,
        descripcion: (str(raw.Descri) || codigo).slice(0, 500),
        unidad: (uni || src.defaultUni).slice(0, 32),
        tipo: src.tipo,
        precio_unitario: num(raw[src.preCol], 0),
        bono_diario: src.tipo === 'ManoDeObra' ? num(raw.Salari, 0) : 0,
      });
    }
  }
  return out;
}

function parsePartidasCatalogo(
  dump: LuloMdbFullDump,
  partidaCapMap: Map<string, number>,
): Array<{
  codigo_lulo: string;
  num_cap: number | null;
  descripcion: string;
  unidad: string;
  cantidad: number;
  rendimiento: number;
}> {
  const obraPart = table(dump, 'ObraPart');
  if (!obraPart) return [];

  const seen = new Set<string>();
  const out: Array<{
    codigo_lulo: string;
    num_cap: number | null;
    descripcion: string;
    unidad: string;
    cantidad: number;
    rendimiento: number;
  }> = [];

  for (const raw of obraPart.rows) {
    const codigo_lulo = str(raw.CodPar);
    if (!codigo_lulo) continue;
    const key = codigo_lulo.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const numCap = partidaCapMap.get(key) ?? null;
    out.push({
      codigo_lulo,
      num_cap: numCap,
      descripcion: (str(raw.Descri) || codigo_lulo).slice(0, 800),
      unidad: (str(raw.UniPar) || 'UND').slice(0, 32),
      cantidad: num(raw.CanPar, 0),
      rendimiento: num(raw.RenPar, 1) || 1,
    });
  }
  return out;
}

const PAIN_SOURCES = ['ObraPainMate', 'ObraPainMano', 'ObraPainEqui'] as const;

function esAutoPorcentaje(codPar: string, codIns: string): boolean {
  const t = `${codPar} ${codIns}`.toLowerCase();
  return /herramientas?\s*menor|5\s*%|auto.*mo/.test(t);
}

function parsePartidaInsumos(
  dump: LuloMdbFullDump,
): Array<{ codigo_lulo: string; insumo_codigo: string; cantidad_diseno: number; es_auto_porcentaje: boolean }> {
  const seen = new Set<string>();
  const out: Array<{
    codigo_lulo: string;
    insumo_codigo: string;
    cantidad_diseno: number;
    es_auto_porcentaje: boolean;
  }> = [];

  for (const name of PAIN_SOURCES) {
    const t = table(dump, name);
    if (!t) continue;
    for (const raw of t.rows) {
      const codigo_lulo = str(raw.CodPar);
      const insumo_codigo = str(raw.CodIns);
      if (!codigo_lulo || !insumo_codigo) continue;
      const key = `${codigo_lulo}|${insumo_codigo}`.toUpperCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        codigo_lulo,
        insumo_codigo,
        cantidad_diseno: num(raw.CanIns, 0),
        es_auto_porcentaje: esAutoPorcentaje(codigo_lulo, insumo_codigo),
      });
    }
  }
  return out;
}

async function vaciarCatalogo(supabase: SupabaseClient): Promise<void> {
  const { error: e1 } = await supabase.from('lulo_catalogo_partida_insumos').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (e1) throw new Error(formatErrorMessage(e1));
  const { error: e2 } = await supabase.from('lulo_catalogo_partidas').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (e2) throw new Error(formatErrorMessage(e2));
  const { error: e3 } = await supabase.from('lulo_catalogo_insumos').delete().neq('codigo', '');
  if (e3) throw new Error(formatErrorMessage(e3));
  const { error: e4 } = await supabase.from('lulo_catalogo_capitulos').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (e4) throw new Error(formatErrorMessage(e4));
}

/**
 * Importa catálogo maestro Lulo (capítulos, insumos, partidas catálogo, APU diseño)
 * desde volcado MDB/CSV.
 */
export async function persistirLuloCatalogoMaestro(
  supabase: SupabaseClient,
  dump: LuloMdbFullDump,
  options?: { reemplazar?: boolean; codigoObra?: string },
): Promise<PersistirLuloCatalogoResult> {
  if (options?.reemplazar) {
    await vaciarCatalogo(supabase);
  }

  const capitulosParsed = parseCapitulos(dump, options?.codigoObra);
  const partidaCapMap = mapPartidaCapitulo(dump, options?.codigoObra);
  const insumosParsed = parseInsumos(dump);
  const partidasParsed = parsePartidasCatalogo(dump, partidaCapMap);
  const apuParsed = parsePartidaInsumos(dump);

  const numCapToId = new Map<number, string>();

  let capitulos = 0;
  for (const cap of capitulosParsed) {
    const { data, error } = await supabase
      .from('lulo_catalogo_capitulos')
      .upsert(
        { num_cap: cap.num_cap, descripcion: cap.descripcion },
        { onConflict: 'num_cap' },
      )
      .select('id, num_cap')
      .single();
    if (error) throw new Error(formatErrorMessage(error));
    if (data?.id && data.num_cap != null) {
      numCapToId.set(Number(data.num_cap), data.id as string);
      capitulos += 1;
    }
  }

  let insumos = 0;
  for (let i = 0; i < insumosParsed.length; i += BATCH) {
    const batch = insumosParsed.slice(i, i + BATCH).map((row) => ({
      ...row,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from('lulo_catalogo_insumos').upsert(batch, { onConflict: 'codigo' });
    if (error) throw new Error(formatErrorMessage(error));
    insumos += batch.length;
  }

  const codigoPartidaToId = new Map<string, string>();
  let partidas = 0;
  for (let i = 0; i < partidasParsed.length; i += BATCH) {
    const batch = partidasParsed.slice(i, i + BATCH).map((p) => ({
      codigo_lulo: p.codigo_lulo,
      capitulo_id: p.num_cap != null ? numCapToId.get(p.num_cap) ?? null : null,
      descripcion: p.descripcion,
      unidad: p.unidad,
      cantidad: p.cantidad,
      rendimiento: p.rendimiento,
    }));
    const { data, error } = await supabase
      .from('lulo_catalogo_partidas')
      .upsert(batch, { onConflict: 'codigo_lulo' })
      .select('id, codigo_lulo');
    if (error) throw new Error(formatErrorMessage(error));
    for (const row of data ?? []) {
      if (row.codigo_lulo && row.id) {
        codigoPartidaToId.set(String(row.codigo_lulo).trim().toUpperCase(), row.id as string);
      }
    }
    partidas += data?.length ?? 0;
  }

  if (codigoPartidaToId.size < partidasParsed.length) {
    const { data: existing } = await supabase.from('lulo_catalogo_partidas').select('id, codigo_lulo');
    for (const row of existing ?? []) {
      if (row.codigo_lulo && row.id) {
        codigoPartidaToId.set(String(row.codigo_lulo).trim().toUpperCase(), row.id as string);
      }
    }
  }

  const insumoCodes = new Set(insumosParsed.map((i) => i.codigo.toUpperCase()));
  const stubs: typeof insumosParsed = [];
  for (const line of apuParsed) {
    const key = line.insumo_codigo.toUpperCase();
    if (!insumoCodes.has(key)) {
      insumoCodes.add(key);
      stubs.push({
        codigo: line.insumo_codigo,
        descripcion: line.insumo_codigo,
        unidad: 'UND',
        tipo: 'Material',
        precio_unitario: 0,
        bono_diario: 0,
      });
    }
  }
  if (stubs.length > 0) {
    const { error } = await supabase.from('lulo_catalogo_insumos').upsert(
      stubs.map((row) => ({ ...row, updated_at: new Date().toISOString() })),
      { onConflict: 'codigo' },
    );
    if (error) throw new Error(formatErrorMessage(error));
    insumos += stubs.length;
  }

  const apuRows: Array<{
    partida_id: string;
    insumo_codigo: string;
    cantidad_diseno: number;
    es_auto_porcentaje: boolean;
  }> = [];

  for (const line of apuParsed) {
    const partida_id = codigoPartidaToId.get(line.codigo_lulo.toUpperCase());
    if (!partida_id) continue;
    apuRows.push({
      partida_id,
      insumo_codigo: line.insumo_codigo,
      cantidad_diseno: line.cantidad_diseno,
      es_auto_porcentaje: line.es_auto_porcentaje,
    });
  }

  let partidaInsumos = 0;
  for (let i = 0; i < apuRows.length; i += BATCH) {
    const batch = apuRows.slice(i, i + BATCH);
    const { error } = await supabase
      .from('lulo_catalogo_partida_insumos')
      .upsert(batch, { onConflict: 'partida_id,insumo_codigo' });
    if (error) throw new Error(formatErrorMessage(error));
    partidaInsumos += batch.length;
  }

  return { capitulos, insumos, partidas, partidaInsumos };
}
