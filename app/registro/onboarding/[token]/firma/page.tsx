'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { apiUrl } from '@/lib/http/apiUrl';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

type PageProps = { params: { token: string } };

type Resumen = {
  nombre: string;
  cargo: string;
  salarioDiario: string;
  obra: string;
};

function fmtSalarioVes(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n)) || Number(n) <= 0) return '—';
  return `${Number(n).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} Bs.`;
}

function SwitchLopcymat({
  id,
  label,
  description,
  checked,
  onCheckedChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 backdrop-blur-md">
      <div className="min-w-0">
        <p id={id} className="text-sm font-semibold text-zinc-100">
          {label}
        </p>
        <p className="mt-0.5 text-[11px] leading-snug text-zinc-500">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={id}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          'relative h-8 w-14 shrink-0 rounded-full border transition-colors',
          checked ? 'border-[#34C759]/50 bg-[#34C759]/25' : 'border-white/15 bg-black/40',
        )}
      >
        <span
          className={cn(
            'absolute left-1 top-1 h-6 w-6 rounded-full bg-white shadow transition-transform duration-200 ease-out',
            checked && 'translate-x-6 bg-[#34C759]',
          )}
        />
      </button>
    </div>
  );
}

export default function FirmaDigitalOnboardingPage({ params }: PageProps) {
  const token = (params.token ?? '').trim();
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resumen, setResumen] = useState<Resumen | null>(null);

  const [swJornada, setSwJornada] = useState(false);
  const [swEpp, setSwEpp] = useState(false);
  const [swIa, setSwIa] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const listo = swJornada && swEpp && swIa;

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!token) {
        setError('Enlace inválido.');
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      const { data: emp, error: e1 } = await supabase
        .from('ci_empleados')
        .select('id,nombre_completo')
        .eq('token_registro', token)
        .maybeSingle();
      if (!alive) return;
      if (e1 || !emp) {
        setError('No encontramos tu expediente. Verifica el enlace.');
        setLoading(false);
        return;
      }
      const e = emp as { id: string; nombre_completo: string | null };
      const { data: ctr, error: e2 } = await supabase
        .from('ci_contratos_empleado_obra')
        .select('cargo_oficio_desempeño,salario_basico_diario_ves,lugar_prestacion_servicio,obra_id,proyecto_id')
        .eq('empleado_id', e.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!alive) return;
      if (e2 || !ctr) {
        setError('Aún no hay contrato generado. Cuando RRHH lo emita, podrás firmar desde este enlace.');
        setLoading(false);
        return;
      }
      const c = ctr as {
        cargo_oficio_desempeño?: string | null;
        salario_basico_diario_ves?: number | null;
        lugar_prestacion_servicio?: string | null;
        obra_id?: string | null;
        proyecto_id?: string | null;
      };
      let obraTxt = (c.lugar_prestacion_servicio ?? '').trim();
      const pid = (c.obra_id ?? c.proyecto_id ?? '').trim();
      if (!obraTxt && pid) {
        const { data: pr } = await supabase.from('ci_proyectos').select('nombre').eq('id', pid).maybeSingle();
        if (pr) obraTxt = String((pr as { nombre?: string }).nombre ?? '').trim();
      }
      if (!alive) return;
      setResumen({
        nombre: (e.nombre_completo ?? '').trim() || 'Trabajador',
        cargo: (c.cargo_oficio_desempeño ?? '').trim() || '—',
        salarioDiario: fmtSalarioVes(c.salario_basico_diario_ves),
        obra: obraTxt || '—',
      });
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [token, supabase]);

  const firmar = useCallback(async () => {
    if (!listo || !token) return;
    setSubmitting(true);
    try {
      const res = await fetch(apiUrl('/api/talento/contratos/firmar'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string; success?: boolean };
      if (!res.ok) {
        toast.error(j.error ?? `Error ${res.status}`);
        setSubmitting(false);
        return;
      }
      toast.success('¡Bienvenido a Casa Inteligente! Preséntate mañana en obra.', {
        duration: 6500,
      });
    } catch {
      toast.error('Error de red. Intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  }, [listo, token]);

  return (
    <div className="min-h-[100dvh] bg-[#0A0A0F] text-zinc-100">
      <div
        className="pointer-events-none fixed inset-0 opacity-90"
        style={{
          background:
            'radial-gradient(ellipse 120% 80% at 50% -20%, rgba(52,199,89,0.12), transparent 55%), radial-gradient(ellipse 80% 50% at 100% 100%, rgba(255,255,255,0.04), transparent 45%)',
        }}
        aria-hidden
      />
      <div className="relative mx-auto max-w-md px-4 pb-10 pt-[max(1.25rem,env(safe-area-inset-top))] backdrop-blur-[1px]">
        <header className="mb-6 border-b border-white/10 pb-4 backdrop-blur-sm">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">Casa Inteligente</p>
          <h1 className="mt-1 text-xl font-bold tracking-tight text-white">Firma digital del contrato</h1>
          <p className="mt-2 text-xs leading-relaxed text-zinc-500">
            Wizard móvil · LOPCYMAT · confirma lectura y aceptación antes de firmar.
          </p>
        </header>

        {loading ? (
          <p className="text-sm text-zinc-500 backdrop-blur-sm">Cargando contrato…</p>
        ) : error ? (
          <div className="rounded-2xl border border-red-500/25 bg-red-950/25 px-4 py-3 text-sm text-red-200 backdrop-blur-md">
            {error}
          </div>
        ) : resumen ? (
          <>
            <section className="mb-6 space-y-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-md">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Resumen del contrato</h2>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-3 border-b border-white/5 pb-2">
                  <dt className="text-zinc-500">Nombre</dt>
                  <dd className="max-w-[60%] text-right font-medium text-zinc-100">{resumen.nombre}</dd>
                </div>
                <div className="flex justify-between gap-3 border-b border-white/5 pb-2">
                  <dt className="text-zinc-500">Cargo</dt>
                  <dd className="max-w-[60%] text-right font-medium text-emerald-100/95">{resumen.cargo}</dd>
                </div>
                <div className="flex justify-between gap-3 border-b border-white/5 pb-2">
                  <dt className="text-zinc-500">Salario básico diario</dt>
                  <dd className="max-w-[60%] text-right font-semibold text-zinc-100">{resumen.salarioDiario}</dd>
                </div>
                <div className="flex justify-between gap-3 pt-0.5">
                  <dt className="text-zinc-500">Obra / prestación</dt>
                  <dd className="max-w-[60%] text-right text-xs leading-snug text-zinc-300">{resumen.obra}</dd>
                </div>
              </dl>
            </section>

            <section className="mb-8 space-y-3">
              <h2 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                LOPCYMAT — confirmación obligatoria
              </h2>
              <SwitchLopcymat
                id="sw-jornada"
                label="Jornada y descanso"
                description="Confirmo conocer la jornada pactada, horas de descanso y derechos laborales aplicables."
                checked={swJornada}
                onCheckedChange={setSwJornada}
              />
              <SwitchLopcymat
                id="sw-epp"
                label="Uso de EPP"
                description="Me comprometo al uso correcto del equipo de protección personal en obra."
                checked={swEpp}
                onCheckedChange={setSwEpp}
              />
              <SwitchLopcymat
                id="sw-ia"
                label="Política de IA y datos"
                description="Acepto las políticas de uso de datos y herramientas digitales de la empresa en el marco LOPCYMAT."
                checked={swIa}
                onCheckedChange={setSwIa}
              />
            </section>

            <div className="sticky bottom-0 -mx-4 border-t border-white/10 bg-[#0A0A0F]/80 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur-xl">
              <button
                type="button"
                disabled={!listo || submitting}
                onClick={() => void firmar()}
                className={cn(
                  'w-full rounded-2xl py-4 text-base font-bold tracking-tight transition',
                  'bg-[#34C759] text-black shadow-[0_8px_32px_rgba(52,199,89,0.35)] hover:bg-[#2eb050]',
                  'disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400 disabled:shadow-none',
                )}
              >
                {submitting ? 'Firmando…' : 'Firmar y aceptar contrato'}
              </button>
              {!listo ? (
                <p className="mt-2 text-center text-[11px] text-zinc-500">Activa los tres ítems LOPCYMAT para habilitar la firma.</p>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
