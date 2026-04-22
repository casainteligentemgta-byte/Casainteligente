'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import GeneradorHojaVida from '@/components/reclutamiento/GeneradorHojaVida';
import { UserPlus, FileText, Clock, CheckCircle, AlertCircle, Search, Briefcase } from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; icon: any }> = {
    prospecto_invitado: { label: 'Invitado', bg: 'rgba(59,130,246,0.1)', text: '#3B82F6', icon: Clock },
    en_evaluacion:      { label: 'En Proceso', bg: 'rgba(245,158,11,0.1)', text: '#F59E0B', icon: Clock },
    completado:         { label: 'Completado', bg: 'rgba(16,185,129,0.1)', text: '#10B981', icon: CheckCircle },
    descartado:         { label: 'Descartado', bg: 'rgba(239,68,68,0.1)', text: '#EF4444', icon: AlertCircle },
};

export default function ReclutamientoPage() {
    const router = useRouter();
    const [candidates, setCandidates] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [isInviting, setIsInviting] = useState(false);

    useEffect(() => {
        load();
        const iv = setInterval(load, 30_000);
        return () => clearInterval(iv);
    }, []);

    async function load() {
        const supabase = createClient();
        const { data, error } = await supabase
            .from('ci_empleados')
            .select('*, ci_hojas_vida(*)')
            .order('created_at', { ascending: false });
        
        if (!error && data) {
            setCandidates(data);
        }
        setLoading(false);
    }

    const filtered = candidates.filter(c =>
        c.nombres.toLowerCase().includes(search.toLowerCase()) ||
        c.cargo.toLowerCase().includes(search.toLowerCase())
    );

    const stats = {
        total: candidates.length,
        invited: candidates.filter(c => c.estado_proceso === 'prospecto_invitado').length,
        completed: candidates.filter(c => c.estado_proceso === 'completado').length,
    };

    const glass = { 
        background: 'rgba(255,255,255,0.04)', 
        border: '1px solid rgba(255,255,255,0.08)', 
        borderRadius: '24px', 
        backdropFilter: 'blur(20px)' 
    };

    return (
        <div className="min-h-screen bg-[#0A0A0F] text-white p-6 pb-32 font-sans">
            {/* Header */}
            <div className="flex justify-between items-start mb-8 flex-wrap gap-4">
                <div>
                    <h1 className="text-3xl font-black bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
                        Reclutamiento de Élite
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">Gestión de Hojas de Vida y Onboarding</p>
                </div>
                <button
                    onClick={() => setIsInviting(true)}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-blue-600/20 active:scale-95"
                >
                    <UserPlus size={20} />
                    Invitar Candidato
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                {[
                    { label: 'Total Postulados', value: stats.total, color: 'text-blue-400' },
                    { label: 'Invitaciones Pendientes', value: stats.invited, color: 'text-amber-400' },
                    { label: 'Hojas de Vida Listas', value: stats.completed, color: 'text-emerald-400' },
                ].map((s, i) => (
                    <div key={i} style={glass} className="p-6 text-center">
                        <div className={`text-3xl font-black ${s.color}`}>{s.value}</div>
                        <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mt-1">{s.label}</div>
                    </div>
                ))}
            </div>

            {/* Search */}
            <div className="relative mb-6">
                <Search className="absolute left-4 top-3.5 text-gray-500" size={20} />
                <input
                    type="text"
                    placeholder="Buscar por nombre o cargo..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-white outline-none focus:border-blue-500 transition-all"
                />
            </div>

            {/* List */}
            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                </div>
            ) : filtered.length === 0 ? (
                <div style={glass} className="p-20 text-center">
                    <FileText className="mx-auto text-gray-700 mb-4" size={64} />
                    <p className="text-gray-500 font-medium">No se encontraron candidatos</p>
                </div>
            ) : (
                <div className="grid gap-3">
                    {filtered.map(c => {
                        const config = STATUS_CONFIG[c.estado_proceso] || STATUS_CONFIG.prospecto_invitado;
                        const StatusIcon = config.icon;
                        return (
                            <div key={c.id} style={glass} className="p-5 flex items-center justify-between hover:bg-white/5 transition-colors group">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center text-blue-400 font-bold text-xl">
                                        {c.nombres[0].toUpperCase()}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-white group-hover:text-blue-400 transition-colors">{c.nombres}</h3>
                                        <div className="flex items-center gap-3 mt-1">
                                            <span className="text-xs text-gray-500 flex items-center gap-1">
                                                <Briefcase size={12} /> {c.cargo}
                                            </span>
                                            <span className="text-xs text-gray-500 flex items-center gap-1">
                                                <Clock size={12} /> {new Date(c.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4">
                                    <div 
                                        className="px-4 py-1.5 rounded-full flex items-center gap-2 text-xs font-bold"
                                        style={{ backgroundColor: config.bg, color: config.text }}
                                    >
                                        <StatusIcon size={14} />
                                        {config.label}
                                    </div>
                                    
                                    {c.estado_proceso === 'completado' ? (
                                        <button 
                                            onClick={() => router.push(`/reclutamiento/hoja-de-vida/view/${c.id}`)}
                                            className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all"
                                        >
                                            Ver Hoja de Vida
                                        </button>
                                    ) : (
                                        <button 
                                            onClick={() => {
                                                const link = `${window.location.origin}/onboarding/hoja-de-vida/${c.token}`;
                                                navigator.clipboard.writeText(link);
                                                alert('Link de invitación copiado');
                                            }}
                                            className="text-gray-500 hover:text-white transition-colors"
                                            title="Copiar Link"
                                        >
                                            <Clock size={20} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal */}
            {isInviting && (
                <div 
                    className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-6"
                    onClick={() => setIsInviting(false)}
                >
                    <div onClick={e => e.stopPropagation()} className="w-full max-w-md">
                        <GeneradorHojaVida onClose={() => setIsInviting(false)} />
                    </div>
                </div>
            )}
        </div>
    );
}
