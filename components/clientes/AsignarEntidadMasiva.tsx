'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { apiAsignarEntidadMasiva } from '@/lib/clientes/apiCliente';
import { createClient } from '@/lib/supabase/client';
import {
  conNombreEntidad,
  SELECT_NOMBRE_ENTIDAD,
  type EntidadConNombre,
} from '@/lib/entidades/nombreEntidad';
import { tinta, tintaTexto } from '@/lib/tema/tinta';

type EntidadOpcion = { id: string; nombre: string };

export default function AsignarEntidadMasiva({
  clientes,
  onAsignado,
}: {
  clientes: Array<{ id: string; nombre: string }>;
  onAsignado: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [entidades, setEntidades] = useState<EntidadOpcion[]>([]);
  const [entidadId, setEntidadId] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase.from('ci_entidades').select(`${SELECT_NOMBRE_ENTIDAD}, rif`);
      if (!alive) return;
      if (error) {
        setEntidades([]);
        return;
      }
      setEntidades(
        conNombreEntidad((data ?? []) as EntidadConNombre[]).map((e) => ({
          id: String(e.id),
          nombre: e.nombre,
        })),
      );
    })();
    return () => {
      alive = false;
    };
  }, [supabase]);

  if (!clientes.length) return null;

  async function asignar() {
    if (!entidadId) {
      toast.error('Elija una empresa para asignar a estos clientes.');
      return;
    }
    const nombreEmpresa = entidades.find((e) => e.id === entidadId)?.nombre || 'esa empresa';
    if (
      !window.confirm(
        `¿Asignar ${clientes.length} cliente${clientes.length === 1 ? '' : 's'} sin empresa a ${nombreEmpresa}?`,
      )
    ) {
      return;
    }
    setGuardando(true);
    const r = await apiAsignarEntidadMasiva(
      entidadId,
      clientes.map((c) => c.id),
    );
    setGuardando(false);
    if (r.error) {
      toast.error(r.error);
      return;
    }
    toast.success(
      r.vinculados === 1
        ? `Se asignó 1 cliente a ${nombreEmpresa}`
        : `Se asignaron ${r.vinculados} clientes a ${nombreEmpresa}`,
    );
    onAsignado();
  }

  return (
    <div
      style={{
        margin: '8px 16px 0',
        padding: 14,
        borderRadius: 16,
        border: '1px solid rgba(255,149,0,0.35)',
        background: 'rgba(255,149,0,0.1)',
      }}
    >
      <p style={{ fontWeight: 700, color: 'var(--label-primary)', fontSize: 14 }}>
        {clientes.length === 1
          ? 'Hay 1 cliente sin empresa'
          : `Hay ${clientes.length} clientes sin empresa`}
      </p>
      <p style={{ fontSize: 12, color: tintaTexto(0.55), marginTop: 4, lineHeight: 1.45 }}>
        Asígnelos a una empresa para que el equipo correspondiente los vea. Puede hacerlo uno por
        uno en la ficha, o todos juntos aquí.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
        <select
          value={entidadId}
          onChange={(e) => setEntidadId(e.target.value)}
          style={{
            flex: 1,
            minWidth: 180,
            borderRadius: 12,
            border: `1px solid ${tinta(0.15)}`,
            background: 'var(--superficie)',
            color: 'var(--label-primary)',
            padding: '10px 12px',
            fontSize: 14,
            fontFamily: 'inherit',
          }}
        >
          <option value="">Elegir empresa…</option>
          {entidades.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nombre}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={guardando || !entidadId}
          onClick={() => void asignar()}
          style={{
            borderRadius: 12,
            border: '1px solid rgba(255,149,0,0.4)',
            background: 'rgba(255,149,0,0.2)',
            color: 'var(--tono-naranja)',
            fontWeight: 700,
            fontSize: 13,
            padding: '10px 14px',
            cursor: guardando ? 'wait' : 'pointer',
            fontFamily: 'inherit',
            opacity: !entidadId || guardando ? 0.6 : 1,
          }}
        >
          {guardando ? 'Asignando…' : 'Asignar a todos'}
        </button>
      </div>
    </div>
  );
}
