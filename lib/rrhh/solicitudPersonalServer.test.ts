import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mismaPersonaPorApellido, primerApellidoDeFila } from '@/lib/rrhh/solicitudPersonalServer';

describe('mismaPersonaPorApellido', () => {
  it('mismo apellido (sin importar acentos ni mayúsculas): es la misma persona', () => {
    assert.equal(mismaPersonaPorApellido({ primer_apellido: 'Pérez' }, { primer_apellido: 'PEREZ' }), true);
  });
  it('apellido distinto: no se unifica', () => {
    assert.equal(mismaPersonaPorApellido({ primer_apellido: 'Rojas' }, { primer_apellido: 'Mata' }), false);
  });
  it('lee el apellido de la hoja de vida si la columna está vacía', () => {
    const nuevo = { hoja_vida_obrero: { datosPersonales: { primerApellido: 'Sánchez' } } };
    assert.equal(primerApellidoDeFila(nuevo), 'sanchez');
    assert.equal(mismaPersonaPorApellido(nuevo, { primer_apellido: 'Sanchez' }), true);
  });
  it('expediente previo sin apellido: compara con su nombre completo', () => {
    assert.equal(
      mismaPersonaPorApellido({ primer_apellido: 'Sanchez' }, { nombre_completo: 'MEDALDO YOHANNY SANCHEZ' }),
      true,
    );
    assert.equal(mismaPersonaPorApellido({ primer_apellido: 'Rojas' }, { nombre_completo: 'MEDALDO SANCHEZ' }), false);
  });
  it('sin datos para comparar: se unifica (expediente creado solo con la cédula)', () => {
    assert.equal(mismaPersonaPorApellido({ primer_apellido: 'Rojas' }, {}), true);
  });
});
