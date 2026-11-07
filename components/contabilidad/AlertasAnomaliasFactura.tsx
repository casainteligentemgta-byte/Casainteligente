'use client';

import type { AnomaliaFacturaCanal } from '@/lib/contabilidad/extractedCanal';

export function BadgeSugerido({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full bg-sky-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-sky-200 ${className}`}
    >
      Sugerido
    </span>
  );
}

export function BadgeAlertaFactura({
  n,
  className = '',
}: {
  n: number;
  className?: string;
}) {
  if (n <= 0) return null;
  return (
    <span
      className={`inline-flex items-center rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-200 ${className}`}
    >
      {n === 1 ? '1 alerta' : `${n} alertas`}
    </span>
  );
}

export default function AlertasAnomaliasFactura({
  anomalias,
}: {
  anomalias?: AnomaliaFacturaCanal[] | null;
}) {
  if (!anomalias?.length) return null;
  return (
    <div
      className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 space-y-1"
      role="status"
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-amber-300">
        Revisar antes de confirmar
      </p>
      <ul className="space-y-1">
        {anomalias.map((a, i) => (
          <li
            key={`${a.tipo}-${i}`}
            className={`text-[11px] leading-snug ${
              a.severidad === 'alerta' ? 'text-amber-100' : 'text-amber-200/90'
            }`}
          >
            {a.mensaje}
          </li>
        ))}
      </ul>
    </div>
  );
}
