import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DIAS_ALERTA_NOTA_SIN_FACTURA,
  construirMensajeNotasSinFactura,
  diasTranscurridos,
  esNotaEnAlerta,
  fechaCorteAlerta,
} from '@/lib/compras/notasSinFactura';

const AHORA = new Date('2026-10-19T12:00:00Z');
const DIA = 24 * 60 * 60 * 1000;
const hace = (dias: number) => new Date(AHORA.getTime() - dias * DIA).toISOString();

describe('alerta de notas sin factura', () => {
  it('el umbral es 5 días continuos', () => {
    assert.equal(DIAS_ALERTA_NOTA_SIN_FACTURA, 5);
    assert.equal(fechaCorteAlerta(AHORA).toISOString(), hace(5));
  });

  it('no alerta antes de 5 días y sí a partir de 5 (días continuos, no hábiles)', () => {
    assert.equal(esNotaEnAlerta(hace(4.9), AHORA), false);
    assert.equal(esNotaEnAlerta(hace(5), AHORA), true);
    assert.equal(esNotaEnAlerta(hace(12), AHORA), true);
  });

  it('cuenta días completos transcurridos', () => {
    assert.equal(diasTranscurridos(hace(7.5), AHORA), 7);
    assert.equal(diasTranscurridos('fecha-invalida', AHORA), 0);
  });

  it('el mensaje agrupa por obra y lista proveedor y días', () => {
    const msg = construirMensajeNotasSinFactura(
      [
        { id: '1', proyecto_id: 'p1', proveedor_nombre: 'Constructora Atlas S.A.', tipo: 'nota_entrega', num_doc: 'NE-0001', created_at: hace(8), obra: 'Villa Zoita', dias: 8 },
        { id: '2', proyecto_id: 'p1', proveedor_nombre: null, tipo: 'emergencia', num_doc: null, created_at: hace(6), obra: 'Villa Zoita', dias: 6 },
      ],
      'https://app.test',
    );
    assert.match(msg, /2 notas de entrega sin factura/);
    assert.match(msg, /<b>Villa Zoita<\/b>/);
    assert.match(msg, /NE-0001 · Constructora Atlas S\.A\. — <b>8 días<\/b>/);
    assert.match(msg, /Nota sin número — <b>6 días<\/b>/);
    assert.match(msg, /href="https:\/\/app\.test\/contabilidad\/compras"/);
  });

  it('escapa HTML en nombres de proveedor', () => {
    const msg = construirMensajeNotasSinFactura(
      [{ id: '1', proyecto_id: null, proveedor_nombre: '<script>', tipo: 'nota_entrega', num_doc: null, created_at: hace(5), obra: null, dias: 5 }],
      'https://app.test',
    );
    assert.ok(!msg.includes('<script>'));
    assert.match(msg, /&lt;script&gt;/);
  });
});
