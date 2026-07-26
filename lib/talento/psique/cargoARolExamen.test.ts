/**
 * Ejecutar: npx tsx --test lib/talento/psique/cargoARolExamen.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  rolExamenDesdeNombreCargo,
  textoSolicitudDesdeCargo,
} from './cargoARolExamen';

describe('rolExamenDesdeNombreCargo', () => {
  it('mapea oficios de obrero', () => {
    assert.equal(rolExamenDesdeNombreCargo('VIGILANTE', 'obrero'), 'vigilante');
    assert.equal(rolExamenDesdeNombreCargo('ALBAÑIL DE 1ra.', 'obrero'), 'obrero');
    assert.equal(rolExamenDesdeNombreCargo('AYUDANTE DE TOPOGRAFO', 'obrero'), 'tecnico');
  });

  it('mapea cargos de empleado comunes', () => {
    assert.equal(rolExamenDesdeNombreCargo('Contador', 'empleado'), 'empleado');
    assert.equal(rolExamenDesdeNombreCargo('Dibujante / delineante', 'empleado'), 'tecnico');
    assert.equal(rolExamenDesdeNombreCargo('Programador / desarrollador', 'empleado'), 'programador');
  });
});

describe('textoSolicitudDesdeCargo', () => {
  it('incluye código GOE para obrero', () => {
    const t = textoSolicitudDesdeCargo({
      tipoPersonal: 'obrero',
      cargoId: '5.1',
      cargoNombre: 'ALBAÑIL DE 1ra.',
    });
    assert.match(t, /5\.1/);
    assert.match(t, /ALBAÑIL/i);
  });
});
