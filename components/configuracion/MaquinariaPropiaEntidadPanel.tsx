'use client';

import { Truck } from 'lucide-react';
import ActivoCatalogoEntidadPanel from '@/components/configuracion/ActivoCatalogoEntidadPanel';

type Props = {
  entidadId: string;
  entidadNombre?: string;
};

/** Catálogo de maquinarias propias del patrono. */
export default function MaquinariaPropiaEntidadPanel({ entidadId, entidadNombre }: Props) {
  return (
    <ActivoCatalogoEntidadPanel
      entidadId={entidadId}
      entidadNombre={entidadNombre}
      categoria="maquinaria_propia"
      titulo="Maquinarias propias"
      subtitulo="Maquinaria de la empresa. Las alquiladas se gestionan en la ficha de cada obra."
      labelNombre="Maquinaria"
      botonAgregar="Agregar maquinaria propia"
      confirmBorrar="¿Eliminar esta maquinaria propia?"
      icon={Truck}
      accentClass="border-emerald-500/25 bg-emerald-950/15"
    />
  );
}
