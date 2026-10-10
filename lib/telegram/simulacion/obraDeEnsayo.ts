/**
 * Obra ficticia donde corren los ensayos del bot.
 *
 * Vive en la base de datos real (solo hay una), con nombres «ZZ · …» para que quede al
 * final de las listas. Los ensayos solo pueden leer y escribir aquí: antes de cada paso
 * se comprueba que ningún botón ni sesión apunte a una obra o ubicación real.
 *
 * Los datos se crean con supabase/pruebas/obra_de_ensayo.sql.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { UsuarioSistemaSimulado } from '@/lib/telegram/simulacion/contexto';

export const OBRA_ENSAYO = {
  id: '00000000-0000-4000-a000-0000000000a1',
  nombre: 'ZZ · PRUEBAS DEL BOT',
} as const;

export const OBRA_ENSAYO_2 = {
  id: '00000000-0000-4000-a000-0000000000a2',
  nombre: 'ZZ · PRUEBAS DEL BOT 2',
} as const;

export const ALMACEN_ENSAYO = {
  id: '00000000-0000-4000-a000-0000000000b1',
  nombre: 'ZZ · Almacén de pruebas',
} as const;

export const MATERIAL_ENSAYO_1 = {
  id: '00000000-0000-4000-a000-0000000000d1',
  nombre: 'ZZ · MATERIAL DE PRUEBA 1',
  stockInicial: 100,
} as const;

export const MATERIAL_ENSAYO_2 = {
  id: '00000000-0000-4000-a000-0000000000d2',
  nombre: 'ZZ · MATERIAL DE PRUEBA 2',
  stockInicial: 50,
} as const;

export type ClavePersonaEnsayo = 'ing' | 'conta' | 'pm' | 'compra' | 'logi' | 'depo';

export type PersonaEnsayo = {
  clave: ClavePersonaEnsayo;
  nombre: string;
  /** Rol en la nómina de la obra de ensayo (fila real, solo de esa obra). */
  rol: string;
  /** Rol en el departamento de compras. Es global, así que solo existe dentro del ensayo. */
  rolSistema: UsuarioSistemaSimulado['rol'] | null;
  /** Fila fija en ci_proyecto_nomina. */
  nominaId: string;
  chatId: number;
};

/**
 * Personas del ensayo. Sus chats no pueden existir en Telegram (los reales van por
 * 10 dígitos). Nadie tiene rol «admin» en la nómina a propósito: el sistema copia ese
 * rol como Administrador global y recibiría avisos de las obras reales.
 */
export const PERSONAS_ENSAYO: Record<ClavePersonaEnsayo, PersonaEnsayo> = {
  ing: {
    clave: 'ing',
    nombre: 'Ing. Ensayo',
    rol: 'ingeniero_residente',
    rolSistema: 'Solicitante',
    nominaId: '00000000-0000-4000-a000-0000000000e1',
    chatId: 9_990_000_000_001,
  },
  depo: {
    clave: 'depo',
    nombre: 'Depo Ensayo',
    rol: 'depositario',
    rolSistema: null,
    nominaId: '00000000-0000-4000-a000-0000000000e2',
    chatId: 9_990_000_000_002,
  },
  pm: {
    clave: 'pm',
    nombre: 'PM Ensayo',
    rol: 'pm_obra',
    rolSistema: 'Aprobador',
    nominaId: '00000000-0000-4000-a000-0000000000e3',
    chatId: 9_990_000_000_003,
  },
  conta: {
    clave: 'conta',
    nombre: 'Conta Ensayo',
    rol: 'contador',
    rolSistema: 'Contador',
    nominaId: '00000000-0000-4000-a000-0000000000e4',
    chatId: 9_990_000_000_004,
  },
  compra: {
    clave: 'compra',
    nombre: 'Compra Ensayo',
    rol: 'comprador',
    rolSistema: 'Comprador',
    nominaId: '00000000-0000-4000-a000-0000000000e5',
    chatId: 9_990_000_000_005,
  },
  logi: {
    clave: 'logi',
    nombre: 'Logi Ensayo',
    rol: 'logistica',
    rolSistema: null,
    nominaId: '00000000-0000-4000-a000-0000000000e6',
    chatId: 9_990_000_000_006,
  },
};

/** Las personas con rol en el departamento de compras, tal como las ve el bot en un ensayo. */
export function usuariosSistemaDeEnsayo(): UsuarioSistemaSimulado[] {
  const usuarios: UsuarioSistemaSimulado[] = [];
  for (const p of Object.values(PERSONAS_ENSAYO)) {
    if (!p.rolSistema) continue;
    usuarios.push({
      id: p.nominaId,
      nombre: p.nombre,
      telegram_id: p.chatId,
      rol: p.rolSistema,
      proyecto_id: OBRA_ENSAYO.id,
    });
  }
  return usuarios;
}

const OBRAS = [OBRA_ENSAYO.id, OBRA_ENSAYO_2.id] as const;
const MATERIALES = [MATERIAL_ENSAYO_1.id, MATERIAL_ENSAYO_2.id] as const;
const CHATS = Object.values(PERSONAS_ENSAYO).map((p) => String(p.chatId));

const RE_UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

export function esChatDeEnsayo(chatId: string | number): boolean {
  return CHATS.includes(String(chatId));
}

export function uuidsEn(texto: string | null | undefined): string[] {
  return Array.from(new Set((String(texto ?? '').match(RE_UUID) ?? []).map((u) => u.toLowerCase())));
}

export type ObraDeEnsayoLista = {
  /** Ubicaciones de las obras de ensayo (almacén + ubicación automática de cada obra). */
  ubicaciones: Array<{ id: string; nombre: string; tipo: string; obraId: string }>;
  ubicacionObra1: string;
  ubicacionObra2: string;
};

/** Comprueba que la obra de ensayo existe y devuelve sus ubicaciones. */
export async function cargarObraDeEnsayo(supabase: SupabaseClient): Promise<ObraDeEnsayoLista> {
  const { data: obras, error: eObras } = await supabase
    .from('ci_proyectos')
    .select('id,nombre')
    .in('id', [...OBRAS]);
  if (eObras) throw new Error(`No se pudo leer la obra de ensayo: ${eObras.message}`);
  const filasObra = (obras ?? []) as Array<{ id: string; nombre: string | null }>;
  if (filasObra.length !== OBRAS.length) {
    throw new Error('Falta la obra de ensayo. Ejecute supabase/pruebas/obra_de_ensayo.sql.');
  }
  // Cinturón de seguridad: estos identificadores solo valen si siguen siendo la obra ficticia.
  for (const o of filasObra) {
    if (!String(o.nombre ?? '').startsWith('ZZ ·')) {
      throw new Error(`La obra ${o.id} ya no es la obra de ensayo («${o.nombre}»). Ensayo cancelado.`);
    }
  }

  const { data: ubic, error: eUbic } = await supabase
    .from('inv_ubicaciones')
    .select('id,nombre,tipo,ci_proyecto_id')
    .in('ci_proyecto_id', [...OBRAS]);
  if (eUbic) throw new Error(`No se pudieron leer las ubicaciones de ensayo: ${eUbic.message}`);
  const ubicaciones = ((ubic ?? []) as Array<Record<string, unknown>>).map((u) => ({
    id: String(u.id),
    nombre: String(u.nombre ?? ''),
    tipo: String(u.tipo ?? ''),
    obraId: String(u.ci_proyecto_id ?? ''),
  }));
  const deObra = (obraId: string) => ubicaciones.find((u) => u.obraId === obraId && u.tipo === 'obra')?.id;
  const ubicacionObra1 = deObra(OBRA_ENSAYO.id);
  const ubicacionObra2 = deObra(OBRA_ENSAYO_2.id);
  if (!ubicacionObra1 || !ubicacionObra2 || !ubicaciones.some((u) => u.id === ALMACEN_ENSAYO.id)) {
    throw new Error('A la obra de ensayo le faltan ubicaciones. Ejecute supabase/pruebas/obra_de_ensayo.sql.');
  }
  return { ubicaciones, ubicacionObra1, ubicacionObra2 };
}

/**
 * ¿Alguno de estos identificadores es una obra o una ubicación REAL?
 * Devuelve la descripción del primero que lo sea, o null si todos son de ensayo
 * (o no son ni obra ni ubicación).
 */
export async function referenciaReal(
  supabase: SupabaseClient,
  obra: ObraDeEnsayoLista,
  ids: string[],
): Promise<string | null> {
  const propias = new Set<string>([...OBRAS, ...obra.ubicaciones.map((u) => u.id.toLowerCase())]);
  const ajenas = ids.map((i) => i.toLowerCase()).filter((i) => !propias.has(i));
  if (!ajenas.length) return null;

  const [{ data: proyectos }, { data: ubicaciones }] = await Promise.all([
    supabase.from('ci_proyectos').select('id,nombre').in('id', ajenas),
    supabase.from('inv_ubicaciones').select('id,nombre,ci_proyecto_id').in('id', ajenas),
  ]);
  const p = ((proyectos ?? []) as Array<{ id: string; nombre: string | null }>)[0];
  if (p) return `la obra real «${p.nombre ?? p.id}»`;
  // Las ubicaciones virtuales sin obra (devoluciones, bajas, cuarentena) son compartidas.
  const u = ((ubicaciones ?? []) as Array<{ id: string; nombre: string | null; ci_proyecto_id: string | null }>).find(
    (x) => x.ci_proyecto_id != null,
  );
  if (u) return `la ubicación real «${u.nombre ?? u.id}»`;
  return null;
}

export type ResultadoLimpieza = { tabla: string; ok: boolean; detalle?: string };

/**
 * Deja la obra de ensayo como al principio: sin movimientos, sin sesiones de bot y con
 * el stock inicial. Solo toca filas de la obra, las ubicaciones, los materiales y los
 * chats de ensayo.
 */
export async function reiniciarObraDeEnsayo(
  supabase: SupabaseClient,
  obra: ObraDeEnsayoLista,
): Promise<ResultadoLimpieza[]> {
  const ubicacionIds = obra.ubicaciones.map((u) => u.id);
  const pasos: ResultadoLimpieza[] = [];
  const anotar = (tabla: string, error: { message?: string; code?: string } | null) => {
    // 42P01: la tabla no existe en esta base (migración sin aplicar) → nada que limpiar.
    const ok = !error || error.code === '42P01' || error.code === 'PGRST205';
    pasos.push(ok ? { tabla, ok } : { tabla, ok, detalle: error?.message });
  };

  // Las personas del ensayo se dejan siempre como dice el código (nómina de la obra ficticia).
  anotar(
    'ci_proyecto_nomina (personas)',
    (
      await supabase.from('ci_proyecto_nomina').upsert(
        Object.values(PERSONAS_ENSAYO).map((p) => ({
          id: p.nominaId,
          proyecto_id: OBRA_ENSAYO.id,
          categoria: 'empleado',
          rol: p.rol,
          nombre: p.nombre,
          telegram_chat_id: p.chatId,
          activo: true,
          notas: 'Persona ficticia de los ensayos del bot.',
        })),
        { onConflict: 'id' },
      )
    ).error,
  );
  // Ningún chat de ensayo debe quedar como usuario global del departamento de compras.
  anotar(
    'ci_usuarios_sistema_telegram (chats de ensayo)',
    (
      await supabase
        .from('ci_usuarios_sistema_telegram')
        .delete()
        .in('telegram_id', Object.values(PERSONAS_ENSAYO).map((p) => p.chatId))
    ).error,
  );

  anotar('ci_telegram_estados', (await supabase.from('ci_telegram_estados').delete().in('chat_id', CHATS)).error);

  // --- Cadena de compras (de lo más dependiente a lo menos) ---
  const porObra = async (tabla: string) =>
    anotar(tabla, (await supabase.from(tabla).delete().in('proyecto_id', [...OBRAS])).error);

  await porObra('ci_compras_retiros');
  await porObra('ci_recepciones_campo'); // sus líneas se borran en cascada

  const { data: facturas, error: eFacturas } = await supabase
    .from('purchase_invoices')
    .select('id')
    .in('proyecto_id', [...OBRAS]);
  anotar('purchase_invoices (lectura)', eFacturas);
  const facturaIds = ((facturas ?? []) as Array<{ id: string }>).map((f) => f.id);
  if (facturaIds.length) {
    anotar(
      'quality_inspections',
      (await supabase.from('quality_inspections').delete().in('invoice_id', facturaIds)).error,
    );
    anotar(
      'compras_facturas',
      (await supabase.from('compras_facturas').delete().in('purchase_invoice_id', facturaIds)).error,
    );
  }
  await porObra('contabilidad_compras'); // sus líneas se borran en cascada
  if (facturaIds.length) {
    anotar('purchase_invoices', (await supabase.from('purchase_invoices').delete().in('id', facturaIds)).error);
  }
  await porObra('ci_facturas_canal_pendientes');
  await porObra('ci_procuras'); // su historial de estados se borra en cascada
  await porObra('gastos_obra');
  await porObra('ci_notificaciones');
  // Una compra actualiza el costo y el stock global del material: se dejan en cero.
  anotar(
    'global_inventory (materiales de ensayo)',
    (
      await supabase
        .from('global_inventory')
        .update({
          stock_available: 0,
          stock_quarantine: 0,
          last_purchase_price: null,
          last_purchase_date: null,
          average_weighted_cost: null,
          last_supplier_id: null,
        })
        .in('id', [...MATERIALES])
    ).error,
  );

  anotar(
    'inv_requerimientos_salida',
    (await supabase.from('inv_requerimientos_salida').delete().in('proyecto_id', [...OBRAS])).error,
  );

  const { data: egresos, error: eEgresos } = await supabase
    .from('inv_egresos_campo')
    .select('id')
    .in('proyecto_id', [...OBRAS]);
  anotar('inv_egresos_campo (lectura)', eEgresos);
  const egresoIds = ((egresos ?? []) as Array<{ id: string }>).map((e) => e.id);
  if (egresoIds.length) {
    anotar(
      'inv_egresos_campo_lineas',
      (await supabase.from('inv_egresos_campo_lineas').delete().in('egreso_id', egresoIds)).error,
    );
    anotar('inv_egresos_campo', (await supabase.from('inv_egresos_campo').delete().in('id', egresoIds)).error);
  }

  anotar(
    'ci_obra_movimientos_material',
    (await supabase.from('ci_obra_movimientos_material').delete().in('proyecto_id', [...OBRAS])).error,
  );
  anotar('inv_movimientos', (await supabase.from('inv_movimientos').delete().in('material_id', [...MATERIALES])).error);

  const { data: lineas, error: eLineas } = await supabase
    .from('transferencias_inventario_lineas')
    .select('transferencia_id')
    .in('material_id', [...MATERIALES]);
  anotar('transferencias_inventario_lineas (lectura)', eLineas);
  const { data: porUbicacion, error: eTransf } = await supabase
    .from('transferencias_inventario')
    .select('id')
    .in('origen_ubicacion_id', ubicacionIds);
  anotar('transferencias_inventario (lectura)', eTransf);
  const transferenciaIds = Array.from(
    new Set([
      ...((lineas ?? []) as Array<{ transferencia_id: string }>).map((l) => l.transferencia_id),
      ...((porUbicacion ?? []) as Array<{ id: string }>).map((t) => t.id),
    ]),
  );
  if (transferenciaIds.length) {
    // Las líneas y su imputación a partidas se borran en cascada con la transferencia.
    anotar(
      'transferencias_inventario',
      (await supabase.from('transferencias_inventario').delete().in('id', transferenciaIds)).error,
    );
  }

  anotar('inventario_stock', (await supabase.from('inventario_stock').delete().in('material_id', [...MATERIALES])).error);
  anotar(
    'inventario_stock (inicial)',
    (
      await supabase.from('inventario_stock').insert([
        { ubicacion_id: ALMACEN_ENSAYO.id, material_id: MATERIAL_ENSAYO_1.id, cantidad_disponible: MATERIAL_ENSAYO_1.stockInicial },
        { ubicacion_id: ALMACEN_ENSAYO.id, material_id: MATERIAL_ENSAYO_2.id, cantidad_disponible: MATERIAL_ENSAYO_2.stockInicial },
      ])
    ).error,
  );

  anotar('fotos de ensayo (Storage)', await borrarFotosDeEnsayo(supabase));

  return pasos;
}

const BUCKET_FOTOS = 'ci-proyectos-media';

/**
 * Borra las fotos de relleno que subieron los ensayos. Solo mira carpetas que llevan
 * el identificador de una obra o de un chat de ensayo.
 */
async function borrarFotosDeEnsayo(supabase: SupabaseClient): Promise<{ message?: string } | null> {
  const carpetas = [
    ...OBRAS.map((id) => `telegram-movimientos/${id}`),
    ...CHATS.map((chat) => `telegram-movimientos/traspasos/${chat}`),
  ];
  const bucket = supabase.storage.from(BUCKET_FOTOS);
  const archivos: string[] = [];

  // Storage lista una carpeta a la vez: se baja hasta dos niveles (obra/tipo/archivo).
  const listar = async (carpeta: string, nivel: number): Promise<{ message?: string } | null> => {
    const { data, error } = await bucket.list(carpeta, { limit: 1000 });
    if (error) return error;
    for (const item of (data ?? []) as Array<{ name: string; id?: string | null }>) {
      const ruta = `${carpeta}/${item.name}`;
      if (item.id) archivos.push(ruta);
      else if (nivel < 2) {
        const fallo = await listar(ruta, nivel + 1);
        if (fallo) return fallo;
      }
    }
    return null;
  };

  for (const carpeta of carpetas) {
    const fallo = await listar(carpeta, 0);
    if (fallo) return fallo;
  }
  for (let i = 0; i < archivos.length; i += 100) {
    const { error } = await bucket.remove(archivos.slice(i, i + 100));
    if (error) return error;
  }
  return null;
}

/** Stock disponible de un material de ensayo en una ubicación (0 si no hay fila). */
export async function stockDeEnsayo(
  supabase: SupabaseClient,
  ubicacionId: string,
  materialId: string,
): Promise<number> {
  const { data } = await supabase
    .from('inventario_stock')
    .select('cantidad_disponible')
    .eq('ubicacion_id', ubicacionId)
    .eq('material_id', materialId)
    .maybeSingle();
  return Number((data as { cantidad_disponible?: number } | null)?.cantidad_disponible) || 0;
}
