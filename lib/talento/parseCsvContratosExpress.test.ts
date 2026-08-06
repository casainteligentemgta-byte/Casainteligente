import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  parseCsvContratosExpress,
  partirNombreCompleto,
} from '@/lib/talento/parseCsvContratosExpress';

describe('parseCsvContratosExpress', () => {
  it('acepta plantilla canónica', () => {
    const csv =
      'nombres;apellidos;cedula;cargo;remuneracion_semanal;fecha_ingreso\n' +
      'Juan Carlos;Pérez Gómez;V-12345678;Ayudante;120;2026-08-05\n';
    const r = parseCsvContratosExpress(csv);
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.filas.length, 1);
    assert.equal(r.filas[0]!.nombres, 'Juan Carlos');
    assert.equal(r.filas[0]!.apellidos, 'Pérez Gómez');
    assert.equal(r.filas[0]!.cedula, 'V-12345678');
    assert.equal(r.filas[0]!.cargo, 'Ayudante');
    assert.equal(r.filas[0]!.remuneracion_semanal, 120);
    assert.equal(r.filas[0]!.fecha_ingreso, '2026-08-05');
  });

  it('acepta listado de personal (título + NOMBRES Y APELLIDOS + C.I. + FECHA INI)', () => {
    const csv = [
      'LISTADO DEL PERSONAL A OBRA JUAN GRIEGO PROCODIMA - DIMAQUINAS',
      'N°;NOMBRES Y APELLIDOS;C.I.;FECHA INI;CARGO;TIPO;CLASIFICACION;NIVEL GENERICO',
      '1;Francisco Jose Gonzalez Figueroa;10199713;3/6/24;AYUDANTE;OBRERO;OBRERO;5',
      '2;Anthony Jose Diaz Diaz;18296258;3/6/24;CARPINTERO;OBRERO;CLASIFICADO;8',
    ].join('\n');
    const r = parseCsvContratosExpress(csv);
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.filas.length, 2);
    assert.equal(r.filas[0]!.nombres, 'Francisco Jose');
    assert.equal(r.filas[0]!.apellidos, 'Gonzalez Figueroa');
    assert.equal(r.filas[0]!.cedula, 'V-10199713');
    assert.equal(r.filas[0]!.cargo, 'AYUDANTE');
    assert.equal(r.filas[0]!.fecha_ingreso, '2024-06-03');
    assert.equal(r.filas[0]!.remuneracion_semanal, 0);
    assert.equal(r.filas[1]!.cargo, 'CARPINTERO');
    assert.equal(r.filas[1]!.cedula, 'V-18296258');
  });

  it('partirNombreCompleto (heurística VE)', () => {
    assert.deepEqual(partirNombreCompleto('Francisco Jose Gonzalez Figueroa'), {
      nombres: 'Francisco Jose',
      apellidos: 'Gonzalez Figueroa',
    });
    assert.deepEqual(partirNombreCompleto('María Rodríguez'), {
      nombres: 'María',
      apellidos: 'Rodríguez',
    });
  });
});
