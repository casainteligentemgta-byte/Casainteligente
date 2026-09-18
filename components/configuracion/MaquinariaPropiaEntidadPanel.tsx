'use client';

import { useState } from 'react';
import { Truck } from 'lucide-react';
import ActivoCatalogoEntidadPanel from '@/components/configuracion/ActivoCatalogoEntidadPanel';
import FlotaWorkspace from '@/components/flota/FlotaWorkspace';
import { cn } from '@/lib/utils';

type Props = {
  entidadId: string;
  entidadNombre?: string;
};

type VistaMaquinaria = 'flota' | 'catalogo';

/** Catálogo de maquinarias propias + flota (gasolina, taller, alertas) del patrono. */
export default function MaquinariaPropiaEntidadPanel({ entidadId, entidadNombre }: Props) {
  const [vista, setVista] = useState<VistaMaquinaria>('flota');

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
        <button
          type="button"
          onClick={() => setVista('flota')}
          className={cn(
            'rounded-lg px-3 py-2 text-xs font-semibold transition',
            vista === 'flota' ? 'bg-amber-500/20 text-amber-100' : 'text-zinc-500 hover:text-zinc-200',
          )}
        >
          Flota
        </button>
        <button
          type="button"
          onClick={() => setVista('catalogo')}
          className={cn(
            'rounded-lg px-3 py-2 text-xs font-semibold transition',
            vista === 'catalogo' ? 'bg-emerald-500/20 text-emerald-100' : 'text-zinc-500 hover:text-zinc-200',
          )}
        >
          Catálogo y fotos
        </button>
      </div>

      {vista === 'flota' ? (
        <FlotaWorkspace entidadId={entidadId} defaultTipo="maquinaria" />
      ) : (
        <ActivoCatalogoEntidadPanel
          entidadId={entidadId}
          entidadNombre={entidadNombre}
          categoria="maquinaria_propia"
          titulo="Maquinarias propias"
          subtitulo="Fotos y ubicación en almacén. Las unidades también aparecen en Flota (gasolina, taller y alertas)."
          labelNombre="Equipo"
          botonAgregar="Agregar maquinaria propia"
          confirmBorrar="¿Eliminar esta maquinaria propia?"
          icon={Truck}
          accentClass="border-emerald-500/25 bg-emerald-950/15"
        />
      )}
    </div>
  );
}
