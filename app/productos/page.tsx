'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Package } from 'lucide-react';
import ModuloPageTitle from '@/components/ui/ModuloPageTitle';
import BotonTema from '@/components/tema/BotonTema';
import { createClient } from '@/lib/supabase/client';
import { coloresCategoria, etiquetaCategoria, subcategoriasDe } from '@/lib/productos/categoriasCatalogo';
import { useCategoriasCatalogo } from '@/lib/productos/useCategoriasCatalogo';
import { tinta, tintaTexto, tonoTexto } from '@/lib/tema/tinta';
import {
    REVISIONES_CATALOGO,
    avisoEliminarProducto,
    contarPorCorregir,
    filtrarPorCorregir,
    terminoBusquedaCatalogo,
    usoDeProducto,
    type RevisionCatalogo,
} from '@/lib/productos/revisionCatalogo';

interface Product {
    id: number;
    nombre: string;
    categoria: string | null;
    subcategoria?: string | null;
    modelo: string | null;
    marca: string | null;
    descripcion: string | null;
    costo: number | null;
    precio: number | null;
    utilidad: number | null;
    cantidad: number | null;
    imagen: string | null;
    ubicacion?: string | null;
    manual_instrucciones?: string | null;
    manual_documento_url?: string | null;
    /** Lo que dice la última lista del proveedor importada. */
    disponibilidad_proveedor?: string | null;
}

/** Aviso corto cuando el proveedor no lo tiene (o viene en camino). */
function avisoProveedor(p: Product): { texto: string; color: string } | null {
    if (p.disponibilidad_proveedor === 'no_disponible') return { texto: 'Proveedor: no disponible', color: 'var(--tono-coral)' };
    if (p.disponibilidad_proveedor === 'en_transito') return { texto: 'Proveedor: en tránsito', color: 'var(--tono-amarillo)' };
    return null;
}

const PAGE_SIZE = 500;

function fmt(n: number | null) {
    if (n == null) return '—';
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Miniatura en catálogo: foto del producto si hay URL válida; si no, identidad por categoría/iniciales. */
function ProductAvatar({ product }: { product: Product }) {
    const cat = product.categoria ?? '';
    const color = coloresCategoria(cat).dot;
    const initials = (product.nombre || '??').slice(0, 2).toUpperCase();
    const [imgFailed, setImgFailed] = useState(false);
    const src = product.imagen?.trim();

    if (src && !imgFailed) {
        return (
            <div
                style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '14px',
                    flexShrink: 0,
                    overflow: 'hidden',
                    border: `1.5px solid ${color}44`,
                    background: 'rgba(0,0,0,0.35)',
                }}
            >
                <img
                    src={src}
                    alt=""
                    loading="lazy"
                    onError={() => setImgFailed(true)}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
            </div>
        );
    }

    return (
        <div style={{
            width: '56px', height: '56px', borderRadius: '14px', flexShrink: 0,
            background: `${color}22`, border: `1.5px solid ${color}44`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: '2px',
        }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: color, opacity: 0.8 }} />
            <span style={{ fontSize: '10px', fontWeight: 700, color: tonoTexto(color), letterSpacing: '0.5px' }}>{initials}</span>
        </div>
    );
}

interface CartItem { product: Product; qty: number; }

function ProductRow({
    product, onTap, onAddToCart, onDelete, inCart,
}: {
    product: Product;
    onTap: () => void;
    onAddToCart: (p: Product) => void;
    onDelete: (id: number) => void;
    inCart: boolean;
}) {
    const cat = product.categoria ?? '';
    const colors = coloresCategoria(cat);
    const [confirmDel, setConfirmDel] = useState(false);
    const aviso = avisoProveedor(product);

    const handleDelete = () => {
        if (confirmDel) { onDelete(product.id); }
        else { setConfirmDel(true); setTimeout(() => setConfirmDel(false), 3000); }
    };

    return (
        <div style={{
            borderBottom: `1px solid ${tinta(0.05)}`,
            background: 'transparent',
        }}>
            {/* ── Info row (clickable) ── */}
            <button
                onClick={onTap}
                style={{
                    width: '100%', padding: '16px', display: 'flex', gap: '12px',
                    textAlign: 'left', background: 'transparent', border: 'none',
                    cursor: 'pointer', fontFamily: 'inherit',
                    alignItems: 'flex-start',
                    boxSizing: 'border-box',
                }}
            >
                <ProductAvatar product={product} />

                <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            justifyContent: 'space-between',
                            gap: '10px',
                            marginBottom: '4px',
                        }}
                    >
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', minWidth: 0, flex: 1 }}>
                            <span style={{
                                fontSize: '10px', fontWeight: 800, padding: '2px 8px',
                                borderRadius: '6px', background: colors.bg, color: tonoTexto(colors.text),
                                textTransform: 'uppercase', letterSpacing: '0.5px'
                            }}>
                                {etiquetaCategoria(cat, product.subcategoria)}
                            </span>
                            {product.marca && (
                                <span style={{ fontSize: '10px', fontWeight: 700, color: tintaTexto(0.3), textTransform: 'uppercase' }}>
                                    {product.marca}
                                </span>
                            )}
                            {aviso && (
                                <span
                                    data-producto-proveedor={product.disponibilidad_proveedor}
                                    style={{
                                        fontSize: '10px', fontWeight: 800, padding: '2px 8px', borderRadius: '6px',
                                        background: `${aviso.color}22`, color: tonoTexto(aviso.color),
                                    }}
                                >
                                    {aviso.texto}
                                </span>
                            )}
                        </div>
                        <div
                            style={{
                                color: 'var(--tono-verde)',
                                fontSize: '17px',
                                fontWeight: 800,
                                lineHeight: 1.15,
                                flexShrink: 0,
                                textAlign: 'right',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            ${fmt(product.precio)}
                        </div>
                    </div>

                    <h3
                        style={{
                            color: 'var(--label-primary)',
                            fontSize: '16px',
                            fontWeight: 700,
                            lineHeight: 1.25,
                            margin: '0 0 2px 0',
                            textAlign: 'justify',
                            textAlignLast: 'left',
                            hyphens: 'auto',
                            width: '100%',
                            maxWidth: '100%',
                            boxSizing: 'border-box',
                            overflowWrap: 'anywhere',
                            wordBreak: 'break-word',
                        }}
                    >
                        {product.nombre}
                    </h3>
                    <p style={{ color: tintaTexto(0.4), fontSize: '13px', margin: 0 }}>
                        {product.modelo || 'Sin modelo'}
                    </p>
                </div>
            </button>

            {/* ── Action bar ── */}
            <div style={{ display: 'flex', borderTop: `1px solid ${tinta(0.04)}`, margin: '0 16px', marginBottom: '2px' }}>
                <button
                    onClick={() => onAddToCart(product)}
                    style={{
                        flex: 2, padding: '8px 0',
                        background: inCart ? 'rgba(52,199,89,0.12)' : 'transparent',
                        border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                        color: inCart ? 'var(--tono-verde)' : tintaTexto(0.4),
                        fontSize: '11px', fontWeight: 600,
                        borderRight: `1px solid ${tinta(0.05)}`,
                        transition: 'all 0.15s',
                    }}
                >
                    {inCart ? 'En presupuesto ✓' : 'Al presupuesto'}
                </button>

                <Link
                    href={`/productos/${product.id}/editar`}
                    style={{
                        flex: 1, padding: '8px 0',
                        background: 'transparent',
                        borderRight: `1px solid ${tinta(0.05)}`,
                        textDecoration: 'none',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                        color: 'var(--tono-naranja)', fontSize: '11px', fontWeight: 600,
                    }}
                >
                    Editar
                </Link>

                <button
                    onClick={handleDelete}
                    style={{
                        flex: 1, padding: '8px 0',
                        background: confirmDel ? 'rgba(255,59,48,0.10)' : 'transparent',
                        border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                        color: 'var(--tono-rojo)', fontSize: '11px', fontWeight: 600,
                    }}
                >
                    {confirmDel ? '¿Seguro?' : 'Eliminar'}
                </button>
            </div>
        </div>
    );
}

function ProductDetail({ product, onClose }: { product: Product; onClose: () => void }) {
    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'flex-end',
        }} onClick={onClose}>
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    width: '100%', maxWidth: '600px', margin: '0 auto',
                    background: 'var(--bg-secondary)', borderRadius: '32px 32px 0 0',
                    padding: '30px 24px 50px',
                    boxShadow: 'var(--sombra-hoja)',
                    maxHeight: '90vh',
                    overflowY: 'auto',
                }}
            >
                <div style={{ width: '40px', height: '4px', background: tinta(0.2), borderRadius: '2px', margin: '0 auto 20px' }} />
                {product.imagen ? (
                    <img
                        src={product.imagen}
                        alt=""
                        style={{
                            width: '100%',
                            maxHeight: '200px',
                            objectFit: 'contain',
                            borderRadius: '16px',
                            marginBottom: '16px',
                            background: 'rgba(0,0,0,0.4)',
                        }}
                    />
                ) : null}
                <h2 style={{ color: 'var(--label-primary)', fontSize: '24px', fontWeight: 800, marginBottom: '8px' }}>{product.nombre}</h2>
                <p style={{ color: tintaTexto(0.5), fontSize: '15px', marginBottom: '24px', whiteSpace: 'pre-wrap' }}>{product.descripcion || 'Sin descripción.'}</p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                    <div style={{ background: tinta(0.05), padding: '16px', borderRadius: '16px' }}>
                        <p style={{ color: tintaTexto(0.3), fontSize: '11px', fontWeight: 700 }}>PRECIO VENTA</p>
                        <p style={{ color: 'var(--tono-verde)', fontSize: '24px', fontWeight: 800, marginTop: '4px' }}>${fmt(product.precio)}</p>
                    </div>
                </div>

                {(product.manual_instrucciones || product.manual_documento_url) ? (
                    <div style={{ borderTop: `1px solid ${tinta(0.08)}`, paddingTop: '20px' }}>
                        <p style={{ color: tintaTexto(0.45), fontSize: '11px', fontWeight: 700, marginBottom: '10px' }}>MANUAL E INSTRUCCIONES</p>
                        {product.manual_documento_url ? (
                            <a
                                href={product.manual_documento_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                    display: 'inline-block',
                                    marginBottom: '12px',
                                    padding: '10px 16px',
                                    borderRadius: '12px',
                                    background: 'rgba(0,122,255,0.2)',
                                    color: 'var(--tono-celeste)',
                                    fontSize: '14px',
                                    fontWeight: 700,
                                    textDecoration: 'none',
                                }}
                            >
                                📄 Abrir manual (PDF)
                            </a>
                        ) : null}
                        {product.manual_instrucciones ? (
                            <p style={{ color: tintaTexto(0.65), fontSize: '13px', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                                {product.manual_instrucciones}
                            </p>
                        ) : null}
                    </div>
                ) : null}
            </div>
        </div>
    );
}

export default function ProductosPage() {
    const supabase = useMemo(() => createClient(), []);
    const router = useRouter();
    const { nombres: categoriasNombres, subcategorias: subcategoriasPorCategoria, crear: crearCategoria, crearSub: crearSubcategoria } = useCategoriasCatalogo();
    const categorias = useMemo(() => ['Todas', ...categoriasNombres], [categoriasNombres]);
    const [products, setProducts] = useState<Product[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [categoria, setCategoriaElegida] = useState('Todas');
    /** Subcategoría dentro de la categoría elegida ('' = todas). */
    const [subcategoria, setSubcategoria] = useState('');
    /** Qué se está creando con el formulario de abajo: una categoría o una subcategoría. */
    const [creandoQue, setCreandoQue] = useState<'categoria' | 'subcategoria'>('categoria');
    const setCategoria = useCallback((c: string) => {
        setCategoriaElegida(c);
        setSubcategoria('');
    }, []);
    const subcategoriasVisibles = useMemo(
        () => (categoria === 'Todas' ? [] : subcategoriasDe({ subcategorias: subcategoriasPorCategoria }, categoria)),
        [categoria, subcategoriasPorCategoria],
    );
    const [selected, setSelected] = useState<Product | null>(null);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [creandoCategoria, setCreandoCategoria] = useState(false);
    const [nombreNuevaCategoria, setNombreNuevaCategoria] = useState('');
    const [guardandoCategoria, setGuardandoCategoria] = useState(false);
    const [errorCategoria, setErrorCategoria] = useState<string | null>(null);
    const [errorCarga, setErrorCarga] = useState<string | null>(null);
    /** Filtro «por corregir»: fichas sin precio, sin categoría o con el nombre repetido. */
    const [revision, setRevision] = useState<RevisionCatalogo | ''>('');

    useEffect(() => {
        try {
            const saved = localStorage.getItem('cart_ventas');
            const parsed: unknown = saved ? JSON.parse(saved) : null;
            if (Array.isArray(parsed)) setCart(parsed as CartItem[]);
        } catch {
            // Carrito guardado ilegible o navegador sin almacenamiento: se empieza vacío.
        }
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem('cart_ventas', JSON.stringify(cart));
        } catch {
            // Sin almacenamiento: el carrito vale mientras la página siga abierta.
        }
    }, [cart]);

    const addToCart = useCallback((product: Product) => {
        setCart(prev => {
            if (prev.some(i => i.product.id === product.id)) {
                return prev.filter(i => i.product.id !== product.id);
            }
            return [...prev, { product, qty: 1 }];
        });
    }, []);

    const deleteProduct = useCallback(async (id: number) => {
        const nombre = products.find((p) => p.id === id)?.nombre ?? 'Este producto';
        // Si está en presupuestos o enlazado a almacén, se avisa antes de eliminar.
        const { uso, error: errUso } = await usoDeProducto(supabase, id);
        if (errUso) {
            alert('No se pudo comprobar dónde se usa este producto. No se eliminó. ' + errUso);
            return;
        }
        const aviso = avisoEliminarProducto(nombre, uso);
        if (aviso && !window.confirm(aviso)) return;

        const { error } = await supabase.from('products').delete().eq('id', id);
        if (error) {
            alert('No se pudo eliminar: ' + error.message);
            return;
        }
        setProducts(prev => prev.filter(p => p.id !== id));
        setTotal(t => t - 1);
        setCart(prev => prev.filter(i => i.product.id !== id));
    }, [supabase, products]);

    const guardarNuevaCategoria = useCallback(async () => {
        setGuardandoCategoria(true);
        setErrorCategoria(null);
        try {
            if (creandoQue === 'subcategoria' && categoria !== 'Todas') {
                const creada = await crearSubcategoria(categoria, nombreNuevaCategoria);
                setSubcategoria(creada);
            } else {
                const creada = await crearCategoria(nombreNuevaCategoria);
                setCategoria(creada);
            }
            setCreandoCategoria(false);
            setNombreNuevaCategoria('');
        } catch (err) {
            setErrorCategoria(err instanceof Error ? err.message : 'No se pudo crear');
        } finally {
            setGuardandoCategoria(false);
        }
    }, [crearCategoria, crearSubcategoria, creandoQue, categoria, setCategoria, nombreNuevaCategoria]);

    const fetchProducts = useCallback(async () => {
        setLoading(true);
        const q = terminoBusquedaCatalogo(search);
        const collected: Product[] = [];
        let from = 0;
        let totalCount = 0;
        let failed = false;

        while (from < 20_000) {
            let query = supabase
                .from('products')
                .select('*', { count: 'exact' })
                .order('nombre')
                .range(from, from + PAGE_SIZE - 1);

            if (q.length >= 2) {
                query = query.or(`nombre.ilike.%${q}%,marca.ilike.%${q}%,modelo.ilike.%${q}%`);
            }
            if (categoria !== 'Todas') {
                query = query.eq('categoria', categoria);
                if (subcategoria) query = query.eq('subcategoria', subcategoria);
            }

            const { data, error, count } = await query;
            if (error) {
                failed = true;
                break;
            }
            totalCount = count ?? totalCount;
            collected.push(...((data ?? []) as Product[]));
            if (!data || data.length < PAGE_SIZE) break;
            from += PAGE_SIZE;
        }

        if (!failed) {
            setProducts(collected);
            setTotal(totalCount || collected.length);
            setErrorCarga(null);
        } else {
            setErrorCarga('No se pudo cargar el catálogo. Revisa la conexión e intenta de nuevo.');
        }
        setLoading(false);
    }, [search, categoria, subcategoria, supabase]);

    /** Los conteos «por corregir» solo tienen sentido con el catálogo completo a la vista. */
    const catalogoCompleto = categoria === 'Todas' && terminoBusquedaCatalogo(search).length < 2;
    const porCorregir = useMemo(() => contarPorCorregir(products), [products]);
    const hayPorCorregir = porCorregir.sin_precio + porCorregir.sin_categoria + porCorregir.repetidos > 0;
    const visibles = useMemo(
        () => (revision && catalogoCompleto ? filtrarPorCorregir(products, revision) : products),
        [products, revision, catalogoCompleto],
    );

    useEffect(() => {
        if (!catalogoCompleto && revision) setRevision('');
    }, [catalogoCompleto, revision]);

    useEffect(() => {
        const t = setTimeout(fetchProducts, search ? 350 : 0);
        return () => clearTimeout(t);
    }, [fetchProducts, search]);

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', paddingBottom: '120px' }}>
            <div style={{
                position: 'sticky', top: 0, zIndex: 100,
                background: 'var(--barra-fondo)', backdropFilter: 'blur(20px)',
                padding: '16px 20px', borderBottom: `1px solid ${tinta(0.1)}`,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px'
            }}>
                <ModuloPageTitle
                    title="Catálogo"
                    icon={Package}
                    iconClassName="text-orange-400"
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <BotonTema compacto />
                    {cart.length > 0 ? (
                        <button
                            type="button"
                            onClick={() =>
                                router.push(`/ventas?productos=${cart.map((i) => i.product.id).join(',')}`)
                            }
                            style={{
                                background: '#34C759',
                                color: 'white',
                                border: 'none',
                                borderRadius: '12px',
                                padding: '10px 14px',
                                fontWeight: 700,
                                fontSize: '13px',
                                cursor: 'pointer',
                                boxShadow: '0 4px 12px rgba(52,199,89,0.3)',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            🛒 Presupuesto ({cart.length})
                        </button>
                    ) : null}
                    <Link href="/productos/nuevo">
                        <button
                            type="button"
                            style={{
                                background: '#FF9500',
                                color: 'white',
                                border: 'none',
                                borderRadius: '12px',
                                padding: '10px 16px',
                                fontWeight: 700,
                                fontSize: '13px',
                                cursor: 'pointer',
                                boxShadow: '0 4px 12px rgba(255,149,0,0.3)',
                            }}
                        >
                            + Nuevo
                        </button>
                    </Link>
                </div>
            </div>

            <div style={{ padding: '20px' }}>
                <input
                    type="text"
                    placeholder="Buscar producto o material..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{
                        width: '100%', marginBottom: '10px',
                        background: tinta(0.05), border: `1px solid ${tinta(0.1)}`,
                        borderRadius: '12px', padding: '12px 16px', color: 'var(--label-primary)', outline: 'none'
                    }}
                />

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 18px', marginBottom: '14px' }}>
                    <Link
                        href="/productos/importar-lista"
                        data-productos-importar-lista
                        style={{
                            color: 'var(--tono-naranja)', fontSize: '13px', fontWeight: 700, textDecoration: 'none',
                        }}
                    >
                        Importar lista de precios del proveedor (PDF o CSV) →
                    </Link>
                </div>

                <div style={{ marginBottom: '12px' }}>
                    <div
                        style={{
                            display: 'flex',
                            gap: '8px',
                            alignItems: 'center',
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                gap: '8px',
                                overflowX: 'auto',
                                WebkitOverflowScrolling: 'touch',
                                scrollbarWidth: 'thin',
                                alignItems: 'center',
                                flex: 1,
                                minWidth: 0,
                                paddingBottom: '2px',
                            }}
                        >
                            {categorias.map((c) => (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => setCategoria(c)}
                                    style={{
                                        background: categoria === c ? 'rgba(255,149,0,0.15)' : 'transparent',
                                        color: categoria === c ? 'var(--tono-naranja)' : tintaTexto(0.4),
                                        border: 'none',
                                        borderRadius: '10px',
                                        padding: '6px 14px',
                                        fontSize: '13px',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap',
                                        flexShrink: 0,
                                    }}
                                >
                                    {c}
                                </button>
                            ))}
                        </div>
                        <button
                            type="button"
                            aria-label="Crear categoría"
                            onClick={() => {
                                setCreandoCategoria((v) => (creandoQue === 'categoria' ? !v : true));
                                setCreandoQue('categoria');
                                setErrorCategoria(null);
                            }}
                            style={{
                                background: creandoCategoria && creandoQue === 'categoria' ? 'rgba(255,149,0,0.15)' : 'transparent',
                                color: 'var(--tono-naranja)',
                                border: '1px dashed rgba(255,149,0,0.45)',
                                borderRadius: '10px',
                                padding: '6px 12px',
                                fontSize: '13px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                flexShrink: 0,
                                fontFamily: 'inherit',
                            }}
                        >
                            + Categoría
                        </button>
                    </div>
                    {categoria !== 'Todas' ? (
                        <div
                            data-subcategorias
                            style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '8px' }}
                        >
                            <div
                                style={{
                                    display: 'flex',
                                    gap: '6px',
                                    overflowX: 'auto',
                                    WebkitOverflowScrolling: 'touch',
                                    scrollbarWidth: 'thin',
                                    alignItems: 'center',
                                    flex: 1,
                                    minWidth: 0,
                                    paddingBottom: '2px',
                                }}
                            >
                                {subcategoriasVisibles.length > 0 ? (
                                    ['', ...subcategoriasVisibles].map((sub) => {
                                        const activa = subcategoria === sub;
                                        return (
                                            <button
                                                key={sub || '__todas__'}
                                                type="button"
                                                onClick={() => setSubcategoria(sub)}
                                                style={{
                                                    background: activa ? 'rgba(0,122,255,0.14)' : tinta(0.05),
                                                    color: activa ? 'var(--tono-azul)' : tintaTexto(0.5),
                                                    border: 'none',
                                                    borderRadius: '999px',
                                                    padding: '5px 12px',
                                                    fontSize: '12px',
                                                    fontWeight: 700,
                                                    cursor: 'pointer',
                                                    whiteSpace: 'nowrap',
                                                    flexShrink: 0,
                                                    fontFamily: 'inherit',
                                                }}
                                            >
                                                {sub || `Todo ${categoria}`}
                                            </button>
                                        );
                                    })
                                ) : (
                                    <span style={{ fontSize: '12px', color: tintaTexto(0.4), fontWeight: 600 }}>
                                        {categoria} no tiene subcategorías.
                                    </span>
                                )}
                            </div>
                            <button
                                type="button"
                                aria-label={`Crear subcategoría en ${categoria}`}
                                onClick={() => {
                                    setCreandoCategoria((v) => (creandoQue === 'subcategoria' ? !v : true));
                                    setCreandoQue('subcategoria');
                                    setErrorCategoria(null);
                                }}
                                style={{
                                    background: creandoCategoria && creandoQue === 'subcategoria' ? 'rgba(0,122,255,0.14)' : 'transparent',
                                    color: 'var(--tono-azul)',
                                    border: '1px dashed rgba(0,122,255,0.45)',
                                    borderRadius: '999px',
                                    padding: '5px 12px',
                                    fontSize: '12px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                    flexShrink: 0,
                                    fontFamily: 'inherit',
                                }}
                            >
                                + Subcategoría
                            </button>
                        </div>
                    ) : null}
                    {creandoCategoria ? (
                        <div
                            style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                alignItems: 'center',
                                gap: '8px',
                                marginTop: '10px',
                            }}
                        >
                            <input
                                type="text"
                                value={nombreNuevaCategoria}
                                onChange={(e) => setNombreNuevaCategoria(e.target.value)}
                                placeholder={
                                    creandoQue === 'subcategoria' && categoria !== 'Todas'
                                        ? 'Nueva subcategoría'
                                        : 'Nombre de la nueva categoría'
                                }
                                autoFocus
                                disabled={guardandoCategoria}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        void guardarNuevaCategoria();
                                    }
                                    if (e.key === 'Escape') {
                                        setCreandoCategoria(false);
                                        setErrorCategoria(null);
                                    }
                                }}
                                style={{
                                    flex: 1,
                                    minWidth: '160px',
                                    background: tinta(0.08),
                                    border: '1px solid rgba(255,149,0,0.45)',
                                    borderRadius: '10px',
                                    padding: '10px 12px',
                                    color: 'var(--label-primary)',
                                    outline: 'none',
                                    fontSize: '14px',
                                    fontFamily: 'inherit',
                                }}
                            />
                            <button
                                type="button"
                                disabled={guardandoCategoria}
                                onClick={() => void guardarNuevaCategoria()}
                                style={{
                                    background: 'rgba(52,199,89,0.18)',
                                    color: 'var(--tono-verde)',
                                    border: 'none',
                                    borderRadius: '10px',
                                    padding: '10px 14px',
                                    fontSize: '13px',
                                    fontWeight: 700,
                                    cursor: guardandoCategoria ? 'not-allowed' : 'pointer',
                                    whiteSpace: 'nowrap',
                                    fontFamily: 'inherit',
                                }}
                            >
                                {guardandoCategoria ? 'Creando…' : 'Crear'}
                            </button>
                            <button
                                type="button"
                                disabled={guardandoCategoria}
                                onClick={() => {
                                    setCreandoCategoria(false);
                                    setErrorCategoria(null);
                                    setNombreNuevaCategoria('');
                                }}
                                style={{
                                    background: 'transparent',
                                    color: tintaTexto(0.45),
                                    border: `1px solid ${tinta(0.12)}`,
                                    borderRadius: '10px',
                                    padding: '10px 14px',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    fontFamily: 'inherit',
                                }}
                            >
                                Cancelar
                            </button>
                        </div>
                    ) : null}
                    {errorCategoria ? (
                        <p style={{ margin: '8px 0 0', fontSize: '12px', color: 'var(--tono-coral)', fontWeight: 600 }}>
                            {errorCategoria}
                        </p>
                    ) : null}
                </div>

                {!loading && catalogoCompleto && (hayPorCorregir || revision) ? (
                    <div
                        style={{
                            display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px',
                            marginBottom: '12px',
                        }}
                    >
                        <span style={{ fontSize: '12px', fontWeight: 700, color: tintaTexto(0.45) }}>
                            Por corregir:
                        </span>
                        {REVISIONES_CATALOGO.filter((r) => porCorregir[r.id] > 0 || revision === r.id).map((r) => {
                            const activa = revision === r.id;
                            return (
                                <button
                                    key={r.id}
                                    type="button"
                                    onClick={() => setRevision(activa ? '' : r.id)}
                                    style={{
                                        background: activa ? 'rgba(255,59,48,0.18)' : tinta(0.05),
                                        color: activa ? 'var(--tono-rojo)' : tintaTexto(0.6),
                                        border: activa ? '1px solid rgba(255,59,48,0.45)' : `1px solid ${tinta(0.12)}`,
                                        borderRadius: '10px',
                                        padding: '5px 11px',
                                        fontSize: '12px',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap',
                                        fontFamily: 'inherit',
                                    }}
                                >
                                    {r.etiqueta} ({porCorregir[r.id]})
                                </button>
                            );
                        })}
                    </div>
                ) : null}

                {errorCarga ? (
                    <p style={{ margin: '0 0 12px', fontSize: '13px', color: 'var(--tono-rojo)', fontWeight: 600 }}>
                        {errorCarga}
                    </p>
                ) : null}

                {!loading && total > 0 ? (
                    <p style={{ margin: '0 0 12px', fontSize: '12px', color: tintaTexto(0.35), fontWeight: 600 }}>
                        {revision && catalogoCompleto
                            ? `${visibles.length} por corregir de ${total}`
                            : products.length === total
                              ? `${total} producto${total === 1 ? '' : 's'}`
                              : `Mostrando ${products.length} de ${total}`}
                    </p>
                ) : null}

                <div style={{ background: tinta(0.03), borderRadius: '20px', overflow: 'hidden' }}>
                    {loading ? (
                        <div style={{ padding: '60px', textAlign: 'center', color: tintaTexto(0.3) }}>Cargando catálogo...</div>
                    ) : visibles.length === 0 ? (
                        <div style={{ padding: '60px', textAlign: 'center', color: tintaTexto(0.2) }}>Sin resultados</div>
                    ) : (
                        visibles.map(p => (
                            <ProductRow
                                key={p.id}
                                product={p}
                                onTap={() => setSelected(p)}
                                onAddToCart={addToCart}
                                onDelete={deleteProduct}
                                inCart={cart.some(items => items.product.id === p.id)}
                            />
                        ))
                    )}
                </div>
            </div>

            {selected && <ProductDetail product={selected} onClose={() => setSelected(null)} />}
        </div>
    );
}
