import Link from 'next/link';
import { ClipboardList, FileText, HardHat, ScrollText, UserCog, UserRound, Users } from 'lucide-react';
import { hrefListaContratosExpress } from '@/lib/talento/hrefListaContratosExpress';
import {
  hrefGestionPersonalSolicitados,
  hrefRrhhHub,
  hrefSolicitudPersonalObrero,
} from '@/lib/rrhh/hrefSolicitudPersonal';

type Props = {
  proyectoModuloId?: string | null;
  className?: string;
  /** Acciones de obra (Nueva vacante, Ficha…) en la misma cuadrícula. */
  accionesObra?: React.ReactNode;
};

/** Estilo uniforme para celdas del subnav RRHH (links y botones). */
export const rrhhSubnavBtnClass =
  'inline-flex w-full min-h-[2.5rem] items-center justify-center gap-1.5 rounded-xl border px-2.5 py-2 text-center text-[11px] font-semibold leading-tight sm:text-xs';

/** Enlaces rápidos del RRHH unificado (menú inferior + obra). */
export default function RrhhSubnavEnlaces({
  proyectoModuloId = null,
  className = '',
  accionesObra,
}: Props) {
  const mod = proyectoModuloId?.trim() || null;
  const hrefSolicitud = hrefSolicitudPersonalObrero({
    proyectoModuloId: mod,
  });
  const hrefGestion = hrefGestionPersonalSolicitados({
    proyectoModuloId: mod,
    todosLosProyectos: !mod,
  });
  const hrefEquipoRec = `${hrefRrhhHub({ proyectoModuloId: mod })}#equipo-recomendado`;

  return (
    <nav
      className={`grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 ${className}`.trim()}
      aria-label="Accesos RRHH"
    >
      <Link
        href={hrefSolicitud}
        className={`${rrhhSubnavBtnClass} border-violet-400/50 bg-violet-600/30 text-violet-50 hover:bg-violet-600/45`}
      >
        <ClipboardList className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="truncate">Solicitud de personal obrero</span>
      </Link>
      <Link
        href={hrefGestion}
        className={`${rrhhSubnavBtnClass} border-violet-500/40 bg-violet-950/45 text-violet-100 hover:bg-violet-900/55`}
      >
        <UserCog className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="truncate">Gestión laboral</span>
      </Link>
      <Link
        href={hrefEquipoRec}
        className={`${rrhhSubnavBtnClass} border-sky-500/40 bg-sky-950/45 text-sky-100 hover:bg-sky-900/55`}
      >
        <HardHat className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="truncate">Equipo recomendado</span>
      </Link>
      <Link
        href="/rrhh/reclutamiento"
        className={`${rrhhSubnavBtnClass} border-sky-500/40 bg-sky-950/45 text-sky-100 hover:bg-sky-900/55`}
      >
        <Users className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="truncate">Reclutamiento</span>
      </Link>
      <Link
        href="/rrhh/trabajadores"
        className={`${rrhhSubnavBtnClass} border-fuchsia-500/40 bg-fuchsia-950/45 text-fuchsia-100 hover:bg-fuchsia-900/55`}
      >
        <Users className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="truncate">Trabajadores</span>
      </Link>
      <Link
        href="/rrhh/hojas-vida/archivo"
        className={`${rrhhSubnavBtnClass} border-sky-500/40 bg-sky-950/45 text-sky-100 hover:bg-sky-900/55`}
      >
        <UserRound className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="truncate">Hojas de vida</span>
      </Link>
      <Link
        href={hrefListaContratosExpress({ proyectoModuloId: mod })}
        className={`${rrhhSubnavBtnClass} border-amber-500/40 bg-amber-950/45 text-amber-100 hover:bg-amber-900/55`}
      >
        <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="truncate">Contrato de trabajo</span>
      </Link>
      <Link
        href="/rrhh/oficios-salarios"
        className={`${rrhhSubnavBtnClass} border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20`}
      >
        <ScrollText className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="truncate">Oficios y salarios</span>
      </Link>
      {accionesObra}
    </nav>
  );
}
