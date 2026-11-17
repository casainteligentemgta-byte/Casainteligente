import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  botonesDe,
  capturarTelegram,
  crearFakeSupabase,
  type FakeSupabase,
} from '@/lib/telegram/testing/fakeSupabase';
import { iniciarSalidaEgresoTrasObra } from '@/lib/telegram/salidaEgresoFlujo';
import {
  almacenOrigenObra,
  enviarPickerOrigenSalidaTelegram,
  hayAlmacenesOrigenSalida,
} from '@/lib/telegram/salidaOrigenPicker';

const CHAT = '900';
const RANCHO = 'e45497e0-5c4f-41dc-bc68-aa2274b1e100';
const GASPAR = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const ENTIDAD = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const ALM_RANCHO = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1';
const ALM_GASPAR = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1';

const NOMBRE_GASPAR = 'ALMACÉN – OBRA GASPAR MARCANO – ETAPA 2';
const NOMBRE_RANCHO = 'ALMACÉN – RANCHO FLAMBOYANT';

function almacen(id: string, nombre: string, proyectoId: string) {
  return {
    id,
    codigo: `DEP-${id.slice(0, 8)}`,
    nombre,
    tipo: 'almacen_central',
    ci_proyecto_id: proyectoId,
    entidad_id: ENTIDAD,
    activo: true,
    ubicacion_padre_id: null,
  };
}

function dbDosObras(opts?: {
  nomina?: Array<Record<string, unknown>>;
  sinAlmacenRancho?: boolean;
}): FakeSupabase {
  const almacenes = [
    almacen(ALM_GASPAR, NOMBRE_GASPAR, GASPAR),
    ...(opts?.sinAlmacenRancho ? [] : [almacen(ALM_RANCHO, NOMBRE_RANCHO, RANCHO)]),
  ];
  return crearFakeSupabase({
    ci_telegram_estados: [],
    ci_usuarios_sistema_telegram: [],
    ci_obra_empleados: [],
    ci_empleados: [],
    ci_proyectos: [
      { id: RANCHO, nombre: 'Rancho Flamboyant', entidad_id: ENTIDAD },
      { id: GASPAR, nombre: 'Obra Gaspar Marcano – Etapa 2', entidad_id: ENTIDAD },
    ],
    ci_proyecto_nomina: opts?.nomina ?? [],
    inv_ubicaciones: almacenes,
  });
}

function nominaDepositario(proyectoId: string) {
  return [
    {
      telegram_chat_id: CHAT,
      rol: 'depositario',
      activo: true,
      proyecto_id: proyectoId,
    },
  ];
}

function origenGuardado(db: FakeSupabase): string | undefined {
  const row = db.tablas.ci_telegram_estados.find((f) => String(f.chat_id) === CHAT);
  const meta = (row?.metadata ?? {}) as Record<string, unknown>;
  return meta.origen_ubicacion_id as string | undefined;
}

describe('origen de /salida a obra: almacén de la obra, no el de otra', () => {
  let telegram: ReturnType<typeof capturarTelegram>;

  beforeEach(() => {
    telegram = capturarTelegram();
  });
  afterEach(() => {
    telegram.restaurar();
  });

  it('el almacén de Gaspar ordena primero: sin filtrar por obra se elegiría el ajeno', () => {
    assert.ok(
      NOMBRE_GASPAR.localeCompare(NOMBRE_RANCHO, 'es') < 0,
      'Gaspar debe ordenar antes que Rancho para reproducir el bug',
    );
  });

  it('el origen de Rancho es su propio almacén aunque el de Gaspar ordene primero', async () => {
    const db = dbDosObras();
    const origen = await almacenOrigenObra(db as unknown as SupabaseClient, RANCHO);
    assert.equal(origen?.id, ALM_RANCHO);
    assert.equal(origen?.nombre, NOMBRE_RANCHO);
  });

  it('el picker OCR de salida solo muestra el almacén de la obra', async () => {
    const db = dbDosObras();
    await enviarPickerOrigenSalidaTelegram(db as unknown as SupabaseClient, CHAT, {
      proyectoId: RANCHO,
      nombreObra: 'Rancho Flamboyant',
      nMateriales: 2,
    });
    const botones = botonesDe(telegram.enviados.at(-1));
    assert.ok(botones.some((t) => /RANCHO FLAMBOYANT/i.test(t)));
    assert.equal(
      botones.some((t) => /GASPAR/i.test(t)),
      false,
    );
  });

  it('si la obra no tiene almacén, no usa el de otra obra', async () => {
    const db = dbDosObras({ sinAlmacenRancho: true });
    const origen = await almacenOrigenObra(db as unknown as SupabaseClient, RANCHO);
    assert.equal(origen, null);

    await iniciarSalidaEgresoTrasObra(db as unknown as SupabaseClient, CHAT, RANCHO);
    const textos = telegram.enviados.map((m) => String(m.text ?? '')).join('\n');
    assert.match(textos, /no tiene almacén configurado/i);
    assert.equal(origenGuardado(db), undefined);
    assert.doesNotMatch(textos, /No hay stock disponible/);
  });

  it('iniciarSalidaEgresoTrasObra guarda el almacén de la obra elegida', async () => {
    const db = dbDosObras();
    await iniciarSalidaEgresoTrasObra(db as unknown as SupabaseClient, CHAT, RANCHO);
    assert.equal(origenGuardado(db), ALM_RANCHO);
    const textos = telegram.enviados.map((m) => String(m.text ?? '')).join('\n');
    assert.match(textos, /Rancho Flamboyant/);
    assert.doesNotMatch(textos, /GASPAR|No hay stock disponible/);
  });

  it('el depositario de Rancho no ve ni usa el almacén de Gaspar', async () => {
    const db = dbDosObras({ nomina: nominaDepositario(RANCHO) });
    const sb = db as unknown as SupabaseClient;

    const origenRancho = await almacenOrigenObra(sb, RANCHO, CHAT);
    assert.equal(origenRancho?.id, ALM_RANCHO);

    assert.equal(await hayAlmacenesOrigenSalida(sb, GASPAR, CHAT), false);
    assert.equal(await hayAlmacenesOrigenSalida(sb, GASPAR), true);

    await enviarPickerOrigenSalidaTelegram(sb, CHAT, {
      proyectoId: RANCHO,
      nombreObra: 'Rancho Flamboyant',
      nMateriales: 1,
    });
    const botones = botonesDe(telegram.enviados.at(-1));
    assert.ok(botones.some((t) => /RANCHO FLAMBOYANT/i.test(t)));
    assert.equal(botones.some((t) => /GASPAR/i.test(t)), false);

    await iniciarSalidaEgresoTrasObra(sb, CHAT, GASPAR);
    const textos = telegram.enviados.map((m) => String(m.text ?? '')).join('\n');
    assert.match(textos, /no tiene almacén configurado/i);
    assert.notEqual(origenGuardado(db), ALM_GASPAR);
  });
});
