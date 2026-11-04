import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  nombreObraDesdePresupuesto,
  payloadObraDesdePresupuesto,
  puedeConvertirEnObra,
} from './convertirObra';

describe('convertir presupuesto en obra', () => {
  it('solo aprobado / por pagar / pagado', () => {
    assert.equal(puedeConvertirEnObra('aprobado'), true);
    assert.equal(puedeConvertirEnObra('pagado'), true);
    assert.equal(puedeConvertirEnObra('cobrado'), true);
    assert.equal(puedeConvertirEnObra('enviado'), false);
  });

  it('arma el payload con cliente, entidad, budget_id y nombre', () => {
    const r = payloadObraDesdePresupuesto({
      customerId: 'c1',
      entidadId: 'e1',
      budgetId: 'b1',
      nombre: 'Obra Casa López — P-501',
      ubicacion: 'Porlamar',
      montoUsd: 1160,
      status: 'aprobado',
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.payload.customer_id, 'c1');
    assert.equal(r.payload.entidad_id, 'e1');
    assert.equal(r.payload.budget_id, 'b1');
    assert.equal(r.payload.nombre, 'Obra Casa López — P-501');
    assert.equal(r.payload.ubicacion_texto, 'Porlamar');
    assert.equal(r.payload.monto_aproximado, 1160);
    assert.equal(r.payload.tipo_proyecto, 'integral');
  });

  it('exige entidad y cliente', () => {
    const sinEntidad = payloadObraDesdePresupuesto({
      customerId: 'c1',
      entidadId: '',
      budgetId: 'b1',
      nombre: 'X',
      montoUsd: 1,
      status: 'pagado',
    });
    assert.equal(sinEntidad.ok, false);
    const nombre = nombreObraDesdePresupuesto({ cliente: 'López', numero: 501 });
    assert.equal(nombre, 'Obra López — P-501');
  });
});
