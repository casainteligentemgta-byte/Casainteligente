import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  aplicarExtraccionAFormulario,
  mimeFacturaGasolina,
  normalizarFechaFactura,
  normalizarLitros,
  normalizarTipoCombustible,
  parseJsonFacturaGasolina,
  parseNumeroVe,
  parsearExtraccionFacturaGasolina,
  type CamposFormularioGasolina,
} from './extractFacturaGasolina';

const VACIO: CamposFormularioGasolina = {
  maquinaria_id: '',
  cantidad_litros: '',
  costo_total: '',
  tipo_gasolina: 'diesel',
  estacion_gasolina: '',
  fecha: '2026-09-08',
  notas: '',
};

describe('extractFacturaGasolina', () => {
  it('parsea números venezolanos y anglosajones', () => {
    assert.equal(parseNumeroVe('1.250,50'), 1250.5);
    assert.equal(parseNumeroVe('1,250.50'), 1250.5);
    assert.equal(parseNumeroVe('25,5 L'), 25.5);
    assert.equal(parseNumeroVe(40), 40);
    assert.equal(parseNumeroVe(''), null);
  });

  it('normaliza fechas DD/MM/AAAA y YYYY-MM-DD', () => {
    assert.equal(normalizarFechaFactura('08/09/2026'), '2026-09-08');
    assert.equal(normalizarFechaFactura('8-9-26'), '2026-09-08');
    assert.equal(normalizarFechaFactura('2026-09-08'), '2026-09-08');
    assert.equal(normalizarFechaFactura('ayer'), null);
  });

  it('normaliza tipo de combustible venezolano', () => {
    assert.equal(normalizarTipoCombustible('Gasolina 91'), 'regular');
    assert.equal(normalizarTipoCombustible('95 premium'), 'premium');
    assert.equal(normalizarTipoCombustible('Gasoil / Diésel'), 'diesel');
    assert.equal(normalizarTipoCombustible('aceite'), null);
  });

  it('convierte galones a litros', () => {
    assert.equal(normalizarLitros('10', 'gal'), 37.85);
    assert.equal(normalizarLitros('40,5', 'L'), 40.5);
    assert.equal(normalizarLitros(0, 'L'), null);
  });

  it('detecta mime por extensión si el type viene vacío', () => {
    assert.equal(mimeFacturaGasolina({ type: '', name: 'ticket.HEIC' }), 'image/heic');
    assert.equal(mimeFacturaGasolina({ type: 'image/jpeg', name: 'a.jpg' }), 'image/jpeg');
    assert.equal(mimeFacturaGasolina({ type: '', name: 'nota.txt' }), null);
  });

  it('parsea JSON con fences o texto alrededor', () => {
    const rec = parseJsonFacturaGasolina('```json\n{"litros": 20}\n```');
    assert.equal(rec.litros, 20);
    const embebido = parseJsonFacturaGasolina('Listo {"estacion":"PDVSA Centro"} fin');
    assert.equal(embebido.estacion, 'PDVSA Centro');
  });

  it('mapea la extracción al formulario y avisa si el monto está en Bs', () => {
    const data = parsearExtraccionFacturaGasolina({
      fecha: '09/09/2026',
      litros: '35,2',
      unidad_volumen: 'L',
      monto_usd: 0,
      monto_bs: '1.250,00',
      estacion: 'PDVSA La California',
      tipo_gasolina: '91',
      placa: 'ab-123-cd',
      es_factura_combustible: true,
    });
    assert.equal(data.fecha, '2026-09-09');
    assert.equal(data.litros, 35.2);
    assert.equal(data.monto_usd, null);
    assert.equal(data.monto_bs, 1250);
    assert.equal(data.tipo_gasolina, 'regular');
    assert.equal(data.placa, 'AB123CD');

    const out = aplicarExtraccionAFormulario(VACIO, data, [
      { id: 'veh-1', placa: 'AB123CD' },
    ]);
    assert.equal(out.form.fecha, '2026-09-09');
    assert.equal(out.form.cantidad_litros, '35.2');
    assert.equal(out.form.estacion_gasolina, 'PDVSA La California');
    assert.equal(out.form.tipo_gasolina, 'regular');
    assert.equal(out.form.maquinaria_id, 'veh-1');
    assert.equal(out.form.costo_total, '');
    assert.match(out.form.notas, /Bs 1250/);
    assert.ok(out.avisos.some((a) => /bolívares/i.test(a)));
    assert.deepEqual(out.campos, ['fecha', 'litros', 'estación', 'tipo', 'unidad']);
  });

  it('usa el monto en USD cuando aparece', () => {
    const out = aplicarExtraccionAFormulario(
      VACIO,
      parsearExtraccionFacturaGasolina({
        fecha: '2026-09-08',
        litros: 20,
        monto_usd: 18.5,
        estacion: 'Estación El Recreo',
        tipo_gasolina: 'diesel',
        es_factura_combustible: true,
      }),
    );
    assert.equal(out.form.costo_total, '18.5');
    assert.ok(out.campos.includes('monto'));
    assert.equal(out.avisos.length, 0);
  });
});
