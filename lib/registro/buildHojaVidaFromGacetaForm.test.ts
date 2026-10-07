/**
 * Ejecutar: npx tsx --test lib/registro/buildHojaVidaFromGacetaForm.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildHojaVidaFromGacetaForm } from './buildHojaVidaFromGacetaForm';
import { initialGacetaPostulacionForm } from './gacetaPostulacionTypes';

describe('buildHojaVidaFromGacetaForm', () => {
  it('copia el teléfono de habitación de la planilla Anexo I', () => {
    const f = initialGacetaPostulacionForm();
    f.primerNombre = 'Luis';
    f.primerApellido = 'Mata';
    f.cedula = 'V-12345678';
    f.celular = '04141234567';
    f.telHabitacion = '0212-5551234';
    f.correo = 'luis@example.com';
    const hoja = buildHojaVidaFromGacetaForm(f, { fotoPerfil: '', fotoCedula: '' }, 'Oficial');
    assert.equal(hoja.datosPersonales.telHabitacion, '0212-5551234');
    assert.equal(hoja.datosPersonales.celular, '04141234567');
  });
});
