import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  calcularConsumoDesdeRegistros,
  consumoKmPorLitro,
  diasHasta,
  estadoAlertaDesdeFlags,
  flagsDesdeEstadoAlerta,
  etiquetaVehiculo,
  filtrarPorUnidadesEntidad,
  inferirTipoVehiculo,
  normalizarPlaca,
  normalizarSeveridadAlerta,
  normalizarTipoMantenimiento,
  tipoAlertaACatalogo,
  parseFechaIso,
  parseNumero,
  partirNombreCompleto,
  partirTextoEnChunks,
  placaDesdeEquipo,
  puntuacionBusqueda,
  unirNombreCompleto,
} from './utils';

describe('flota/utils', () => {
  it('normaliza severidad y estado de alerta', () => {
    assert.equal(normalizarSeveridadAlerta('critical'), 'critica');
    assert.equal(normalizarSeveridadAlerta('info'), 'info');
    assert.equal(estadoAlertaDesdeFlags(false, false), 'pendiente');
    assert.equal(estadoAlertaDesdeFlags(true, false), 'leida');
    assert.deepEqual(flagsDesdeEstadoAlerta('pendiente'), { leida: false, resuelta: false });
    assert.equal(tipoAlertaACatalogo('aceite', 'km'), 'mantenimiento_km');
    assert.equal(tipoAlertaACatalogo('licencia_vence'), 'licencia_vence');
  });

  it('normaliza tipo de mantenimiento al catálogo', () => {
    assert.equal(normalizarTipoMantenimiento('cambio_aceite'), 'cambio_aceite');
    assert.equal(normalizarTipoMantenimiento('Cambio de aceite'), 'cambio_aceite');
    assert.equal(normalizarTipoMantenimiento('pintura'), 'otro');
  });

  it('normaliza placa venezolana', () => {
    assert.equal(normalizarPlaca('ab-123-cd'), 'AB123CD');
    assert.equal(normalizarPlaca('  A12 BC3D '), 'A12BC3D');
  });

  it('parsea números con coma', () => {
    assert.equal(parseNumero('12,5'), 12.5);
    assert.equal(parseNumero(''), null);
  });

  it('valida fecha ISO', () => {
    assert.equal(parseFechaIso('2026-08-29'), '2026-08-29');
    assert.equal(parseFechaIso('29/08/2026'), null);
  });

  it('calcula días hasta vencimiento', () => {
    const now = new Date('2026-08-29T15:00:00Z');
    assert.equal(diasHasta('2026-08-29', now), 0);
    assert.equal(diasHasta('2026-09-03', now), 5);
    assert.equal(diasHasta('2026-08-20', now), -9);
  });

  it('calcula L/km con filas más nuevas primero', () => {
    const out = calcularConsumoDesdeRegistros([
      { cantidad_litros: 40, km_actual: 1120 },
      { cantidad_litros: 50, km_actual: 1000 },
      { cantidad_litros: 30, km_actual: 880 },
    ]);
    assert.equal(out.consumo_total, 90);
    assert.equal(out.km_recorridos, 240);
    assert.equal(out.consumo_promedio_km, 90 / 240);
  });

  it('omite tramos sin odómetro al calcular consumo', () => {
    const out = calcularConsumoDesdeRegistros([
      { litros: 12, odometro_km: null },
      { litros: 8, odometro_km: 300 },
    ]);
    assert.equal(out.consumo_total, 12);
    assert.equal(out.km_recorridos, 0);
    assert.equal(out.consumo_promedio_km, 0);
  });

  it('calcula km/l entre cargas', () => {
    assert.equal(
      consumoKmPorLitro({ odometroAnterior: 1000, odometroActual: 1120, litros: 40 }),
      3,
    );
    assert.equal(
      consumoKmPorLitro({ odometroAnterior: 1120, odometroActual: 1000, litros: 40 }),
      null,
    );
  });

  it('parte texto en chunks con solape', () => {
    const chunks = partirTextoEnChunks('A'.repeat(2000), 500, 50);
    assert.ok(chunks.length >= 4);
    assert.ok(chunks.every((c) => c.length > 0));
  });

  it('puntúa búsqueda por tokens', () => {
    assert.ok(puntuacionBusqueda('cambio de aceite motor diesel', 'aceite diesel') > 0.9);
    assert.equal(puntuacionBusqueda('frenos', 'inyeccion'), 0);
  });

  it('parte y une nombre completo', () => {
    assert.deepEqual(partirNombreCompleto('Juan Pérez'), { nombres: 'Juan', apellidos: 'Pérez' });
    assert.deepEqual(partirNombreCompleto('Ana María Díaz López'), {
      nombres: 'Ana María',
      apellidos: 'Díaz López',
    });
    assert.equal(unirNombreCompleto('Juan', 'Pérez'), 'Juan Pérez');
  });

  it('etiqueta maquinaria por nombre de catálogo', () => {
    assert.equal(
      etiquetaVehiculo({
        placa: 'MQABC123DE',
        nombre: 'Camion Chevrolet NPR',
        marca: 'Chevrolet',
        modelo: 'NPR',
      }),
      'Camion Chevrolet NPR',
    );
    assert.equal(etiquetaVehiculo({ placa: 'AB123CD', marca: 'Toyota', modelo: 'Hilux' }), 'AB123CD · Toyota Hilux');
  });

  it('deriva placa e infiere tipo desde el catálogo', () => {
    assert.equal(placaDesdeEquipo({ id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', serial: 'AB-12-3CD' }), 'AB123CD');
    assert.equal(placaDesdeEquipo({ id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', serial: null }), 'MQAAAAAAAA');
    assert.equal(inferirTipoVehiculo('Camion Chevrolet NPR', 'Chevrolet', 'NPR'), 'camion');
    assert.equal(inferirTipoVehiculo('Retroexcavadora CAT', 'CAT', '416'), 'maquinaria');
    assert.equal(inferirTipoVehiculo('Moto DT', 'Yamaha', 'DT175'), 'moto');
  });

  it('filtra registros de flota por unidades de la entidad', () => {
    const ids = new Set(['v1']);
    const rows = [
      { vehiculo_id: 'v1' },
      { vehiculo_id: 'v2' },
      { maquinaria_id: 'v1' },
      { entidad_id: 'e1' },
      { entidad_id: 'e2' },
    ];
    const out = filtrarPorUnidadesEntidad(rows, ids, 'e1');
    assert.deepEqual(
      out.map((r) => r.vehiculo_id || r.maquinaria_id || r.entidad_id),
      ['v1', 'v1', 'e1'],
    );
  });
});
