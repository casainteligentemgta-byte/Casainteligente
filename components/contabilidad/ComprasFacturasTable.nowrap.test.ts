import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  COMPRAS_FACTURAS_HEADERS,
  COMPRAS_FACTURAS_HEADERS_PRINCIPALES,
} from '../../lib/contabilidad/comprasFacturasColumnas';

const dir = dirname(fileURLToPath(import.meta.url));
const tableSrc = readFileSync(join(dir, 'ComprasFacturasTable.tsx'), 'utf8');
const cssSrc = readFileSync(join(dir, '../../app/globals.css'), 'utf8');
const pageSrc = readFileSync(join(dir, '../../app/contabilidad/compras/page.tsx'), 'utf8');

describe('ComprasFacturasTable — vista Por factura', () => {
  it('pone las columnas principales en el orden pedido (total de factura, no P.U.)', () => {
    assert.deepEqual([...COMPRAS_FACTURAS_HEADERS_PRINCIPALES], [
      'Fecha',
      'Nº factura',
      'Proveedor',
      'RIF',
      'Total (Bs)',
      'USD',
      'Entidad',
      'Almacén',
      'Proyecto',
      'Ver imagen',
      'Acciones',
    ]);
    assert.ok(COMPRAS_FACTURAS_HEADERS.includes('Tasa BCV'));
    assert.ok(COMPRAS_FACTURAS_HEADERS.includes('Días crédito'));
    assert.ok(COMPRAS_FACTURAS_HEADERS.includes('Vencimiento'));
    assert.ok(COMPRAS_FACTURAS_HEADERS.includes('Estado'));
    assert.ok(!COMPRAS_FACTURAS_HEADERS.includes('P.U.'));
  });

  it('aplica nowrap a Fecha, RIF y celdas de dinero', () => {
    assert.match(tableSrc, /tdFecha[\s\S]*whiteSpace: 'nowrap'/);
    assert.match(tableSrc, /tdRif[\s\S]*whiteSpace: 'nowrap'/);
    assert.match(tableSrc, /tdMonto[\s\S]*whiteSpace: 'nowrap'/);
    assert.match(tableSrc, /className="whitespace-nowrap"/);
  });

  it('mantiene overflow-x para scroll horizontal en tablet', () => {
    assert.match(tableSrc, /compras-facturas-table-wrap/);
    assert.match(cssSrc, /\.compras-facturas-table-wrap table \{[\s\S]*min-width:\s*1680px/);
    assert.match(cssSrc, /\.compras-lineas-table-wrap \{[\s\S]*overflow-x:\s*auto/);
  });

  it('la página Por factura usa la tabla y no la grilla de tarjetas', () => {
    assert.match(pageSrc, /<ComprasFacturasTable/);
    assert.doesNotMatch(pageSrc, /compras-facturas-grid/);
  });
});
