'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { createClient } from '@/lib/supabase/client';
import accesoJson from '@/data/productos/acceso-alarma-septiembre-2026.json';
import siemonJson from '@/data/productos/siemon-agosto-2026.json';
import {
    payloadCatalogoDistribuidor,
    planearCargaCatalogo,
    type ItemCatalogoDistribuidor,
    type ProductoExistenteCatalogo,
} from '@/lib/productos/catalogoDistribuidor2026';

const NARANJA = '#FF9500';
const VERDE = '#34C759';
const ROJO = '#FF6B60';

const caja: CSSProperties = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '16px',
    padding: '16px',
};

const botonPrincipal: CSSProperties = {
    background: NARANJA,
    color: '#1a0b00',
    border: 'none',
    borderRadius: '12px',
    padding: '12px 16px',
    fontWeight: 800,
    fontSize: '14px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    width: '100%',
};

const botonSecundario: CSSProperties = {
    background: 'rgba(255,255,255,0.08)',
    color: 'white',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '12px',
    padding: '10px 16px',
    fontWeight: 700,
    fontSize: '13px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    width: '100%',
};

const EN_PARALELO = 8;

async function enParalelo<T>(lista: T[], limite: number, tarea: (item: T) => Promise<void>): Promise<void> {
    let siguiente = 0;
    const trabajadores: Promise<void>[] = [];
    const trabajar = async () => {
        while (siguiente < lista.length) {
            const item = lista[siguiente]!;
            siguiente += 1;
            await tarea(item);
        }
    };
    for (let k = 0; k < Math.min(limite, lista.length); k++) trabajadores.push(trabajar());
    await Promise.all(trabajadores);
}

type CatalogoId = 'acceso' | 'siemon';

const CATALOGOS: Record<
    CatalogoId,
    { titulo: string; fuente: string; items: ItemCatalogoDistribuidor[]; nota: string }
> = {
    acceso: {
        titulo: 'Acceso-Alarma septiembre 2026',
        fuente: accesoJson.fuente,
        items: accesoJson.productos as ItemCatalogoDistribuidor[],
        nota: 'Hikvision, Hikfire, Ubiquiti y Omegasat. Los 86 que ya cargaste se actualizan; el resto se crea. Ezviz no se toca.',
    },
    siemon: {
        titulo: 'Siemon agosto 2026',
        fuente: siemonJson.fuente,
        items: siemonJson.productos as ItemCatalogoDistribuidor[],
        nota: 'Ya quedó cargado por SQL. Solo úsalo si quieres volver a sincronizar. No duplica SKU.',
    },
};

type Resultado = { actualizados: number; creados: number; errores: string[] };

export default function CargarCatalogosDistribuidor2026() {
    const supabase = useMemo(() => createClient(), []);
    const [existentes, setExistentes] = useState<ProductoExistenteCatalogo[] | null>(null);
    const [errorProductos, setErrorProductos] = useState<string | null>(null);
    const [catalogo, setCatalogo] = useState<CatalogoId>('acceso');
    const [progreso, setProgreso] = useState<{ hechos: number; total: number } | null>(null);
    const [resultado, setResultado] = useState<Resultado | null>(null);
    const [confirmar, setConfirmar] = useState(false);

    const cargarProductos = useCallback(async () => {
        setErrorProductos(null);
        const todos: ProductoExistenteCatalogo[] = [];
        let desde = 0;
        while (desde < 20000) {
            const { data, error } = await supabase
                .from('products')
                .select('id,marca,modelo')
                .order('id')
                .range(desde, desde + 999);
            if (error) {
                setErrorProductos(`No pude leer tus productos: ${error.message}`);
                return;
            }
            const lote = (data ?? []) as ProductoExistenteCatalogo[];
            todos.push(...lote);
            if (lote.length < 1000) break;
            desde += 1000;
        }
        setExistentes(todos);
    }, [supabase]);

    useEffect(() => {
        void cargarProductos();
    }, [cargarProductos]);

    const elegido = CATALOGOS[catalogo];
    const plan = useMemo(
        () => (existentes ? planearCargaCatalogo(elegido.items, existentes) : null),
        [elegido.items, existentes],
    );

    const aplicar = useCallback(async () => {
        if (!plan) return;
        setConfirmar(false);
        const total = plan.actualizar.length + plan.crear.length;
        if (total === 0) return;
        const res: Resultado = { actualizados: 0, creados: 0, errores: [] };
        let hechos = 0;
        setProgreso({ hechos, total });
        const avanzar = () => {
            hechos += 1;
            setProgreso({ hechos, total });
        };

        await enParalelo(plan.actualizar, EN_PARALELO, async ({ id, item }) => {
            const { data, error } = await supabase
                .from('products')
                .update(payloadCatalogoDistribuidor(item))
                .eq('id', id)
                .select('id');
            if (error) res.errores.push(`${item.modelo}: ${error.message}`);
            else if (!data || data.length === 0) {
                res.errores.push(`${item.modelo}: no se guardó. Revisa que tu sesión siga abierta.`);
            } else res.actualizados += 1;
            avanzar();
        });

        await enParalelo(plan.crear, EN_PARALELO, async (item) => {
            const { error } = await supabase.from('products').insert({
                ...payloadCatalogoDistribuidor(item),
                cantidad: 0,
            });
            if (error) res.errores.push(`${item.modelo}: ${error.message}`);
            else res.creados += 1;
            avanzar();
        });

        setProgreso(null);
        setResultado(res);
        await cargarProductos();
    }, [plan, supabase, cargarProductos]);

    return (
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div
                style={{
                    ...caja,
                    borderColor: 'rgba(255,107,96,0.35)',
                    background: 'rgba(255,107,96,0.08)',
                }}
            >
                <p style={{ fontSize: '14px', fontWeight: 800, color: ROJO, margin: 0 }}>
                    Cierra el SQL Editor. No pegues el error.
                </p>
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.75)', margin: '8px 0 0' }}>
                    El mensaje Failed to run sql query aparece cuando el editor ejecuta el texto del error
                    en vez de SQL. Aquí la carga es un clic, con tu sesión, sin duplicar SKU.
                </p>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
                <button
                    type="button"
                    data-catalogo-tab="acceso"
                    onClick={() => {
                        setCatalogo('acceso');
                        setResultado(null);
                        setConfirmar(false);
                    }}
                    style={{
                        ...botonSecundario,
                        background: catalogo === 'acceso' ? NARANJA : 'rgba(255,255,255,0.08)',
                        color: catalogo === 'acceso' ? '#1a0b00' : 'white',
                        border: catalogo === 'acceso' ? 'none' : '1px solid rgba(255,255,255,0.12)',
                    }}
                >
                    Acceso-Alarma
                </button>
                <button
                    type="button"
                    data-catalogo-tab="siemon"
                    onClick={() => {
                        setCatalogo('siemon');
                        setResultado(null);
                        setConfirmar(false);
                    }}
                    style={{
                        ...botonSecundario,
                        background: catalogo === 'siemon' ? NARANJA : 'rgba(255,255,255,0.08)',
                        color: catalogo === 'siemon' ? '#1a0b00' : 'white',
                        border: catalogo === 'siemon' ? 'none' : '1px solid rgba(255,255,255,0.12)',
                    }}
                >
                    Siemon
                </button>
            </div>

            <div style={caja}>
                <h2 style={{ fontSize: '16px', fontWeight: 800, color: 'white', margin: 0 }}>{elegido.titulo}</h2>
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.65)', margin: '8px 0 0' }}>{elegido.nota}</p>
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', margin: '10px 0 0' }}>
                    {elegido.items.length} SKU · costo = lista USD · precio = costo · utilidad = 0
                </p>
            </div>

            {errorProductos ? (
                <p data-catalogo-error style={{ color: ROJO, fontSize: '13px', margin: 0 }}>
                    {errorProductos}
                </p>
            ) : null}

            {plan ? (
                <div style={caja} data-catalogo-plan>
                    <p style={{ fontSize: '14px', fontWeight: 700, color: 'white', margin: 0 }}>
                        Crear {plan.crear.length} · actualizar {plan.actualizar.length}
                    </p>
                    <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)', margin: '6px 0 0' }}>
                        Si el número a crear es 0, esa lista ya está en Productos.
                    </p>
                </div>
            ) : (
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', margin: 0 }}>Leyendo catálogo…</p>
            )}

            {progreso ? (
                <p data-catalogo-progreso style={{ fontSize: '13px', color: NARANJA, margin: 0, fontWeight: 700 }}>
                    Guardando {progreso.hechos} de {progreso.total}…
                </p>
            ) : null}

            {resultado ? (
                <div style={caja} data-catalogo-resultado>
                    <p style={{ fontSize: '14px', fontWeight: 800, color: VERDE, margin: 0 }}>
                        Listo: {resultado.creados} creados, {resultado.actualizados} actualizados
                    </p>
                    {resultado.errores.length > 0 ? (
                        <ul style={{ margin: '8px 0 0', paddingLeft: '18px', color: ROJO, fontSize: '12px' }}>
                            {resultado.errores.slice(0, 8).map((e) => (
                                <li key={e}>{e}</li>
                            ))}
                        </ul>
                    ) : null}
                </div>
            ) : null}

            {confirmar ? (
                <div style={caja}>
                    <p style={{ fontSize: '13px', color: 'white', margin: '0 0 12px' }}>
                        ¿Cargar {elegido.titulo}? Precio de venta = costo de lista. No se aplica margen.
                    </p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button type="button" data-catalogo-confirmar onClick={() => void aplicar()} style={botonPrincipal}>
                            Sí, cargar ahora
                        </button>
                        <button type="button" onClick={() => setConfirmar(false)} style={botonSecundario}>
                            Cancelar
                        </button>
                    </div>
                </div>
            ) : (
                <button
                    type="button"
                    data-catalogo-cargar
                    disabled={!plan || Boolean(progreso) || (plan.crear.length + plan.actualizar.length === 0)}
                    onClick={() => setConfirmar(true)}
                    style={{
                        ...botonPrincipal,
                        opacity: !plan || progreso || (plan && plan.crear.length + plan.actualizar.length === 0) ? 0.45 : 1,
                    }}
                >
                    Cargar {elegido.titulo}
                </button>
            )}
        </div>
    );
}
