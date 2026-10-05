'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { Check, Link2, Search, X } from 'lucide-react'
import type { BomSummary } from '@/lib/netvision/types'
import {
  MARGEN_VENTAS_DEFECTO,
  acotarMargen,
  aplicarMargen,
  buscarProductos,
  construirPresupuesto,
  enlacesParaGuardar,
  enlazarRenglon,
  notasPresupuesto,
  precioConMargen,
  renglonesDesdeBom,
  sugerirProductos,
  type ProductoVenta,
  type RenglonPresupuesto,
} from '@/lib/netvision/presupuesto'
import {
  cargarDatosPresupuesto,
  crearBorradorPresupuesto,
  type ClientePresupuesto,
  type DatosPresupuesto,
} from '@/lib/netvision/presupuestoCloud'

type Props = {
  bom: BomSummary
  projectName: string
  /** Nombre de cliente escrito en el proyecto (para proponerlo). */
  projectClient?: string
  /** Margen del proyecto en NetVision (%): es el que se propone. */
  margenPct?: number
  onClose: () => void
}

const campo =
  'min-h-10 rounded border border-white/15 bg-black/40 px-2 text-[12px] text-white disabled:opacity-40'

function nombreProducto(p: ProductoVenta): string {
  return [p.nombre, p.modelo && !p.nombre.includes(String(p.modelo)) ? p.modelo : null]
    .filter(Boolean)
    .join(' · ')
}

/**
 * Crea un presupuesto borrador en Ventas con la lista de materiales:
 * se elige el cliente y cada renglón se enlaza con un producto del catálogo
 * (el enlace queda recordado) o va como renglón libre.
 */
export default function NetVisionPresupuestoModal({
  bom,
  projectName,
  projectClient = '',
  margenPct: margenInicial,
  onClose,
}: Props) {
  const [margen, setMargen] = useState(() => acotarMargen(margenInicial))
  const [margenTexto, setMargenTexto] = useState(() => String(acotarMargen(margenInicial)))
  const [datos, setDatos] = useState<DatosPresupuesto | null>(null)
  const [renglones, setRenglones] = useState<RenglonPresupuesto[]>([])
  const [notas, setNotas] = useState<string[]>([])
  const [cliente, setCliente] = useState<ClientePresupuesto | null>(null)
  const [buscaCliente, setBuscaCliente] = useState(projectClient)
  const [enlazando, setEnlazando] = useState<string | null>(null)
  const [buscaProducto, setBuscaProducto] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [creado, setCreado] = useState<{ id: string; enlacesGuardados: boolean } | null>(null)

  useEffect(() => {
    let cancelado = false
    void cargarDatosPresupuesto().then((d) => {
      if (cancelado) return
      setDatos(d)
      const r = renglonesDesdeBom(bom, d.enlaces, d.productos, margen)
      setRenglones(r.renglones)
      setNotas(r.notas)
      const buscado = projectClient.trim().toLowerCase()
      if (buscado) {
        const igual = d.clientes.filter((c) => (c.nombre ?? '').trim().toLowerCase() === buscado)
        if (igual.length === 1) setCliente(igual[0]!)
      }
    })
    return () => {
      cancelado = true
    }
    // Se arma una sola vez al abrir: los cambios posteriores son del usuario.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const productos = useMemo(() => datos?.productos ?? [], [datos])
  const porId = useMemo(() => new Map(productos.map((p) => [p.id, p])), [productos])
  const presupuesto = useMemo(
    () => construirPresupuesto(renglones, productos, margen),
    [renglones, productos, margen],
  )
  const clientesFiltrados = useMemo(() => {
    const q = buscaCliente.trim().toLowerCase()
    const lista = datos?.clientes ?? []
    if (!q) return lista.slice(0, 6)
    return lista
      .filter(
        (c) =>
          (c.nombre ?? '').toLowerCase().includes(q) || (c.rif ?? '').toLowerCase().includes(q),
      )
      .slice(0, 6)
  }, [datos, buscaCliente])

  const cambiar = (clave: string, patch: Partial<RenglonPresupuesto>) =>
    setRenglones((lista) => lista.map((r) => (r.clave === clave ? { ...r, ...patch } : r)))

  const enlazar = (clave: string, p: ProductoVenta | null) => {
    setRenglones((lista) => lista.map((r) => (r.clave === clave ? enlazarRenglon(r, p, margen) : r)))
    setEnlazando(null)
    setBuscaProducto('')
  }

  const cambiarMargen = (texto: string) => {
    setMargenTexto(texto)
    const n = Number(texto)
    if (texto.trim() === '' || !Number.isFinite(n) || n < 0 || n > 300) return
    const nuevo = acotarMargen(n)
    setMargen(nuevo)
    setRenglones((lista) => aplicarMargen(lista, nuevo))
  }

  const incluidos = renglones.filter((r) => r.incluir && r.qty > 0)
  const libres = incluidos.filter((r) => r.productId == null).length

  const crear = async () => {
    if (!cliente || incluidos.length === 0 || guardando) return
    setGuardando(true)
    setError(null)
    const res = await crearBorradorPresupuesto({
      cliente,
      presupuesto,
      notas: notasPresupuesto(projectName, notas),
      enlaces: enlacesParaGuardar(renglones),
    })
    setGuardando(false)
    if (res.ok) setCreado({ id: res.id, enlacesGuardados: res.enlacesGuardados })
    else setError(res.error)
  }

  // Fuera del panel: un ancestro con desenfoque rompería el «fixed» del diálogo.
  return createPortal(
    <div
      data-nv-presupuesto-modal
      role="dialog"
      aria-modal="true"
      aria-label="Crear presupuesto en Ventas"
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-white/15 bg-[#071018] text-white shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--nexus-cyan)]">
              NetVision → Ventas
            </p>
            <h2 className="truncate text-base font-bold">Crear presupuesto</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-white/15"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3 text-[12px]">
          {!datos ? (
            <p className="py-6 text-center text-[var(--nexus-text-dim)]">Cargando clientes y productos…</p>
          ) : !datos.autenticado ? (
            <p
              data-nv-presupuesto-sin-sesion
              className="rounded-lg border border-amber-400/40 bg-amber-400/10 p-3 text-amber-50"
            >
              {datos.error
                ? `No se pudo conectar con Ventas: ${datos.error}`
                : 'Inicia sesión para crear el presupuesto en Ventas.'}
            </p>
          ) : creado ? (
            <div
              data-nv-presupuesto-creado
              className="space-y-3 rounded-lg border border-emerald-400/40 bg-emerald-400/10 p-3"
            >
              <p className="flex items-center gap-2 font-semibold text-emerald-50">
                <Check className="h-4 w-4" />
                Presupuesto creado como borrador (no enviado).
              </p>
              <p className="text-emerald-50/80">
                {presupuesto.items.length} {presupuesto.items.length === 1 ? 'renglón' : 'renglones'} ·
                subtotal ${presupuesto.subtotal.toFixed(2)}. Revísalo y ajusta precios en Ventas antes
                de enviarlo.
              </p>
              {!creado.enlacesGuardados ? (
                <p className="text-amber-100">
                  No se pudieron recordar los enlaces con productos; tendrás que elegirlos de nuevo la
                  próxima vez.
                </p>
              ) : null}
              <Link
                href={`/ventas?id=${encodeURIComponent(creado.id)}`}
                className="inline-flex min-h-11 items-center rounded-lg bg-[var(--nexus-cyan)] px-4 font-semibold text-black"
              >
                Abrir en Ventas
              </Link>
            </div>
          ) : (
            <>
              {datos.error ? (
                <p className="rounded-lg border border-amber-400/40 bg-amber-400/10 p-2 text-amber-50">
                  {datos.error}
                </p>
              ) : null}

              <section className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--nexus-cyan)]">
                  1 · Cliente
                </p>
                {cliente ? (
                  <div
                    data-nv-presupuesto-cliente
                    className="flex items-center justify-between gap-2 rounded-lg border border-white/15 bg-black/30 px-3 py-2"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{cliente.nombre || 'Sin nombre'}</span>
                      {cliente.rif ? (
                        <span className="block text-[11px] text-[var(--nexus-text-dim)]">{cliente.rif}</span>
                      ) : null}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCliente(null)}
                      className="min-h-9 shrink-0 rounded-md border border-white/15 px-2.5 font-semibold text-[var(--nexus-cyan)]"
                    >
                      Cambiar
                    </button>
                  </div>
                ) : (
                  <>
                    <label className="relative block">
                      <Search className="pointer-events-none absolute left-2.5 top-3 h-4 w-4 text-[var(--nexus-text-dim)]" />
                      <input
                        data-nv-presupuesto-busca-cliente
                        value={buscaCliente}
                        onChange={(e) => setBuscaCliente(e.target.value)}
                        placeholder="Buscar por nombre o RIF"
                        className={`${campo} w-full pl-8`}
                      />
                    </label>
                    {clientesFiltrados.length === 0 ? (
                      <p className="text-[var(--nexus-text-dim)]">
                        No hay clientes con ese nombre. Créalo primero en Clientes.
                      </p>
                    ) : (
                      <ul className="space-y-1">
                        {clientesFiltrados.map((c) => (
                          <li key={c.id}>
                            <button
                              type="button"
                              data-nv-presupuesto-opcion-cliente
                              onClick={() => setCliente(c)}
                              className="flex min-h-10 w-full items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/25 px-3 text-left hover:bg-white/5"
                            >
                              <span className="truncate font-semibold">{c.nombre || 'Sin nombre'}</span>
                              <span className="shrink-0 text-[11px] text-[var(--nexus-text-dim)]">{c.rif}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </section>

              <section className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--nexus-cyan)]">
                  2 · Renglones
                </p>
                <p className="text-[11px] text-[var(--nexus-text-dim)]">
                  Enlaza cada renglón con un producto tuyo; queda recordado para la próxima vez. Lo que
                  no enlaces entra como renglón libre: su costo es el precio de referencia y se le
                  suma el margen.
                </p>
                <label className="flex flex-wrap items-center gap-2 rounded-lg border border-white/15 bg-black/25 px-3 py-2">
                  <span className="font-semibold">Margen de ganancia</span>
                  <input
                    data-nv-presupuesto-margen
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={300}
                    step="any"
                    value={margenTexto}
                    onChange={(e) => cambiarMargen(e.target.value)}
                    onBlur={() => setMargenTexto(String(margen))}
                    className={`${campo} w-20 text-right`}
                  />
                  <span>%</span>
                  <span className="basis-full text-[11px] text-[var(--nexus-text-dim)]">
                    Se suma al precio de cada renglón, igual que en Ventas (allí el valor habitual es{' '}
                    {MARGEN_VENTAS_DEFECTO} %). Un precio que escribas a mano no se recalcula.
                  </span>
                </label>
                <ul className="space-y-2">
                  {renglones.map((r) => {
                    const producto = r.productId != null ? porId.get(r.productId) : undefined
                    const abierto = enlazando === r.clave
                    const sugeridos = abierto ? sugerirProductos(r.descripcion, productos) : []
                    const encontrados = abierto ? buscarProductos(buscaProducto, productos) : []
                    return (
                      <li
                        key={r.clave}
                        data-nv-presupuesto-renglon={r.clave}
                        className={`space-y-2 rounded-lg border p-2.5 ${
                          r.incluir ? 'border-white/15 bg-black/25' : 'border-white/5 bg-black/10 opacity-60'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            checked={r.incluir}
                            aria-label={`Incluir ${r.descripcion}`}
                            onChange={(e) => cambiar(r.clave, { incluir: e.target.checked })}
                            className="mt-1 h-5 w-5 shrink-0 accent-cyan-400"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold leading-snug">{r.descripcion}</p>
                            <p
                              data-nv-presupuesto-enlace={producto ? 'producto' : 'libre'}
                              className={`mt-0.5 text-[11px] ${
                                producto ? 'text-emerald-200' : 'text-amber-200'
                              }`}
                            >
                              {producto ? `Producto: ${nombreProducto(producto)}` : 'Renglón libre (sin producto enlazado)'}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-end gap-2 pl-7">
                          <label className="block text-[10px] text-[var(--nexus-text-dim)]">
                            Cantidad
                            <input
                              type="number"
                              inputMode="numeric"
                              min={0}
                              step={1}
                              value={r.qty}
                              disabled={!r.incluir}
                              onChange={(e) =>
                                cambiar(r.clave, {
                                  qty: Math.max(0, Math.ceil((Number(e.target.value) || 0) - 1e-9)),
                                })
                              }
                              className={`${campo} mt-0.5 block w-24 text-right`}
                            />
                          </label>
                          <label className="block text-[10px] text-[var(--nexus-text-dim)]">
                            Precio unitario ($)
                            <input
                              type="number"
                              inputMode="decimal"
                              min={0}
                              step="any"
                              value={r.precioUnit}
                              disabled={!r.incluir}
                              onChange={(e) =>
                                cambiar(r.clave, {
                                  precioUnit: Math.max(0, Number(e.target.value) || 0),
                                  manual: true,
                                })
                              }
                              className={`${campo} mt-0.5 block w-28 text-right`}
                            />
                          </label>
                          <span className="ml-auto pb-2.5 font-semibold">
                            ${(r.incluir ? r.qty * r.precioUnit : 0).toFixed(2)}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2 pl-7">
                          <button
                            type="button"
                            data-nv-presupuesto-enlazar
                            disabled={!r.incluir}
                            onClick={() => {
                              setEnlazando(abierto ? null : r.clave)
                              setBuscaProducto('')
                            }}
                            className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-white/15 px-2.5 font-semibold text-[var(--nexus-cyan)] disabled:opacity-40"
                          >
                            <Link2 className="h-3.5 w-3.5" />
                            {abierto ? 'Cerrar' : producto ? 'Cambiar producto' : 'Enlazar producto'}
                          </button>
                          {producto ? (
                            <button
                              type="button"
                              disabled={!r.incluir}
                              onClick={() => enlazar(r.clave, null)}
                              className="min-h-9 rounded-md border border-white/15 px-2.5 font-semibold text-[var(--nexus-text-muted)] disabled:opacity-40"
                            >
                              Quitar enlace
                            </button>
                          ) : null}
                        </div>
                        {abierto ? (
                          <div className="space-y-1.5 rounded-lg border border-cyan-400/30 bg-cyan-400/5 p-2 sm:ml-7">
                            <input
                              data-nv-presupuesto-busca-producto
                              value={buscaProducto}
                              onChange={(e) => setBuscaProducto(e.target.value)}
                              placeholder="Buscar en tus productos"
                              className={`${campo} w-full`}
                            />
                            {(buscaProducto.trim() ? encontrados : sugeridos).map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                data-nv-presupuesto-opcion-producto={p.id}
                                onClick={() => enlazar(r.clave, p)}
                                className="flex min-h-10 w-full items-center justify-between gap-2 rounded-md border border-white/10 bg-black/30 px-2.5 text-left hover:bg-white/5"
                              >
                                <span className="min-w-0 truncate">{nombreProducto(p)}</span>
                                <span className="shrink-0 font-semibold">
                                  ${precioConMargen(Number(p.precio ?? 0) || 0, margen).toFixed(2)}
                                </span>
                              </button>
                            ))}
                            {(buscaProducto.trim() ? encontrados : sugeridos).length === 0 ? (
                              <p className="text-[11px] text-[var(--nexus-text-dim)]">
                                {buscaProducto.trim()
                                  ? 'Ningún producto coincide.'
                                  : 'No hay un producto parecido; escribe para buscar.'}
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
                {notas.length > 0 ? (
                  <div className="rounded-lg border border-orange-400/30 bg-orange-400/10 p-2 text-[11px] text-orange-100">
                    <p className="font-semibold">Va como nota, sin monto:</p>
                    {notas.map((n) => (
                      <p key={n}>{n}</p>
                    ))}
                  </div>
                ) : null}
              </section>
            </>
          )}
        </div>

        {datos?.autenticado && !creado ? (
          <footer className="space-y-2 border-t border-white/10 px-4 py-3 text-[12px]">
            {error ? (
              <p data-nv-presupuesto-error className="rounded-lg border border-red-400/40 bg-red-400/10 p-2 text-red-100">
                No se pudo crear: {error}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[var(--nexus-text-muted)]">
                {incluidos.length} {incluidos.length === 1 ? 'renglón' : 'renglones'}
                {libres > 0 ? ` (${libres} ${libres === 1 ? 'libre' : 'libres'})` : ''} · Subtotal{' '}
                <span data-nv-presupuesto-subtotal className="font-bold text-white">
                  ${presupuesto.subtotal.toFixed(2)}
                </span>
                <span data-nv-presupuesto-ganancia className="block text-[11px]">
                  Costo ${presupuesto.total_cost.toFixed(2)} · Ganancia $
                  {presupuesto.total_profit.toFixed(2)} ({presupuesto.margin_pct.toFixed(1)} % de la venta)
                </span>
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-11 rounded-lg border border-white/15 px-4 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  data-nv-presupuesto-crear
                  disabled={!cliente || incluidos.length === 0 || guardando}
                  onClick={() => void crear()}
                  className="min-h-11 rounded-lg bg-[var(--nexus-cyan)] px-4 font-semibold text-black disabled:opacity-40"
                >
                  {guardando ? 'Creando…' : 'Crear borrador'}
                </button>
              </div>
            </div>
            {!cliente ? (
              <p className="text-[11px] text-amber-200">Elige el cliente para poder crear el presupuesto.</p>
            ) : null}
          </footer>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}
