'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  fechaCorta,
  fmtUsd,
  hoyCaracas,
  moverPeriodo,
  type GrupoRendicion,
  type MovimientoRendicion,
  type PeriodoRendicion,
  type RendicionHonorarios,
  type VersionRendicion,
} from '@/lib/contabilidad/cco/rendicionHonorarios';
import { hrefCcoProyecto } from '@/lib/contabilidad/cco/hrefCcoProyecto';

type Proyecto = { id: string; nombre: string };
type Respuesta = { obra: string; cliente: string | null; rendicion: RendicionHonorarios };

const PERIODOS: Array<{ id: PeriodoRendicion; texto: string }> = [
  { id: 'semana', texto: 'Semana' },
  { id: 'mes', texto: 'Mes' },
  { id: 'obra', texto: 'Toda la obra' },
];

/** Filas del detalle que se muestran de entrada; el resto se abre con un botón. */
const FILAS_INICIALES = 60;

function Fila({ texto, monto, fuerte }: { texto: string; monto: string; fuerte?: boolean }) {
  return (
    <div
      className={`flex items-baseline justify-between gap-3 px-4 py-2.5 ${
        fuerte ? 'bg-slate-100 font-bold text-slate-900' : 'border-b border-slate-100 text-slate-700'
      }`}
    >
      <span className="min-w-0 text-sm">{texto}</span>
      <span className="shrink-0 text-sm tabular-nums">{monto}</span>
    </div>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-bold text-slate-900">{titulo}</h2>
      {children}
    </section>
  );
}

function TablaGrupos({ titulo, filas }: { titulo: string; filas: GrupoRendicion[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[440px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-2 font-semibold">{titulo}</th>
            <th className="px-3 py-2 text-right font-semibold">Gastos</th>
            <th className="px-3 py-2 text-right font-semibold">Honorarios</th>
            <th className="px-4 py-2 text-right font-semibold">Total</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((g) => (
            <tr key={g.nombre} className="border-t border-slate-100 text-slate-700">
              <td className="px-4 py-2">
                {g.nombre} <span className="text-xs text-slate-400">· {g.n}</span>
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{fmtUsd(g.gastos)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{fmtUsd(g.honorarios)}</td>
              <td className="px-4 py-2 text-right font-semibold tabular-nums text-slate-900">{fmtUsd(g.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ListaMovimientos({ filas, esGasto }: { filas: MovimientoRendicion[]; esGasto: boolean }) {
  const [todas, setTodas] = useState(false);
  const visibles = todas ? filas : filas.slice(0, FILAS_INICIALES);
  return (
    <>
      <ul>
        {visibles.map((m) => (
          <li key={m.id} className="flex items-start justify-between gap-3 border-t border-slate-100 px-4 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{m.proveedor}</p>
              <p className="line-clamp-2 text-xs text-slate-500">
                {fechaCorta(m.fecha)} · {m.concepto}
                {esGasto && m.factura && m.factura !== m.concepto ? ` · Fact. ${m.factura}` : ''}
              </p>
              {esGasto && !m.tieneSoporte ? (
                <p className="mt-0.5 text-xs font-semibold text-amber-700">Sin soporte adjunto</p>
              ) : null}
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-semibold tabular-nums text-slate-900">{fmtUsd(m.baseUsd)}</p>
              {esGasto ? (
                <p className="text-xs tabular-nums text-slate-500">+ {fmtUsd(m.honorariosUsd)} hon.</p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      {!todas && filas.length > FILAS_INICIALES ? (
        <button
          type="button"
          onClick={() => setTodas(true)}
          className="w-full border-t border-slate-200 px-4 py-3 text-sm font-semibold text-blue-700"
        >
          Ver los {filas.length - FILAS_INICIALES} restantes
        </button>
      ) : null}
    </>
  );
}

export default function CcoRendicionClient() {
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [proyectoId, setProyectoId] = useState('');
  const [periodo, setPeriodo] = useState<PeriodoRendicion>('mes');
  const [fecha, setFecha] = useState(hoyCaracas());
  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bajando, setBajando] = useState<VersionRendicion | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const inicial = q.get('proyecto')?.trim() ?? '';
    if (inicial) setProyectoId(inicial);
    void (async () => {
      try {
        const res = await fetch('/api/contabilidad/cco/rendicion', { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok || !json.ok) throw new Error(json.error ?? 'No se pudieron cargar las obras.');
        const lista = (json.proyectos ?? []) as Proyecto[];
        setProyectos(lista);
        if (!inicial && lista.length === 1) setProyectoId(lista[0]!.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudieron cargar las obras.');
      }
    })();
  }, []);

  const consulta = useCallback(
    (version?: VersionRendicion) => {
      const q = new URLSearchParams({ proyecto: proyectoId, periodo, fecha });
      if (version) q.set('version', version);
      return q.toString();
    },
    [proyectoId, periodo, fecha],
  );

  useEffect(() => {
    if (!proyectoId) {
      setDatos(null);
      return;
    }
    let vigente = true;
    setCargando(true);
    setError(null);
    void (async () => {
      try {
        const res = await fetch(`/api/contabilidad/cco/rendicion?${consulta()}`, { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok || !json.ok) throw new Error(json.error ?? `Error ${res.status}`);
        if (vigente) setDatos(json as Respuesta);
      } catch (e) {
        if (vigente) {
          setDatos(null);
          setError(e instanceof Error ? e.message : 'No se pudo preparar la rendición.');
        }
      } finally {
        if (vigente) setCargando(false);
      }
    })();
    return () => {
      vigente = false;
    };
  }, [proyectoId, consulta]);

  async function descargar(version: VersionRendicion) {
    if (!proyectoId) return;
    setBajando(version);
    setError(null);
    try {
      const res = await fetch(`/api/contabilidad/cco/rendicion/pdf?${consulta(version)}`, { cache: 'no-store' });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? `Error ${res.status}`);
      }
      const blob = await res.blob();
      const nombre = /filename="?([^"]+)"?/.exec(res.headers.get('Content-Disposition') ?? '')?.[1];
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nombre ?? `Rendicion_${version}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo generar el PDF.');
    } finally {
      setBajando(null);
    }
  }

  const r = datos?.rendicion ?? null;
  const vacio = r != null && r.periodo.nGastos === 0 && r.periodo.nAportes === 0;
  const pct = r ? fmtUsd(r.pctPactado).replace(/\.00$/, '') : '';

  return (
    <main className="min-h-screen bg-slate-100 px-4 pb-16 pt-5 text-slate-900">
      <div className="mx-auto max-w-3xl">
        <Link href={hrefCcoProyecto(proyectoId)} className="text-sm font-semibold text-blue-700">
          ← Control contable de obra
        </Link>
        <h1 className="mt-2 text-2xl font-black tracking-tight">Rendición de cuentas</h1>
        <p className="mt-1 text-sm text-slate-600">
          Aportes del cliente, gastos de obra y honorarios de administración, por semana, por mes o de toda la obra.
        </p>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
          <label className="block">
            <span className="text-xs font-semibold uppercase text-slate-500">Obra</span>
            <select
              value={proyectoId}
              onChange={(e) => setProyectoId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
            >
              <option value="">Elige una obra…</option>
              {proyectos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </label>

          <div className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Período">
            {PERIODOS.map((p) => (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={periodo === p.id}
                onClick={() => setPeriodo(p.id)}
                className={`rounded-lg px-2 py-2 text-sm font-semibold ${
                  periodo === p.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                {p.texto}
              </button>
            ))}
          </div>

          {periodo !== 'obra' ? (
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                aria-label="Período anterior"
                onClick={() => setFecha(moverPeriodo(periodo, fecha, -1))}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold"
              >
                ◀
              </button>
              <input
                type="date"
                value={fecha}
                onChange={(e) => e.target.value && setFecha(e.target.value)}
                aria-label="Un día del período"
                className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
              <button
                type="button"
                aria-label="Período siguiente"
                onClick={() => setFecha(moverPeriodo(periodo, fecha, 1))}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold"
              >
                ▶
              </button>
            </div>
          ) : null}
        </div>

        {error ? (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
        ) : null}
        {!proyectoId ? <p className="mt-6 text-sm text-slate-500">Elige una obra para ver su rendición.</p> : null}
        {cargando ? <p className="mt-6 text-sm text-slate-500">Preparando la rendición…</p> : null}

        {r && !cargando ? (
          <>
            <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-4 py-3">
                <p className="text-xs font-semibold uppercase text-slate-500">{datos?.obra}</p>
                <p className="text-base font-bold">{r.rango.etiqueta}</p>
              </div>
              {r.rango.tipo !== 'obra' ? <Fila texto="Saldo anterior" monto={fmtUsd(r.saldoAnterior)} /> : null}
              <Fila texto={`(+) Aportes del cliente · ${r.periodo.nAportes}`} monto={fmtUsd(r.periodo.aportes)} />
              <Fila texto={`(−) Gastos de obra · ${r.periodo.nGastos}`} monto={fmtUsd(r.periodo.gastos)} />
              <Fila texto={`(−) Honorarios de administración (${pct}%)`} monto={fmtUsd(r.periodo.honorarios)} />
              <Fila
                fuerte
                texto={r.saldoFinal >= 0 ? 'Saldo a favor del cliente · USD' : 'Monto por reponer · USD'}
                monto={fmtUsd(Math.abs(r.saldoFinal))}
              />
            </section>

            {vacio && r.ultimoMovimiento ? (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <p>
                  No hay movimientos en este período. El último registrado es del{' '}
                  <strong>{fechaCorta(r.ultimoMovimiento)}</strong>.
                </p>
                <button
                  type="button"
                  onClick={() => setFecha(r.ultimoMovimiento!)}
                  className="mt-2 rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white"
                >
                  Ir a ese período
                </button>
              </div>
            ) : null}

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                disabled={bajando !== null}
                onClick={() => void descargar('interna')}
                className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
              >
                {bajando === 'interna' ? 'Generando…' : '⬇ PDF para mí (interno)'}
              </button>
              <button
                type="button"
                disabled={bajando !== null}
                onClick={() => void descargar('cliente')}
                className="rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
              >
                {bajando === 'cliente' ? 'Generando…' : '⬇ PDF para el cliente'}
              </button>
            </div>

            {r.porMes.length ? (
              <Seccion titulo="Mes a mes">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-4 py-2 font-semibold">Mes</th>
                        <th className="px-3 py-2 text-right font-semibold">Aportes</th>
                        <th className="px-3 py-2 text-right font-semibold">Gastos</th>
                        <th className="px-3 py-2 text-right font-semibold">Honorarios</th>
                        <th className="px-4 py-2 text-right font-semibold">Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.porMes.map((m) => (
                        <tr key={m.periodo} className="border-t border-slate-100 text-slate-700">
                          <td className="px-4 py-2 capitalize">{m.etiqueta}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{fmtUsd(m.aportes)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{fmtUsd(m.gastos)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{fmtUsd(m.honorarios)}</td>
                          <td className="px-4 py-2 text-right font-semibold tabular-nums text-slate-900">
                            {fmtUsd(m.saldo)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Seccion>
            ) : null}

            {r.porTipo.length ? (
              <Seccion titulo="Gastos por tipo">
                <TablaGrupos titulo="Tipo" filas={r.porTipo} />
              </Seccion>
            ) : null}

            {r.aportes.length ? (
              <Seccion titulo={`Aportes recibidos · ${r.aportes.length}`}>
                <ListaMovimientos filas={r.aportes} esGasto={false} />
              </Seccion>
            ) : null}

            {r.gastos.length ? (
              <Seccion titulo={`Detalle de gastos · ${r.gastos.length}`}>
                <ListaMovimientos filas={r.gastos} esGasto />
              </Seccion>
            ) : null}

            {r.gastos.length ? (
              <Seccion titulo="Control interno (no va en el PDF del cliente)">
                <Fila texto={`Gastos sin soporte adjunto · ${r.control.sinSoporte.n}`} monto={fmtUsd(r.control.sinSoporte.monto)} />
                <Fila texto={`Gastos no pagados · ${r.control.noPagados.n}`} monto={fmtUsd(r.control.noPagados.monto)} />
                <Fila
                  texto={`Sin honorarios guardados, calculados al ${pct}% · ${r.control.honorariosCalculados.n}`}
                  monto={fmtUsd(r.control.honorariosCalculados.honorarios)}
                />
                <Fila
                  texto={`Con un % de honorarios distinto al pactado · ${r.control.pctDistinto.n}`}
                  monto={fmtUsd(r.control.pctDistinto.monto)}
                />
                <Fila texto="% de honorarios que resulta" monto={`${fmtUsd(r.pctEfectivo)} %`} />
              </Seccion>
            ) : null}

            {r.rango.tipo !== 'obra' ? (
              <p className="mt-4 text-xs text-slate-500">
                Acumulado de la obra hasta el {fechaCorta(r.rango.hasta)}: aportes {fmtUsd(r.acumulado.aportes)} · gastos{' '}
                {fmtUsd(r.acumulado.gastos)} · honorarios {fmtUsd(r.acumulado.honorarios)} · saldo{' '}
                {fmtUsd(r.acumulado.saldo)} USD.
              </p>
            ) : null}
          </>
        ) : null}
      </div>
    </main>
  );
}
