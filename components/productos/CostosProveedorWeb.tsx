'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';
import { efectoEnProducto, type ProductoActual } from '@/lib/productos/importarListaPrecios';
import { filaDesdePrecioWeb, proveedoresAdmitidos, revisarEnlaceProveedor } from '@/lib/productos/precioProveedorWeb';
import { tinta, tintaTexto, tonoTexto } from '@/lib/tema/tinta';

const NARANJA = '#FF9500';
const VERDE = '#34C759';
const ROJO = '#FF6B60';
const TENUE = tintaTexto(0.45);

/** Pausa entre un producto y el siguiente: no se le cae encima a la web del proveedor. */
const PAUSA_MS = 1200;

type ProductoConEnlace = ProductoActual & { proveedor_url: string };

type Lectura = { estado: 'leyendo' } | { estado: 'leido'; precio: number } | { estado: 'error'; error: string };

function dinero(n: number | null | undefined): string {
    if (n == null) return '—';
    return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function hoyLocal(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const esperar = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

const caja: CSSProperties = {
    background: tinta(0.04),
    border: `1px solid ${tinta(0.08)}`,
    borderRadius: '16px',
    padding: '16px',
};

const botonSecundario: CSSProperties = {
    background: tinta(0.08),
    color: 'var(--label-primary)',
    border: `1px solid ${tinta(0.12)}`,
    borderRadius: '10px',
    padding: '8px 12px',
    fontSize: '13px',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
};

const botonPrincipal: CSSProperties = {
    background: NARANJA,
    color: '#fff',
    border: 'none',
    borderRadius: '12px',
    padding: '12px 18px',
    fontSize: '14px',
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
};

export default function CostosProveedorWeb() {
    const supabase = useMemo(() => createClient(), []);
    const [productos, setProductos] = useState<ProductoConEnlace[] | null>(null);
    const [errorCarga, setErrorCarga] = useState<string | null>(null);
    const [lecturas, setLecturas] = useState<Record<number, Lectura>>({});
    const [marcados, setMarcados] = useState<Record<number, boolean>>({});
    const [mantenerMargen, setMantenerMargen] = useState(false);
    const [avance, setAvance] = useState<{ hechos: number; total: number } | null>(null);
    const [guardando, setGuardando] = useState(false);
    const [confirmar, setConfirmar] = useState(false);
    const [resultado, setResultado] = useState<{ actualizados: number; errores: string[] } | null>(null);
    const detener = useRef(false);

    const cargar = useCallback(async () => {
        setErrorCarga(null);
        const todos: ProductoConEnlace[] = [];
        let desde = 0;
        while (desde < 20000) {
            const { data, error } = await supabase
                .from('products')
                .select('id,nombre,marca,modelo,categoria,costo,precio,imagen,proveedor_url')
                .not('proveedor_url', 'is', null)
                .order('nombre')
                .range(desde, desde + 999);
            if (error) {
                setErrorCarga('No se pudieron cargar los productos. Revisa la conexión e intenta de nuevo.');
                return;
            }
            const lote = (data ?? []) as Array<Record<string, unknown>>;
            for (const p of lote) {
                const enlace = String(p.proveedor_url ?? '').trim();
                if (!enlace) continue;
                todos.push({
                    id: Number(p.id),
                    nombre: String(p.nombre ?? ''),
                    marca: (p.marca as string | null) ?? null,
                    modelo: (p.modelo as string | null) ?? null,
                    categoria: (p.categoria as string | null) ?? null,
                    imagen: (p.imagen as string | null) ?? null,
                    costo: p.costo == null ? null : Number(p.costo),
                    precio: p.precio == null ? null : Number(p.precio),
                    proveedor_url: enlace,
                });
            }
            if (lote.length < 1000) break;
            desde += 1000;
        }
        setProductos(todos);
    }, [supabase]);

    useEffect(() => {
        void cargar();
    }, [cargar]);

    const consultar = useCallback(async () => {
        if (!productos || productos.length === 0) return;
        detener.current = false;
        setResultado(null);
        setConfirmar(false);
        setLecturas({});
        setMarcados({});
        setAvance({ hechos: 0, total: productos.length });
        let hechos = 0;
        for (const p of productos) {
            if (detener.current) break;
            setLecturas((prev) => ({ ...prev, [p.id]: { estado: 'leyendo' } }));
            let lectura: Lectura;
            const enlace = revisarEnlaceProveedor(p.proveedor_url);
            if (!enlace.ok) {
                lectura = { estado: 'error', error: enlace.motivo };
            } else {
                try {
                    const res = await fetch('/api/productos/precio-proveedor', {
                        method: 'POST',
                        headers: { 'content-type': 'application/json' },
                        body: JSON.stringify({ url: enlace.url }),
                    });
                    if (res.status === 401) {
                        lectura = { estado: 'error', error: 'Tu sesión se cerró. Vuelve a entrar e inténtalo de nuevo.' };
                        detener.current = true;
                    } else {
                        const datos = (await res.json()) as { ok?: boolean; precio?: number; error?: string };
                        lectura =
                            datos.ok && typeof datos.precio === 'number'
                                ? { estado: 'leido', precio: datos.precio }
                                : { estado: 'error', error: datos.error || 'No se pudo leer el precio.' };
                    }
                } catch {
                    lectura = { estado: 'error', error: 'No se pudo consultar. Revisa la conexión.' };
                }
            }
            const final = lectura;
            setLecturas((prev) => ({ ...prev, [p.id]: final }));
            if (final.estado === 'leido') {
                const e = efectoEnProducto(p, filaDesdePrecioWeb(final.precio), { mantenerMargen: false });
                if (e.cambiaCosto) setMarcados((prev) => ({ ...prev, [p.id]: true }));
            }
            hechos += 1;
            setAvance({ hechos, total: productos.length });
            if (hechos < productos.length && !detener.current) await esperar(PAUSA_MS);
        }
        setAvance(null);
    }, [productos]);

    const filas = useMemo(() => {
        return (productos ?? []).map((p) => {
            const lectura = lecturas[p.id];
            const efecto = lectura && lectura.estado === 'leido' ? efectoEnProducto(p, filaDesdePrecioWeb(lectura.precio), { mantenerMargen }) : null;
            return { p, lectura, efecto };
        });
    }, [productos, lecturas, mantenerMargen]);

    const cambian = filas.filter((f) => f.efecto && f.efecto.cambiaCosto);
    const iguales = filas.filter((f) => f.efecto && !f.efecto.cambiaCosto);
    const fallidos = filas.filter((f) => f.lectura && f.lectura.estado === 'error');
    const aAplicar = cambian.filter((f) => marcados[f.p.id]);
    const consultando = avance != null;
    const hayLecturas = Object.keys(lecturas).length > 0;

    const aplicar = useCallback(async () => {
        setConfirmar(false);
        if (aAplicar.length === 0) return;
        setGuardando(true);
        const res = { actualizados: 0, errores: [] as string[] };
        const fecha = hoyLocal();
        for (const f of aAplicar) {
            const e = f.efecto!;
            const cambio: Record<string, string | number | null> = {
                costo: e.costo,
                utilidad: e.utilidad,
                lista_proveedor_fecha: fecha,
                modificado: new Date().toISOString(),
            };
            if (e.cambiaPrecio) cambio.precio = e.precio;
            const { data, error } = await supabase.from('products').update(cambio).eq('id', f.p.id).select('id');
            if (error) res.errores.push(`${f.p.nombre}: ${error.message}`);
            else if (!data || data.length === 0) res.errores.push(`${f.p.nombre}: no se guardó. Revisa que tu sesión siga abierta.`);
            else res.actualizados += 1;
        }
        setGuardando(false);
        setResultado(res);
        setLecturas({});
        setMarcados({});
        await cargar();
    }, [aAplicar, supabase, cargar]);

    const filaProducto = (f: (typeof filas)[number], conCasilla: boolean) => {
        const { p, lectura, efecto } = f;
        const sube = efecto && efecto.cambiaCosto && p.costo != null && efecto.costo != null ? efecto.costo - p.costo : null;
        return (
            <div
                key={p.id}
                data-cpw-producto={p.id}
                style={{ display: 'flex', gap: '12px', padding: '12px 16px', borderTop: `1px solid ${tinta(0.06)}`, alignItems: 'flex-start' }}
            >
                {conCasilla ? (
                    <input
                        type="checkbox"
                        checked={Boolean(marcados[p.id])}
                        onChange={(ev) => setMarcados((prev) => ({ ...prev, [p.id]: ev.target.checked }))}
                        aria-label={`Actualizar ${p.nombre}`}
                        style={{ width: '22px', height: '22px', accentColor: NARANJA, flexShrink: 0, marginTop: '2px' }}
                    />
                ) : null}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: 'var(--label-primary)', fontSize: '14px', fontWeight: 700, overflowWrap: 'anywhere' }}>{p.nombre}</div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginTop: '2px' }}>
                        {p.modelo ? <span style={{ color: TENUE, fontSize: '12px' }}>{p.modelo}</span> : null}
                        <a
                            href={p.proveedor_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: tonoTexto(NARANJA), fontSize: '12px', fontWeight: 700, textDecoration: 'none' }}
                        >
                            Ver en la web ↗
                        </a>
                    </div>
                    {!lectura ? (
                        <div style={{ color: TENUE, fontSize: '13px', marginTop: '6px' }}>Costo {dinero(p.costo)}</div>
                    ) : lectura.estado === 'leyendo' ? (
                        <div style={{ color: TENUE, fontSize: '13px', marginTop: '6px' }}>Leyendo…</div>
                    ) : lectura.estado === 'error' ? (
                        <div data-cpw-error style={{ color: tonoTexto(ROJO), fontSize: '12px', fontWeight: 600, marginTop: '6px', lineHeight: 1.4 }}>
                            {lectura.error}
                        </div>
                    ) : efecto ? (
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginTop: '6px', fontSize: '13px' }}>
                            {efecto.cambiaCosto ? (
                                <span data-cpw-costo style={{ color: 'var(--label-primary)' }}>
                                    Costo <span style={{ color: TENUE }}>{dinero(p.costo)}</span> → <strong>{dinero(efecto.costo)}</strong>
                                    {sube != null ? (
                                        <span style={{ color: sube > 0 ? ROJO : VERDE, fontWeight: 700 }}>
                                            {' '}
                                            ({sube > 0 ? '+' : '−'}
                                            {dinero(Math.abs(sube))})
                                        </span>
                                    ) : null}
                                </span>
                            ) : (
                                <span style={{ color: TENUE }}>Costo {dinero(p.costo)} (igual que en la web)</span>
                            )}
                            {efecto.cambiaPrecio ? (
                                <span data-cpw-precio style={{ color: 'var(--label-primary)' }}>
                                    Venta <span style={{ color: TENUE }}>{dinero(p.precio)}</span> → <strong>{dinero(efecto.precio)}</strong>
                                </span>
                            ) : efecto.cambiaCosto ? (
                                <span style={{ color: TENUE }}>Venta {dinero(p.precio)} (no se toca)</span>
                            ) : null}
                        </div>
                    ) : null}
                    {efecto && efecto.cambiaCosto && efecto.vendeBajoCosto ? (
                        <div data-cpw-aviso-perdida style={{ color: tonoTexto(ROJO), fontSize: '12px', fontWeight: 700, marginTop: '4px' }}>
                            Ojo: el costo nuevo queda por encima de tu precio de venta.
                        </div>
                    ) : null}
                </div>
            </div>
        );
    };

    const grupo = (id: string, titulo: string, ayuda: string, lista: typeof filas, conCasilla: boolean, acciones?: ReactNode) =>
        lista.length === 0 ? null : (
            <section data-cpw-grupo={id} style={{ ...caja, padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '14px 16px' }}>
                    <div style={{ color: 'var(--label-primary)', fontSize: '15px', fontWeight: 800 }}>
                        {titulo} <span style={{ color: tonoTexto(NARANJA) }}>({lista.length})</span>
                    </div>
                    <div style={{ color: TENUE, fontSize: '12px', marginTop: '2px' }}>{ayuda}</div>
                    {acciones ? <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>{acciones}</div> : null}
                </div>
                {lista.map((f) => filaProducto(f, conCasilla))}
            </section>
        );

    return (
        <div data-cpw style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '900px', margin: '0 auto' }}>
            {errorCarga ? (
                <div style={{ ...caja, color: tonoTexto(ROJO), fontSize: '13px', fontWeight: 600 }}>
                    {errorCarga}{' '}
                    <button type="button" style={{ ...botonSecundario, marginLeft: '8px' }} onClick={() => void cargar()}>
                        Reintentar
                    </button>
                </div>
            ) : null}

            {productos && productos.length === 0 ? (
                <section data-cpw-vacio style={caja}>
                    <h2 style={{ color: 'var(--label-primary)', fontSize: '16px', fontWeight: 800, margin: '0 0 6px' }}>
                        Todavía no hay productos con enlace
                    </h2>
                    <p style={{ color: TENUE, fontSize: '13px', lineHeight: 1.55, margin: 0 }}>
                        Para que un producto aparezca aquí: ábrelo en <Link href="/productos" style={{ color: tonoTexto(NARANJA), fontWeight: 700 }}>Productos</Link>,
                        toca «Editar» y pega en «Enlace en la web del proveedor» la dirección de su página (ábrela en la web del
                        proveedor y copia el enlace). Por ahora se lee el precio de: {proveedoresAdmitidos()}.
                    </p>
                </section>
            ) : null}

            {productos && productos.length > 0 ? (
                <section style={caja}>
                    <h2 style={{ color: 'var(--label-primary)', fontSize: '16px', fontWeight: 800, margin: '0 0 4px' }}>
                        {productos.length === 1 ? '1 producto con enlace' : `${productos.length.toLocaleString('es')} productos con enlace`}
                    </h2>
                    <p style={{ color: TENUE, fontSize: '13px', margin: '0 0 14px', lineHeight: 1.5 }}>
                        Se abre la página de cada uno en la web del proveedor y se lee su precio. Aquí no se cambia nada todavía:
                        primero ves qué cambiaría y luego decides. Va de uno en uno, sin prisa, para no cargar la web del proveedor.
                    </p>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                        {consultando ? (
                            <>
                                <span data-cpw-avance style={{ color: 'var(--label-primary)', fontSize: '14px', fontWeight: 700 }}>
                                    Consultando {avance!.hechos} de {avance!.total}…
                                </span>
                                <button
                                    type="button"
                                    style={botonSecundario}
                                    onClick={() => {
                                        detener.current = true;
                                    }}
                                >
                                    Detener
                                </button>
                            </>
                        ) : (
                            <button type="button" data-cpw-consultar style={botonPrincipal} disabled={guardando} onClick={() => void consultar()}>
                                {hayLecturas ? 'Volver a consultar' : 'Consultar precios'}
                            </button>
                        )}
                    </div>
                    {consultando && avance!.total > 20 ? (
                        <p style={{ color: TENUE, fontSize: '12px', margin: '10px 0 0' }}>
                            Tarda cerca de {Math.ceil((avance!.total * (PAUSA_MS + 800)) / 60000)} min. No cierres esta pantalla.
                        </p>
                    ) : null}
                </section>
            ) : null}

            {resultado ? (
                <section data-cpw-resultado style={{ ...caja, borderColor: `${VERDE}55` }}>
                    <div style={{ color: 'var(--label-primary)', fontSize: '14px', fontWeight: 700 }}>
                        {resultado.actualizados === 1 ? '1 producto actualizado.' : `${resultado.actualizados} productos actualizados.`}
                    </div>
                    {resultado.errores.map((e) => (
                        <div key={e} style={{ color: tonoTexto(ROJO), fontSize: '12px', marginTop: '4px' }}>
                            {e}
                        </div>
                    ))}
                </section>
            ) : null}

            {cambian.length > 0 ? (
                <section style={caja}>
                    <label style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={mantenerMargen}
                            onChange={(ev) => setMantenerMargen(ev.target.checked)}
                            style={{ width: '20px', height: '20px', accentColor: NARANJA, flexShrink: 0, marginTop: '2px' }}
                        />
                        <span>
                            <span style={{ display: 'block', color: 'var(--label-primary)', fontSize: '14px', fontWeight: 700 }}>Mantener mi margen</span>
                            <span style={{ display: 'block', color: TENUE, fontSize: '12px', marginTop: '2px', lineHeight: 1.45 }}>
                                Para los productos que tienen ganancia propia: si el costo sube o baja, su precio se mueve en la misma
                                proporción. Apagado: su precio no se toca. Los que tienen el precio igual al costo siempre siguen al costo.
                            </span>
                        </span>
                    </label>
                </section>
            ) : null}

            {grupo(
                'cambian',
                'Cambian de costo',
                'El precio de la web es distinto a tu costo.',
                cambian,
                true,
                <>
                    <button
                        type="button"
                        style={botonSecundario}
                        onClick={() => setMarcados((prev) => ({ ...prev, ...Object.fromEntries(cambian.map((f) => [f.p.id, true])) }))}
                    >
                        Marcar todos
                    </button>
                    <button
                        type="button"
                        style={botonSecundario}
                        onClick={() => setMarcados((prev) => ({ ...prev, ...Object.fromEntries(cambian.map((f) => [f.p.id, false])) }))}
                    >
                        Quitar todos
                    </button>
                </>,
            )}
            {grupo('fallidos', 'No se pudo leer', 'Revisa el enlace de estos productos.', fallidos, false)}
            {grupo('iguales', 'Sin cambios', 'Tu costo ya es el de la web.', iguales, false)}
            {!hayLecturas && productos && productos.length > 0
                ? grupo('lista', 'Productos con enlace', 'Toca «Consultar precios» para leer la web del proveedor.', filas, false)
                : null}

            {cambian.length > 0 && !consultando ? (
                <div
                    style={{
                        position: 'sticky',
                        bottom: '12px',
                        zIndex: 60,
                        background: 'var(--superficie-alta)',
                        boxShadow: 'var(--sombra-tarjeta-alta)',
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                        border: `1px solid ${tinta(0.12)}`,
                        borderRadius: '16px',
                        padding: '12px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        flexWrap: 'wrap',
                    }}
                >
                    <div data-cpw-resumen style={{ flex: 1, minWidth: '160px', color: 'var(--label-primary)', fontSize: '13px', lineHeight: 1.4 }}>
                        {guardando ? 'Guardando…' : confirmar ? `¿Cambiar el costo de ${aAplicar.length} producto${aAplicar.length === 1 ? '' : 's'}?` : `${aAplicar.length} marcado${aAplicar.length === 1 ? '' : 's'} de ${cambian.length}`}
                    </div>
                    {confirmar ? (
                        <>
                            <button type="button" style={botonSecundario} onClick={() => setConfirmar(false)}>
                                No
                            </button>
                            <button type="button" data-cpw-confirmar className="sobre-color" style={botonPrincipal} onClick={() => void aplicar()}>
                                Sí, aplicar
                            </button>
                        </>
                    ) : (
                        <button
                            type="button"
                            data-cpw-aplicar
                            className="sobre-color"
                            style={{ ...botonPrincipal, opacity: aAplicar.length === 0 || guardando ? 0.5 : 1 }}
                            disabled={aAplicar.length === 0 || guardando}
                            onClick={() => setConfirmar(true)}
                        >
                            Aplicar {aAplicar.length}
                        </button>
                    )}
                </div>
            ) : null}
        </div>
    );
}
