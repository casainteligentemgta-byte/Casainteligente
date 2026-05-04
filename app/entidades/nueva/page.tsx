'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function NuevaEntidadPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [nombre, setNombre] = useState('');
  const [rif, setRif] = useState('');
  const [notas, setNotas] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const n = nombre.trim();
    if (!n) {
      setError('El nombre es obligatorio.');
      return;
    }
    setSaving(true);
    setError(null);
    const { data, error: insErr } = await supabase
      .from('ci_entidades')
      .insert({
        nombre: n,
        rif: rif.trim() || null,
        notas: notas.trim() || null,
      } as never)
      .select('id')
      .single();
    setSaving(false);
    if (insErr) {
      setError(insErr.message);
      return;
    }
    const id = (data as { id?: string } | null)?.id;
    if (id) router.push(`/entidades/${id}`);
    else router.push('/entidades');
  }

  const inp = 'mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-sky-500';

  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      <Link href="/entidades" className="text-sm font-medium text-sky-600 hover:text-sky-500">
        ← Entidades
      </Link>
      <h1 className="mt-3 text-2xl font-bold text-slate-900">Nueva entidad</h1>
      <p className="mt-1 text-sm text-slate-600">Razón social y RIF que identifican al patrono en planillas y proyectos.</p>

      <form onSubmit={(e) => void onSubmit(e)} className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nombre o razón social *</span>
          <input className={inp} value={nombre} onChange={(e) => setNombre(e.target.value)} required />
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">RIF</span>
          <input className={inp} value={rif} onChange={(e) => setRif(e.target.value)} placeholder="Ej. J-12345678-9" />
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Notas</span>
          <textarea className={inp} rows={3} value={notas} onChange={(e) => setNotas(e.target.value)} />
        </label>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-xl bg-sky-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </form>
    </main>
  );
}
