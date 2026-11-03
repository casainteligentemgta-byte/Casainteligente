'use client';

import Link from 'next/link';
import { Building2, HardHat, UserRound } from 'lucide-react';
import type { PatronoObraResumen } from '@/lib/clientes/proyectosClienteDisplay';
import { tinta, tintaTexto } from '@/lib/tema/tinta';

type Props = {
  patronos: PatronoObraResumen[];
  clienteNombre: string;
};

export default function ClienteContextoObraPatrono({ patronos, clienteNombre }: Props) {
  return (
    <div className="space-y-4">
      <div
        className="rounded-2xl p-4"
        style={{ border: '1px solid rgba(245,158,11,0.28)', background: 'rgba(245,158,11,0.08)' }}
      >
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--tono-naranja)' }}>
          Cliente vs patrono vs obra
        </p>
        <ul className="mt-3 space-y-2.5 text-sm" style={{ color: 'var(--label-secondary)' }}>
          <li className="flex gap-2.5">
            <UserRound className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--tono-azul)' }} aria-hidden />
            <span>
              <strong style={{ color: 'var(--label-primary)' }}>Cliente</strong> ({clienteNombre}) — la persona o
              empresa con quien se trata comercialmente.
            </span>
          </li>
          <li className="flex gap-2.5">
            <HardHat className="mt-0.5 h-4 w-4 shrink-0 text-violet-400" aria-hidden />
            <span>
              <strong style={{ color: 'var(--label-primary)' }}>Obra</strong> — el proyecto en campo.
            </span>
          </li>
          <li className="flex gap-2.5">
            <Building2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--tono-naranja)' }} aria-hidden />
            <span>
              <strong style={{ color: 'var(--label-primary)' }}>Patrono</strong> — la razón social que factura y paga
              nómina (no es el mismo registro que el cliente).
            </span>
          </li>
        </ul>
        <p className="mt-3 text-xs leading-relaxed" style={{ color: tintaTexto(0.45) }}>
          Las compras de contabilidad van a <strong>obra + patrono</strong>, no al cliente directamente.
        </p>
      </div>

      {patronos.length > 0 ? (
        <div
          className="rounded-2xl p-4"
          style={{ border: `1px solid ${tinta(0.1)}`, background: 'var(--superficie)' }}
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--label-primary)' }}>
              Patronos en sus obras
            </h2>
            <span
              className="rounded-full px-2.5 py-0.5 text-xs font-medium"
              style={{ background: tinta(0.08), color: tintaTexto(0.7) }}
            >
              {patronos.length}
            </span>
          </div>
          <p className="mt-1 text-xs" style={{ color: tintaTexto(0.45) }}>
            Entidades fiscales distintas al cliente. Gestión en{' '}
            <Link href="/configuracion/entidades" style={{ color: 'var(--tono-azul)' }}>
              Configuración → Entidades
            </Link>
            .
          </p>
          <ul className="mt-4 space-y-2">
            {patronos.map((p) => (
              <li
                key={p.entidadId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2.5"
                style={{ border: '1px solid rgba(245,158,11,0.25)', background: 'rgba(245,158,11,0.06)' }}
              >
                <div className="min-w-0">
                  <p className="font-medium" style={{ color: 'var(--label-primary)' }}>
                    {p.nombre}
                  </p>
                  <p className="text-xs" style={{ color: tintaTexto(0.45) }}>
                    {p.rif ? `RIF ${p.rif} · ` : ''}
                    {p.obraCount} obra{p.obraCount === 1 ? '' : 's'}
                  </p>
                </div>
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                  style={{ background: 'rgba(245,158,11,0.15)', color: 'var(--tono-naranja)' }}
                >
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
