import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  OBLIGACIONES_GENERICAS_NUMERADAS,
  obligacionesComplementariasPorOficio,
  textoObligacionesTrabajadorContrato,
} from '@/lib/talento/obligacionesOficioContrato';

describe('obligacionesOficioContrato', () => {
  it('AYUDANTE incluye tareas 6–7 del manual (denominación Gaceta)', () => {
    const c = obligacionesComplementariasPorOficio({ cargoNombre: 'Ayudante', cargoCodigo: '2.1' });
    assert.match(c, /^6\.- Ejecutar las tareas propias del oficio de Ayudante/);
    assert.match(c, /7\.- Aplicar los conocimientos/);
    const full = textoObligacionesTrabajadorContrato({ cargoNombre: 'Ayudante', cargoCodigo: '2.1' });
    assert.ok(full.startsWith(OBLIGACIONES_GENERICAS_NUMERADAS));
    assert.match(full, /Apoyo general en obra/);
  });

  it('CARPINTERO DE 1era. resuelve obligaciones con denominación Gaceta', () => {
    const c = obligacionesComplementariasPorOficio({
      cargoNombre: 'Carpintero de 1era.',
      cargoCodigo: '5.2',
    });
    assert.match(c, /oficio de Carpintero de 1era/);
  });

  it('Albañil de 1ra. tiene complemento', () => {
    const c = obligacionesComplementariasPorOficio({
      cargoNombre: 'Albañil de 1ra.',
      cargoCodigo: '5.1',
    });
    assert.match(c, /Albañil de 1ra/);
    assert.match(c, /Mampostería|paredes/i);
  });

  it('código 1.1 (Obrero de 1era.) sigue funcionando', () => {
    const full = textoObligacionesTrabajadorContrato({
      cargoCodigo: '1.1',
      cargoNombre: 'Obrero de 1era.',
    });
    assert.ok(full.startsWith(OBLIGACIONES_GENERICAS_NUMERADAS));
    assert.match(full, /6\.-/);
  });
});
