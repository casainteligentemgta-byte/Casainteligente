import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  esFuenteTasaBcvConfiable,
  esTasaBcvDelDia,
  etiquetaFuenteTasaBcv,
  obtenerTasaBcvVesPorUsd,
  vaciarCacheTasaBcv,
  type FilaTasaBcv,
} from './bcvTasaPorFecha';
import { estadoTasaParaFechaSolicitada } from './bcvOficial';

describe('fuente de tasa BCV', () => {
  it('ya no ofrece etiqueta de fallback 36.5', () => {
    assert.equal(etiquetaFuenteTasaBcv('fallback').includes('36.5'), false);
    assert.equal(etiquetaFuenteTasaBcv('env'), 'Variable NEXT_PUBLIC_TASA_BCV_VES_POR_USD');
  });

  it('no presenta los agregadores como BCV oficial', () => {
    assert.equal(etiquetaFuenteTasaBcv('bcv.today').includes('oficial'), false);
    assert.equal(etiquetaFuenteTasaBcv('bcv.today_actual').includes('oficial'), false);
    assert.match(etiquetaFuenteTasaBcv('bcv.today'), /Agregador/);
  });

  it('etiqueta www.bcv.org.ve como oficial', () => {
    assert.match(etiquetaFuenteTasaBcv('bcv.org.ve'), /oficial/);
    assert.equal(esFuenteTasaBcvConfiable('bcv.org.ve'), true);
  });
});

describe('estado desactualizada', () => {
  it('una tasa de otra fecha no se trata como la del día', () => {
    const r = {
      fecha: '2026-11-06',
      tasa_bcv_ves_por_usd: 891.1054,
      fuente: 'bcv.org.ve' as const,
      fecha_valor: '2026-11-04',
      estado: estadoTasaParaFechaSolicitada('2026-11-06', '2026-11-04'),
    };
    assert.equal(r.estado, 'desactualizada');
    assert.equal(esTasaBcvDelDia(r, '2026-11-06'), false);
    assert.equal(r.tasa_bcv_ves_por_usd, 891.1054);
  });

  it('la oficial del mismo día sí aplica', () => {
    const r = {
      fecha: '2026-11-06',
      tasa_bcv_ves_por_usd: 896.1225,
      fuente: 'bcv.org.ve' as const,
      fecha_valor: '2026-11-06',
      estado: 'actualizada' as const,
    };
    assert.equal(esTasaBcvDelDia(r, '2026-11-06'), true);
  });
});

type QueryResult = { data: Record<string, unknown> | null; error: null };

function supabaseConHistorial(filas: FilaTasaBcv[]) {
  return {
    from(table: string) {
      assert.equal(table, 'ci_tasas_bcv');
      return {
        select() {
          return {
            eq(_col: string, fecha: string) {
              const fila = filas.find((f) => f.fecha === fecha) ?? null;
              return {
                maybeSingle: async (): Promise<QueryResult> => ({
                  data: fila,
                  error: null,
                }),
              };
            },
            lt(_col: string, fecha: string) {
              const anteriores = filas.filter((f) => f.fecha < fecha).sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
              const fila = anteriores[0] ?? null;
              return {
                order() {
                  return {
                    limit() {
                      return {
                        maybeSingle: async (): Promise<QueryResult> => ({
                          data: fila,
                          error: null,
                        }),
                      };
                    },
                  };
                },
              };
            },
          };
        },
        upsert: async () => ({ error: null }),
      };
    },
  };
}

describe('obtenerTasaBcvVesPorUsd lee ci_tasas_bcv primero', () => {
  it('devuelve la fila exacta del 6 nov (896,1225) y no la del 4', async () => {
    vaciarCacheTasaBcv();
    const supabase = supabaseConHistorial([
      {
        fecha: '2026-11-04',
        usd: 891.1054,
        fuente: 'bcv.org.ve',
        fecha_valor: '2026-11-04',
      },
      {
        fecha: '2026-11-06',
        usd: 896.1225,
        fuente: 'bcv.org.ve',
        fecha_valor: '2026-11-06',
      },
    ]);
    const r = await obtenerTasaBcvVesPorUsd('2026-11-06', {
      supabase: supabase as never,
      skipLive: true,
    });
    assert.equal(r.tasa_bcv_ves_por_usd, 896.1225);
    assert.equal(r.estado, 'actualizada');
    assert.equal(r.fuente, 'bcv.org.ve');
    assert.equal(r.fecha_valor, '2026-11-06');
  });

  it('si piden hoy y solo está el 4 nov, marca desactualizada y no la vende como de hoy', async () => {
    vaciarCacheTasaBcv();
    const supabase = supabaseConHistorial([
      {
        fecha: '2026-11-04',
        usd: 891.1054,
        fuente: 'bcv.org.ve',
        fecha_valor: '2026-11-04',
      },
    ]);
    const r = await obtenerTasaBcvVesPorUsd('2026-11-06', {
      supabase: supabase as never,
      skipLive: true,
    });
    assert.equal(r.tasa_bcv_ves_por_usd, 891.1054);
    assert.equal(r.estado, 'desactualizada');
    assert.equal(r.fecha_valor, '2026-11-04');
    assert.equal(esTasaBcvDelDia(r, '2026-11-06'), false);
  });
});
