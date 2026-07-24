import Link from 'next/link';
import { ClipboardList, FileText, ScrollText, UserRound, Users } from 'lucide-react';
import { hrefListaContratosExpress } from '@/lib/talento/hrefListaContratosExpress';
import { hrefSolicitudPersonalObrero } from '@/lib/rrhh/hrefSolicitudPersonal';

type Props = {
  proyectoModuloId?: string | null;
  className?: string;
};

/** Enlaces rápidos RRHH (una sola fila en hub y subpáginas). */
export default function RrhhSubnavEnlaces({ proyectoModuloId = null, className = '' }: Props) {
  const hrefSolicitud = hrefSolicitudPersonalObrero({
    proyectoModuloId: proyectoModuloId?.trim() || null,
  });

  return (
    <nav
      className={`flex flex-wrap items-center justify-end gap-2 ${className}`.trim()}
      aria-label="Accesos RRHH"
    >
      <Link
        href={hrefSolicitud}
        className="inline-flex items-center gap-2 rounded-xl border border-violet-400/50 bg-violet-600/30 px-4 py-2.5 text-sm font-bold text-violet-50 transition hover:bg-violet-600/45"
      >
        <ClipboardList className="h-4 w-4" aria-hidden />
        Solicitud de personal obrero
      </Link>
      <Link
        href="/rrhh/reclutamiento"
        className="inline-flex items-center gap-2 rounded-xl border border-violet-500/40 bg-violet-950/45 px-3 py-2 text-sm font-semibold text-violet-100 transition hover:bg-violet-900/55"
      >
        <Users className="h-4 w-4 shrink-0" aria-hidden />
        Reclutamiento
      </Link>
      <Link
        href="/rrhh/trabajadores"
        className="inline-flex items-center gap-2 rounded-xl border border-fuchsia-500/40 bg-fuchsia-950/45 px-3 py-2 text-sm font-semibold text-fuchsia-100 transition hover:bg-fuchsia-900/55"
      >
        <Users className="h-4 w-4 shrink-0" aria-hidden />
        Trabajadores
      </Link>
      <Link
        href="/rrhh/hojas-vida/archivo"
        className="inline-flex items-center gap-2 rounded-xl border border-sky-500/40 bg-sky-950/45 px-3 py-2 text-sm font-semibold text-sky-100 transition hover:bg-sky-900/55"
      >
        <UserRound className="h-4 w-4 shrink-0" aria-hidden />
        Hojas de vida
      </Link>
      <Link
        href={hrefListaContratosExpress()}
        className="inline-flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-950/45 px-3 py-2 text-sm font-semibold text-amber-100 transition hover:bg-amber-900/55"
      >
        <FileText className="h-4 w-4 shrink-0" aria-hidden />
        Express
      </Link>
      <Link
        href="/rrhh/oficios-salarios"
        className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
      >
        <ScrollText className="h-4 w-4" aria-hidden />
        Oficios y salarios
      </Link>
    </nav>
  );
}
