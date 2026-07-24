'use client';

import type { ReactNode } from 'react';
import {
  ArrowDownCircle,
  ArrowRightLeft,
  RotateCcw,
  Construction,
  PackageCheck,
  Calendar,
  User,
  Info,
} from 'lucide-react';
import type { MovimientoJourney, MovimientoJourneyTipo } from '@/lib/almacen/trazabilidadMaterial';

type StatusStyle = {
  bg: string;
  text: string;
  icon: ReactNode;
  label: string;
};

const getStatusStyles = (tipo: MovimientoJourneyTipo): StatusStyle => {
  switch (tipo) {
    case 'INGRESO_COMPRA':
      return {
        bg: 'bg-emerald-500/15',
        text: 'text-emerald-400',
        icon: <PackageCheck size={20} />,
        label: 'Ingreso inicial',
      };
    case 'TRASPASO_PRESTAMO':
      return {
        bg: 'bg-amber-500/15',
        text: 'text-amber-400',
        icon: <ArrowRightLeft size={20} />,
        label: 'Traspaso entre obras',
      };
    case 'DEVOLUCION_PRESTAMO':
      return {
        bg: 'bg-sky-500/15',
        text: 'text-sky-400',
        icon: <RotateCcw size={20} />,
        label: 'Devolución de préstamo',
      };
    case 'CONSUMO_OBRA':
      return {
        bg: 'bg-zinc-500/20',
        text: 'text-zinc-300',
        icon: <Construction size={20} />,
        label: 'Consumo en obra',
      };
    default:
      return {
        bg: 'bg-zinc-500/15',
        text: 'text-zinc-400',
        icon: <Info size={20} />,
        label: 'Ajuste',
      };
  }
};

type Props = {
  movimientos: MovimientoJourney[];
  titulo?: string;
  subtitulo?: string;
  materialNombre?: string;
  materialCodigo?: string | null;
};

export default function MaterialJourneyTimeline({
  movimientos,
  titulo = 'Ruta crítica del material',
  subtitulo = 'Historial de trayectoria y custodia en almacenes',
  materialNombre,
  materialCodigo,
}: Props) {
  const ubicacionActual =
    movimientos.length > 0 ? movimientos[movimientos.length - 1].destino : 'Sin movimientos';

  if (!movimientos.length) {
    return (
      <div className="max-w-4xl mx-auto p-8 rounded-2xl border border-zinc-800 bg-zinc-950/80 text-center">
        <p className="text-zinc-500 text-sm font-bold uppercase tracking-widest">
          Sin movimientos en el ledger
        </p>
        <p className="text-zinc-600 text-xs mt-2">
          Los ingresos, traspasos y egresos aparecerán aquí cuando se registren en inventario.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 rounded-2xl border border-zinc-800 bg-zinc-950/90 shadow-xl">
      <div className="mb-8">
        <h2 className="text-2xl font-black text-white tracking-tight">{titulo}</h2>
        <p className="text-zinc-500 text-sm mt-1">{subtitulo}</p>
        {materialNombre ? (
          <p className="text-zinc-300 text-sm font-bold mt-3">
            {materialNombre}
            {materialCodigo ? (
              <span className="text-zinc-500 font-mono font-normal ml-2">{materialCodigo}</span>
            ) : null}
          </p>
        ) : null}
      </div>

      <div className="relative border-l-2 border-zinc-800 ml-4 pl-8 space-y-12">
        {movimientos.map((mov) => {
          const style = getStatusStyles(mov.tipo);

          return (
            <div key={mov.id} className="relative">
              <div
                className={`absolute -left-[43px] p-2 rounded-full border-4 border-zinc-950 shadow-sm ${style.bg} ${style.text}`}
              >
                {style.icon}
              </div>

              <div className="flex flex-col md:flex-row md:items-start gap-4">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-3 mb-1">
                    <span
                      className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${style.bg} ${style.text}`}
                    >
                      {style.label}
                    </span>
                    <span className="text-zinc-500 text-xs flex items-center gap-1">
                      <Calendar size={12} />
                      {new Date(mov.fecha).toLocaleString('es-VE', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </span>
                  </div>

                  <h3 className="text-lg font-semibold text-zinc-100">
                    {mov.cantidad} unidades{' '}
                    <span className="font-normal text-zinc-500">hacia</span> {mov.destino}
                  </h3>

                  <div className="flex items-center gap-4 mt-2 text-sm text-zinc-500 italic">
                    <p className="flex items-center gap-1">
                      <ArrowDownCircle size={14} className="rotate-90 text-zinc-600" />
                      Origen: <span className="font-medium text-zinc-300 not-italic">{mov.origen}</span>
                    </p>
                  </div>

                  {mov.notas ? (
                    <div className="mt-3 p-3 bg-zinc-900/80 rounded-lg text-sm text-zinc-400 border-l-2 border-zinc-700">
                      {mov.notas}
                    </div>
                  ) : null}
                </div>

                <div className="flex items-center gap-2 px-4 py-2 bg-zinc-900 rounded-xl border border-zinc-800 self-start shrink-0">
                  <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400">
                    <User size={16} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-zinc-500 uppercase font-bold">Origen registro</span>
                    <span className="text-xs font-medium text-zinc-300">{mov.responsable}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-12 flex justify-center">
        <div className="px-6 py-2 bg-[#FF9500] text-black text-[11px] font-black rounded-full uppercase tracking-[2px]">
          Ubicación actual: {ubicacionActual}
        </div>
      </div>
    </div>
  );
}
