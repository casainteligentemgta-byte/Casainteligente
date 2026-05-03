/**
 * Evita que promesas (p. ej. PostgREST/Supabase) dejen la UI en “cargando…” sin fin.
 */
export function withTimeout<T>(promise: PromiseLike<T>, ms: number, etiqueta: string): Promise<T> {
  const p = Promise.resolve(promise);
  return new Promise((resolve, reject) => {
    const t = setTimeout(
      () =>
        reject(
          new Error(
            `${etiqueta}: superó ${Math.round(ms / 1000)} s (revisa conexión, URL de Supabase y que el proyecto esté en línea).`,
          ),
        ),
      ms,
    );
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(t);
        reject(e instanceof Error ? e : new Error(String(e)));
      },
    );
  });
}
