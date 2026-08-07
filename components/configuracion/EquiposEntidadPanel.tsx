'use client';

import { Package, Wrench } from 'lucide-react';
import ActivoCatalogoEntidadPanel from '@/components/configuracion/ActivoCatalogoEntidadPanel';
import TransmisionTrabajadorEntidadPanel from '@/components/configuracion/TransmisionTrabajadorEntidadPanel';

type Props = {
  entidadId: string;
  entidadNombre?: string;
};

/** Inventario de equipos/herramientas del patrono + transmisión al trabajador. */
export default function EquiposEntidadPanel({ entidadId, entidadNombre }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-bold uppercase tracking-wide text-zinc-400">
          Inventario de equipos
        </h3>
        <p className="mt-1 text-xs text-zinc-500">
          Herramientas y equipos del patrono. Aquí también se arma la transmisión al trabajador.
        </p>
      </div>

      <ActivoCatalogoEntidadPanel
        entidadId={entidadId}
        entidadNombre={entidadNombre}
        categoria="equipo"
        titulo="Equipos"
        subtitulo="Equipos propios del patrono."
        labelNombre="Equipo"
        botonAgregar="Agregar equipo"
        confirmBorrar="¿Eliminar este equipo?"
        icon={Package}
        accentClass="border-sky-500/25 bg-sky-950/15"
      />

      <ActivoCatalogoEntidadPanel
        entidadId={entidadId}
        entidadNombre={entidadNombre}
        categoria="herramienta"
        titulo="Herramientas"
        subtitulo="Herramientas del patrono."
        labelNombre="Herramienta"
        botonAgregar="Agregar herramienta"
        confirmBorrar="¿Eliminar esta herramienta?"
        icon={Wrench}
        accentClass="border-amber-500/25 bg-amber-950/15"
      />

      <TransmisionTrabajadorEntidadPanel entidadId={entidadId} entidadNombre={entidadNombre} />
    </div>
  );
}
