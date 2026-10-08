import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { faltantesDesdePropsContrato } from '@/lib/talento/faltantesContratoObra';

const completo = {
  entidad: {
    nombre_legal: 'DIMAQUINAS, C.A.',
    rif: 'J-12345678-9',
    domicilio_fiscal: 'Av. Principal, Porlamar',
    municipio_fiscal: 'Mariño',
    estado_fiscal: 'Nueva Esparta',
    rep_legal_nombre: 'Representante de Prueba',
    rep_legal_cedula: 'V-12345678',
    rep_legal_estado_civil: 'casado',
    rm_fecha: '2015-03-15',
    rm_numero: '76',
    rm_tomo: '56',
  },
  contrato: {
    obra_denominada: 'Juan Griego – Etapa 2',
    lugar_prestacion_servicio: 'Juan Griego, municipio Marcano',
    objeto_contrato: 'Estructura y acabados',
  },
  parametros: { textoPuntoEncuentroTransporteSex: 'Plaza Bolívar de Juan Griego' },
};

describe('faltantesDesdePropsContrato', () => {
  it('con todo cargado no falta nada', () => {
    assert.deepEqual(faltantesDesdePropsContrato(completo), []);
  });

  it('señala lo que falta de la obra y del empleador por separado', () => {
    const f = faltantesDesdePropsContrato({
      entidad: { ...completo.entidad, rif: '', rm_tomo: null },
      contrato: { ...completo.contrato, objeto_contrato: null, lugar_prestacion_servicio: '   ' },
      parametros: {},
    });
    assert.deepEqual(
      f.filter((x) => x.origen === 'obra').map((x) => x.dato),
      ['Lugar de trabajo (ubicación de la obra)', 'Fase técnica de la obra', 'Punto de encuentro del transporte'],
    );
    assert.deepEqual(
      f.filter((x) => x.origen === 'empleador').map((x) => x.dato),
      ['RIF', 'Registro mercantil: tomo'],
    );
  });

  it('una línea de relleno cuenta como dato faltante', () => {
    const f = faltantesDesdePropsContrato({ ...completo, entidad: { ...completo.entidad, rif: '__________' } });
    assert.deepEqual(f, [{ origen: 'empleador', dato: 'RIF' }]);
  });

  it('sin obra cargada faltan sus cuatro datos', () => {
    const f = faltantesDesdePropsContrato({ entidad: completo.entidad, contrato: null, parametros: {} });
    assert.equal(f.filter((x) => x.origen === 'obra').length, 4);
  });
});
