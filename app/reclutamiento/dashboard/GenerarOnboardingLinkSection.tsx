'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { loadOpcionesProyectoReclutamiento, type OpcionProyectoReclutamiento } from '@/lib/proyectos/proyectosUnificados';
import { apiUrl } from '@/lib/http/apiUrl';
import { EnlaceInvitacionResultado } from '@/components/reclutamiento/EnlaceInvitacionResultado';

export default function GenerarOnboardingLinkSection() {
  const supabase = useMemo(() => createClient(), []);
  const [nombre, setNombre] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [rol, setRol] = useState<'tecnico' | 'programador'>('tecnico');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [onboardingUrl, setOnboardingUrl] = useState<string | null>(null);
  const [examUrl, setExamUrl] = useState<string | null>(null);

  const [proyectoOpciones, setProyectoOpciones] = useState<OpcionProyectoReclutamiento[]>([]);
  const [proyectoKey, setProyectoKey] = useState('');
  const [loadingProyectos, setLoadingProyectos] = useState(true);

  const opcionesIntegral = useMemo(
    () => proyectoOpciones.filter((o) => o.proyectoModuloId != null),
    [proyectoOpciones],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingProyectos(true);
      try {
        const { opciones } = await loadOpcionesProyectoReclutamiento(supabase, {});
        if (!cancelled) {
          setProyectoOpciones(opciones);
          setProyectoKey((k) => {
            if (k && opciones.some((o) => o.key === k)) return k;
            return '';
          });
        }
      } finally {
        if (!cancelled) setLoadingProyectos(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  async function generar(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) {
      setError('Nombre requerido.');
      return;
    }
    setLoading(true);
    setError(null);
    setOnboardingUrl(null);
    setExamUrl(null);
    const sel = proyectoKey ? opcionesIntegral.find((o) => o.key === proyectoKey) : undefined;
    try {
      const res = await fetch(apiUrl('/api/talento/generar-link'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nombre.trim(),
          whatsapp: whatsapp.trim() || undefined,
          rol_examen: rol,
          rol_buscado: 'Candidato onboarding',
          public_base_url:
            typeof window !== 'undefined' && window.location.protocol.startsWith('http')
              ? window.location.origin
              : undefined,
          ...(sel?.proyectoModuloId ? { proyecto_modulo_id: sel.proyectoModuloId } : {}),
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        hint?: string;
        onboarding_url?: string;
        url?: string;
      };
      if (!res.ok) {
        setError([data.error, data.hint].filter(Boolean).join(' — ') || 'Error generando enlace');
        return;
      }
      setOnboardingUrl(data.onboarding_url ?? null);
      setExamUrl(data.url ?? null);
    } catch {
      setError('No se pudo conectar.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-700 bg-zinc-900/40 p-4 mb-8 space-y-4">
      <h2 className="text-sm font-semibold text-white">2. Solicitud obrero — enlace, QR y WhatsApp</h2>
      <p className="text-xs text-zinc-400">
        Crea el registro del candidato: enlace y QR por WhatsApp. Orden del flujo: datos y cargas →{' '}
        <strong className="text-zinc-200">evaluación</strong> (prueba) → solo entonces, si RRHH aprueba,{' '}
        <strong className="text-zinc-200">contrato</strong>. El contrato no va antes de la evaluación.
      </p>

      <form onSubmit={(e) => void generar(e)} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-[10px] uppercase tracking-wide text-zinc-500 mb-1">Nombre *</label>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full rounded-xl bg-zinc-950 border border-zinc-600 px-3 py-2 text-sm text-white"
              placeholder="Nombre del candidato"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wide text-zinc-500 mb-1">WhatsApp</label>
            <input
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              className="w-full rounded-xl bg-zinc-950 border border-zinc-600 px-3 py-2 text-sm text-white"
              placeholder="Ej. +58412..."
            />
          </div>
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wide text-zinc-500 mb-1">
            Proyecto (opcional — planilla de empleo)
          </label>
          <p className="mb-1 text-[10px] text-zinc-500">
            Solo proyectos del módulo integral. Rellena entidad y RIF en{' '}
            <Link href="/configuracion/entidades" className="font-semibold text-sky-400 underline">
              Entidades
            </Link>{' '}
            y asígnalos al proyecto.
          </p>
          <select
            value={proyectoKey}
            onChange={(e) => setProyectoKey(e.target.value)}
            disabled={loadingProyectos}
            className="w-full rounded-xl bg-zinc-950 border border-zinc-600 px-3 py-2 text-sm text-white disabled:opacity-50"
            style={{ colorScheme: 'dark' }}
          >
            <option value="">— Sin proyecto —</option>
            {opcionesIntegral.map((o) => (
              <option key={o.key} value={o.key}>
                {o.etiqueta}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wide text-zinc-500 mb-1">Rol examen</label>
          <select
            value={rol}
            onChange={(e) => setRol((e.target.value as 'tecnico' | 'programador') || 'tecnico')}
            className="w-full rounded-xl bg-zinc-950 border border-zinc-600 px-3 py-2 text-sm text-white"
          >
            <option value="tecnico">Técnico</option>
            <option value="programador">Programador</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl px-4 py-2 text-sm font-medium bg-sky-700 text-white disabled:opacity-40"
        >
          {loading ? 'Generando…' : 'Generar enlace onboarding'}
        </button>
      </form>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      {onboardingUrl ? (
        <EnlaceInvitacionResultado
          onboardingUrl={onboardingUrl}
          examUrl={examUrl}
          nombreCandidato={nombre}
          whatsappDigitsOrRaw={whatsapp}
          titulo="Invitación lista (onboarding + prueba)"
        />
      ) : null}
    </section>
  );
}
