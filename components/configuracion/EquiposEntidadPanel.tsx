'use client';

import { Package } from 'lucide-react';
import ActivoCatalogoEntidadPanel from '@/components/configuracion/ActivoCatalogoEntidadPanel';

type Props = {
  entidadId: string;
  entidadNombre?: string;
};

/** Catálogo de equipos propios del patrono (distinto de «Equipo» = personal). */
export default function EquiposEntidadPanel({ entidadId, entidadNombre }: Props) {
  return (
    <ActivoCatalogoEntidadPanel
      entidadId={entidadId}
      entidadNombre={entidadNombre}
      categoria="equipo"
      titulo="Equipos"
      subtitulo="Equipos propios del patrono. Fotos por costado y ubicación en almacén u obra."
      labelNombre="Equipo"
      botonAgregar="Agregar equipo"
      confirmBorrar="¿Eliminar este equipo?"
      icon={Package}
      accentClass="border-sky-500/25 bg-sky-950/15"
    />
  );
}
