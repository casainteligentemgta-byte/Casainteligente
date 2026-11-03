import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  asegurarAlmacenObra,
  codigoAlmacenCentralObra,
  MENSAJE_OBRA_SIN_ALMACEN_TELEGRAM,
  nombreAlmacenCentralObra,
} from './ubicacionesInventario';
import { crearFakeSupabase } from '../telegram/testing/fakeSupabase';

const PID = 'a1b2c3d4-e5f6-4789-8abc-def012345678';
const ENT = '11111111-1111-4111-8111-111111111111';
const OBRA_UBI = '22222222-2222-4222-8222-222222222222';

describe('codigo y nombre de almacén de obra', () => {
  it('usa DEP- + 12 hex del UUID en mayúsculas', () => {
    assert.equal(codigoAlmacenCentralObra(PID), 'DEP-A1B2C3D4E5F6');
  });

  it('nombra como los almacenes creados a mano', () => {
    assert.equal(nombreAlmacenCentralObra('TH-4'), 'ALMACÉN – TH-4');
    assert.equal(nombreAlmacenCentralObra('  '), 'ALMACÉN – Obra');
  });

  it('el mensaje de Telegram no habla de migraciones', () => {
    assert.match(MENSAJE_OBRA_SIN_ALMACEN_TELEGRAM, /no tiene almacén/i);
    assert.doesNotMatch(MENSAJE_OBRA_SIN_ALMACEN_TELEGRAM, /180|migración|migration/i);
  });
});

describe('asegurarAlmacenObra', () => {
  it('exige proyecto', async () => {
    await assert.rejects(
      () => asegurarAlmacenObra({} as never, '  ', 'Obra'),
      /Proyecto no indicado/,
    );
  });

  it('usa la RPC y devuelve el id', async () => {
    const supabase = {
      rpc: async (nombre: string, args: { p_proyecto_id: string; p_nombre: string }) => {
        assert.equal(nombre, 'ci_asegurar_almacen_obra');
        assert.equal(args.p_proyecto_id, PID);
        assert.equal(args.p_nombre, 'TH-4');
        return { data: 'ub-alm-rpc', error: null };
      },
    };
    const id = await asegurarAlmacenObra(supabase as never, PID, 'TH-4');
    assert.equal(id, 'ub-alm-rpc');
  });

  it('no cae al INSERT si la RPC niega permiso', async () => {
    const supabase = {
      rpc: async () => ({
        data: null,
        error: {
          code: '42501',
          message: 'permission denied for function ci_asegurar_almacen_obra',
        },
      }),
      from: () => {
        throw new Error('no debe consultar inv_ubicaciones si la RPC negó permiso');
      },
    };
    await assert.rejects(
      () => asegurarAlmacenObra(supabase as never, PID, 'Obra'),
      /permission denied/,
    );
  });

  it('si la RPC no existe, crea el almacén hijo de la ubicación obra', async () => {
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
    });

    const id = await asegurarAlmacenObra(db as never, PID, 'TH-4');
    const alm = db.tablas.inv_ubicaciones.find((u) => u.id === id);
    assert.ok(alm);
    assert.equal(alm.tipo, 'almacen_central');
    assert.equal(alm.nombre, 'ALMACÉN – TH-4');
    assert.equal(alm.codigo, 'DEP-A1B2C3D4E5F6');
    assert.equal(alm.ci_proyecto_id, PID);
    assert.equal(alm.ubicacion_padre_id, OBRA_UBI);
    assert.equal(alm.entidad_id, ENT);
    assert.equal(alm.activo, true);
  });

  it('no duplica si la obra ya tiene almacén', async () => {
    const db = crearFakeSupabase({
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
        {
          id: 'alm-ya',
          codigo: 'DEP-YA',
          nombre: 'ALMACÉN – TH-4',
          tipo: 'almacen_central',
          ci_proyecto_id: PID,
          ubicacion_padre_id: OBRA_UBI,
          activo: true,
        },
      ],
    });

    const id = await asegurarAlmacenObra(db as never, PID, 'TH-4');
    assert.equal(id, 'alm-ya');
    const almacenes = db.tablas.inv_ubicaciones.filter((u) => u.tipo === 'almacen_central');
    assert.equal(almacenes.length, 1);
  });
});
