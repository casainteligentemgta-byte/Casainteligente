'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { toast } from 'sonner';
import {
  apiDesvincularEntidadCliente,
  apiVincularEntidadCliente,
} from '@/lib/clientes/apiCliente';
import {
  mensajeConfirmarDesvincular,
  type ClienteEntidadVinculo,
} from '@/lib/clientes/clienteEntidades';
import { createClient } from '@/lib/supabase/client';
import {
  conNombreEntidad,
  SELECT_NOMBRE_ENTIDAD,
  type EntidadConNombre,
} from '@/lib/entidades/nombreEntidad';
import { tinta, tintaTexto } from '@/lib/tema/tinta';

type EntidadOpcion = { id: string; nombre: string };

export default function ClienteEntidadesFicha({
  customerId,
  customerNombre,
  vinculos,
  esAdmin,
  entidadIdsUsuario,
  card,
  onChange,
}: {
  customerId: string;
  customerNombre: string;
  vinculos: ClienteEntidadVinculo[];
  esAdmin: boolean;
  entidadIdsUsuario: string[];
  card: CSSProperties;
  onChange: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [catalogo, setCatalogo] = useState<EntidadOpcion[]>([]);
  const [elegida, setElegida] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!esAdmin) return;
    let alive = true;
    (async () => {
      const { data, error } = await supabase.from('ci_entidades').select(`${SELECT_NOMBRE_ENTIDAD}, rif`);
      if (!alive) return;
      if (error) {
        setCatalogo([]);
        return;
      }
      setCatalogo(
        conNombreEntidad((data ?? []) as EntidadConNombre[]).map((e) => ({
          id: String(e.id),
          nombre: e.nombre,
        })),
      );
    })();
    return () => {
      alive = false;
    };
  }, [esAdmin, supabase]);

  const yaLigadas = new Set(vinculos.map((v) => v.entidadId));
  const disponibles = catalogo.filter((e) => !yaLigadas.has(e.id));

  async function agregar() {
    const eid = elegida.trim();
    if (!eid) {
      toast.error('Elija una empresa.');
      return;
    }
    setGuardando(true);
    const r = await apiVincularEntidadCliente(customerId, eid);
    setGuardando(false);
    if (r.error) {
      toast.error(r.error);
      return;
    }
    setElegida('');
    toast.success('Empresa agregada a este cliente');
    onChange();
  }

  async function quitar(v: ClienteEntidadVinculo) {
    const puede = esAdmin || entidadIdsUsuario.includes(v.entidadId);
    if (!puede) return;
    if (!window.confirm(mensajeConfirmarDesvincular(customerNombre, v.nombre))) return;
    setGuardando(true);
    const r = await apiDesvincularEntidadCliente(customerId, v.entidadId);
    setGuardando(false);
    if (r.error) {
      toast.error(r.error);
      return;
    }
    toast.success(`Se quitó de ${v.nombre}`);
    onChange();
  }

  return (
    <div style={card}>
      <h2 className="text-lg font-semibold" style={{ color: 'var(--label-primary)' }}>
        Empresas de este cliente
      </h2>
      <p className="mt-1 text-xs" style={{ color: tintaTexto(0.5) }}>
        Un mismo cliente puede ser de varias empresas (Casa Inteligente, DIMAQUINAS, etc.).
      </p>
      {vinculos.length === 0 ? (
        <p className="mt-3 text-sm" style={{ color: tintaTexto(0.5) }}>
          Todavía no está asignado a ninguna empresa.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {vinculos.map((v) => {
            const puedeQuitar = esAdmin || entidadIdsUsuario.includes(v.entidadId);
            return (
              <li
                key={v.entidadId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2.5"
                style={{ border: `1px solid ${tinta(0.1)}`, background: tinta(0.03) }}
              >
                <div className="min-w-0">
                  <p className="font-medium" style={{ color: 'var(--label-primary)' }}>
                    {v.nombre}
                  </p>
                  {v.rif ? (
                    <p className="text-xs" style={{ color: tintaTexto(0.45) }}>
                      RIF {v.rif}
                    </p>
                  ) : null}
                </div>
                {puedeQuitar ? (
                  <button
                    type="button"
                    disabled={guardando}
                    onClick={() => void quitar(v)}
                    className="shrink-0 rounded-full px-3 py-1 text-[12px] font-semibold"
                    style={{
                      border: '1px solid rgba(255,59,48,0.3)',
                      background: 'rgba(255,59,48,0.1)',
                      color: 'var(--tono-rojo)',
                    }}
                  >
                    Quitar
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {esAdmin ? (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <select
            value={elegida}
            onChange={(e) => setElegida(e.target.value)}
            className="min-w-0 flex-1 rounded-xl border px-3 py-2.5 text-sm"
            style={{
              background: 'var(--superficie)',
              borderColor: tinta(0.12),
              color: 'var(--label-primary)',
            }}
          >
            <option value="">Agregar a otra empresa…</option>
            {disponibles.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={guardando || !elegida}
            onClick={() => void agregar()}
            className="rounded-xl px-4 py-2.5 text-[13px] font-semibold disabled:opacity-50"
            style={{
              border: '1px solid rgba(0,122,255,0.35)',
              background: 'rgba(0,122,255,0.16)',
              color: 'var(--tono-azul)',
            }}
          >
            {guardando ? 'Guardando…' : 'Agregar'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
