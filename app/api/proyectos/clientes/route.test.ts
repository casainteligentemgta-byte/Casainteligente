import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

describe('GET /api/proyectos/clientes', () => {
  const codigo = readFileSync(join(process.cwd(), 'app/api/proyectos/clientes/route.ts'), 'utf8');

  it('exige clientes.ver y no usa service_role', () => {
    assert.match(codigo, /requirePermisoWeb\('clientes\.ver'\)/);
    assert.doesNotMatch(codigo, /supabaseAdminForRoute/);
    assert.doesNotMatch(codigo, /SERVICE_ROLE/);
    assert.doesNotMatch(codigo, /\.select\('\*'\)/);
    assert.match(codigo, /acceso\.supabase/);
  });
});
