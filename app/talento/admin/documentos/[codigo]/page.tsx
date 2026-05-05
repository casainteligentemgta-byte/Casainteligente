'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { apiUrl } from '@/lib/http/apiUrl';

type Plantilla = {
  id: string;
  codigo: string;
  titulo: string;
  descripcion: string | null;
  cuerpo: string;
  version: number;
  activo: boolean;
  updated_at: string;
};

export default function EditarPlantillaDocumentoPage() {
  const params = useParams();
  const router = useRouter();
  const codigo = String(params?.codigo ?? '').trim();

  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [cuerpo, setCuerpo] = useState('');
  const [activo, setActivo] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!codigo) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl(`/api/talento/documentos-plantillas/${encodeURIComponent(codigo)}`));
      const j = (await res.json().catch(() => ({}))) as { plantilla?: Plantilla; error?: string };
      if (!res.ok) {
        setError(j.error ?? `Error ${res.status}`);
        return;
      }
      const p = j.plantilla;
      if (!p) {
        setError('Plantilla no encontrada');
        return;
      }
      setTitulo(p.titulo);
      setDescripcion(p.descripcion ?? '');
      setCuerpo(p.cuerpo);
      setActivo(p.activo !== false);
    } catch {
      setError('Error de red');
    } finally {
      setLoading(false);
    }
  }, [codigo]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function guardar() {
    if (!codigo) return;
    setSaving(true);
    setError(null);
    setOkMsg(null);
    try {
      const res = await fetch(apiUrl(`/api/talento/documentos-plantillas/${encodeURIComponent(codigo)}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo,
          descripcion: descripcion.trim() || null,
          cuerpo,
          activo,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(j.error ?? 'No se pudo guardar');
        return;
      }
      setOkMsg('Guardado correctamente.');
      router.refresh();
    } catch {
      setError('Error de red al guardar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 pb-32">
      <Link href="/talento/admin/documentos" className="mb-6 inline-block text-xs text-zinc-500 hover:text-zinc-300">
        ← Biblioteca
      </Link>
      <h1 className="mb-2 text-2xl font-bold text-white">Editar plantilla</h1>
      <p className="mb-2 font-mono text-sm text-[#FF9500]">{codigo || '—'}</p>
      <p className="mb-6 text-sm text-zinc-400">
        Marcadores admitidos incluyen <code className="text-zinc-300">{'{{EMPLEADO_NOMBRE_COMPLETO}}'}</code>,{' '}
        <code className="text-zinc-300">{'{{OBRA_NOMBRE}}'}</code>, <code className="text-zinc-300">{'{{PATRON_NOMBRE}}'}</code>, etc.
        La lista de claves y etiquetas para datos faltantes está en{' '}
        <code className="text-zinc-500">lib/talento/plantillaContratoObreroCompile.ts</code>.
      </p>

      {loading ? <p className="text-sm text-zinc-500">Cargando…</p> : null}
      {error ? (
        <p className="mb-4 rounded-xl border border-red-500/30 bg-red-950/25 px-4 py-3 text-sm text-red-200">{error}</p>
      ) : null}
      {okMsg ? (
        <p className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-950/25 px-4 py-3 text-sm text-emerald-200">
          {okMsg}
        </p>
      ) : null}

      {!loading && !error ? (
        <div className="space-y-4">
          <label className="block text-sm">
            <span className="text-zinc-400">Título</span>
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-white"
            />
          </label>
          <label className="block text-sm">
            <span className="text-zinc-400">Descripción</span>
            <input
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-white"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
            Activa
          </label>
          <label className="block text-sm">
            <span className="text-zinc-400">Cuerpo (texto plano + marcadores)</span>
            <textarea
              value={cuerpo}
              onChange={(e) => setCuerpo(e.target.value)}
              rows={28}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-mono text-xs leading-relaxed text-zinc-100"
            />
          </label>
          <button
            type="button"
            disabled={saving}
            onClick={() => void guardar()}
            className="rounded-xl bg-[#FF9500] px-5 py-2.5 text-sm font-bold text-zinc-950 hover:brightness-105 disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Guardar plantilla'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
