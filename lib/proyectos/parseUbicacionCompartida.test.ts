/**
 * Ejecutar: npx tsx --test lib/proyectos/parseUbicacionCompartida.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { esUrlCortaMapas, parseUbicacionCompartida } from './parseUbicacionCompartida';

describe('parseUbicacionCompartida', () => {
  it('parsea lat,lng sueltos', () => {
    const r = parseUbicacionCompartida('10.4806, -66.9036');
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.ok(Math.abs(r.lat - 10.4806) < 1e-6);
      assert.ok(Math.abs(r.lng - -66.9036) < 1e-6);
      assert.equal(r.fuente, 'coords');
    }
  });

  it('parsea geo:', () => {
    const r = parseUbicacionCompartida('geo:11.004,-63.867');
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.fuente, 'geo');
      assert.ok(Math.abs(r.lat - 11.004) < 1e-6);
    }
  });

  it('parsea Google Maps @lat,lng', () => {
    const r = parseUbicacionCompartida(
      'https://www.google.com/maps/@10.9578,-63.8492,17z',
    );
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.fuente, 'google_maps');
      assert.ok(Math.abs(r.lat - 10.9578) < 1e-6);
      assert.ok(Math.abs(r.lng - -63.8492) < 1e-6);
    }
  });

  it('parsea q=lat,lng en Google', () => {
    const r = parseUbicacionCompartida('https://maps.google.com/?q=10.5,-66.9');
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.fuente, 'google_maps');
  });

  it('parsea Apple Maps ll=', () => {
    const r = parseUbicacionCompartida('https://maps.apple.com/?ll=10.48,-66.90&q=Obra');
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.fuente, 'apple_maps');
      assert.equal(r.label, 'Obra');
    }
  });

  it('extrae link dentro de mensaje WhatsApp', () => {
    const r = parseUbicacionCompartida(
      'Te mando la obra:\nhttps://www.google.com/maps?q=10.2,-64.5\nGracias',
    );
    assert.equal(r.ok, true);
    if (r.ok) assert.ok(Math.abs(r.lat - 10.2) < 1e-6);
  });

  it('marca short URL', () => {
    const r = parseUbicacionCompartida('https://maps.app.goo.gl/abc123');
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.error, 'SHORT_URL');
    assert.equal(esUrlCortaMapas('https://maps.app.goo.gl/abc123'), true);
  });

  it('dirección escrita → LINK_QUERY', () => {
    const r = parseUbicacionCompartida('Av. Bolívar, Pampatar, Nueva Esparta');
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.error, /^LINK_QUERY:/);
  });
});
