import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const sql = readFileSync(
  join(process.cwd(), 'supabase/migrations/389_customers_entidad_rls_contactos.sql'),
  'utf8',
);
const apiAlta = readFileSync(join(process.cwd(), 'app/api/clientes/route.ts'), 'utf8');
const apiEdit = readFileSync(join(process.cwd(), 'app/api/clientes/[id]/route.ts'), 'utf8');
const apiContactos = readFileSync(join(process.cwd(), 'app/api/clientes/[id]/contactos/route.ts'), 'utf8');
const form = readFileSync(join(process.cwd(), 'components/clientes/NuevoClienteForm.tsx'), 'utf8');
const lista = readFileSync(join(process.cwd(), 'app/clientes/page.tsx'), 'utf8');
const ficha = readFileSync(join(process.cwd(), 'app/clientes/[id]/page.tsx'), 'utf8');

describe('migración 389 clientes por entidad', () => {
  it('agrega entidad_id, backfill desde obras y deja NULL documentado', () => {
    assert.match(sql, /add column if not exists entidad_id/);
    assert.match(sql, /from public\.ci_proyectos p/);
    assert.match(sql, /and c\.entidad_id is null/);
    assert.match(sql, /NULL = sin obra/i);
  });

  it('sustituye using\(true\) de 385 por RLS con clientes.ver/editar/borrar y entidad', () => {
    assert.match(sql, /drop policy if exists customers_auth_select/i);
    assert.match(sql, /ci_tiene_permiso_en_entidad\('clientes\.ver', entidad_id\)/);
    assert.match(sql, /ci_tiene_permiso_en_entidad\('clientes\.editar', entidad_id\)/);
    assert.match(sql, /ci_tiene_permiso_en_entidad\('clientes\.borrar', entidad_id\)/);
    assert.match(sql, /get_auth_user_context\(\)/);
    assert.match(sql, /super_admin/);
    assert.doesNotMatch(sql, /for select to authenticated using \(true\)/i);
  });

  it('no fuerza RLS y quita TRUNCATE', () => {
    assert.match(sql, /NO se activa FORCE ROW LEVEL SECURITY/i);
    assert.doesNotMatch(sql, /alter table public\.customers\s+force row level security/i);
    assert.match(sql, /revoke truncate on table public\.customers/i);
    assert.match(sql, /service_role \(bot de Telegram\)/i);
  });

  it('crea historial de contactos con fecha, canal, nota y usuario', () => {
    assert.match(sql, /create table if not exists public\.ci_cliente_contactos/);
    assert.match(sql, /canal text not null/);
    assert.match(sql, /usuario_id/);
    assert.match(sql, /usuario_nombre/);
  });
});

describe('APIs de clientes', () => {
  it('alta, edición y archivo pasan por requirePermisoWeb y el cliente de sesión', () => {
    assert.match(apiAlta, /requirePermisoWeb\('clientes\.editar'\)/);
    assert.match(apiAlta, /entidadActivaDesdeRoles/);
    assert.match(apiAlta, /guardarClienteEnDb\(acceso\.supabase/);
    assert.doesNotMatch(apiAlta, /supabaseAdminForRoute/);
    assert.match(apiEdit, /requirePermisoWeb\('clientes\.editar'\)/);
    assert.match(apiEdit, /acceso\.supabase/);
    assert.match(apiContactos, /requirePermisoWeb\('clientes\.ver'\)/);
  });

  it('el formulario y el archivo ya no escriben customers desde el browser', () => {
    assert.match(form, /apiGuardarCliente/);
    assert.doesNotMatch(form, /from\('customers'\)\.insert/);
    assert.match(lista, /apiArchivarCliente/);
    assert.match(lista, /mensajeConfirmarArchivar/);
    assert.match(ficha, /apiArchivarCliente/);
    assert.match(ficha, /mensajeConfirmarArchivar/);
    assert.match(ficha, /Abrió WhatsApp desde la ficha/);
  });
});
