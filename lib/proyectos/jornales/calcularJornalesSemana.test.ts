import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  armarFilaColaborador,
  construirPayloadJornalesSemana,
  costoSemanalJornal,
  kpisJornales,
  round2,
} from './calcularJornalesSemana';
import { jornalDesdeHonorarios } from './cargarJornalesProyecto';
import { fechasDeSemana, lunesDeSemanaJornales } from './semanaJornales';

describe('costo semanal de jornal', () => {
  it('multiplica días trabajados por el jornal diario', () => {
    assert.equal(costoSemanalJornal(5, 28), 140);
    assert.equal(costoSemanalJornal(0, 28), 0);
    assert.equal(costoSemanalJornal(3, 12.5), 37.5);
  });

  it('ignora valores negativos o no numéricos', () => {
    assert.equal(costoSemanalJornal(-2, 20), 0);
    assert.equal(costoSemanalJornal(4, Number.NaN), 0);
  });
});

describe('semana lun–dom', () => {
  it('el martes 3 nov 2026 cae en la semana del lunes 2', () => {
    assert.equal(lunesDeSemanaJornales('2026-11-03'), '2026-11-02');
    assert.deepEqual(fechasDeSemana('2026-11-03'), [
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
      '2026-11-05',
      '2026-11-06',
      '2026-11-07',
      '2026-11-08',
    ]);
  });
});

describe('fila de colaborador y KPIs', () => {
  const dias = fechasDeSemana('2026-11-02');

  it('cuenta asistencias y usa el costo persistido por día', () => {
    const fila = armarFilaColaborador(
      {
        empleado_id: 'e1',
        nombre_completo: 'Ana Pérez',
        cargo_nombre: 'Instalador CCTV',
        jornal_diario_usd: 28,
      },
      dias,
      [
        { empleado_id: 'e1', fecha: '2026-11-02', costo_jornal: 28 },
        { empleado_id: 'e1', fecha: '2026-11-03', costo_jornal: 30 },
        { empleado_id: 'e1', fecha: '2026-11-04', costo_jornal: 28 },
        { empleado_id: 'otro', fecha: '2026-11-02', costo_jornal: 99 },
      ],
    );
    assert.equal(fila.dias_asistidos, 3);
    assert.equal(fila.costo_semanal_usd, 86);
    assert.equal(fila.asistencias.filter((a) => a.presente).length, 3);
    assert.equal(fila.cargo_nombre, 'Instalador CCTV');
  });

  it('KPIs: activos de la semana, promedio por jornal y acumulado', () => {
    const payload = construirPayloadJornalesSemana({
      proyectoId: 'p1',
      proyectoNombre: 'CCTV',
      semanaInicio: '2026-11-02',
      roster: [
        {
          empleado_id: 'e1',
          nombre_completo: 'Ana',
          cargo_nombre: 'Instalador CCTV',
          jornal_diario_usd: 28,
        },
        {
          empleado_id: 'e2',
          nombre_completo: 'Luis',
          cargo_nombre: 'Eléctrico',
          jornal_diario_usd: 32,
        },
        {
          empleado_id: 'e3',
          nombre_completo: 'Carla',
          cargo_nombre: 'Ayudante',
          jornal_diario_usd: 18,
        },
      ],
      asistenciasSemana: [
        { empleado_id: 'e1', fecha: '2026-11-02', costo_jornal: 28 },
        { empleado_id: 'e1', fecha: '2026-11-03', costo_jornal: 28 },
        { empleado_id: 'e2', fecha: '2026-11-02', costo_jornal: 32 },
      ],
      costoAcumuladoProyectoUsd: 1250.4,
    });

    assert.equal(payload.kpis.trabajadores_activos, 2);
    assert.equal(payload.kpis.costo_semana_usd, 88);
    assert.equal(payload.kpis.promedio_por_jornal_usd, round2(88 / 3));
    assert.equal(payload.kpis.costo_mano_obra_acumulado_usd, 1250.4);
    assert.equal(payload.colaboradores[2].dias_asistidos, 0);
    assert.equal(kpisJornales({ filas: [], costoAcumuladoProyectoUsd: 0 }).promedio_por_jornal_usd, 0);
  });

  it('honorarios chicos se leen como jornal; el monto de contrato no', () => {
    assert.equal(jornalDesdeHonorarios(28), 28);
    assert.equal(jornalDesdeHonorarios(0), 0);
    assert.equal(jornalDesdeHonorarios(4500), 0);
  });
});
