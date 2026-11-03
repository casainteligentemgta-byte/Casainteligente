import { test } from 'node:test';
import assert from 'node:assert/strict';
import { botonesResolverLinea, indicesSinMaterialFactura } from './resolverLineasPrecargaTelegram';

test('factura: marca líneas con descripción y sin material, ignora vacías y vinculadas', () => {
  const items = [
    { description: 'Cemento', material_id: 'm1' },
    { description: 'Arena fina' },
    { description: '   ' },
    { description: 'Clavos 2"', material_id: '  ' },
  ];
  assert.deepEqual(indicesSinMaterialFactura(items), [1, 3]);
});

test('nota: no ofrece omitir hacia el depositario', () => {
  const textos = botonesResolverLinea('nota').flat().map((b) => b.text);
  assert.equal(textos.some((t) => /omitir|depositario/i.test(t)), false);
  assert.equal(textos.some((t) => /Buscar en catálogo/.test(t)), true);
});
