import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ASEGURAR_UBICACION_OBRA_API,
  asegurarUbicacionObraCliente,
} from './asegurarUbicacionObraCliente';
import { asegurarUbicacionObra } from './ubicacionesInventario';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('asegurarUbicacionObraCliente', () => {
  it('exige proyecto', async () => {
    await assert.rejects(
      () => asegurarUbicacionObraCliente('  ', 'Obra Norte'),
      /Proyecto no indicado/,
    );
  });

  it('POST a la API y devuelve el id', async () => {
    const llamadas: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      llamadas.push({ url: String(input), init });
      return new Response(JSON.stringify({ ok: true, id: 'ub-obra-1' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;

    const id = await asegurarUbicacionObraCliente(
      'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      'Obra Norte',
    );

    assert.equal(id, 'ub-obra-1');
    assert.equal(llamadas.length, 1);
    assert.match(llamadas[0]!.url, new RegExp(`${ASEGURAR_UBICACION_OBRA_API}$`));
    assert.equal(llamadas[0]!.init?.method, 'POST');
    assert.equal(
      llamadas[0]!.init?.body,
      JSON.stringify({
        proyecto_id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
        nombre: 'Obra Norte',
      }),
    );
  });

  it('lanza el error de la API si falla', async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ error: 'No tiene permiso para esta acción' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })) as typeof fetch;

    await assert.rejects(
      () => asegurarUbicacionObraCliente('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', 'Obra'),
      /No tiene permiso para esta acción/,
    );
  });
});

describe('asegurarUbicacionObra (servidor)', () => {
  it('usa la RPC y devuelve el id', async () => {
    const supabase = {
      rpc: async (nombre: string, args: { p_proyecto_id: string; p_nombre: string }) => {
        assert.equal(nombre, 'ci_asegurar_ubicacion_obra');
        assert.equal(args.p_proyecto_id, 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee');
        assert.equal(args.p_nombre, 'Obra Norte');
        return { data: 'ub-rpc', error: null };
      },
    };
    const id = await asegurarUbicacionObra(
      supabase as never,
      'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      'Obra Norte',
    );
    assert.equal(id, 'ub-rpc');
  });

  it('no cae al INSERT si la RPC niega permiso', async () => {
    const supabase = {
      rpc: async () => ({
        data: null,
        error: {
          code: '42501',
          message: 'permission denied for function ci_asegurar_ubicacion_obra',
        },
      }),
      from: () => {
        throw new Error('no debe consultar inv_ubicaciones si la RPC negó permiso');
      },
    };
    await assert.rejects(
      () => asegurarUbicacionObra(supabase as never, 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', 'Obra'),
      /permission denied/,
    );
  });
});

describe('AlmacenFiltrosProvider no llama la RPC en el navegador', () => {
  it('usa el helper cliente y no importa asegurarUbicacionObra', () => {
    const src = readFileSync(
      join(process.cwd(), 'components/almacen/AlmacenFiltrosProvider.tsx'),
      'utf8',
    );
    assert.match(src, /asegurarUbicacionObraCliente/);
    assert.doesNotMatch(src, /ci_asegurar_ubicacion_obra/);
    assert.doesNotMatch(src, /asegurarUbicacionObra\s*\(/);
    assert.doesNotMatch(src, /import\s*\{[^}]*\basegurarUbicacionObra\b/);
  });
});
