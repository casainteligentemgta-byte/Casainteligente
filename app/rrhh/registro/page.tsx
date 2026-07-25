'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { apiUrl } from '@/lib/http/apiUrl';

const inputClass =
  'w-full rounded-xl border border-white/[0.06] bg-black/50 px-4 py-3 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-[#FF9500] focus:ring-1 focus:ring-[#FF9500]/30';

export default function RrhhRegistroFastTrackPage() {
  const [nombres, setNombres] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [cedula, setCedula] = useState('');
  const [oficio, setOficio] = useState('');
  const [celular, setCelular] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const nombreCompleto = `${nombres.trim()} ${apellidos.trim()}`.trim();

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    if (!nombreCompleto || !cedula.trim()) {
      setError('Nombre y cédula son obligatorios.');
      return;
    }
    setGuardando(true);
    try {
      const res = await fetch(apiUrl('/api/rrhh/registro-rapido'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombres: nombres.trim(),
          apellidos: apellidos.trim(),
          nombre_completo: nombreCompleto,
          cedula: cedula.trim(),
          oficio: oficio.trim(),
          celular: celular.trim(),
        }),
      });
      const data = (await res.json()) as { error?: string; hint?: string; id?: string };
      if (!res.ok) {
        setError([data.error, data.hint].filter(Boolean).join(' — ') || 'No se pudo guardar');
        return;
      }
      setOk(`Obrero registrado (${data.id?.slice(0, 8) ?? 'ok'}).`);
      setNombres('');
      setApellidos('');
      setCedula('');
      setOficio('');
      setCelular('');
    } catch (ex) {
      const msg =
        ex instanceof Error
          ? ex.message
          : ex && typeof ex === 'object' && 'message' in ex
            ? String((ex as { message: unknown }).message)
            : 'No se pudo guardar';
      setError(msg || 'No se pudo guardar');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white px-4 py-6 pb-24">
      <div className="max-w-lg mx-auto space-y-6">
        <Link
          href="/rrhh"
          className="inline-flex items-center gap-2 text-xs font-bold text-zinc-500 hover:text-[#FF9500]"
        >
          <ArrowLeft size={14} />
          Volver a RRHH
        </Link>

        <div>
          <h1 className="text-2xl font-black tracking-tight">Alta rápida de obrero</h1>
          <p className="text-sm text-zinc-500 mt-1">Fast-Track · registro en campo</p>
        </div>

        <form
          onSubmit={(e) => void guardar(e)}
          className="space-y-4 rounded-2xl border border-white/[0.06] bg-white/[0.04] p-6"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                Nombres
              </span>
              <input
                className={inputClass}
                value={nombres}
                onChange={(e) => setNombres(e.target.value)}
                required
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                Apellidos
              </span>
              <input
                className={inputClass}
                value={apellidos}
                onChange={(e) => setApellidos(e.target.value)}
                required
              />
            </label>
          </div>

          <label className="block space-y-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
              Cédula
            </span>
            <input
              className={inputClass}
              value={cedula}
              onChange={(e) => setCedula(e.target.value)}
              placeholder="V-12345678"
              required
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
              Oficio
            </span>
            <input
              className={inputClass}
              value={oficio}
              onChange={(e) => setOficio(e.target.value)}
              placeholder="Albañil, fierrero…"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
              Celular
            </span>
            <input
              className={inputClass}
              value={celular}
              onChange={(e) => setCelular(e.target.value)}
              placeholder="0414…"
            />
          </label>

          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          {ok ? <p className="text-sm text-emerald-400">{ok}</p> : null}

          <button
            type="submit"
            disabled={guardando}
            className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-[#FF9500] text-black font-black uppercase text-xs disabled:opacity-50"
          >
            {guardando ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Registrar obrero
          </button>
        </form>
      </div>
    </div>
  );
}
