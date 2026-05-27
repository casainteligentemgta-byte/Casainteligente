/**
 * Enlaces capítulo ↔ partida desde tablas Obra* del MDB.
 * Contingencias cuando CodObr viene vacío, en blanco o no coincide con la obra activa.
 */
import { normalizeLuloRow, pickField, pickNumber } from '@/lib/proyectos/luloFieldMapping';
import { leerValorNumericoFila } from '@/lib/proyectos/lulo/leerValorNumericoFila';
import { getCapituloKey } from '@/lib/proyectos/luloVistaAgrupada';
import type { LuloMdbFullDump, LuloMdbTableDump } from '@/lib/proyectos/extractLuloFull';
import {
  LULO_PARTIDA_COLS,
  resolveLuloColumn,
} from '@/lib/proyectos/luloTablasNativas';

const LULO_PARTIDA_CAP_COLS = {
  codigoCapitulo: ['cod_cap', 'codigo_capitulo', 'capitulo', 'cod_capitulo', 'cap'],
} as const;

const OBRAPART_CAP_PAR = ['cappar', 'cap_par'] as const;
const OBRAPART_NUM_CAP = ['numcap', 'num_cap'] as const;
const OBRAPART_NUM_PAR = ['numpar', 'num_par', 'nro', 'numero'] as const;

export type FuenteEnlaceCapitulo =
  | 'obra_capi_part'
  | 'obra_part'
  | 'obra_apun_cap'
  | 'num_par_rango'
  | 'prefijo_codpar';

export type LuloEnlacesCapituloPartida = {
  canPar: Map<string, number>;
  codCap: Map<string, string>;
  /** Cómo se resolvió el capítulo por código de partida (diagnóstico). */
  fuente: Map<string, FuenteEnlaceCapitulo>;
};

export type BuildEnlacesCapituloPartidaOpts = {
  codigoObra?: string;
  /** Si se indica, al usar ObraCapiPart sin filtro CodObr solo se conservan CodPar de esta obra. */
  codigosPartidaObra?: Iterable<string>;
};

/** Normaliza CodObr; vacío / espacio = sin obra en fila. */
export function normalizarCodObr(valor: unknown): string {
  const s = String(valor ?? '').trim();
  if (!s || s === ' ' || s === '\u00a0') return '';
  return s.toUpperCase();
}

/** ¿La fila pertenece a la obra activa? (CodObr vacío cuenta como global / heredado). */
export function codObrAplicaAFila(valorCodObr: unknown, codigoObra?: string): boolean {
  const filtro = normalizarCodObr(codigoObra);
  if (!filtro) return true;
  const enFila = normalizarCodObr(valorCodObr);
  if (!enFila) return true;
  return enFila === filtro;
}

function tablaPorNombre(dump: LuloMdbFullDump, name: string): LuloMdbTableDump | undefined {
  const want = name.trim().toLowerCase();
  return dump.tables.find((t) => t.name.trim().toLowerCase() === want);
}

function codigosPartidaDeObra(dump: LuloMdbFullDump, codigoObra?: string): Set<string> {
  const out = new Set<string>();
  const filtro = normalizarCodObr(codigoObra);
  for (const nombre of ['ObraApun', 'ObraPart', 'PARTIDAS']) {
    const t = tablaPorNombre(dump, nombre);
    if (!t) continue;
    const cCod = resolveLuloColumn(t.columns, LULO_PARTIDA_COLS.codigo);
    const cObr = resolveLuloColumn(t.columns, LULO_PARTIDA_COLS.codigoObra);
    for (const raw of t.rows) {
      const row = normalizeLuloRow(raw);
      if (filtro && cObr) {
        const obr =
          (cObr ? String((raw as Record<string, unknown>)[cObr] ?? '') : '') ||
          pickField(row, [...LULO_PARTIDA_COLS.codigoObra]);
        if (!codObrAplicaAFila(obr, codigoObra)) continue;
      }
      const cod =
        (cCod ? String((raw as Record<string, unknown>)[cCod] ?? '').trim() : '') ||
        pickField(row, [...LULO_PARTIDA_COLS.codigo]);
      if (cod) out.add(cod.toUpperCase());
    }
    if (out.size > 0) break;
  }
  return out;
}

function valorCapituloUtil(valor: unknown): string {
  const s = String(valor ?? '').trim();
  if (!s || s === ' ' || s === '\u00a0' || s === 'null') return '';
  return s;
}

/**
 * Filas ObraCapiPart: primero por CodObr; si 0 coincidencias, tabla completa
 * (opcionalmente restringida a codigosPartidaObra).
 */
/** Filas ObraCapiPart con contingencia CodObr (exportado para loadLuloCsvFolder). */
export function filasObraCapiPart(
  tabla: LuloMdbTableDump,
  codigoObra?: string,
  codigosPartida?: Set<string>,
): Record<string, unknown>[] {
  const filtro = normalizarCodObr(codigoObra);
  let filas = tabla.rows as Record<string, unknown>[];

  if (filtro) {
    const cObr = resolveLuloColumn(tabla.columns, LULO_PARTIDA_COLS.codigoObra);
    const estrictas = filas.filter((raw) => {
      const row = normalizeLuloRow(raw);
      const obr =
        (cObr ? String(raw[cObr] ?? '') : '') ||
        pickField(row, [...LULO_PARTIDA_COLS.codigoObra]);
      return normalizarCodObr(obr) === filtro;
    });
    if (estrictas.length > 0) {
      filas = estrictas;
    } else {
      // Contingencia 1: sin match de CodObr → todas las filas de ObraCapiPart
      filas = tabla.rows as Record<string, unknown>[];
    }
  }

  if (codigosPartida && codigosPartida.size > 0) {
    const cPar = resolveLuloColumn(tabla.columns, LULO_PARTIDA_COLS.codigo);
    filas = filas.filter((raw) => {
      const row = normalizeLuloRow(raw);
      const cod =
        (cPar ? String(raw[cPar] ?? '').trim() : '') ||
        pickField(row, [...LULO_PARTIDA_COLS.codigo]);
      return codigosPartida.has(cod.toUpperCase());
    });
  }

  return filas;
}

function leerObraCapiPart(
  dump: LuloMdbFullDump,
  opts: BuildEnlacesCapituloPartidaOpts | undefined,
  out: LuloEnlacesCapituloPartida,
): void {
  const t = tablaPorNombre(dump, 'ObraCapiPart');
  if (!t) return;

  const codigos =
    opts?.codigosPartidaObra != null
      ? new Set([...opts.codigosPartidaObra].map((c) => c.toUpperCase()))
      : codigosPartidaDeObra(dump, opts?.codigoObra);

  const filas = filasObraCapiPart(t, opts?.codigoObra, codigos.size > 0 ? codigos : undefined);
  const cPar = resolveLuloColumn(t.columns, LULO_PARTIDA_COLS.codigo);
  const cCan = resolveLuloColumn(t.columns, LULO_PARTIDA_COLS.cantidad);
  const cCap = resolveLuloColumn(t.columns, LULO_PARTIDA_CAP_COLS.codigoCapitulo);

  for (const raw of filas) {
    const row = normalizeLuloRow(raw);
    const codPar =
      (cPar ? String(raw[cPar] ?? '').trim() : '') ||
      pickField(row, [...LULO_PARTIDA_COLS.codigo]);
    if (!codPar) continue;
    const key = codPar.toUpperCase();

    const can = leerValorNumericoFila(raw, row, cCan, LULO_PARTIDA_COLS.cantidad);
    if (can > 0 || !out.canPar.has(key)) out.canPar.set(key, can);

    const cap =
      valorCapituloUtil(cCap ? raw[cCap] : '') ||
      valorCapituloUtil(pickField(row, [...LULO_PARTIDA_CAP_COLS.codigoCapitulo]));
    if (cap && !out.codCap.has(key)) {
      out.codCap.set(key, cap);
      out.fuente.set(key, 'obra_capi_part');
    }
  }
}

/** ObraPart: CapPar / NumCap (catálogo global si no hay CodObr en la tabla). */
function leerObraPart(
  dump: LuloMdbFullDump,
  opts: BuildEnlacesCapituloPartidaOpts | undefined,
  out: LuloEnlacesCapituloPartida,
): void {
  const t = tablaPorNombre(dump, 'ObraPart');
  if (!t) return;

  const codigos =
    opts?.codigosPartidaObra != null
      ? new Set([...opts.codigosPartidaObra].map((c) => c.toUpperCase()))
      : codigosPartidaDeObra(dump, opts?.codigoObra);

  const cObr = resolveLuloColumn(t.columns, LULO_PARTIDA_COLS.codigoObra);
  const cPar = resolveLuloColumn(t.columns, LULO_PARTIDA_COLS.codigo);
  const cCapPar = resolveLuloColumn(t.columns, OBRAPART_CAP_PAR);
  const cNumCap = resolveLuloColumn(t.columns, OBRAPART_NUM_CAP);

  let filas = t.rows as Record<string, unknown>[];
  if (cObr && normalizarCodObr(opts?.codigoObra)) {
    const estrictas = filas.filter((raw) =>
      codObrAplicaAFila(raw[cObr], opts?.codigoObra),
    );
    if (estrictas.length > 0) filas = estrictas;
  }

  for (const raw of filas) {
    const row = normalizeLuloRow(raw);
    const codPar =
      (cPar ? String(raw[cPar] ?? '').trim() : '') ||
      pickField(row, [...LULO_PARTIDA_COLS.codigo]);
    if (!codPar) continue;
    const key = codPar.toUpperCase();
    if (codigos.size > 0 && !codigos.has(key)) continue;
    if (out.codCap.has(key)) continue;

    const capPar = valorCapituloUtil(cCapPar ? raw[cCapPar] : '') ||
      valorCapituloUtil(pickField(row, [...OBRAPART_CAP_PAR]));
    const numCap = cNumCap
      ? Math.floor(pickNumber(row, [cNumCap]))
      : Math.floor(pickNumber(row, [...OBRAPART_NUM_CAP]));
    const cap = capPar || (numCap > 0 ? String(numCap) : '');
    if (!cap) continue;

    out.codCap.set(key, cap);
    out.fuente.set(key, 'obra_part');
  }
}

/** ObraApun: CapPar en la fila de presupuesto (si viene informado). */
function leerObraApunCapPar(
  dump: LuloMdbFullDump,
  opts: BuildEnlacesCapituloPartidaOpts | undefined,
  out: LuloEnlacesCapituloPartida,
): void {
  const t = tablaPorNombre(dump, 'ObraApun');
  if (!t) return;

  const cObr = resolveLuloColumn(t.columns, LULO_PARTIDA_COLS.codigoObra);
  const cPar = resolveLuloColumn(t.columns, LULO_PARTIDA_COLS.codigo);
  const cCapPar = resolveLuloColumn(t.columns, OBRAPART_CAP_PAR);
  if (!cCapPar) return;

  for (const raw of t.rows) {
    if (opts?.codigoObra && cObr && !codObrAplicaAFila(raw[cObr], opts.codigoObra)) continue;
    const row = normalizeLuloRow(raw);
    const codPar =
      (cPar ? String(raw[cPar] ?? '').trim() : '') ||
      pickField(row, [...LULO_PARTIDA_COLS.codigo]);
    if (!codPar) continue;
    const key = codPar.toUpperCase();
    if (out.codCap.has(key)) continue;

    const cap = valorCapituloUtil(raw[cCapPar]) || valorCapituloUtil(pickField(row, [...OBRAPART_CAP_PAR]));
    if (!cap) continue;

    out.codCap.set(key, cap);
    out.fuente.set(key, 'obra_apun_cap');
  }
}

/**
 * Construye mapas CanPar / CodCap con reglas de contingencia para CodObr.
 * Usar desde el parseo MDB (exportado también vía extractLuloFull).
 */
export function buildEnlacesCapituloPartida(
  dump: LuloMdbFullDump,
  opts?: BuildEnlacesCapituloPartidaOpts,
): LuloEnlacesCapituloPartida {
  const out: LuloEnlacesCapituloPartida = {
    canPar: new Map(),
    codCap: new Map(),
    fuente: new Map(),
  };

  leerObraCapiPart(dump, opts, out);
  leerObraPart(dump, opts, out);
  leerObraApunCapPar(dump, opts, out);

  return out;
}

/** Prefijo numérico del CodPar como último recurso (01.02 → capítulo 01). */
export function codCapDesdePrefijoPartida(codigoPartida: string): string {
  return getCapituloKey(codigoPartida);
}

export function numParDesdeFila(
  raw: Record<string, unknown>,
  columnNames: string[],
): number {
  const row = normalizeLuloRow(raw);
  const cNumPar = resolveLuloColumn(columnNames, OBRAPART_NUM_PAR);
  return cNumPar
    ? pickNumber(row, [cNumPar])
    : pickNumber(row, [...OBRAPART_NUM_PAR]);
}
