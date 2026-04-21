import Link from 'next/link';
import { MapPin, UserRound } from 'lucide-react';

export type ProyectoCardData = {
  nombre_proyecto: string;
  estado: string;
  ubicacion: string;
  cliente: string;
  total_personal?: number | null;
};

export type ProyectoCardProps = {
  proyecto: ProyectoCardData;
  /** Si se define, el botón principal navega aquí (p. ej. `/talento/obras/cierre?obraId=…`). */
  hrefGestionar?: string;
  onGestionarClick?: () => void;
};

/** Adapta una fila típica de `ci_obras` al shape esperado por la tarjeta. */
export function mapCiObraToProyectoCard(
  row: {
    nombre: string;
    ubicacion: string | null;
    cliente: string | null;
    estado: string;
  },
  totalPersonal?: number | null
): ProyectoCardData {
  return {
    nombre_proyecto: row.nombre,
    ubicacion: row.ubicacion?.trim() || '—',
    cliente: row.cliente?.trim() || '—',
    estado: row.estado,
    total_personal: totalPersonal ?? 0,
  };
}

export default function ProyectoCard({
  proyecto,
  hrefGestionar,
  onGestionarClick,
}: ProyectoCardProps) {
  const total = proyecto.total_personal ?? 0;
  const gestionarClassName =
    'inline-flex items-center justify-center bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors';

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all">
      <div className="flex justify-between items-start gap-3 mb-4">
        <h3 className="text-xl font-bold text-slate-800">{proyecto.nombre_proyecto}</h3>
        <span className="shrink-0 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-600 uppercase">
          {proyecto.estado}
        </span>
      </div>

      <div className="space-y-2 mb-6 text-sm text-slate-600">
        <p className="flex items-start gap-2">
          <MapPin className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" aria-hidden />
          <span>{proyecto.ubicacion}</span>
        </p>
        <p className="flex items-start gap-2">
          <UserRound className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" aria-hidden />
          <span>
            Cliente: <span className="text-slate-700">{proyecto.cliente}</span>
          </span>
        </p>
      </div>

      <div className="border-t border-slate-100 pt-4 flex flex-wrap justify-between items-center gap-4">
        <div>
          <p className="text-xs text-slate-400 uppercase font-bold">Personal Activo</p>
          <p className="text-lg font-bold text-slate-700">{total}</p>
        </div>
        {hrefGestionar ? (
          <Link href={hrefGestionar} className={gestionarClassName}>
            Gestionar Proyecto
          </Link>
        ) : (
          <button
            type="button"
            className={gestionarClassName}
            onClick={onGestionarClick}
          >
            Gestionar Proyecto
          </button>
        )}
      </div>
    </div>
  );
}
