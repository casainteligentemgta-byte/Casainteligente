'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import NuevoProductoForm from '@/components/productos/NuevoProductoForm';

export default function EditarProductoPage() {
    const { id } = useParams();
    const router = useRouter();
    const [producto, setProducto] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchProducto = async () => {
            const supabase = createClient();
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .eq('id', id)
                .single();

            if (data) setProducto(data);
            setLoading(false);
        };
        fetchProducto();
    }, [id]);

    if (loading) return (
        <div style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ color: '#FF9500', fontSize: '18px' }}>Cargando producto...</div>
        </div>
    );

    if (!producto) return (
        <div style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ color: '#FF3B30', fontSize: '18px' }}>Producto no encontrado.</div>
        </div>
    );

    return (
        <div style={{ minHeight: '100vh', background: '#000', paddingBottom: '100px' }}>
            <div style={{
                position: 'sticky', top: 0, zIndex: 50,
                background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(20px)',
                padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)',
                display: 'flex', alignItems: 'center', gap: '12px'
            }}>
                <button
                    onClick={() => router.back()}
                    style={{ background: 'none', border: 'none', color: '#FF9500', cursor: 'pointer', padding: '5px' }}
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </button>
                <h1 style={{ color: 'white', fontSize: '20px', fontWeight: 700 }}>Editar Producto</h1>
            </div>

            <NuevoProductoForm initialData={producto} isEditing={true} />
        </div>
    );
}
