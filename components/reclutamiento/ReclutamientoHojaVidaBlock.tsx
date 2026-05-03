'use client';

import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { compressImageForUpload } from '@/lib/reclutamiento/compressImageForUpload';

type Props = {
  sessionId: string;
  needId: string;
};

async function uploadCedulaSession(
  file: File,
  sessionId: string,
  supabase: ReturnType<typeof createClient>,
): Promise<{ url: string | null; error: string | null }> {
  const ext = file.type === 'image/png' ? 'png' : 'jpg';
  const path = `reclutamiento/cv-session/${sessionId}/${crypto.randomUUID()}.${ext}`;
  const buckets = ['ci-proyectos-media', 'product-media', 'productos'];
  for (const bucket of buckets) {
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });
    if (!error) {
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      return { url: data.publicUrl, error: null };
    }
    const msg = (error.message || '').toLowerCase();
    if (!(msg.includes('bucket') && msg.includes('not found'))) {
      return { url: null, error: error.message };
    }
  }
  return { url: null, error: 'No se encontró bucket para subir la foto.' };
}

export default function ReclutamientoHojaVidaBlock({ sessionId, needId }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [open, setOpen] = useState(true);
  const [nombreCompleto, setNombreCompleto] = useState('');
  const [cedula, setCedula] = useState('');
  const [telefono, setTelefono] = useState('');
  const [tallaCamisa, setTallaCamisa] = useState('M');
  const [tallaBotas, setTallaBotas] = useState('40');
  const [cedulaFoto, setCedulaFoto] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const nom = nombreCompleto.trim();
    const doc = cedula.trim();
    if (nom.length < 2) {
      setError('Indica nombre y apellido.');
      return;
    }
    if (doc.length < 4) {
      setError('Indica cédula o documento.');
      return;
    }
    setLoading(true);
    try {
      let cedula_foto_url: string | null | undefined;
      if (cedulaFoto) {
        const blob = await compressImageForUpload(cedulaFoto);
        const fileToSend = new File([blob], 'cedula.jpg', {
          type: blob.type.startsWith('image/') ? blob.type : 'image/jpeg',
        });
        const up = await uploadCedulaSession(fileToSend, sessionId, supabase);
        if (up.error) {
          setError(up.error);
          setLoading(false);
          return;
        }
        cedula_foto_url = up.url;
      }

      const res = await fetch('/api/recruitment/session-cv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          needId,
          nombreCompleto: nom,
          cedula: doc,
          telefono: telefono.trim() || undefined,
          talla_camisa: tallaCamisa,
          talla_botas: tallaBotas,
          cedula_foto_url: cedula_foto_url ?? undefined,
        }),
      });
      const raw = await res.text();
      let data: { error?: string; hint?: string; ok?: boolean } = {};
      try {
        data = raw ? (JSON.parse(raw) as typeof data) : {};
      } catch {
        setError('Respuesta del servidor no válida.');
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setError([data.error, data.hint].filter(Boolean).join(' — ') || `Error HTTP ${res.status}`);
        setLoading(false);
        return;
      }
      setOk(true);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      className="rounded-2xl border border-emerald-500/25 bg-zinc-900/60 px-4 py-3 mb-3"
      style={{ boxShadow: '0 0 0 1px rgba(16,185,129,0.08)' }}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-emerald-200/95">Hoja de vida (datos básicos)</h2>
          <p className="text-[11px] text-zinc-400 mt-0.5 max-w-prose">
            Completa estos datos antes o durante la entrevista guiada. Quedan guardados con tu sesión para RRHH.
          </p>
        </div>
        {ok ? (
          <button
            type="button"
            onClick={() => {
              setOpen((v) => !v);
              setError(null);
            }}
            className="text-[11px] text-sky-300 hover:text-sky-200 underline shrink-0"
          >
            {open ? 'Ocultar' : 'Editar'}
          </button>
        ) : null}
      </div>

      {ok && !open ? (
        <p className="text-xs text-emerald-400/90 mt-2">Datos guardados. Puedes seguir con la entrevista abajo.</p>
      ) : (
        <form onSubmit={(e) => void guardar(e)} className="mt-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-[10px] uppercase tracking-wide text-zinc-500">Nombre completo *</span>
              <input
                required
                value={nombreCompleto}
                onChange={(e) => setNombreCompleto(e.target.value)}
                className="mt-1 w-full rounded-xl bg-zinc-950 border border-zinc-600 px-3 py-2 text-sm text-white placeholder:text-zinc-600"
                placeholder="Apellidos y nombres"
                autoComplete="name"
              />
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-wide text-zinc-500">Cédula / documento *</span>
              <input
                required
                value={cedula}
                onChange={(e) => setCedula(e.target.value)}
                className="mt-1 w-full rounded-xl bg-zinc-950 border border-zinc-600 px-3 py-2 text-sm text-white placeholder:text-zinc-600"
                placeholder="V-12345678"
                inputMode="text"
                autoComplete="off"
              />
            </label>
          </div>
          <label className="block">
            <span className="text-[10px] uppercase tracking-wide text-zinc-500">Teléfono (opcional)</span>
            <input
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              className="mt-1 w-full rounded-xl bg-zinc-950 border border-zinc-600 px-3 py-2 text-sm text-white placeholder:text-zinc-600"
              placeholder="WhatsApp o móvil"
              inputMode="tel"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-[10px] uppercase tracking-wide text-zinc-500">Talla camisa</span>
              <select
                value={tallaCamisa}
                onChange={(e) => setTallaCamisa(e.target.value)}
                className="mt-1 w-full rounded-xl bg-zinc-950 border border-zinc-600 px-3 py-2 text-sm text-white"
              >
                {['S', 'M', 'L', 'XL', 'XXL'].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-wide text-zinc-500">Nº botas</span>
              <input
                type="number"
                min={35}
                max={50}
                value={tallaBotas}
                onChange={(e) => setTallaBotas(e.target.value)}
                className="mt-1 w-full rounded-xl bg-zinc-950 border border-zinc-600 px-3 py-2 text-sm text-white"
              />
            </label>
          </div>
          <label className="block">
            <span className="text-[10px] uppercase tracking-wide text-zinc-500">Foto cédula (opcional)</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="mt-1 w-full text-xs text-zinc-300 file:mr-2 file:rounded-lg file:border-0 file:bg-zinc-700 file:px-2 file:py-1"
              onChange={(e) => setCedulaFoto(e.target.files?.[0] ?? null)}
            />
          </label>
          {error ? <p className="text-xs text-red-400">{error}</p> : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-4 py-2.5 text-sm font-medium text-white"
          >
            {loading ? 'Guardando…' : 'Guardar hoja de vida'}
          </button>
        </form>
      )}
    </section>
  );
}
