'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import RegistroMaquinariaIntercompany from '@/components/almacen/RegistroMaquinariaIntercompany';
import InventarioEquiposProyecto from '@/components/proyectos/InventarioEquiposProyecto';
import { createClient } from '@/lib/supabase/client';
import {
  PROYECTO_EQUIPO_SELECT,
  PROYECTO_EQUIPO_SELECT_LEGACY,
  isMaquinariaColumnMissing,
  mapProyectoEquipoRow,
  type ProyectoEquipoRow,
} from '@/lib/proyectos/proyectoEquipos';

type Props = { proyectoId: string };

export default function MaquinariaControlObraClient({ proyectoId }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [equipos, setEquipos] = useState<ProyectoEquipoRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setError(null);
    const full = await supabase
      .from('ci_proyecto_equipos')
      .select(PROYECTO_EQUIPO_SELECT)
      .eq('proyecto_id', proyectoId)
      .order('created_at', { ascending: false });

    let rows: unknown[] | null = full.data;
    let qErr = full.error;

    if (qErr && isMaquinariaColumnMissing(qErr.message)) {
      const legacy = await supabase
        .from('ci_proyecto_equipos')
        .select(PROYECTO_EQUIPO_SELECT_LEGACY)
        .eq('proyecto_id', proyectoId)
        .order('created_at', { ascending: false });
      rows = legacy.data;
      qErr = legacy.error;
    }

    if (qErr) {
      setError(qErr.message);
      setEquipos([]);
      return;
    }
    setEquipos((rows ?? []).map((r) => mapProyectoEquipoRow(r as Record<string, unknown>)));
  }, [supabase, proyectoId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return (
    <div className="space-y-10">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Control de obras</p>
        <h2 className="mt-1 text-xl font-bold text-white">Maquinaria</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Alquiladas e intercompany de esta obra. Las propias se registran en el MENÚ de la entidad.
        </p>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-950/25 px-4 py-3 text-sm text-red-200">{error}</p>
      ) : null}

      <InventarioEquiposProyecto
        proyectoId={proyectoId}
        equipos={equipos}
        onRefresh={() => void cargar()}
        onError={setError}
        secciones={['maquinaria_alquilada']}
      />

      <div className="border-t border-white/10 pt-8">
        <p className="mb-4 text-xs font-bold uppercase tracking-widest text-zinc-500">
          Maquinaria intercompany
        </p>
        <RegistroMaquinariaIntercompany proyectoId={proyectoId} />
      </div>
    </div>
  );
}
