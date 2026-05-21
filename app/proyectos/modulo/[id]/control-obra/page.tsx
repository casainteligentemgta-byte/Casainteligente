'use client';

import ControlObraClient from '@/components/proyectos/ControlObraClient';

export default function ControlObraPage({ params }: { params: { id: string } }) {
  const proyectoId = String(params?.id ?? '').trim();
  if (!proyectoId) {
    return (
      <main className="min-h-screen bg-[#0A0A0F] px-4 py-8 text-sm text-red-400">
        Proyecto no válido.
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0A0A0F] px-4 py-8 md:px-8">
      <ControlObraClient proyectoId={proyectoId} />
    </main>
  );
}
