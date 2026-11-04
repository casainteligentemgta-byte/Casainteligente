'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { uploadProductImage, uploadProductManualPdf } from '@/lib/supabase/product-media';
import SelectorCategoriaProducto from '@/components/productos/SelectorCategoriaProducto';
import { proveedoresAdmitidos, revisarEnlaceProveedor } from '@/lib/productos/precioProveedorWeb';
import { tinta, tintaTexto } from '@/lib/tema/tinta';
import {
    MARGEN_CATALOGO_DEFECTO,
    margenPctDesdePrecios,
    precioVentaDesdeCosto,
    utilidadDesdePrecios,
} from '@/lib/productos/margenCatalogo';
import { payloadFotoProducto, urlFotoProducto } from '@/lib/productos/fotoProducto';
import { TABLA_PRODUCTOS } from '@/lib/productos/tablaProductos';
import { useCategoriasCatalogo } from '@/lib/productos/useCategoriasCatalogo';

export default function NuevoProductoForm({ initialData, isEditing }: { initialData?: any; isEditing?: boolean }) {
    const router = useRouter();
    const supabase = createClient();
    const fileGalleryRef = useRef<HTMLInputElement>(null);
    const fileCameraRef = useRef<HTMLInputElement>(null);
    const fileManualRef = useRef<HTMLInputElement>(null);

    const [saving, setSaving] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [uploadingManual, setUploadingManual] = useState(false);
    const [mediaError, setMediaError] = useState<string | null>(null);

    const { margenPorCategoria } = useCategoriasCatalogo();
    const margenInicial = (() => {
        const propio = Number(initialData?.margen_pct);
        if (Number.isFinite(propio) && initialData?.margen_pct != null) return String(propio);
        const dePrecios = margenPctDesdePrecios(initialData?.costo, initialData?.precio);
        if (dePrecios != null) return String(dePrecios);
        return String(MARGEN_CATALOGO_DEFECTO);
    })();
    const [form, setForm] = useState({
        nombre: initialData?.nombre || '',
        categoria: initialData?.categoria || '',
        subcategoria: (initialData?.subcategoria as string) || '',
        marca: initialData?.marca || '',
        modelo: initialData?.modelo || '',
        descripcion: initialData?.descripcion || '',
        costo: initialData?.costo?.toString() || '',
        margen: margenInicial,
        precio: initialData?.precio?.toString() || '',
        cantidad: initialData?.cantidad?.toString() || '',
        imagen: urlFotoProducto(initialData) || '',
        manual_instrucciones: (initialData?.manual_instrucciones as string) || '',
        manual_documento_url: (initialData?.manual_documento_url as string) || '',
        proveedor_url: (initialData?.proveedor_url as string) || '',
    });
    const [puedeCostos, setPuedeCostos] = useState(true);

    useEffect(() => {
        void fetch('/api/auth/permisos', { cache: 'no-store', credentials: 'include' })
            .then((r) => r.json())
            .then((d: { permisos?: string[] }) => {
                if (Array.isArray(d.permisos)) setPuedeCostos(d.permisos.includes('productos.costos'));
            })
            .catch(() => {
                /* sin catálogo de permisos: se muestra el costo (pantalla ya pide sesión) */
            });
    }, []);
    /** Precio leído de la web del proveedor con el botón «Leer precio». */
    const [precioWeb, setPrecioWeb] = useState<{ precio: number | null; error: string | null; leyendo: boolean }>({
        precio: null,
        error: null,
        leyendo: false,
    });
    const enlaceEscrito = form.proveedor_url.trim();
    const enlaceRevisado = enlaceEscrito ? revisarEnlaceProveedor(enlaceEscrito) : null;

    const leerPrecioWeb = async () => {
        if (!enlaceRevisado || !enlaceRevisado.ok) return;
        setPrecioWeb({ precio: null, error: null, leyendo: true });
        try {
            const res = await fetch('/api/productos/precio-proveedor', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ url: enlaceRevisado.url }),
            });
            const datos = (await res.json()) as { ok?: boolean; precio?: number; error?: string };
            if (datos.ok && typeof datos.precio === 'number') setPrecioWeb({ precio: datos.precio, error: null, leyendo: false });
            else setPrecioWeb({ precio: null, error: datos.error || 'No se pudo leer el precio.', leyendo: false });
        } catch {
            setPrecioWeb({ precio: null, error: 'No se pudo consultar. Revisa la conexión.', leyendo: false });
        }
    };

    /** Pone el precio de la web como costo y recalcula el precio de venta con el margen. */
    const usarPrecioWeb = () => {
        if (precioWeb.precio == null) return;
        const nuevo = String(precioWeb.precio);
        setForm((f) => {
            const margenN = parseMoney(f.margen) ?? MARGEN_CATALOGO_DEFECTO;
            return { ...f, costo: nuevo, precio: String(precioVentaDesdeCosto(precioWeb.precio!, margenN)) };
        });
    };

    const utilidad = form.costo && form.precio
        ? (utilidadDesdePrecios(parseMoney(form.costo), parseMoney(form.precio)) ?? '—')
        : '—';

    const margenPctMostrado = parseMoney(form.margen);

    const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

    const setCosto = (raw: string) => {
        setForm((f) => {
            const costoN = parseMoney(raw);
            const margenN = parseMoney(f.margen) ?? MARGEN_CATALOGO_DEFECTO;
            return {
                ...f,
                costo: raw,
                precio: costoN != null ? String(precioVentaDesdeCosto(costoN, margenN)) : f.precio,
            };
        });
    };

    const setMargen = (raw: string) => {
        setForm((f) => {
            const margenN = parseMoney(raw);
            const costoN = parseMoney(f.costo);
            return {
                ...f,
                margen: raw,
                precio:
                    costoN != null && margenN != null
                        ? String(precioVentaDesdeCosto(costoN, margenN))
                        : f.precio,
            };
        });
    };

    const setPrecio = (raw: string) => {
        setForm((f) => {
            const precioN = parseMoney(raw);
            const costoN = parseMoney(f.costo);
            const margen =
                costoN != null && costoN > 0 && precioN != null
                    ? String(margenPctDesdePrecios(costoN, precioN) ?? '')
                    : f.margen;
            return { ...f, precio: raw, margen };
        });
    };

    /** Evita que "12,50" se convierta en 12 con parseFloat (coma decimal). */
    function parseMoney(raw: string): number | null {
        const t = raw.trim().replace(/\s/g, '').replace(',', '.');
        if (t === '') return null;
        const n = parseFloat(t);
        return Number.isFinite(n) ? n : null;
    }

    async function onImageFile(file: File | null) {
        if (!file) return;
        setMediaError(null);
        setUploadingImage(true);
        const { url, error } = await uploadProductImage(supabase, file);
        setUploadingImage(false);
        if (error || !url) {
            const base =
                error ||
                'No se pudo subir la imagen. En Supabase → SQL Editor ejecuta supabase/sql_editor_storage_fotos_productos.sql (buckets product-media y productos).';
            setMediaError(
                [
                    base.startsWith('Fallo al subir') ? base : `Fallo al subir imagen: ${base}`,
                    'Puedes guardar o actualizar el producto sin foto y volver a editar más tarde para subir la imagen o pegar la URL.',
                ].join('\n\n'),
            );
            return;
        }
        set('imagen', url);
    }

    async function onManualFile(file: File | null) {
        if (!file) return;
        setMediaError(null);
        setUploadingManual(true);
        const { url, error } = await uploadProductManualPdf(supabase, file);
        setUploadingManual(false);
        if (error || !url) {
            setMediaError(
                [error || 'No se pudo subir el PDF.', 'Puedes guardar el producto sin PDF y añadirlo después al editar.'].join(
                    '\n\n',
                ),
            );
            return;
        }
        set('manual_documento_url', url);
    }

    const handleSave = async () => {
        if (!form.nombre.trim()) return alert('El nombre es obligatorio');
        if (enlaceRevisado && !enlaceRevisado.ok) return alert(`Enlace del proveedor: ${enlaceRevisado.motivo}`);
        setSaving(true);
        setMediaError(null);

        const costoN = parseMoney(form.costo);
        const precioN = parseMoney(form.precio);
        const margenN = parseMoney(form.margen);

        // imagen / manual: vacío → null en BD (producto válido sin URL; se puede completar después)
        const imagenVal = payloadFotoProducto(form.imagen).imagen;
        const productData: Record<string, string | number | null> = {
            nombre: form.nombre.trim(),
            categoria: form.categoria || null,
            // Sin categoría no hay subcategoría.
            subcategoria: form.categoria ? form.subcategoria || null : null,
            marca: form.marca || null,
            modelo: form.modelo || null,
            descripcion: form.descripcion || null,
            precio: precioN,
            cantidad: form.cantidad ? parseInt(form.cantidad, 10) : 0,
            imagen: imagenVal,
            manual_instrucciones: form.manual_instrucciones.trim() || null,
            manual_documento_url: form.manual_documento_url.trim() || null,
            proveedor_url: enlaceRevisado && enlaceRevisado.ok ? enlaceRevisado.url : null,
        };
        if (puedeCostos) {
            productData.costo = costoN;
            productData.utilidad = utilidadDesdePrecios(costoN, precioN);
            productData.margen_pct = margenN;
        }

        let error;
        if (isEditing && initialData?.id != null) {
            // `products.id` es bigint; unificar tipo para .eq (string desde URL vs number desde Supabase)
            const rowId =
                typeof initialData.id === 'string'
                    ? initialData.id
                    : String(initialData.id);
            const res = await supabase
                .from(TABLA_PRODUCTOS)
                .update(productData)
                .eq('id', rowId)
                .select('id');
            error = res.error;
            if (!error && (!res.data || res.data.length === 0)) {
                setSaving(false);
                alert(
                    'No se actualizó ninguna fila. Si usas sesión iniciada en Supabase, aplica la migración 017_products_rls_authenticated.sql (políticas para rol authenticated en products).',
                );
                return;
            }
        } else {
            const res = await supabase.from(TABLA_PRODUCTOS).insert([productData]);
            error = res.error;
        }

        setSaving(false);
        if (error) {
            alert('Error al guardar: ' + error.message);
            return;
        }

        router.push('/productos');
        router.refresh();
    };

    const inputStyle = {
        width: '100%',
        background: 'transparent',
        border: 'none',
        outline: 'none',
        color: 'var(--label-primary)',
        fontSize: '16px',
        fontFamily: 'inherit',
    } as React.CSSProperties;

    const fieldBox = {
        background: tinta(0.06),
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: `1px solid ${tinta(0.1)}`,
        borderRadius: '14px',
        padding: '14px 16px',
        marginBottom: '10px',
    } as React.CSSProperties;

    const labelStyle = {
        fontSize: '11px',
        fontWeight: 600,
        color: 'var(--label-secondary)',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.5px',
        display: 'block',
        marginBottom: '6px',
    };

    const btnSecondary = {
        padding: '10px 14px',
        borderRadius: '10px',
        border: `1px solid ${tinta(0.15)}`,
        background: tinta(0.06),
        color: 'var(--label-primary)',
        fontSize: '13px',
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: 'inherit',
    } as React.CSSProperties;

    return (
        <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
            <input
                ref={fileGalleryRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                    onImageFile(e.target.files?.[0] ?? null);
                    e.target.value = '';
                }}
            />
            <input
                ref={fileCameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: 'none' }}
                onChange={(e) => {
                    onImageFile(e.target.files?.[0] ?? null);
                    e.target.value = '';
                }}
            />
            <input
                ref={fileManualRef}
                type="file"
                accept="application/pdf,.pdf"
                style={{ display: 'none' }}
                onChange={(e) => {
                    onManualFile(e.target.files?.[0] ?? null);
                    e.target.value = '';
                }}
            />

            {mediaError && (
                <div
                    style={{
                        ...fieldBox,
                        border: '1px solid rgba(255,59,48,0.35)',
                        background: 'rgba(255,59,48,0.08)',
                        color: 'var(--tono-coral)',
                        fontSize: '13px',
                        lineHeight: 1.45,
                    }}
                >
                    {mediaError}
                </div>
            )}

            <div style={fieldBox}>
                <label style={labelStyle}>Nombre del Producto *</label>
                <input
                    type="text"
                    value={form.nombre}
                    onChange={(e) => set('nombre', e.target.value)}
                    placeholder="Ej: Cámara IP 4MP PoE..."
                    style={{ ...inputStyle, fontSize: '17px', fontWeight: 600 }}
                />
            </div>

            {/* Foto: galería o cámara (móvil) — opcional; guardar sin imagen y completar luego */}
            <div style={fieldBox}>
                <label style={labelStyle}>Foto del producto (opcional)</label>
                <p style={{ fontSize: '12px', color: 'var(--label-secondary)', marginBottom: '12px', lineHeight: 1.45 }}>
                    <strong style={{ color: 'var(--label-primary)' }}>No hace falta imagen para guardar.</strong> Puedes crear o
                    actualizar el producto solo con nombre y datos, y cuando tengas la foto (o Storage listo) vuelves a editar y
                    subes la imagen o pegas la URL.
                </p>
                <p style={{ fontSize: '12px', color: 'var(--label-secondary)', marginBottom: '12px', lineHeight: 1.45 }}>
                    Sube desde archivos o usa la cámara (en el móvil &quot;Cámara&quot; abre la trasera).
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', marginBottom: '12px' }}>
                    <button
                        type="button"
                        disabled={uploadingImage}
                        onClick={() => fileGalleryRef.current?.click()}
                        style={{ ...btnSecondary, opacity: uploadingImage ? 0.5 : 1 }}
                    >
                        {uploadingImage ? 'Subiendo…' : '📁 Elegir archivo'}
                    </button>
                    <button
                        type="button"
                        disabled={uploadingImage}
                        onClick={() => fileCameraRef.current?.click()}
                        style={{ ...btnSecondary, opacity: uploadingImage ? 0.5 : 1 }}
                    >
                        📷 Cámara
                    </button>
                    {form.imagen ? (
                        <button
                            type="button"
                            onClick={() => set('imagen', '')}
                            style={{ ...btnSecondary, borderColor: 'rgba(255,59,48,0.35)', color: 'var(--tono-coral)' }}
                        >
                            Quitar foto
                        </button>
                    ) : null}
                </div>
                {form.imagen ? (
                    <img
                        src={form.imagen}
                        alt="Vista previa"
                        style={{
                            width: '100%',
                            maxHeight: '220px',
                            objectFit: 'contain',
                            borderRadius: '12px',
                            background: 'rgba(0,0,0,0.35)',
                        }}
                    />
                ) : (
                    <div
                        style={{
                            padding: '28px',
                            textAlign: 'center',
                            borderRadius: '12px',
                            background: tinta(0.04),
                            color: tintaTexto(0.35),
                            fontSize: '13px',
                        }}
                    >
                        Sin imagen aún
                    </div>
                )}
                <label style={{ ...labelStyle, marginTop: '12px', marginBottom: '4px' }}>
                    O pegar URL de imagen (opcional; déjalo vacío si aún no tienes)
                </label>
                <input
                    type="text"
                    inputMode="url"
                    autoComplete="off"
                    value={form.imagen}
                    onChange={(e) => set('imagen', e.target.value)}
                    placeholder="https://… (vacío = sin foto por ahora)"
                    style={{ ...inputStyle, fontSize: '14px' }}
                />
            </div>

            <SelectorCategoriaProducto
                value={form.categoria}
                onChange={(nombre) =>
                    // Al cambiar de categoría, la subcategoría anterior ya no aplica.
                    // Si el margen sigue en el 20 % por defecto, se toma el de la categoría.
                    setForm((prev) => {
                        if (prev.categoria === nombre) return prev;
                        const deCat = margenPorCategoria[nombre];
                        const margenActual = parseMoney(prev.margen);
                        const usarDeCat =
                            deCat != null &&
                            (margenActual == null || Math.abs(margenActual - MARGEN_CATALOGO_DEFECTO) < 0.005);
                        const margen = usarDeCat ? String(deCat) : prev.margen;
                        const costoN = parseMoney(prev.costo);
                        const margenN = parseMoney(margen) ?? MARGEN_CATALOGO_DEFECTO;
                        return {
                            ...prev,
                            categoria: nombre,
                            subcategoria: '',
                            margen,
                            precio: costoN != null ? String(precioVentaDesdeCosto(costoN, margenN)) : prev.precio,
                        };
                    })
                }
                subcategoria={form.subcategoria}
                onSubcategoriaChange={(nombre) => set('subcategoria', nombre)}
                inputStyle={inputStyle}
                fieldBox={fieldBox}
                labelStyle={labelStyle}
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <div style={{ ...fieldBox, marginBottom: 0 }}>
                    <label style={labelStyle}>Marca</label>
                    <input
                        type="text"
                        value={form.marca}
                        onChange={(e) => set('marca', e.target.value)}
                        placeholder="HIKVISION..."
                        style={inputStyle}
                    />
                </div>
                <div style={{ ...fieldBox, marginBottom: 0 }}>
                    <label style={labelStyle}>Modelo</label>
                    <input
                        type="text"
                        value={form.modelo}
                        onChange={(e) => set('modelo', e.target.value)}
                        placeholder="DS-2CD..."
                        style={inputStyle}
                    />
                </div>
            </div>

            {puedeCostos ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                    <div style={{ ...fieldBox, marginBottom: 0 }}>
                        <label style={labelStyle}>Costo ($)</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ color: tintaTexto(0.3), fontSize: '16px' }}>$</span>
                            <input
                                type="number"
                                min={0}
                                step={0.01}
                                value={form.costo}
                                onChange={(e) => setCosto(e.target.value)}
                                placeholder="0.00"
                                style={{ ...inputStyle, color: 'var(--tono-rojo)' }}
                            />
                        </div>
                    </div>
                    <div style={{ ...fieldBox, marginBottom: 0 }}>
                        <label style={labelStyle}>Margen (%)</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <input
                                type="number"
                                min={0}
                                max={300}
                                step={0.1}
                                value={form.margen}
                                onChange={(e) => setMargen(e.target.value)}
                                placeholder={String(MARGEN_CATALOGO_DEFECTO)}
                                style={{ ...inputStyle, color: 'var(--tono-naranja)' }}
                            />
                            <span style={{ color: tintaTexto(0.3), fontSize: '14px' }}>%</span>
                        </div>
                    </div>
                    <div style={{ ...fieldBox, marginBottom: 0 }}>
                        <label style={labelStyle}>Precio ($)</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ color: tintaTexto(0.3), fontSize: '16px' }}>$</span>
                            <input
                                type="number"
                                min={0}
                                step={0.01}
                                value={form.precio}
                                onChange={(e) => setPrecio(e.target.value)}
                                placeholder="0.00"
                                style={{ ...inputStyle, color: 'var(--tono-verde)' }}
                            />
                        </div>
                    </div>
                </div>
            ) : (
                <div style={{ ...fieldBox }}>
                    <label style={labelStyle}>Precio de venta ($)</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ color: tintaTexto(0.3), fontSize: '16px' }}>$</span>
                        <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={form.precio}
                            onChange={(e) => set('precio', e.target.value)}
                            placeholder="0.00"
                            style={{ ...inputStyle, color: 'var(--tono-verde)' }}
                        />
                    </div>
                    <p style={{ fontSize: '12px', color: tintaTexto(0.45), margin: '8px 0 0' }}>
                        El costo y el margen solo los ven quienes tienen permiso de costos.
                    </p>
                </div>
            )}

            {puedeCostos && form.costo && form.precio && (
                <div
                    style={{
                        ...fieldBox,
                        background:
                            parseFloat(form.precio) > parseFloat(form.costo)
                                ? 'rgba(52,199,89,0.08)'
                                : 'rgba(255,59,48,0.08)',
                        border: `1px solid ${
                            parseFloat(form.precio) > parseFloat(form.costo)
                                ? 'rgba(52,199,89,0.2)'
                                : 'rgba(255,59,48,0.2)'
                        }`,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                    }}
                >
                    <div>
                        <p style={{ fontSize: '12px', color: tintaTexto(0.4), fontWeight: 500 }}>Utilidad</p>
                        <p
                            style={{
                                fontSize: '20px',
                                fontWeight: 700,
                                color: parseFloat(form.precio) > parseFloat(form.costo) ? 'var(--tono-verde)' : 'var(--tono-rojo)',
                            }}
                        >
                            ${utilidad}
                        </p>
                    </div>
                    {margenPctMostrado != null && (
                        <div style={{ textAlign: 'right' }}>
                            <p style={{ fontSize: '12px', color: tintaTexto(0.4) }}>precio = costo × (1+margen)</p>
                            <p
                                style={{
                                    fontSize: '24px',
                                    fontWeight: 800,
                                    color: margenPctMostrado >= 20 ? 'var(--tono-verde)' : 'var(--tono-naranja)',
                                }}
                            >
                                {margenPctMostrado}%
                            </p>
                        </div>
                    )}
                </div>
            )}

            <div style={fieldBox} data-enlace-proveedor>
                <label style={labelStyle}>Enlace en la web del proveedor (opcional)</label>
                <input
                    type="url"
                    inputMode="url"
                    autoCapitalize="none"
                    autoCorrect="off"
                    value={form.proveedor_url}
                    onChange={(e) => {
                        set('proveedor_url', e.target.value);
                        setPrecioWeb({ precio: null, error: null, leyendo: false });
                    }}
                    placeholder="https://electronica.com.ve/…/123-producto.html"
                    style={{ ...inputStyle, fontSize: '14px' }}
                />
                {!enlaceEscrito ? (
                    <p style={{ fontSize: '12px', color: tintaTexto(0.45), margin: '8px 0 0', lineHeight: 1.45 }}>
                        Abre el producto en la web del proveedor y pega aquí su dirección. Con ella, «Actualizar costos del
                        proveedor» lee su precio. Por ahora: {proveedoresAdmitidos()}.
                    </p>
                ) : enlaceRevisado && !enlaceRevisado.ok ? (
                    <p data-enlace-error style={{ fontSize: '12px', color: 'var(--tono-coral)', fontWeight: 600, margin: '8px 0 0', lineHeight: 1.45 }}>
                        {enlaceRevisado.motivo}
                    </p>
                ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', marginTop: '10px' }}>
                        <button type="button" onClick={() => void leerPrecioWeb()} disabled={precioWeb.leyendo} style={btnSecondary}>
                            {precioWeb.leyendo ? 'Leyendo…' : 'Leer precio de la web'}
                        </button>
                        {precioWeb.precio != null ? (
                            <>
                                <span data-precio-web style={{ fontSize: '14px', fontWeight: 700, color: 'var(--label-primary)' }}>
                                    En la web: ${precioWeb.precio.toFixed(2)}
                                </span>
                                <button type="button" onClick={usarPrecioWeb} style={{ ...btnSecondary, color: 'var(--tono-verde)' }}>
                                    Usar como costo
                                </button>
                            </>
                        ) : null}
                        {precioWeb.error ? (
                            <span style={{ fontSize: '12px', color: 'var(--tono-coral)', fontWeight: 600, flexBasis: '100%' }}>
                                {precioWeb.error}
                            </span>
                        ) : null}
                    </div>
                )}
            </div>

            <div style={fieldBox}>
                <label style={labelStyle}>Cantidad referencial</label>
                <p style={{ fontSize: '12px', color: tintaTexto(0.45), margin: '0 0 8px', lineHeight: 1.4 }}>
                    No es el stock del almacén. El inventario vive en Almacén; esto solo es una cantidad de catálogo.
                </p>
                <input
                    type="number"
                    min={0}
                    value={form.cantidad}
                    onChange={(e) => set('cantidad', e.target.value)}
                    placeholder="0"
                    style={inputStyle}
                />
            </div>

            <div style={fieldBox}>
                <label style={labelStyle}>Descripción</label>
                <textarea
                    value={form.descripcion}
                    onChange={(e) => set('descripcion', e.target.value)}
                    placeholder="Descripción técnica..."
                    rows={4}
                    style={{ ...inputStyle, resize: 'none', lineHeight: 1.6 }}
                />
            </div>

            {/* Manuales e instrucciones */}
            <div style={fieldBox}>
                <label style={labelStyle}>Instrucciones / manual (texto)</label>
                <p style={{ fontSize: '12px', color: 'var(--label-secondary)', marginBottom: '8px', lineHeight: 1.45 }}>
                    Pasos de instalación, advertencias, enlace a video, etc.
                </p>
                <textarea
                    value={form.manual_instrucciones}
                    onChange={(e) => set('manual_instrucciones', e.target.value)}
                    placeholder="Ej.: Alimentación PoE 802.3af. Montaje en techo con tacos incluidos…"
                    rows={5}
                    style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.55, minHeight: '100px' }}
                />
            </div>

            <div style={fieldBox}>
                <label style={labelStyle}>Manual en PDF</label>
                <p style={{ fontSize: '12px', color: 'var(--label-secondary)', marginBottom: '10px', lineHeight: 1.45 }}>
                    Sube el PDF del fabricante o pega una URL si ya está alojado en otro sitio.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
                    <button
                        type="button"
                        disabled={uploadingManual}
                        onClick={() => fileManualRef.current?.click()}
                        style={{ ...btnSecondary, opacity: uploadingManual ? 0.5 : 1 }}
                    >
                        {uploadingManual ? 'Subiendo PDF…' : '📄 Subir PDF'}
                    </button>
                    {form.manual_documento_url ? (
                        <button
                            type="button"
                            onClick={() => set('manual_documento_url', '')}
                            style={{ ...btnSecondary, borderColor: 'rgba(255,59,48,0.35)', color: 'var(--tono-coral)' }}
                        >
                            Quitar PDF
                        </button>
                    ) : null}
                </div>
                {form.manual_documento_url ? (
                    <a
                        href={form.manual_documento_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'var(--tono-celeste)', fontSize: '13px', wordBreak: 'break-all' }}
                    >
                        Abrir manual actual →
                    </a>
                ) : null}
                <label style={{ ...labelStyle, marginTop: '12px', marginBottom: '4px' }}>O URL del documento</label>
                <input
                    type="url"
                    value={form.manual_documento_url}
                    onChange={(e) => set('manual_documento_url', e.target.value)}
                    placeholder="https://…/manual.pdf"
                    style={{ ...inputStyle, fontSize: '14px' }}
                />
            </div>

            <p
                style={{
                    fontSize: '12px',
                    color: tintaTexto(0.45),
                    textAlign: 'center',
                    marginBottom: '10px',
                    lineHeight: 1.5,
                }}
            >
                Solo el <strong style={{ color: tintaTexto(0.7) }}>nombre</strong> es obligatorio. Sin imagen el producto
                se guarda igual; luego puedes editarlo y añadir foto o URL.
            </p>
            <button
                onClick={handleSave}
                disabled={saving || !form.nombre.trim()}
                style={{
                    width: '100%',
                    padding: '16px',
                    borderRadius: '16px',
                    border: 'none',
                    background:
                        saving || !form.nombre.trim() ? 'rgba(255,149,0,0.3)' : 'linear-gradient(135deg, #FF9500, #FF6B00)',
                    color: 'white',
                    fontSize: '17px',
                    fontWeight: 700,
                    cursor: saving || !form.nombre.trim() ? 'not-allowed' : 'pointer',
                    boxShadow: saving || !form.nombre.trim() ? 'none' : '0 8px 32px rgba(255,149,0,0.4)',
                }}
            >
                {saving ? 'Guardando...' : isEditing ? 'Actualizar Producto' : 'Guardar Producto'}
            </button>
        </div>
    );
}
