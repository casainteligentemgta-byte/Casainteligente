import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Equipo y permisos | Casa Inteligente',
  description: 'El equipo se gestiona desde el MENÚ de cada entidad / patrono.',
};

/** Equipo vive dentro del MENÚ de Entidades (pestaña Equipo por patrono). */
export default function ConfiguracionEquipoPage() {
  redirect('/configuracion/entidades');
}
