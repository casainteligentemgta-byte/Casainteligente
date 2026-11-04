import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cargarCostoObra, normalizarCostoObra } from './cargarCostoObra';

describe('normalizarCostoObra', () => {
  it('rellena números y detalle desde el JSON del RPC', () => {
    const p = normalizarCostoObra(
      {
        proyecto_id: 'p1',
        proyecto_nombre: 'Obra Norte',
        excluido_demo: false,
        partidas: {
          materiales: { usd: 100.1, compras_usd: 80, egresos_ajenos_usd: 20.1, detalle: [{ tipo: 'compra', label: 'Ferretería', usd: 80 }] },
          mano_obra: { usd: 50, fuente: 'nomina', nomina_usd: 50, jornales_usd: 0, detalle: [] },
          herramientas: { usd: 10, detalle: [] },
          otros: { usd: 5, gastos_obra_usd: 5, registros_gastos_usd: 0, detalle: [] },
        },
        honorarios_ad: { pct: 0, usd: 0, fuente: 'cco_proyecto_config' },
        total_directo_usd: 165.1,
        total_con_honorarios_ad_usd: 165.1,
      },
      'p1',
    );
    assert.equal(p.partidas.materiales.usd, 100.1);
    assert.equal(p.partidas.materiales.detalle[0]?.label, 'Ferretería');
    assert.equal(p.honorarios_ad.pct, 0);
    assert.equal(p.total_directo_usd, 165.1);
  });
});

describe('cargarCostoObra', () => {
  it('llama ci_costo_obra y normaliza', async () => {
    const supabase = {
      rpc: async (nombre: string, args: { p_proyecto_id: string }) => {
        assert.equal(nombre, 'ci_costo_obra');
        assert.equal(args.p_proyecto_id, 'obra-1');
        return {
          data: {
            proyecto_id: 'obra-1',
            proyecto_nombre: 'Casa',
            partidas: {
              materiales: { usd: 1, compras_usd: 1, egresos_ajenos_usd: 0, detalle: [] },
              mano_obra: { usd: 2, fuente: 'jornales', nomina_usd: 0, jornales_usd: 2, detalle: [] },
              herramientas: { usd: 0, detalle: [] },
              otros: { usd: 0, gastos_obra_usd: 0, registros_gastos_usd: 0, detalle: [] },
            },
            honorarios_ad: { pct: 15, usd: 0.45, fuente: 'default' },
            total_directo_usd: 3,
            total_con_honorarios_ad_usd: 3.45,
          },
          error: null,
        };
      },
    };
    const r = await cargarCostoObra(supabase as never, 'obra-1');
    assert.equal(r.proyecto_nombre, 'Casa');
    assert.equal(r.partidas.mano_obra.fuente, 'jornales');
    assert.equal(r.total_con_honorarios_ad_usd, 3.45);
  });

  it('si falta el RPC, pide la migración 395', async () => {
    const supabase = {
      rpc: async () => ({
        data: null,
        error: { message: 'Could not find the function public.ci_costo_obra in the schema cache' },
      }),
    };
    await assert.rejects(
      () => cargarCostoObra(supabase as never, 'obra-1'),
      /395_ci_costo_obra/,
    );
  });
});
