'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { pdf } from '@react-pdf/renderer';
import { BudgetPDF } from '@/components/pdf/BudgetPDF';

interface PreviewItem {
    nombre: string;
    categoria: string | null;
    qty: number;
    unitPrice: number;
    discount: number;
    costo: number | null;
    image_url?: string | null;
}

interface Presupuesto {
    cliente: string;
    rif: string;
    notas: string;
    items: PreviewItem[];
    subtotal: number;
    totalCost: number;
    totalProfit: number;
    marginPct: number;
    showZelle: boolean;
    fecha: string;
    numero: string;
    telefono?: string;
    email?: string;
}

function fmt(n: number) {
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function lineTotal(item: PreviewItem) {
    return item.unitPrice * (1 - item.discount / 100) * item.qty;
}

function PreviewContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [data, setData] = useState<Presupuesto | null>(null);
    const [loading, setLoading] = useState(true);
    const budgetId = searchParams.get('id');

    const markAsSent = async () => {
        if (!budgetId) return;
        const supabase = createClient();
        await supabase.from('budgets').update({ status: 'enviado' }).eq('id', budgetId);
    };

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            if (budgetId) {
                const supabase = createClient();
                const { data: b, error } = await supabase
                    .from('budgets')
                    .select('*')
                    .eq('id', budgetId)
                    .single();
                
                if (!error && b) {
                    setData({
                        cliente: b.customer_name,
                        rif: b.customer_rif,
                        notas: b.notes,
                        items: (b.items as any[]).map(i => ({
                            nombre: i.product_data.nombre,
                            categoria: i.product_data.categoria,
                            qty: i.qty,
                            unitPrice: i.unit_price,
                            discount: i.discount,
                            costo: i.product_data.costo,
                            image_url: i.product_data.image_url,
                        })),
                        subtotal: b.subtotal,
                        totalCost: b.total_cost,
                        totalProfit: b.total_profit,
                        marginPct: b.margin_pct,
                        showZelle: b.show_zelle,
                        fecha: new Date(b.created_at).toLocaleDateString(),
                        numero: b.budget_number || b.id.slice(0, 8),
                    });
                    setLoading(false);
                    return;
                }
            }

            // Fallback to localStorage
            const raw = localStorage.getItem('presupuesto_preview');
            if (raw) setData(JSON.parse(raw));
            setLoading(false);
        };

        fetchData();
    }, [budgetId]);

    const handleSharePDF = async (method: 'whatsapp' | 'email') => {
        if (!data) return;
        
        try {
            // Generate PDF Blob
            const blob = await pdf(<BudgetPDF data={data} />).toBlob();
            const file = new File([blob], `Presupuesto_PR-${data.numero}.pdf`, { type: 'application/pdf' });

            // Check if Web Share API is available and supports files
            if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: `Presupuesto Casa Inteligente - PR-${data.numero}`,
                    text: `Hola, adjunto presupuesto PR-${data.numero} por un total de $${fmt(data.subtotal)}.`
                });
                markAsSent();
            } else {
                // Fallback for Desktop or unsupported browsers
                if (method === 'whatsapp') {
                    const text = `*COTIZACIÓN CASA INTELIGENTE*\n\n*Nro:* ${data.numero}\n*TOTAL: $${fmt(data.subtotal)}*\n\nPuedes verla aquí: ${window.location.href}`;
                    const phone = data.telefono ? data.telefono.replace(/\D/g, '') : '';
                    window.open(`https://wa.me/${phone.startsWith('58') ? phone : '58' + phone}?text=${encodeURIComponent(text)}`, '_blank');
                } else {
                    const subject = `Presupuesto Casa Inteligente - ${data.cliente}`;
                    const body = `Hola, adjunto presupuesto Nro PR-${data.numero} por un total de $${fmt(data.subtotal)}.\n\nPuedes verlo aquí: ${window.location.href}`;
                    window.open(`mailto:${data.email || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
                }
                
                // Also offer to download the PDF
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `Presupuesto_PR-${data.numero}.pdf`;
                link.click();
                
                markAsSent();
                alert("En PC, el PDF se ha descargado. Por favor, adjúntalo manualmente en WhatsApp/Email.");
            }
        } catch (error) {
            console.error("Error sharing:", error);
            alert("No se pudo compartir el PDF directamente. Se enviará el mensaje de texto.");
        }
    };

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', background: '#0A0A0F', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                <p>Cargando presupuesto...</p>
            </div>
        );
    }

    if (!data) {
        return (
            <div style={{
                minHeight: '100vh', background: '#0A0A0F',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'Inter, -apple-system, sans-serif',
            }}>
                <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>📝</div>
                    <p style={{ fontSize: '16px' }}>No hay presupuesto para mostrar.</p>
                    <p style={{ fontSize: '13px', marginTop: '8px' }}>Ve a Ventas y genera una vista previa.</p>
                </div>
            </div>
        );
    }

    const descuento = 0; // Se puede calcular si hay descuentos globales
    const total = data.subtotal - descuento;

    return (
        <div style={{
            minHeight: '100vh',
            background: 'var(--bg-primary, #0A0A0F)',
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
            color: 'white',
            paddingBottom: '80px',
        }}>

            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Dancing+Script:wght@600&display=swap');
            `}</style>

            {/* ── Toolbar (no se imprime) ── */}
            <div className="no-print" style={{
                position: 'sticky', top: 0, zIndex: 50,
                background: 'rgba(10,10,15,0.85)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                padding: '16px 24px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                boxShadow: '0 4px 24px rgba(0,0,0,0.4)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <button
                        onClick={() => router.back()}
                        style={{
                            background: 'rgba(255,255,255,0.08)', border: 'none',
                            borderRadius: '12px', padding: '10px 16px',
                            color: 'rgba(255,255,255,0.8)', fontSize: '14px', fontWeight: 600,
                            cursor: 'pointer', fontFamily: 'inherit',
                            display: 'flex', alignItems: 'center', gap: '8px',
                            transition: 'background 0.2s',
                        }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Volver
                    </button>
                    <div style={{ height: '24px', width: '1px', background: 'rgba(255,255,255,0.1)' }} />
                    <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', fontWeight: 500 }}>
                        Vista Previa: <strong style={{ color: 'white', fontWeight: 700 }}>PR-{data.numero}</strong>
                    </span>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                        onClick={() => {
                            const url = window.location.href;
                            navigator.clipboard.writeText(url);
                            alert("Link copiado al portapapeles");
                        }}
                        style={{
                            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '12px', padding: '10px 16px',
                            color: 'white', fontSize: '13px', fontWeight: 600,
                            cursor: 'pointer', fontFamily: 'inherit',
                            display: 'flex', alignItems: 'center', gap: '6px'
                        }}
                    >
                        🔗 Link
                    </button>
                    <button
                        onClick={() => handleSharePDF('email')}
                        style={{
                            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '12px', padding: '10px 16px',
                            color: 'white', fontSize: '13px', fontWeight: 600,
                            cursor: 'pointer', fontFamily: 'inherit',
                            display: 'flex', alignItems: 'center', gap: '6px'
                        }}
                    >
                        📧 Email
                    </button>
                    <button
                        onClick={() => handleSharePDF('whatsapp')}
                        style={{
                            background: '#25D366', border: 'none',
                            borderRadius: '12px', padding: '10px 16px',
                            color: 'white', fontSize: '13px', fontWeight: 700,
                            cursor: 'pointer', fontFamily: 'inherit',
                            display: 'flex', alignItems: 'center', gap: '8px',
                            boxShadow: '0 4px 14px rgba(37,211,102,0.3)',
                        }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12.012 2c-5.506 0-9.989 4.478-9.99 9.984 0 1.758.459 3.474 1.33 4.982L2 22l5.167-1.357a9.945 9.945 0 004.845 1.259h.004c5.507 0 9.99-4.478 9.991-9.984 0-2.667-1.037-5.176-2.922-7.062A9.92 9.92 0 0012.012 2z" />
                        </svg>
                        WhatsApp
                    </button>
                    <button
                        onClick={() => window.print()}
                        style={{
                            background: 'linear-gradient(135deg, #00AEEF, #0077D4)',
                            border: 'none', borderRadius: '12px', padding: '10px 16px',
                            color: 'white', fontSize: '13px', fontWeight: 700,
                            cursor: 'pointer', fontFamily: 'inherit',
                            display: 'flex', alignItems: 'center', gap: '6px',
                        }}
                    >
                        🖨️ PDF
                    </button>
                </div>
            </div>

            {/* ── Document Container (A4 Proportions, Pinterest UI) ── */}
            <div style={{
                maxWidth: '850px',
                margin: '40px auto',
                padding: '0 20px',
                display: 'flex',
                justifyContent: 'center'
            }}>
                <div className="printable-document" style={{
                    width: '100%',
                    background: '#FFFFFF',
                    boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
                    display: 'flex',
                    flexDirection: 'row',
                    color: '#1C1C1E',
                    minHeight: '1122px', // Approx A4 height
                }}>
                    
                    {/* ── Left Sidebar ── */}
                    <div className="sidebar" style={{ 
                        width: '280px', 
                        background: '#ECECF1', // Light gray like the Pinterest image
                        padding: '28px 30px 40px 30px', 
                        display: 'flex', 
                        flexDirection: 'column',
                        flexShrink: 0
                    }}>
                        {/* Logo Casa Inteligente */}
                        <div style={{ marginBottom: '60px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                            <img
                                src="/logo-original.jpg"
                                alt="Casa Inteligente Logo"
                                style={{
                                    width: '114px',
                                    height: '114px',
                                    objectFit: 'contain',
                                    mixBlendMode: 'multiply',
                                    borderRadius: '16px',
                                }}
                            />
                            <div style={{ marginTop: '0px' }}>
                                <h1 style={{ fontSize: '18px', fontWeight: 900, color: '#111111', margin: 0, letterSpacing: '0.5px' }}>CASA INTELIGENTE</h1>
                                <p style={{ fontSize: '10px', color: '#0088CC', fontWeight: 700, margin: '4px 0 0 0', letterSpacing: '1.5px', textTransform: 'uppercase' }}>TECNOLOGÍA Y SEGURIDAD</p>
                            </div>
                        </div>

                        {/* Invoice To */}
                        <div style={{ marginBottom: '40px' }}>
                            <h3 style={{ fontSize: '12px', fontWeight: 700, color: '#333333', marginBottom: '8px', borderBottom: '1px solid #D4D4D8', paddingBottom: '4px' }}>Preparado para</h3>
                            <p style={{ fontSize: '13px', fontWeight: 600, color: '#18181B', margin: 0 }}>{data.cliente || 'Cliente no especificado'}</p>
                            {data.rif && <p style={{ fontSize: '11px', color: '#52525B', margin: '4px 0 0 0' }}>{data.rif}</p>}
                            {data.telefono && (
                                <p style={{ fontSize: '11px', color: '#52525B', margin: '6px 0 0 0', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#52525B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>
                                    </svg>
                                    {data.telefono}
                                </p>
                            )}
                            {data.email && (
                                <p style={{ fontSize: '11px', color: '#52525B', margin: '4px 0 0 0', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#52525B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                                    </svg>
                                    {data.email}
                                </p>
                            )}
                        </div>

                        {/* Invoice Details */}
                        <div style={{ marginBottom: '40px' }}>
                            <h3 style={{ fontSize: '12px', fontWeight: 700, color: '#333333', marginBottom: '8px', borderBottom: '1px solid #D4D4D8', paddingBottom: '4px' }}>Presupuesto Detallado</h3>
                            <p style={{ fontSize: '11px', color: '#52525B', margin: '0 0 2px 0' }}>Presupuesto Nº:</p>
                            <p style={{ fontSize: '13px', fontWeight: 600, color: '#18181B', margin: '0 0 12px 0' }}>PR-{data.numero}</p>
                            
                            <p style={{ fontSize: '11px', color: '#52525B', margin: '0 0 2px 0' }}>Fecha:</p>
                            <p style={{ fontSize: '13px', fontWeight: 600, color: '#18181B', margin: 0 }}>{data.fecha}</p>
                        </div>

                        {/* Payment Method */}
                        {data.showZelle !== false && (
                        <div style={{ marginBottom: '40px' }}>
                            <h3 style={{ fontSize: '12px', fontWeight: 700, color: '#333333', marginBottom: '8px', borderBottom: '1px solid #D4D4D8', paddingBottom: '4px' }}>Métodos de Pago</h3>
                            
                            <p style={{ fontSize: '11px', fontWeight: 600, color: '#18181B', margin: '0 0 2px 0' }}>Zelle:</p>
                            <p style={{ fontSize: '11px', color: '#52525B', margin: '0 0 10px 0' }}>casainteligentemgta@gmail.com</p>
                            
                            <p style={{ fontSize: '11px', fontWeight: 600, color: '#18181B', margin: '0 0 2px 0' }}>Banesco:</p>
                            <p style={{ fontSize: '11px', color: '#52525B', margin: '0 0 1px 0' }}>Cta. Corriente Nº 01340563388563303880</p>
                            <p style={{ fontSize: '11px', color: '#52525B', margin: '0 0 1px 0' }}>Luis Vicente Mata</p>
                            <p style={{ fontSize: '11px', color: '#52525B', margin: '0 0 10px 0' }}>C.I. V-13848186</p>

                            <p style={{ fontSize: '11px', fontWeight: 600, color: '#18181B', margin: '0 0 2px 0' }}>Teléfonos:</p>
                            <p style={{ fontSize: '11px', color: '#52525B', margin: '0' }}>0412-2117270</p>
                            <p style={{ fontSize: '11px', color: '#52525B', margin: '0' }}>0414-7937270</p>
                        </div>
                        )}

                        {/* Total Due Banner */}
                        <div style={{ marginBottom: '40px', marginTop: 'auto' }}>
                            <p style={{ fontSize: '13px', color: '#52525B', marginBottom: '6px' }}>Total Pagar</p>
                            <p style={{ fontSize: '22px', fontWeight: 800, color: '#333333', margin: 0 }}>USD: ${fmt(total)}</p>
                        </div>

                        {/* Office address */}
                        <div>
                            <h3 style={{ fontSize: '12px', fontWeight: 700, color: '#333333', marginBottom: '8px', borderBottom: '1px solid #D4D4D8', paddingBottom: '4px' }}>Oficina</h3>
                            <p style={{ fontSize: '11px', color: '#52525B', margin: '0 0 2px 0' }}>Isla de Margarita, Venezuela</p>
                            <p style={{ fontSize: '11px', color: '#52525B', margin: '0 0 2px 0' }}>RIF J-407035258</p>
                        </div>
                    </div>

                    {/* ── Right Content ── */}
                    <div style={{ flex: 1, padding: '60px 50px 50px 50px', display: 'flex', flexDirection: 'column' }}>


                        {/* TABLE */}
                        <div style={{ width: '100%', marginBottom: '40px' }}>
                            {/* Table Header */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 85px 50px 85px', background: '#F4F4F5', padding: '12px', borderRadius: '4px', marginBottom: '16px' }}>
                                <div style={{ fontSize: '12px', fontWeight: 700, color: '#333333' }}>Descripciones</div>
                                <div style={{ fontSize: '12px', fontWeight: 700, color: '#333333', textAlign: 'right' }}>Precio Unit.</div>
                                <div style={{ fontSize: '12px', fontWeight: 700, color: '#333333', textAlign: 'right' }}>Cant.</div>
                                <div style={{ fontSize: '12px', fontWeight: 700, color: '#333333', textAlign: 'right' }}>Total</div>
                            </div>

                            {/* Table Rows */}
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                {data.items.map((item, idx) => (
                                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 85px 50px 85px', padding: '12px 12px', borderBottom: idx === data.items.length - 1 ? 'none' : '1px solid #F4F4F5' }}>
                                        <div style={{ paddingRight: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            {item.image_url && (
                                                <img 
                                                    src={item.image_url} 
                                                    alt={item.nombre} 
                                                    style={{ width: '32px', height: '32px', borderRadius: '4px', objectFit: 'cover', flexShrink: 0, border: '1px solid #E5E7EB' }}
                                                />
                                            )}
                                            <div style={{ overflow: 'hidden', minWidth: 0 }}>
                                                <p style={{ fontSize: '12px', fontWeight: 600, color: '#18181B', margin: '0 0 4px 0', wordBreak: 'break-word', lineHeight: '1.4' }}>{item.nombre ? item.nombre.charAt(0).toUpperCase() + item.nombre.slice(1) : ''}</p>
                                                {item.categoria && <p style={{ fontSize: '10px', color: '#A1A1AA', margin: 0 }}>{item.categoria ? item.categoria.charAt(0).toUpperCase() + item.categoria.slice(1) : ''}</p>}
                                            </div>
                                        </div>
                                        <div style={{ fontSize: '12px', color: '#52525B', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                                            ${fmt(item.unitPrice)}
                                        </div>
                                        <div style={{ fontSize: '12px', color: '#52525B', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                                            {item.qty >= 10 ? item.qty : `0${item.qty}`}
                                        </div>
                                        <div style={{ fontSize: '12px', color: '#333333', textAlign: 'right', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                                            ${fmt(lineTotal(item))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* TOTALS */}
                        <div style={{ alignSelf: 'flex-end', width: '320px', marginBottom: '60px' }}>
                            <div style={{ height: '2px', background: '#F4F4F5', marginBottom: '16px' }}></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                                <span style={{ fontSize: '13px', color: '#52525B' }}>Sub Total</span>
                                <span style={{ fontSize: '13px', fontWeight: 600, color: '#18181B' }}>${fmt(data.subtotal)}</span>
                            </div>
                            {descuento > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                                <span style={{ fontSize: '13px', color: '#52525B' }}>Descuento</span>
                                <span style={{ fontSize: '13px', fontWeight: 600, color: '#18181B' }}>-${fmt(descuento)}</span>
                            </div>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #E4E4E7' }}>
                                <span style={{ fontSize: '13px', color: '#52525B' }}>Impuestos (Exento)</span>
                                <span style={{ fontSize: '13px', fontWeight: 600, color: '#18181B' }}>$0.00</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 0', borderBottom: '2px solid #333333' }}>
                                <span style={{ fontSize: '15px', fontWeight: 700, color: '#333333' }}>GRAN TOTAL</span>
                                <span style={{ fontSize: '15px', fontWeight: 700, color: '#333333' }}>${fmt(total)}</span>
                            </div>
                        </div>

                        {/* FOOTER */}
                        <div style={{ marginTop: 'auto', width: '100%' }}>
                            <h3 style={{ fontSize: '18px', fontWeight: 500, color: '#A1A1AA', margin: '0 0 16px 0' }}>
                                Gracias <br/><span style={{ color: '#00AEEF' }}>Por Preferirnos !</span>
                            </h3>
                            <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#333333', margin: '0 0 8px 0' }}>Términos & Condiciones</h4>
                            <p style={{ fontSize: '11px', color: '#71717A', margin: 0, lineHeight: 1.5, width: '100%', textAlign: 'justify' }}>
                                {data.notas ? data.notas : 'Los precios descritos tienen vigencia de 3 días hábiles. Requerido anticipo del 80% para iniciar, saldo contra valuaciones. Materiales e insumos sujetos a disponibilidad en inventario.'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                @media print {
                    .no-print { display: none !important; }
                    body { background: #FFFFFF !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0; padding: 0; }
                    .printable-document { box-shadow: none !important; border-radius: 0 !important; margin: 0 !important; width: 100% !important; max-width: 100% !important; min-height: auto !important; }
                    @page { margin: 0; size: A4 portrait; }
                }
            `}</style>
        </div>
    );
}

export default function PreviewPage() {
    return (
        <Suspense fallback={<div>Cargando...</div>}>
            <PreviewContent />
        </Suspense>
    );
}
