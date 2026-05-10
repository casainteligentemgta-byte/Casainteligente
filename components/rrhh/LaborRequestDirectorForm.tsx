'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CARGOS_OBREROS, cargoPorCodigo } from '@/lib/constants/cargosObreros';
import { idsObrasHijasDesdeModuloIntegral } from '@/lib/proyectos/obraHijasDesdeModulo';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export type LaborRequestDirectorFormProps = {
  /** Proyecto módulo integral (ficha actual). */
  moduloIntegralId: string;
  nombreProyecto: string;
  /** Tras crear solicitud (p. ej. refrescar dashboard RRHH). */
  onCreada?: () => void;
};

type ProyectoOpt = { id: string; nombre: string };

export default function LaborRequestDirectorForm({
  moduloIntegralId,
  nombreProyecto,
  onCreada,
}: LaborRequestDirectorFormProps) {
  const supabase = useMemo(() => createClient(), []);
  const [proyectosDestino, setProyectosDestino] = useState<ProyectoOpt[]>([]);
  const [projectId, setProjectId] = useState('');
  const [cargoCodigo, setCargoCodigo] = useState('');
  const [cantidad, setCantidad] = useState('1');
  const [notas, setNotas] = useState('');
  const [loadingOpts, setLoadingOpts] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const cargarProyectos = useCallback(async () => {
    const mid = moduloIntegralId.trim();
    if (!mid) return;
    setLoadingOpts(true);
    const hijas = await idsObrasHijasDesdeModuloIntegral(supabase, mid);
    const ids = [mid, ...hijas];
    const { data, error: err } = await supabase.from('ci_proyectos').select('id,nombre').in('id', ids);
    if (err) {
      setProyectosDestino([{ id: mid, nombre: nombreProyecto }]);
      setProjectId(mid);
    } else {
      const rows = (data ?? []) as ProyectoOpt[];
      const ordered = ids
        .map((id) => rows.find((r) => r.id === id))
        .filter((x): x is ProyectoOpt => Boolean(x));
      setProyectosDestino(ordered.length ? ordered : [{ id: mid, nombre: nombreProyecto }]);
      setProjectId(ordered[0]?.id ?? mid);
    }
    setLoadingOpts(false);
  }, [moduloIntegralId, nombreProyecto, supabase]);

  useEffect(() => {
    void cargarProyectos();
  }, [cargarProyectos]);

  const cargoSel = cargoCodigo ? cargoPorCodigo(cargoCodigo) : undefined;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOkMsg(null);
    const pid = projectId.trim();
    const cod = cargoCodigo.trim();
    const q = Math.max(1, Math.min(500, Math.floor(Number(cantidad) || 1)));
    if (!pid) {
      setError('Selecciona el proyecto u obra destino.');
      return;
    }
    if (!cod || !cargoSel) {
      setError('Selecciona la especialidad (tabulador GOE).');
      return;
    }
    setSaving(true);
    const { error: insErr } = await supabase.from('labor_requests').insert({
      project_id: pid,
      specialty_codigo: cod,
      specialty_nombre: cargoSel.nombre,
      quantity_requested: q,
      status: 'pending',
      notes: notas.trim() || null,
    });
    setSaving(false);
    if (insErr) {
      if ((insErr.message ?? '').toLowerCase().includes('labor_requests')) {
        setError(
          'La tabla labor_requests no existe en Supabase. Aplica la migración 104_labor_requests_project_assignments.sql.',
        );
      } else {
        setError(insErr.message ?? 'No se pudo registrar la solicitud.');
      }
      return;
    }
    setOkMsg('Solicitud registrada. RRHH puede asignar personal desde el panel de gestión.');
    setCantidad('1');
    setNotas('');
    onCreada?.();
  }

  return (
    <Card className="border-zinc-700 bg-zinc-950/90 text-white shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-white">Solicitud de mano de obra</CardTitle>
        <CardDescription className="text-zinc-400">
          Director de obra · Especialidad y cantidad (se registra como <code className="text-zinc-300">labor_requests</code>).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => void onSubmit(e)} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label className="text-zinc-400">Proyecto / obra destino</Label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              disabled={loadingOpts}
              style={{ colorScheme: 'dark' }}
              className="mt-1.5 w-full rounded-md border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm text-white"
            >
              {proyectosDestino.map((p) => (
                <option key={p.id} value={p.id} className="bg-zinc-900">
                  {(p.nombre ?? 'Sin nombre').trim() || p.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <Label className="text-zinc-400">Especialidad (tabulador)</Label>
            <select
              value={cargoCodigo}
              onChange={(e) => setCargoCodigo(e.target.value)}
              style={{ colorScheme: 'dark' }}
              className="mt-1.5 w-full rounded-md border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm text-white"
            >
              <option value="">— Seleccione —</option>
              {CARGOS_OBREROS.map((c) => (
                <option key={c.codigo} value={c.codigo} className="bg-zinc-900">
                  {c.codigo} — {c.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="lr-cantidad" className="text-zinc-400">
              Cantidad
            </Label>
            <Input
              id="lr-cantidad"
              type="number"
              min={1}
              max={500}
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              className="mt-1.5 border-zinc-600 bg-zinc-900 text-white"
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="lr-notas" className="text-zinc-400">
              Notas (opcional)
            </Label>
            <Input
              id="lr-notas"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Turno, zona, prioridad…"
              className="mt-1.5 border-zinc-600 bg-zinc-900 text-white"
            />
          </div>
          {error ? <p className="sm:col-span-2 text-sm text-red-400">{error}</p> : null}
          {okMsg ? <p className="sm:col-span-2 text-sm text-emerald-400">{okMsg}</p> : null}
          <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
            <Button type="submit" variant="elitePrimary" disabled={saving || loadingOpts}>
              {saving ? 'Guardando…' : 'Crear solicitud'}
            </Button>
            <Link
              href="/rrhh/gestion-personal?solo=pendientes"
              className="text-xs font-medium text-sky-400 underline hover:text-sky-300"
            >
              Panel RRHH — asignaciones
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
