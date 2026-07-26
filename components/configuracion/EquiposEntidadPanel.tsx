'use client';

import { Package } from 'lucide-react';
import ActivoCatalogoEntidadPanel from '@/components/configuracion/ActivoCatalogoEntidadPanel';
import TransmisionTrabajadorEntidadPanel from '@/components/configuracion/TransmisionTrabajadorEntidadPanel';

type Props = {
  entidadId: string;
  entidadNombre?: string;
};

/** Catálogo de equipos propios del patrono + transmisión al trabajador. */
export default function EquiposEntidadPanel({ entidadId, entidadNombre }: Props) {
  return (
    <div className="space-y-2">
      <ActivoCatalogoEntidadPanel
        entidadId={entidadId}
        entidadNombre={entidadNombre}
        categoria="equipo"
        titulo="Inventario de equipos"
        subtitulo="Equipos propios del patrono. Fotos por costado y ubicación en almacén u obra."
        labelNombre="Equipo"
        botonAgregar="Agregar equipo"
        confirmBorrar="¿Eliminar este equipo?"
        icon={Package}
        accentClass="border-sky-500/25 bg-sky-950/15"
      />
      <TransmisionTrabajadorEntidadPanel entidadId={entidadId} entidadNombre={entidadNombre} />
    </div>
  );
}
