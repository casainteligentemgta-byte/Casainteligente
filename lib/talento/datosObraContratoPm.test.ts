import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  dueñoPlaceholderContrato,
  evaluarChecklistObraContratoPm,
  valorPlantillaEfectivamenteVacio,
} from '@/lib/talento/datosObraContratoPm';
import { compilarPlantillaContratoObrero } from '@/lib/talento/plantillaContratoObreroCompile';

describe('datosObraContratoPm', () => {
  it('marca checklist incompleto si faltan fase/horario/punto', () => {
    const c = evaluarChecklistObraContratoPm({
      ubicacion: 'Playa El Agua',
      fase_tecnica_contrato: null,
      horario_semanal_obra_default: '',
      punto_encuentro_transporte_contrato: 'en el sector Jorge Coll',
    });
    assert.equal(c.listos, false);
    assert.deepEqual(
      c.faltantes.map((f) => f.id).sort(),
      ['fase_tecnica', 'horario_semanal'],
    );
  });

  it('checklist listo cuando los 4 campos PM están', () => {
    const c = evaluarChecklistObraContratoPm({
      ubicacion: 'Obra X',
      fase_tecnica_contrato: 'estructura',
      horario_semanal_obra_default: 'Lunes a viernes 7-4',
      punto_encuentro_transporte_contrato: 'en el sector Y',
    });
    assert.equal(c.listos, true);
    assert.equal(c.faltantes.length, 0);
  });

  it('asigna dueño PM a placeholders de obra', () => {
    assert.equal(dueñoPlaceholderContrato('CONTRATO_FASE_TECNICA'), 'pm');
    assert.equal(dueñoPlaceholderContrato('OBRA_PUNTO_ENC_TRANSPORTE'), 'pm');
    assert.equal(dueñoPlaceholderContrato('PATRON_RAZON_SOCIAL'), 'legal_admin');
    assert.equal(dueñoPlaceholderContrato('EMPLEADO_CEDULA'), 'obrero');
    assert.equal(dueñoPlaceholderContrato('CONTRATO_CARGO_OFICIO'), 'rrhh');
  });

  it('detecta guiones de plantilla como vacío', () => {
    assert.equal(valorPlantillaEfectivamenteVacio(''), true);
    assert.equal(valorPlantillaEfectivamenteVacio('__________'), true);
    assert.equal(valorPlantillaEfectivamenteVacio('__________ USD'), true);
    assert.equal(valorPlantillaEfectivamenteVacio('estructura y fundaciones'), false);
  });
});

describe('compilarPlantillaContratoObrero dueño', () => {
  it('incluye dueño en faltantes', () => {
    const { faltantes } = compilarPlantillaContratoObrero(
      'Fase: {{CONTRATO_FASE_TECNICA}} · CI: {{EMPLEADO_CEDULA}}',
      { CONTRATO_FASE_TECNICA: '', EMPLEADO_CEDULA: '___' },
    );
    assert.equal(faltantes.length, 2);
    const byId = Object.fromEntries(faltantes.map((f) => [f.id, f.dueño]));
    assert.equal(byId.CONTRATO_FASE_TECNICA, 'pm');
    assert.equal(byId.EMPLEADO_CEDULA, 'obrero');
  });
});
