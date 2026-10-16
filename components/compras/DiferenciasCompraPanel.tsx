'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Scale } from 'lucide-react';
import { apiUrl } from '@/lib/http/apiUrl';

type Diferencia = {
  id: string;
  tipo: 'facturado_mayor_pedido' | 'no_pedido' | 'recibido_menor_facturado' | 'precio_alto';
  precio_unitario: number | null;
  precio_referencia: number | null;
  descripcion: string;
  unidad: string | null;
  cantidad_pedida: number | null;
  cantidad_facturada: number | null;
  cantidad_recibida: number | null;
  moneda: string | null;
  monto_diferencia: number | null;
  created_at: string;
  obra: string | null;
  purchase_invoices: { invoice_number: string | null; supplier_name: string | null } | null;
};

const ETIQUETA: Record<Diferencia['tipo'], string> = {
  facturado_mayor_pedido: 'Facturó más de lo pedido',
  no_pedido: 'Facturó algo que nadie pidió',
  recibido_menor_facturado: 'Llegó menos de lo facturado',
  precio_alto: 'Precio por encima del historial',
};

const n = (v: number | null) => (v == null ? '—' : Number(v).toLocaleString('es-VE', { maximumFractionDigits: 2 }));

function detalle(d: Diferencia): string {
  const u = d.unidad ?? '';
  switch (d.tipo) {
    case 'facturado_mayor_pedido':
      return `Pedido ${n(d.cantidad_pedida)} ${u} · facturado ${n(d.cantidad_facturada)} ${u}`;
    case 'no_pedido':
      return `Facturado ${n(d.cantidad_facturada)} ${u}`;
    case 'recibido_menor_facturado':
      return `Facturado ${n(d.cantidad_facturada)} ${u} · recibido ${n(d.cantidad_recibida)} ${u}`;
    case 'precio_alto':
      return `Pagado ${n(d.precio_unitario)} USD/${u} · referencia ${n(d.precio_referencia)} USD/${u} · ${n(d.cantidad_facturada)} ${u}`;
    default:
      return '';
  }
}

/** Control de compras: lo pedido contra lo facturado contra lo recibido. */
export default function DiferenciasCompraPanel() {
  const [lista, setLista] = useState<Diferencia[] | null>(null);
  const [oculto, setOculto] = useState(false);
  const [marcando, setMarcando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/compras/control'), { cache: 'no-store' });
      if (res.status === 401 || res.status === 403) {
        setOculto(true);
        return;
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? 'No se pudo cargar');
      setLista((json.diferencias ?? []) as Diferencia[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar');
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function marcar(d: Diferencia) {
    const nota = window.prompt('¿Qué se hizo? (opcional: reclamo, nota de crédito, se aceptó…)', '') ?? null;
    if (nota === null) return;
    setMarcando(d.id);
    try {
      const res = await fetch(apiUrl('/api/compras/control'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: d.id, nota }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? 'No se pudo marcar');
      setLista((prev) => (prev ?? []).filter((x) => x.id !== d.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo marcar');
    } finally {
      setMarcando(null);
    }
  }

  if (oculto) return null;

  return (
    <section className="mb-6 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
      <div className="mb-2 flex items-center gap-2">
        <Scale size={16} className="text-[#FF9500]" aria-hidden />
        <h2 className="text-sm font-black text-white">Control de compras</h2>
        <span className="text-[11px] text-zinc-500">pedido · facturado · recibido</span>
      </div>

      {error && <p className="mb-2 text-[12px] text-red-300">{error}</p>}

      {lista == null ? (
        <p className="flex items-center gap-2 text-[12px] text-zinc-500">
          <Loader2 size={14} className="animate-spin" aria-hidden /> Cargando…
        </p>
      ) : lista.length === 0 ? (
        <p className="flex items-center gap-2 text-[12px] text-emerald-300">
          <CheckCircle2 size={14} aria-hidden /> Sin diferencias abiertas: lo facturado coincide con lo pedido y lo recibido.
        </p>
      ) : (
        <ul className="space-y-2">
          {lista.map((d) => (
            <li key={d.id} className="rounded-xl border border-[#FF9500]/30 bg-[#FF9500]/5 p-3 text-[12px]">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-white">
                    {ETIQUETA[d.tipo]} · <span className="font-semibold text-zinc-300">{d.descripcion}</span>
                  </p>
                  <p className="mt-0.5 text-zinc-400">
                    {detalle(d)}
                    {d.monto_diferencia ? (
                      <>
                        {' '}
                        · <b className="text-[#FF9500]">{n(d.monto_diferencia)} {d.moneda ?? ''}</b>
                      </>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-[11px] text-zinc-500">
                    Factura #{d.purchase_invoices?.invoice_number ?? 'S/N'} · {d.purchase_invoices?.supplier_name ?? 'Proveedor'}
                    {d.obra ? ` · ${d.obra}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void marcar(d)}
                  disabled={marcando === d.id}
                  className="shrink-0 rounded-xl border border-white/10 px-3 py-1.5 text-[11px] font-bold text-zinc-300 hover:bg-white/[0.06] disabled:opacity-50"
                >
                  {marcando === d.id ? 'Marcando…' : 'Marcar revisada'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
