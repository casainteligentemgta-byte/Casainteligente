'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  diasCalendarioInclusive,
  filasManoObraEstimada,
  type FilaManoObraEstimada,
} from '@/lib/proyectos/manoObraEstimada';
import { formatoVES } from '@/lib/nomina/compensacionDiaria';

type InsertResult = {
  id: string;
  nombre: string;
  fecha_inicio: string | null;
  fecha_entrega_prometida: string;
  presupuesto_ves: number | null;
};

export default function ProyectoNuevoPage() {
  const supabase = useMemo(() => createClient(), []);
  const [nombre, setNombre] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [cliente, setCliente] = useState('');
  const [presupuesto, setPresupuesto] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [dotacion, setDotacion] = useState('6');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creado, setCreado] = useState<InsertResult | null>(null);
  const [resumen, setResumen] = useState<{
    dias: number;
    obreros: number;
    filas: FilaManoObraEstimada[];
  } | null>(null);

  const diasPreview = useMemo(() => {
    if (!fechaInicio || !fechaFin) return 1;
    return diasCalendarioInclusive(fechaInicio, fechaFin);
  }, [fechaInicio, fechaFin]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const n = nombre.trim();
    if (!n || !fechaInicio || !fechaFin) {
      setError('Nombre del proyecto y ambas fechas son obligatorios.');
      return;
    }
    if (new Date(fechaFin) < new Date(fechaInicio)) {
      setError('La fecha de fin debe ser igual o posterior a la de inicio.');
      return;
    }
    const pres = presupuesto.trim();
    let presNum: number | null = null;
    if (pres !== '') {
      presNum = Number(pres.replace(',', '.'));
      if (!Number.isFinite(presNum) || presNum < 0) {
        setError('Presupuesto inválido.');
        return;
      }
    }

    const obrerosRef = Math.max(1, Math.floor(Number(dotacion) || 1));
    const diasRef = diasCalendarioInclusive(fechaInicio, fechaFin);

    setLoading(true);
    setError(null);
    setCreado(null);
    setResumen(null);

    const payload: Record<string, unknown> = {
      nombre: n,
      ubicacion: ubicacion.trim() || null,
      cliente: cliente.trim() || null,
      fecha_inicio: fechaInicio,
      fecha_entrega_prometida: fechaFin,
      estado: 'activa',
      avance_porcentaje: 0,
      penalizacion_diaria_usd: 0,
    };
    if (presNum != null) payload.presupuesto_ves = presNum;

    const { data, error: err } = await supabase
      .from('ci_obras')
      .insert(payload)
      .select('id,nombre,fecha_inicio,fecha_entrega_prometida,presupuesto_ves')
      .single();

    setLoading(false);
    if (err) {
      setError(
        err.message.includes('presupuesto_ves') || err.message.includes('column')
          ? `${err.message} — Ejecuta la migración 034 en Supabase (columna presupuesto_ves).`
          : err.message,
      );
      return;
    }
    if (data) {
      setCreado(data as InsertResult);
      setResumen({ dias: diasRef, obreros: obrerosRef, filas: filasManoObraEstimada(diasRef, obrerosRef) });
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-2xl px-4 py-10 pb-24">
        <Link href="/reclutamiento/dashboard" className="text-sm text-blue-600 hover:underline">
          ← Reclutamiento (CEO)
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-slate-800">Nuevo proyecto</h1>
        <p className="mt-1 text-sm text-slate-600">
          Registra la obra en <code className="rounded bg-slate-200 px-1 text-xs">ci_obras</code>. Las vacantes deben
          vincularse a un proyecto existente.
        </p>

        <form
          onSubmit={(e) => void onSubmit(e)}
          className="mt-8 space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Nombre del proyecto *
            </label>
            <input
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none ring-blue-500/30 focus:ring-2"
              placeholder="Ej. Torre B — Domótica"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Ubicación</label>
            <input
              value={ubicacion}
              onChange={(e) => setUbicacion(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none ring-blue-500/30 focus:ring-2"
              placeholder="Dirección o ciudad"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Cliente</label>
            <input
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none ring-blue-500/30 focus:ring-2"
              placeholder="Nombre o razón social"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Presupuesto (VES)
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={presupuesto}
              onChange={(e) => setPresupuesto(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none ring-blue-500/30 focus:ring-2"
              placeholder="Opcional"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Fecha inicio *
              </label>
              <input
                required
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none ring-blue-500/30 focus:ring-2"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Fecha fin (entrega) *
              </label>
              <input
                required
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none ring-blue-500/30 focus:ring-2"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Dotación estimada (obreros)
            </label>
            <input
              type="number"
              min={1}
              value={dotacion}
              onChange={(e) => setDotacion(e.target.value)}
              className="mt-1 w-full max-w-xs rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none ring-blue-500/30 focus:ring-2"
            />
            <p className="mt-1 text-xs text-slate-500">
              Se usa solo para el resumen de mano de obra tras crear el proyecto ({diasPreview} día(s) calendario con
              las fechas actuales).
            </p>
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition-opacity hover:bg-slate-800 disabled:opacity-50 sm:w-auto"
          >
            {loading ? 'Guardando en Supabase…' : 'Crear proyecto'}
          </button>
        </form>

        {creado && resumen ? (
          <section className="mt-10 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-800">Proyecto creado</h2>
            <p className="text-sm text-slate-600">
              <span className="font-medium text-slate-800">{creado.nombre}</span>
              {creado.presupuesto_ves != null ? (
                <>
                  {' '}
                  · Presupuesto ref.:{' '}
                  <span className="font-mono text-slate-800">{formatoVES(Number(creado.presupuesto_ves))} VES</span>
                </>
              ) : null}
            </p>
            <p className="text-xs text-slate-500">
              ID (para vacantes / API):{' '}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-800">{creado.id}</code>
            </p>

            <div>
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">
                Costo de mano de obra estimado
              </h3>
              <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                Escenario lineal: {resumen.obreros} obrero(s) × {resumen.dias} día(s) calendario. Incluye remuneración
                diaria (SB + bono Cl. 41) + cesta ticket diario por defecto. No sustituye un presupuesto de obra
                detallado.
              </p>
              <div className="mt-3 overflow-x-auto rounded-xl border border-slate-100">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="p-3">Referencia nivel</th>
                      <th className="p-3 text-right">VES / obrero / día</th>
                      <th className="p-3 text-right">Subtotal estimado (VES)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumen.filas.map((f) => (
                      <tr key={f.nivel} className="border-t border-slate-100">
                        <td className="p-3">
                          <span className="font-medium text-slate-800">{f.etiqueta}</span>
                        </td>
                        <td className="p-3 text-right font-mono text-slate-700">
                          {formatoVES(f.costoDiarioConCestaPorObrero)}
                        </td>
                        <td className="p-3 text-right font-mono font-semibold text-slate-900">
                          {formatoVES(f.subtotalEstimado)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/reclutamiento/dashboard"
                className="inline-flex rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"
              >
                Ir a vacantes (vincular a este proyecto)
              </Link>
              <Link
                href={`/proyectos/${creado.id}/finanzas`}
                className="inline-flex rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                Análisis de costos
              </Link>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
