import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { evaluarAlertas, type FlotaAlertaConfig } from './alertas';
import type { FlotaConductor } from './conductores';
import type { FlotaMantenimiento } from './mantenimiento';
import type { FlotaVehiculo } from './utils';

const now = new Date('2026-08-29T12:00:00Z');

function cfg(tipo: FlotaAlertaConfig['tipo'], extra?: Partial<FlotaAlertaConfig>): FlotaAlertaConfig {
  return {
    id: tipo,
    tipo,
    dias_anticipacion: 15,
    umbral_consumo_km_l: 5,
    activa: true,
    created_at: '',
    updated_at: '',
    ...extra,
  };
}

describe('evaluarAlertas', () => {
  it('marca licencia vencida como crítica', () => {
    const conductor = {
      id: 'c1',
      nombre_completo: 'Juan Pérez',
      nombres: 'Juan',
      apellidos: 'Pérez',
      fecha_vencimiento_licencia: '2026-08-01',
      licencia_vence: '2026-08-01',
      certificado_medico_vence: null,
      vehiculo_asignado_id: null,
      activo: true,
    } as FlotaConductor;
    const out = evaluarAlertas({
      conductores: [conductor],
      documentos: [],
      vehiculos: [],
      mantenimientos: [],
      consumos: [],
      configs: [cfg('licencia_vence')],
      now,
    });
    assert.equal(out.length, 1);
    assert.equal(out[0].severidad, 'critica');
    assert.match(out[0].mensaje, /Juan Pérez/);
  });

  it('alerta mantenimiento por km cuando se superó el umbral', () => {
    const vehiculo = {
      id: 'v1',
      placa: 'AB123CD',
      marca: 'Toyota',
      modelo: 'Hilux',
      odometro_km: 50500,
    } as FlotaVehiculo;
    const mant = {
      id: 'm1',
      vehiculo_id: 'v1',
      fecha: '2026-07-01',
      proximo_odometro_km: 50000,
      vehiculo,
    } as unknown as FlotaMantenimiento;
    const out = evaluarAlertas({
      conductores: [],
      documentos: [],
      vehiculos: [vehiculo],
      mantenimientos: [mant],
      consumos: [],
      configs: [cfg('mantenimiento_km')],
      now,
    });
    assert.equal(out.length, 1);
    assert.equal(out[0].tipo, 'mantenimiento_km');
    assert.equal(out[0].severidad, 'critica');
  });

  it('alerta consumo bajo km/l', () => {
    const out = evaluarAlertas({
      conductores: [],
      documentos: [],
      vehiculos: [],
      mantenimientos: [],
      consumos: [
        {
          vehiculo_id: 'v1',
          placa: 'AB123CD',
          etiqueta: 'AB123CD · Hilux',
          cargas: 3,
          litros: 120,
          km: 360,
          km_por_litro: 3,
          monto_usd: 40,
          monto_bs: 0,
          ultima_fecha: '2026-08-20',
        },
      ],
      configs: [cfg('consumo_alto', { umbral_consumo_km_l: 4 })],
      now,
    });
    assert.equal(out.length, 1);
    assert.equal(out[0].tipo, 'consumo_alto');
  });

  it('ignora configs inactivas', () => {
    const out = evaluarAlertas({
      conductores: [
        {
          id: 'c1',
          nombres: 'Ana',
          apellidos: 'Díaz',
          licencia_vence: '2026-08-01',
          activo: true,
        } as FlotaConductor,
      ],
      documentos: [],
      vehiculos: [],
      mantenimientos: [],
      consumos: [],
      configs: [cfg('licencia_vence', { activa: false })],
      now,
    });
    assert.equal(out.length, 0);
  });
});
