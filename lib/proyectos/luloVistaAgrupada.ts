/** Agrupación y orden Lulo (capítulos, partidas, disciplinas/rubros). */

export type VistaAgrupacionLulo = 'capitulos' | 'partidas' | 'disciplinas';

export type GrupoAgrupado<T> = {
  clave: string;
  etiqueta: string;
  items: T[];
  subtotal: number;
};

export function compareCodigoNatural(a: string, b: string): number {
  return String(a ?? '').localeCompare(String(b ?? ''), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

/** Primer segmento numérico del código (ej. `01.02.003` → `01`). */
export function getCapituloKey(codigo: string): string {
  const t = String(codigo ?? '').trim();
  if (!t) return '—';
  const m = t.match(/^(\d+)/);
  if (m) return m[1];
  const seg = t.split(/[.\-/\s]+/).filter(Boolean)[0];
  return seg || '—';
}

/** Rubro / subcapítulo: dos primeros segmentos (`01.02.003` → `01.02`). */
export function getRubroDisciplinaKey(codigo: string): string {
  const t = String(codigo ?? '').trim();
  if (!t) return '—';
  const parts = t.split(/[.\-/\s]+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]}.${parts[1]}`;
  if (parts.length === 1) return parts[0];
  return '—';
}

export function esEncabezadoCapitulo(row: {
  codigo_partida: string;
  cantidad_presupuestada?: number;
  precio_unitario_estimado?: number;
  monto_total_estimado?: number;
}): boolean {
  const cod = String(row.codigo_partida ?? '').trim();
  const parts = cod.split(/[.\-/\s]+/).filter(Boolean);
  const shallow = parts.length <= 1;
  const cant = Number(row.cantidad_presupuestada ?? 0);
  const pu = Number(row.precio_unitario_estimado ?? 0);
  const monto = Number(row.monto_total_estimado ?? 0);
  return shallow && (cant === 0 && pu === 0) && (monto > 0 || cod.length > 0);
}

function etiquetaCapitulo(capitulo: string, items: { codigo_partida: string; descripcion: string }[]): string {
  const header = items.find(
    (p) =>
      esEncabezadoCapitulo(p as Parameters<typeof esEncabezadoCapitulo>[0]) ||
      (getCapituloKey(p.codigo_partida) === capitulo &&
        String(p.codigo_partida).trim().replace(/[.\-/\s].*$/, '') === capitulo),
  );
  if (header?.descripcion?.trim()) {
    return `Capítulo ${capitulo} — ${header.descripcion.trim()}`;
  }
  return `Capítulo ${capitulo}`;
}

function etiquetaRubro(rubro: string, items: { codigo_partida: string; descripcion: string }[]): string {
  const header = items.find((p) => getRubroDisciplinaKey(p.codigo_partida) === rubro);
  if (header?.descripcion?.trim()) {
    return `Rubro ${rubro} — ${header.descripcion.trim()}`;
  }
  return `Rubro ${rubro}`;
}

function ordenarPartidasPorCodigo<T extends { codigo_partida: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => compareCodigoNatural(a.codigo_partida, b.codigo_partida));
}

function agruparPorClave<T extends { codigo_partida: string; monto_total_estimado?: number }>(
  items: T[],
  claveFn: (codigo: string) => string,
  etiquetaFn: (clave: string, grupo: T[]) => string,
): GrupoAgrupado<T>[] {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = claveFn(item.codigo_partida);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(item);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => compareCodigoNatural(a, b))
    .map(([clave, grupo]) => {
      const sorted = ordenarPartidasPorCodigo(grupo);
      const subtotal = sorted.reduce(
        (s, p) => s + Number((p as { monto_total_estimado?: number }).monto_total_estimado ?? 0),
        0,
      );
      return {
        clave,
        etiqueta: etiquetaFn(clave, sorted),
        items: sorted as T[],
        subtotal,
      };
    });
}

export function agruparPartidasPorCapitulo<
  T extends { codigo_partida: string; descripcion: string; monto_total_estimado?: number },
>(items: T[]): GrupoAgrupado<T>[] {
  return agruparPorClave(items, getCapituloKey, etiquetaCapitulo);
}

export function agruparPartidasPorRubro<
  T extends { codigo_partida: string; descripcion: string; monto_total_estimado?: number },
>(items: T[]): GrupoAgrupado<T>[] {
  return agruparPorClave(items, getRubroDisciplinaKey, etiquetaRubro);
}

export function ordenarPartidasPlanas<T extends { codigo_partida: string }>(items: T[]): T[] {
  return ordenarPartidasPorCodigo(items);
}

export function agruparGastosPorDisciplina<
  T extends { disciplina: string; costo?: number },
>(items: T[]): GrupoAgrupado<T>[] {
  const map = new Map<string, T[]>();
  for (const g of items) {
    const k = String(g.disciplina ?? '').trim() || 'Sin disciplina';
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(g);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b, 'es', { sensitivity: 'base' }))
    .map(([clave, grupo]) => {
      const sorted = [...grupo].sort((a, b) =>
        String((a as { fecha?: string }).fecha ?? '').localeCompare(
          String((b as { fecha?: string }).fecha ?? ''),
        ),
      );
      const subtotal = sorted.reduce((s, x) => s + Number(x.costo ?? 0), 0);
      return {
        clave,
        etiqueta: clave,
        items: sorted,
        subtotal,
      };
    });
}

export function ordenarGastosPlanos<T extends { fecha: string; costo?: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
}
