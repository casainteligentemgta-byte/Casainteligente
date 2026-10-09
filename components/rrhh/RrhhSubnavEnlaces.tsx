'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { ClipboardList, FileText, UserRound, Wallet } from 'lucide-react';
import { hrefListaContratosExpress } from '@/lib/talento/hrefListaContratosExpress';
import { leerProyectoRrhhContexto } from '@/lib/rrhh/proyectoRrhhContexto';
import { hrefRrhhHub, hrefSolicitudPersonalObrero } from '@/lib/rrhh/hrefSolicitudPersonal';

type Props = {
  proyectoModuloId?: string | null;
  className?: string;
};

export const rrhhSubnavBtnClass =
  'inline-flex w-full min-h-[2.75rem] items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-center text-xs font-semibold leading-tight';

function btnActivo(activo: boolean, base: string, on: string) {
  return `${rrhhSubnavBtnClass} ${activo ? on : base}`;
}

/** Cuatro acciones del flujo RRHH de obra. */
export default function RrhhSubnavEnlaces({ proyectoModuloId = null, className = '' }: Props) {
  const path = usePathname();
  const search = useSearchParams();
  const mod = proyectoModuloId?.trim() || leerProyectoRrhhContexto() || null;
  const hrefSolicitar = hrefSolicitudPersonalObrero({ proyectoModuloId: mod });
  const hrefCandidatos = hrefRrhhHub({ proyectoModuloId: mod, vista: 'candidatos' });
  const hrefContratos = hrefListaContratosExpress({ proyectoModuloId: mod });
  const hrefNomina = mod
    ? `/rrhh/nomina?proyecto_modulo=${encodeURIComponent(mod)}`
    : '/rrhh/nomina';

  const enHub = path.startsWith('/rrhh/hojas-vida') && !path.includes('/archivo');
  const vista = (search.get('vista') ?? '').trim();
  const activoSolicitar = path.startsWith('/rrhh/solicitud-personal');
  const activoCandidatos = enHub && (vista === 'candidatos' || vista === '');
  const activoContratos = path.startsWith('/rrhh/contrato-trabajo-obrero');
  const activoNomina = path.startsWith('/rrhh/nomina');

  return (
    <nav className={`grid grid-cols-2 gap-2 sm:grid-cols-4 ${className}`.trim()} aria-label="Acciones RRHH">
      <Link
        href={hrefSolicitar}
        className={btnActivo(
          activoSolicitar,
          'border-violet-400/40 bg-violet-950/35 text-violet-100 hover:bg-violet-900/50',
          'border-violet-300/70 bg-violet-600/45 text-white',
        )}
      >
        <ClipboardList className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Solicitar
      </Link>
      <Link
        href={hrefCandidatos}
        className={btnActivo(
          activoCandidatos,
          'border-sky-500/40 bg-sky-950/35 text-sky-100 hover:bg-sky-900/50',
          'border-sky-300/70 bg-sky-600/40 text-white',
        )}
      >
        <UserRound className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Candidatos
      </Link>
      <Link
        href={hrefContratos}
        className={btnActivo(
          activoContratos,
          'border-amber-500/40 bg-amber-950/35 text-amber-100 hover:bg-amber-900/50',
          'border-amber-300/70 bg-amber-600/40 text-white',
        )}
      >
        <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Contratos
      </Link>
      <Link
        href={hrefNomina}
        className={btnActivo(
          activoNomina,
          'border-emerald-500/40 bg-emerald-950/35 text-emerald-100 hover:bg-emerald-900/50',
          'border-emerald-300/70 bg-emerald-600/40 text-white',
        )}
      >
        <Wallet className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Nómina
      </Link>
    </nav>
  );
}
