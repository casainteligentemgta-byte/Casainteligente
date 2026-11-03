import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { montoFuenteAUsd, costoEgresoLineaUsd } from './montoAUsd';
import {
  calcularDesviacionPresupuestaria,
  construirAlertasDesviacion,
  materialesComprasUsd,
  presupuestoPorCapitulo,
  resolverPresupuestoUsd,
  saludPorConsumo,
  desviacionPct,
} from './calcularDesviacionPresupuestaria';

describe('salud semáforo', () => {
  it('verde <85%, ámbar 85–100%, rojo >100%', () => {
    assert.equal(saludPorConsumo(0), 'verde');
    assert.equal(saludPorConsumo(84.9), 'verde');
    assert.equal(saludPorConsumo(85), 'ambar');
    assert.equal(saludPorConsumo(100), 'ambar');
    assert.equal(saludPorConsumo(100.1), 'rojo');
    assert.equal(saludPorConsumo(114), 'rojo');
  });
});

describe('monto a USD', () => {
  it('usa monto_usd si ya está persistido', () => {
    assert.equal(
      montoFuenteAUsd({
        montoUsd: 120,
        montoVes: 4380,
        moneda: 'VES',
        tasaAlmacenada: 36.5,
        tasaFallback: 40,
      }),
      120,
    );
  });

  it('convierte VES con la tasa del registro, no la de respaldo', () => {
    assert.equal(
      montoFuenteAUsd({
        montoUsd: 0,
        montoVes: 730,
        moneda: 'VES',
        tasaAlmacenada: 36.5,
        tasaFallback: 40,
      }),
      20,
    );
  });

  it('si no hay tasa en el registro, usa BCV de respaldo', () => {
    assert.equal(
      montoFuenteAUsd({
        montoVes: 800,
        moneda: 'VES',
        tasaFallback: 40,
      }),
      20,
    );
  });

  it('respeta factura digitada en USD', () => {
    assert.equal(
      montoFuenteAUsd({
        totalAmount: 55,
        moneda: 'USD',
        tasaFallback: 36.5,
      }),
      55,
    );
  });
});

describe('presupuesto y compras', () => {
  it('prioriza la suma de partidas Lulo', () => {
    const r = resolverPresupuestoUsd({
      partidas: [
        { monto_total_estimado: 8000, capitulo_codigo: '01' },
        { monto_total_estimado: 2000, capitulo_codigo: '02' },
      ],
      montoAproximado: 1,
      obraPrecioVentaUsd: 2,
      obraPresupuestoVes: 999999,
      tasaBcv: 36.5,
    });
    assert.equal(r.presupuestoUsd, 10000);
    assert.equal(r.fuente, 'ci_presupuesto_partidas');
  });

  it('cae a obra_presupuesto_ves / BCV si no hay partidas ni monto', () => {
    const r = resolverPresupuestoUsd({
      partidas: [],
      obraPresupuestoVes: 3650,
      tasaBcv: 36.5,
    });
    assert.equal(r.presupuestoUsd, 100);
    assert.match(r.fuente, /obra_presupuesto_ves/);
  });

  it('suma compras en USD y VES sin duplicar líneas', () => {
    const total = materialesComprasUsd(
      [
        { monto_usd: 100, moneda_original: 'USD' },
        { monto_ves: 730, moneda_original: 'VES', tasa_bcv_ves_por_usd: 36.5 },
      ],
      40,
    );
    assert.equal(total, 120);
  });

  it('valoriza egreso de almacén por costo promedio', () => {
    assert.equal(
      costoEgresoLineaUsd({ cantidad: 4, averageWeightedCost: 12.5, lastPurchasePrice: 9 }),
      50,
    );
  });
});

describe('desviación presupuestaria', () => {
  it('estado verde: ejecutado = labor + materiales + egresos, ~70%', () => {
    const r = calcularDesviacionPresupuestaria({
      proyectoId: 'p-verde',
      proyectoNombre: 'Instalación CCTV Palos Grandes',
      presupuestoUsd: 20000,
      fuentePresupuesto: 'ci_presupuesto_partidas',
      laborUsd: 400,
      materialesUsd: 8000,
      egresosUsd: 5000,
      presupuestoManoObraUsd: 6000,
      presupuestoMaterialesUsd: 14000,
      tasaBcv: 36.5,
    });
    assert.equal(r.gasto_ejecutado_usd, 13400);
    assert.equal(r.pct_consumido, 67);
    assert.equal(r.salud, 'verde');
    assert.equal(r.desviacion_pct, -33);
    assert.equal(r.alertas.length, 0);
  });

  it('estado ámbar: 92% consumido y badge de desviación', () => {
    const r = calcularDesviacionPresupuestaria({
      proyectoId: 'p-ambar',
      proyectoNombre: 'Automatización de red Chacao',
      presupuestoUsd: 15000,
      fuentePresupuesto: 'ci_presupuesto_partidas',
      laborUsd: 500,
      materialesUsd: 8500,
      egresosUsd: 4800,
      presupuestoManoObraUsd: 2000,
      presupuestoMaterialesUsd: 13000,
      tasaBcv: 36.5,
    });
    assert.equal(r.gasto_ejecutado_usd, 13800);
    assert.equal(r.pct_consumido, 92);
    assert.equal(r.salud, 'ambar');
    assert.equal(r.desviacion_pct, -8);
  });

  it('estado rojo >100% y alerta de materiales + jornadas CCTV', () => {
    const r = calcularDesviacionPresupuestaria({
      proyectoId: 'p-rojo',
      proyectoNombre: 'CCTV Centro Empresarial',
      presupuestoUsd: 10000,
      fuentePresupuesto: 'ci_presupuesto_partidas',
      laborUsd: 3200,
      materialesUsd: 6500,
      egresosUsd: 1700,
      presupuestoManoObraUsd: 3000,
      presupuestoMaterialesUsd: 5000,
      umbralPct: 15,
      umbralMaterialesPct: 15,
      umbralManoObraPct: 15,
      limiteJornadasInstalacion: 10,
      especialidadLimite: 'Instalador CCTV',
      jornadasPorEspecialidad: [{ especialidad: 'Instalador CCTV', jornadas: 16, limite: 10 }],
      tasaBcv: 36.5,
    });
    assert.equal(r.gasto_ejecutado_usd, 11400);
    assert.equal(r.pct_consumido, 114);
    assert.equal(r.salud, 'rojo');
    assert.equal(r.desviacion_pct, 14);
    const textos = r.alertas.map((a) => a.mensaje);
    assert.ok(textos.some((t) => /supera el presupuesto estimado/i.test(t)));
    assert.ok(textos.some((t) => /costo de materiales excede el 15%/i.test(t)));
    assert.ok(textos.some((t) => /jornadas de instalación de CCTV superan el límite/i.test(t)));
  });

  it('desglose por capítulo suma partidas', () => {
    const caps = presupuestoPorCapitulo([
      {
        capitulo_codigo: '01',
        capitulo_descripcion: 'Materiales CCTV',
        monto_total_estimado: 5000,
      },
      {
        capitulo_codigo: '01',
        capitulo_descripcion: 'Materiales CCTV',
        monto_total_estimado: 1000,
      },
      {
        capitulo_codigo: '02',
        capitulo_descripcion: 'Instalación CCTV',
        monto_total_estimado: 3000,
      },
    ]);
    assert.equal(caps.length, 2);
    assert.equal(caps.find((c) => c.codigo === '01')?.presupuesto_usd, 6000);
  });

  it('no alerta materiales si la desviación está bajo el umbral', () => {
    const alertas = construirAlertasDesviacion({
      nombreProyecto: 'Obra X',
      desviacionPct: 5,
      umbralPct: 15,
      materialesUsd: 1070,
      presupuestoMaterialesUsd: 1000,
      umbralMaterialesPct: 15,
      laborUsd: 100,
      presupuestoManoObraUsd: 200,
      umbralManoObraPct: 15,
      jornadasPorEspecialidad: [],
      especialidadLimite: 'Instalador CCTV',
      limiteJornadasInstalacion: null,
    });
    assert.equal(alertas.length, 0);
    assert.equal(desviacionPct(1070, 1000), 7);
  });
});
