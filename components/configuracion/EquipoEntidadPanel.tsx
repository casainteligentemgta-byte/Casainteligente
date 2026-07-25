'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Users } from 'lucide-react';
import AsignarRolUsuario from '@/components/configuracion/AsignarRolUsuario';
import InvitarUsuarioAcceso from '@/components/configuracion/InvitarUsuarioAcceso';
import { Badge } from '@/components/ui/badge';
import { apiUrl } from '@/lib/http/apiUrl';

type FilaRol = {
  id: string;
  rol: string;
  entidad_id: string;
  usuario_id?: string;
  created_at?: string;
};

type Props = {
  entidadId: string;
  entidadNombre?: string;
};

/** Equipo y permisos de una entidad, embebido en el MENÚ del patrono. */
export default function EquipoEntidadPanel({ entidadId, entidadNombre }: Props) {
  const [filas, setFilas] = useState<FilaRol[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch(apiUrl('/api/auth/usuarios-roles'), { cache: 'no-store' });
      const data = (await res.json()) as { filas?: FilaRol[]; error?: string };
      if (!res.ok) {
        setError(data.error ?? 'No se pudieron cargar las asignaciones');
        setFilas([]);
        return;
      }
      setFilas((data.filas ?? []).filter((f) => f.entidad_id === entidadId));
    } catch {
      setError('Error de red');
      setFilas([]);
    } finally {
      setCargando(false);
    }
  }, [entidadId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return (
    <div className="space-y-6">
      <div>
        <p className="flex items-center gap-2 text-sm font-semibold text-white">
          <Users className="h-4 w-4 text-[#FFD60A]" />
          Equipo{entidadNombre ? ` · ${entidadNombre}` : ''}
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Invita usuarios, asigna roles de empresa y revisa quién tiene acceso a este patrono.
        </p>
      </div>

      <section className="space-y-2">
        <h3 className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">Invitar usuario</h3>
        <InvitarUsuarioAcceso entidadIdInicial={entidadId} embebido onListo={() => void cargar()} />
      </section>

      <section className="space-y-2 border-t border-white/10 pt-5">
        <h3 className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">
          Asignar rol (ya tiene cuenta)
        </h3>
        <AsignarRolUsuario entidadIdInicial={entidadId} embebido onAsignado={() => void cargar()} />
      </section>

      <section className="space-y-2 border-t border-white/10 pt-5">
        <h3 className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">
          Asignaciones de este patrono
        </h3>
        {cargando ? (
          <p className="flex items-center gap-2 text-sm text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando…
          </p>
        ) : error ? (
          <p className="rounded-lg border border-red-500/30 bg-red-950/25 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        ) : filas.length === 0 ? (
          <p className="text-sm text-zinc-500">Aún no hay roles asignados a esta entidad.</p>
        ) : (
          <ul className="divide-y divide-white/5 overflow-hidden rounded-xl border border-white/10">
            {filas.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm">
                <span className="truncate font-mono text-xs text-zinc-400">
                  {f.usuario_id ? `${f.usuario_id.slice(0, 8)}…` : f.id.slice(0, 8)}
                </span>
                <Badge className="bg-[#FF9500]/15 text-[#FFD60A]">{f.rol}</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
