/**
 * Doble mínimo de Supabase para pruebas de flujos del bot (node:test).
 * Guarda filas en memoria y entiende solo lo que usan los flujos probados:
 * select / insert / update / upsert con filtros eq, gt, in, is, not, order y limit;
 * y el bucket de Storage (upload / getPublicUrl).
 *
 * No es un emulador de PostgREST: si un flujo nuevo usa algo que falta aquí,
 * la prueba falla con «no soportado» en lugar de pasar en falso.
 */

type Fila = Record<string, unknown>;
type Filtro = (f: Fila) => boolean;
type Resultado = { data: unknown; error: { message: string; code?: string } | null };

export type FakeSupabase = {
  from: (tabla: string) => Consulta;
  storage: { from: (bucket: string) => FakeBucket };
  rpc: (nombre: string, args?: unknown) => Promise<Resultado>;
  /** Filas en memoria por tabla. */
  tablas: Record<string, Fila[]>;
  /** Rutas subidas a Storage, como `bucket/ruta`. */
  subidas: string[];
};

type FakeBucket = {
  upload: (ruta: string, cuerpo: unknown, opts?: unknown) => Promise<Resultado>;
  getPublicUrl: (ruta: string) => { data: { publicUrl: string } };
  createSignedUrls: (
    rutas: string[],
    segundos: number,
  ) => Promise<{ data: Array<{ signedUrl: string }> | null; error: { message: string } | null }>;
};

export type OpcionesFakeSupabase = {
  /** Tablas que «no existen»: toda consulta responde 42P01 (migración sin aplicar). */
  tablasAusentes?: string[];
  /** Columnas que «no existen» por tabla: escribirlas responde 42703. */
  columnasAusentes?: Record<string, string[]>;
  /** Si es true, toda subida a Storage falla. */
  storageCaido?: boolean;
};

let secuencia = 0;
function nuevoId(): string {
  secuencia += 1;
  return `00000000-0000-4000-8000-${String(secuencia).padStart(12, '0')}`;
}

class Consulta implements PromiseLike<Resultado> {
  private filtros: Filtro[] = [];
  private accion: 'select' | 'insert' | 'update' | 'upsert' = 'select';
  private carga: Fila | Fila[] | null = null;
  private conflicto: string | null = null;
  private orden: { col: string; asc: boolean } | null = null;
  private tope: number | null = null;
  private unica: 'maybe' | 'single' | null = null;

  constructor(
    private readonly db: FakeSupabase,
    private readonly tabla: string,
    private readonly opts: OpcionesFakeSupabase,
  ) {}

  select(_cols?: string, _opts?: unknown): this {
    return this;
  }
  insert(carga: Fila | Fila[]): this {
    this.accion = 'insert';
    this.carga = carga;
    return this;
  }
  update(carga: Fila): this {
    this.accion = 'update';
    this.carga = carga;
    return this;
  }
  upsert(carga: Fila | Fila[], o?: { onConflict?: string }): this {
    this.accion = 'upsert';
    this.carga = carga;
    this.conflicto = o?.onConflict ?? 'id';
    return this;
  }
  eq(col: string, v: unknown): this {
    this.filtros.push((f) => String(f[col] ?? '') === String(v ?? ''));
    return this;
  }
  gt(col: string, v: number): this {
    this.filtros.push((f) => Number(f[col]) > v);
    return this;
  }
  in(col: string, vs: unknown[]): this {
    const set = new Set(vs.map((v) => String(v)));
    this.filtros.push((f) => set.has(String(f[col] ?? '')));
    return this;
  }
  is(col: string, v: null): this {
    this.filtros.push((f) => (f[col] ?? null) === v);
    return this;
  }
  not(col: string, op: string, v: unknown): this {
    if (op !== 'is' || v !== null) throw new Error(`fakeSupabase: not(${op}) no soportado`);
    this.filtros.push((f) => (f[col] ?? null) !== null);
    return this;
  }
  order(col: string, o?: { ascending?: boolean }): this {
    this.orden = { col, asc: o?.ascending !== false };
    return this;
  }
  limit(n: number): this {
    this.tope = n;
    return this;
  }
  maybeSingle(): Promise<Resultado> {
    this.unica = 'maybe';
    return this.ejecutar();
  }
  single(): Promise<Resultado> {
    this.unica = 'single';
    return this.ejecutar();
  }
  then<A = Resultado, B = never>(
    ok?: ((v: Resultado) => A | PromiseLike<A>) | null,
    mal?: ((e: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return this.ejecutar().then(ok, mal);
  }

  private columnaAusente(carga: Fila | Fila[] | null): string | null {
    const ausentes = this.opts.columnasAusentes?.[this.tabla] ?? [];
    const filas = carga == null ? [] : Array.isArray(carga) ? carga : [carga];
    for (const f of filas) {
      const hit = ausentes.find((c) => c in f);
      if (hit) return hit;
    }
    return null;
  }

  private async ejecutar(): Promise<Resultado> {
    if (this.opts.tablasAusentes?.includes(this.tabla)) {
      return {
        data: null,
        error: { code: '42P01', message: `relation "public.${this.tabla}" does not exist` },
      };
    }
    const faltante = this.columnaAusente(this.carga);
    if (faltante) {
      return {
        data: null,
        error: { code: '42703', message: `column "${faltante}" of relation "${this.tabla}" does not exist` },
      };
    }

    const filas = (this.db.tablas[this.tabla] ??= []);
    const pasa = (f: Fila) => this.filtros.every((x) => x(f));
    let afectadas: Fila[];

    if (this.accion === 'insert') {
      const nuevas = (Array.isArray(this.carga) ? this.carga : [this.carga!]).map((f) => ({
        id: nuevoId(),
        ...f,
      }));
      filas.push(...nuevas);
      afectadas = nuevas;
    } else if (this.accion === 'upsert') {
      afectadas = [];
      const clave = this.conflicto!;
      for (const f of Array.isArray(this.carga) ? this.carga : [this.carga!]) {
        const previa = filas.find((x) => String(x[clave]) === String(f[clave]));
        if (previa) {
          Object.assign(previa, f);
          afectadas.push(previa);
        } else {
          const nueva = { id: nuevoId(), ...f };
          filas.push(nueva);
          afectadas.push(nueva);
        }
      }
    } else if (this.accion === 'update') {
      afectadas = filas.filter(pasa);
      for (const f of afectadas) Object.assign(f, this.carga);
    } else {
      afectadas = filas.filter(pasa);
    }

    if (this.orden) {
      const { col, asc } = this.orden;
      afectadas = [...afectadas].sort(
        (a, b) => String(a[col] ?? '').localeCompare(String(b[col] ?? '')) * (asc ? 1 : -1),
      );
    }
    if (this.tope != null) afectadas = afectadas.slice(0, this.tope);

    if (this.unica) {
      if (afectadas.length === 0 && this.unica === 'single') {
        return { data: null, error: { code: 'PGRST116', message: 'no rows' } };
      }
      return { data: afectadas[0] ? { ...afectadas[0] } : null, error: null };
    }
    return { data: afectadas.map((f) => ({ ...f })), error: null };
  }
}

export function crearFakeSupabase(
  tablas: Record<string, Fila[]> = {},
  opts: OpcionesFakeSupabase = {},
): FakeSupabase {
  const db: FakeSupabase = {
    tablas,
    subidas: [],
    from: (tabla) => new Consulta(db, tabla, opts),
    storage: {
      from: (bucket) => ({
        upload: async (ruta) => {
          if (opts.storageCaido) return { data: null, error: { message: 'storage caído' } };
          db.subidas.push(`${bucket}/${ruta}`);
          return { data: { path: ruta }, error: null };
        },
        getPublicUrl: (ruta) => ({ data: { publicUrl: `https://storage.test/${bucket}/${ruta}` } }),
        createSignedUrls: async (rutas) => ({
          data: rutas.map((ruta) => ({ signedUrl: `https://storage.test/firmado/${bucket}/${ruta}` })),
          error: null,
        }),
      }),
    },
    rpc: async (nombre) => ({
      data: null,
      error: { code: 'PGRST202', message: `fakeSupabase: rpc ${nombre} no soportado` },
    }),
  };
  return db;
}

export type MensajeTelegramCapturado = {
  metodo: string;
  chat_id?: string | number;
  text?: string;
  reply_markup?: { inline_keyboard?: Array<Array<{ text: string; callback_data?: string }>> };
  [k: string]: unknown;
};

/**
 * Sustituye `fetch` para capturar lo que el bot enviaría a Telegram.
 * Devuelve la lista (se va llenando) y la función para restaurar `fetch`.
 */
export function capturarTelegram(): {
  enviados: MensajeTelegramCapturado[];
  restaurar: () => void;
} {
  const enviados: MensajeTelegramCapturado[] = [];
  const original = globalThis.fetch;
  const previoToken = process.env.TELEGRAM_BOT_TOKEN;
  process.env.TELEGRAM_BOT_TOKEN = 'token-de-prueba';

  globalThis.fetch = (async (url: unknown, init?: { body?: unknown }) => {
    const metodo = String(url).split('/').pop() ?? '';
    const cuerpo = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
    enviados.push({ metodo, ...cuerpo });
    return {
      ok: true,
      json: async () => ({ ok: true, result: { message_id: enviados.length } }),
    };
  }) as typeof fetch;

  return {
    enviados,
    restaurar: () => {
      globalThis.fetch = original;
      if (previoToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
      else process.env.TELEGRAM_BOT_TOKEN = previoToken;
    },
  };
}

/** Textos de los botones del último mensaje con teclado. */
export function botonesDe(m: MensajeTelegramCapturado | undefined): string[] {
  return (m?.reply_markup?.inline_keyboard ?? []).flat().map((b) => b.text);
}
