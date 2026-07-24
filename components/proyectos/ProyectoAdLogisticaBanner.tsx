'use client';

import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';

type Props = {
  proyectoId: string;
  autorizado: boolean;
  loading?: boolean;
  onAbrirContratoAd?: () => void;
  className?: string;
};

/** Banner + bloqueo cuando falta contrato AD exitoso. */
export default function ProyectoAdLogisticaBanner({
  proyectoId,
  autorizado,
  loading,
  onAbrirContratoAd,
  className = '',
}: Props) {
  if (loading || autorizado) return null;

  return (
    <div
      className={`rounded-xl border border-amber-500/35 bg-amber-950/25 p-4 ${className}`}
      role="alert"
    >
      <div className="flex flex-wrap items-start gap-3">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm font-bold text-amber-100">
            Protección logística: falta Contrato de Administración Delegada
          </p>
          <p className="text-xs text-amber-200/80">
            Registre el contrato AD (entidad ejecutora + % honorarios) antes de autorizar compras o
            despachos. Evita que la constructora financie la obra de su propio bolsillo.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {onAbrirContratoAd ? (
              <button
                type="button"
                onClick={onAbrirContratoAd}
                className="rounded-lg border border-amber-500/50 bg-amber-500/15 px-3 py-2 text-xs font-bold text-amber-100 hover:bg-amber-500/25"
              >
                Generar Contrato AD
              </button>
            ) : (
              <Link
                href={`/proyectos/modulo/${encodeURIComponent(proyectoId)}`}
                className="rounded-lg border border-amber-500/50 bg-amber-500/15 px-3 py-2 text-xs font-bold text-amber-100 hover:bg-amber-500/25"
              >
                Ir a ficha del proyecto
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
