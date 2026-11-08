import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const tableSrc = readFileSync(join(dir, 'ComprasLineasTable.tsx'), 'utf8');
const cssSrc = readFileSync(join(dir, '../../app/globals.css'), 'utf8');

describe('ComprasLineasTable — celdas FECHA / RIF / montos en una línea', () => {
  it('aplica whitespace-nowrap a encabezados Fecha, RIF, P.U., Subtotal, USD y Tasa BCV', () => {
    for (const col of ['fecha', 'rif', 'precioUnitario', 'subtotalBs', 'usd', 'tasaBcv']) {
      const re = new RegExp(`col="${col}"[\\s\\S]*?className="whitespace-nowrap"`);
      assert.match(tableSrc, re, `falta whitespace-nowrap en encabezado ${col}`);
    }
  });

  it('define estilos nowrap con min-width para fecha, RIF y montos', () => {
    assert.match(tableSrc, /const tdFecha: CSSProperties = \{[\s\S]*whiteSpace: 'nowrap'[\s\S]*minWidth: 108/);
    assert.match(tableSrc, /const tdRif: CSSProperties = \{[\s\S]*whiteSpace: 'nowrap'[\s\S]*minWidth: 120/);
    assert.match(tableSrc, /const tdMonto: CSSProperties = \{[\s\S]*whiteSpace: 'nowrap'/);
  });

  it('mantiene el wrap de la tabla con overflow-x y min-width para scroll en tablet', () => {
    assert.match(cssSrc, /\.compras-lineas-table-wrap \{[\s\S]*overflow-x:\s*auto/);
    assert.match(cssSrc, /\.compras-lineas-table-wrap table \{[\s\S]*min-width:\s*1280px/);
    assert.match(
      cssSrc,
      /@media \(min-width: 768px\) and \(max-width: 1180px\) and \(orientation: landscape\) \{[\s\S]*\.compras-lineas-table-wrap table \{[\s\S]*min-width:\s*1280px/,
    );
  });

  it('Ver imagen dispara onVerImagen hacia el modal (no scroll a fila expandida)', () => {
    assert.match(tableSrc, /onVerImagen\?: \(compraId: string\) => void/);
    assert.match(tableSrc, /onClick=\{\(\) => onVerImagen\(row\.pendienteId\)\}/);
  });
});
