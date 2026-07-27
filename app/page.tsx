'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import AeropuertoRelojPizarra from '@/components/home/AeropuertoRelojPizarra';
import { createClient } from '@/lib/supabase/client';
import { GlassCard } from '@/components/nexus/GlassCard';
import { cn } from '@/lib/utils';
import type { User } from '@supabase/supabase-js';

type StatTileProps = {
  href?: string;
  actionHref?: string;
  actionColor?: string;
  icon: string;
  value: React.ReactNode;
  label: string;
  valueClass?: string;
  badge?: string;
  cardClass?: string;
};

function StatTile({
  href,
  actionHref,
  actionColor = 'var(--ios-blue)',
  icon,
  value,
  label,
  valueClass = 'text-white',
  badge,
  cardClass,
}: StatTileProps) {
  const card = (
    <GlassCard
      className={cn(
        'h-full !p-3 sm:!p-3.5 landscape:!p-2.5 active:scale-[0.98] transition-transform',
        cardClass,
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-1 landscape:mb-0.5">
        <span className="text-lg landscape:text-base leading-none">{icon}</span>
        {badge ? (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-white/10 text-[var(--nexus-text-muted)] uppercase shrink-0">
            {badge}
          </span>
        ) : (
          <span className="w-5 h-5 shrink-0" />
        )}
      </div>
      <p
        suppressHydrationWarning
        className={cn(
          'text-2xl sm:text-3xl landscape:text-xl font-bold tracking-tighter leading-none',
          valueClass,
        )}
      >
        {value}
      </p>
      <p className="text-[10px] landscape:text-[9px] font-bold uppercase tracking-widest text-[var(--nexus-text-muted)] mt-0.5 opacity-80">
        {label}
      </p>
    </GlassCard>
  );

  return (
    <div className="relative h-full min-h-0">
      {href ? <Link href={href}>{card}</Link> : card}
      {actionHref ? (
        <Link
          href={actionHref}
          className="absolute top-2 right-2 z-10 w-7 h-7 landscape:w-6 landscape:h-6 rounded-lg flex items-center justify-center shadow-lg hover:scale-110 active:scale-90 transition-all"
          style={{ background: actionColor }}
        >
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
            <path d="M7 2v10M2 7h10" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </Link>
      ) : null}
    </div>
  );
}

function formatDayLabel(now: Date): string {
  const dayName = now.toLocaleDateString('es-VE', { weekday: 'long' });
  const dateStr = now.toLocaleDateString('es-VE', { day: 'numeric', month: 'short' });
  return `${dayName.charAt(0).toUpperCase() + dayName.slice(1)}, ${dateStr}`;
}

export default function DashboardPage() {
  const [productCount, setProductCount] = useState<number | null>(null);
  const [clientCount, setClientCount] = useState<number | null>(null);
  /** Solo en cliente: evita mismatch SSR vs navegador (fecha, conteos). */
  const [dayLabel, setDayLabel] = useState('');
  const [clientReady, setClientReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    setClientReady(true);
    setDayLabel(formatDayLabel(new Date()));
    const supabase = createClient();
    supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .then(({ count }) => setProductCount(count ?? 0));
    supabase
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .then(({ count }) => setClientCount(count ?? 0));
    void supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      setUser(null);
    } finally {
      setSigningOut(false);
    }
  }

  const dash = '\u2014';
  const clientesValue = clientReady ? (clientCount ?? dash) : dash;
  const productosValue = clientReady ? (productCount ?? dash) : dash;

  return (
    <article className="home-inicio flex flex-col overflow-hidden px-4 pt-4 pb-2 sm:pt-5 landscape:pt-3 landscape:px-5 landscape:pb-2">
      <header className="shrink-0 mb-3 landscape:mb-2">
        <div className="min-w-0">
          <p
            suppressHydrationWarning
            className="text-[10px] landscape:text-[9px] font-bold uppercase tracking-widest text-[var(--nexus-text-dim)] truncate min-h-[1em]"
          >
            {dayLabel || '\u00A0'}
          </p>
          <h1 className="text-2xl sm:text-3xl landscape:text-xl font-bold tracking-tight text-white truncate">
            CASA INTELIGENTE
          </h1>
        </div>
        <div className="mt-2.5 flex items-center gap-2 landscape:mt-2 flex-wrap">
          <Link
            href="/nexus/vision"
            className="rounded-full px-3 py-1.5 landscape:px-2.5 landscape:py-1 text-[10px] font-bold uppercase tracking-tighter text-[var(--nexus-cyan)] ring-1 ring-[rgba(0,242,254,0.45)] bg-[rgba(0,242,254,0.08)] hover:bg-[rgba(0,242,254,0.16)] transition-all"
          >
            CCTV
          </Link>
          <Link
            href="/nexus"
            className="rounded-full px-3 py-1.5 landscape:px-2.5 landscape:py-1 text-[10px] font-bold uppercase tracking-tighter text-[var(--nexus-text-muted)] ring-1 ring-white/15 hover:bg-white/5 transition-all"
          >
            Nexus
          </Link>
          {clientReady && !user ? (
            <Link
              href="/login"
              className="rounded-full px-3.5 py-1.5 landscape:px-3 landscape:py-1 text-[10px] font-bold uppercase tracking-tighter text-white bg-[#007AFF] hover:bg-[#0062CC] shadow-[0_4px_12px_rgba(0,122,255,0.35)] transition-all"
            >
              Iniciar sesión
            </Link>
          ) : null}
          {clientReady && user ? (
            <button
              type="button"
              onClick={() => void handleSignOut()}
              disabled={signingOut}
              className="rounded-full px-3 py-1.5 landscape:px-2.5 landscape:py-1 text-[10px] font-bold uppercase tracking-tighter text-[var(--nexus-text-muted)] ring-1 ring-white/15 hover:bg-white/5 transition-all disabled:opacity-50"
              title={user.email ?? 'Sesión activa'}
            >
              {signingOut ? 'Saliendo…' : 'Salir'}
            </button>
          ) : null}
          <div className="w-9 h-9 landscape:w-8 landscape:h-8 rounded-full bg-gradient-to-br from-[var(--ios-blue)] to-[var(--ios-indigo)] flex items-center justify-center text-white text-xs font-bold shadow-[0_4px_12px_rgba(0,122,255,0.3)] border border-white/20">
            CI
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 flex-col gap-3 landscape:flex-row landscape:gap-4 landscape:items-stretch">
        <section className="landscape:flex-[1.05] landscape:min-w-0 flex flex-col justify-center min-h-0">
          <AeropuertoRelojPizarra dense className="flex-1 min-h-0 max-h-full" />
        </section>

        <section className="landscape:flex-1 grid grid-cols-2 gap-2 sm:gap-3 landscape:gap-2 min-h-0 content-center auto-rows-fr">
          <StatTile
            href="/clientes"
            actionHref="/clientes/nuevo"
            actionColor="var(--ios-blue)"
            icon="👥"
            value={clientesValue}
            label="Clientes"
            valueClass="text-[var(--ios-blue)]"
            cardClass="!bg-blue-500/5 border-blue-500/20"
          />
          <StatTile
            href="/nexus/vision"
            icon="📹"
            value="NV"
            label="CCTV NetVision"
            badge="Pro"
            valueClass="text-[var(--nexus-cyan)]"
            cardClass="!bg-cyan-500/5 border-cyan-500/25"
          />
          <StatTile
            href="/proyectos/modulo"
            icon="🏗️"
            value="18"
            label="Proyectos"
            badge="+3"
            cardClass="!bg-orange-500/5 border-orange-500/20"
          />
          <StatTile
            href="/productos"
            actionHref="/productos/nuevo"
            actionColor="var(--ios-orange)"
            icon="📦"
            value={productosValue}
            label="Productos"
            valueClass="text-[var(--ios-orange)]"
            cardClass="!bg-orange-500/5 border-orange-500/20"
          />
        </section>
      </div>
    </article>
  );
}
