'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';
import { uploadProductImage } from '@/lib/supabase/product-media';
import { useCategoriasCatalogo } from '@/lib/productos/useCategoriasCatalogo';
import {
    cambioParaProducto,
    categoriaSugerida,
    efectoEnProducto,
    leerListaCsv,
    planificarImportacion,
    precioUsable,
    productoNuevoDesdeFila,
    type Coincidencia,
    type EstatusProveedor,
    type FilaLista,
    type ProductoActual,
} from '@/lib/productos/importarListaPrecios';
import { extraerDeZip, listarZip, nombreBase, tipoDeImagen, type EntradaZip } from '@/lib/productos/leerZip';

const NARANJA = '#FF9500';
const VERDE = '#34C759';
const ROJO = '#FF6B60';
const AMARILLO = '#FFD60A';
const TENUE = 'rgba(255,255,255,0.45)';

const POR_TANDA = 40;

function dinero(n: number | null | undefined): string {
    if (n == null) return '—';
    return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function hoyLocal(): string {
    const d = new Date();
    const dos = (n: number) => (n < 10 ? `0${n}` : String(n));
    return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

const ETIQUETA_ESTATUS: Record<EstatusProveedor, { texto: string; color: string }> = {
    disponible: { texto: 'Disponible', color: VERDE },
    no_disponible: { texto: 'No disponible', color: ROJO },
    en_transito: { texto: 'En tránsito', color: AMARILLO },
};

function Estatus({ valor }: { valor: EstatusProveedor | null }) {
    if (!valor) return null;
    const e = ETIQUETA_ESTATUS[valor];
    return (
        <span
            style={{
                fontSize: '10px',
                fontWeight: 800,
                padding: '2px 7px',
                borderRadius: '6px',
                color: e.color,
                background: `${e.color}22`,
                whiteSpace: 'nowrap',
            }}
        >
            {e.texto}
        </span>
    );
}

const caja: CSSProperties = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '16px',
    padding: '16px',
};

const botonSecundario: CSSProperties = {
    background: 'rgba(255,255,255,0.08)',
    color: 'white',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '10px',
    padding: '8px 12px',
    fontSize: '13px',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
};

/** Foto sacada del ZIP (se extrae solo cuando hace falta mostrarla). */
function useFotoDeZip(zip: Blob | null, entrada: EntradaZip | undefined): string | null {
    const [url, setUrl] = useState<string | null>(null);
    useEffect(() => {
        if (!zip || !entrada) {
            setUrl(null);
            return;
        }
        let vivo = true;
        let creada: string | null = null;
        extraerDeZip(zip, entrada, tipoDeImagen(entrada.nombre))
            .then((b) => {
                if (!vivo) return;
                creada = URL.createObjectURL(b);
                setUrl(creada);
            })
            .catch(() => undefined);
        return () => {
            vivo = false;
            if (creada) URL.revokeObjectURL(creada);
        };
    }, [zip, entrada]);
    return url;
}

function Miniatura({
    actual,
    zip,
    entrada,
    usarNueva,
}: {
    actual: string | null;
    zip: Blob | null;
    entrada: EntradaZip | undefined;
    /** true si al aplicar se pondrá la foto de la lista. */
    usarNueva: boolean;
}) {
    const nueva = useFotoDeZip(usarNueva ? zip : null, usarNueva ? entrada : undefined);
    const [rota, setRota] = useState(false);
    const elegida = usarNueva && nueva ? nueva : actual;
    useEffect(() => setRota(false), [elegida]);
    const src = rota ? null : elegida;
    return (
        <div style={{ position: 'relative', width: '52px', height: '52px', flexShrink: 0 }}>
            <div
                style={{
                    width: '52px',
                    height: '52px',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    background: src ? 'white' : 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                }}
            >
                {src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={src} alt="" onError={() => setRota(true)} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : null}
            </div>
            {usarNueva && nueva ? (
                <span
                    data-ilp-foto-nueva
                    style={{
                        position: 'absolute',
                        bottom: '-6px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        fontSize: '8px',
                        fontWeight: 800,
                        background: VERDE,
                        color: '#04210d',
                        borderRadius: '5px',
                        padding: '1px 4px',
                        whiteSpace: 'nowrap',
                    }}
                >
                    FOTO NUEVA
                </span>
            ) : null}
        </div>
    );
}

function Grupo({
    id,
    titulo,
    cuenta,
    ayuda,
    abiertoInicial,
    acciones,
    children,
}: {
    id: string;
    titulo: string;
    cuenta: number;
    ayuda: string;
    abiertoInicial: boolean;
    acciones?: ReactNode;
    children: ReactNode;
}) {
    const [abierto, setAbierto] = useState(abiertoInicial);
    if (cuenta === 0) return null;
    return (
        <section data-ilp-grupo={id} style={{ ...caja, padding: 0, overflow: 'hidden' }}>
            <button
                type="button"
                onClick={() => setAbierto((v) => !v)}
                aria-expanded={abierto}
                style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '14px 16px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    textAlign: 'left',
                }}
            >
                <span style={{ color: TENUE, fontSize: '12px', width: '12px' }}>{abierto ? '▾' : '▸'}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', color: 'white', fontSize: '15px', fontWeight: 800 }}>
                        {titulo} <span data-ilp-grupo-cuenta style={{ color: NARANJA }}>({cuenta})</span>
                    </span>
                    <span style={{ display: 'block', color: TENUE, fontSize: '12px', marginTop: '2px' }}>{ayuda}</span>
                </span>
            </button>
            {abierto ? (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    {acciones ? <div style={{ padding: '10px 16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>{acciones}</div> : null}
                    {children}
                </div>
            ) : null}
        </section>
    );
}

type Resultado = { actualizados: number; creados: number; fotos: number; errores: string[] };

export default function ImportarListaPrecios() {
    const supabase = useMemo(() => createClient(), []);
    const { nombres: categorias } = useCategoriasCatalogo();

    const [productos, setProductos] = useState<ProductoActual[] | null>(null);
    const [errorProductos, setErrorProductos] = useState<string | null>(null);

    const [nombreCsv, setNombreCsv] = useState('');
    const [filas, setFilas] = useState<FilaLista[] | null>(null);
    const [errorCsv, setErrorCsv] = useState<string | null>(null);

    const [zip, setZip] = useState<File | null>(null);
    const [entradas, setEntradas] = useState<Record<string, EntradaZip>>({});
    const [errorZip, setErrorZip] = useState<string | null>(null);

    // Vacía hasta montar: la fecha de hoy depende del reloj del dispositivo.
    const [fechaLista, setFechaLista] = useState('');
    const [mantenerMargen, setMantenerMargen] = useState(false);
    const [ponerFotos, setPonerFotos] = useState(true);
    const [reemplazarFotos, setReemplazarFotos] = useState(false);

    /** Productos existentes marcados para actualizar. */
    const [marcados, setMarcados] = useState<Record<number, boolean>>({});
    /** En los dudosos, qué renglón de la lista eligió el dueño (n de la fila). */
    const [elegidas, setElegidas] = useState<Record<number, number>>({});
    /** Renglones nuevos marcados para crear (por n). */
    const [nuevosMarcados, setNuevosMarcados] = useState<Record<number, boolean>>({});
    const [categoriaNuevo, setCategoriaNuevo] = useState<Record<number, string>>({});

    const [buscar, setBuscar] = useState('');
    const [soloDisponibles, setSoloDisponibles] = useState(true);
    const [seccion, setSeccion] = useState('');
    const [visibles, setVisibles] = useState(POR_TANDA);

    const [progreso, setProgreso] = useState<{ hechos: number; total: number } | null>(null);
    const [resultado, setResultado] = useState<Resultado | null>(null);
    const [confirmar, setConfirmar] = useState(false);
    const fotosSubidas = useRef<Record<string, string>>({});

    const cargarProductos = useCallback(async () => {
        setErrorProductos(null);
        const todos: ProductoActual[] = [];
        let desde = 0;
        while (desde < 20000) {
            const { data, error } = await supabase
                .from('products')
                .select('id,nombre,marca,modelo,categoria,costo,precio,imagen')
                .order('id')
                .range(desde, desde + 999);
            if (error) {
                setErrorProductos(`No pude leer tus productos: ${error.message}`);
                return;
            }
            const lote = (data ?? []) as ProductoActual[];
            for (const p of lote) {
                todos.push({
                    ...p,
                    costo: p.costo == null ? null : Number(p.costo),
                    precio: p.precio == null ? null : Number(p.precio),
                });
            }
            if (lote.length < 1000) break;
            desde += 1000;
        }
        setProductos(todos);
    }, [supabase]);

    useEffect(() => {
        void cargarProductos();
    }, [cargarProductos]);

    useEffect(() => {
        setFechaLista((f) => f || hoyLocal());
    }, []);

    const plan = useMemo(
        () => (filas && productos ? planificarImportacion(filas, productos) : null),
        [filas, productos],
    );

    // Al llegar un plan nuevo: lo seguro queda marcado; lo dudoso espera al dueño.
    useEffect(() => {
        if (!plan) return;
        const m: Record<number, boolean> = {};
        for (const c of plan.coincidencias) m[c.producto.id] = c.tipo !== 'dudoso';
        setMarcados(m);
        setElegidas({});
        setNuevosMarcados({});
        setVisibles(POR_TANDA);
    }, [plan]);

    const alElegirCsv = useCallback(async (archivo: File | null) => {
        setResultado(null);
        if (!archivo) return;
        setNombreCsv(archivo.name);
        try {
            const leida = leerListaCsv(await archivo.text());
            setErrorCsv(leida.error);
            setFilas(leida.error ? null : leida.filas);
        } catch {
            setErrorCsv('No pude leer el archivo.');
            setFilas(null);
        }
    }, []);

    const alElegirZip = useCallback(async (archivo: File | null) => {
        setErrorZip(null);
        fotosSubidas.current = {};
        if (!archivo) {
            setZip(null);
            setEntradas({});
            return;
        }
        try {
            const lista = await listarZip(archivo);
            const mapa: Record<string, EntradaZip> = {};
            for (const e of lista) {
                if (/\.(jpe?g|png|webp|gif)$/i.test(e.nombre)) mapa[nombreBase(e.nombre)] = e;
            }
            if (Object.keys(mapa).length === 0) {
                setErrorZip('El ZIP no trae fotos.');
                setZip(null);
                setEntradas({});
                return;
            }
            setEntradas(mapa);
            setZip(archivo);
        } catch (err) {
            setErrorZip(err instanceof Error ? err.message : 'No pude abrir el ZIP.');
            setZip(null);
            setEntradas({});
        }
    }, []);

    const filaElegida = useCallback(
        (c: Coincidencia): FilaLista | null => {
            if (c.elegida != null) return c.opciones[c.elegida] ?? null;
            const n = elegidas[c.producto.id];
            if (n == null) return null;
            for (const f of c.opciones) if (f.n === n) return f;
            return null;
        },
        [elegidas],
    );

    /** ¿Se le pondrá a este producto la foto de la lista? */
    const llevaFotoNueva = useCallback(
        (p: ProductoActual | null, f: FilaLista | null): boolean => {
            if (!zip || !ponerFotos || !f || !f.foto || !entradas[f.foto]) return false;
            if (p && p.imagen && p.imagen.trim() && !reemplazarFotos) return false;
            return true;
        },
        [zip, ponerFotos, entradas, reemplazarFotos],
    );

    const grupos = useMemo(() => {
        const de = (t: Coincidencia['tipo']) => (plan ? plan.coincidencias.filter((c) => c.tipo === t) : []);
        return { cambian: de('cambia'), dudosos: de('dudoso'), sinPrecio: de('sin_precio'), iguales: de('igual') };
    }, [plan]);

    const secciones = useMemo(() => {
        const vistas: Record<string, true> = {};
        const lista: string[] = [];
        for (const f of plan ? plan.nuevos : []) {
            if (f.seccion && !vistas[f.seccion]) {
                vistas[f.seccion] = true;
                lista.push(f.seccion);
            }
        }
        return lista;
    }, [plan]);

    const nuevosFiltrados = useMemo(() => {
        if (!plan) return [];
        const q = buscar.trim().toLowerCase();
        return plan.nuevos.filter((f) => {
            if (soloDisponibles && precioUsable(f) == null) return false;
            if (seccion && f.seccion !== seccion) return false;
            if (q && `${f.modelo} ${f.marca} ${f.descripcion}`.toLowerCase().indexOf(q) < 0) return false;
            return true;
        });
    }, [plan, buscar, soloDisponibles, seccion]);

    const aActualizar = useMemo(
        () => (plan ? plan.coincidencias.filter((c) => marcados[c.producto.id] && filaElegida(c)) : []),
        [plan, marcados, filaElegida],
    );
    const aCrear = useMemo(() => {
        if (!plan) return [];
        // Un renglón elegido para un producto dudoso no se crea además como nuevo.
        const tomadas: Record<number, true> = {};
        for (const c of aActualizar) {
            const f = filaElegida(c);
            if (f) tomadas[f.n] = true;
        }
        return plan.nuevos.filter((f) => nuevosMarcados[f.n] && !tomadas[f.n]);
    }, [plan, nuevosMarcados, aActualizar, filaElegida]);

    const totalCambios = aActualizar.length + aCrear.length;

    const subirFoto = useCallback(
        async (foto: string): Promise<string | null> => {
            const ya = fotosSubidas.current[foto];
            if (ya) return ya;
            const entrada = entradas[foto];
            if (!zip || !entrada) return null;
            const tipo = tipoDeImagen(entrada.nombre);
            const blob = await extraerDeZip(zip, entrada, tipo);
            const { url, error } = await uploadProductImage(supabase, new File([blob], foto, { type: tipo }));
            if (error || !url) throw new Error(error || 'No se pudo subir la foto.');
            fotosSubidas.current[foto] = url;
            return url;
        },
        [entradas, zip, supabase],
    );

    const aplicar = useCallback(async () => {
        setConfirmar(false);
        const total = aActualizar.length + aCrear.length;
        if (total === 0) return;
        const res: Resultado = { actualizados: 0, creados: 0, fotos: 0, errores: [] };
        const opciones = { mantenerMargen };
        const fecha = fechaLista || hoyLocal();
        let hechos = 0;
        setProgreso({ hechos, total });

        for (const c of aActualizar) {
            const f = filaElegida(c);
            if (f) {
                const cambio = cambioParaProducto(c.producto, f, opciones, fecha, new Date().toISOString());
                let conFoto = false;
                if (llevaFotoNueva(c.producto, f)) {
                    try {
                        const url = await subirFoto(f.foto);
                        if (url) {
                            cambio.imagen = url;
                            conFoto = true;
                        }
                    } catch (err) {
                        res.errores.push(`${c.producto.nombre}: la foto no subió (${err instanceof Error ? err.message : 'error'}).`);
                    }
                }
                const { data, error } = await supabase.from('products').update(cambio).eq('id', c.producto.id).select('id');
                if (error) res.errores.push(`${c.producto.nombre}: ${error.message}`);
                else if (!data || data.length === 0) res.errores.push(`${c.producto.nombre}: no se guardó. Revisa que tu sesión siga abierta.`);
                else {
                    res.actualizados += 1;
                    if (conFoto) res.fotos += 1;
                }
            }
            hechos += 1;
            setProgreso({ hechos, total });
        }

        for (const f of aCrear) {
            const fila = productoNuevoDesdeFila(f, categoriaNuevo[f.n] ?? '', fecha, new Date().toISOString());
            let conFoto = false;
            if (llevaFotoNueva(null, f)) {
                try {
                    const url = await subirFoto(f.foto);
                    if (url) {
                        fila.imagen = url;
                        conFoto = true;
                    }
                } catch (err) {
                    res.errores.push(`${f.modelo}: la foto no subió (${err instanceof Error ? err.message : 'error'}).`);
                }
            }
            const { error } = await supabase.from('products').insert([fila]);
            if (error) res.errores.push(`${f.modelo}: ${error.message}`);
            else {
                res.creados += 1;
                if (conFoto) res.fotos += 1;
            }
            hechos += 1;
            setProgreso({ hechos, total });
        }

        setProgreso(null);
        setResultado(res);
        await cargarProductos();
    }, [aActualizar, aCrear, mantenerMargen, fechaLista, filaElegida, llevaFotoNueva, subirFoto, supabase, categoriaNuevo, cargarProductos]);

    const marcarGrupo = (lista: Coincidencia[], valor: boolean) =>
        setMarcados((prev) => {
            const m = { ...prev };
            for (const c of lista) m[c.producto.id] = valor;
            return m;
        });

    const filaProducto = (c: Coincidencia) => {
        const f = filaElegida(c);
        const e = f ? efectoEnProducto(c.producto, f, { mantenerMargen }) : null;
        const sube = e && e.costo != null && c.producto.costo != null ? e.costo - c.producto.costo : null;
        return (
            <div
                key={c.producto.id}
                data-ilp-producto={c.producto.id}
                style={{ display: 'flex', gap: '12px', padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.05)', alignItems: 'flex-start' }}
            >
                <input
                    type="checkbox"
                    data-ilp-marcar
                    aria-label={`Aplicar a ${c.producto.nombre}`}
                    checked={Boolean(marcados[c.producto.id]) && Boolean(f)}
                    disabled={!f}
                    onChange={(ev) => setMarcados((prev) => ({ ...prev, [c.producto.id]: ev.target.checked }))}
                    style={{ width: '20px', height: '20px', marginTop: '16px', accentColor: NARANJA, flexShrink: 0 }}
                />
                <Miniatura
                    actual={c.producto.imagen}
                    zip={zip}
                    entrada={f ? entradas[f.foto] : undefined}
                    usarNueva={llevaFotoNueva(c.producto, f)}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: 'white', fontSize: '14px', fontWeight: 700, lineHeight: 1.25, overflowWrap: 'anywhere' }}>
                        {c.producto.nombre}
                    </div>
                    <div style={{ color: TENUE, fontSize: '12px', marginTop: '2px', overflowWrap: 'anywhere' }}>
                        {c.producto.modelo}
                    </div>

                    {c.tipo === 'dudoso' ? (
                        <div style={{ marginTop: '8px' }}>
                            <div style={{ color: AMARILLO, fontSize: '12px', marginBottom: '6px' }}>{c.motivo} ¿Cuál es?</div>
                            {c.opciones.map((o) => (
                                <label
                                    key={o.n}
                                    data-ilp-opcion={o.n}
                                    style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '6px 0', cursor: 'pointer', flexWrap: 'wrap' }}
                                >
                                    <input
                                        type="radio"
                                        name={`opcion-${c.producto.id}`}
                                        checked={elegidas[c.producto.id] === o.n}
                                        onChange={() => {
                                            setElegidas((prev) => ({ ...prev, [c.producto.id]: o.n }));
                                            setMarcados((prev) => ({ ...prev, [c.producto.id]: true }));
                                        }}
                                        style={{ width: '18px', height: '18px', accentColor: NARANJA }}
                                    />
                                    <span style={{ color: 'white', fontSize: '13px', fontWeight: 600, overflowWrap: 'anywhere' }}>{o.modelo}</span>
                                    <span style={{ color: VERDE, fontSize: '13px', fontWeight: 700 }}>{dinero(precioUsable(o))}</span>
                                    <Estatus valor={o.estatus} />
                                </label>
                            ))}
                            <label style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '6px 0', cursor: 'pointer' }}>
                                <input
                                    type="radio"
                                    name={`opcion-${c.producto.id}`}
                                    checked={elegidas[c.producto.id] == null}
                                    onChange={() => {
                                        setElegidas((prev) => {
                                            const m = { ...prev };
                                            delete m[c.producto.id];
                                            return m;
                                        });
                                        setMarcados((prev) => ({ ...prev, [c.producto.id]: false }));
                                    }}
                                    style={{ width: '18px', height: '18px', accentColor: NARANJA }}
                                />
                                <span style={{ color: TENUE, fontSize: '13px' }}>Ninguno, no lo toques</span>
                            </label>
                        </div>
                    ) : null}

                    {e ? (
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginTop: '6px', fontSize: '13px' }}>
                            {e.cambiaCosto ? (
                                <span data-ilp-costo style={{ color: 'white' }}>
                                    Costo <span style={{ color: TENUE }}>{dinero(c.producto.costo)}</span> →{' '}
                                    <strong>{dinero(e.costo)}</strong>
                                    {sube != null ? (
                                        <span style={{ color: sube > 0 ? ROJO : VERDE, fontWeight: 700 }}>
                                            {' '}
                                            ({sube > 0 ? '+' : '−'}
                                            {dinero(Math.abs(sube))})
                                        </span>
                                    ) : null}
                                </span>
                            ) : (
                                <span style={{ color: TENUE }}>Costo {dinero(c.producto.costo)} (queda igual)</span>
                            )}
                            {e.cambiaPrecio ? (
                                <span data-ilp-precio style={{ color: 'white' }}>
                                    Venta <span style={{ color: TENUE }}>{dinero(c.producto.precio)}</span> → <strong>{dinero(e.precio)}</strong>
                                </span>
                            ) : (
                                <span style={{ color: TENUE }}>Venta {dinero(c.producto.precio)}</span>
                            )}
                            <Estatus valor={e.disponibilidad} />
                        </div>
                    ) : null}
                    {e && e.vendeBajoCosto ? (
                        <div data-ilp-aviso-perdida style={{ color: ROJO, fontSize: '12px', fontWeight: 700, marginTop: '4px' }}>
                            Ojo: el costo nuevo queda por encima de tu precio de venta.
                        </div>
                    ) : null}
                </div>
            </div>
        );
    };

    const botonesGrupo = (lista: Coincidencia[]) => (
        <>
            <button type="button" style={botonSecundario} onClick={() => marcarGrupo(lista, true)}>
                Marcar todos
            </button>
            <button type="button" style={botonSecundario} onClick={() => marcarGrupo(lista, false)}>
                Quitar todos
            </button>
        </>
    );

    const interruptor = (id: string, activo: boolean, cambiar: (v: boolean) => void, titulo: string, ayuda: string) => (
        <label data-ilp-opcion-global={id} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', cursor: 'pointer', padding: '8px 0' }}>
            <input
                type="checkbox"
                checked={activo}
                onChange={(ev) => cambiar(ev.target.checked)}
                style={{ width: '20px', height: '20px', accentColor: NARANJA, flexShrink: 0, marginTop: '2px' }}
            />
            <span>
                <span style={{ display: 'block', color: 'white', fontSize: '14px', fontWeight: 700 }}>{titulo}</span>
                <span style={{ display: 'block', color: TENUE, fontSize: '12px', marginTop: '2px' }}>{ayuda}</span>
            </span>
        </label>
    );

    const cuentaFotos = Object.keys(entradas).length;

    return (
        <div data-ilp style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '900px', margin: '0 auto' }}>
            <section style={caja}>
                <h2 style={{ color: 'white', fontSize: '16px', fontWeight: 800, margin: '0 0 4px' }}>1. Sube la lista</h2>
                <p style={{ color: TENUE, fontSize: '13px', margin: '0 0 14px', lineHeight: 1.5 }}>
                    Aquí no se cambia nada todavía: primero ves qué pasaría con cada producto y luego decides.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
                    <label style={{ display: 'block' }}>
                        <span style={{ display: 'block', color: 'white', fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>
                            Lista de precios (archivo .csv)
                        </span>
                        <input
                            type="file"
                            data-ilp-csv
                            accept=".csv,text/csv"
                            onChange={(ev) => void alElegirCsv(ev.target.files && ev.target.files[0] ? ev.target.files[0] : null)}
                            style={{ color: TENUE, fontSize: '13px', maxWidth: '100%' }}
                        />
                        {filas ? (
                            <span data-ilp-csv-ok style={{ display: 'block', color: VERDE, fontSize: '12px', marginTop: '6px' }}>
                                {nombreCsv}: {filas.length.toLocaleString('es')} renglones leídos.
                            </span>
                        ) : null}
                        {errorCsv ? (
                            <span data-ilp-csv-error style={{ display: 'block', color: ROJO, fontSize: '12px', marginTop: '6px' }}>
                                {errorCsv}
                            </span>
                        ) : null}
                    </label>
                    <label style={{ display: 'block' }}>
                        <span style={{ display: 'block', color: 'white', fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>
                            Fotos (archivo .zip, opcional)
                        </span>
                        <input
                            type="file"
                            data-ilp-zip
                            accept=".zip,application/zip"
                            onChange={(ev) => void alElegirZip(ev.target.files && ev.target.files[0] ? ev.target.files[0] : null)}
                            style={{ color: TENUE, fontSize: '13px', maxWidth: '100%' }}
                        />
                        {zip ? (
                            <span data-ilp-zip-ok style={{ display: 'block', color: VERDE, fontSize: '12px', marginTop: '6px' }}>
                                {cuentaFotos.toLocaleString('es')} fotos listas.
                            </span>
                        ) : null}
                        {errorZip ? (
                            <span data-ilp-zip-error style={{ display: 'block', color: ROJO, fontSize: '12px', marginTop: '6px' }}>
                                {errorZip}
                            </span>
                        ) : null}
                    </label>
                    <label style={{ display: 'block' }}>
                        <span style={{ display: 'block', color: 'white', fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>
                            Fecha de la lista
                        </span>
                        <input
                            type="date"
                            data-ilp-fecha
                            value={fechaLista}
                            onChange={(ev) => setFechaLista(ev.target.value || hoyLocal())}
                            style={{
                                background: 'rgba(255,255,255,0.06)',
                                border: '1px solid rgba(255,255,255,0.12)',
                                borderRadius: '10px',
                                padding: '8px 10px',
                                color: 'white',
                                fontSize: '14px',
                                fontFamily: 'inherit',
                                colorScheme: 'dark',
                            }}
                        />
                    </label>
                </div>
                {errorProductos ? (
                    <p data-ilp-error-productos style={{ color: ROJO, fontSize: '13px', margin: '12px 0 0' }}>
                        {errorProductos}
                    </p>
                ) : null}
                {filas && !productos && !errorProductos ? (
                    <p style={{ color: TENUE, fontSize: '13px', margin: '12px 0 0' }}>Leyendo tus productos…</p>
                ) : null}
            </section>

            {plan ? (
                <>
                    <section style={caja}>
                        <h2 style={{ color: 'white', fontSize: '16px', fontWeight: 800, margin: '0 0 4px' }}>2. Cómo aplicar</h2>
                        {interruptor(
                            'margen',
                            mantenerMargen,
                            setMantenerMargen,
                            'Mantener mi margen',
                            'Si el costo sube o baja, el precio de venta se mueve en la misma proporción. Apagado: el precio de venta no se toca.',
                        )}
                        {zip
                            ? interruptor(
                                  'fotos',
                                  ponerFotos,
                                  setPonerFotos,
                                  'Poner la foto de la lista a los que no tienen',
                                  'Solo a productos sin foto. Las fotos que ya subiste se respetan.',
                              )
                            : null}
                        {zip && ponerFotos
                            ? interruptor(
                                  'reemplazar',
                                  reemplazarFotos,
                                  setReemplazarFotos,
                                  'Reemplazar también las fotos que ya tienen',
                                  'Cambia la foto actual por la de la lista en todos los marcados.',
                              )
                            : null}
                    </section>

                    <h2 style={{ color: 'white', fontSize: '16px', fontWeight: 800, margin: '4px 0 -4px' }}>3. Revisa y marca</h2>

                    {plan.coincidencias.length === 0 ? (
                        <p data-ilp-sin-coincidencias style={{ ...caja, color: TENUE, fontSize: '13px', margin: 0 }}>
                            Ninguno de tus productos aparece en esta lista. Puedes agregar productos nuevos más abajo.
                        </p>
                    ) : null}

                    <Grupo
                        id="cambian"
                        titulo="Cambian de costo"
                        cuenta={grupos.cambian.length}
                        ayuda="Están en tu catálogo y la lista trae otro costo."
                        abiertoInicial
                        acciones={botonesGrupo(grupos.cambian)}
                    >
                        {grupos.cambian.map(filaProducto)}
                    </Grupo>

                    <Grupo
                        id="dudosos"
                        titulo="Hay que elegir"
                        cuenta={grupos.dudosos.length}
                        ayuda="El modelo no coincide del todo. No se tocan hasta que elijas."
                        abiertoInicial
                    >
                        {grupos.dudosos.map(filaProducto)}
                    </Grupo>

                    <Grupo
                        id="sin_precio"
                        titulo="El proveedor no lo tiene"
                        cuenta={grupos.sinPrecio.length}
                        ayuda="Tu costo queda igual; solo se anota que no está disponible."
                        abiertoInicial={false}
                        acciones={botonesGrupo(grupos.sinPrecio)}
                    >
                        {grupos.sinPrecio.map(filaProducto)}
                    </Grupo>

                    <Grupo
                        id="iguales"
                        titulo="Sin cambio de costo"
                        cuenta={grupos.iguales.length}
                        ayuda="Ya tienen el costo de la lista; se anota la disponibilidad."
                        abiertoInicial={false}
                        acciones={botonesGrupo(grupos.iguales)}
                    >
                        {grupos.iguales.map(filaProducto)}
                    </Grupo>

                    <Grupo
                        id="nuevos"
                        titulo="No los tienes en tu catálogo"
                        cuenta={plan.nuevos.length}
                        ayuda="Marca solo los que quieras agregar. Se crean sin precio de venta para que tú lo pongas."
                        abiertoInicial={plan.coincidencias.length === 0}
                    >
                        <div style={{ padding: '10px 16px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                            <input
                                type="search"
                                data-ilp-buscar
                                value={buscar}
                                onChange={(ev) => {
                                    setBuscar(ev.target.value);
                                    setVisibles(POR_TANDA);
                                }}
                                placeholder="Buscar modelo o descripción"
                                style={{
                                    flex: 1,
                                    minWidth: '180px',
                                    background: 'rgba(255,255,255,0.06)',
                                    border: '1px solid rgba(255,255,255,0.12)',
                                    borderRadius: '10px',
                                    padding: '9px 12px',
                                    color: 'white',
                                    fontSize: '14px',
                                    fontFamily: 'inherit',
                                    outline: 'none',
                                }}
                            />
                            <select
                                data-ilp-seccion
                                value={seccion}
                                onChange={(ev) => {
                                    setSeccion(ev.target.value);
                                    setVisibles(POR_TANDA);
                                }}
                                style={{
                                    background: '#1C1C1E',
                                    border: '1px solid rgba(255,255,255,0.12)',
                                    borderRadius: '10px',
                                    padding: '9px 10px',
                                    color: 'white',
                                    fontSize: '13px',
                                    fontFamily: 'inherit',
                                    maxWidth: '100%',
                                }}
                            >
                                <option value="">Todas las secciones</option>
                                {secciones.map((s) => (
                                    <option key={s} value={s}>
                                        {s}
                                    </option>
                                ))}
                            </select>
                            <label style={{ display: 'flex', gap: '6px', alignItems: 'center', color: TENUE, fontSize: '13px', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    data-ilp-solo-disponibles
                                    checked={soloDisponibles}
                                    onChange={(ev) => {
                                        setSoloDisponibles(ev.target.checked);
                                        setVisibles(POR_TANDA);
                                    }}
                                    style={{ width: '18px', height: '18px', accentColor: NARANJA }}
                                />
                                Solo disponibles
                            </label>
                        </div>
                        <p data-ilp-nuevos-cuenta style={{ color: TENUE, fontSize: '12px', margin: '0 16px 8px' }}>
                            {nuevosFiltrados.length.toLocaleString('es')} a la vista
                            {aCrear.length > 0 ? ` · ${aCrear.length} marcado${aCrear.length === 1 ? '' : 's'} para agregar` : ''}
                        </p>
                        {nuevosFiltrados.slice(0, visibles).map((f) => (
                            <div
                                key={f.n}
                                data-ilp-nuevo={f.n}
                                style={{ display: 'flex', gap: '12px', padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.05)', alignItems: 'flex-start' }}
                            >
                                <input
                                    type="checkbox"
                                    data-ilp-marcar
                                    aria-label={`Agregar ${f.modelo}`}
                                    checked={Boolean(nuevosMarcados[f.n])}
                                    onChange={(ev) => setNuevosMarcados((prev) => ({ ...prev, [f.n]: ev.target.checked }))}
                                    style={{ width: '20px', height: '20px', marginTop: '16px', accentColor: NARANJA, flexShrink: 0 }}
                                />
                                <Miniatura actual={null} zip={zip} entrada={entradas[f.foto]} usarNueva={llevaFotoNueva(null, f)} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                                        <span style={{ color: 'white', fontSize: '14px', fontWeight: 700, overflowWrap: 'anywhere' }}>{f.modelo}</span>
                                        <span style={{ color: TENUE, fontSize: '11px', fontWeight: 700 }}>{f.marca}</span>
                                        <span style={{ color: VERDE, fontSize: '14px', fontWeight: 800 }}>{dinero(precioUsable(f))}</span>
                                        <Estatus valor={f.estatus} />
                                    </div>
                                    <div
                                        style={{
                                            color: TENUE,
                                            fontSize: '12px',
                                            marginTop: '3px',
                                            lineHeight: 1.4,
                                            display: '-webkit-box',
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: 'vertical',
                                            overflow: 'hidden',
                                        }}
                                    >
                                        {f.descripcion}
                                    </div>
                                    {nuevosMarcados[f.n] ? (
                                        <label style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '8px', color: TENUE, fontSize: '12px' }}>
                                            Categoría
                                            <select
                                                data-ilp-categoria
                                                value={categoriaNuevo[f.n] ?? categoriaSugerida(f.seccion)}
                                                onChange={(ev) => setCategoriaNuevo((prev) => ({ ...prev, [f.n]: ev.target.value }))}
                                                style={{
                                                    background: '#1C1C1E',
                                                    border: '1px solid rgba(255,255,255,0.12)',
                                                    borderRadius: '8px',
                                                    padding: '6px 8px',
                                                    color: 'white',
                                                    fontSize: '13px',
                                                    fontFamily: 'inherit',
                                                }}
                                            >
                                                {categorias.map((c) => (
                                                    <option key={c} value={c}>
                                                        {c}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                    ) : null}
                                </div>
                            </div>
                        ))}
                        {nuevosFiltrados.length > visibles ? (
                            <div style={{ padding: '12px 16px' }}>
                                <button type="button" data-ilp-ver-mas style={botonSecundario} onClick={() => setVisibles((v) => v + POR_TANDA)}>
                                    Ver más ({(nuevosFiltrados.length - visibles).toLocaleString('es')} restantes)
                                </button>
                            </div>
                        ) : null}
                    </Grupo>
                </>
            ) : null}

            {resultado ? (
                <section data-ilp-resultado style={{ ...caja, borderColor: resultado.errores.length ? `${ROJO}66` : `${VERDE}66` }}>
                    <h2 style={{ color: 'white', fontSize: '16px', fontWeight: 800, margin: '0 0 6px' }}>Listo</h2>
                    <p style={{ color: 'white', fontSize: '14px', margin: 0, lineHeight: 1.5 }}>
                        {resultado.actualizados} producto{resultado.actualizados === 1 ? '' : 's'} actualizado
                        {resultado.actualizados === 1 ? '' : 's'}, {resultado.creados} agregado{resultado.creados === 1 ? '' : 's'}
                        {resultado.fotos > 0 ? `, ${resultado.fotos} con foto nueva` : ''}.
                    </p>
                    {resultado.errores.length > 0 ? (
                        <div data-ilp-errores style={{ marginTop: '10px' }}>
                            <p style={{ color: ROJO, fontSize: '13px', fontWeight: 700, margin: '0 0 4px' }}>
                                {resultado.errores.length} no se pudo:
                            </p>
                            <ul style={{ color: ROJO, fontSize: '12px', margin: 0, paddingLeft: '18px', lineHeight: 1.5 }}>
                                {resultado.errores.slice(0, 20).map((t, i) => (
                                    <li key={i}>{t}</li>
                                ))}
                            </ul>
                        </div>
                    ) : null}
                </section>
            ) : null}

            {plan ? (
                <div
                    style={{
                        position: 'sticky',
                        bottom: '12px',
                        zIndex: 60,
                        background: 'rgba(20,20,22,0.92)',
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: '16px',
                        padding: '12px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        flexWrap: 'wrap',
                    }}
                >
                    <div data-ilp-resumen style={{ flex: 1, minWidth: '180px', color: 'white', fontSize: '13px', lineHeight: 1.4 }}>
                        {progreso ? (
                            <span data-ilp-progreso>
                                Guardando {progreso.hechos} de {progreso.total}…
                            </span>
                        ) : totalCambios === 0 ? (
                            <span style={{ color: TENUE }}>Nada marcado todavía.</span>
                        ) : (
                            <span>
                                <strong>{aActualizar.length}</strong> por actualizar · <strong>{aCrear.length}</strong> por agregar
                            </span>
                        )}
                    </div>
                    {confirmar && !progreso ? (
                        <>
                            <button type="button" style={botonSecundario} onClick={() => setConfirmar(false)}>
                                Cancelar
                            </button>
                            <button
                                type="button"
                                data-ilp-confirmar
                                onClick={() => void aplicar()}
                                style={{ ...botonSecundario, background: VERDE, color: '#04210d', border: 'none', padding: '10px 16px' }}
                            >
                                Sí, guardar {totalCambios}
                            </button>
                        </>
                    ) : (
                        <button
                            type="button"
                            data-ilp-aplicar
                            disabled={totalCambios === 0 || Boolean(progreso)}
                            onClick={() => setConfirmar(true)}
                            style={{
                                ...botonSecundario,
                                background: totalCambios === 0 || progreso ? 'rgba(255,255,255,0.08)' : NARANJA,
                                color: totalCambios === 0 || progreso ? TENUE : 'white',
                                border: 'none',
                                padding: '10px 16px',
                                cursor: totalCambios === 0 || progreso ? 'not-allowed' : 'pointer',
                            }}
                        >
                            Aplicar {totalCambios > 0 ? totalCambios : ''}
                        </button>
                    )}
                </div>
            ) : null}
        </div>
    );
}
