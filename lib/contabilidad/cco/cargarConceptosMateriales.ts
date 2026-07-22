/**
 * Resumen consolidado de conceptos de materiales (cantidades físicas + USD).
 * Inferencia desde descripción cuando la línea es stub V4 (1 UND).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { CCO_ORIGEN_HISTORICO, fetchAllRows } from '@/lib/contabilidad/cco/fetchAllRows';
import {
  clasificarConceptoMaterial,
  claveDescSinPct,
  esLineaStubV4,
  etiquetaConceptoMaterial,
  parseCantidadDesdeDescripcion,
  unidadCanonicaConcepto,
  type ConceptoMaterial,
} from '@/lib/contabilidad/cco/parseCantidadDesdeDescripcion';

export type CcoConceptoLineaDetalle = {
  lineaId: string;
  compraId: string;
  fecha: string | null;
  proveedor: string;
  descripcion: string;
  capitulo: string;
  subcapitulo: string;
  origen: string;
  cantidadDb: number;
  unidadDb: string;
  cantidadUsada: number;
  unidadUsada: string;
  fuenteCantidad: 'db' | 'inferida' | 'stub';
  usd: number;
  stubV4: boolean;
};

export type CcoConceptoFila = {
  conceptoId: ConceptoMaterial | string;
  etiqueta: string;
  unidad: string;
  /** Suma de todas las filas (puede duplicar splits %). */
  cantidadBruta: number;
  /** Una vez por descripción sin %(…). */
  cantidadUnica: number;
  descripcionesUnicas: number;
  filas: number;
  stubsV4: number;
  stubsSinParse: number;
  usd: number;
  /** Referencia opcional de la matriz del suegro. */
  matrizRef: number | null;
  porCapitulo: Array<{ capitulo: string; filas: number; cantidadBruta: number; usd: number }>;
  lineas: CcoConceptoLineaDetalle[];
};

export type CcoConceptosMaterialesResult = {
  proyectoId: string;
  totalLineasAnalizadas: number;
  totalConceptos: number;
  stubsPendientes: number;
  conceptos: CcoConceptoFila[];
};

/** Refs informativas (Rancho Flamboyant / matriz V4). */
const MATRIZ_REF: Partial<Record<ConceptoMaterial, number>> = {
  concreto_premezclado: 252.73,
  cemento: 5033,
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function r3(n: number) {
  return Math.round(n * 1000) / 1000;
}

function r2(n: number) {
  return Math.round(n * 100) / 100;
}

type CompraRow = {
  id: string;
  fecha: string | null;
  supplier_name: string | null;
  notas: string | null;
  monto_usd: number | null;
  origen: string | null;
  tipo_gasto_cco: string | null;
  capitulo_cco: string | null;
  subcapitulo_cco: string | null;
};

type LineaRow = {
  id: string;
  compra_id: string;
  descripcion: string | null;
  cantidad: number | null;
  unidad: string | null;
  subtotal: number | null;
};

type Bucket = {
  conceptoId: ConceptoMaterial | string;
  etiqueta: string;
  unidadCanon: string;
  lineas: CcoConceptoLineaDetalle[];
  unicos: Map<string, { cantidad: number; unidad: string }>;
  porCap: Map<string, { filas: number; cantidadBruta: number; usd: number }>;
};

function resolverCantidad(opts: {
  cantidadDb: number;
  unidadDb: string;
  origen: string;
  texto: string;
}): {
  cantidadUsada: number;
  unidadUsada: string;
  fuente: 'db' | 'inferida' | 'stub';
  stub: boolean;
  parsedUnidad: string | null;
  parsedCantidad: number | null;
} {
  const stub = esLineaStubV4({
    cantidad: opts.cantidadDb,
    unidad: opts.unidadDb,
    origen: opts.origen,
  });
  const parsed = parseCantidadDesdeDescripcion(opts.texto);

  if (stub) {
    if (parsed) {
      return {
        cantidadUsada: parsed.cantidad,
        unidadUsada: parsed.unidad,
        fuente: 'inferida',
        stub: true,
        parsedUnidad: parsed.unidad,
        parsedCantidad: parsed.cantidad,
      };
    }
    return {
      cantidadUsada: opts.cantidadDb,
      unidadUsada: opts.unidadDb,
      fuente: 'stub',
      stub: true,
      parsedUnidad: null,
      parsedCantidad: null,
    };
  }

  // Línea ya con unidad física en BD
  const und = opts.unidadDb.toUpperCase();
  if (und !== 'UND' && und !== 'UNID' && und !== 'U' && opts.cantidadDb > 0) {
    return {
      cantidadUsada: opts.cantidadDb,
      unidadUsada: und,
      fuente: 'db',
      stub: false,
      parsedUnidad: parsed?.unidad ?? null,
      parsedCantidad: parsed?.cantidad ?? null,
    };
  }

  // UND no-stub o cantidad rara: preferir parseo si hay unidad física
  if (parsed && parsed.unidad !== 'UND') {
    return {
      cantidadUsada: parsed.cantidad,
      unidadUsada: parsed.unidad,
      fuente: 'inferida',
      stub: false,
      parsedUnidad: parsed.unidad,
      parsedCantidad: parsed.cantidad,
    };
  }

  return {
    cantidadUsada: opts.cantidadDb,
    unidadUsada: und || 'UND',
    fuente: 'db',
    stub: false,
    parsedUnidad: parsed?.unidad ?? null,
    parsedCantidad: parsed?.cantidad ?? null,
  };
}

export async function cargarConceptosMateriales(
  supabase: SupabaseClient,
  proyectoId: string,
): Promise<CcoConceptosMaterialesResult> {
  const { data: compras, error: errC } = await fetchAllRows<CompraRow>(
    () =>
      supabase
        .from('contabilidad_compras')
        .select(
          'id,fecha,supplier_name,notas,monto_usd,origen,tipo_gasto_cco,capitulo_cco,subcapitulo_cco',
        )
        .eq('proyecto_id', proyectoId)
        .neq('origen', CCO_ORIGEN_HISTORICO)
        .order('id', { ascending: true }),
    { maxRows: 50_000 },
  );
  if (errC) throw new Error(errC.message ?? 'Error compras');

  const compraById = new Map((compras ?? []).map((c) => [c.id, c]));
  const compraIds = Array.from(compraById.keys());

  const lineas: LineaRow[] = [];
  const chunk = 200;
  for (let i = 0; i < compraIds.length; i += chunk) {
    const part = compraIds.slice(i, i + chunk);
    const { data, error } = await fetchAllRows<LineaRow>(
      () =>
        supabase
          .from('contabilidad_compra_lineas')
          .select('id,compra_id,descripcion,cantidad,unidad,subtotal')
          .in('compra_id', part)
          .order('id', { ascending: true }),
      { maxRows: 50_000 },
    );
    if (error) throw new Error(error.message ?? 'Error líneas');
    lineas.push(...(data ?? []));
  }

  const buckets = new Map<string, Bucket>();

  const ensure = (
    conceptoId: ConceptoMaterial | string,
    etiqueta: string,
    unidadCanon: string,
  ): Bucket => {
    const key = `${conceptoId}::${unidadCanon}`;
    let b = buckets.get(key);
    if (!b) {
      b = {
        conceptoId,
        etiqueta,
        unidadCanon,
        lineas: [],
        unicos: new Map(),
        porCap: new Map(),
      };
      buckets.set(key, b);
    }
    return b;
  };

  let stubsPendientes = 0;

  for (const l of lineas) {
    const compra = compraById.get(l.compra_id);
    if (!compra) continue;

    const texto = `${l.descripcion ?? ''} ${compra.notas ?? ''}`.trim();
    const concepto = clasificarConceptoMaterial(texto);

    // Solo conceptos conocidos + materiales tipados con parseo físico
    const tipo = String(compra.tipo_gasto_cco ?? '').toUpperCase();
    const esMateriales = tipo.includes('MATERIAL');
    if (concepto === 'otro' && !esMateriales) continue;

    const cantidadDb = num(l.cantidad);
    const unidadDb = String(l.unidad ?? 'UND').trim() || 'UND';
    const origen = String(compra.origen ?? '');
    const resolved = resolverCantidad({ cantidadDb, unidadDb, origen, texto });

    if (concepto === 'otro') {
      // Otros materiales: solo si hay unidad física (no stubs UND sin parseo)
      if (resolved.unidadUsada === 'UND' || resolved.fuente === 'stub') continue;
    }

    const unidadCanon =
      (concepto !== 'otro' ? unidadCanonicaConcepto(concepto) : null) ||
      resolved.unidadUsada;

    // Si es concepto conocido pero la qty está en otra unidad, bucket por unidad usada
    const unidadBucket =
      concepto !== 'otro' &&
      unidadCanonicaConcepto(concepto) &&
      resolved.unidadUsada !== unidadCanonicaConcepto(concepto) &&
      resolved.unidadUsada !== 'UND'
        ? resolved.unidadUsada
        : unidadCanon;

    const etiqueta =
      concepto !== 'otro'
        ? etiquetaConceptoMaterial(concepto)
        : (() => {
            const k = claveDescSinPct(texto);
            return k ? k.slice(0, 48) : 'Otros materiales';
          })();

    const bucketKeyId = concepto !== 'otro' ? concepto : `otro:${claveDescSinPct(texto).slice(0, 40) || 'x'}`;
    const b = ensure(bucketKeyId, etiqueta, unidadBucket);

    if (resolved.stub && resolved.fuente === 'stub') stubsPendientes += 1;

    const detalle: CcoConceptoLineaDetalle = {
      lineaId: l.id,
      compraId: l.compra_id,
      fecha: compra.fecha != null ? String(compra.fecha).slice(0, 10) : null,
      proveedor: String(compra.supplier_name ?? '').trim() || '—',
      descripcion: String(l.descripcion ?? compra.notas ?? '').trim() || '—',
      capitulo: String(compra.capitulo_cco ?? '').trim() || '—',
      subcapitulo: String(compra.subcapitulo_cco ?? '').trim() || '—',
      origen: origen || '—',
      cantidadDb,
      unidadDb,
      cantidadUsada: resolved.cantidadUsada,
      unidadUsada: resolved.unidadUsada,
      fuenteCantidad: resolved.fuente,
      usd: num(l.subtotal) || num(compra.monto_usd),
      stubV4: resolved.stub,
    };
    b.lineas.push(detalle);

    const cap = detalle.capitulo;
    const pc = b.porCap.get(cap) ?? { filas: 0, cantidadBruta: 0, usd: 0 };
    pc.filas += 1;
    if (detalle.unidadUsada === b.unidadCanon) {
      pc.cantidadBruta += detalle.cantidadUsada;
    }
    pc.usd += detalle.usd;
    b.porCap.set(cap, pc);

    if (detalle.unidadUsada === b.unidadCanon || concepto === 'otro') {
      const clave = claveDescSinPct(texto);
      if (clave && !b.unicos.has(clave)) {
        b.unicos.set(clave, {
          cantidad: detalle.cantidadUsada,
          unidad: detalle.unidadUsada,
        });
      }
    }
  }

  const conceptos: CcoConceptoFila[] = Array.from(buckets.values()).map((b: Bucket) => {
    const enCanon = b.lineas.filter((x: CcoConceptoLineaDetalle) => x.unidadUsada === b.unidadCanon);
    const cantidadBruta = enCanon.reduce(
      (s: number, x: CcoConceptoLineaDetalle) => s + x.cantidadUsada,
      0,
    );
    const cantidadUnica = Array.from(b.unicos.values())
      .filter((u) => u.unidad === b.unidadCanon)
      .reduce((s, u) => s + u.cantidad, 0);
    const usd = b.lineas.reduce((s: number, x: CcoConceptoLineaDetalle) => s + x.usd, 0);
    const stubsV4 = b.lineas.filter((x: CcoConceptoLineaDetalle) => x.stubV4).length;
    const stubsSinParse = b.lineas.filter(
      (x: CcoConceptoLineaDetalle) => x.fuenteCantidad === 'stub',
    ).length;
    const conceptoKnown = b.conceptoId as ConceptoMaterial;
    const matrizRef =
      typeof b.conceptoId === 'string' && Object.prototype.hasOwnProperty.call(MATRIZ_REF, b.conceptoId)
        ? MATRIZ_REF[conceptoKnown] ?? null
        : null;

    // Ordenar líneas recientes primero
    const lineasSorted = b.lineas.slice().sort((a, b2) =>
      String(b2.fecha ?? '').localeCompare(String(a.fecha ?? '')),
    );

    return {
      conceptoId: b.conceptoId,
      etiqueta: b.etiqueta,
      unidad: b.unidadCanon,
      cantidadBruta: r3(cantidadBruta),
      cantidadUnica: r3(cantidadUnica),
      descripcionesUnicas: b.unicos.size,
      filas: b.lineas.length,
      stubsV4,
      stubsSinParse,
      usd: r2(usd),
      matrizRef:
        matrizRef != null && b.unidadCanon === unidadCanonicaConcepto(conceptoKnown)
          ? matrizRef
          : null,
      porCapitulo: Array.from(b.porCap.entries())
        .map(([capitulo, v]) => ({
          capitulo,
          filas: v.filas,
          cantidadBruta: r3(v.cantidadBruta),
          usd: r2(v.usd),
        }))
        .sort((a, c) => c.usd - a.usd),
      lineas: lineasSorted.slice(0, 80),
    };
  });

  // Priorizar conceptos conocidos, luego por USD
  const ordenConcepto = (id: string) => {
    if (id === 'concreto_premezclado') return 0;
    if (id === 'cemento') return 1;
    if (id === 'acero_cabillas') return 2;
    return 10;
  };
  conceptos.sort((a, b) => {
    const oa = ordenConcepto(String(a.conceptoId));
    const ob = ordenConcepto(String(b.conceptoId));
    if (oa !== ob) return oa - ob;
    return b.usd - a.usd;
  });

  return {
    proyectoId,
    totalLineasAnalizadas: lineas.length,
    totalConceptos: conceptos.length,
    stubsPendientes,
    conceptos,
  };
}
