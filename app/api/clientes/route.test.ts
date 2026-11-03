import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

describe('POST /api/clientes', () => {
  const codigo = readFileSync(join(process.cwd(), 'app/api/clientes/route.ts'), 'utf8');

  it('exige clientes.editar, asigna entidad activa y vincula duplicados en vez de crear otro', () => {
    assert.match(codigo, /requirePermisoWeb\('clientes\.editar'\)/);
    assert.match(codigo, /entidadActivaDesdeRoles/);
    assert.match(codigo, /payload\.entidad_id = entidadId/);
    assert.match(codigo, /altaOVincularCliente/);
    assert.match(codigo, /createSupabaseAdminOnlyClient/);
    assert.doesNotMatch(codigo, /supabaseAdminForRoute/);
  });
});
