'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// ── Asesoría IA rule-based ────────────────────────────────────
function generateInsights(d: any): string[] {
    const insights: string[] = [];

    const discDesc: Record<string, string> = {
        D: 'Perfil orientado a resultados y control. Toma decisiones rápidas, asume liderazgo natural y opera con alta autonomía. Puede ser percibido como dominante o impaciente; prioriza el logro sobre el proceso colectivo.',
        I: 'Alta energía social y capacidad de persuasión. Excelente para roles de relacionamiento con cliente y liderazgo colaborativo. Puede evitar tareas técnicas repetitivas y distraerse con facilidad.',
        S: 'Alta estabilidad emocional y lealtad organizacional. Ideal para ejecución sistemática y trabajo en equipo de largo plazo. Puede resistir cambios bruscos y evitar confrontaciones necesarias.',
        C: 'Riguroso, analítico y orientado a la calidad. Ideal para roles técnicos de control y auditoría. Puede ralentizar decisiones por perfeccionismo o evitar riesgos necesarios.',
    };
    insights.push(discDesc[d.dominant_disc] || 'Perfil mixto sin dominancia clara detectada.');

    const psyPct = Math.round((d.dark_psy / 7) * 100);
    const narPct = Math.round((d.dark_nar / 9) * 100);
    const irrPct = Math.round((d.dark_irr / 6) * 100);
    const maxDark = Math.max(psyPct, narPct, irrPct);

    if (maxDark === psyPct && psyPct > 50)
        insights.push(`⚠️ Frialdad emocional detectada (PSY ${psyPct}%): baja empatía en escenarios éticos. No ubicar en roles con acceso a recursos sensibles sin controles supervisados directos.`);
    else if (maxDark === narPct && narPct > 50)
        insights.push(`⚠️ Auto-centralidad elevada (NAR ${narPct}%): tiende a priorizar reconocimiento personal sobre el bien colectivo. Riesgo en roles de liderazgo sin estructuras de accountability claras.`);
    else if (maxDark === irrPct && irrPct > 50)
        insights.push(`⚠️ Locus de control externo (IRR ${irrPct}%): atribuye errores a factores externos de forma consistente. Puede dificultar la rendición de cuentas y el crecimiento por retroalimentación.`);
    else
        insights.push('✅ Sin patrones de riesgo ético significativos. El candidato muestra coherencia entre valores declarados y decisiones situacionales.');

    const gmaPct = Math.round((d.gma_score / 5) * 100);
    if (d.risk_score < 25)
        insights.push(`✅ RECOMENDADO — Contratación sugerida. GMA ${gmaPct}% · Integridad ${(10 - d.integrity_score).toFixed(1)}/10. Onboarding con metas claras alineadas al perfil ${d.color_perfil}.`);
    else if (d.risk_score < 50)
        insights.push(`🟡 CONDICIONAL — Período de prueba 90 días con seguimiento mensual. GMA ${gmaPct}% · Riesgo ${d.risk_score.toFixed(1)}%. Asignar mentor con perfil C complementario.`);
    else if (d.risk_score < 75)
        insights.push(`🟠 ALTO RIESGO — Entrevista psicotécnica adicional obligatoria. GMA ${gmaPct}% pero Integridad comprometida (${d.integrity_score.toFixed(1)}/10). No avanzar sin validación externa.`);
    else
        insights.push(`🔴 NO RECOMENDADO — Riesgo organizacional crítico (${d.risk_score.toFixed(1)}%). Dos o más indicadores oscuros superan el umbral de seguridad. Descarte del proceso recomendado.`);

    return insights;
}

const SEMAFORO: Record<string, { bg: string; border: string; text: string; label: string; emoji: string }> = {
    verde:    { bg: 'rgba(52,199,89,0.12)',  border: 'rgba(52,199,89,0.35)',  text: '#34C759', label: 'CANDIDATO RECOMENDADO',        emoji: '🟢' },
    amarillo: { bg: 'rgba(255,214,10,0.1)',  border: 'rgba(255,214,10,0.35)', text: '#FFD60A', label: 'REQUIERE EVALUACIÓN ADICIONAL', emoji: '🟡' },
    rojo:     { bg: 'rgba(255,59,48,0.12)',  border: 'rgba(255,59,48,0.35)',  text: '#FF3B30', label: 'CANDIDATO NO RECOMENDADO',      emoji: '🔴' },
};

const TAG_STYLE: Record<string, { bg: string; border: string; text: string; icon: string }> = {
    'ALTO RIESGO — MANIPULADOR':       { bg: 'rgba(255,59,48,0.15)',  border: 'rgba(255,59,48,0.5)',  text: '#FF3B30', icon: '🚨' },
    'RIESGO MODERADO — MONITOREAR':    { bg: 'rgba(255,149,0,0.12)', border: 'rgba(255,149,0,0.4)',  text: '#FF9500', icon: '⚠️' },
    'ALTA INTELIGENCIA — PERFIL SEGURO': { bg: 'rgba(52,199,89,0.12)', border: 'rgba(52,199,89,0.4)', text: '#34C759', icon: '✅' },
};

const DISC_COLOR: Record<string, string> = { D: '#FF3B30', I: '#FFD60A', S: '#34C759', C: '#00AEEF' };
const DISC_LABEL: Record<string, string> = { D: 'Rojo — Dominante', I: 'Amarillo — Influyente', S: 'Verde — Estable', C: 'Azul — Consciente' };

function HBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
    const pct = max > 0 ? Math.round((value / max) * 100) : 0;
    return (
        <div style={{ marginBottom: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.65)' }}>{label}</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color }}>{value}pts · {pct}%</span>
            </div>
            <div style={{ height: '9px', background: 'rgba(255,255,255,0.07)', borderRadius: '5px', overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '5px' }} />
            </div>
        </div>
    );
}

function DarkBar({ label, value, max }: { label: string; value: number; max: number }) {
    const pct = max > 0 ? Math.round((value / max) * 100) : 0;
    const color = pct > 65 ? '#FF3B30' : pct > 40 ? '#FF9500' : '#34C759';
    return (
        <div style={{ marginBottom: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: pct > 50 ? '#FF6B6B' : 'rgba(255,255,255,0.6)' }}>{label}</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color }}>{pct}%</span>
            </div>
            <div style={{ height: '9px', background: 'rgba(255,255,255,0.07)', borderRadius: '5px', overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '5px' }} />
            </div>
        </div>
    );
}

function GMADot({ idx, filled }: { idx: number; filled: boolean }) {
    return (
        <div style={{ width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800, background: filled ? 'linear-gradient(135deg,#00AEEF,#34C759)' : 'rgba(255,255,255,0.07)', color: filled ? '#000' : 'rgba(255,255,255,0.3)', border: filled ? 'none' : '1px solid rgba(255,255,255,0.1)' }}>
            {filled ? '✓' : idx + 1}
        </div>
    );
}

export default function ReporteEvaluacion() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [rejectionCopied, setRejectionCopied] = useState(false);
    const reportRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const supabase = createClient();
        supabase.from('evaluaciones').select('*').eq('id', id).single().then(({ data: ev }) => {
            setData(ev); setLoading(false);
        });
    }, [id]);

    const glass = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', backdropFilter: 'blur(20px)' };

    if (loading) return (
        <div style={{ minHeight: '100vh', background: '#0A0A0F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '40px', height: '40px', border: '3px solid rgba(255,214,10,0.15)', borderTopColor: '#FFD60A', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
        </div>
    );

    if (!data) return (
        <div style={{ minHeight: '100vh', background: '#0A0A0F', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter,sans-serif' }}>
            Evaluación no encontrada
        </div>
    );

    const pending = data.status !== 'completed';
    const sc = SEMAFORO[data.semaforo] ?? SEMAFORO.amarillo;
    const tag = data.logic_tag ? TAG_STYLE[data.logic_tag] : null;
    const insights = pending ? [] : generateInsights(data);
    const total = (data.disc_d || 0) + (data.disc_i || 0) + (data.disc_s || 0) + (data.disc_c || 0);
    const completedAt = data.completed_at ? new Date(data.completed_at).toLocaleString('es-VE') : null;
    const duration = data.started_at && data.completed_at
        ? Math.round((new Date(data.completed_at).getTime() - new Date(data.started_at).getTime()) / 1000) : null;

    const rejectionMsg = `Hola ${data.employee_name.split(' ')[0]} 👋. Gracias por participar en nuestro proceso de selección de CASA INTELIGENTE.\n\nLuego de revisar cuidadosamente tu evaluación, hemos decidido no continuar con tu candidatura en esta oportunidad.\n\nTe deseamos mucho éxito en tu búsqueda. ¡Adelante!`;

    function handlePrint() { window.print(); }
    async function copyRejection() {
        await navigator.clipboard.writeText(rejectionMsg);
        setRejectionCopied(true);
        setTimeout(() => setRejectionCopied(false), 2500);
    }

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-primary,#0A0A0F)', fontFamily: 'Inter,-apple-system,sans-serif', color: 'white', padding: '24px' }}>

            {/* ── Print styles injected ── */}
            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                @media print {
                    body { background: white !important; color: #111 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    .no-print { display: none !important; }
                    .print-section { background: #f8f8f8 !important; border: 1px solid #ddd !important; color: #111 !important; break-inside: avoid; margin-bottom: 16px; }
                    .print-white { color: #222 !important; }
                    .print-bar { background: #eee !important; }
                }
            `}</style>

            {/* ── Back + Print ── */}
            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <button onClick={() => router.push('/evaluaciones')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '14px', padding: 0, fontFamily: 'inherit' }}>
                    ← Evaluaciones
                </button>
                <button onClick={handlePrint} style={{ padding: '10px 18px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'white', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: '13px' }}>
                    🖨 Exportar PDF
                </button>
            </div>

            {/* ── CEO Header ── */}
            <div ref={reportRef} style={{ maxWidth: '780px', margin: '0 auto' }}>
                <div style={{ marginBottom: '28px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#FFD60A', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>
                        ⚡ Reporte Ejecutivo — Dashboard CEO · CASA INTELIGENTE
                    </div>
                    <h1 className="print-white" style={{ fontSize: '28px', fontWeight: 900, margin: '0 0 4px 0' }}>{data.employee_name}</h1>
                    <p style={{ margin: 0, color: 'rgba(255,255,255,0.35)', fontSize: '14px' }}>
                        Evaluación de Élite · {completedAt ?? 'En proceso…'}
                        {duration && <span style={{ marginLeft: '12px' }}>⏱ {Math.floor(duration / 60)}m {duration % 60}s</span>}
                    </p>
                </div>

                {pending ? (
                    <div className="print-section" style={{ ...glass, padding: '40px', textAlign: 'center' }}>
                        <div style={{ fontSize: '40px', marginBottom: '12px' }}>⏳</div>
                        <h2 style={{ color: '#FFD60A', marginBottom: '8px' }}>
                            {data.status === 'pending' ? 'Evaluación no iniciada' : data.disqualified ? '🚫 Candidato Descalificado' : 'Evaluación en progreso'}
                        </h2>
                        <p style={{ color: 'rgba(255,255,255,0.4)', margin: 0 }}>
                            {data.disqualified
                                ? `Motivo: ${data.disqualification_reason}`
                                : 'Los resultados aparecerán automáticamente cuando el candidato finalice.'}
                        </p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gap: '16px' }}>

                        {/* ── Disqualified banner ── */}
                        {data.disqualified && (
                            <div style={{ padding: '16px 20px', borderRadius: '16px', background: 'rgba(255,59,48,0.12)', border: '2px solid rgba(255,59,48,0.4)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{ fontSize: '24px' }}>🚫</span>
                                <div>
                                    <div style={{ fontWeight: 800, color: '#FF3B30', fontSize: '14px' }}>CANDIDATO DESCALIFICADO POR COMPORTAMIENTO</div>
                                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>{data.disqualification_reason ?? 'Infracción de seguridad durante la evaluación'}</div>
                                </div>
                            </div>
                        )}

                        {/* ── SEMÁFORO ── */}
                        <div className="print-section" style={{ ...glass, padding: '28px', background: sc.bg, border: `1px solid ${sc.border}`, textAlign: 'center' }}>
                            <div style={{ fontSize: '60px', marginBottom: '6px' }}>{sc.emoji}</div>
                            <div style={{ fontSize: '11px', fontWeight: 700, color: sc.text, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' }}>Dictamen del Sistema</div>
                            <h2 className="print-white" style={{ fontSize: '20px', fontWeight: 900, color: sc.text, margin: '0 0 16px 0' }}>{sc.label}</h2>

                            {/* Risk gauge */}
                            <div style={{ maxWidth: '360px', margin: '0 auto' }}>
                                <div className="print-bar" style={{ height: '14px', background: 'rgba(255,255,255,0.1)', borderRadius: '7px', overflow: 'hidden', position: 'relative', marginBottom: '6px' }}>
                                    <div style={{ width: `${data.risk_score}%`, height: '100%', background: 'linear-gradient(90deg,#34C759 0%,#FFD60A 40%,#FF9500 65%,#FF3B30 100%)', borderRadius: '7px' }} />
                                </div>
                                <div style={{ textAlign: 'center', fontSize: '22px', fontWeight: 900, color: sc.text }}>
                                    Nivel de Riesgo: {data.risk_score?.toFixed(1)}%
                                </div>
                            </div>

                            {/* Cross-check TAG */}
                            {tag && (
                                <div style={{ marginTop: '16px', display: 'inline-flex', alignItems: 'center', gap: '10px', padding: '10px 20px', borderRadius: '12px', background: tag.bg, border: `1.5px solid ${tag.border}` }}>
                                    <span style={{ fontSize: '18px' }}>{tag.icon}</span>
                                    <span style={{ fontSize: '13px', fontWeight: 800, color: tag.text, letterSpacing: '0.5px' }}>
                                        {data.logic_tag}
                                    </span>
                                </div>
                            )}

                            {data.tab_changes > 0 && (
                                <div style={{ marginTop: '12px', padding: '8px 16px', background: 'rgba(255,59,48,0.12)', borderRadius: '10px', border: '1px solid rgba(255,59,48,0.25)', fontSize: '12px', color: '#FF3B30', fontWeight: 600 }}>
                                    ⚠️ {data.tab_changes} cambio(s) de ventana · {data.disqualified ? 'Candidato descalificado' : 'Registrado en expediente'}
                                </div>
                            )}
                        </div>

                        {/* ── TRES EJES ── */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '16px' }}>

                            {/* EJE X — DISC */}
                            <div className="print-section" style={{ ...glass, padding: '22px' }}>
                                <div style={{ fontSize: '10px', fontWeight: 700, color: '#00AEEF', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' }}>EJE X · Perfil DISC</div>
                                <div style={{ marginBottom: '16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: DISC_COLOR[data.dominant_disc], flexShrink: 0 }} />
                                        <span className="print-white" style={{ fontWeight: 800, fontSize: '14px', color: DISC_COLOR[data.dominant_disc] }}>
                                            {DISC_LABEL[data.dominant_disc]}
                                        </span>
                                    </div>
                                </div>
                                <HBar label="D — Dominante" value={data.disc_d || 0} max={total} color={DISC_COLOR.D} />
                                <HBar label="I — Influyente" value={data.disc_i || 0} max={total} color={DISC_COLOR.I} />
                                <HBar label="S — Estable" value={data.disc_s || 0} max={total} color={DISC_COLOR.S} />
                                <HBar label="C — Consciente" value={data.disc_c || 0} max={total} color={DISC_COLOR.C} />
                            </div>

                            {/* EJE Y — INTEGRIDAD */}
                            <div className="print-section" style={{ ...glass, padding: '22px' }}>
                                <div style={{ fontSize: '10px', fontWeight: 700, color: '#FF9500', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' }}>EJE Y · Integridad (0–10)</div>
                                <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                                    <span style={{ fontSize: '40px', fontWeight: 900, color: (data.integrity_score || 0) > 6 ? '#FF3B30' : (data.integrity_score || 0) > 3 ? '#FF9500' : '#34C759', lineHeight: 1 }}>
                                        {(data.integrity_score || 0).toFixed(1)}
                                    </span>
                                    <span style={{ fontSize: '16px', color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>/10</span>
                                    <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>Alto = Mayor Riesgo</span>
                                </div>
                                <DarkBar label="Psicopatía (max 7)" value={data.dark_psy || 0} max={7} />
                                <DarkBar label="Narcisismo (max 9)" value={data.dark_nar || 0} max={9} />
                                <DarkBar label="Locus Externo (max 6)" value={data.dark_irr || 0} max={6} />
                                {(data.dominant_disc === 'D' && (data.dark_psy / 7) > 0.5) && (
                                    <div style={{ padding: '8px 12px', background: 'rgba(255,59,48,0.1)', borderRadius: '8px', fontSize: '11px', color: '#FF3B30', fontWeight: 700, marginTop: '8px' }}>
                                        🔺 Perfil D + PSY elevada — Riesgo en liderazgo
                                    </div>
                                )}
                            </div>

                            {/* EJE Z — GMA LÓGICA */}
                            <div className="print-section" style={{ ...glass, padding: '22px' }}>
                                <div style={{ fontSize: '10px', fontWeight: 700, color: '#34C759', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' }}>EJE Z · Lógica GMA (0–5)</div>
                                <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                                    <span style={{ fontSize: '40px', fontWeight: 900, lineHeight: 1, color: (data.gma_score || 0) >= 4 ? '#34C759' : (data.gma_score || 0) >= 2 ? '#FFD60A' : '#FF3B30' }}>
                                        {data.gma_score ?? 0}
                                    </span>
                                    <span style={{ fontSize: '16px', color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>/5</span>
                                </div>
                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '16px' }}>
                                    {[0, 1, 2, 3, 4].map(i => (
                                        <GMADot key={i} idx={i} filled={i < (data.gma_score || 0)} />
                                    ))}
                                </div>
                                <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.04)', borderRadius: '10px', fontSize: '12px', color: 'rgba(255,255,255,0.45)', textAlign: 'center' }}>
                                    {(data.gma_score || 0) >= 4 ? '🧠 Alta capacidad analítica detectada'
                                        : (data.gma_score || 0) >= 2 ? '🟡 Capacidad lógica media'
                                        : '⚠️ Capacidad lógica limitada'}
                                </div>
                                {tag && (
                                    <div style={{ marginTop: '12px', padding: '10px 12px', background: tag.bg, borderRadius: '10px', border: `1px solid ${tag.border}`, fontSize: '12px', color: tag.text, fontWeight: 700, textAlign: 'center' }}>
                                        {tag.icon} {data.logic_tag}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ── ASESORÍA IA ── */}
                        <div className="print-section" style={{ ...glass, padding: '24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                                <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: 'linear-gradient(135deg,#FFD60A,#FF9500)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>🤖</div>
                                <div>
                                    <h3 className="print-white" style={{ margin: 0, fontSize: '15px', fontWeight: 800 }}>Asesoría de IA — 3 Puntos Clave del CEO</h3>
                                    <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>Análisis cruzado Eje X × Eje Y × Eje Z</p>
                                </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {insights.map((insight, i) => {
                                    const borderColor = i === 0 ? '#00AEEF' : i === 1 ? '#FF9500' : sc.text;
                                    return (
                                        <div key={i} style={{ display: 'flex', gap: '12px', padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', borderLeft: `3px solid ${borderColor}` }}>
                                            <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: `${borderColor}18`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '12px', color: borderColor }}>
                                                {i + 1}
                                            </div>
                                            <p className="print-white" style={{ margin: 0, fontSize: '13px', lineHeight: 1.75, color: 'rgba(255,255,255,0.72)' }}>{insight}</p>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* ── Metadata ── */}
                        <div className="print-section" style={{ ...glass, padding: '18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: '10px' }}>
                            {[
                                { label: 'Estado', value: data.disqualified ? '🚫 Descalificado' : data.status },
                                { label: 'Respondidas', value: `${(data.answers || []).filter((a: number) => a >= 0).length}/20 + ${data.gma_score !== null ? data.gma_score : '?'}/5` },
                                { label: 'Duración', value: duration ? `${Math.floor(duration / 60)}m ${duration % 60}s` : '—' },
                                { label: 'Salidas ventana', value: data.tab_changes ?? 0 },
                                { label: 'Semáforo', value: data.semaforo ?? '—' },
                                { label: 'Color DISC', value: data.color_perfil ?? '—' },
                            ].map(item => (
                                <div key={item.label} style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px' }}>
                                    <p style={{ margin: '0 0 4px 0', fontSize: '10px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>{item.label}</p>
                                    <p className="print-white" style={{ margin: 0, fontSize: '13px', fontWeight: 700 }}>{item.value}</p>
                                </div>
                            ))}
                        </div>

                        {/* ── Rejection WhatsApp (only if rojo or disqualified) ── */}
                        {(data.semaforo === 'rojo' || data.disqualified) && (
                            <div className="print-section no-print" style={{ ...glass, padding: '20px', background: 'rgba(37,211,102,0.05)', border: '1px solid rgba(37,211,102,0.15)' }}>
                                <p style={{ margin: '0 0 10px 0', fontSize: '12px', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    📨 Mensaje de Rechazo — WhatsApp
                                </p>
                                <div style={{ padding: '14px', background: 'rgba(37,211,102,0.06)', borderRadius: '10px', border: '1px solid rgba(37,211,102,0.12)', fontSize: '13px', lineHeight: 1.75, color: 'rgba(255,255,255,0.7)', whiteSpace: 'pre-wrap', marginBottom: '12px' }}>
                                    {rejectionMsg}
                                </div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button onClick={copyRejection} style={{ flex: 1, padding: '11px', borderRadius: '11px', border: '1px solid rgba(255,255,255,0.1)', background: rejectionCopied ? 'rgba(52,199,89,0.15)' : 'rgba(255,255,255,0.05)', color: rejectionCopied ? '#34C759' : 'white', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: '13px' }}>
                                        {rejectionCopied ? '✓ Copiado' : '📋 Copiar Mensaje'}
                                    </button>
                                    <button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(rejectionMsg)}`, '_blank')} style={{ flex: 1, padding: '11px', borderRadius: '11px', border: 'none', background: 'linear-gradient(135deg,#25D366,#128C7E)', color: 'white', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: '13px' }}>
                                        💬 Enviar vía WhatsApp
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* ── Actions ── */}
                        <div className="no-print" style={{ display: 'flex', gap: '10px' }}>
                            <button onClick={handlePrint} style={{ flex: 1, padding: '14px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'white', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: '14px' }}>
                                🖨 Imprimir / PDF
                            </button>
                            {data.employee_id && (
                                <button onClick={() => router.push(`/empleados/${data.employee_id}`)} style={{ flex: 1, padding: '14px', borderRadius: '14px', border: '1px solid rgba(0,174,239,0.3)', background: 'rgba(0,174,239,0.08)', color: '#00AEEF', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: '14px' }}>
                                    👤 Perfil Empleado
                                </button>
                            )}
                        </div>

                    </div>
                )}
            </div>
        </div>
    );
}
