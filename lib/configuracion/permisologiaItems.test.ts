/**
 * Ejecutar: npx tsx --test lib/configuracion/permisologiaItems.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  nuevoPermisoPersonalizado,
  permisologiaDesdeItems,
  permisosDesdePermisologia,
} from './permisologiaItems';

describe('permisologiaItems', () => {
  it('lee campos legado IVSS/INCES/solvencia', () => {
    const items = permisosDesdePermisologia({
      ivss_vence: '2026-08-01',
      inces_vence: '2026-09-01',
      solvencia_laboral_vence: '2026-10-01',
      ivss_documento_url: 'https://x/ivss.pdf',
    });
    assert.equal(items.length, 3);
    assert.equal(items.find((i) => i.id === 'ivss')?.vence, '2026-08-01');
    assert.equal(items.find((i) => i.id === 'ivss')?.documento_url, 'https://x/ivss.pdf');
  });

  it('incluye permisos personalizados en items', () => {
    const custom = nuevoPermisoPersonalizado('Bomberos');
    custom.vence = '2026-12-01';
    const json = permisologiaDesdeItems([
      { id: 'ivss', nombre: 'IVSS', vence: '2026-08-01', fijo: true },
      custom,
    ]);
    assert.ok(json.items?.some((i) => i.nombre === 'Bomberos'));
    assert.equal(json.ivss_vence, '2026-08-01');
    const back = permisosDesdePermisologia(json);
    assert.ok(back.some((i) => i.nombre === 'Bomberos' && i.vence === '2026-12-01'));
  });
});
