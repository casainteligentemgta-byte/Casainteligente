import { redirect } from 'next/navigation';

/** Ruta legada: redirige al módulo CONTROL DE OBRA */
export default function ProyectoLuloRedirectPage({ params }: { params: { id: string } }) {
  redirect(`/proyectos/modulo/${params.id}/control-obra`);
}
