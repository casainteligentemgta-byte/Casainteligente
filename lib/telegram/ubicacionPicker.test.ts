import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  botonesDe,
  capturarTelegram,
  crearFakeSupabase,
} from './testing/fakeSupabase';
import { enviarPickerUbicacionesTelegram } from './ubicacionPicker';
import { MENSAJE_OBRA_SIN_ALMACEN_TELEGRAM } from '../almacen/ubicacionesInventario';

const PID = 'a1b2c3d4-e5f6-4789-8abc-def012345678';
const ENT = '11111111-1111-4111-8111-111111111111';
const OBRA_UBI = '22222222-2222-4222-8222-222222222222';

describe('enviarPickerUbicacionesTelegram', () => {
  let tg: ReturnType<typeof capturarTelegram> | undefined;
  afterEach(() => {
    tg?.restaurar();
    tg = undefined;
  });

  it('no menciona migraciones 180–181 en el fuente', () => {
    const src = readFileSync(join(process.cwd(), 'lib/telegram/ubicacionPicker.ts'), 'utf8');
    assert.doesNotMatch(src, /180/);
    assert.match(src, /MENSAJE_OBRA_SIN_ALMACEN_TELEGRAM/);
  });

  it('crea el almacén de la obra y muestra el picker', async () => {
    const db = crearFakeSupabase({
      ci_proyectos: [{ id: PID, nombre: 'TH-4', entidad_id: ENT }],
      inv_ubicaciones: [
        {
          id: OBRA_UBI,
          codigo: `OBRA-${PID.replace(/-/g, '')}`,
          nombre: 'TH-4',
          tipo: 'obra',
          ci_proyecto_id: PID,
          ubicacion_padre_id: null,
          activo: true,
        },
      ],
      ci_telegram_estados: [],
    });
    tg = capturarTelegram();

    await enviarPickerUbicacionesTelegram(db as never, '300', {
      pendingId: 'pend-1',
      proyectoId: PID,
      nombreObra: 'TH-4',
    });

    const alm = db.tablas.inv_ubicaciones.find((u) => u.tipo === 'almacen_central');
    assert.ok(alm);
    assert.equal(alm.nombre, 'ALMACÉN – TH-4');
    assert.equal(alm.ci_proyecto_id, PID);

    const ultimo = tg.enviados.filter((m) => m.metodo === 'sendMessage').at(-1);
    assert.match(String(ultimo?.text ?? ''), /almacén será despachada/i);
    assert.doesNotMatch(String(ultimo?.text ?? ''), /180/);
    assert.ok(botonesDe(ultimo).some((t) => /ALMACÉN/i.test(t)));
  });

  it('si no se puede crear, avisa en español sin jerga técnica', async () => {
    const db = crearFakeSupabase(
      {
        ci_proyectos: [{ id: PID, nombre: 'TH-4', entidad_id: ENT }],
        inv_ubicaciones: [
          {
            id: OBRA_UBI,
            codigo: 'OBRA-X',
            nombre: 'TH-4',
            tipo: 'obra',
            ci_proyecto_id: PID,
            ubicacion_padre_id: null,
            activo: true,
          },
        ],
        ci_telegram_estados: [],
      },
      { columnasAusentes: { inv_ubicaciones: ['entidad_id', 'codigo'] } },
    );
    const rpcOrig = db.rpc;
    db.rpc = async (nombre, args) => {
      if (nombre === 'ci_asegurar_almacen_obra') {
        return { data: null, error: { code: 'XX000', message: 'fallo al crear almacén' } };
      }
      return rpcOrig(nombre, args);
    };
    tg = capturarTelegram();

    await enviarPickerUbicacionesTelegram(db as never, '300', {
      pendingId: 'pend-1',
      proyectoId: PID,
      nombreObra: 'TH-4',
    });

    const ultimo = tg.enviados.filter((m) => m.metodo === 'sendMessage').at(-1);
    assert.equal(ultimo?.text, MENSAJE_OBRA_SIN_ALMACEN_TELEGRAM);
    assert.doesNotMatch(String(ultimo?.text ?? ''), /180|migración|migración/i);
  });
});
