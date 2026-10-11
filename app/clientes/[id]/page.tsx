'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import ClienteContextoObraPatrono from '@/components/clientes/ClienteContextoObraPatrono';
import CustomerLoyaltyCard from '@/components/clientes/CustomerLoyaltyCard';
import { useCustomerLoyaltyScore } from '@/hooks/useCustomerLoyaltyScore';
import {
  cargarClienteDetalle,
  type CustomerDetail,
} from '@/lib/clientes/cargarClienteDetalle';
import {
  agruparPatronosDesdeObras,
  etiquetaEstadoObraLegible,
  hrefProyectoObra,
  montoObraUsd,
} from '@/lib/clientes/proyectosClienteDisplay';
import {
  cargarPresupuestosCliente,
  etiquetaEstadoPresupuesto,
  resumenPresupuestosCliente,
  tonoEstadoPresupuesto,
  type PresupuestoCliente,
  type TonoEstadoPresupuesto,
} from '@/lib/clientes/presupuestosCliente';
import { createClient } from '@/lib/supabase/client';

const CLASES_TONO: Record<TonoEstadoPresupuesto, string> = {
  verde: 'border-emerald-400/30 bg-emerald-500/15 text-emerald-200',
  ambar: 'border-amber-400/30 bg-amber-500/15 text-amber-200',
  azul: 'border-sky-400/30 bg-sky-500/15 text-sky-200',
  rojo: 'border-red-400/30 bg-red-500/15 text-red-200',
  gris: 'border-white/15 bg-white/10 text-zinc-300',
};

function usd(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fechaCorta(iso: string | null): string {
  if (!iso) return 'Sin fecha';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Sin fecha';
  return d.toLocaleDateString('es-VE', { dateStyle: 'medium', timeZone: 'America/Caracas' });
}

type ObraVinculada = {
  id: string;
  nombre: string;
  estado: string;
  tipo_proyecto: string | null;
  montoUsd: number;
  entidadId: string | null;
  entidadNombre: string | null;
  entidadRif: string | null;
};

export default function ClienteDetallePage() {
  const params = useParams();
  const id = String(params?.id ?? '').trim();
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cliente, setCliente] = useState<CustomerDetail | null>(null);
  const [obras, setObras] = useState<ObraVinculada[]>([]);
  const [obrasLoading, setObrasLoading] = useState(false);
  const [presupuestos, setPresupuestos] = useState<PresupuestoCliente[]>([]);
  const [presupuestosLoading, setPresupuestosLoading] = useState(false);
  const [presupuestosError, setPresupuestosError] = useState<string | null>(null);
  const loyalty = useCustomerLoyaltyScore(id);
  const resumenPresupuestos = useMemo(() => resumenPresupuestosCliente(presupuestos), [presupuestos]);

  const clienteDisplayNombre =
    cliente?.razon_social ?? cliente?.nombre ?? 'Cliente';

  const patronos = useMemo(
    () =>
      agruparPatronosDesdeObras(
        obras.map((o) => ({
          entidadId: o.entidadId,
          entidadNombre: o.entidadNombre,
          entidadRif: o.entidadRif,
        })),
      ),
    [obras],
  );

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError('Identificador no válido.');
      return;
    }
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      const { data, error: err } = await cargarClienteDetalle(supabase, id);
      if (!alive) return;
      setLoading(false);
      if (err) {
        setError(err);
        return;
      }
      setCliente(data);
    })();
    return () => {
      alive = false;
    };
  }, [id, supabase]);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    (async () => {
      setObrasLoading(true);
      const { data, error: err } = await supabase
        .from('ci_proyectos')
        .select(
          'id,nombre,estado,tipo_proyecto,monto_aproximado,obra_precio_venta_usd,entidad_id,ci_entidades(nombre,rif)',
        )
        .eq('customer_id', id)
        .order('created_at', { ascending: false });
      if (!alive) return;
      setObrasLoading(false);
      if (err) return;
      setObras(
        (data ?? []).map((p) => {
          const ent = p.ci_entidades as { nombre?: string | null; rif?: string | null } | null;
          return {
            id: String(p.id),
            nombre: String(p.nombre ?? 'Obra'),
            estado: String(p.estado ?? ''),
            tipo_proyecto: p.tipo_proyecto ?? null,
            montoUsd: montoObraUsd(p),
            entidadId: p.entidad_id ? String(p.entidad_id) : null,
            entidadNombre: ent?.nombre ?? null,
            entidadRif: ent?.rif ?? null,
          };
        }),
      );
    })();
    return () => {
      alive = false;
    };
  }, [id, supabase]);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    (async () => {
      setPresupuestosLoading(true);
      setPresupuestosError(null);
      const res = await cargarPresupuestosCliente(supabase, id);
      if (!alive) return;
      setPresupuestosLoading(false);
      setPresupuestosError(res.error);
      setPresupuestos(res.presupuestos);
    })();
    return () => {
      alive = false;
    };
  }, [id, supabase]);

  return (
    <div className="min-h-screen bg-[#0A0A0F] px-4 pb-28 pt-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <Link href="/clientes" className="text-sm font-medium text-[#7cb9ff] hover:underline">
          ← Volver a clientes
        </Link>

        {loading ? <p className="text-sm text-zinc-500">Cargando ficha del cliente...</p> : null}
        {error ? <p className="text-sm text-red-300">{error}</p> : null}

        {!loading && !error && !cliente ? (
          <p className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-zinc-500">Cliente no encontrado.</p>
        ) : null}

        {cliente ? (
          <>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <h1 className="text-xl font-bold text-white">{clienteDisplayNombre}</h1>
              <p className="mt-1 text-sm text-zinc-400">
                {cliente.customer_type === 'juridico' ? 'Persona Jurídica' : 'Persona Natural'}
              </p>
              <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-zinc-300 sm:grid-cols-2">
                <p>
                  Tratamiento:{' '}
                  {cliente.genero === 'F' ? 'Sra.' : cliente.genero === 'M' ? 'Sr.' : '—'}
                </p>
                <p>Cédula: {cliente.cedula ?? '—'}</p>
                <p>RIF: {cliente.rif ?? '—'}</p>
                <p>Estado civil: {cliente.estado_civil ?? '—'}</p>
                <p>Profesión: {cliente.profesion ?? '—'}</p>
                <p>Email: {cliente.email ?? '—'}</p>
                <p>Teléfono: {cliente.telefono ?? '—'}</p>
                <p>Representante legal: {cliente.representante_legal ?? '—'}</p>
                <p className="sm:col-span-2">Domicilio: {cliente.direccion ?? '—'}</p>
                <p>
                  Alta:{' '}
                  {cliente.created_at ? new Date(cliente.created_at).toLocaleDateString('es-VE', { dateStyle: 'medium' }) : '—'}
                </p>
              </div>
            </div>

            <ClienteContextoObraPatrono patronos={patronos} clienteNombre={clienteDisplayNombre} />

            {loyalty.isLoading ? <p className="text-sm text-zinc-500">Calculando score de fidelidad...</p> : null}
            {loyalty.error ? (
              <p className="rounded-xl border border-red-500/20 bg-red-950/20 p-3 text-sm text-red-200">
                No se pudo calcular el score: {loyalty.error.message}
              </p>
            ) : null}
            {loyalty.data ? <CustomerLoyaltyCard model={loyalty.data} /> : null}

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-white">Presupuestos</h2>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium text-zinc-300">
                    {presupuestos.length}
                  </span>
                  <Link
                    href={`/ventas?customerId=${encodeURIComponent(id)}`}
                    className="rounded-full border border-emerald-400/30 bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/25"
                  >
                    + Nuevo
                  </Link>
                </div>
              </div>

              {presupuestosLoading ? (
                <p className="mt-4 text-sm text-zinc-500">Cargando presupuestos…</p>
              ) : presupuestosError ? (
                <p className="mt-4 text-sm text-red-300">No se pudieron cargar los presupuestos: {presupuestosError}</p>
              ) : presupuestos.length === 0 ? (
                <p className="mt-4 text-sm text-zinc-500">Este cliente todavía no tiene presupuestos.</p>
              ) : (
                <>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-2">
                      <p className="text-zinc-500">Aceptado</p>
                      <p className="font-mono tabular-nums text-zinc-100">{usd(resumenPresupuestos.montoAceptadoUsd)}</p>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-2">
                      <p className="text-zinc-500">Pagado</p>
                      <p className="font-mono tabular-nums text-emerald-200">{usd(resumenPresupuestos.montoPagadoUsd)}</p>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-2">
                      <p className="text-zinc-500">Por cobrar</p>
                      <p className="font-mono tabular-nums text-amber-200">{usd(resumenPresupuestos.montoPorCobrarUsd)}</p>
                    </div>
                  </div>
                  <ul className="mt-3 space-y-2">
                    {presupuestos.map((p) => (
                      <li key={p.id}>
                        <Link
                          href={`/ventas?id=${encodeURIComponent(p.id)}`}
                          className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 p-3 transition-colors hover:border-[#7cb9ff]/40"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-white">{fechaCorta(p.created_at)}</p>
                            <span
                              className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold ${CLASES_TONO[tonoEstadoPresupuesto(p.status)]}`}
                            >
                              {etiquetaEstadoPresupuesto(p.status)}
                            </span>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="font-mono text-sm font-semibold tabular-nums text-zinc-100">{usd(p.subtotal)}</p>
                            <p className="mt-1 text-xs font-semibold text-[#7cb9ff]">Abrir →</p>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-white">Obras vinculadas</h2>
                <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium text-zinc-300">
                  {obras.length}
                </span>
              </div>

              {obrasLoading ? (
                <p className="mt-4 text-sm text-zinc-500">Cargando obras…</p>
              ) : obras.length === 0 ? (
                <p className="mt-4 text-sm text-zinc-500">Este cliente no tiene obras asignadas.</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {obras.map((obra) => (
                    <li
                      key={obra.id}
                      className="rounded-xl border border-white/10 bg-black/20 p-3 transition-colors hover:border-[#7cb9ff]/40"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-white">{obra.nombre}</p>
                          <p className="mt-1 text-xs text-zinc-400">
                            Estado: {etiquetaEstadoObraLegible(obra.estado)}
                            {obra.montoUsd > 0 ? ` · $${obra.montoUsd.toLocaleString('es-VE')} USD` : ''}
                          </p>
                          {obra.entidadNombre ? (
                            <p className="mt-1 text-xs text-amber-200/80">
                              Patrono: {obra.entidadNombre}
                              {obra.entidadRif ? ` (${obra.entidadRif})` : ''}
                            </p>
                          ) : (
                            <p className="mt-1 text-xs text-zinc-500">Sin patrono fiscal asignado</p>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1.5">
                          <Link
                            href={hrefProyectoObra(obra.id, obra.tipo_proyecto)}
                            className="text-xs font-semibold text-[#7cb9ff] hover:underline"
                          >
                            Abrir obra →
                          </Link>
                          <Link
                            href={`/contabilidad/compras?proyecto=${encodeURIComponent(obra.id)}&periodo=mes`}
                            className="text-xs font-medium text-zinc-500 hover:text-zinc-300 hover:underline"
                          >
                            Ver compras →
                          </Link>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
