/**
 * Ejecutar: npx tsx --test lib/rrhh/eliminarEmpleado.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { eliminarEmpleado } from './eliminarEmpleado';

type Call = { table: string; op: string; column?: string; value?: unknown };

function makeFakeClient(opts?: {
  tareas?: { id: string }[];
  failOn?: string;
  missingTables?: string[];
}) {
  const calls: Call[] = [];
  const missing = new Set(opts?.missingTables ?? []);
  const failOn = opts?.failOn;

  const client = {
    from(table: string) {
      const state: { column?: string; value?: unknown; inCol?: string; inVals?: unknown } = {};
      const api = {
        select(_cols: string) {
          return {
            eq(column: string, value: unknown) {
              calls.push({ table, op: 'select', column, value });
              if (missing.has(table)) {
                return Promise.resolve({
                  data: null,
                  error: { code: '42P01', message: `relation "${table}" does not exist` },
                });
              }
              if (failOn === `${table}.select`) {
                return Promise.resolve({
                  data: null,
                  error: { message: `fail select ${table}` },
                });
              }
              if (table === 'obreros_expediente_tarea') {
                return Promise.resolve({ data: opts?.tareas ?? [], error: null });
              }
              return Promise.resolve({ data: [], error: null });
            },
          };
        },
        delete() {
          return {
            eq(column: string, value: unknown) {
              calls.push({ table, op: 'delete', column, value });
              if (missing.has(table)) {
                return Promise.resolve({
                  error: { code: 'PGRST205', message: `Could not find the table '${table}'` },
                });
              }
              if (failOn === table) {
                return Promise.resolve({ error: { message: `fail delete ${table}` } });
              }
              return Promise.resolve({ error: null });
            },
            in(column: string, values: unknown) {
              calls.push({ table, op: 'delete.in', column, value: values });
              if (missing.has(table)) {
                return Promise.resolve({
                  error: { code: '42P01', message: `relation "${table}" does not exist` },
                });
              }
              if (failOn === table) {
                return Promise.resolve({ error: { message: `fail delete ${table}` } });
              }
              return Promise.resolve({ error: null });
            },
          };
        },
        eq(column: string, value: unknown) {
          state.column = column;
          state.value = value;
          return api;
        },
      };
      return api;
    },
  };

  return { client: client as never, calls };
}

describe('eliminarEmpleado', () => {
  it('rechaza id vacío', async () => {
    const { client } = makeFakeClient();
    const r = await eliminarEmpleado(client, '  ');
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.error, /requerido/i);
  });

  it('borra contratos y dependencias antes de ci_empleados', async () => {
    const { client, calls } = makeFakeClient({
      tareas: [{ id: 'tarea-1' }],
    });
    const r = await eliminarEmpleado(client, 'emp-1');
    assert.equal(r.ok, true);

    const deleteTables = calls.filter((c) => c.op.startsWith('delete')).map((c) => c.table);
    assert.deepEqual(deleteTables, [
      'obreros_transferencia_dinero',
      'obreros_expediente_tarea',
      'project_assignments',
      'ci_obra_empleados',
      'ci_contratos_empleado_obra',
      'ci_empleados',
    ]);

    const contratos = calls.find(
      (c) => c.table === 'ci_contratos_empleado_obra' && c.op === 'delete',
    );
    assert.equal(contratos?.column, 'empleado_id');
    assert.equal(contratos?.value, 'emp-1');

    const empIdx = deleteTables.indexOf('ci_empleados');
    const ctrIdx = deleteTables.indexOf('ci_contratos_empleado_obra');
    assert.ok(ctrIdx >= 0 && empIdx > ctrIdx);
  });

  it('tolera tablas opcionales ausentes', async () => {
    const { client } = makeFakeClient({
      missingTables: ['obreros_expediente_tarea', 'obreros_transferencia_dinero', 'project_assignments'],
    });
    const r = await eliminarEmpleado(client, 'emp-2');
    assert.equal(r.ok, true);
  });

  it('propaga error de FK/contrato', async () => {
    const { client } = makeFakeClient({ failOn: 'ci_contratos_empleado_obra' });
    const r = await eliminarEmpleado(client, 'emp-3');
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.step, 'ci_contratos_empleado_obra');
      assert.match(r.error, /fail delete/i);
    }
  });
});
