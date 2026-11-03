import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolverUsuarioAuthDesdeTelegram } from './resolverUsuarioAuthTelegram';

function fakeDb(tables: Record<string, unknown[]>) {
  return {
    from(table: string) {
      const rows = tables[table] ?? [];
      const filters: Array<(r: Record<string, unknown>) => boolean> = [];
      const api = {
        select() {
          return api;
        },
        eq(col: string, val: unknown) {
          filters.push((r) => r[col] == val);
          return api;
        },
        ilike(col: string, val: string) {
          const n = val.toLowerCase();
          filters.push((r) => String(r[col] ?? '').toLowerCase() === n);
          return api;
        },
        not(col: string, _op: string, _val: unknown) {
          filters.push((r) => r[col] != null && r[col] !== '');
          return api;
        },
        limit() {
          return api;
        },
        maybeSingle: async () => {
          const hit = (rows as Record<string, unknown>[]).find((r) => filters.every((f) => f(r)));
          return { data: hit ?? null };
        },
      };
      return api;
    },
  };
}

describe('resolverUsuarioAuthDesdeTelegram', () => {
  it('resuelve auth_user_id vía perfiles.email → employees', async () => {
    const db = fakeDb({
      perfiles: [{ telegram_chat_id: 99, email: 'ana@obra.com' }],
      employees: [{ email: 'ana@obra.com', auth_user_id: 'user-ana' }],
      ci_empleados: [],
      ci_proyecto_nomina: [],
    });
    const id = await resolverUsuarioAuthDesdeTelegram(db as never, '99');
    assert.equal(id, 'user-ana');
  });

  it('devuelve null si no hay mapping', async () => {
    const db = fakeDb({
      perfiles: [],
      employees: [],
      ci_empleados: [{ telegram_chat_id: 1, email: null }],
      ci_proyecto_nomina: [],
    });
    const id = await resolverUsuarioAuthDesdeTelegram(db as never, '1');
    assert.equal(id, null);
  });
});
