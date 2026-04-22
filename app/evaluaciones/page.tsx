'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import GeneradorInvitacion from '@/components/evaluaciones/GeneradorInvitacion';
import { UserPlus } from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
    invitado:       { label: 'Invitado',    bg: 'rgba(255,214,10,0.12)', text: '#FFD60A' },
    en_evaluacion: { label: 'En Proceso', bg: 'rgba(0,174,239,0.12)',  text: '#00AEEF' },
    completado:    { label: 'Completado',  bg: 'rgba(52,199,89,0.12)',  text: '#34C759' },
    descartado:    { label: 'Descartado',  bg: 'rgba(255,59,48,0.12)',  text: '#FF3B30' },
};

const SEMAFORO_COLOR: Record<string, string> = {
    verde: '#34C759', amarillo: '#FFD60A', rojo: '#FF3B30',
};

export default function EvaluacionesPage() {
    const router = useRouter();
    const [evaluaciones, setEvaluaciones] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [isInviting, setIsInviting] = useState(false);

    useEffect(() => {
        load();
        // Refresh each 30s for live status
        const iv = setInterval(load, 30_000);
        return () => clearInterval(iv);
    }, []);

    async function load() {
        const supabase = createClient();
        const { data } = await supabase
            .from('ci_prospectos')
            .select('*, ci_evaluaciones(*)')
            .order('created_at', { ascending: false })
            .limit(100);
        
        // Aplanar datos para compatibilidad con el resto del componente
        const formatted = (data || []).map(p => ({
            ...p,
            status: p.estado, // mapeo de 'estado' a 'status'
            employee_name: p.nombres,
            evaluacion: p.ci_evaluaciones?.[0] || null,
            semaforo: p.ci_evaluaciones?.[0]?.respuestas?.semaforo || null,
            risk_score: p.ci_evaluaciones?.[0]?.respuestas?.risk_score || 0,
            disc_d: p.ci_evaluaciones?.[0]?.respuestas?.disc_d || 0,
            disc_i: p.ci_evaluaciones?.[0]?.respuestas?.disc_i || 0,
            disc_s: p.ci_evaluaciones?.[0]?.respuestas?.disc_s || 0,
            disc_c: p.ci_evaluaciones?.[0]?.respuestas?.disc_c || 0,
        }));

        setEvaluaciones(formatted);
        setLoading(false);
    }

    const filtered = evaluaciones.filter(e =>
        e.employee_name.toLowerCase().includes(search.toLowerCase())
    );

    const stats = {
        total:     evaluaciones.length,
        pending:   evaluaciones.filter(e => e.status === 'invitado' || e.status === 'en_evaluacion').length,
        completed: evaluaciones.filter(e => e.status === 'completado').length,
        risk:      evaluaciones.filter(e => e.semaforo === 'rojo').length,
    };

    const glass = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', backdropFilter: 'blur(20px)' };

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-primary,#0A0A0F)', fontFamily: 'Inter,-apple-system,sans-serif', color: 'white', padding: '24px', paddingBottom: '100px' }}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '28px' }}>
                <div>
                    <h1 style={{ fontSize: '28px', fontWeight: 900, margin: '0 0 4px 0', background: 'linear-gradient(135deg,#FFD60A,#FF9500)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        Evaluaciones de Élite
                    </h1>
                    <p style={{ margin: 0, color: 'rgba(255,255,255,0.35)', fontSize: '14px' }}>
                        Sistema DISC + Dark Triad · Dashboard del CEO
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                        onClick={() => setIsInviting(true)}
                        style={{ padding: '12px 20px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#FFF', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <UserPlus size={18} />
                        Invitar Prospecto
                    </button>
                    <button
                        onClick={() => router.push('/evaluaciones/nueva')}
                        style={{ padding: '12px 20px', borderRadius: '14px', border: 'none', background: 'linear-gradient(135deg,#FFD60A,#FF9500)', color: '#000', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 800, fontSize: '14px', boxShadow: '0 4px 16px rgba(255,214,10,0.3)' }}>
                        ⚡ Nueva Evaluación
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: '12px', marginBottom: '24px' }}>
                {[
                    { label: 'Total', value: stats.total, color: 'rgba(255,255,255,0.7)' },
                    { label: 'Enviadas', value: stats.pending, color: '#FFD60A' },
                    { label: 'Completadas', value: stats.completed, color: '#34C759' },
                    { label: '🔴 Alto Riesgo', value: stats.risk, color: '#FF3B30' },
                ].map(s => (
                    <div key={s.label} style={{ ...glass, padding: '16px', textAlign: 'center' }}>
                        <div style={{ fontSize: '28px', fontWeight: 900, color: s.color }}>{s.value}</div>
                        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', marginTop: '4px' }}>{s.label}</div>
                    </div>
                ))}
            </div>

            {/* Search */}
            <input
                type="text"
                placeholder="🔍  Buscar candidato…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '13px 18px', color: 'white', fontSize: '14px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', marginBottom: '20px' }}
            />

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
                    <div style={{ width: '40px', height: '40px', border: '3px solid rgba(255,214,10,0.2)', borderTopColor: '#FFD60A', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
                </div>
            ) : filtered.length === 0 ? (
                <div style={{ ...glass, padding: '60px', textAlign: 'center' }}>
                    <div style={{ fontSize: '48px', marginBottom: '12px' }}>🎯</div>
                    <p style={{ color: 'rgba(255,255,255,0.4)', margin: 0 }}>No hay evaluaciones registradas aún</p>
                    <button onClick={() => router.push('/evaluaciones/nueva')} style={{ marginTop: '20px', padding: '12px 24px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg,#FFD60A,#FF9500)', color: '#000', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>
                        Crear la primera evaluación
                    </button>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {filtered.map(ev => {
                        const sc = STATUS_CONFIG[ev.status] ?? STATUS_CONFIG.pending;
                        const sf = ev.semaforo ? SEMAFORO_COLOR[ev.semaforo] : null;
                        const isCompleted = ev.status === 'completed';
                        return (
                            <div key={ev.id} style={{ ...glass, padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                                <div style={{ flex: 1, minWidth: '200px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '4px' }}>
                                        <span style={{ fontSize: '16px', fontWeight: 700 }}>{ev.employee_name}</span>
                                        <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '8px', background: sc.bg, color: sc.text }}>
                                            {sc.label}
                                        </span>
                                        <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '8px', background: `${sf}20`, color: sf }}>
                                                {ev.semaforo === 'verde' ? '🟢 Recomendado' : ev.semaforo === 'amarillo' ? '🟡 Condicional' : '🔴 Alto Riesgo'}
                                            </span>
                                        )}
                                        {ev.cargo && (
                                            <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)' }}>
                                                🛠️ {ev.cargo}
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}>
                                        Creada: {new Date(ev.created_at).toLocaleString('es-VE')}
                                        {ev.tab_changes > 0 && <span style={{ marginLeft: '10px', color: '#FF9500' }}>⚠️ {ev.tab_changes} cambio(s) de ventana</span>}
                                    </div>
                                    {isCompleted && (
                                        <div style={{ marginTop: '6px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                            {['D','I','S','C'].map(dim => (
                                                <span key={dim} style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>
                                                    {dim}:{ev[`disc_${dim.toLowerCase()}`]}
                                                </span>
                                            ))}
                                            <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '6px', background: `${sf}15`, color: sf || 'white', fontWeight: 700 }}>
                                                Riesgo: {ev.risk_score?.toFixed(1)}%
                                            </span>
                                        </div>
                                    )}
                                </div>
                                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                                    {ev.celular && (
                                        <a 
                                            href={`https://wa.me/${ev.celular.replace(/\D/g,'')}?text=${encodeURIComponent(`Hola ${ev.employee_name}! Te saluda el equipo de Casa Inteligente. ¿Cómo vas con tu evaluación?`)}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            style={{ padding: '10px 14px', borderRadius: '12px', border: '1px solid rgba(37,211,102,0.3)', background: 'rgba(37,211,102,0.1)', color: '#25D366', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', fontSize: '14px', fontWeight: 700 }}
                                            title="Contactar por WhatsApp"
                                        >
                                            <span style={{ marginRight: '6px' }}>💬</span> WhatsApp
                                        </a>
                                    )}
                                    {ev.status === 'invitado' && ev.token && (
                                        <button
                                            onClick={() => {
                                                const link = `${window.location.origin}/onboarding/${ev.token}`;
                                                navigator.clipboard.writeText(link);
                                                alert('Link copiado al portapapeles');
                                            }}
                                            style={{ padding: '10px 14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'white', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            🔗 Copiar Link
                                        </button>
                                    )}
                                    {isCompleted ? (
                                        <Link
                                            href={`/evaluaciones/${ev.id}/reporte`}
                                            style={{ padding: '10px 16px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg,#FFD60A,#FF9500)', color: '#000', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 800, fontSize: '13px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', boxShadow: '0 4px 12px rgba(255,214,10,0.2)' }}>
                                            📊 Reporte
                                        </Link>
                                    ) : (
                                        <Link
                                            href={`/evaluaciones/${ev.id}/reporte`}
                                            style={{ padding: '10px 16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: '13px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
                                            🕐 Ver Avance
                                        </Link>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
            {/* Modal de Invitación */}
            {isInviting && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={() => setIsInviting(false)}>
                    <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '450px' }}>
                        <GeneradorInvitacion onClose={() => setIsInviting(false)} />
                    </div>
                </div>
            )}
        </div>
    );
}
