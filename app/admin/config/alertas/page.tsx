'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Loader2,
  MessageCircle,
  Package,
  Receipt,
  Save,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import DespachoAlertasConfigPanel from '@/components/almacen/DespachoAlertasConfigPanel';
import { ESTADOS_PROCURA } from '@/lib/procuras/procuraEstados';
import { loadCatalogoProyectosApp, type ProyectoCatalogo } from '@/lib/proyectos/proyectosUnificados';
import type { AlertasConfig } from '@/lib/alertas/alertasConfig';
import { createClient } from '@/lib/supabase/client';
import { useSyncSubmitLock } from '@/hooks/useSyncSubmitLock';

type MetaResponse = {
  config: AlertasConfig;
  updatedAt: string | null;
  desdeBd: boolean;
  canalAdminEnv: string | null;
  canalAdminEfectivo: string | null;
  error?: string;
};

function listaATexto(items: string[]): string {
  return items.join(', ');
}

function textoALista(texto: string): string[] {
  return texto
    .split(/[,;\n]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export default function AdminConfigAlertasPage() {
  const supabase = useMemo(() => createClient(), []);
  const { isSubmitting, runLocked } = useSyncSubmitLock();
  const [loading, setLoading] = useState(true);
  const [cfg, setCfg] = useState<AlertasConfig | null>(null);
  const [meta, setMeta] = useState<Omit<MetaResponse, 'config' | 'error'> | null>(null);
  const [proyectos, setProyectos] = useState<ProyectoCatalogo[]>([]);
  const [proyectoDespachoId, setProyectoDespachoId] = useState('');

  const [canalAdminId, setCanalAdminId] = useState('');
  const [estadosAlertar, setEstadosAlertar] = useState<string[]>(['solicitada']);
  const [palabrasAlta, setPalabrasAlta] = useState('');
  const [palabrasMedia, setPalabrasMedia] = useState('');
  const [umbralAdv, setUmbralAdv] = useState(90);
  const [umbralCrit, setUmbralCrit] = useState(365);
  const [umbralFuturo, setUmbralFuturo] = useState(7);
  const [limiteFt, setLimiteFt] = useState(100);
  const [umbralOcr, setUmbralOcr] = useState(95);
  const [despAdv, setDespAdv] = useState(5);
  const [despCrit, setDespCrit] = useState(15);
  const [despSaldo, setDespSaldo] = useState(10);

  const aplicarConfig = useCallback((c: AlertasConfig) => {
    setCfg(c);
    setCanalAdminId(c.telegram.canalAdminId ?? '');
    setEstadosAlertar([...c.procuras.estadosAlertar]);
    setPalabrasAlta(listaATexto(c.procuras.palabrasPrioridadAlta));
    setPalabrasMedia(listaATexto(c.procuras.palabrasPrioridadMedia));
    setUmbralAdv(c.compras.umbralAdvertenciaDias);
    setUmbralCrit(c.compras.umbralCriticoDias);
    setUmbralFuturo(c.compras.umbralFuturoCriticoDias);
    setLimiteFt(c.fastTrack.limiteUsdDefault);
    setUmbralOcr(c.fastTrack.umbralConfianzaOcrPct);
    setDespAdv(c.despacho.excesoAdvertenciaPct);
    setDespCrit(c.despacho.excesoCriticoPct);
    setDespSaldo(c.despacho.saldoInformativoPct);
  }, []);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/alertas-config', { cache: 'no-store' });
      const data = (await res.json()) as MetaResponse;
      if (!res.ok) throw new Error(data.error || 'No se pudo cargar');
      aplicarConfig(data.config);
      setMeta({
        updatedAt: data.updatedAt,
        desdeBd: data.desdeBd,
        canalAdminEnv: data.canalAdminEnv,
        canalAdminEfectivo: data.canalAdminEfectivo,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, [aplicarConfig]);

  useEffect(() => {
    void cargar();
    void loadCatalogoProyectosApp(supabase).then(({ proyectos: list, error }) => {
      if (error) toast.error(error);
      setProyectos(list);
      if (list[0]?.id) setProyectoDespachoId(String(list[0].id));
    });
  }, [cargar, supabase]);

  const payloadDesdeForm = useMemo((): AlertasConfig | null => {
    if (!cfg) return null;
    return {
      telegram: {
        canalAdminId: canalAdminId.trim() || null,
      },
      procuras: {
        estadosAlertar,
        palabrasPrioridadAlta: textoALista(palabrasAlta),
        palabrasPrioridadMedia: textoALista(palabrasMedia),
      },
      compras: {
        umbralAdvertenciaDias: umbralAdv,
        umbralCriticoDias: umbralCrit,
        umbralFuturoCriticoDias: umbralFuturo,
      },
      fastTrack: {
        limiteUsdDefault: limiteFt,
        umbralConfianzaOcrPct: umbralOcr,
      },
      despacho: {
        excesoAdvertenciaPct: despAdv,
        excesoCriticoPct: despCrit,
        saldoInformativoPct: despSaldo,
      },
    };
  }, [
    cfg,
    canalAdminId,
    estadosAlertar,
    palabrasAlta,
    palabrasMedia,
    umbralAdv,
    umbralCrit,
    umbralFuturo,
    limiteFt,
    umbralOcr,
    despAdv,
    despCrit,
    despSaldo,
  ]);

  const guardar = () =>
    runLocked(async () => {
      if (!payloadDesdeForm) return;
      try {
        const res = await fetch('/api/admin/alertas-config', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payloadDesdeForm),
        });
        const data = (await res.json()) as MetaResponse;
        if (!res.ok) throw new Error(data.error || 'No se pudo guardar');
        aplicarConfig(data.config);
        setMeta({
          updatedAt: data.updatedAt,
          desdeBd: data.desdeBd,
          canalAdminEnv: data.canalAdminEnv,
          canalAdminEfectivo: data.canalAdminEfectivo,
        });
        toast.success('Configuración de alertas guardada');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Error al guardar');
      }
    });

  const toggleEstado = (estado: string) => {
    setEstadosAlertar((prev) =>
      prev.includes(estado) ? prev.filter((e) => e !== estado) : [...prev, estado],
    );
  };

  return (
    <div className="min-h-screen bg-[#0A0F1C] text-slate-300 p-4 md:p-8 font-sans">
      <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-3">
            <Bell className="h-8 w-8 text-amber-400" />
            <h1 className="text-3xl font-black tracking-tight text-white">Alertas centralizadas</h1>
          </div>
          <p className="font-medium text-slate-500">
            Telegram, procuras, compras, fast-track y defaults de despacho
          </p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
            <Link
              href="/admin/dashboard"
              className="inline-flex text-sm font-semibold text-sky-400 underline-offset-4 hover:text-sky-300 hover:underline"
            >
              ← Centro de comando
            </Link>
          </div>
        </div>
        <Button
          onClick={() => void guardar()}
          disabled={loading || isSubmitting || !payloadDesdeForm}
          className="gap-2 bg-amber-600 hover:bg-amber-500"
        >
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Guardar todo
        </Button>
      </header>

      {meta ? (
        <div className="mb-6 rounded-xl border border-slate-800/60 bg-slate-900/40 px-4 py-3 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            Canal admin efectivo:{' '}
            <span className="font-mono text-slate-300">{meta.canalAdminEfectivo ?? '—'}</span>
            {meta.canalAdminEnv && !cfg?.telegram.canalAdminId ? (
              <span className="text-slate-600"> (desde entorno)</span>
            ) : null}
          </span>
          {meta.updatedAt ? (
            <span className="ml-4">Actualizado: {new Date(meta.updatedAt).toLocaleString('es-VE')}</span>
          ) : null}
          {!meta.desdeBd ? (
            <span className="ml-4 text-amber-400">
              Usando defaults — aplique migración 228 en Supabase para persistir
            </span>
          ) : null}
        </div>
      ) : null}

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando configuración…
        </p>
      ) : (
        <Tabs defaultValue="telegram" className="space-y-6">
          <TabsList className="flex h-auto flex-wrap gap-1 bg-slate-900/60 p-1">
            <TabsTrigger value="telegram" className="gap-1.5">
              <MessageCircle className="h-3.5 w-3.5" />
              Telegram
            </TabsTrigger>
            <TabsTrigger value="procuras" className="gap-1.5">
              <Package className="h-3.5 w-3.5" />
              Procuras
            </TabsTrigger>
            <TabsTrigger value="compras" className="gap-1.5">
              <Receipt className="h-3.5 w-3.5" />
              Compras
            </TabsTrigger>
            <TabsTrigger value="fasttrack" className="gap-1.5">
              <Zap className="h-3.5 w-3.5" />
              Fast-track
            </TabsTrigger>
            <TabsTrigger value="despacho" className="gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />
              Despacho
            </TabsTrigger>
          </TabsList>

          <TabsContent value="telegram" className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-6">
            <h2 className="mb-4 text-lg font-bold text-white">Canal admin Telegram</h2>
            <p className="mb-4 text-sm text-slate-500">
              Override opcional de <code className="text-slate-400">TELEGRAM_ADMIN_CHANNEL_ID</code>. Vacío =
              usar variable de entorno.
            </p>
            <div className="max-w-md space-y-2">
              <Label htmlFor="canal-admin">ID del canal / grupo</Label>
              <Input
                id="canal-admin"
                value={canalAdminId}
                onChange={(e) => setCanalAdminId(e.target.value)}
                placeholder={meta?.canalAdminEnv ?? '-100…'}
                className="border-slate-700 bg-slate-950"
              />
            </div>
          </TabsContent>

          <TabsContent value="procuras" className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-6">
            <h2 className="mb-4 text-lg font-bold text-white">Alertas de procura</h2>
            <p className="mb-4 text-sm text-slate-500">
              Estados que disparan notificación al canal admin y palabras clave de prioridad en
              observaciones. Sin fast-track en procuras.
            </p>
            <div className="mb-6">
              <Label className="mb-2 block">Estados que alertan</Label>
              <div className="flex flex-wrap gap-2">
                {ESTADOS_PROCURA.map((est) => (
                  <button
                    key={est}
                    type="button"
                    onClick={() => toggleEstado(est)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold capitalize transition ${
                      estadosAlertar.includes(est)
                        ? 'border-sky-500/50 bg-sky-500/15 text-sky-300'
                        : 'border-slate-700 text-slate-500 hover:border-slate-600'
                    }`}
                  >
                    {est.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Palabras prioridad alta (separadas por coma)</Label>
                <Input
                  value={palabrasAlta}
                  onChange={(e) => setPalabrasAlta(e.target.value)}
                  className="border-slate-700 bg-slate-950"
                />
              </div>
              <div className="space-y-2">
                <Label>Palabras prioridad media</Label>
                <Input
                  value={palabrasMedia}
                  onChange={(e) => setPalabrasMedia(e.target.value)}
                  className="border-slate-700 bg-slate-950"
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="compras" className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-6">
            <h2 className="mb-4 text-lg font-bold text-white">Fechas anómalas en compras</h2>
            <p className="mb-4 text-sm text-slate-500">
              Días respecto a hoy para titileo ámbar (advertencia) y rojo (crítico).
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Advertencia (días en el pasado)</Label>
                <Input
                  type="number"
                  min={1}
                  value={umbralAdv}
                  onChange={(e) => setUmbralAdv(Number(e.target.value) || 0)}
                  className="border-slate-700 bg-slate-950"
                />
              </div>
              <div className="space-y-2">
                <Label>Crítico (días en el pasado)</Label>
                <Input
                  type="number"
                  min={1}
                  value={umbralCrit}
                  onChange={(e) => setUmbralCrit(Number(e.target.value) || 0)}
                  className="border-slate-700 bg-slate-950"
                />
              </div>
              <div className="space-y-2">
                <Label>Futuro crítico (días adelante)</Label>
                <Input
                  type="number"
                  min={1}
                  value={umbralFuturo}
                  onChange={(e) => setUmbralFuturo(Number(e.target.value) || 0)}
                  className="border-slate-700 bg-slate-950"
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="fasttrack" className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-6">
            <h2 className="mb-4 text-lg font-bold text-white">Fast-track facturas</h2>
            <p className="mb-4 text-sm text-slate-500">
              Límite USD por defecto cuando el proyecto no tiene override. El límite por obra sigue en{' '}
              <Link href="/proyectos/modulo" className="text-sky-400 hover:underline">
                Proyectos
              </Link>
              .
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Límite USD default</Label>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={limiteFt}
                  onChange={(e) => setLimiteFt(Number(e.target.value) || 0)}
                  className="border-slate-700 bg-slate-950"
                />
              </div>
              <div className="space-y-2">
                <Label>Umbral confianza OCR (%)</Label>
                <Input
                  type="number"
                  min={50}
                  max={100}
                  value={umbralOcr}
                  onChange={(e) => setUmbralOcr(Number(e.target.value) || 0)}
                  className="border-slate-700 bg-slate-950"
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="despacho" className="space-y-6">
            <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-6">
              <h2 className="mb-4 text-lg font-bold text-white">Defaults globales de despacho</h2>
              <p className="mb-4 text-sm text-slate-500">
                Aplican a obras sin configuración personalizada en almacén.
              </p>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Advertencia (% exceso)</Label>
                  <Input
                    type="number"
                    min={0.1}
                    step={0.5}
                    value={despAdv}
                    onChange={(e) => setDespAdv(Number(e.target.value) || 0)}
                    className="border-slate-700 bg-slate-950"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Crítico (% exceso)</Label>
                  <Input
                    type="number"
                    min={0.1}
                    step={0.5}
                    value={despCrit}
                    onChange={(e) => setDespCrit(Number(e.target.value) || 0)}
                    className="border-slate-700 bg-slate-950"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Saldo informativo (% línea)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={despSaldo}
                    onChange={(e) => setDespSaldo(Number(e.target.value) || 0)}
                    className="border-slate-700 bg-slate-950"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-6">
              <h2 className="mb-4 text-lg font-bold text-white">Override por obra</h2>
              <div className="mb-4 max-w-md space-y-2">
                <Label>Proyecto</Label>
                <select
                  value={proyectoDespachoId}
                  onChange={(e) => setProyectoDespachoId(e.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                >
                  {proyectos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre || p.id}
                    </option>
                  ))}
                </select>
              </div>
              {proyectoDespachoId ? (
                <DespachoAlertasConfigPanel proyectoId={proyectoDespachoId} />
              ) : (
                <p className="text-sm text-slate-500">Seleccione un proyecto.</p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
