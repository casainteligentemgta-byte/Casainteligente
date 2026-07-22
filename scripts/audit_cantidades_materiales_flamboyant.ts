/**
 * Auditoría + backfill de cantidades físicas (concreto / cemento / acero)
 * vs stub V4 (cantidad=1 UND).
 *
 * Uso:
 *   npx tsx scripts/audit_cantidades_materiales_flamboyant.ts
 *   npx tsx scripts/audit_cantidades_materiales_flamboyant.ts --apply
 *   npx tsx scripts/audit_cantidades_materiales_flamboyant.ts --json
 *
 * Nota: el V4 a menudo parte el mismo despacho en varias filas con %(6/20/48/100).
 * La columna "inferido_unico" desduplica por descripción sin el %(…); útil vs matriz.
 *
 * Referencia matriz (informativa):
 *   premezclado ≈ 252,73 m³ · cemento ≈ 5 033 sacos
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import {
  clasificarConceptoMaterial,
  esLineaStubV4,
  etiquetaConceptoMaterial,
  parseCantidadDesdeDescripcion,
  type ConceptoMaterial,
} from '../lib/contabilidad/cco/parseCantidadDesdeDescripcion';

const PROYECTO_ID = '171694ed-0ecb-4ec5-82f5-82b980cb261f';
const root = path.join(__dirname, '..');

const MATRIZ_REF: Partial<Record<ConceptoMaterial, { cantidad: number; unidad: string }>> = {
  concreto_premezclado: { cantidad: 252.73, unidad: 'M3' },
  cemento: { cantidad: 5033, unidad: 'SACO' },
};

for (const line of fs.readFileSync(path.join(root, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  if (process.env[m[1].trim()] === undefined) process.env[m[1].trim()] = v;
}

const APPLY = process.argv.includes('--apply');
const AS_JSON = process.argv.includes('--json');

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

type CompraRow = {
  id: string;
  origen: string | null;
  origen_v4_id: number | null;
  notas: string | null;
  supplier_name: string | null;
  monto_usd: number | null;
  tipo_gasto_cco: string | null;
};

type LineaRow = {
  id: string;
  compra_id: string;
  descripcion: string | null;
  cantidad: number | null;
  unidad: string | null;
  precio_unitario: number | null;
  subtotal: number | null;
};

async function allCompras(): Promise<CompraRow[]> {
  const page = 1000;
  const rows: CompraRow[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await sb
      .from('contabilidad_compras')
      .select('id,origen,origen_v4_id,notas,supplier_name,monto_usd,tipo_gasto_cco')
      .eq('proyecto_id', PROYECTO_ID)
      .neq('origen', 'HISTORICO_TABLA')
      .order('id')
      .range(from, from + page - 1);
    if (error) throw new Error(`compras: ${error.message}`);
    const chunk = (data ?? []) as CompraRow[];
    rows.push(...chunk);
    if (chunk.length < page) break;
    from += page;
  }
  return rows;
}

async function allLineas(compraIds: string[]): Promise<LineaRow[]> {
  const rows: LineaRow[] = [];
  const chunkSize = 200;
  for (let i = 0; i < compraIds.length; i += chunkSize) {
    const part = compraIds.slice(i, i + chunkSize);
    let from = 0;
    for (;;) {
      const { data, error } = await sb
        .from('contabilidad_compra_lineas')
        .select('id,compra_id,descripcion,cantidad,unidad,precio_unitario,subtotal')
        .in('compra_id', part)
        .order('id')
        .range(from, from + 999);
      if (error) throw new Error(`lineas: ${error.message}`);
      const chunk = (data ?? []) as LineaRow[];
      rows.push(...chunk);
      if (chunk.length < 1000) break;
      from += 1000;
    }
  }
  return rows;
}

type AggUnidad = {
  filas: number;
  cantidadActual: number;
  cantidadInferida: number;
  stubsV4: number;
  parseables: number;
  usd: number;
};

type AggConcepto = {
  concepto: ConceptoMaterial;
  etiqueta: string;
  porUnidad: Record<string, AggUnidad>;
  porOrigen: Record<string, { filas: number; cantidad: number; usd: number }>;
  ejemplosSinParse: Array<{ desc: string; origen: string; cantidad: number; unidad: string }>;
  propuestas: Array<{
    lineaId: string;
    compraId: string;
    desc: string;
    de: { cantidad: number; unidad: string };
    a: { cantidad: number; unidad: string };
    match: string;
    confianza: string;
  }>;
  /** Clave descripción sin % → cantidad inferida (evita doble conteo por splits). */
  unicosPorDesc: Map<string, { cantidad: number; unidad: string }>;
};

function emptyAgg(concepto: ConceptoMaterial): AggConcepto {
  return {
    concepto,
    etiqueta: etiquetaConceptoMaterial(concepto),
    porUnidad: {},
    porOrigen: {},
    ejemplosSinParse: [],
    propuestas: [],
    unicosPorDesc: new Map(),
  };
}

function claveDescSinPct(texto: string): string {
  return String(texto ?? '')
    .replace(/\(\s*\d{1,3}(?:[.,]\d+)?\s*%\s*\)/g, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function r3(n: number) {
  return Math.round(n * 1000) / 1000;
}

function r2(n: number) {
  return Math.round(n * 100) / 100;
}

async function main() {
  console.error('Cargando compras Flamboyant…');
  const compras = await allCompras();
  const byId = new Map(compras.map((c) => [c.id, c]));
  console.error(`  compras: ${compras.length}`);

  console.error('Cargando líneas…');
  const lineas = await allLineas(compras.map((c) => c.id));
  console.error(`  líneas: ${lineas.length}`);

  const conceptos: ConceptoMaterial[] = [
    'concreto_premezclado',
    'cemento',
    'acero_cabillas',
  ];
  const aggs = new Map<ConceptoMaterial, AggConcepto>(
    conceptos.map((c) => [c, emptyAgg(c)]),
  );

  for (const l of lineas) {
    const compra = byId.get(l.compra_id);
    if (!compra) continue;
    const texto = `${l.descripcion ?? ''} ${compra.notas ?? ''}`;
    const concepto = clasificarConceptoMaterial(texto);
    if (concepto === 'otro') continue;

    const agg = aggs.get(concepto)!;
    const cant = Number(l.cantidad) || 0;
    const und = String(l.unidad ?? 'UND').trim().toUpperCase() || 'UND';
    const origen = String(compra.origen ?? 'desconocido');
    const usd = Number(l.subtotal ?? compra.monto_usd) || 0;

    if (!agg.porUnidad[und]) {
      agg.porUnidad[und] = {
        filas: 0,
        cantidadActual: 0,
        cantidadInferida: 0,
        stubsV4: 0,
        parseables: 0,
        usd: 0,
      };
    }
    const u = agg.porUnidad[und];
    u.filas += 1;
    u.cantidadActual += cant;
    u.usd += usd;

    if (!agg.porOrigen[origen]) {
      agg.porOrigen[origen] = { filas: 0, cantidad: 0, usd: 0 };
    }
    agg.porOrigen[origen].filas += 1;
    agg.porOrigen[origen].cantidad += cant;
    agg.porOrigen[origen].usd += usd;

    const parsed = parseCantidadDesdeDescripcion(texto);
    const stub = esLineaStubV4({
      cantidad: cant,
      unidad: und,
      origen,
    });

    if (parsed) {
      const keyInf = parsed.unidad;
      if (!agg.porUnidad[keyInf]) {
        agg.porUnidad[keyInf] = {
          filas: 0,
          cantidadActual: 0,
          cantidadInferida: 0,
          stubsV4: 0,
          parseables: 0,
          usd: 0,
        };
      }
      // Acumular inferido en la unidad parseada (aunque la fila esté en UND).
      agg.porUnidad[keyInf].cantidadInferida += parsed.cantidad;
      agg.porUnidad[keyInf].parseables += 1;

      const clave = claveDescSinPct(texto);
      if (clave && !agg.unicosPorDesc.has(clave)) {
        agg.unicosPorDesc.set(clave, {
          cantidad: parsed.cantidad,
          unidad: parsed.unidad,
        });
      }
    }

    if (stub) {
      u.stubsV4 += 1;
      if (parsed && (parsed.unidad !== 'UND' || parsed.cantidad !== 1)) {
        agg.propuestas.push({
          lineaId: l.id,
          compraId: l.compra_id,
          desc: String(l.descripcion ?? compra.notas ?? '').slice(0, 120),
          de: { cantidad: cant, unidad: und },
          a: { cantidad: parsed.cantidad, unidad: parsed.unidad },
          match: parsed.match,
          confianza: parsed.confianza,
        });
      } else if (agg.ejemplosSinParse.length < 8) {
        agg.ejemplosSinParse.push({
          desc: String(l.descripcion ?? compra.notas ?? '').slice(0, 140),
          origen,
          cantidad: cant,
          unidad: und,
        });
      }
    }
  }

  const reporte = {
    proyecto_id: PROYECTO_ID,
    modo: APPLY ? 'apply' : 'dry-run',
    matriz_ref: MATRIZ_REF,
    conceptos: [...aggs.values()].map((a) => {
      const ref = MATRIZ_REF[a.concepto];
      const undRef = ref?.unidad;
      const actualMismaUnd = undRef ? a.porUnidad[undRef]?.cantidadActual ?? 0 : null;
      const inferidaMismaUnd = undRef ? a.porUnidad[undRef]?.cantidadInferida ?? 0 : null;
      const stubsUnd = a.porUnidad['UND']?.cantidadActual ?? 0;
      const filasUnd = a.porUnidad['UND']?.filas ?? 0;
      let inferidoUnico = 0;
      let filasUnicas = 0;
      for (const v of a.unicosPorDesc.values()) {
        if (!undRef || v.unidad === undRef) {
          inferidoUnico += v.cantidad;
          filasUnicas += 1;
        }
      }
      // Acero: sumar VAR únicos.
      if (a.concepto === 'acero_cabillas') {
        inferidoUnico = 0;
        filasUnicas = 0;
        for (const v of a.unicosPorDesc.values()) {
          if (v.unidad === 'VAR' || v.unidad === 'TN' || v.unidad === 'KG') {
            inferidoUnico += v.cantidad;
            filasUnicas += 1;
          }
        }
      }
      return {
        concepto: a.concepto,
        etiqueta: a.etiqueta,
        matriz: ref ?? null,
        resumen: {
          filas_und_stub: filasUnd,
          cantidad_en_und: r3(stubsUnd),
          cantidad_actual_unidad_matriz: actualMismaUnd != null ? r3(actualMismaUnd) : null,
          cantidad_inferida_bruta: inferidaMismaUnd != null ? r3(inferidaMismaUnd) : null,
          cantidad_inferida_unica: r3(inferidoUnico),
          descripciones_unicas: filasUnicas,
          delta_vs_matriz_unica:
            ref && undRef ? r3(inferidoUnico - ref.cantidad) : null,
        },
        por_unidad: Object.fromEntries(
          Object.entries(a.porUnidad).map(([k, v]) => [
            k,
            {
              filas: v.filas,
              cantidad_actual: r3(v.cantidadActual),
              cantidad_inferida: r3(v.cantidadInferida),
              stubs_v4: v.stubsV4,
              parseables: v.parseables,
              usd: r2(v.usd),
            },
          ]),
        ),
        por_origen: Object.fromEntries(
          Object.entries(a.porOrigen).map(([k, v]) => [
            k,
            { filas: v.filas, cantidad: r3(v.cantidad), usd: r2(v.usd) },
          ]),
        ),
        propuestas_backfill: a.propuestas.length,
        propuestas_sample: a.propuestas.slice(0, 12),
        stubs_sin_parse_sample: a.ejemplosSinParse,
      };
    }),
  };

  if (AS_JSON) {
    console.log(JSON.stringify(reporte, null, 2));
  } else {
    console.log('\n=== Auditoría cantidades materiales · Rancho Flamboyant ===\n');
    console.log(`Modo: ${APPLY ? 'APPLY (escribirá BD)' : 'dry-run (solo lectura)'}\n`);
    for (const c of reporte.conceptos) {
      console.log(`▸ ${c.etiqueta}`);
      if (c.matriz) {
        console.log(`  Matriz ref: ${c.matriz.cantidad} ${c.matriz.unidad}`);
      }
      console.log(
        `  Actual UND (típico stub V4): ${c.resumen.filas_und_stub} filas · Σ ${c.resumen.cantidad_en_und}`,
      );
      if (c.matriz) {
        console.log(
          `  Inferido bruto ${c.matriz.unidad}: ${c.resumen.cantidad_inferida_bruta}`,
        );
        console.log(
          `  Inferido único (sin doble %): ${c.resumen.cantidad_inferida_unica} · ${c.resumen.descripciones_unicas} desc. (Δ vs matriz ${c.resumen.delta_vs_matriz_unica})`,
        );
      } else if (c.concepto === 'acero_cabillas') {
        console.log(
          `  Inferido único (VAR/TN/KG): ${c.resumen.cantidad_inferida_unica} · ${c.resumen.descripciones_unicas} desc.`,
        );
      }
      console.log('  Por unidad:', JSON.stringify(c.por_unidad));
      console.log('  Por origen:', JSON.stringify(c.por_origen));
      console.log(`  Propuestas backfill: ${c.propuestas_backfill}`);
      for (const p of c.propuestas_sample.slice(0, 5)) {
        console.log(
          `    · ${p.de.cantidad} ${p.de.unidad} → ${p.a.cantidad} ${p.a.unidad}  [${p.match}]  ${p.desc}`,
        );
      }
      if (c.stubs_sin_parse_sample.length) {
        console.log('  Stubs sin cantidad parseable (muestra):');
        for (const e of c.stubs_sin_parse_sample.slice(0, 3)) {
          console.log(`    · ${e.desc}`);
        }
      }
      console.log('');
    }
  }

  const todasPropuestas = [...aggs.values()].flatMap((a) => a.propuestas);
  console.error(`\nPropuestas totales: ${todasPropuestas.length}`);

  if (!APPLY) {
    console.error('Dry-run OK. Para aplicar: npx tsx scripts/audit_cantidades_materiales_flamboyant.ts --apply');
    return;
  }

  if (!todasPropuestas.length) {
    console.error('Nada que aplicar.');
    return;
  }

  let ok = 0;
  let fail = 0;
  for (const p of todasPropuestas) {
    const precio =
      p.a.cantidad > 0
        ? r2(
            (Number(
              lineas.find((x) => x.id === p.lineaId)?.subtotal ??
                byId.get(p.compraId)?.monto_usd ??
                0,
            ) || 0) / p.a.cantidad,
          )
        : 0;
    const { error } = await sb
      .from('contabilidad_compra_lineas')
      .update({
        cantidad: p.a.cantidad,
        unidad: p.a.unidad,
        precio_unitario: precio,
      })
      .eq('id', p.lineaId);
    if (error) {
      fail += 1;
      console.error(`  FAIL ${p.lineaId}: ${error.message}`);
    } else {
      ok += 1;
    }
  }
  console.error(`Apply: ${ok} actualizadas, ${fail} errores.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
