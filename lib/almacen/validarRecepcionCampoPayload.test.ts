import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validarRequisitosNotaEntrega } from './validarRecepcionCampoPayload';

describe('requisitos de nota de entrega', () => {
  it('exige proveedor y foto en nota', () => {
    assert.equal(
      validarRequisitosNotaEntrega({ tipo: 'nota_entrega', proveedorNombre: '', soportePath: 'x' }),
      'Indique el proveedor de la nota de entrega.',
    );
    assert.equal(
      validarRequisitosNotaEntrega({
        tipo: 'nota_entrega',
        proveedorNombre: 'Ferretería',
        soportePath: '',
      }),
      'Adjunte la foto de la nota de entrega.',
    );
    assert.equal(
      validarRequisitosNotaEntrega({
        tipo: 'nota_entrega',
        proveedorNombre: 'Ferretería',
        soportePath: 'frm/foto.jpg',
      }),
      null,
    );
  });

  it('no exige foto/proveedor en emergencia ni factura canal', () => {
    assert.equal(
      validarRequisitosNotaEntrega({ tipo: 'emergencia', proveedorNombre: '', soportePath: '' }),
      null,
    );
    assert.equal(
      validarRequisitosNotaEntrega({ tipo: 'factura_canal', proveedorNombre: '', soportePath: '' }),
      null,
    );
  });
});
