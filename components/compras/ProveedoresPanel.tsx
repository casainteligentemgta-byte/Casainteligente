'use client';

import { useEffect, useState } from 'react';
import { Building2, ChevronDown, Loader2 } from 'lucide-react';
import { apiUrl } from '@/lib/http/apiUrl';
import type { FichaProveedor } from '@/lib/compras/fichaProveedores';

const n = (v: number | null, d = 0) =>
  v == null ? '—' : Number(v).toLocaleString('es-VE', { maximumFractionDigits: d, minimumFractionDigits: d });

function colorPuntaje(p: number): string {
  if (p >= 85) return 'text-emerald-300';
  if (p >= 60) return 'text-[#FF9500]';
  return 'text-red-300';
}

/** Ficha de proveedores: cuánto se les compra y qué tan bien cumplen (180 días). */
export default function ProveedoresPanel() {
  const [abierto, setAbierto] = useState(false);
  const [lista, setLista] = useState<FichaProveedor[] | null>(null);
  const [oculto, setOculto] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!abierto || lista) return;
    void (async () => {
      try {
        const res = await fetch(apiUrl('/api/compras/proveedores'), { cache: 'no-store' });
        if (res.status === 401 || res.status === 403) {
          setOculto(true);
          return;
        }
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? 'No se pudo cargar');
        setLista((json.proveedores ?? []) as FichaProveedor[]);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo cargar');
      }
    })();
  }, [abierto, lista]);

  if (oculto) return null;

  return (
    <section className="mb-6 rounded-2xl border border-white/[0.08] bg-white/[0.02]">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
        aria-expanded={abierto}
      >
        <Building2 size={16} className="text-sky-300" aria-hidden />
        <span className="text-sm font-black text-white">Proveedores</span>
        <span className="text-[11px] text-zinc-500">compras, diferencias, rechazos y demora · 180 días</span>
        <ChevronDown size={16} className={`ml-auto text-zinc-500 transition-transform ${abierto ? 'rotate-180' : ''}`} aria-hidden />
      </button>

      {abierto && (
        <div className="border-t border-white/[0.06] px-4 py-3">
          {error && <p className="text-[12px] text-red-300">{error}</p>}
          {!lista && !error ? (
            <p className="flex items-center gap-2 text-[12px] text-zinc-500">
              <Loader2 size={14} className="animate-spin" aria-hidden /> Calculando…
            </p>
          ) : lista && lista.length === 0 ? (
            <p className="text-[12px] text-zinc-500">Sin compras en los últimos 180 días.</p>
          ) : lista ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-[12px]">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wider text-zinc-500">
                    <th className="py-1.5 pr-2">Proveedor</th>
                    <th className="py-1.5 pr-2 text-right">Compras</th>
                    <th className="py-1.5 pr-2 text-right">USD</th>
                    <th className="py-1.5 pr-2 text-right">Diferencias</th>
                    <th className="py-1.5 pr-2 text-right">Rechazos</th>
                    <th className="py-1.5 pr-2 text-right">Días a recibir</th>
                    <th className="py-1.5 text-right">Puntaje</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((p) => (
                    <tr key={p.clave} className="border-t border-white/[0.04]">
                      <td className="py-1.5 pr-2">
                        <span className="font-semibold text-zinc-200">{p.nombre}</span>
                        {p.rif ? <span className="ml-1 text-[10px] text-zinc-500">{p.rif}</span> : null}
                      </td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">{p.compras}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">{n(p.montoUsd, 2)}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">{p.diferencias || '—'}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">
                        {p.lineasRechazadas ? `${p.lineasRechazadas}/${p.lineasRechazadas + p.lineasRecibidas}` : '—'}
                      </td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">{n(p.diasRecepcion, 1)}</td>
                      <td className={`py-1.5 text-right font-black tabular-nums ${colorPuntaje(p.puntaje)}`}>{p.puntaje}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-[10px] text-zinc-500">
                Puntaje: 100 menos penalizaciones por diferencias de factura, mercancía rechazada y más de 3 días para recibir.
              </p>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
