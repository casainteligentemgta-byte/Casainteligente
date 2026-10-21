import { test } from 'node:test';
import assert from 'node:assert/strict';
import { indicesSinMaterialFactura } from './resolverLineasPrecargaTelegram';

test('factura: marca líneas con descripción y sin material, ignora vacías y vinculadas', () => {
  const items = [
    { description: 'Cemento', material_id: 'm1' },
    { description: 'Arena fina' },
    { description: '   ' },
    { description: 'Clavos 2"', material_id: '  ' },
  ];
  assert.deepEqual(indicesSinMaterialFactura(items), [1, 3]);
});
