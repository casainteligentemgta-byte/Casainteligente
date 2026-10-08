import { describe, it } from 'bun:test';
import assert from 'node:assert/strict';
import {
  FINALIDADES_ANTICIPO,
  esFinalidadAnticipo,
  solicitudAnticipoConFinalidad,
} from '@/lib/nomina/finalidadAnticipo';

describe('finalidad del anticipo de prestaciones (art. 144 LOTTT)', () => {
  it('son las cuatro del artículo 144', () => {
    assert.equal(FINALIDADES_ANTICIPO.length, 4);
    assert.ok(esFinalidadAnticipo('salud'));
    assert.ok(!esFinalidadAnticipo('viaje'));
  });
  it('la solicitud guardada lleva la finalidad', () => {
    const s = solicitudAnticipoConFinalidad('Solicito el anticipo.', 'educacion');
    assert.match(s, /Finalidad \(art\. 144 LOTTT\): Inversión en educación/);
  });
});
