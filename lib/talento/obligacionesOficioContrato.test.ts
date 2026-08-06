import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  OBLIGACIONES_GENERICAS_NUMERADAS,
  obligacionesComplementariasPorOficio,
  textoObligacionesTrabajadorContrato,
} from '@/lib/talento/obligacionesOficioContrato';

describe('obligacionesOficioContrato', () => {
  it('AYUDANTE (raso) incluye tareas 6–7 del manual', () => {
    const c = obligacionesComplementariasPorOficio({ cargoNombre: 'AYUDANTE' });
    assert.match(c, /^6\.- Ejecutar las tareas propias del oficio de Ayudante/);
    assert.match(c, /7\.- Aplicar los conocimientos/);
    const full = textoObligacionesTrabajadorContrato({ cargoNombre: 'AYUDANTE' });
    assert.ok(full.startsWith(OBLIGACIONES_GENERICAS_NUMERADAS));
    assert.match(full, /Apoyo general en obra/);
  });

  it('CARPINTERO DE 1era. usa ficha rasa (sin grado en el texto)', () => {
    const c = obligacionesComplementariasPorOficio({
      cargoNombre: 'Carpintero de 1era.',
      cargoCodigo: '5.2',
    });
    assert.match(c, /oficio de Carpintero/);
    assert.doesNotMatch(c, /1era/);
  });

  it('ALBAÑIL raso tiene complemento', () => {
    const c = obligacionesComplementariasPorOficio({ cargoNombre: 'ALBAÑIL' });
    assert.match(c, /Albañil/);
    assert.match(c, /Mampostería|mampostería|paredes/i);
  });

  it('código 1.1 (Obrero) sigue funcionando', () => {
    const full = textoObligacionesTrabajadorContrato({ cargoCodigo: '1.1', cargoNombre: 'OBRERO' });
    assert.ok(full.startsWith(OBLIGACIONES_GENERICAS_NUMERADAS));
    assert.match(full, /6\.-/);
  });
});
