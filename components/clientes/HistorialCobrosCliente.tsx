import type { CSSProperties } from 'react';
import type { CobroCliente } from '@/lib/clientes/cobrosCliente';
import { tinta, tintaTexto } from '@/lib/tema/tinta';

function montoTxt(c: CobroCliente): string {
  if (c.moneda === 'VES') {
    return `Bs ${c.monto.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `$${c.monto.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fechaTxt(iso: string): string {
  const d = new Date(iso.length <= 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('es-VE', { dateStyle: 'medium', timeZone: 'America/Caracas' });
}

export default function HistorialCobrosCliente({
  cobros,
  loading,
  error,
  card,
}: {
  cobros: CobroCliente[];
  loading: boolean;
  error: string | null;
  card: CSSProperties;
}) {
  return (
    <div style={card}>
      <h2 className="text-lg font-semibold" style={{ color: 'var(--label-primary)' }}>
        Historial de cobros
      </h2>
      <p className="mt-1 text-sm" style={{ color: tintaTexto(0.5) }}>
        Abonos de presupuestos y de obras de este cliente.
      </p>
      {loading ? (
        <p className="mt-4 text-sm" style={{ color: tintaTexto(0.5) }}>
          Cargando cobros…
        </p>
      ) : error ? (
        <p className="mt-4 text-sm text-red-400">{error}</p>
      ) : cobros.length === 0 ? (
        <p className="mt-4 text-sm" style={{ color: tintaTexto(0.5) }}>
          Todavía no hay cobros registrados.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {cobros.map((c) => (
            <li
              key={c.id}
              className="flex items-start justify-between gap-3 rounded-xl p-3"
              style={{ border: `1px solid ${tinta(0.1)}`, background: tinta(0.03) }}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium" style={{ color: 'var(--label-primary)' }}>
                  {fechaTxt(c.fecha)}
                </p>
                <p className="mt-0.5 text-xs" style={{ color: tintaTexto(0.5) }}>
                  {c.metodo} · {c.etiquetaOrigen}
                </p>
              </div>
              <p className="shrink-0 font-mono text-sm font-semibold tabular-nums" style={{ color: 'var(--tono-verde)' }}>
                {montoTxt(c)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
