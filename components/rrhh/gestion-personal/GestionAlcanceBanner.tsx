'use client';

import { Button } from '@/components/ui/button';

type Props = {
  alcanceNombre: string | null;
  onVerTodo: () => void;
};

/** Banner de filtro de alcance en Gestión de personal. */
export default function GestionAlcanceBanner({ alcanceNombre, onVerTodo }: Props) {
  return (
    <div className="mb-4 flex flex-col gap-2 rounded-lg border border-sky-500/30 bg-sky-950/40 px-3 py-2 text-sm text-sky-100 sm:flex-row sm:items-center sm:justify-between">
      <p>
        <span className="font-semibold text-white">SOLICITADOS.</span>{' '}
        {alcanceNombre ?? 'Seleccionado'}
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="shrink-0 border-white/10 text-zinc-300 hover:bg-white/5 backdrop-blur-sm"
        onClick={onVerTodo}
      >
        Ver todo (todos los proyectos)
      </Button>
    </div>
  );
}
