import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { procesarComandoTelegram } from '@/lib/telegram/commands';
import {
  TELEGRAM_BOT_COMMANDS,
  TELEGRAM_BOT_COMMANDS_COMPRADOR,
  mensajeAyudaTelegram,
  mensajeMenuTelegram,
} from '@/lib/telegram/botCommands';
import { esCallbackCredito, esFlujoCreditoPago } from '@/lib/telegram/creditoTelegram';
import { avisoPagoAdminTelegram } from '@/lib/contabilidad/creditoPagos';
import { creditosParaRecordarHoy, mensajeRecordatorioCredito } from '@/lib/contabilidad/creditoRecordatorios';
import type { CreditoAbierto } from '@/lib/contabilidad/creditoPagos';

function credito(partial: Partial<CreditoAbierto> = {}): CreditoAbierto {
  return {
    purchaseInvoiceId: '11111111-1111-4111-8111-111111111111',
    contabilidadCompraId: null,
    proveedor: 'SMART electric',
    numeroFactura: '99',
    entidadId: 'e1',
    entidadNombre: 'Tecnología',
    proyectoId: null,
    fechaVencimiento: '2026-11-11',
    diasCredito: 7,
    totalUsd: 100,
    pagadoUsd: 0,
    saldoUsd: 100,
    diasHasta: 0,
    estado: 'por_pagar',
    ...partial,
  };
}

describe('comando /credito', () => {
  it('se reconoce', () => {
    const r = procesarComandoTelegram('/credito');
    assert.equal(r.handled, true);
    assert.equal(r.comandoCredito, true);
    assert.equal(procesarComandoTelegram('/creditos').comandoCredito, true);
  });

  it('aparece en el menú de compras y del comprador', () => {
    assert.ok(TELEGRAM_BOT_COMMANDS.some((c) => c.command === 'credito'));
    assert.ok(TELEGRAM_BOT_COMMANDS_COMPRADOR.some((c) => c.command === 'credito'));
    assert.match(mensajeMenuTelegram(), /\/credito/);
    assert.match(mensajeMenuTelegram({ comprador: true }), /\/credito/);
    assert.match(mensajeAyudaTelegram(), /\/credito/);
    assert.match(mensajeAyudaTelegram({ comprador: true }), /\/credito/);
    assert.doesNotMatch(mensajeMenuTelegram({ depositario: true }), /\/credito/);
  });

  it('callbacks usan el prefijo cr:', () => {
    assert.equal(esCallbackCredito('cr:p:11111111-1111-4111-8111-111111111111'), true);
    assert.equal(esCallbackCredito('cr:l:0'), true);
    assert.equal(esCallbackCredito('fe:1'), false);
  });

  it('flujo de pago se detecta por contexto o metadata', () => {
    assert.equal(esFlujoCreditoPago({ contexto: 'credito_pago', metadata: {} }), true);
    assert.equal(esFlujoCreditoPago({ contexto: 'menu', metadata: { flujo: 'credito_pago' } }), true);
    assert.equal(esFlujoCreditoPago({ contexto: 'factura', metadata: {} }), false);
  });
});

describe('aviso de pago y recordatorio', () => {
  it('el aviso al admin no se rompe con HTML especial', () => {
    assert.equal(
      avisoPagoAdminTelegram({ proveedor: 'A & B', numero: '1', montoUsd: 10, nombre: 'Luis' }),
      '✅ Pagado: A & B 1 · US$10.00 · por Luis',
    );
  });

  it('elige 3 días, hoy y vencidos', () => {
    const items = creditosParaRecordarHoy(
      [
        credito({ diasHasta: 3, purchaseInvoiceId: 'a' }),
        credito({ diasHasta: 0, purchaseInvoiceId: 'b' }),
        credito({ diasHasta: -1, purchaseInvoiceId: 'c', estado: 'vencido' }),
        credito({ diasHasta: 2, purchaseInvoiceId: 'd' }),
      ],
      true,
    );
    assert.deepEqual(
      items.map((x) => x.tipo),
      ['3_dias', 'vencimiento', 'vencido'],
    );
    assert.equal(creditosParaRecordarHoy(items.map((x) => x.credito), false).length, 2);
  });

  it('mensaje de recordatorio incluye el botón Pagado vía teclado aparte', () => {
    const html = mensajeRecordatorioCredito(credito({ diasHasta: 3 }), '3_dias');
    assert.match(html, /vence en 3 días/);
    assert.match(html, /SMART electric/);
    assert.match(html, /US\$100\.00/);
  });
});
