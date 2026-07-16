'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { uploadProductImage, uploadProductManualPdf } from '@/lib/supabase/product-media';

const CATEGORIAS = ['Cámaras IP', 'Cámaras Análogas', 'C.C.T.V', 'Servicio', 'Cercos Eléctricos', 'Internet', 'Domótica', 'Network', 'Materiales'];

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

    const [form, setForm] = useState({
        nombre: initialData?.nombre || '',
        categoria: initialData?.categoria || '',
        marca: initialData?.marca || '',
        modelo: initialData?.modelo || '',
        descripcion: initialData?.descripcion || '',
        costo: initialData?.costo?.toString() || '',
        precio: initialData?.precio?.toString() || '',
        cantidad: initialData?.cantidad?.toString() || '',
        imagen: (initialData?.imagen as string) || '',
        manual_instrucciones: (initialData?.manual_instrucciones as string) || '',
        manual_documento_url: (initialData?.manual_documento_url as string) || '',
    });

    const utilidad = form.costo && form.precio
        ? (parseFloat(form.precio) - parseFloat(form.costo)).toFixed(2)
        : '—';

    const margenPct = form.costo && form.precio && parseFloat(form.precio) > 0
        ? (((parseFloat(form.precio) - parseFloat(form.costo)) / parseFloat(form.precio)) * 100).toFixed(1)
        : null;

    const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

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
        setSaving(true);
        setMediaError(null);

        const costoN = parseMoney(form.costo);
        const precioN = parseMoney(form.precio);

        // imagen / manual: vacío → null en BD (producto válido sin URL; se puede completar después)
        const imagenVal = form.imagen.trim() || null;
        const productData = {
            nombre: form.nombre.trim(),
            categoria: form.categoria || null,
            marca: form.marca || null,
            modelo: form.modelo || null,
            descripcion: form.descripcion || null,
            costo: costoN,
            precio: precioN,
            utilidad:
                costoN != null && precioN != null ? precioN - costoN : null,
            cantidad: form.cantidad ? parseInt(form.cantidad, 10) : 0,
            imagen: imagenVal,
            manual_instrucciones: form.manual_instrucciones.trim() || null,
            manual_documento_url: form.manual_documento_url.trim() || null,
        };

        let error;
        if (isEditing && initialData?.id != null) {
            // `products.id` es bigint; unificar tipo para .eq (string desde URL vs number desde Supabase)
            const rowId =
                typeof initialData.id === 'string'
                    ? initialData.id
                    : String(initialData.id);
            const res = await supabase
                .from('products')
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
            const res = await supabase.from('products').insert([productData]);
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
        background: 'rgba(255,255,255,0.06)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.1)',
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
        border: '1px solid rgba(255,255,255,0.15)',
        background: 'rgba(255,255,255,0.06)',
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
                        color: '#FF8A80',
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
                            style={{ ...btnSecondary, borderColor: 'rgba(255,59,48,0.35)', color: '#FF8A80' }}
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
                            background: 'rgba(255,255,255,0.04)',
                            color: 'rgba(255,255,255,0.35)',
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

            <div style={fieldBox}>
                <label style={labelStyle}>Categoría</label>
                <select
                    value={form.categoria}
                    onChange={(e) => set('categoria', e.target.value)}
                    style={{ ...inputStyle, cursor: 'pointer' }}
                >
                    <option value="" style={{ color: '#000000' }}>
                        Sin categoría
                    </option>
                    {CATEGORIAS.map((c) => (
                        <option key={c} value={c} style={{ color: '#000000' }}>
                            {c}
                        </option>
                    ))}
                </select>
            </div>

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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <div style={{ ...fieldBox, marginBottom: 0 }}>
                    <label style={labelStyle}>Costo ($)</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '16px' }}>$</span>
                        <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={form.costo}
                            onChange={(e) => set('costo', e.target.value)}
                            placeholder="0.00"
                            style={{ ...inputStyle, color: '#FF3B30' }}
                        />
                    </div>
                </div>
                <div style={{ ...fieldBox, marginBottom: 0 }}>
                    <label style={labelStyle}>Precio ($)</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '16px' }}>$</span>
                        <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={form.precio}
                            onChange={(e) => set('precio', e.target.value)}
                            placeholder="0.00"
                            style={{ ...inputStyle, color: '#34C759' }}
                        />
                    </div>
                </div>
            </div>

            {form.costo && form.precio && (
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
                        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>Utilidad</p>
                        <p
                            style={{
                                fontSize: '20px',
                                fontWeight: 700,
                                color: parseFloat(form.precio) > parseFloat(form.costo) ? '#34C759' : '#FF3B30',
                            }}
                        >
                            ${utilidad}
                        </p>
                    </div>
                    {margenPct && (
                        <div style={{ textAlign: 'right' }}>
                            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>Margen</p>
                            <p
                                style={{
                                    fontSize: '24px',
                                    fontWeight: 800,
                                    color: parseFloat(margenPct) >= 20 ? '#34C759' : '#FF9500',
                                }}
                            >
                                {margenPct}%
                            </p>
                        </div>
                    )}
                </div>
            )}

            <div style={fieldBox}>
                <label style={labelStyle}>Stock</label>
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
                            style={{ ...btnSecondary, borderColor: 'rgba(255,59,48,0.35)', color: '#FF8A80' }}
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
                        style={{ color: '#5AC8FA', fontSize: '13px', wordBreak: 'break-all' }}
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
                    color: 'rgba(255,255,255,0.45)',
                    textAlign: 'center',
                    marginBottom: '10px',
                    lineHeight: 1.5,
                }}
            >
                Solo el <strong style={{ color: 'rgba(255,255,255,0.7)' }}>nombre</strong> es obligatorio. Sin imagen el producto
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
