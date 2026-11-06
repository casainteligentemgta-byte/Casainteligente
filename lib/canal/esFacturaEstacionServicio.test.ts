import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  descripcionEsCombustible,
  esFacturaEstacionServicio,
  lineasSonSoloCombustible,
  proveedorEsEstacionServicio,
} from './esFacturaEstacionServicio';

describe('proveedorEsEstacionServicio', () => {
  it('detecta razón social típica venezolana (con y sin tilde)', () => {
    assert.equal(proveedorEsEstacionServicio('Estación de Servicio La California'), true);
    assert.equal(proveedorEsEstacionServicio('ESTACION DE SERVICIO EL RECREO, C.A.'), true);
    assert.equal(proveedorEsEstacionServicio('Gasolinera Los Palos Grandes'), true);
    assert.equal(proveedorEsEstacionServicio('Bomba de gasolina Centro'), true);
    assert.equal(proveedorEsEstacionServicio('PDVSA Estación La Urbina'), true);
  });

  it('detecta el token EDS y no un substring (REDES)', () => {
    assert.equal(proveedorEsEstacionServicio('EDS Los Ruices'), true);
    assert.equal(proveedorEsEstacionServicio('eds-12 el valle'), true);
    assert.equal(proveedorEsEstacionServicio('REDES Y CABLES C.A.'), false);
    assert.equal(proveedorEsEstacionServicio('PEDS Industrial'), false);
  });

  it('no marca PDVSA ni un proveedor de obra', () => {
    assert.equal(proveedorEsEstacionServicio('PDVSA'), false);
    assert.equal(proveedorEsEstacionServicio('Ferretería El Clavo'), false);
    assert.equal(proveedorEsEstacionServicio(''), false);
    assert.equal(proveedorEsEstacionServicio(null), false);
  });
});

describe('descripcionEsCombustible', () => {
  it('reconoce GASOLINA / DIESEL / gasoil y rechaza repuestos', () => {
    assert.equal(descripcionEsCombustible('Gasolina 91'), true);
    assert.equal(descripcionEsCombustible('GASOLINA 95 PREMIUM'), true);
    assert.equal(descripcionEsCombustible('Diésel B5'), true);
    assert.equal(descripcionEsCombustible('GASOIL'), true);
    assert.equal(descripcionEsCombustible('Gasóleo'), true);
    assert.equal(descripcionEsCombustible('Filtro de combustible diesel'), false);
    assert.equal(descripcionEsCombustible('Aceite 20W50'), false);
    assert.equal(descripcionEsCombustible('Cemento Portland'), false);
  });
});

describe('esFacturaEstacionServicio', () => {
  it('por proveedor aunque las líneas vengan pobres', () => {
    assert.equal(
      esFacturaEstacionServicio({
        supplier_name: 'Estación de Servicio El Recreo',
        items: [{ description: 'Producto 1' }],
      }),
      true,
    );
  });

  it('por líneas solo de combustible aunque el proveedor no diga EDS', () => {
    assert.equal(
      esFacturaEstacionServicio({
        supplier_name: 'Inversiones La Bomba 2020',
        items: [
          { description: 'GASOLINA 91' },
          { description: 'Diesel' },
        ],
      }),
      true,
    );
  });

  it('no mezcla combustible con materiales de obra', () => {
    assert.equal(
      lineasSonSoloCombustible({
        items: [{ description: 'Gasolina 91' }, { description: 'Cemento' }],
      }),
      false,
    );
    assert.equal(
      esFacturaEstacionServicio({
        supplier_name: 'Ferretería El Clavo',
        items: [{ description: 'Gasolina 91' }, { description: 'Cemento' }],
      }),
      false,
    );
  });

  it('factura de ferretería / null no es EDS', () => {
    assert.equal(
      esFacturaEstacionServicio({
        supplier_name: 'Ferretería El Clavo',
        items: [{ description: 'Cabilla 3/8' }, { description: 'Cemento' }],
      }),
      false,
    );
    assert.equal(esFacturaEstacionServicio(null), false);
    assert.equal(esFacturaEstacionServicio({}), false);
  });
});
