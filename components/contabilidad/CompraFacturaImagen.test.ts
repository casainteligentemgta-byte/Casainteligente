import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const imagenSrc = readFileSync(join(dir, 'CompraFacturaImagen.tsx'), 'utf8');
const modalSrc = readFileSync(join(dir, 'CompraFacturaImagenModal.tsx'), 'utf8');
const tableSrc = readFileSync(join(dir, 'ComprasFacturasTable.tsx'), 'utf8');
const lineasSrc = readFileSync(join(dir, 'ComprasLineasTable.tsx'), 'utf8');
const pageSrc = readFileSync(join(dir, '../../app/contabilidad/compras/page.tsx'), 'utf8');

describe('visor modal de factura (Por factura / Por línea)', () => {
  it('carga el documento por el endpoint firmado de compras', () => {
    assert.match(
      imagenSrc,
      /\/api\/contabilidad\/compras\/\$\{encodeURIComponent\(compraId\)\}\/document/,
    );
  });

  it('el visor ajusta imagen y PDF al viewport', () => {
    assert.match(imagenSrc, /variant\?: 'miniatura' \| 'visor'/);
    assert.match(imagenSrc, /maxHeight: 'min\(78dvh, calc\(100vh - 5\.5rem\)\)'/);
    assert.match(imagenSrc, /<iframe src=\{url\}/);
  });

  it('el modal es overlay fijo, centrado, con cierre por botón, backdrop y Esc', () => {
    assert.match(modalSrc, /createPortal/);
    assert.match(modalSrc, /position: 'fixed'/);
    assert.match(modalSrc, /document\.body/);
    assert.match(modalSrc, /e\.key === 'Escape'/);
    assert.match(modalSrc, /onClick=\{onClose\}/);
    assert.match(modalSrc, /aria-label="Cerrar"/);
    assert.match(modalSrc, /variant="visor"/);
  });

  it('Por factura ya no inserta la imagen en una fila expandida colSpan', () => {
    assert.doesNotMatch(tableSrc, /CompraFacturaAdjunto/);
    assert.doesNotMatch(tableSrc, /imagenAbierta && puedeImagen/);
    assert.match(pageSrc, /<CompraFacturaImagenModal/);
    assert.match(tableSrc, /aria-haspopup="dialog"/);
  });

  it('Por línea abre el mismo modal sin cambiar de vista', () => {
    assert.match(lineasSrc, /onVerImagen/);
    assert.doesNotMatch(lineasSrc, /onScrollToCompra/);
    assert.match(pageSrc, /onVerImagen=\{abrirImagenFactura\}/);
  });
});
