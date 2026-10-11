'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import NuevoClienteForm from '@/components/clientes/NuevoClienteForm';
import { tinta } from '@/lib/tema/tinta';

export default function EditarClientePage() {
    const { id } = useParams();
    const router = useRouter();
    const [cliente, setCliente] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchCliente = async () => {
            const supabase = createClient();
            const { data, error } = await supabase
                .from('customers')
                .select('*')
                .eq('id', id)
                .single();

            if (data) setCliente(data);
            setLoading(false);
        };
        fetchCliente();
    }, [id]);

    if (loading) return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ color: 'var(--tono-azul)', fontSize: '18px' }}>Cargando datos del cliente...</div>
        </div>
    );

    if (!cliente) return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ color: 'var(--tono-rojo)', fontSize: '18px' }}>Cliente no encontrado.</div>
        </div>
    );

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', paddingBottom: '100px' }}>
            <div style={{
                position: 'sticky', top: 0, zIndex: 50,
                background: 'var(--barra-fondo)', backdropFilter: 'blur(20px)',
                padding: '16px 20px', borderBottom: `1px solid ${tinta(0.1)}`,
                display: 'flex', alignItems: 'center', gap: '12px'
            }}>
                <button
                    onClick={() => router.back()}
                    style={{ background: 'none', border: 'none', color: 'var(--tono-azul)', cursor: 'pointer', padding: '5px' }}
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </button>
                <h1 style={{ color: 'var(--label-primary)', fontSize: '20px', fontWeight: 700 }}>Editar Cliente</h1>
            </div>

            <NuevoClienteForm initialData={cliente} isEditing={true} />
        </div>
    );
}
