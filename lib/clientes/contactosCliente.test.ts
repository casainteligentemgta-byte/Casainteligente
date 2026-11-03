import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { crearFakeSupabase } from '@/lib/telegram/testing/fakeSupabase';
import {
  cargarContactosCliente,
  esCanalContacto,
  etiquetaCanalContacto,
  registrarContactoCliente,
} from './contactosCliente';

const CLIENTE = '11111111-1111-4111-8111-111111111111';

describe('contactos del cliente', () => {
  it('reconoce canales y etiquetas en español', () => {
    assert.equal(esCanalContacto('whatsapp'), true);
    assert.equal(esCanalContacto('fax'), false);
    assert.equal(etiquetaCanalContacto('whatsapp'), 'WhatsApp');
    assert.equal(etiquetaCanalContacto('llamada'), 'Llamada');
  });

  it('guarda y lista contactos del cliente', async () => {
    const sb = crearFakeSupabase({ ci_cliente_contactos: [] }) as unknown as SupabaseClient;
    const alta = await registrarContactoCliente(sb, {
      customerId: CLIENTE,
      canal: 'whatsapp',
      nota: 'Abrió WhatsApp desde la ficha',
      usuarioId: 'u1',
      usuarioNombre: 'Ana',
    });
    assert.equal(alta.error, null);
    assert.equal(alta.contacto?.canal, 'whatsapp');
    assert.equal(alta.contacto?.usuario_nombre, 'Ana');

    const lista = await cargarContactosCliente(sb, CLIENTE);
    assert.equal(lista.error, null);
    assert.equal(lista.contactos.length, 1);
    assert.match(lista.contactos[0]?.nota ?? '', /WhatsApp/);
  });

  it('si falta la tabla avisa la migración 389', async () => {
    const sb = crearFakeSupabase({}, { tablasAusentes: ['ci_cliente_contactos'] }) as unknown as SupabaseClient;
    const r = await cargarContactosCliente(sb, CLIENTE);
    assert.equal(r.migracionPendiente, true);
    assert.match(r.error ?? '', /389/);
  });
});
