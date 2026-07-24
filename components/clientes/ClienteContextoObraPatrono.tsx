'use client';

import Link from 'next/link';
import { Building2, HardHat, UserRound } from 'lucide-react';
import type { PatronoObraResumen } from '@/lib/clientes/proyectosClienteDisplay';

type Props = {
  patronos: PatronoObraResumen[];
  clienteNombre: string;
};

export default function ClienteContextoObraPatrono({ patronos, clienteNombre }: Props) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-amber-500/25 bg-amber-950/20 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-300/90">
          Cliente vs patrono vs obra
        </p>
        <ul className="mt-3 space-y-2.5 text-sm text-zinc-300">
          <li className="flex gap-2.5">
            <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-[#7cb9ff]" aria-hidden />
            <span>
              <strong className="text-white">Cliente</strong> ({clienteNombre}) — relación comercial en{' '}
              <code className="text-xs text-zinc-400">customers</code>.
            </span>
          </li>
          <li className="flex gap-2.5">
            <HardHat className="mt-0.5 h-4 w-4 shrink-0 text-violet-400" aria-hidden />
            <span>
              <strong className="text-white">Obra</strong> — proyecto en campo (
              <code className="text-xs text-zinc-400">ci_proyectos</code>).
            </span>
          </li>
          <li className="flex gap-2.5">
            <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden />
            <span>
              <strong className="text-white">Patrono</strong> — razón social que factura y nómina (ej. DIMAQUINAS), en{' '}
              <code className="text-xs text-zinc-400">ci_entidades</code>. No es el mismo registro que el cliente CRM.
            </span>
          </li>
        </ul>
        <p className="mt-3 text-xs leading-relaxed text-zinc-500">
          Las compras de contabilidad van a <strong className="text-zinc-400">obra + patrono</strong>, no al cliente
          directamente.
        </p>
      </div>

      {patronos.length > 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-white">Patronos en sus obras</h2>
            <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium text-zinc-300">
              {patronos.length}
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            Entidades fiscales distintas al cliente CRM. Gestión en{' '}
            <Link href="/configuracion/entidades" className="text-[#7cb9ff] hover:underline">
              Configuración → Entidades
            </Link>
            .
          </p>
          <ul className="mt-4 space-y-2">
            {patronos.map((p) => (
              <li
                key={p.entidadId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/20 bg-amber-950/10 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="font-medium text-amber-100">{p.nombre}</p>
                  <p className="text-xs text-zinc-500">
                    {p.rif ? `RIF ${p.rif} · ` : ''}
                    {p.obraCount} obra{p.obraCount === 1 ? '' : 's'}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-300">
                  Patrono
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
