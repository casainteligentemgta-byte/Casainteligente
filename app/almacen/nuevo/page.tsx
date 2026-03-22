'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const CATEGORIES = ['Domótica', 'Seguridad', 'Iluminación', 'Sensores', 'Automatización', 'Herramientas', 'Cables', 'Accesorios', 'Otros'];
const UNITS = ['UND', 'MTR', 'KG', 'LT', 'CJ', 'M2', 'PAR', 'SET', 'KIT'];

interface FormData {
    name: string;
    sap_code: string;
    category_name: string;
    unit: string;
    stock_available: string;
    reorder_point: string;
    alert_threshold: string;
    average_weighted_cost: string;
    location: string;
    image_url: string;
    supplier_name: string;
    supplier_contact: string;
    description: string;
}

const EMPTY: FormData = {
    name: '', sap_code: '', category_name: 'Domótica', unit: 'UND',
    stock_available: '0', reorder_point: '5', alert_threshold: '5',
    average_weighted_cost: '0', location: '', image_url: '',
    supplier_name: '', supplier_contact: '', description: '',
};

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
    return (
        <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                {label} {required && <span style={{ color: '#FF3B30' }}>*</span>}
            </label>
            {children}
        </div>
    );
}

const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 16px',
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '12px', color: 'white', fontFamily: 'Inter,sans-serif',
    fontWeight: 500, fontSize: '14px', outline: 'none', boxSizing: 'border-box',
};

export default function NuevoItemPage() {
    const [form, setForm] = useState<FormData>(EMPTY);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const router = useRouter();

    function set(key: keyof FormData, val: string) {
        setForm(f => ({ ...f, [key]: val }));
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!form.name.trim()) { setError('El nombre del producto es obligatorio.'); return; }
        setSaving(true); setError('');

        const supabase = createClient();
        const payload = {
            name: form.name.trim(),
            sap_code: form.sap_code.trim() || null,
            category_name: form.category_name,
            unit: form.unit,
            stock_available: parseFloat(form.stock_available) || 0,
            stock_quarantine: 0,
            reorder_point: parseFloat(form.reorder_point) || 5,
            alert_threshold: parseInt(form.alert_threshold) || 5,
            average_weighted_cost: parseFloat(form.average_weighted_cost) || 0,
            last_purchase_price: parseFloat(form.average_weighted_cost) || null,
            location: form.location.trim() || null,
            image_url: form.image_url.trim() || null,
            supplier_name: form.supplier_name.trim() || null,
            supplier_contact: form.supplier_contact.trim() || null,
            description: form.description.trim() || null,
            is_active: true,
        };

        const { data, error: err } = await supabase.from('global_inventory').insert(payload).select().single();

        if (err) {
            setError(err.message);
            setSaving(false);
            return;
        }

        // Register initial movement if stock > 0
        if (payload.stock_available > 0) {
            await supabase.from('inventory_movements').insert({
                material_id: data.id,
                movement_type_code: '101',
                quantity: payload.stock_available,
                previous_stock: 0,
                new_stock: payload.stock_available,
                reason: 'stock_inicial',
                notes: 'Stock inicial al crear el producto',
                performed_by: 'Admin',
            });
        }

        router.push('/almacen');
    }

    const glass = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '20px', backdropFilter: 'blur(20px)' };

    return (
        <div style={{ minHeight: '100vh', background: '#0A0A0F', fontFamily: 'Inter,-apple-system,sans-serif', color: 'white', padding: '20px', paddingBottom: '80px' }}>
            <style>{`* { box-sizing:border-box; } input::placeholder,textarea::placeholder { color:rgba(255,255,255,0.2); } select option { background:#111; }`}</style>

            {/* Header */}
            <div style={{ maxWidth: '680px', margin: '0 auto' }}>
                <div style={{ marginBottom: '28px' }}>
                    <Link href="/almacen" style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)', textDecoration: 'none', fontWeight: 600 }}>← Inventario</Link>
                    <h1 style={{ margin: '8px 0 4px 0', fontSize: '28px', fontWeight: 900, letterSpacing: '-0.5px' }}>Nuevo Producto</h1>
                    <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255,255,255,0.3)' }}>Agrega un ítem al inventario de Casa Inteligente</p>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                    {/* ── Datos básicos ── */}
                    <div style={{ ...glass, padding: '24px' }}>
                        <p style={{ margin: '0 0 20px 0', fontSize: '11px', fontWeight: 700, color: '#FFD60A', textTransform: 'uppercase', letterSpacing: '1px' }}>📦 Datos Básicos</p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '14px' }}>
                            <Field label="Nombre del producto" required>
                                <input
                                    type="text" required placeholder="Ej: Control Remoto Universal Z-Wave"
                                    value={form.name} onChange={e => set('name', e.target.value)}
                                    style={inputStyle}
                                />
                            </Field>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                                <Field label="Código SAP / SKU">
                                    <input type="text" placeholder="DOM-001" value={form.sap_code} onChange={e => set('sap_code', e.target.value)} style={inputStyle} />
                                </Field>
                                <Field label="Ubicación (pasillo/estante)">
                                    <input type="text" placeholder="A-01" value={form.location} onChange={e => set('location', e.target.value)} style={inputStyle} />
                                </Field>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                                <Field label="Categoría" required>
                                    <select value={form.category_name} onChange={e => set('category_name', e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                                        {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                                    </select>
                                </Field>
                                <Field label="Unidad de medida" required>
                                    <select value={form.unit} onChange={e => set('unit', e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                                        {UNITS.map(u => <option key={u}>{u}</option>)}
                                    </select>
                                </Field>
                            </div>

                            <Field label="Descripción">
                                <textarea
                                    rows={2} placeholder="Descripción breve del producto, uso o especificaciones..."
                                    value={form.description} onChange={e => set('description', e.target.value)}
                                    style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
                                />
                            </Field>
                        </div>
                    </div>

                    {/* ── Stock & costos ── */}
                    <div style={{ ...glass, padding: '24px' }}>
                        <p style={{ margin: '0 0 20px 0', fontSize: '11px', fontWeight: 700, color: '#34C759', textTransform: 'uppercase', letterSpacing: '1px' }}>📊 Stock & Costos</p>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: '14px' }}>
                            <Field label="Stock inicial" required>
                                <input type="number" min="0" step="0.01" value={form.stock_available} onChange={e => set('stock_available', e.target.value)} style={inputStyle} />
                            </Field>
                            <Field label="Punto de reorden">
                                <input type="number" min="0" step="0.01" value={form.reorder_point} onChange={e => set('reorder_point', e.target.value)} style={inputStyle} />
                            </Field>
                            <Field label="Umbral de alerta">
                                <input type="number" min="0" value={form.alert_threshold} onChange={e => set('alert_threshold', e.target.value)} style={inputStyle} />
                            </Field>
                            <Field label="Costo prom. (USD)">
                                <input type="number" min="0" step="0.01" value={form.average_weighted_cost} onChange={e => set('average_weighted_cost', e.target.value)} style={inputStyle} />
                            </Field>
                        </div>

                        {/* Visual preview */}
                        {(parseFloat(form.stock_available) > 0 || parseFloat(form.average_weighted_cost) > 0) && (
                            <div style={{ marginTop: '16px', padding: '14px 18px', background: 'rgba(52,199,89,0.06)', border: '1px solid rgba(52,199,89,0.2)', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                                <div>
                                    <p style={{ margin: '0 0 2px 0', fontSize: '10px', color: 'rgba(255,255,255,0.3)', fontWeight: 700, textTransform: 'uppercase' }}>Valor inicial en inventario</p>
                                    <p style={{ margin: 0, fontSize: '20px', fontWeight: 900, color: '#34C759' }}>
                                        ${(parseFloat(form.stock_available || '0') * parseFloat(form.average_weighted_cost || '0')).toFixed(2)}
                                    </p>
                                </div>
                                <div>
                                    <p style={{ margin: '0 0 2px 0', fontSize: '10px', color: 'rgba(255,255,255,0.3)', fontWeight: 700, textTransform: 'uppercase' }}>Alerta cuando baje de</p>
                                    <p style={{ margin: 0, fontSize: '20px', fontWeight: 900, color: '#FF9500' }}>
                                        {form.reorder_point} {form.unit}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── Proveedor ── */}
                    <div style={{ ...glass, padding: '24px' }}>
                        <p style={{ margin: '0 0 20px 0', fontSize: '11px', fontWeight: 700, color: '#00AEEF', textTransform: 'uppercase', letterSpacing: '1px' }}>🏭 Proveedor</p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                            <Field label="Nombre del proveedor">
                                <input type="text" placeholder="TechDistrib CA" value={form.supplier_name} onChange={e => set('supplier_name', e.target.value)} style={inputStyle} />
                            </Field>
                            <Field label="Contacto / Teléfono">
                                <input type="text" placeholder="+58 412 000 0000" value={form.supplier_contact} onChange={e => set('supplier_contact', e.target.value)} style={inputStyle} />
                            </Field>
                        </div>
                    </div>

                    {/* ── Imagen ── */}
                    <div style={{ ...glass, padding: '24px' }}>
                        <p style={{ margin: '0 0 16px 0', fontSize: '11px', fontWeight: 700, color: '#FF9500', textTransform: 'uppercase', letterSpacing: '1px' }}>🖼 Imagen</p>
                        <Field label="URL de imagen (opcional)">
                            <input type="url" placeholder="https://..." value={form.image_url} onChange={e => set('image_url', e.target.value)} style={inputStyle} />
                        </Field>
                        {form.image_url && (
                            <div style={{ marginTop: '12px', width: '80px', height: '80px', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                                <img src={form.image_url} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                            </div>
                        )}
                    </div>

                    {/* Error */}
                    {error && (
                        <div style={{ padding: '14px 18px', background: 'rgba(255,59,48,0.1)', border: '1px solid rgba(255,59,48,0.3)', borderRadius: '12px', color: '#FF3B30', fontWeight: 700, fontSize: '13px' }}>
                            ⚠️ {error}
                        </div>
                    )}

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <Link href="/almacen" style={{ flex: 1 }}>
                            <button type="button" style={{ width: '100%', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: '15px' }}>
                                Cancelar
                            </button>
                        </Link>
                        <button type="submit" disabled={saving} style={{ flex: 2, padding: '16px', borderRadius: '16px', border: 'none', background: saving ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg,#FFD60A,#FF9500)', color: saving ? 'rgba(255,255,255,0.3)' : '#000', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontWeight: 900, fontSize: '15px' }}>
                            {saving ? '⏳ Guardando…' : '✅ Agregar al Inventario'}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
}
