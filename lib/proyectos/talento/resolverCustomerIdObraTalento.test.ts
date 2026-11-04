import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  payloadClienteMinimoObraTalento,
  resolverCustomerIdObraTalento,
} from './resolverCustomerIdObraTalento';

describe('resolverCustomerIdObraTalento', () => {
  it('prioriza cliente elegido, luego presupuesto, luego entidad', () => {
    assert.equal(
      resolverCustomerIdObraTalento({
        clienteId: 'c1',
        presupuestoCustomerId: 'c2',
        entidadCustomerId: 'c3',
      }),
      'c1',
    );
    assert.equal(
      resolverCustomerIdObraTalento({
        clienteId: '  ',
        presupuestoCustomerId: 'c2',
        entidadCustomerId: 'c3',
      }),
      'c2',
    );
    assert.equal(
      resolverCustomerIdObraTalento({
        clienteId: null,
        presupuestoCustomerId: null,
        entidadCustomerId: 'c3',
      }),
      'c3',
    );
    assert.equal(
      resolverCustomerIdObraTalento({
        clienteId: null,
        presupuestoCustomerId: '',
        entidadCustomerId: null,
      }),
      null,
    );
  });
});

describe('payloadClienteMinimoObraTalento', () => {
  it('arma un customer con nombre de la obra', () => {
    const p = payloadClienteMinimoObraTalento('Casa Pérez');
    assert.equal(p.nombre, 'Casa Pérez');
    assert.equal(p.status, 'activo');
    assert.equal(p.tipo, 'juridico');
  });
});
