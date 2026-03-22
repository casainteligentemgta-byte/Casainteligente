'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function NuevaEvaluacionPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const preselectedId = searchParams.get('empleadoId');

    const [employees, setEmployees] = useState<any[]>([]);
    const [selectedEmp, setSelectedEmp] = useState<any>(null);
    const [generating, setGenerating] = useState(false);
    const [generated, setGenerated] = useState<{ token: string; link: string; evalId: string; message: string } | null>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        async function load() {
            const supabase = createClient();
            const { data } = await supabase
                .from('employees')
                .select('id, nombres, apellidos, cargo, estatus')
                .eq('estatus', 'activo')
                .order('apellidos');
            setEmployees(data || []);

            if (preselectedId) {
                const emp = (data || []).find((e: any) => e.id === preselectedId);
                if (emp) setSelectedEmp(emp);
            }
        }
        load();
    }, [preselectedId]);

    async function generateEvaluation() {
        if (!selectedEmp) return;
        setGenerating(true);

        const token = crypto.randomUUID().replace(/-/g, '');
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        const link = `${window.location.origin}/test/${token}`;
        const fullName = `${selectedEmp.nombres} ${selectedEmp.apellidos}`;

        const message = `¡Hola ${selectedEmp.nombres}! 👋 Qué bueno saludarte. Soy el asistente de CASA INTELIGENTE. Nos encantó tu perfil y queremos ver cómo encajas en nuestro ecosistema tecnológico. Para avanzar, te invitamos a completar este desafío de perfil y estilo de trabajo. 🔗 Link: ${link} ⚠️ Tienes 15 minutos para iniciarlo antes de que el acceso expire por seguridad. ¡Mucho éxito!`;

        const supabase = createClient();
        const { data, error } = await supabase.from('evaluaciones').insert({
            employee_id: selectedEmp.id,
            employee_name: fullName,
            token,
            link_expires_at: expiresAt,
        }).select().single();

        setGenerating(false);
        if (error) { alert('Error al generar: ' + error.message); return; }
        setGenerated({ token, link, evalId: data.id, message });
    }

    async function copyMessage() {
        if (!generated) return;
        await navigator.clipboard.writeText(generated.message);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
    }

    function openWhatsApp() {
        if (!generated) return;
        window.open(`https://wa.me/?text=${encodeURIComponent(generated.message)}`, '_blank');
    }

    const glass = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', backdropFilter: 'blur(20px)' };

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-primary,#0A0A0F)', fontFamily: 'Inter,-apple-system,sans-serif', color: 'white', padding: '24px' }}>
            <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '14px', padding: 0, marginBottom: '20px', fontFamily: 'inherit' }}>
                ← Volver
            </button>

            <div style={{ maxWidth: '640px', margin: '0 auto' }}>
                <h1 style={{ fontSize: '26px', fontWeight: 800, marginBottom: '6px', background: 'linear-gradient(135deg,#FFD60A,#FF9500)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    Nueva Evaluación de Élite
                </h1>
                <p style={{ color: 'rgba(255,255,255,0.35)', marginBottom: '32px', fontSize: '14px' }}>
                    Genera un link seguro con TTL de 15 minutos para el candidato
                </p>

                {!generated ? (
                    <div style={{ ...glass, padding: '28px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.5px', textTransform: 'uppercase', display: 'block', marginBottom: '12px' }}>
                            Seleccionar Empleado / Candidato
                        </label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '320px', overflowY: 'auto', marginBottom: '24px' }}>
                            {employees.map(emp => (
                                <button
                                    key={emp.id}
                                    onClick={() => setSelectedEmp(emp)}
                                    style={{
                                        padding: '14px 16px', borderRadius: '12px', cursor: 'pointer',
                                        border: selectedEmp?.id === emp.id ? '1px solid rgba(255,214,10,0.5)' : '1px solid rgba(255,255,255,0.06)',
                                        background: selectedEmp?.id === emp.id ? 'rgba(255,214,10,0.1)' : 'rgba(255,255,255,0.03)',
                                        color: 'white', fontFamily: 'inherit', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    }}>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: '14px' }}>{emp.apellidos}, {emp.nombres}</div>
                                        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>{emp.cargo}</div>
                                    </div>
                                    {selectedEmp?.id === emp.id && <span style={{ color: '#FFD60A', fontSize: '18px' }}>✓</span>}
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={generateEvaluation}
                            disabled={!selectedEmp || generating}
                            style={{
                                width: '100%', padding: '16px', borderRadius: '14px', border: 'none',
                                background: !selectedEmp ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg,#FFD60A,#FF9500)',
                                color: !selectedEmp ? 'rgba(255,255,255,0.3)' : '#000',
                                cursor: !selectedEmp ? 'not-allowed' : 'pointer',
                                fontFamily: 'inherit', fontWeight: 800, fontSize: '16px',
                                boxShadow: selectedEmp ? '0 4px 20px rgba(255,214,10,0.3)' : 'none',
                            }}>
                            {generating ? '⚡ Generando link seguro…' : '⚡ Generar Evaluación'}
                        </button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {/* Success header */}
                        <div style={{ ...glass, padding: '24px', background: 'rgba(52,199,89,0.08)', border: '1px solid rgba(52,199,89,0.2)', textAlign: 'center' }}>
                            <div style={{ fontSize: '36px', marginBottom: '8px' }}>✅</div>
                            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#34C759' }}>Link Generado Exitosamente</h2>
                            <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: 'rgba(255,255,255,0.45)' }}>
                                Válido durante <strong style={{ color: '#FFD60A' }}>15 minutos</strong> desde ahora
                            </p>
                        </div>

                        {/* Link */}
                        <div style={{ ...glass, padding: '20px' }}>
                            <p style={{ margin: '0 0 8px 0', fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Link del Candidato</p>
                            <div style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', fontFamily: 'monospace', fontSize: '13px', color: '#00AEEF', wordBreak: 'break-all' }}>
                                {generated.link}
                            </div>
                        </div>

                        {/* WhatsApp message */}
                        <div style={{ ...glass, padding: '20px' }}>
                            <p style={{ margin: '0 0 12px 0', fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                📱 Mensaje para WhatsApp
                            </p>
                            <div style={{ padding: '16px', background: 'rgba(37,211,102,0.06)', borderRadius: '12px', border: '1px solid rgba(37,211,102,0.15)', fontSize: '14px', lineHeight: 1.7, color: 'rgba(255,255,255,0.8)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                {generated.message}
                            </div>
                            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                                <button
                                    onClick={copyMessage}
                                    style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.15)', background: copied ? 'rgba(52,199,89,0.2)' : 'rgba(255,255,255,0.06)', color: copied ? '#34C759' : 'white', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: '14px' }}>
                                    {copied ? '✓ Copiado' : '📋 Copiar Mensaje'}
                                </button>
                                <button
                                    onClick={openWhatsApp}
                                    style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg,#25D366,#128C7E)', color: 'white', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: '14px', boxShadow: '0 4px 16px rgba(37,211,102,0.3)' }}>
                                    💬 Abrir WhatsApp
                                </button>
                            </div>
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button onClick={() => router.push(`/evaluaciones/${generated.evalId}/reporte`)} style={{ flex: 1, padding: '14px', borderRadius: '14px', border: '1px solid rgba(0,174,239,0.3)', background: 'rgba(0,174,239,0.08)', color: '#00AEEF', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: '14px' }}>
                                Ver Reporte
                            </button>
                            <button onClick={() => { setGenerated(null); setSelectedEmp(null); }} style={{ flex: 1, padding: '14px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: '14px' }}>
                                Nueva Evaluación
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
