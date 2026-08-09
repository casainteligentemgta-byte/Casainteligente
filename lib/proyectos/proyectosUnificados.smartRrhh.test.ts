import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { esProyectoSmartRrhhPorNombre } from '@/lib/proyectos/proyectosUnificados';

describe('esProyectoSmartRrhhPorNombre', () => {
  it('incluye Asfaltado junto a obras SMART habituales', () => {
    assert.equal(esProyectoSmartRrhhPorNombre('Asfaltado'), true);
    assert.equal(esProyectoSmartRrhhPorNombre('Obra Asfaltado Juan Griego'), true);
    assert.equal(esProyectoSmartRrhhPorNombre('Video de frente'), true);
    assert.equal(esProyectoSmartRrhhPorNombre('Rancho Flamboyant'), true);
  });

  it('no marca obras genéricas como principales', () => {
    assert.equal(esProyectoSmartRrhhPorNombre('Residencias Los Naranjos'), false);
  });
});
