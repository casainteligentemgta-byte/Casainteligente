import { test } from 'node:test';
import assert from 'node:assert/strict';
import { purchaseInvoiceDeMovimiento } from './listarTrazabilidadEstrategica';
import type { ContextoEnriquecimientoTrazabilidad } from './trazabilidadTiposCuadro';

function ctxVacio(): ContextoEnriquecimientoTrazabilidad {
  return {
    comprasFactura: new Map(),
    recepcion: new Map(),
    transferencia: new Map(),
    contabilidadPorInvoice: new Map(),
  } as unknown as ContextoEnriquecimientoTrazabilidad;
}

function mov(p: Partial<Record<string, string | null>>) {
  return {
    id: 'm1',
    documento_id: null,
    referencia_tipo: null,
    referencia_id: null,
    ...p,
  } as never;
}

test('usa documento_id cuando existe', () => {
  assert.equal(purchaseInvoiceDeMovimiento(mov({ documento_id: 'pi-1' }), ctxVacio()), 'pi-1');
});

test('referencia purchase_invoice sin documento_id', () => {
  assert.equal(
    purchaseInvoiceDeMovimiento(mov({ referencia_tipo: 'purchase_invoice', referencia_id: 'pi-2' }), ctxVacio()),
    'pi-2',
  );
});

test('referencia compras_factura se resuelve con el contexto', () => {
  const ctx = ctxVacio();
  ctx.comprasFactura.set('cf-1', {
    id: 'cf-1',
    numero_factura: '1',
    purchase_invoice_id: 'pi-3',
    contabilidad_id: null,
  } as never);
  assert.equal(
    purchaseInvoiceDeMovimiento(mov({ referencia_tipo: 'compras_factura', referencia_id: 'cf-1' }), ctx),
    'pi-3',
  );
});

test('sin referencia no hay factura', () => {
  assert.equal(purchaseInvoiceDeMovimiento(mov({ referencia_tipo: 'ajuste' }), ctxVacio()), null);
});
