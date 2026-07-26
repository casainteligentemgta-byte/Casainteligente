'use client';

import { Package, Wrench } from 'lucide-react';
import ActivoCatalogoEntidadPanel from '@/components/configuracion/ActivoCatalogoEntidadPanel';
import TransmisionTrabajadorEntidadPanel from '@/components/configuracion/TransmisionTrabajadorEntidadPanel';

type Props = {
  entidadId: string;
  entidadNombre?: string;
};

/** Inventario unificado: equipos + herramientas del patrono, y transmisión al trabajador. */
export default function EquiposEntidadPanel({ entidadId, entidadNombre }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-bold text-white">Equipos y herramientas</h3>
        <p className="mt-1 text-xs text-zinc-500">
          Inventario del patrono (equipos y herramientas). Fotos por costado y ubicación en almacén u obra.
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
