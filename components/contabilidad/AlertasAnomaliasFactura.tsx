'use client';

import type { AnomaliaFacturaCanal, RevisionManualFactura } from '@/lib/contabilidad/extractedCanal';

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
  bloqueaConfirmacion = false,
  revisionManual = null,
}: {
  anomalias?: AnomaliaFacturaCanal[] | null;
  bloqueaConfirmacion?: boolean;
  revisionManual?: RevisionManualFactura | null;
}) {
  if (!anomalias?.length && !revisionManual) return null;
  return (
    <div
      className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 space-y-1"
      role="status"
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-amber-300">
        {bloqueaConfirmacion ? 'Confirmación bloqueada · revisar' : 'Revisar antes de confirmar'}
      </p>
      {anomalias?.length ? (
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
      ) : null}
      {bloqueaConfirmacion ? (
        <p className="text-[11px] text-amber-200/90 pt-1">
          Corrija los datos de la factura o márquela como revisada para poder confirmar.
        </p>
      ) : null}
      {revisionManual?.at ? (
        <p className="text-[11px] text-emerald-200/90 pt-1">
          Marcada como revisada
          {revisionManual.por_email || revisionManual.por_nombre
            ? ` por ${revisionManual.por_nombre || revisionManual.por_email}`
            : ''}{' '}
          el {new Date(revisionManual.at).toLocaleString('es-VE')}.
        </p>
      ) : null}
    </div>
  );
}
