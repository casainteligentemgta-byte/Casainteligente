import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  OBLIGACIONES_GENERICAS_NUMERADAS,
  obligacionesComplementariasPorOficio,
  resolverCodigoOficioParaObligaciones,
  textoObligacionesTrabajadorContrato,
} from '@/lib/talento/obligacionesOficioContrato';

describe('obligacionesOficioContrato', () => {
  it('resuelve código desde nombre de gaceta', () => {
    assert.equal(resolverCodigoOficioParaObligaciones({ cargoNombre: 'OBRERO DE 1era.' }), '1.1');
    assert.equal(resolverCodigoOficioParaObligaciones({ cargoCodigo: '2,1' }), '2.1');
  });

  it('complementa con tareas cuando la ficha es detallada', () => {
    const c = obligacionesComplementariasPorOficio({
      cargoCodigo: '1.1',
      cargoNombre: 'OBRERO DE 1era.',
    });
    assert.match(c, /^6\.- Ejecutar las tareas propias/);
    assert.match(c, /Excavaciones/);
    assert.match(c, /7\.- Aplicar los conocimientos/);
  });

  it('sin ficha detallada → complemento vacío; genéricas intactas', () => {
    assert.equal(obligacionesComplementariasPorOficio({ cargoCodigo: '2.1' }), '');
    const full = textoObligacionesTrabajadorContrato({ cargoCodigo: '2.1' });
    assert.equal(full, OBLIGACIONES_GENERICAS_NUMERADAS);
  });

  it('texto completo incluye genéricas + complemento', () => {
    const full = textoObligacionesTrabajadorContrato({ cargoCodigo: '1.1' });
    assert.ok(full.startsWith(OBLIGACIONES_GENERICAS_NUMERADAS));
    assert.match(full, /6\.-/);
  });
});
