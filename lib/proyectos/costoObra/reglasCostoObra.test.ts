import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  combinarManoObraUsd,
  costoHerramientaUsd,
  diasAsignacionHerramienta,
  esMigracionCostoObraPendiente,
  esObraDemo,
  honorariosAdDeCostoDirecto,
  materialesSinDobleConteoUsd,
  payloadCostoObraVacio,
} from './reglasCostoObra';

describe('esObraDemo', () => {
  it('detecta [DEMO] y prefijo DEMO-', () => {
    assert.equal(esObraDemo('Obra [DEMO] jornales'), true);
    assert.equal(esObraDemo('DEMO-verde'), true);
    assert.equal(esObraDemo('Edificio Las Mercedes'), false);
    assert.equal(esObraDemo(null), false);
  });
});

describe('mano de obra: nómina pagada gana; nunca ambos', () => {
  const nomina = [
    {
      empleado_id: 'e1',
      semana_inicio: '2026-10-27',
      semana_fin: '2026-10-31',
      total_usd: 117,
    },
  ];
  const jornalMismo = { empleado_id: 'e1', fecha: '2026-10-28', costo_jornal: 25 };
  const jornalFuera = { empleado_id: 'e1', fecha: '2026-11-03', costo_jornal: 25 };
  const jornalOtro = { empleado_id: 'e2', fecha: '2026-10-28', costo_jornal: 20 };

  it('si hay nómina pagada, ignora jornales de esa semana y empleado', () => {
    const r = combinarManoObraUsd(nomina, [jornalMismo]);
    assert.equal(r.nominaUsd, 117);
    assert.equal(r.jornalesUsd, 0);
    assert.equal(r.totalUsd, 117);
    assert.equal(r.fuente, 'nomina');
  });

  it('suma jornales de otro periodo o de otro empleado', () => {
    const r = combinarManoObraUsd(nomina, [jornalMismo, jornalFuera, jornalOtro]);
    assert.equal(r.nominaUsd, 117);
    assert.equal(r.jornalesUsd, 45);
    assert.equal(r.totalUsd, 162);
    assert.equal(r.fuente, 'mixto');
  });

  it('sin nómina usa solo jornales', () => {
    const r = combinarManoObraUsd([], [jornalMismo, jornalOtro]);
    assert.equal(r.nominaUsd, 0);
    assert.equal(r.jornalesUsd, 45);
    assert.equal(r.fuente, 'jornales');
  });
});

describe('materiales sin doble conteo', () => {
  const OBRA = 'obra-a';
  it('cuenta compras y solo egresos de almacén ajeno / central', () => {
    const r = materialesSinDobleConteoUsd({
      proyectoId: OBRA,
      comprasUsd: 100,
      egresos: [
        {
          origen_proyecto_id: OBRA,
          cantidad: 4,
          average_weighted_cost: 10,
          last_purchase_price: 9,
        },
        {
          origen_proyecto_id: 'otra',
          cantidad: 2,
          average_weighted_cost: 5,
          last_purchase_price: 1,
        },
        {
          origen_proyecto_id: null,
          cantidad: 3,
          average_weighted_cost: 0,
          last_purchase_price: 4,
        },
      ],
    });
    assert.equal(r.comprasUsd, 100);
    assert.equal(r.egresosAjenosUsd, 22);
    assert.equal(r.totalUsd, 122);
  });
});

describe('herramientas: días × costo diario o arriendo', () => {
  it('cuenta días inclusive hasta hoy si sigue asignada', () => {
    assert.equal(
      diasAsignacionHerramienta({
        fechaAsignacion: '2026-11-01',
        hoy: '2026-11-03',
      }),
      3,
    );
  });

  it('usa fecha de devolución cuando ya volvió', () => {
    assert.equal(
      diasAsignacionHerramienta({
        fechaAsignacion: '2026-11-01',
        fechaDevolucion: '2026-11-02',
        hoy: '2026-11-10',
      }),
      2,
    );
  });

  it('prefiere costo diario sobre arriendo total', () => {
    assert.equal(
      costoHerramientaUsd({
        costoDiario: 10,
        costoArriendo: 999,
        cantidad: 2,
        dias: 3,
      }),
      60,
    );
  });

  it('si no hay diario, usa arriendo USD como total del periodo', () => {
    assert.equal(
      costoHerramientaUsd({
        costoDiario: 0,
        costoArriendo: 150,
        monedaArriendo: 'USD',
        dias: 10,
      }),
      150,
    );
  });
});

describe('honorarios AD: 0 es válido', () => {
  it('config 0 → 0, no 15', () => {
    const r = honorariosAdDeCostoDirecto({
      costoDirectoUsd: 200,
      honorariosAdminPct: 0,
      hayFilaConfig: true,
    });
    assert.equal(r.pct, 0);
    assert.equal(r.usd, 0);
    assert.equal(r.fuente, 'cco_proyecto_config');
  });

  it('sin fila de config → 15 %', () => {
    const r = honorariosAdDeCostoDirecto({
      costoDirectoUsd: 200,
      honorariosAdminPct: null,
      hayFilaConfig: false,
    });
    assert.equal(r.pct, 15);
    assert.equal(r.usd, 30);
    assert.equal(r.fuente, 'default');
  });
});

describe('migración pendiente y payload DEMO', () => {
  it('detecta PGRST202 de ci_costo_obra', () => {
    assert.equal(
      esMigracionCostoObraPendiente('Could not find the function public.ci_costo_obra in the schema cache'),
      true,
    );
    assert.equal(esMigracionCostoObraPendiente('otra cosa'), false);
  });

  it('obra DEMO sale en ceros', () => {
    const p = payloadCostoObraVacio({
      proyectoId: 'x',
      proyectoNombre: '[DEMO] x',
      excluidoDemo: true,
    });
    assert.equal(p.total_directo_usd, 0);
    assert.equal(p.excluido_demo, true);
    assert.equal(p.honorarios_ad.pct, 0);
  });
});
