'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { CiEntidad } from '@/types/ci-entidad';

export default function EditarEntidadPage() {
  const params = useParams();
  const id = String(params?.id ?? '').trim();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [nombre, setNombre] = useState('');
  const [rif, setRif] = useState('');
  const [notas, setNotas] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    const { data, error: qErr } = await supabase.from('ci_entidades').select('*').eq('id', id).maybeSingle();
    setLoading(false);
    if (qErr || !data) {
      setError(qErr?.message ?? 'Entidad no encontrada.');
      return;
    }
    const r = data as CiEntidad;
    setNombre(r.nombre);
    setRif(r.rif ?? '');
    setNotas(r.notas ?? '');
  }, [supabase, id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const n = nombre.trim();
    if (!n || !id) return;
    setSaving(true);
    setError(null);
    const { error: upErr } = await supabase
      .from('ci_entidades')
      .update({
        nombre: n,
        rif: rif.trim() || null,
        notas: notas.trim() || null,
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', id);
    setSaving(false);
    if (upErr) {
      setError(upErr.message);
      return;
    }
    router.push('/configuracion/entidades');
  }

  async function onDelete() {
    if (!id) return;
    const ok = window.confirm('¿Eliminar esta entidad? Los proyectos que la usen quedarán sin entidad asignada.');
    if (!ok) return;
    setSaving(true);
    const { error: delErr } = await supabase.from('ci_entidades').delete().eq('id', id);
    setSaving(false);
    if (delErr) {
      setError(delErr.message);
      return;
    }
    router.push('/configuracion/entidades');
  }

  const inp = 'mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-sky-500';

  if (!id) {
    return (
      <main className="mx-auto max-w-lg px-4 py-8">
        <p className="text-red-600">Identificador inválido.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      <Link href="/configuracion/entidades" className="text-sm font-medium text-sky-600 hover:text-sky-500">
        ← Entidades
      </Link>
      <h1 className="mt-3 text-2xl font-bold text-slate-900">Editar entidad</h1>

      {loading ? <p className="mt-6 text-slate-500">Cargando…</p> : null}
      {error && !loading ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

      {!loading && !error ? (
        <form onSubmit={(e) => void onSubmit(e)} className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nombre o razón social *</span>
            <input className={inp} value={nombre} onChange={(e) => setNombre(e.target.value)} required />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">RIF</span>
            <input className={inp} value={rif} onChange={(e) => setRif(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Notas</span>
            <textarea className={inp} rows={3} value={notas} onChange={(e) => setNotas(e.target.value)} />
          </label>
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-sky-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void onDelete()}
            className="w-full rounded-xl border border-red-200 bg-red-50 py-2.5 text-sm font-semibold text-red-800 hover:bg-red-100 disabled:opacity-50"
          >
            Eliminar entidad
          </button>
        </form>
      ) : null}
    </main>
  );
}
