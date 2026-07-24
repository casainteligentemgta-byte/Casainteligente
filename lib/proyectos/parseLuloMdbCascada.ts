import { clasificarInsumoApu } from '@/lib/proyectos/apuCalculos';
import type { LuloMdbFullDump } from '@/lib/proyectos/extractLuloFull';
import {
  getCapituloKeyPartida,
  mapaCapitulos,
  parseCapitulosDesdeDump,
} from '@/lib/proyectos/luloCapitulos';
import {
  parseLuloMdbEstructurado,
  type LuloEstructuradoParse,
  type LuloInsumoParsed,
} from '@/lib/proyectos/parseLuloMdbEstructurado';
import type { PartidaLuloInsert } from '@/lib/proyectos/parsePresupuestoLuloCsv';
import { montoPartidaDesdeCantidadPrecio } from '@/lib/utils/numericDbLimits';
import { getCapituloKey } from '@/lib/proyectos/luloVistaAgrupada';
import {
  luloMdbHasEstructuraObra,
  prepareLuloMdbDumpForParse,
} from '@/lib/proyectos/loadLuloCsvFolder';

export type ApuItemCascadaInsert = {
  tipo: 'material' | 'mano_obra' | 'equipo';
  codigo_insumo: string;
  descripcion: string;
  unidad: string;
  rendimiento: number;
  costo_unitario: number;
};

export type PartidaCascadaInsert = {
  codigo: string;
  descripcion: string;
  unidad: string;
  cantidad_presupuestada: number;
  precio_unitario: number;
  monto_total: number;
  rendimiento: number;
  apu: ApuItemCascadaInsert[];
};

export type CapituloCascadaInsert = {
  codigo: string;
  nombre: string;
  partidas: PartidaCascadaInsert[];
};

export type LuloMdbCascadaModel = {
  capitulos: CapituloCascadaInsert[];
  tablasUsadas: LuloEstructuradoParse['tablasUsadas'];
  obra: LuloEstructuradoParse['obra'];
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function buildApuItemsForPartida(
  codigoPartida: string,
  apuLines: LuloEstructuradoParse['apu'],
  insumosByCodigo: Map<string, LuloInsumoParsed>,
): ApuItemCascadaInsert[] {
  const key = codigoPartida.trim().toUpperCase();
  const items: ApuItemCascadaInsert[] = [];
  const seen = new Set<string>();

  for (const line of apuLines) {
    if (line.codigo_partida.trim().toUpperCase() !== key) continue;
    const insumoKey = line.codigo_insumo.trim().toUpperCase();
    const dedupe = `${insumoKey}|${line.cantidad_rendimiento}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);

    const insumo = insumosByCodigo.get(insumoKey);
    const tipo = clasificarInsumoApu(insumo?.tipo);
    const precioBase = insumo?.precio_base ?? 0;
    const costoUnitario =
      tipo === 'material' && line.desperdicio_porcentaje > 0
        ? precioBase * (1 + line.desperdicio_porcentaje / 100)
        : precioBase;

    items.push({
      tipo,
      codigo_insumo: line.codigo_insumo.trim(),
      descripcion: (insumo?.descripcion || line.codigo_insumo).trim().slice(0, 500),
      unidad: (insumo?.unidad || 'UND').trim(),
      rendimiento: round4(
        Number(line.cantidad_rendimiento) > 0 ? line.cantidad_rendimiento : 1,
      ),
      costo_unitario: round2(costoUnitario),
    });
  }

  return items;
}

function partidaToCascadaInsert(p: PartidaLuloInsert): PartidaCascadaInsert {
  const cantidad = round2(p.cantidad_presupuestada);
  const precio = round2(Number(p.precio_unitario_estimado ?? 0));
  const monto = montoPartidaDesdeCantidadPrecio(
    cantidad,
    precio,
    Number(p.monto_total_estimado ?? 0) > 0 ? Number(p.monto_total_estimado) : undefined,
  );
  return {
    codigo: p.codigo_partida.trim(),
    descripcion: p.descripcion.trim(),
    unidad: p.unidad.trim() || 'UND',
    cantidad_presupuestada: cantidad,
    precio_unitario: precio,
    monto_total: round2(monto),
    rendimiento: 1,
    apu: [],
  };
}

function groupPartidasByCapitulo(
  partidas: PartidaLuloInsert[],
  capitulosMdb: ReturnType<typeof parseCapitulosDesdeDump>,
): CapituloCascadaInsert[] {
  if (capitulosMdb.length > 0) {
    const mapa = mapaCapitulos(capitulosMdb);
    const buckets = new Map<string, PartidaLuloInsert[]>();
    for (const c of capitulosMdb) {
      buckets.set(c.codigo.trim().toUpperCase(), []);
    }
    const sinCapKey = '__sin_cap__';
    buckets.set(sinCapKey, []);

    for (const p of partidas) {
      const codKey = getCapituloKeyPartida(p).trim().toUpperCase();
      const hit = mapa.get(codKey);
      const bucketKey = hit ? hit.codigo.trim().toUpperCase() : sinCapKey;
      buckets.get(bucketKey)!.push(p);
    }

    const ordered = [...capitulosMdb].sort((a, b) => a.orden - b.orden);
    const out: CapituloCascadaInsert[] = ordered.map((c) => ({
      codigo: c.codigo,
      nombre: c.descripcion,
      partidas: (buckets.get(c.codigo.trim().toUpperCase()) ?? []).map(partidaToCascadaInsert),
    }));

    const sin = buckets.get(sinCapKey);
    if (sin?.length) {
      out.push({
        codigo: '0',
        nombre: 'Sin capítulo',
        partidas: sin.map(partidaToCascadaInsert),
      });
    }
    return out;
  }

  const nombreCap = new Map<string, string>();
  const codigoPorKey = new Map<string, string>();
  const buckets = new Map<string, PartidaLuloInsert[]>();

  for (const p of partidas) {
    const capCod = getCapituloKeyPartida(p);
    const capKey = capCod.trim().toUpperCase();
    const list = buckets.get(capKey) ?? [];
    list.push(p);
    buckets.set(capKey, list);
    if (!nombreCap.has(capKey)) {
      nombreCap.set(capKey, p.capitulo_descripcion?.trim() || `Capítulo ${capCod}`);
    }
  }

  const capitulosOrdenados = Array.from(buckets.keys()).sort((a, b) => {
    const pa = partidas.find((p) => getCapituloKeyPartida(p).toUpperCase() === a);
    const pb = partidas.find((p) => getCapituloKeyPartida(p).toUpperCase() === b);
    const oa = pa?.capitulo_orden ?? 9999;
    const ob = pb?.capitulo_orden ?? 9999;
    if (oa !== ob) return oa - ob;
    return a.localeCompare(b, undefined, { numeric: true });
  });

  return capitulosOrdenados.map((capKey) => {
    const partidasCap = buckets.get(capKey) ?? [];
    const codigoCap =
      codigoPorKey.get(capKey) ||
      getCapituloKeyPartida({
        codigo_partida: partidasCap[0]?.codigo_partida ?? capKey,
        capitulo_codigo: partidasCap[0]?.capitulo_codigo ?? capKey,
      }) ||
      capKey;

    return {
      codigo: codigoCap,
      nombre: nombreCap.get(capKey) ?? `Capítulo ${codigoCap}`,
      partidas: partidasCap.map(partidaToCascadaInsert),
    };
  });
}

/**
 * Convierte el parseo Lulo nativo al modelo en cascada (capítulos → partidas → APU).
 */
export function buildLuloMdbCascadaModel(
  dump: LuloMdbFullDump,
  structured: LuloEstructuradoParse,
): LuloMdbCascadaModel {
  const insumosByCodigo = new Map(
    structured.insumos.map((i) => [i.codigo.trim().toUpperCase(), i]),
  );
  const capitulosMdb = parseCapitulosDesdeDump(dump, {
    codigoObra: structured.obra?.codigo_lulo,
  });
  const capitulos = groupPartidasByCapitulo(structured.partidas, capitulosMdb);

  for (const cap of capitulos) {
    for (const partida of cap.partidas) {
      partida.apu = buildApuItemsForPartida(partida.codigo, structured.apu, insumosByCodigo);
    }
  }

  return {
    capitulos,
    tablasUsadas: structured.tablasUsadas,
    obra: structured.obra,
  };
}

export type ValidacionLuloMdbCascadaResult =
  | { ok: true; model: LuloMdbCascadaModel; structured: LuloEstructuradoParse }
  | { ok: false; errors: string[]; hint?: string; tablasDetectadas?: string[] };

export function parseAndValidateLuloMdbCascada(
  dump: LuloMdbFullDump,
  proyectoId: string,
  opts?: { codigoObra?: string },
): ValidacionLuloMdbCascadaResult {
  const working = prepareLuloMdbDumpForParse(dump, { codigoObra: opts?.codigoObra });
  const structured = parseLuloMdbEstructurado(working, proyectoId, {
    codigoObra: opts?.codigoObra,
  });

  if (!structured || structured.partidas.length === 0) {
    const tablasDetectadas = dump.tables
      .filter((t) => t.rows.length > 0 && !t.name.startsWith('MSys'))
      .map((t) => t.name);
    const tieneObra = luloMdbHasEstructuraObra(dump);
    return {
      ok: false,
      errors: [
        'No se encontró una tabla de partidas/presupuesto reconocible en el MDB.',
        tieneObra
          ? 'Hay tablas Obra* pero faltan partidas (ObraApun / ObraPart / ObraCapiPart) o APU (ObraApin* / ObraPain*).'
          : 'Se esperan tablas PARTIDAS+INSUMOS+COMPOSICION (LuloWin estándar) u ObraApun/ObraCapiPart con ObraMate y ObraApin*.',
      ],
      hint:
        'Exporte el presupuesto desde LuloWin como .mdb sin contraseña. Tablas detectadas: ' +
        (tablasDetectadas.slice(0, 12).join(', ') || 'ninguna') +
        (tablasDetectadas.length > 12 ? ` (+${tablasDetectadas.length - 12} más)` : ''),
      tablasDetectadas,
    };
  }

  const model = buildLuloMdbCascadaModel(working, structured);
  if (model.capitulos.length === 0) {
    return {
      ok: false,
      errors: ['El MDB tiene partidas pero no se pudieron agrupar en capítulos.'],
      hint: 'Verifique que exista la tabla CAPITULOS o códigos de partida con prefijo de capítulo.',
      tablasDetectadas: dump.tables.map((t) => t.name),
    };
  }

  const partidasTotal = model.capitulos.reduce((s, c) => s + c.partidas.length, 0);
  if (partidasTotal === 0) {
    return {
      ok: false,
      errors: ['No hay partidas válidas para importar.'],
      tablasDetectadas: dump.tables.map((t) => t.name),
    };
  }

  return { ok: true, model, structured };
}

/** Resumen de conteos antes de persistir. */
export function contarLuloMdbCascada(model: LuloMdbCascadaModel): {
  capitulos: number;
  partidas: number;
  apuItems: number;
} {
  let partidas = 0;
  let apuItems = 0;
  for (const cap of model.capitulos) {
    partidas += cap.partidas.length;
    for (const p of cap.partidas) apuItems += p.apu.length;
  }
  return { capitulos: model.capitulos.length, partidas, apuItems };
}

export { getCapituloKey };
