import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  esAptoParaAsignar,
  etiquetaEstadoEmpleado,
  leerEmpleadoEstados,
} from './empleadoEstados';
import { resolverPermisosAlcanceRrhh } from './rrhhPermisosAlcance';

describe('empleadoEstados', () => {
  it('etiqueta aprobado', () => {
    assert.equal(etiquetaEstadoEmpleado({ estado: 'aprobado', estatus: 'disponible' }), 'Aprobado');
  });

  it('apto para asignar requiere obrero + aprobado + disponible', () => {
    assert.equal(
      esAptoParaAsignar({
        rol_examen: 'obrero',
        estado: 'aprobado',
        estatus: 'disponible',
      }),
      true,
    );
    assert.equal(
      esAptoParaAsignar({
        rol_examen: 'obrero',
        estado: 'aprobado',
        estatus: 'asignado',
      }),
      false,
    );
  });

  it('lee disponibilidad desde status legacy', () => {
    const s = leerEmpleadoEstados({ estado: 'aprobado', status: 'asignado' });
    assert.equal(s.disponibilidad, 'asignado');
  });
});

describe('rrhhPermisosAlcance', () => {
  it('con enforcement: solo obra si solo rrhh.obra', () => {
    const p = resolverPermisosAlcanceRrhh({
      permisos: ['rrhh.obra'],
      enforcement: true,
    });
    assert.equal(p.obra, true);
    assert.equal(p.entidad, false);
  });

  it('sin enforcement: ambos', () => {
    const p = resolverPermisosAlcanceRrhh({
      permisos: [],
      enforcement: false,
    });
    assert.equal(p.ambos, true);
  });

  it('legacy equipo.gestionar: ambos', () => {
    const p = resolverPermisosAlcanceRrhh({
      permisos: ['equipo.gestionar'],
      enforcement: true,
    });
    assert.equal(p.entidad, true);
    assert.equal(p.obra, true);
  });
});
