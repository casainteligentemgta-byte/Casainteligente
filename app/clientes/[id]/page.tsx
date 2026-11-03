'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { toast } from 'sonner';
import ClienteContextoObraPatrono from '@/components/clientes/ClienteContextoObraPatrono';
import CustomerLoyaltyCard from '@/components/clientes/CustomerLoyaltyCard';
import HistorialCobrosCliente from '@/components/clientes/HistorialCobrosCliente';
import HistorialContactosCliente from '@/components/clientes/HistorialContactosCliente';
import BotonTema from '@/components/tema/BotonTema';
import { useCustomerLoyaltyScore } from '@/hooks/useCustomerLoyaltyScore';
import { nombreEntidad, type EntidadConNombre } from '@/lib/entidades/nombreEntidad';
import { apiArchivarCliente, apiRegistrarContactoCliente } from '@/lib/clientes/apiCliente';
import {
  cargarClienteDetalle,
  type CustomerDetail,
} from '@/lib/clientes/cargarClienteDetalle';
import { cargarCobrosCliente, type CobroCliente } from '@/lib/clientes/cobrosCliente';
import {
  cargarContactosCliente,
  type CanalContactoCliente,
  type ContactoCliente,
} from '@/lib/clientes/contactosCliente';
import { mensajeConfirmarArchivar } from '@/lib/clientes/guardarCliente';
import { hrefTelegram } from '@/lib/clientes/normalizarIdentidad';
import { numeroWhatsapp } from '@/lib/clientes/numeroWhatsapp';
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
import { tinta, tintaTexto } from '@/lib/tema/tinta';

const CLASES_TONO: Record<TonoEstadoPresupuesto, string> = {
  verde: 'border-emerald-400/30 bg-emerald-500/15 text-emerald-200',
  ambar: 'border-amber-400/30 bg-amber-500/15 text-amber-200',
  azul: 'border-sky-400/30 bg-sky-500/15 text-sky-200',
  rojo: 'border-red-500/20 bg-red-500/10 text-red-300',
  gris: 'border-[color:var(--label-tertiary)]/20 bg-[color:var(--superficie)] text-[color:var(--label-secondary)]',
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

const btnBarra: CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  padding: '12px 8px',
  borderRadius: 14,
  textDecoration: 'none',
  fontSize: 13,
  fontWeight: 700,
  fontFamily: 'inherit',
  border: '1px solid transparent',
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
  const [archivando, setArchivando] = useState(false);
  const [cobros, setCobros] = useState<CobroCliente[]>([]);
  const [cobrosLoading, setCobrosLoading] = useState(false);
  const [cobrosError, setCobrosError] = useState<string | null>(null);
  const [contactos, setContactos] = useState<ContactoCliente[]>([]);
  const [contactosLoading, setContactosLoading] = useState(false);
  const [contactosError, setContactosError] = useState<string | null>(null);
  const [registrandoContacto, setRegistrandoContacto] = useState(false);
  const loyalty = useCustomerLoyaltyScore(id);
  const resumenPresupuestos = useMemo(() => resumenPresupuestosCliente(presupuestos), [presupuestos]);

  const clienteDisplayNombre = cliente?.razon_social ?? cliente?.nombre ?? 'Cliente';
  const telefono = cliente?.movil || cliente?.telefono || '';
  const whatsapp = numeroWhatsapp(telefono);
  const telegram = hrefTelegram(cliente?.telegram_username, telefono);
  const archivado = cliente?.status === 'inactivo';

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
          'id,nombre,estado,tipo_proyecto,monto_aproximado,obra_precio_venta_usd,entidad_id,ci_entidades(nombre,rif,customer_id,customers(nombre))',
        )
        .eq('customer_id', id)
        .order('created_at', { ascending: false });
      if (!alive) return;
      setObrasLoading(false);
      if (err) return;
      setObras(
        (data ?? []).map((p) => {
          const ent = p.ci_entidades as
            | (EntidadConNombre & { nombre?: string | null; rif?: string | null })
            | null;
          return {
            id: String(p.id),
            nombre: String(p.nombre ?? 'Obra'),
            estado: String(p.estado ?? ''),
            tipo_proyecto: p.tipo_proyecto ?? null,
            montoUsd: montoObraUsd(p),
            entidadId: p.entidad_id ? String(p.entidad_id) : null,
            entidadNombre: ent ? nombreEntidad(ent, '') || null : null,
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

  const recargarContactos = useCallback(async () => {
    if (!id) return;
    setContactosLoading(true);
    setContactosError(null);
    const res = await cargarContactosCliente(supabase, id);
    setContactosLoading(false);
    setContactosError(res.error);
    setContactos(res.contactos);
  }, [id, supabase]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!id) return;
      setContactosLoading(true);
      setContactosError(null);
      const res = await cargarContactosCliente(supabase, id);
      if (!alive) return;
      setContactosLoading(false);
      setContactosError(res.error);
      setContactos(res.contactos);
    })();
    return () => {
      alive = false;
    };
  }, [id, supabase]);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    (async () => {
      setCobrosLoading(true);
      setCobrosError(null);
      const res = await cargarCobrosCliente(supabase, id);
      if (!alive) return;
      setCobrosLoading(false);
      setCobrosError(res.error);
      setCobros(res.cobros);
    })();
    return () => {
      alive = false;
    };
  }, [id, supabase]);

  async function registrarContacto(
    input: { canal: CanalContactoCliente; nota: string },
    opts?: { silencioso?: boolean },
  ) {
    if (!id) return;
    setRegistrandoContacto(true);
    const r = await apiRegistrarContactoCliente({
      customerId: id,
      canal: input.canal,
      nota: input.nota || (input.canal === 'whatsapp' ? 'Abrió WhatsApp desde la ficha' : null),
    });
    setRegistrandoContacto(false);
    if (r.error) {
      if (!opts?.silencioso) toast.error(r.error);
      return;
    }
    if (!opts?.silencioso) toast.success('Contacto guardado');
    await recargarContactos();
  }

  async function archivar() {
    if (!id) return;
    const next = archivado ? 'activo' : 'inactivo';
    if (next === 'inactivo') {
      if (!window.confirm(mensajeConfirmarArchivar(clienteDisplayNombre))) return;
    }
    setArchivando(true);
    const { error: err } = await apiArchivarCliente(id, next);
    setArchivando(false);
    if (err) {
      toast.error('No se pudo actualizar: ' + err);
      return;
    }
    setCliente((c) => (c ? { ...c, status: next } : c));
    toast.success(next === 'inactivo' ? 'Cliente archivado' : 'Cliente restaurado');
  }

  const card: CSSProperties = {
    borderRadius: 16,
    border: `1px solid ${tinta(0.1)}`,
    background: 'var(--superficie)',
    padding: 16,
  };

  return (
    <div className="pb-32 sm:pb-10" style={{ minHeight: '100vh', background: 'var(--bg-primary)', padding: '24px 16px' }}>
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Link href="/clientes" className="text-[13px] font-medium" style={{ color: 'var(--tono-azul)' }}>
            ← Volver a clientes
          </Link>
          <BotonTema />
        </div>

        {loading ? (
          <p className="text-sm" style={{ color: tintaTexto(0.5) }}>
            Cargando ficha del cliente...
          </p>
        ) : null}
        {error ? <p className="text-sm text-red-400">{error}</p> : null}

        {!loading && !error && !cliente ? (
          <p style={{ ...card, color: tintaTexto(0.5), fontSize: 14 }}>Cliente no encontrado.</p>
        ) : null}

        {cliente ? (
          <>
            <div style={card}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h1 className="text-xl font-bold" style={{ color: 'var(--label-primary)' }}>
                    {clienteDisplayNombre}
                  </h1>
                  <p className="mt-1 text-sm" style={{ color: tintaTexto(0.5) }}>
                    {cliente.customer_type === 'juridico' ? 'Persona Jurídica' : 'Persona Natural'}
                    {archivado ? ' · Archivado' : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void archivar()}
                  disabled={archivando}
                  className="rounded-full px-3 py-2 text-[13px] font-semibold"
                  style={{
                    border: `1px solid ${tinta(0.15)}`,
                    background: tinta(0.06),
                    color: archivado ? 'var(--tono-verde)' : 'var(--tono-naranja)',
                  }}
                >
                  {archivando ? '…' : archivado ? 'Restaurar' : 'Archivar'}
                </button>
              </div>
              <div
                className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2"
                style={{ color: 'var(--label-secondary)' }}
              >
                <p>
                  Tratamiento:{' '}
                  {cliente.genero === 'F' ? 'Sra.' : cliente.genero === 'M' ? 'Sr.' : '—'}
                </p>
                <p>Cédula: {cliente.cedula ?? '—'}</p>
                <p>RIF: {cliente.rif ?? '—'}</p>
                <p>Estado civil: {cliente.estado_civil ?? '—'}</p>
                <p>Profesión: {cliente.profesion ?? '—'}</p>
                <p>Email: {cliente.email ?? '—'}</p>
                <p>Teléfono: {telefono || '—'}</p>
                <p>Telegram: {cliente.telegram_username ? `@${cliente.telegram_username.replace(/^@/, '')}` : '—'}</p>
                <p>Representante legal: {cliente.representante_legal ?? '—'}</p>
                <p className="sm:col-span-2">Domicilio: {cliente.direccion ?? '—'}</p>
                <p>
                  Alta:{' '}
                  {cliente.created_at
                    ? new Date(cliente.created_at).toLocaleDateString('es-VE', { dateStyle: 'medium' })
                    : '—'}
                </p>
              </div>
            </div>

            <ClienteContextoObraPatrono patronos={patronos} clienteNombre={clienteDisplayNombre} />

            <HistorialContactosCliente
              contactos={contactos}
              loading={contactosLoading}
              error={contactosError}
              card={card}
              registrando={registrandoContacto}
              onRegistrar={registrarContacto}
            />

            {loyalty.isLoading ? (
              <p className="text-sm" style={{ color: tintaTexto(0.5) }}>
                Calculando score de fidelidad...
              </p>
            ) : null}
            {loyalty.error ? (
              <p
                className="rounded-xl p-3 text-sm"
                style={{ border: '1px solid rgba(255,59,48,0.25)', background: 'rgba(255,59,48,0.08)', color: 'var(--tono-rojo)' }}
              >
                No se pudo calcular el score: {loyalty.error.message}
              </p>
            ) : null}
            {loyalty.data ? <CustomerLoyaltyCard model={loyalty.data} /> : null}

            <div style={card}>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold" style={{ color: 'var(--label-primary)' }}>
                  Presupuestos
                </h2>
                <div className="flex items-center gap-2">
                  <span
                    className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                    style={{ background: tinta(0.08), color: tintaTexto(0.7) }}
                  >
                    {presupuestos.length}
                  </span>
                  <Link
                    href={`/ventas?customerId=${encodeURIComponent(id)}`}
                    className="rounded-full px-3 py-1 text-[13px] font-semibold"
                    style={{
                      border: '1px solid rgba(52,199,89,0.3)',
                      background: 'rgba(52,199,89,0.12)',
                      color: 'var(--tono-verde)',
                    }}
                  >
                    + Nuevo
                  </Link>
                </div>
              </div>

              {presupuestosLoading ? (
                <p className="mt-4 text-sm" style={{ color: tintaTexto(0.5) }}>
                  Cargando presupuestos…
                </p>
              ) : presupuestosError ? (
                <p className="mt-4 text-sm text-red-400">No se pudieron cargar los presupuestos: {presupuestosError}</p>
              ) : presupuestos.length === 0 ? (
                <p className="mt-4 text-sm" style={{ color: tintaTexto(0.5) }}>
                  Este cliente todavía no tiene presupuestos.
                </p>
              ) : (
                <>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded-lg p-2" style={{ border: `1px solid ${tinta(0.1)}` }}>
                      <p style={{ color: tintaTexto(0.45) }}>Aceptado</p>
                      <p className="font-mono tabular-nums" style={{ color: 'var(--label-primary)' }}>
                        {usd(resumenPresupuestos.montoAceptadoUsd)}
                      </p>
                    </div>
                    <div className="rounded-lg p-2" style={{ border: `1px solid ${tinta(0.1)}` }}>
                      <p style={{ color: tintaTexto(0.45) }}>Pagado</p>
                      <p className="font-mono tabular-nums" style={{ color: 'var(--tono-verde)' }}>
                        {usd(resumenPresupuestos.montoPagadoUsd)}
                      </p>
                    </div>
                    <div className="rounded-lg p-2" style={{ border: `1px solid ${tinta(0.1)}` }}>
                      <p style={{ color: tintaTexto(0.45) }}>Por cobrar</p>
                      <p className="font-mono tabular-nums" style={{ color: 'var(--tono-naranja)' }}>
                        {usd(resumenPresupuestos.montoPorCobrarUsd)}
                      </p>
                    </div>
                  </div>
                  <ul className="mt-3 space-y-2">
                    {presupuestos.map((p) => (
                      <li key={p.id}>
                        <Link
                          href={`/ventas?id=${encodeURIComponent(p.id)}`}
                          className="flex items-center justify-between gap-3 rounded-xl p-3"
                          style={{ border: `1px solid ${tinta(0.1)}`, background: tinta(0.03) }}
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium" style={{ color: 'var(--label-primary)' }}>
                              {fechaCorta(p.created_at)}
                            </p>
                            <span
                              className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold ${CLASES_TONO[tonoEstadoPresupuesto(p.status)]}`}
                            >
                              {etiquetaEstadoPresupuesto(p.status)}
                            </span>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="font-mono text-sm font-semibold tabular-nums" style={{ color: 'var(--label-primary)' }}>
                              {usd(p.subtotal)}
                            </p>
                            <p className="mt-1 text-[13px] font-semibold" style={{ color: 'var(--tono-azul)' }}>
                              Abrir →
                            </p>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>

            <HistorialCobrosCliente
              cobros={cobros}
              loading={cobrosLoading}
              error={cobrosError}
              card={card}
            />

            <div style={card}>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold" style={{ color: 'var(--label-primary)' }}>
                  Obras vinculadas
                </h2>
                <span
                  className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                  style={{ background: tinta(0.08), color: tintaTexto(0.7) }}
                >
                  {obras.length}
                </span>
              </div>

              {obrasLoading ? (
                <p className="mt-4 text-sm" style={{ color: tintaTexto(0.5) }}>
                  Cargando obras…
                </p>
              ) : obras.length === 0 ? (
                <p className="mt-4 text-sm" style={{ color: tintaTexto(0.5) }}>
                  Este cliente no tiene obras asignadas.
                </p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {obras.map((obra) => (
                    <li
                      key={obra.id}
                      className="rounded-xl p-3"
                      style={{ border: `1px solid ${tinta(0.1)}`, background: tinta(0.03) }}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium" style={{ color: 'var(--label-primary)' }}>
                            {obra.nombre}
                          </p>
                          <p className="mt-1 text-xs" style={{ color: tintaTexto(0.5) }}>
                            Estado: {etiquetaEstadoObraLegible(obra.estado)}
                            {obra.montoUsd > 0 ? ` · $${obra.montoUsd.toLocaleString('es-VE')} USD` : ''}
                          </p>
                          {obra.entidadNombre ? (
                            <p className="mt-1 text-xs" style={{ color: 'var(--tono-naranja)' }}>
                              Patrono: {obra.entidadNombre}
                              {obra.entidadRif ? ` (${obra.entidadRif})` : ''}
                            </p>
                          ) : (
                            <p className="mt-1 text-xs" style={{ color: tintaTexto(0.4) }}>
                              Sin patrono fiscal asignado
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1.5">
                          <Link
                            href={hrefProyectoObra(obra.id, obra.tipo_proyecto)}
                            className="text-[13px] font-semibold"
                            style={{ color: 'var(--tono-azul)' }}
                          >
                            Abrir obra →
                          </Link>
                          <Link
                            href={`/contabilidad/compras?proyecto=${encodeURIComponent(obra.id)}&periodo=mes`}
                            className="text-[13px] font-medium"
                            style={{ color: tintaTexto(0.45) }}
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

      {cliente ? (
        <div
          className="fixed inset-x-0 z-[60] mx-auto flex max-w-3xl gap-2 px-3 sm:static sm:mt-2 sm:px-0"
          style={{
            bottom: 72,
            paddingBottom: 'max(10px, env(safe-area-inset-bottom))',
          }}
        >
          <Link
            href={`/clientes/${id}/editar`}
            style={{
              ...btnBarra,
              background: 'rgba(255,149,0,0.14)',
              borderColor: 'rgba(255,149,0,0.3)',
              color: 'var(--tono-naranja)',
            }}
          >
            Editar
          </Link>
          {telefono ? (
            <a href={`tel:${telefono}`} style={{ ...btnBarra, background: 'rgba(52,199,89,0.14)', borderColor: 'rgba(52,199,89,0.3)', color: 'var(--tono-verde)' }}>
              Llamar
            </a>
          ) : (
            <span style={{ ...btnBarra, background: tinta(0.06), color: tintaTexto(0.35), cursor: 'not-allowed' }}>Llamar</span>
          )}
          {whatsapp ? (
            <a
              href={`https://wa.me/${whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                void registrarContacto(
                  { canal: 'whatsapp', nota: 'Abrió WhatsApp desde la ficha' },
                  { silencioso: true },
                );
              }}
              style={{
                ...btnBarra,
                background: 'rgba(37,211,102,0.14)',
                borderColor: 'rgba(37,211,102,0.3)',
                color: 'var(--tono-whatsapp, #25D366)',
              }}
            >
              WhatsApp
            </a>
          ) : (
            <span style={{ ...btnBarra, background: tinta(0.06), color: tintaTexto(0.35), cursor: 'not-allowed' }}>
              WhatsApp
            </span>
          )}
          {telegram ? (
            <a
              href={telegram}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                ...btnBarra,
                background: 'rgba(0,136,204,0.14)',
                borderColor: 'rgba(0,136,204,0.3)',
                color: 'var(--tono-azul)',
              }}
            >
              Telegram
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
