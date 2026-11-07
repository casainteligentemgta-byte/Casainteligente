/**
 * Ejecutar: npx tsx --test lib/entidades/nombreEntidad.test.ts
 */
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  SELECT_CUSTOMERS_NOMBRE_DESDE_ENTIDAD,
  SELECT_NOMBRE_ENTIDAD,
  hintMigracion063Entidades,
  nombreEntidad,
} from './nombreEntidad';

const ROOT = process.cwd();
const HINT = 'customers!ci_entidades_customer_id_fkey(nombre)';
const EMBED_SIN_HINT = /customers\s*\(\s*nombre\s*\)/;
const ALLOW_UNHINTED = new Set(['app/operaciones/proyectos/page.tsx']);

describe('SELECT_NOMBRE_ENTIDAD', () => {
  it('desambigua el embed de customers con ci_entidades_customer_id_fkey', () => {
    assert.equal(SELECT_CUSTOMERS_NOMBRE_DESDE_ENTIDAD, HINT);
    assert.equal(SELECT_NOMBRE_ENTIDAD, `id, nombre, customer_id, ${HINT}`);
    assert.doesNotMatch(SELECT_NOMBRE_ENTIDAD, EMBED_SIN_HINT);
  });

  it('resuelve el nombre desde customers embebido', () => {
    assert.equal(nombreEntidad({ nombre: 'interno', customers: { nombre: 'Cliente SA' } }), 'Cliente SA');
    assert.equal(nombreEntidad({ nombre: 'interno', customers: [{ nombre: 'Cliente SA' }] }), 'Cliente SA');
    assert.equal(nombreEntidad({ nombre: 'interno' }), 'interno');
  });
});

describe('hintMigracion063Entidades', () => {
  it('añade el hint solo si la relación no existe', () => {
    const falta = 'relation "ci_entidades" does not exist';
    assert.equal(
      hintMigracion063Entidades(falta),
      ' — Ejecuta migración 063 (ci_entidades).',
    );
  });

  it('no añade el hint ante FKs ambiguas', () => {
    const ambiguo =
      'Could not embed because more than one relationship was found for ci_entidades and customers';
    assert.equal(hintMigracion063Entidades(ambiguo), '');
    assert.equal(hintMigracion063Entidades(`${ambiguo} — Ejecuta migración 063`), '');
  });
});

describe('embeds PostgREST ci_entidades ↔ customers', () => {
  it('no deja el embed de customers.nombre sin hint de FK (salvo ci_proyectos)', () => {
    const tracked = execSync('git ls-files "*.ts" "*.tsx"', { encoding: 'utf8' })
      .trim()
      .split('\n')
      .filter(Boolean);
    const leftovers: string[] = [];
    for (const rel of tracked) {
      if (ALLOW_UNHINTED.has(rel)) continue;
      if (rel.endsWith('.test.ts') || rel.endsWith('.test.tsx')) continue;
      const src = readFileSync(join(ROOT, rel), 'utf8');
      if (EMBED_SIN_HINT.test(src)) leftovers.push(rel);
    }
    assert.deepEqual(leftovers, []);
  });

  it('Configuración > Entidades y roles usan el hint de FK', () => {
    const entidades = readFileSync(
      join(ROOT, 'app/configuracion/entidades/EntidadesPatronoClient.tsx'),
      'utf8',
    );
    const roles = readFileSync(join(ROOT, 'lib/auth/ciUsuariosRolesDb.ts'), 'utf8');
    assert.match(entidades, /customers!ci_entidades_customer_id_fkey\(nombre\)/);
    assert.match(entidades, /hintMigracion063Entidades/);
    assert.doesNotMatch(entidades, /includes\('relation'\)/);
    assert.match(roles, /customers!ci_entidades_customer_id_fkey\(nombre\)/);
    assert.doesNotMatch(roles, /customers\(nombre\)/);
  });
});
