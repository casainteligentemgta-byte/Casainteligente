import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Equipo | Casa Inteligente',
  description: 'El equipo se gestiona dentro de cada proyecto (Control de obra → Equipo).',
};

/** Equipo vive dentro de cada proyecto: /proyectos/modulo/[id]/control-obra/equipo */
export default function ConfiguracionEquipoPage() {
  redirect('/proyectos/modulo');
}
