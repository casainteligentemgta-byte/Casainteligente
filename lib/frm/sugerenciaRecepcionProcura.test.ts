import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ordenarSugerencias,
  puntuarSugerenciaRecepcion,
  similitudMateriales,
  type CompraParaSugerencia,
  type RecepcionParaSugerencia,
} from '@/lib/frm/sugerenciaRecepcionProcura';

const compra: CompraParaSugerencia = {
  ubicacionId: 'u1',
  proveedorRif: 'J-12345678-9',
  proveedorNombre: 'Ferretería Norte',
  materiales: ['Cemento gris 42.5 kg', 'Varilla 1/2'],
};

test('no sugiere si la ubicación no coincide', () => {
  const r: RecepcionParaSugerencia = {
    id: 'r1', ubicacionId: 'u2', proveedorRif: 'J-12345678-9', proveedorNombre: 'X', materiales: ['Cemento gris 42.5 kg'],
  };
  assert.equal(puntuarSugerenciaRecepcion(compra, r), null);
});

test('no sugiere si el proveedor no coincide por RIF ni nombre', () => {
  const r: RecepcionParaSugerencia = {
    id: 'r1', ubicacionId: 'u1', proveedorRif: 'J-99999999-9', proveedorNombre: 'Otra', materiales: ['Cemento gris 42.5 kg'],
  };
  assert.equal(puntuarSugerenciaRecepcion(compra, r), null);
});

test('acepta coincidencia por RIF aunque el nombre cambie y tiene puntaje alto con mismos materiales', () => {
  const r: RecepcionParaSugerencia = {
    id: 'r1', ubicacionId: 'u1', proveedorRif: 'j-12345678-9', proveedorNombre: 'Otro nombre', materiales: ['Cemento gris 42.5 kg', 'Varilla 1/2'],
  };
  const s = puntuarSugerenciaRecepcion(compra, r);
  assert.ok(s);
  assert.ok(s.puntaje >= 90);
  assert.ok(s.motivos.includes('Mismo RIF'));
});

test('acepta coincidencia por nombre si no hay RIF', () => {
  const sinRif: CompraParaSugerencia = { ...compra, proveedorRif: null };
  const r: RecepcionParaSugerencia = {
    id: 'r1', ubicacionId: 'u1', proveedorRif: null, proveedorNombre: 'FERRETERIA NORTE', materiales: ['Varilla 1/2'],
  };
  const s = puntuarSugerenciaRecepcion(sinRif, r);
  assert.ok(s);
  assert.ok(s.motivos.includes('Mismo nombre de proveedor'));
});

test('similitud baja con materiales distintos', () => {
  assert.ok(similitudMateriales(['Cemento gris'], ['Pintura blanca']) < 0.5);
});

test('ordena por puntaje y limita', () => {
  const recs: RecepcionParaSugerencia[] = [
    { id: 'malo', ubicacionId: 'u1', proveedorRif: 'J-12345678-9', proveedorNombre: 'X', materiales: ['Pintura blanca'] },
    { id: 'bueno', ubicacionId: 'u1', proveedorRif: 'J-12345678-9', proveedorNombre: 'X', materiales: ['Cemento gris 42.5 kg'] },
    { id: 'otra_obra', ubicacionId: 'u2', proveedorRif: 'J-12345678-9', proveedorNombre: 'X', materiales: ['Cemento gris 42.5 kg'] },
  ];
  const out = ordenarSugerencias(compra, recs, 5);
  assert.deepEqual(out.map((s) => s.recepcionId), ['bueno', 'malo']);
  assert.equal(ordenarSugerencias(compra, recs, 1).length, 1);
});
