'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  moduloProyectosPageShell,
  moduloProyectosStickyHeader,
} from '@/lib/ui/moduloProyectosTheme';

type ObraRow = {
  id: string;
  nombre: string;
  ubicacion: string | null;
  cliente: string | null;
  estado: string;
  precio_venta_usd: number | null;
  fecha_inicio: string | null;
  fecha_entrega_prometida: string;
  notas: string | null;
  entidad_id?: string | null;
};

type EntidadOpt = { id: string; nombre: string; rif: string | null };

export default function EditarObraTalentoPage({ params }: { params: { proyectoId: string } }) {
  const id = String(params?.proyectoId ?? '').trim();
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [obra, setObra] = useState<ObraRow | null>(null);

  const [nombre, setNombre] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [cliente, setCliente] = useState('');
  const [estado, setEstado] = useState('activa');
  const [precioUsd, setPrecioUsd] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaEntrega, setFechaEntrega] = useState('');
  const [notas, setNotas] = useState('');
  const [entidades, setEntidades] = useState<EntidadOpt[]>([]);
  const [entidadId, setEntidadId] = useState('');

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from('ci_entidades').select('id,nombre,rif').order('nombre');
      setEntidades((data ?? []) as EntidadOpt[]);
    })();
  }, [supabase]);

  const load = useCallback(async () => {
    if (!id) {
      setLoading(false);
      setError('ID inválido.');
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase.from('ci_obras').select('*').eq('id', id).maybeSingle();
    setLoading(false);
    if (err) {
      setObra(null);
      setError(err.message);
      return;
    }
    if (!data) {
      setObra(null);
      setError('Obra no encontrada.');
      return;
    }
    const r = data as ObraRow;
    setObra(r);
    setNombre(r.nombre ?? '');
    setUbicacion((r.ubicacion ?? '').trim());
    setCliente((r.cliente ?? '').trim());
    setEstado(r.estado === 'cerrada' ? 'cerrada' : 'activa');
    setPrecioUsd(r.precio_venta_usd != null ? String(r.precio_venta_usd) : '');
    setFechaInicio(r.fecha_inicio ? String(r.fecha_inicio).slice(0, 10) : '');
    setFechaEntrega(
      r.fecha_entrega_prometida ? String(r.fecha_entrega_prometida).slice(0, 10) : '',
    );
    setNotas((r.notas ?? '').trim());
    setEntidadId(r.entidad_id ? String(r.entidad_id) : '');
  }, [supabase, id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const n = nombre.trim();
    if (!n || !fechaEntrega) {
      setError('Nombre y fecha de entrega son obligatorios.');
      return;
    }
    if (!entidadId.trim()) {
      setError('Selecciona el patrono / empresa ejecutora.');
      return;
    }
    setSaving(true);
    setError(null);
    setOk(false);
    const precio = precioUsd.trim() === '' ? null : Number(precioUsd.replace(',', '.'));
    if (precio != null && (!Number.isFinite(precio) || precio < 0)) {
      setSaving(false);
      setError('Precio de venta (USD) no válido.');
      return;
    }
    const { error: err } = await supabase
      .from('ci_obras')
      .update({
        nombre: n,
        ubicacion: ubicacion.trim() || null,
        cliente: cliente.trim() || null,
        estado,
        precio_venta_usd: precio,
        fecha_inicio: fechaInicio.trim() || null,
        fecha_entrega_prometida: fechaEntrega,
        notas: notas.trim() || null,
        entidad_id: entidadId.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    setOk(true);
  }

  const fieldClass =
    'mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-sky-500/40';
  const labelClass = 'block text-[10px] font-semibold uppercase tracking-wide text-zinc-500';

  return (
    <div style={moduloProyectosPageShell}>
      <div style={moduloProyectosStickyHeader}>
        <div>
          <Link
            href="/proyectos/modulo"
            style={{ color: 'rgba(90,200,250,0.95)', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}
          >
            ← Proyectos
          </Link>
          <h1 style={{ color: 'white', fontSize: '22px', fontWeight: 800, margin: '8px 0 0' }}>Modificar obra</h1>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '12px', margin: '4px 0 0' }}>
            Talento · <code className="text-zinc-400">ci_obras</code>
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 pb-10 pt-2">
        {loading ? <p className="text-sm text-zinc-500">Cargando obra…</p> : null}
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        {ok ? (
          <p className="mb-4 text-sm text-emerald-400">
            Cambios guardados.{' '}
            <Link href={`/proyectos/${id}/finanzas`} className="font-semibold text-sky-400 underline">
              Ver finanzas
            </Link>{' '}
            o{' '}
            <Link href="/proyectos/modulo" className="font-semibold text-sky-400 underline">
              Volver al listado
            </Link>
            .
          </p>
        ) : null}

        {!loading && obra ? (
          <form
            onSubmit={(e) => void onSubmit(e)}
            className="space-y-4 rounded-2xl border border-white/10 bg-zinc-900/70 p-6 shadow-lg backdrop-blur-xl"
          >
            <div>
              <label className={labelClass}>Nombre *</label>
              <input required value={nombre} onChange={(e) => setNombre(e.target.value)} className={fieldClass} />
            </div>
            <div>
              <label className={labelClass}>Ubicación</label>
              <input value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} className={fieldClass} />
            </div>
            <div>
              <label className={labelClass}>Patrono / empresa ejecutora *</label>
              <p className="mt-0.5 text-[11px] text-zinc-500">
                <Link href="/configuracion/entidades" className="font-semibold text-sky-400 underline hover:text-sky-300">
                  Gestionar entidades
                </Link>
              </p>
              <select
                required
                value={entidadId}
                onChange={(e) => setEntidadId(e.target.value)}
                className={fieldClass}
                style={{ colorScheme: 'dark' }}
              >
                <option value="">— Selecciona patrono —</option>
                {entidades.map((en) => (
                  <option key={en.id} value={en.id} className="bg-zinc-900">
                    {en.nombre}
                    {en.rif ? ` · ${en.rif}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Cliente (texto)</label>
              <input value={cliente} onChange={(e) => setCliente(e.target.value)} className={fieldClass} />
            </div>
            <div>
              <label className={labelClass}>Estado</label>
              <select
                value={estado}
                onChange={(e) => setEstado(e.target.value)}
                className={fieldClass}
                style={{ colorScheme: 'dark' }}
              >
                <option value="activa" className="bg-zinc-900">
                  activa
                </option>
                <option value="cerrada" className="bg-zinc-900">
                  cerrada
                </option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Precio venta (USD)</label>
              <input
                type="text"
                inputMode="decimal"
                value={precioUsd}
                onChange={(e) => setPrecioUsd(e.target.value)}
                className={fieldClass}
                placeholder="Opcional"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Fecha inicio</label>
                <input
                  type="date"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                  className={fieldClass}
                  style={{ colorScheme: 'dark' }}
                />
              </div>
              <div>
                <label className={labelClass}>Fecha entrega *</label>
                <input
                  required
                  type="date"
                  value={fechaEntrega}
                  onChange={(e) => setFechaEntrega(e.target.value)}
                  className={fieldClass}
                  style={{ colorScheme: 'dark' }}
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>Notas</label>
              <textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                rows={3}
                className={fieldClass}
                placeholder="Opcional"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-[#007AFF] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0062CC] disabled:opacity-50"
            >
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
