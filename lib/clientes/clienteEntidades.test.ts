import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { crearFakeSupabase } from '@/lib/telegram/testing/fakeSupabase';
import {
  asignarEntidadAClientes,
  contextoEntidadDesdeRoles,
  entidadesIdsDesdeRoles,
  filtroFichaDesdeContexto,
  hintMigracionClienteEntidades,
  listarClientesSinEntidad,
  mensajeClienteYaExiste,
  mensajeConfirmarDesvincular,
  normalizarVinculosClienteEntidad,
  vincularClienteEntidad,
} from './clienteEntidades';
import { filtrarObrasPorEntidad, filtrarPresupuestosPorEntidad } from './filtrarFichaPorEntidad';
import { altaOVincularCliente, puedeForzarNuevoPorTelefono } from './altaOVincularCliente';

const E1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const E2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const C1 = '11111111-1111-4111-8111-111111111111';
const C2 = '22222222-2222-4222-8222-222222222222';

const sql394 = readFileSync(
  join(process.cwd(), 'supabase/migrations/394_ci_cliente_entidades.sql'),
  'utf8',
);

describe('migración 394 clientes en varias entidades', () => {
  it('crea la puente con unique, RLS y backfill desde entidad_id', () => {
    assert.match(sql394, /create table if not exists public\.ci_cliente_entidades/);
    assert.match(sql394, /primary key \(customer_id, entidad_id\)/);
    assert.match(sql394, /created_at timestamptz not null default now\(\)/);
    assert.match(sql394, /created_by uuid default auth\.uid\(\)/);
    assert.match(sql394, /from public\.customers c/);
    assert.match(sql394, /on conflict \(customer_id, entidad_id\) do nothing/);
    assert.match(sql394, /notify pgrst, 'reload schema'/);
  });

  it('reescribe customers_*_entidad: ver/editar por vínculo, borrar solo admin', () => {
    assert.match(sql394, /ci_cliente_accesible\(id, 'clientes\.ver'\)/);
    assert.match(sql394, /ci_cliente_accesible\(id, 'clientes\.editar'\)/);
    assert.match(sql394, /customers_delete_entidad/);
    assert.match(sql394, /using \(public\.ci_es_super_admin\(\)\)/);
    assert.match(sql394, /NO se activa FORCE ROW LEVEL SECURITY/i);
  });

  it('contacto y puente usan el mismo permiso N:N', () => {
    assert.match(sql394, /ci_cliente_entidades_select/);
    assert.match(sql394, /ci_cliente_accesible\(customer_id, 'clientes\.ver'\)/);
    assert.match(sql394, /ci_sync_cliente_entidad_origen/);
  });
});

describe('contexto de empresas del usuario', () => {
  it('junta las entidades de los roles y el admin no filtra la ficha', () => {
    const ctx = contextoEntidadDesdeRoles([
      { rol: 'pm_obra', entidad_id: E1 },
      { rol: 'pm_obra', entidad_id: E2 },
      { rol: 'pm_obra', entidad_id: E1 },
    ]);
    assert.deepEqual(entidadesIdsDesdeRoles([
      { rol: 'pm_obra', entidad_id: E1 },
      { rol: 'pm_obra', entidad_id: E2 },
      { rol: 'pm_obra', entidad_id: E1 },
    ]), [E1, E2]);
    assert.deepEqual(ctx.entidadIds, [E1, E2]);
    assert.equal(ctx.esAdmin, false);
    assert.deepEqual(filtroFichaDesdeContexto(ctx).entidadIds, [E1, E2]);

    const admin = contextoEntidadDesdeRoles([{ rol: 'super_admin', entidad_id: E1 }]);
    assert.equal(admin.esAdmin, true);
    assert.equal(filtroFichaDesdeContexto(admin).entidadIds, null);
  });

  it('explica el duplicado y la desvinculación en español', () => {
    assert.match(mensajeClienteYaExiste('Luis Pérez', 'cedula'), /misma cédula/);
    assert.match(mensajeClienteYaExiste('Casa López', 'rif'), /vincular/);
    assert.match(mensajeConfirmarDesvincular('Ana', 'DIMAQUINAS'), /Quitar a Ana de DIMAQUINAS/);
    assert.equal(puedeForzarNuevoPorTelefono('telefono'), true);
    assert.equal(puedeForzarNuevoPorTelefono('cedula'), false);
    assert.equal(hintMigracionClienteEntidades('Could not find the table ci_cliente_entidades'), true);
  });
});

describe('ficha: cobros, presupuestos y obras por empresa', () => {
  it('esconde obras de otra empresa y deja las del usuario', () => {
    const obras = [
      { id: 'o1', entidadId: E1 },
      { id: 'o2', entidadId: E2 },
      { id: 'o3', entidadId: null },
    ];
    assert.deepEqual(
      filtrarObrasPorEntidad(obras, { entidadIds: [E1] }).map((o) => o.id),
      ['o1'],
    );
    assert.deepEqual(
      filtrarObrasPorEntidad(obras, { entidadIds: null }).map((o) => o.id),
      ['o1', 'o2', 'o3'],
    );
  });

  it('un presupuesto ligado a una obra sigue la empresa de esa obra', () => {
    const obras = [
      { id: 'o1', entidadId: E1, budgetId: 'b1' },
      { id: 'o2', entidadId: E2, budgetId: 'b2' },
    ];
    const pres = [{ id: 'b1' }, { id: 'b2' }, { id: 'b3' }];
    assert.deepEqual(
      filtrarPresupuestosPorEntidad(pres, obras, { entidadIds: [E1] }).map((p) => p.id),
      ['b1', 'b3'],
    );
  });
});

describe('vínculos y clientes sin empresa', () => {
  it('normaliza nombres desde ci_entidades', () => {
    const v = normalizarVinculosClienteEntidad([
      {
        entidad_id: E1,
        created_at: '2026-01-01T00:00:00Z',
        ci_entidades: { nombre: 'DIMAQUINAS', rif: 'J-1' },
      },
    ]);
    assert.equal(v[0]?.nombre, 'DIMAQUINAS');
    assert.equal(v[0]?.rif, 'J-1');
  });

  it('lista los que no tienen fila en la puente', async () => {
    const sb = crearFakeSupabase({
      ci_cliente_entidades: [{ customer_id: C1, entidad_id: E1 }],
      customers: [
        { id: C1, nombre: 'Con empresa' },
        { id: C2, nombre: 'Sin empresa' },
      ],
    }) as unknown as SupabaseClient;
    const r = await listarClientesSinEntidad(sb);
    assert.equal(r.error, null);
    assert.deepEqual(r.ids, [C2]);
  });

  it('vincula un cliente a una empresa', async () => {
    const sb = crearFakeSupabase({
      ci_cliente_entidades: [],
    }) as unknown as SupabaseClient;
    const r = await vincularClienteEntidad(sb, C1, E1);
    assert.equal(r.error, null);
    assert.equal(r.yaEstaba, false);
  });

  it('asigna en lote a los que faltan', async () => {
    const sb = crearFakeSupabase({
      ci_cliente_entidades: [],
      customers: [{ id: C1, nombre: 'A' }, { id: C2, nombre: 'B' }],
    }) as unknown as SupabaseClient;
    const r = await asignarEntidadAClientes(sb, [C1, C2], E1);
    assert.equal(r.error, null);
    assert.equal(r.vinculados, 2);
  });
});

describe('alta o vincular', () => {
  it('si ya existe por cédula, vincula a la entidad y no crea otro', async () => {
    const sb = crearFakeSupabase({
      customers: [
        {
          id: C1,
          nombre: 'Carlos Pérez',
          cedula: 'V-12.345.678',
          rif: null,
          telefono: '04141234567',
          movil: '04141234567',
        },
      ],
      ci_cliente_entidades: [],
    }) as unknown as SupabaseClient;
    const r = await altaOVincularCliente({
      session: sb,
      busqueda: sb,
      payload: { nombre: 'Carlos', cedula: 'V12345678', status: 'activo' },
      entidadId: E1,
    });
    assert.equal(r.error, null);
    assert.equal(r.yaExistia, true);
    assert.equal(r.id, C1);
    assert.equal(r.motivo, 'cedula');
    assert.equal(r.vinculado, true);
  });

  it('si no hay parecido, crea el cliente', async () => {
    const sb = crearFakeSupabase({
      customers: [],
      ci_cliente_entidades: [],
    }) as unknown as SupabaseClient;
    const r = await altaOVincularCliente({
      session: sb,
      busqueda: sb,
      payload: { nombre: 'Nuevo', telefono: '04149990000', movil: '04149990000', status: 'activo' },
      entidadId: E1,
    });
    assert.equal(r.error, null);
    assert.equal(r.yaExistia, false);
    assert.ok(r.id);
  });
});
