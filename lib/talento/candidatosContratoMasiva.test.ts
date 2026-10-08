/**
 * Ejecutar: npx tsx --test lib/talento/candidatosContratoMasiva.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  candidatoDesdeEmpleadoRow,
  payloadContratoDesdeCandidato,
  resolverNominaIdPorCargo,
} from './candidatosContratoMasiva';

const nominas = [
  { id: 'nom-ayu', cargo_nombre: 'AYUDANTE', cargo_codigo: '2.1' },
  { id: 'nom-elec', cargo_nombre: 'ELECTRICISTA DE 1ra.', cargo_codigo: '5.5' },
];

describe('resolverNominaIdPorCargo', () => {
  it('prioriza código GOE y cae al default', () => {
    assert.equal(
      resolverNominaIdPorCargo(nominas, { cargoCodigo: '2,1', cargoNombre: 'otra cosa' }),
      'nom-ayu',
    );
    assert.equal(
      resolverNominaIdPorCargo(nominas, { cargoNombre: 'Electricista de 1ra.' }),
      'nom-elec',
    );
    assert.equal(
      resolverNominaIdPorCargo(nominas, { cargoNombre: 'Desconocido', defaultId: 'nom-ayu' }),
      'nom-ayu',
    );
  });
});

describe('candidatoDesdeEmpleadoRow', () => {
  it('arma identidad desde la HV y marca listo', () => {
    const c = candidatoDesdeEmpleadoRow(
      {
        id: 'emp-1',
        nombre_completo: 'Candidato · AYUDANTE',
        cedula: 'V-12345678',
        estado_proceso: 'cv_completado',
        cargo_nombre: 'AYUDANTE',
        cargo_codigo: '2.1',
        semaforo: 'verde',
        examen_completado_at: '2026-10-01T12:00:00Z',
        hoja_vida_obrero: {
          datosPersonales: {
            primerNombre: 'José',
            segundoNombre: '',
            primerApellido: 'Pérez',
            segundoApellido: 'Díaz',
            cedulaIdentidad: 'V-12.345.678',
            estadoCivil: 'Soltero',
            direccionDomicilio: 'Calle 4, casa 12',
          },
          contratacion: { cargoUOficio: 'AYUDANTE' },
        },
      },
      { yaContratado: false },
    );
    assert.equal(c.nombres, 'José');
    assert.equal(c.apellidos, 'Pérez Díaz');
    assert.equal(c.cedula, 'V12345678');
    assert.equal(c.direccion, 'Calle 4, casa 12');
    assert.equal(c.tieneHv, true);
    assert.equal(c.evaluacionLista, true);
    assert.equal(c.listo, true);
  });

  it('no está listo si ya tiene contrato', () => {
    const c = candidatoDesdeEmpleadoRow(
      {
        id: 'emp-2',
        nombre_completo: 'Carlos Díaz',
        cedula: 'V-25479932',
        estado_proceso: 'cv_completado',
        hoja_vida_obrero: { datosPersonales: { primerNombre: 'Carlos', primerApellido: 'Díaz' } },
      },
      { yaContratado: true },
    );
    assert.equal(c.yaContratado, true);
    assert.equal(c.listo, false);
  });
});

describe('payloadContratoDesdeCandidato', () => {
  it('usa HV y aplica defaults del lote', () => {
    const c = candidatoDesdeEmpleadoRow(
      {
        id: 'emp-1',
        cedula: 'V-12345678',
        estado_proceso: 'cv_completado',
        cargo_codigo: '2.1',
        cargo_nombre: 'AYUDANTE',
        hoja_vida_obrero: {
          datosPersonales: {
            primerNombre: 'José',
            primerApellido: 'Pérez',
            cedulaIdentidad: 'V-12345678',
            estadoCivil: 'Casado',
            direccionDomicilio: 'La Asunción',
          },
        },
      },
      { yaContratado: false },
    );
    const out = payloadContratoDesdeCandidato(
      c,
      {
        proyectoId: '11111111-1111-1111-1111-111111111111',
        fechaIngreso: '2026-10-08',
        jornada: 'DIURNA',
        horario: 'Lun a vie 7-4',
        bonoUsd: 10,
      },
      nominas,
    );
    assert.equal(out.ok, true);
    if (!out.ok) return;
    assert.equal(out.payload.config_nomina_id, 'nom-ayu');
    assert.equal(out.payload.obrero_nombres, 'José');
    assert.equal(out.payload.estado_civil, 'Casado');
    assert.equal(out.payload.fecha_ingreso, '2026-10-08');
    assert.equal(out.payload.bono_manual_usd, 10);
    assert.equal(out.payload.formalizado_empleado_id, 'emp-1');
  });
});

describe('arreglo de pago del candidato', () => {
  const fila = (extra: Record<string, unknown>) =>
    candidatoDesdeEmpleadoRow(
      {
        id: 'emp-9',
        cedula: 'V-12345678',
        estado_proceso: 'cv_completado',
        hoja_vida_obrero: {
          datosPersonales: {
            primerNombre: 'Ana',
            primerApellido: 'Rojas',
            cedulaIdentidad: 'V-12345678',
            estadoCivil: 'Soltera',
            direccionDomicilio: 'Calle 1',
          },
        },
        ...extra,
      },
      { yaContratado: false },
    );

  it('preestablece 90 para ayudante y 115 para clasificado', () => {
    assert.deepEqual(fila({ cargo_nombre: 'AYUDANTE', cargo_codigo: '2.1' }).arregloDefecto, {
      semanalUsd: 90,
      mensualUsd: 90,
    });
    assert.deepEqual(fila({ cargo_nombre: 'ELECTRICISTA DE 1ra.', cargo_codigo: '5.5' }).arregloDefecto, {
      semanalUsd: 115,
      mensualUsd: 115,
    });
  });

  it('el contrato lleva lo pactado; sin pacto, el monto por defecto', () => {
    const c = fila({ cargo_nombre: 'AYUDANTE', cargo_codigo: '2.1' });
    const base = { proyectoId: 'p1', fechaIngreso: '2026-10-12', jornada: 'DIURNA' };
    const porDefecto = payloadContratoDesdeCandidato(c, base, nominas);
    assert.ok(porDefecto.ok);
    assert.equal(porDefecto.ok && porDefecto.payload.arreglo_semanal_usd, 90);
    assert.equal(porDefecto.ok && porDefecto.payload.arreglo_mensual_usd, 90);

    const pactado = payloadContratoDesdeCandidato(
      c,
      { ...base, arreglos: { 'emp-9': { semanal_usd: 100, mensual_usd: 70 } } },
      nominas,
    );
    assert.equal(pactado.ok && pactado.payload.arreglo_semanal_usd, 100);
    assert.equal(pactado.ok && pactado.payload.arreglo_mensual_usd, 70);
  });

  it('avisa de los datos del trabajador que saldrían genéricos', () => {
    const c = candidatoDesdeEmpleadoRow(
      {
        id: 'emp-10',
        cedula: 'V-12345678',
        estado_proceso: 'cv_completado',
        hoja_vida_obrero: { datosPersonales: { primerNombre: 'Luis', primerApellido: 'Mata', cedulaIdentidad: 'V-12345678' } },
      },
      { yaContratado: false },
    );
    assert.deepEqual(c.faltantes, ['estado civil', 'dirección de habitación', 'oficio']);
  });
});
