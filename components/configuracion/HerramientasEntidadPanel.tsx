'use client';

import { Wrench } from 'lucide-react';
import ActivoCatalogoEntidadPanel from '@/components/configuracion/ActivoCatalogoEntidadPanel';

type Props = {
  entidadId: string;
  entidadNombre?: string;
};

/** Catálogo de herramientas del patrono. */
export default function HerramientasEntidadPanel({ entidadId, entidadNombre }: Props) {
  return (
    <ActivoCatalogoEntidadPanel
      entidadId={entidadId}
      entidadNombre={entidadNombre}
      categoria="herramienta"
      titulo="Herramientas"
      subtitulo="Herramientas del patrono. Fotos por costado y ubicación en almacén u obra."
      labelNombre="Herramienta"
      botonAgregar="Agregar herramienta"
      confirmBorrar="¿Eliminar esta herramienta?"
      icon={Wrench}
      accentClass="border-amber-500/25 bg-amber-950/15"
    />
  );
}
