'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

const statusColors: Record<string, { bg: string; text: string }> = {
    activo:     { bg: 'rgba(52,199,89,0.15)',  text: '#34C759' },
    inactivo:   { bg: 'rgba(255,59,48,0.15)',  text: '#FF3B30' },
    permiso:    { bg: 'rgba(255,149,0,0.15)',  text: '#FF9500' },
    vacaciones: { bg: 'rgba(0,174,239,0.15)',  text: '#00AEEF' },
};

const NIVELES_COLOR: Record<string, string> = {
    Excelente: '#34C759', Bueno: '#00AEEF', Regular: '#FF9500', Bajo: '#FF3B30', Ninguno: 'rgba(255,255,255,0.2)',
};

const EVAL_STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
    pending:   { label: 'Esperando',   bg: 'rgba(255,214,10,0.12)', text: '#FFD60A' },
    started:   { label: 'En Progreso', bg: 'rgba(0,174,239,0.12)',  text: '#00AEEF' },
    completed: { label: 'Completada',  bg: 'rgba(52,199,89,0.12)',  text: '#34C759' },
    expired:   { label: 'Expirada',    bg: 'rgba(255,59,48,0.12)',  text: '#FF3B30' },
};

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string | number | null | undefined }) {
    if (!value && value !== 0) return null;
    return (
        <div style={{ display: 'flex', gap: '10px', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <span style={{ fontSize: '16px', width: '22px', flexShrink: 0 }}>{icon}</span>
            <div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginBottom: '2px' }}>{label}</div>
                <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>{String(value)}</div>
            </div>
        </div>
    );
}

export default function EmpleadoDetailPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const [emp, setEmp] = useState<any>(null);
    const [evaluations, setEvaluations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState(0);

    useEffect(() => {
        async function load() {
            const supabase = createClient();
            const { data: eData } = await supabase.from('employees').select('*').eq('id', id).single();
            setEmp(eData);

            const { data: evData } = await supabase
                .from('evaluaciones')
                .select('*')
                .eq('employee_id', id)
                .order('created_at', { ascending: false });
            setEvaluations(evData || []);

            setLoading(false);
        }
        load();
    }, [id]);

    async function deleteEmployee() {
        if (!confirm('¿Eliminar este empleado? Esta acción no se puede deshacer.')) return;
        const supabase = createClient();
        await supabase.from('employees').delete().eq('id', id);
        router.push('/empleados');
    }

    const glass = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', backdropFilter: 'blur(20px)' };
    const TABS = ['Resumen', 'Formación', 'Experiencia', 'Conocimientos', 'Médico', 'Vehículo', 'Referencias', 'Evaluaciones'];

    if (loading) return <div style={{ minHeight: '100vh', background: '#0A0A0F', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter,sans-serif' }}>Cargando…</div>;
    if (!emp) return <div style={{ minHeight: '100vh', background: '#0A0A0F', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter,sans-serif' }}>Empleado no encontrado</div>;

    const sc = statusColors[emp.estatus] ?? statusColors.activo;
    const initials = `${(emp.nombres||'?')[0]}${(emp.apellidos||'?')[0]}`.toUpperCase();

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-primary,#0A0A0F)', fontFamily: 'Inter,-apple-system,sans-serif', color: 'white', padding: '24px' }}>

            {/* Back */}
            <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '14px', padding: 0, marginBottom: '20px', fontFamily: 'inherit' }}>
                ← Empleados
            </button>

            {/* Hero Card */}
            <div style={{ ...glass, padding: '28px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    {emp.foto_url ? (
                        <img src={emp.foto_url} alt={emp.nombres} style={{ width: '90px', height: '90px', borderRadius: '50%', objectFit: 'cover', border: '3px solid rgba(0,174,239,0.4)', flexShrink: 0 }} />
                    ) : (
                        <div style={{ width: '90px', height: '90px', borderRadius: '50%', background: 'linear-gradient(135deg,#00AEEF,#0055CC)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', fontWeight: 800, color: 'white', flexShrink: 0 }}>
                            {initials}
                        </div>
                    )}
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '6px' }}>
                            <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0 }}>{emp.apellidos}, {emp.nombres}</h1>
                            <span style={{ fontSize: '12px', fontWeight: 600, padding: '4px 12px', borderRadius: '10px', background: sc.bg, color: sc.text }}>
                                {emp.estatus}
                            </span>
                        </div>
                        <p style={{ color: 'rgba(255,255,255,0.5)', margin: '0 0 4px 0', fontSize: '15px' }}>{emp.cargo}{emp.departamento ? ` · ${emp.departamento}` : ''}</p>
                        <p style={{ color: 'rgba(255,255,255,0.3)', margin: 0, fontSize: '13px' }}>C.I. {emp.cedula}{emp.rif ? ` · RIF: ${emp.rif}` : ''}</p>
                        {emp.tipo_sangre && (
                            <span style={{ display: 'inline-block', marginTop: '10px', padding: '4px 12px', borderRadius: '8px', background: 'rgba(255,59,48,0.15)', color: '#FF3B30', fontSize: '13px', fontWeight: 700 }}>
                                🩸 {emp.tipo_sangre}
                            </span>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <button onClick={() => router.push(`/evaluaciones/nueva?empleadoId=${id}`)} style={{ padding: '10px 18px', borderRadius: '12px', border: '1px solid rgba(255,214,10,0.4)', background: 'rgba(255,214,10,0.1)', color: '#FFD60A', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: '14px' }}>
                            ⚡ Evaluar
                        </button>
                        <button onClick={() => router.push(`/empleados/${id}/editar`)} style={{ padding: '10px 18px', borderRadius: '12px', border: '1px solid rgba(0,174,239,0.4)', background: 'rgba(0,174,239,0.1)', color: '#00AEEF', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: '14px' }}>
                            ✏️ Editar
                        </button>
                        <button onClick={deleteEmployee} style={{ padding: '10px 18px', borderRadius: '12px', border: '1px solid rgba(255,59,48,0.3)', background: 'rgba(255,59,48,0.08)', color: '#FF3B30', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: '14px' }}>
                            🗑
                        </button>
                    </div>
                </div>

                {/* Quick Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: '12px', marginTop: '24px', paddingTop: '24px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    {[
                        { icon: '📅', label: 'Ingreso', value: emp.fecha_ingreso ? new Date(emp.fecha_ingreso).toLocaleDateString('es-VE') : '—' },
                        { icon: '💰', label: 'Salario', value: emp.salario ? `$${Number(emp.salario).toLocaleString()}` : '—' },
                        { icon: '📍', label: 'Ciudad', value: emp.ciudad || '—' },
                        { icon: '📞', label: 'Celular', value: emp.celular || '—' },
                        { icon: '✉️', label: 'Email', value: emp.email || '—' },
                    ].map(stat => (
                        <div key={stat.label} style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px' }}>
                            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginBottom: '4px' }}>{stat.icon} {stat.label}</div>
                            <div style={{ fontSize: '13px', color: 'white', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stat.value}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', flexWrap: 'wrap' }}>
                {TABS.map((tab, i) => (
                    <button key={tab} onClick={() => setActiveTab(i)} style={{ padding: '8px 16px', borderRadius: '10px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, fontFamily: 'inherit', background: activeTab === i ? 'rgba(0,174,239,0.2)' : 'rgba(255,255,255,0.04)', color: activeTab === i ? '#00AEEF' : 'rgba(255,255,255,0.45)', border: activeTab === i ? '1px solid rgba(0,174,239,0.4)' : '1px solid rgba(255,255,255,0.06)' }}>
                        {tab}
                    </button>
                ))}
            </div>

            {/* TAB: Resumen */}
            {activeTab === 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div style={{ ...glass, padding: '20px' }}>
                        <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: 700, color: '#00AEEF' }}>Datos Personales</h3>
                        <InfoRow icon="🪪" label="Cédula" value={emp.cedula} />
                        <InfoRow icon="📋" label="RIF" value={emp.rif} />
                        <InfoRow icon="🎂" label="Fecha Nacimiento" value={emp.fecha_nacimiento ? new Date(emp.fecha_nacimiento).toLocaleDateString('es-VE') : null} />
                        <InfoRow icon="💍" label="Estado Civil" value={emp.estado_civil} />
                        <InfoRow icon="🌎" label="Nacionalidad" value={emp.nacionalidad} />
                        <InfoRow icon="👶" label="Hijos" value={emp.hijos} />
                        <InfoRow icon="🏠" label="Dirección" value={emp.direccion} />
                        <InfoRow icon="🏙️" label="Ciudad / Estado" value={[emp.ciudad, emp.estado].filter(Boolean).join(', ')} />
                        <InfoRow icon="📞" label="Tel. Habitación" value={emp.telefono_habitacion} />
                    </div>
                    <div style={{ ...glass, padding: '20px' }}>
                        <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: 700, color: '#00AEEF' }}>Información Laboral</h3>
                        <InfoRow icon="💼" label="Cargo" value={emp.cargo} />
                        <InfoRow icon="🏢" label="Departamento" value={emp.departamento} />
                        <InfoRow icon="📅" label="Fecha Ingreso" value={emp.fecha_ingreso ? new Date(emp.fecha_ingreso).toLocaleDateString('es-VE') : null} />
                        <InfoRow icon="💰" label="Salario" value={emp.salario ? `$${Number(emp.salario).toLocaleString('en-US',{minimumFractionDigits:2})}` : null} />
                        <InfoRow icon="🏦" label="Banco" value={emp.banco} />
                        <InfoRow icon="🔢" label="Cuenta" value={emp.cuenta_bancaria} />
                        <InfoRow icon="🛡️" label="IVSS" value={emp.ivss} />
                        <InfoRow icon="⏰" label="Disponibilidad" value={emp.disponibilidad} />
                        {emp.areas_interes?.length > 0 && (
                            <div style={{ paddingTop: '10px' }}>
                                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginBottom: '8px' }}>Áreas de Interés</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                    {emp.areas_interes.map((a: string) => <span key={a} style={{ padding: '3px 10px', borderRadius: '8px', background: 'rgba(0,174,239,0.12)', color: '#00AEEF', fontSize: '12px', fontWeight: 600 }}>{a}</span>)}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB: Formación */}
            {activeTab === 1 && (
                <div style={{ ...glass, padding: '24px' }}>
                    <h3 style={{ margin: '0 0 20px 0', fontSize: '16px', fontWeight: 700, color: '#00AEEF' }}>Estudios Efectuados</h3>
                    {(emp.estudios||[]).filter((e:any) => e.institucion).length === 0 ? (
                        <p style={{ color: 'rgba(255,255,255,0.3)' }}>Sin estudios registrados</p>
                    ) : (
                        <div style={{ display: 'grid', gap: '12px' }}>
                            {(emp.estudios||[]).filter((e:any) => e.institucion).map((est:any, i:number) => (
                                <div key={i} style={{ padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#00AEEF' }}>{est.tipo}</span>
                                        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>{est.anio}</span>
                                    </div>
                                    <p style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 600 }}>{est.institucion}</p>
                                    {est.titulo && <p style={{ margin: '0', fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>📜 {est.titulo}</p>}
                                    {est.ciudad && <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}>📍 {est.ciudad}</p>}
                                </div>
                            ))}
                        </div>
                    )}
                    {emp.estudios_actuales?.carrera && (
                        <div style={{ marginTop: '20px', padding: '16px', background: 'rgba(0,174,239,0.08)', borderRadius: '12px', border: '1px solid rgba(0,174,239,0.2)' }}>
                            <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#00AEEF', fontWeight: 700 }}>Estudios Actuales</p>
                            <p style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>{emp.estudios_actuales.carrera}</p>
                            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>{emp.estudios_actuales.instituto} · Semestre {emp.estudios_actuales.semestre}</p>
                        </div>
                    )}
                    {(emp.cursos||[]).filter((c:any) => c.nombre).length > 0 && (
                        <>
                            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#00AEEF', marginTop: '28px', marginBottom: '16px' }}>Cursos</h3>
                            <div style={{ display: 'grid', gap: '10px' }}>
                                {(emp.cursos||[]).filter((c:any) => c.nombre).map((cur:any, i:number) => (
                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px' }}>
                                        <div>
                                            <p style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>{cur.nombre}</p>
                                            <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>{cur.organizado_por} · {cur.ciudad}</p>
                                        </div>
                                        <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}>{cur.anio}</span>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* TAB: Experiencia */}
            {activeTab === 2 && (
                <div style={{ ...glass, padding: '24px' }}>
                    <h3 style={{ margin: '0 0 20px 0', fontSize: '16px', fontWeight: 700, color: '#00AEEF' }}>Experiencia Laboral</h3>
                    {(emp.experiencia||[]).filter((e:any) => e.empresa).length === 0 ? (
                        <p style={{ color: 'rgba(255,255,255,0.3)' }}>Sin experiencia registrada</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            {(emp.experiencia||[]).filter((e:any) => e.empresa).map((ex:any, i:number) => (
                                <div key={i} style={{ padding: '18px', background: 'rgba(255,255,255,0.03)', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.07)', borderLeft: '3px solid #00AEEF' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                                        <div>
                                            <p style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>{ex.cargo}</p>
                                            <p style={{ margin: '2px 0 0 0', fontSize: '14px', color: 'rgba(255,255,255,0.6)' }}>{ex.empresa}</p>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>{ex.desde} — {ex.hasta || 'Actual'}</p>
                                            {ex.ciudad && <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}>📍 {ex.ciudad}</p>}
                                        </div>
                                    </div>
                                    {ex.supervisor && <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>👤 Supervisor: {ex.supervisor}</p>}
                                    {ex.motivo_retiro && <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'rgba(255,149,0,0.7)' }}>↪ Motivo retiro: {ex.motivo_retiro}</p>}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* TAB: Conocimientos */}
            {activeTab === 3 && (
                <div style={{ display: 'grid', gap: '16px' }}>
                    <div style={{ ...glass, padding: '24px' }}>
                        <h3 style={{ margin: '0 0 20px 0', fontSize: '16px', fontWeight: 700, color: '#00AEEF' }}>Software</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: '10px' }}>
                            {[['Windows', emp.software_windows],['Word', emp.software_word],['Excel', emp.software_excel],['PowerPoint', emp.software_powerpoint],['Prog. Admin.', emp.software_admin],['Internet', emp.software_internet]].map(([label, nivel]) => (
                                nivel && nivel !== 'Ninguno' && (
                                    <div key={label} style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', textAlign: 'center' }}>
                                        <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>{label}</p>
                                        <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: NIVELES_COLOR[nivel] || '#fff' }}>{nivel}</p>
                                    </div>
                                )
                            ))}
                        </div>
                    </div>
                    {(emp.idiomas||[]).filter((i:any) => i.idioma).length > 0 && (
                        <div style={{ ...glass, padding: '24px' }}>
                            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 700, color: '#00AEEF' }}>Idiomas</h3>
                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                {(emp.idiomas||[]).filter((i:any) => i.idioma).map((id:any, i:number) => (
                                    <div key={i} style={{ padding: '10px 16px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', textAlign: 'center' }}>
                                        <p style={{ margin: '0 0 2px 0', fontSize: '14px', fontWeight: 700 }}>{id.idioma}</p>
                                        <p style={{ margin: 0, fontSize: '12px', color: NIVELES_COLOR[id.nivel] || 'rgba(255,255,255,0.4)' }}>{id.nivel}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {emp.areas_conocimiento && (
                        <div style={{ ...glass, padding: '24px' }}>
                            <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 700, color: '#00AEEF' }}>Áreas Específicas</h3>
                            <p style={{ color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, margin: 0 }}>{emp.areas_conocimiento}</p>
                        </div>
                    )}
                </div>
            )}

            {/* TAB: Médico */}
            {activeTab === 4 && (
                <div style={{ ...glass, padding: '24px' }}>
                    <h3 style={{ margin: '0 0 20px 0', fontSize: '16px', fontWeight: 700, color: '#00AEEF' }}>Datos Médicos</h3>
                    {emp.tipo_sangre && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '12px', background: 'rgba(255,59,48,0.15)', border: '1px solid rgba(255,59,48,0.3)', marginBottom: '20px' }}>
                            <span style={{ fontSize: '24px' }}>🩸</span>
                            <div>
                                <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255,59,48,0.7)' }}>Tipo de Sangre</p>
                                <p style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: '#FF3B30' }}>{emp.tipo_sangre}</p>
                            </div>
                        </div>
                    )}
                    <div style={{ display: 'grid', gap: '12px' }}>
                        {emp.certificado_medico_grado && (
                            <div style={{ padding: '14px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px' }}>
                                <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>Certificado Médico</p>
                                <p style={{ margin: 0, fontWeight: 600 }}>{emp.certificado_medico_grado}</p>
                                {emp.certificado_medico_vencimiento && <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#FF9500' }}>Vence: {new Date(emp.certificado_medico_vencimiento).toLocaleDateString('es-VE')}</p>}
                            </div>
                        )}
                        <InfoRow icon="🏥" label="Enfermedades Crónicas" value={emp.enfermedades} />
                        <InfoRow icon="⚠️" label="Alergias" value={emp.alergias} />
                        <InfoRow icon="💊" label="Tratamientos Actuales" value={emp.tratamientos} />
                    </div>
                </div>
            )}

            {/* TAB: Vehículo */}
            {activeTab === 5 && (
                <div style={{ ...glass, padding: '24px' }}>
                    <h3 style={{ margin: '0 0 20px 0', fontSize: '16px', fontWeight: 700, color: '#00AEEF' }}>Vehículo & Documentos</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div style={{ padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px' }}>
                            <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>Vehículo Propio</p>
                            <p style={{ margin: 0, fontWeight: 700, color: emp.vehiculo_propio ? '#34C759' : '#FF3B30' }}>{emp.vehiculo_propio ? '✓ Sí' : '✗ No'}</p>
                        </div>
                        {emp.vehiculo_propio && <>
                            <InfoRow icon="🚗" label="Marca" value={emp.vehiculo_marca} />
                            <InfoRow icon="📅" label="Año" value={emp.vehiculo_anio} />
                        </>}
                    </div>
                    {emp.licencia_grado && (
                        <div style={{ marginTop: '20px', padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px' }}>
                            <p style={{ margin: '0 0 6px 0', fontSize: '13px', fontWeight: 700, color: '#00AEEF' }}>🪪 Licencia de Conducir</p>
                            <p style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 600 }}>Grado: {emp.licencia_grado}</p>
                            {emp.licencia_vencimiento && <p style={{ margin: 0, fontSize: '12px', color: '#FF9500' }}>Vence: {new Date(emp.licencia_vencimiento).toLocaleDateString('es-VE')}</p>}
                        </div>
                    )}
                    <InfoRow icon="🚦" label="Infracciones" value={emp.infracciones} />
                    <InfoRow icon="💥" label="Accidentes" value={emp.accidentes} />
                    <InfoRow icon="🚌" label="Medio de Transporte" value={emp.medio_transporte} />
                </div>
            )}

            {/* TAB: Referencias */}
            {activeTab === 6 && (
                <div style={{ display: 'grid', gap: '16px' }}>
                    {(emp.referencias||[]).filter((r:any) => r.nombre).length > 0 && (
                        <div style={{ ...glass, padding: '24px' }}>
                            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 700, color: '#00AEEF' }}>Referencias Personales</h3>
                            <div style={{ display: 'grid', gap: '10px' }}>
                                {emp.referencias.filter((r:any) => r.nombre).map((ref:any, i:number) => (
                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '14px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', flexWrap: 'wrap', gap: '10px' }}>
                                        <div>
                                            <p style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>{ref.nombre}</p>
                                            <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'rgba(255,255,255,0.45)' }}>{ref.profesion} · {ref.nexo}</p>
                                        </div>
                                        <p style={{ margin: 0, fontSize: '13px', color: '#00AEEF' }}>{ref.telefono}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {(emp.afiliaciones||[]).filter((a:any) => a.gremio).length > 0 && (
                        <div style={{ ...glass, padding: '24px' }}>
                            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 700, color: '#00AEEF' }}>Afiliaciones a Gremios</h3>
                            <div style={{ display: 'grid', gap: '10px' }}>
                                {emp.afiliaciones.filter((a:any) => a.gremio).map((af:any, i:number) => (
                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', flexWrap: 'wrap', gap: '8px' }}>
                                        <div>
                                            <p style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>{af.gremio}</p>
                                            <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>Desde {af.desde_anio} · {af.ciudad}</p>
                                        </div>
                                        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}>#{af.nro}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* TAB: Evaluaciones */}
            {activeTab === 7 && (
                <div style={{ ...glass, padding: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#FFD60A' }}>Historial de Evaluaciones</h3>
                        {emp.celular && (
                            <a 
                                href={`https://wa.me/${emp.celular.replace(/\D/g,'')}`} 
                                target="_blank" 
                                rel="noreferrer"
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '10px', background: 'rgba(37,211,102,0.1)', color: '#25D366', textDecoration: 'none', fontSize: '13px', fontWeight: 700, border: '1px solid rgba(37,211,102,0.2)' }}
                            >
                                💬 WhatsApp
                            </a>
                        )}
                    </div>

                    {evaluations.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px', background: 'rgba(255,255,255,0.02)', borderRadius: '16px' }}>
                            <p style={{ color: 'rgba(255,255,255,0.3)', margin: 0 }}>No hay evaluaciones registradas para este candidato.</p>
                            <button onClick={() => router.push(`/evaluaciones/nueva?empleadoId=${id}`)} style={{ marginTop: '16px', background: 'none', border: '1px solid #FFD60A', color: '#FFD60A', padding: '8px 16px', borderRadius: '10px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                                Enviar primera evaluación
                            </button>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {evaluations.map(ev => {
                                const sc = EVAL_STATUS_CONFIG[ev.status] ?? EVAL_STATUS_CONFIG.pending;
                                const isCompleted = ev.status === 'completed';
                                return (
                                    <div key={ev.id} style={{ padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                                                <span style={{ fontSize: '11px', fontWeight: 800, padding: '3px 10px', borderRadius: '8px', background: sc.bg, color: sc.text, textTransform: 'uppercase' }}>
                                                    {sc.label}
                                                </span>
                                                <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}>
                                                    {new Date(ev.created_at).toLocaleDateString('es-VE')} {new Date(ev.created_at).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            {isCompleted && ev.semaforo && (
                                                <div style={{ fontSize: '13px', fontWeight: 600, color: ev.semaforo === 'rojo' ? '#FF3B30' : ev.semaforo === 'amarillo' ? '#FFD60A' : '#34C759' }}>
                                                    {ev.semaforo === 'rojo' ? '🔴 Alto Riesgo' : ev.semaforo === 'amarillo' ? '🟡 Condicional' : '🟢 Recomendado'}
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            {isCompleted ? (
                                                <Link 
                                                    href={`/evaluaciones/${ev.id}/reporte`}
                                                    style={{ padding: '8px 16px', borderRadius: '10px', background: 'linear-gradient(135deg,#FFD60A,#FF9500)', color: '#000', fontWeight: 700, fontSize: '13px', textDecoration: 'none' }}
                                                >
                                                    📊 Ver Reporte
                                                </Link>
                                            ) : (
                                                <span style={{ padding: '8px 16px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)', fontSize: '13px', fontWeight: 600 }}>
                                                    En espera...
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
