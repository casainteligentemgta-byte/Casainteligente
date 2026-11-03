import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

describe('POST /api/clientes', () => {
  const codigo = readFileSync(join(process.cwd(), 'app/api/clientes/route.ts'), 'utf8');

  it('exige clientes.editar, asigna entidad activa y escribe con el cliente de sesión', () => {
    assert.match(codigo, /requirePermisoWeb\('clientes\.editar'\)/);
    assert.match(codigo, /entidadActivaDesdeRoles/);
    assert.match(codigo, /payload\.entidad_id = entidadId/);
    assert.match(codigo, /guardarClienteEnDb\(acceso\.supabase/);
    assert.doesNotMatch(codigo, /supabaseAdminForRoute/);
  });
});
