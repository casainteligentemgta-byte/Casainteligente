import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  armarCreditosAbiertos,
  avisoPagoAdminTelegram,
  creditoQuedaPagado,
  creditoVisibleEnAlcance,
  diasHastaVencimiento,
  estadoPagoCredito,
  etiquetaEstadoPagoCredito,
  formatearUsdCorto,
  htmlAnexoCreditosVencidos,
  lineaListaCreditoTelegram,
  montoUsdCredito,
  ordenarCreditosPorVencimiento,
  paginaCreditos,
  resumenPagoCompra,
  rolTelegramPuedeCredito,
  saldoCredito,
  textoBotonPagadoCredito,
  textoPlazoCredito,
  tipoRecordatorioCredito,
  validarMontoPago,
  type CreditoAbierto,
} from './creditoPagos';

const HOY = '2026-11-11';

function credito(partial: Partial<CreditoAbierto> = {}): CreditoAbierto {
  return {
    purchaseInvoiceId: '11111111-1111-4111-8111-111111111111',
    contabilidadCompraId: 'c1',
    proveedor: 'SMART electric',
    numeroFactura: '4521',
    entidadId: 'e1',
    entidadNombre: 'Tecnología',
    proyectoId: null,
    fechaVencimiento: '2026-11-10',
    diasCredito: 15,
    totalUsd: 1200,
    pagadoUsd: 0,
    saldoUsd: 1200,
    diasHasta: -1,
    estado: 'vencido',
    ...partial,
  };
}

describe('montos y saldo de crédito', () => {
  it('prefiere monto_usd y deja saldo en céntimos', () => {
    assert.equal(montoUsdCredito({ monto_usd: 10.006, total_amount_usd: 99 }), 10.01);
    assert.equal(saldoCredito(100, 40.555), 59.45);
    assert.equal(creditoQuedaPagado(100, 99.995), true);
    assert.equal(creditoQuedaPagado(100, 99.98), false);
  });

  it('usa total_amount si la moneda es USD', () => {
    assert.equal(montoUsdCredito({ total_amount: 50, moneda: 'USD' }), 50);
  });
});

describe('vencimiento', () => {
  it('cuenta días civiles y etiqueta el plazo', () => {
    assert.equal(diasHastaVencimiento('2026-11-14', HOY), 3);
    assert.equal(diasHastaVencimiento('2026-11-11', HOY), 0);
    assert.equal(diasHastaVencimiento('2026-11-10', HOY), -1);
    assert.equal(textoPlazoCredito(3), 'faltan 3 días');
    assert.equal(textoPlazoCredito(1), 'faltan 1 día');
    assert.equal(textoPlazoCredito(0), 'vence hoy');
    assert.equal(textoPlazoCredito(-1), 'vencido hace 1 día');
    assert.equal(textoPlazoCredito(-8), 'vencido hace 8 días');
  });

  it('estado: pagado gana a vencido; si no, vencido o por pagar', () => {
    assert.equal(estadoPagoCredito({ saldoUsd: 0, diasHasta: -4 }), 'pagado');
    assert.equal(estadoPagoCredito({ saldoUsd: 10, diasHasta: -1 }), 'vencido');
    assert.equal(estadoPagoCredito({ saldoUsd: 10, diasHasta: 0 }), 'por_pagar');
    assert.equal(estadoPagoCredito({ saldoUsd: 10, diasHasta: 5 }), 'por_pagar');
    assert.equal(etiquetaEstadoPagoCredito('vencido'), 'Vencido');
  });

  it('recordatorio: 3 días, el día y vencido', () => {
    assert.equal(tipoRecordatorioCredito(3), '3_dias');
    assert.equal(tipoRecordatorioCredito(0), 'vencimiento');
    assert.equal(tipoRecordatorioCredito(-2), 'vencido');
    assert.equal(tipoRecordatorioCredito(1), null);
    assert.equal(tipoRecordatorioCredito(2), null);
  });
});

describe('permisos y alcance', () => {
  it('solo comprador, administrador y contador en Telegram', () => {
    assert.equal(rolTelegramPuedeCredito('Comprador'), true);
    assert.equal(rolTelegramPuedeCredito('Administrador'), true);
    assert.equal(rolTelegramPuedeCredito('Contador'), true);
    assert.equal(rolTelegramPuedeCredito('Solicitante'), false);
    assert.equal(rolTelegramPuedeCredito('Aprobador'), false);
  });

  it('el admin general ve todos; el resto solo sus entidades', () => {
    assert.equal(creditoVisibleEnAlcance('e1', { todas: true, entidadIds: [] }), true);
    assert.equal(creditoVisibleEnAlcance(null, { todas: true, entidadIds: [] }), true);
    assert.equal(creditoVisibleEnAlcance('e1', { todas: false, entidadIds: ['e1', 'e2'] }), true);
    assert.equal(creditoVisibleEnAlcance('e9', { todas: false, entidadIds: ['e1'] }), false);
    assert.equal(creditoVisibleEnAlcance(null, { todas: false, entidadIds: ['e1'] }), false);
  });
});

describe('armar créditos abiertos', () => {
  it('omite los ya pagados, ordena por vencimiento y aplica alcance', () => {
    const items = armarCreditosAbiertos({
      hoyIso: HOY,
      alcance: { todas: false, entidadIds: ['e1'] },
      nombresEntidad: { e1: 'Tecnología', e2: 'Otra' },
      facturas: [
        {
          id: 'f1',
          invoice_number: 'A-1',
          supplier_name: 'SMART electric',
          entidad_id: 'e1',
          fecha_vencimiento: '2026-11-10',
          monto_usd: 200,
        },
        {
          id: 'f2',
          invoice_number: 'B-2',
          supplier_name: 'Ferre',
          entidad_id: 'e1',
          fecha_vencimiento: '2026-11-20',
          monto_usd: 50,
        },
        {
          id: 'f3',
          invoice_number: 'C-3',
          supplier_name: 'Otra entidad',
          entidad_id: 'e2',
          fecha_vencimiento: '2026-11-09',
          monto_usd: 999,
        },
        {
          id: 'f4',
          invoice_number: 'D-4',
          supplier_name: 'Pagada',
          entidad_id: 'e1',
          fecha_vencimiento: '2026-11-01',
          monto_usd: 80,
        },
      ],
      compras: [
        { id: 'c1', purchase_invoice_id: 'f1', entidad_id: 'e1', monto_usd: 200, invoice_number: 'A-1' },
      ],
      pagos: [
        { purchase_invoice_id: 'f4', monto_usd: 80 },
        { purchase_invoice_id: 'f1', monto_usd: 50 },
      ],
    });
    assert.deepEqual(
      items.map((c) => c.purchaseInvoiceId),
      ['f1', 'f2'],
    );
    assert.equal(items[0].saldoUsd, 150);
    assert.equal(items[0].estado, 'vencido');
    assert.equal(items[0].entidadNombre, 'Tecnología');
    assert.equal(items[1].estado, 'por_pagar');
  });
});

describe('textos Telegram', () => {
  it('aviso corto al administrador general', () => {
    assert.equal(
      avisoPagoAdminTelegram({
        proveedor: 'SMART electric',
        numero: '4521',
        montoUsd: 1200,
        nombre: 'Ana',
      }),
      '✅ Pagado: SMART electric 4521 · US$1,200.00 · por Ana',
    );
  });

  it('lista con plazo y botón Pagado', () => {
    const linea = lineaListaCreditoTelegram(credito(), 1);
    assert.match(linea, /SMART electric/);
    assert.match(linea, /#4521/);
    assert.match(linea, /Tecnología/);
    assert.match(linea, /vencido hace 1 día/);
    assert.equal(textoBotonPagadoCredito(credito()), 'Pagado · SMART electric #4521');
  });
});

describe('paginación y validación de abono', () => {
  it('parte de a 5 y corrige la página', () => {
    const items = Array.from({ length: 12 }, (_, i) => i);
    assert.equal(paginaCreditos(items, 0).slice.length, 5);
    assert.equal(paginaCreditos(items, 2).slice.length, 2);
    assert.equal(paginaCreditos(items, 99).page, 2);
    assert.equal(paginaCreditos(items, 2).totalPages, 3);
  });

  it('rechaza monto 0 o mayor al saldo', () => {
    assert.equal(validarMontoPago(0, 10), 'El monto debe ser mayor a 0.');
    assert.equal(validarMontoPago(10.02, 10), 'El monto supera el saldo.');
    assert.equal(validarMontoPago(10, 10), null);
  });
});

describe('resumen en el cuadro de compras', () => {
  it('contado no muestra estado de pago', () => {
    assert.equal(resumenPagoCompra({ condicionPago: 'contado', pagadoUsd: 0, totalUsd: 10, hoyIso: HOY }).estado, null);
  });

  it('crédito abierto vencido vs pagado', () => {
    const v = resumenPagoCompra({
      condicionPago: 'credito',
      fechaVencimiento: '2026-11-10',
      pagadoUsd: 0,
      totalUsd: 10,
      hoyIso: HOY,
    });
    assert.equal(v.estado, 'vencido');
    const p = resumenPagoCompra({
      condicionPago: 'credito',
      fechaVencimiento: '2026-11-10',
      pagadoUsd: 10,
      totalUsd: 10,
      hoyIso: HOY,
    });
    assert.equal(p.estado, 'pagado');
  });
});

describe('ordenar por vencimiento', () => {
  it('sin fecha al final', () => {
    const a = credito({ purchaseInvoiceId: 'a', fechaVencimiento: null, proveedor: 'Z' });
    const b = credito({ purchaseInvoiceId: 'b', fechaVencimiento: '2026-11-01', proveedor: 'A' });
    assert.equal(ordenarCreditosPorVencimiento([a, b])[0].purchaseInvoiceId, 'b');
  });
});

describe('formato USD', () => {
  it('usa miles en inglés', () => {
    assert.equal(formatearUsdCorto(6412), '6,412.00');
  });
});

describe('anexo de vencidos en alerta diaria', () => {
  it('lista vencidos y omite los que aún no vencen', () => {
    const html = htmlAnexoCreditosVencidos([
      credito(),
      credito({
        purchaseInvoiceId: 'x',
        estado: 'por_pagar',
        diasHasta: 3,
        proveedor: 'Ferre',
        numeroFactura: '1',
      }),
    ]);
    assert.match(html, /Créditos vencidos/);
    assert.match(html, /SMART electric/);
    assert.match(html, /hace 1 día/);
    assert.doesNotMatch(html, /Ferre/);
    assert.equal(htmlAnexoCreditosVencidos([credito({ estado: 'por_pagar', diasHasta: 2 })]), '');
  });
});
