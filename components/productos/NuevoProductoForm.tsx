'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const CATEGORIAS = ['Cámaras IP', 'Cámaras Análogas', 'C.C.T.V', 'Servicio', 'Cercos Eléctricos', 'Internet', 'Domótica', 'Network', 'Materiales'];

export default function NuevoProductoForm({ initialData, isEditing }: { initialData?: any; isEditing?: boolean }) {
    const router = useRouter();
    const [saving, setSaving] = useState(false);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(initialData?.image_url || null);

    const [form, setForm] = useState({
        nombre: initialData?.nombre || '',
        categoria: initialData?.categoria || '',
        marca: initialData?.marca || '',
        modelo: initialData?.modelo || '',
        descripcion: initialData?.descripcion || '',
        costo: initialData?.costo?.toString() || '',
        precio: initialData?.precio?.toString() || '',
        cantidad: initialData?.cantidad?.toString() || '',
        image_url: initialData?.image_url || null,
    });

    const utilidad = form.costo && form.precio
        ? (parseFloat(form.precio) - parseFloat(form.costo)).toFixed(2)
        : '—';

    const margenPct = form.costo && form.precio && parseFloat(form.precio) > 0
        ? (((parseFloat(form.precio) - parseFloat(form.costo)) / parseFloat(form.precio)) * 100).toFixed(1)
        : null;

    const set = (k: string, v: string | null) => setForm(f => ({ ...f, [k]: v }));

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const handleSave = async () => {
        if (!form.nombre.trim()) return alert('El nombre es obligatorio');
        setSaving(true);
        const supabase = createClient();

        let uploadedImageUrl = form.image_url;

        // Subir la imagen si hay una nueva
        if (imageFile) {
            const fileExt = imageFile.name.split('.').pop();
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('productos')
                .upload(fileName, imageFile, { cacheControl: '3600', upsert: false });

            if (uploadError) {
                alert('Fallo al subir imagen: ' + uploadError.message + '. Asegúrate de que el bucket "productos" exista.');
                setSaving(false);
                return;
            }

            if (uploadData) {
                const { data: { publicUrl } } = supabase.storage.from('productos').getPublicUrl(uploadData.path);
                uploadedImageUrl = publicUrl;
            }
        }

        const productData = {
            nombre: form.nombre.trim(),
            categoria: form.categoria || null,
            marca: form.marca || null,
            modelo: form.modelo || null,
            descripcion: form.descripcion || null,
            costo: form.costo ? parseFloat(form.costo) : null,
            precio: form.precio ? parseFloat(form.precio) : null,
            utilidad: form.costo && form.precio ? parseFloat(form.precio) - parseFloat(form.costo) : null,
            cantidad: form.cantidad ? parseInt(form.cantidad) : 0,
            image_url: uploadedImageUrl,
        };

        let error;
        if (isEditing && initialData?.id) {
            const res = await supabase.from('products').update(productData).eq('id', initialData.id);
            error = res.error;
        } else {
            const res = await supabase.from('products').insert([productData]);
            error = res.error;
        }

        setSaving(false);
        if (error) { alert('Error al guardar en BD: ' + error.message + '\n¿Añadiste la columna image_url?'); return; }

        router.push('/productos');
        router.refresh();
    };

    const inputStyle = {
        width: '100%', background: 'transparent', border: 'none', outline: 'none',
        color: 'var(--label-primary)', fontSize: '16px', fontFamily: 'inherit',
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
        fontSize: '11px', fontWeight: 600, color: 'var(--label-secondary)',
        textTransform: 'uppercase' as const, letterSpacing: '0.5px', display: 'block', marginBottom: '6px',
    };

    return (
        <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
            {/* ── Image Upload ── */}
            <div style={{ ...fieldBox, textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
                <label style={{ ...labelStyle, textAlign: 'center', marginBottom: '12px' }}>Foto del Producto</label>
                
                <div 
                    onClick={() => document.getElementById('imageUpload')?.click()}
                    style={{
                        width: '120px', height: '120px', borderRadius: '16px', margin: '0 auto',
                        background: imagePreview ? `url(${imagePreview}) center/cover` : 'rgba(255,255,255,0.05)',
                        border: '2px dashed rgba(255,255,255,0.2)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', transition: 'all 0.2s',
                    }}
                >
                    {!imagePreview && (
                        <>
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.5, marginBottom: '8px' }}>
                                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
                                <circle cx="12" cy="13" r="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></circle>
                            </svg>
                            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>Tocar para foto</span>
                        </>
                    )}
                </div>
                <input 
                    id="imageUpload"
                    type="file" 
                    accept="image/*" 
                    capture="environment" /* Activa la cámara en móviles */
                    onChange={handleImageChange} 
                    style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }} 
                />
            </div>

            {/* Form content */}
            <div style={fieldBox}>
                <label style={labelStyle}>Nombre del Producto *</label>
                <input
                    type="text"
                    value={form.nombre}
                    onChange={e => set('nombre', e.target.value)}
                    placeholder="Ej: Cámara IP 4MP PoE..."
                    style={{ ...inputStyle, fontSize: '17px', fontWeight: 600 }}
                />
            </div>

            <div style={fieldBox}>
                <label style={labelStyle}>Categoría</label>
                <select
                    value={form.categoria}
                    onChange={e => set('categoria', e.target.value)}
                    style={{ ...inputStyle, cursor: 'pointer' }}
                >
                    <option value="" style={{ color: '#000000' }}>Sin categoría</option>
                    {CATEGORIAS.map(c => <option key={c} value={c} style={{ color: '#000000' }}>{c}</option>)}
                </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <div style={{ ...fieldBox, marginBottom: 0 }}>
                    <label style={labelStyle}>Marca</label>
                    <input type="text" value={form.marca} onChange={e => set('marca', e.target.value)}
                        placeholder="HIKVISION..." style={inputStyle} />
                </div>
                <div style={{ ...fieldBox, marginBottom: 0 }}>
                    <label style={labelStyle}>Modelo</label>
                    <input type="text" value={form.modelo} onChange={e => set('modelo', e.target.value)}
                        placeholder="DS-2CD..." style={inputStyle} />
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <div style={{ ...fieldBox, marginBottom: 0 }}>
                    <label style={labelStyle}>Costo ($)</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '16px' }}>$</span>
                        <input type="number" min={0} step={0.01} value={form.costo}
                            onChange={e => set('costo', e.target.value)}
                            placeholder="0.00" style={{ ...inputStyle, color: '#FF3B30' }} />
                    </div>
                </div>
                <div style={{ ...fieldBox, marginBottom: 0 }}>
                    <label style={labelStyle}>Precio ($)</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '16px' }}>$</span>
                        <input type="number" min={0} step={0.01} value={form.precio}
                            onChange={e => set('precio', e.target.value)}
                            placeholder="0.00" style={{ ...inputStyle, color: '#34C759' }} />
                    </div>
                </div>
            </div>

            {form.costo && form.precio && (
                <div style={{
                    ...fieldBox,
                    background: parseFloat(form.precio) > parseFloat(form.costo)
                        ? 'rgba(52,199,89,0.08)' : 'rgba(255,59,48,0.08)',
                    border: `1px solid ${parseFloat(form.precio) > parseFloat(form.costo)
                        ? 'rgba(52,199,89,0.2)' : 'rgba(255,59,48,0.2)'}`,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                    <div>
                        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>Utilidad</p>
                        <p style={{ fontSize: '20px', fontWeight: 700, color: parseFloat(form.precio) > parseFloat(form.costo) ? '#34C759' : '#FF3B30' }}>
                            ${utilidad}
                        </p>
                    </div>
                    {margenPct && (
                        <div style={{ textAlign: 'right' }}>
                            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>Margen</p>
                            <p style={{ fontSize: '24px', fontWeight: 800, color: parseFloat(margenPct) >= 20 ? '#34C759' : '#FF9500' }}>
                                {margenPct}%
                            </p>
                        </div>
                    )}
                </div>
            )}

            <div style={fieldBox}>
                <label style={labelStyle}>Stock</label>
                <input type="number" min={0} value={form.cantidad}
                    onChange={e => set('cantidad', e.target.value)}
                    placeholder="0" style={inputStyle} />
            </div>

            <div style={fieldBox}>
                <label style={labelStyle}>Descripción</label>
                <textarea
                    value={form.descripcion}
                    onChange={e => set('descripcion', e.target.value)}
                    placeholder="Descripción técnica..."
                    rows={4}
                    style={{ ...inputStyle, resize: 'none', lineHeight: 1.6 }}
                />
            </div>

            <button
                onClick={handleSave}
                disabled={saving || !form.nombre.trim()}
                style={{
                    width: '100%', padding: '16px',
                    borderRadius: '16px', border: 'none',
                    background: saving || !form.nombre.trim()
                        ? 'rgba(255,149,0,0.3)'
                        : 'linear-gradient(135deg, #FF9500, #FF6B00)',
                    color: 'white', fontSize: '17px', fontWeight: 700,
                    cursor: saving || !form.nombre.trim() ? 'not-allowed' : 'pointer',
                    boxShadow: saving || !form.nombre.trim() ? 'none' : '0 8px 32px rgba(255,149,0,0.4)',
                }}
            >
                {saving ? 'Guardando...' : isEditing ? 'Actualizar Producto' : 'Guardar Producto'}
            </button>
        </div>
    );
}
