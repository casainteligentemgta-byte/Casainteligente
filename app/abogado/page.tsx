'use client';

import Link from 'next/link';
import { Check, Scale, ArrowRight, Shield, FileText, MessageSquareText, Calculator } from 'lucide-react';
import { PLANES_LEGAL_COMERCIALES } from '@/lib/legal/planesLegalComercial';

const PILARES = [
  {
    icon: Shield,
    titulo: 'Casos y resolución',
    texto: 'Cola de trabajo, actuaciones y cierre de asuntos.',
  },
  {
    icon: FileText,
    titulo: 'Contratos y formatos',
    texto: 'Plantillas, previsualización, PDF y envío.',
  },
  {
    icon: MessageSquareText,
    titulo: 'Asesor legal',
    texto: 'Consulta con base de conocimiento (RAG).',
  },
  {
    icon: Calculator,
    titulo: 'Prestaciones',
    texto: 'Cálculo auditable Art. 142 LOTTT y CCT.',
  },
];

export default function AbogadoLandingPage() {
  return (
    <div>
      <header className="border-b border-amber-500/20 bg-[#0c1018]/90">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/35 bg-amber-500/10">
              <Scale className="h-5 w-5 text-amber-300" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-500/80">
                Casa Inteligente
              </p>
              <p className="text-sm font-bold text-white">Módulo Abogado</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/login?next=/legal"
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-zinc-400 hover:text-zinc-200"
            >
              Entrar
            </Link>
            <Link
              href="/abogado/registro?plan=trial"
              className="rounded-xl bg-amber-500 px-3.5 py-2 text-xs font-bold text-zinc-950 hover:bg-amber-400"
            >
              Probar gratis
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-white/5">
          <div
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{
              background:
                'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(245,158,11,0.22), transparent 55%)',
            }}
          />
          <div className="relative mx-auto max-w-5xl px-4 pb-16 pt-14 sm:pt-20">
            <p className="text-sm font-semibold text-amber-200/80">Producto Legal · solo abogado</p>
            <h1 className="mt-3 max-w-2xl text-4xl font-bold tracking-tight text-white sm:text-5xl">
              Módulo Abogado
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-zinc-400">
              Casos, contratos, asesor y cálculos laborales para tu despacho. Sin almacén, sin
              obras, sin el CRM completo de Casa Inteligente.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/abogado/registro?plan=trial"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-700 px-5 py-3 text-sm font-bold text-black"
              >
                Empezar prueba 14 días
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#planes"
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-5 py-3 text-sm font-semibold text-zinc-200 hover:bg-white/5"
              >
                Ver planes
              </a>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-14">
          <h2 className="text-lg font-bold text-white">Qué incluye</h2>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {PILARES.map((p) => {
              const Icon = p.icon;
              return (
                <li
                  key={p.titulo}
                  className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-4"
                >
                  <Icon className="h-5 w-5 text-amber-300" />
                  <p className="mt-2 font-semibold text-zinc-100">{p.titulo}</p>
                  <p className="mt-1 text-sm text-zinc-500">{p.texto}</p>
                </li>
              );
            })}
          </ul>
        </section>

        <section id="planes" className="border-t border-white/5 bg-[#0c1018]/60">
          <div className="mx-auto max-w-5xl px-4 py-14">
            <h2 className="text-lg font-bold text-white">Planes</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Solicita acceso; activamos tu despacho y te enviamos invitación por correo.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {PLANES_LEGAL_COMERCIALES.map((plan) => (
                <div
                  key={plan.id}
                  className={`flex flex-col rounded-2xl border p-5 ${
                    plan.destacado
                      ? 'border-amber-500/40 bg-amber-500/10'
                      : 'border-white/10 bg-white/[0.02]'
                  }`}
                >
                  {plan.destacado ? (
                    <span className="mb-2 self-start rounded-md bg-amber-500 px-2 py-0.5 text-[10px] font-bold uppercase text-zinc-950">
                      Recomendado
                    </span>
                  ) : null}
                  <p className="text-sm font-semibold text-zinc-200">{plan.nombre}</p>
                  <p className="mt-2 text-3xl font-bold text-white">
                    {plan.precioLabel}
                    <span className="text-sm font-medium text-zinc-500">{plan.periodo}</span>
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">{plan.asientos}</p>
                  <ul className="mt-4 flex-1 space-y-2">
                    {plan.bullets.map((b) => (
                      <li key={b} className="flex gap-2 text-xs text-zinc-400">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                        {b}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={`/abogado/registro?plan=${plan.id}`}
                    className={`mt-5 inline-flex justify-center rounded-xl px-3 py-2.5 text-sm font-bold ${
                      plan.destacado
                        ? 'bg-amber-500 text-zinc-950 hover:bg-amber-400'
                        : 'border border-white/15 text-zinc-100 hover:bg-white/5'
                    }`}
                  >
                    {plan.cta}
                  </Link>
                </div>
              ))}
            </div>
            <p className="mt-6 text-center text-[11px] text-zinc-600">
              Precios en USD referenciales. Facturación y activación gestionadas por Casa
              Inteligente. Sin tarjeta para la prueba.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/5 px-4 py-8 text-center text-xs text-zinc-600">
        <p>
          Producto de{' '}
          <Link href="/" className="text-zinc-400 hover:text-zinc-200">
            Casa Inteligente
          </Link>
          {' · '}
          <Link href="/login?next=/legal" className="text-zinc-400 hover:text-zinc-200">
            Ya tengo cuenta
          </Link>
        </p>
      </footer>
    </div>
  );
}
