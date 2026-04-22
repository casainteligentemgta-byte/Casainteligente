'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { 
    User, 
    GraduationCap, 
    Briefcase, 
    Mail, 
    Phone, 
    MapPin, 
    Calendar, 
    ChevronLeft, 
    Printer,
    Download,
    Star,
    Award,
    Heart,
    Flag,
    Dna,
    Wallet,
    Info
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function ViewHojaVidaPage() {
    const params = useParams();
    const router = useRouter();
    const supabase = createClient();
    
    const [loading, setLoading] = useState(true);
    const [candidate, setCandidate] = useState<any>(null);

    useEffect(() => {
        load();
    }, [params.id]);

    async function load() {
        const { data, error } = await supabase
            .from('ci_empleados')
            .select('*, ci_hojas_vida(*)')
            .eq('id', params.id)
            .single();

        if (error || !data) {
            router.push('/reclutamiento');
            return;
        }

        setCandidate(data);
        setLoading(false);
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
            </div>
        );
    }

    const hv = candidate.ci_hojas_vida?.[0] || {};
    const glass = "bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl";

    return (
        <div className="min-h-screen bg-[#0A0A0F] text-white p-4 md:p-8 pb-32 font-sans selection:bg-blue-500/30">
            {/* Nav */}
            <div className="max-w-5xl mx-auto mb-8 flex justify-between items-center no-print">
                <button 
                    onClick={() => router.back()}
                    className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors font-bold"
                >
                    <ChevronLeft size={20} />
                    Volver al Dashboard
                </button>
                <div className="flex gap-3">
                    <button 
                        onClick={() => window.print()}
                        className="bg-white/5 hover:bg-white/10 text-white p-3 rounded-2xl border border-white/10 transition-all"
                        title="Imprimir"
                    >
                        <Printer size={20} />
                    </button>
                </div>
            </div>

            <main className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Sidebar: Perfil y Contacto */}
                <div className="lg:col-span-1 space-y-8">
                    <div className={`${glass} p-8 text-center`}>
                        <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-[32px] flex items-center justify-center text-white font-black text-4xl mx-auto mb-6 shadow-xl shadow-blue-600/20">
                            {candidate.nombres[0].toUpperCase()}
                        </div>
                        <h1 className="text-2xl font-black mb-1">{candidate.nombres}</h1>
                        <p className="text-blue-400 font-bold text-sm uppercase tracking-widest">{candidate.cargo}</p>
                        
                        <div className="mt-8 pt-8 border-t border-white/5 space-y-4 text-left">
                            <div className="flex items-center gap-3 text-gray-400">
                                <Mail size={16} className="text-blue-500" />
                                <span className="text-sm truncate">{candidate.email}</span>
                            </div>
                            <div className="flex items-center gap-3 text-gray-400">
                                <Phone size={16} className="text-blue-500" />
                                <span className="text-sm">{candidate.celular}</span>
                            </div>
                            {hv.direccion && (
                                <div className="flex items-center gap-3 text-gray-400">
                                    <MapPin size={16} className="text-blue-500" />
                                    <span className="text-sm">{hv.direccion}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className={`${glass} p-8`}>
                        <h3 className="text-lg font-black mb-6 flex items-center gap-2">
                            <Info size={18} className="text-blue-500" />
                            Datos Personales
                        </h3>
                        <div className="space-y-4">
                            {[
                                { label: 'F. Nacimiento', value: hv.fecha_nacimiento, icon: Calendar },
                                { label: 'Estado Civil', value: hv.estado_civil, icon: Heart },
                                { label: 'Nacionalidad', value: hv.nacionalidad, icon: Flag },
                                { label: 'Género', value: hv.genero, icon: Dna },
                            ].map((item, i) => (
                                <div key={i} className="flex items-center justify-between text-sm">
                                    <span className="text-gray-500 flex items-center gap-2">
                                        <item.icon size={14} /> {item.label}
                                    </span>
                                    <span className="text-gray-300 font-medium">{item.value || 'N/A'}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className={`${glass} p-8`}>
                        <h3 className="text-lg font-black mb-6 flex items-center gap-2">
                            <Star size={18} className="text-blue-500" />
                            Habilidades
                        </h3>
                        <div className="flex flex-wrap gap-2">
                            {hv.habilidades?.map((skill: string, i: number) => (
                                <span key={i} className="bg-white/5 border border-white/10 text-gray-300 px-3 py-1.5 rounded-xl text-xs font-bold">
                                    {skill}
                                </span>
                            ))}
                            {(!hv.habilidades || hv.habilidades.length === 0) && (
                                <span className="text-gray-600 italic text-sm">No registradas</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Main Content: Experiencia y Educación */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Experiencia */}
                    <div className={`${glass} p-8 md:p-10`}>
                        <h3 className="text-xl font-black mb-8 flex items-center gap-3">
                            <Briefcase size={24} className="text-blue-500" />
                            Experiencia Laboral
                        </h3>
                        <div className="space-y-10 relative before:absolute before:left-[11px] before:top-2 before:bottom-0 before:w-0.5 before:bg-white/5">
                            {hv.experiencia?.map((exp: any, i: number) => (
                                <div key={i} className="pl-10 relative">
                                    <div className="absolute left-0 top-1.5 w-6 h-6 bg-[#0A0A0F] border-2 border-blue-500 rounded-full flex items-center justify-center">
                                        <div className="w-2 h-2 bg-blue-500 rounded-full" />
                                    </div>
                                    <h4 className="text-lg font-bold text-white">{exp.cargo}</h4>
                                    <div className="text-blue-400 font-bold text-sm mb-3 uppercase tracking-wider">{exp.empresa}</div>
                                    <p className="text-gray-400 text-sm leading-relaxed">{exp.descripcion}</p>
                                </div>
                            ))}
                            {(!hv.experiencia || hv.experiencia.length === 0) && (
                                <p className="text-gray-600 italic">No registrada</p>
                            )}
                        </div>
                    </div>

                    {/* Educación */}
                    <div className={`${glass} p-8 md:p-10`}>
                        <h3 className="text-xl font-black mb-8 flex items-center gap-3">
                            <GraduationCap size={24} className="text-blue-500" />
                            Formación Académica
                        </h3>
                        <div className="grid gap-6">
                            {hv.educacion?.map((edu: any, i: number) => (
                                <div key={i} className="bg-white/5 border border-white/5 p-6 rounded-2xl">
                                    <h4 className="text-lg font-bold text-white">{edu.titulo}</h4>
                                    <p className="text-blue-400 text-sm font-bold mt-1">{edu.institucion}</p>
                                </div>
                            ))}
                            {(!hv.educacion || hv.educacion.length === 0) && (
                                <p className="text-gray-600 italic">No registrada</p>
                            )}
                        </div>
                    </div>

                    {/* Otros Datos & Referencias */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className={`${glass} p-8`}>
                            <h3 className="text-lg font-black mb-6 flex items-center gap-2">
                                <Award size={18} className="text-blue-500" />
                                Otros Datos
                            </h3>
                            <div className="space-y-4">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Disponibilidad</span>
                                    <span className="text-gray-300 font-bold">{hv.otros_datos?.disponibilidad}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Pretensión</span>
                                    <span className="text-emerald-400 font-bold">${hv.otros_datos?.pretension_salarial}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Licencia</span>
                                    <span className="text-gray-300">{hv.otros_datos?.licencia}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Vehículo</span>
                                    <span className="text-gray-300">{hv.otros_datos?.vehiculo}</span>
                                </div>
                            </div>
                        </div>

                        <div className={`${glass} p-8`}>
                            <h3 className="text-lg font-black mb-6 flex items-center gap-2">
                                <User size={18} className="text-blue-500" />
                                Referencias
                            </h3>
                            <div className="space-y-6">
                                {hv.referencias?.map((ref: any, i: number) => (
                                    <div key={i}>
                                        <div className="text-sm font-bold text-white">{ref.nombre}</div>
                                        <div className="text-xs text-blue-400 font-medium flex items-center gap-2 mt-1">
                                            <Phone size={10} /> {ref.telefono}
                                        </div>
                                    </div>
                                ))}
                                {(!hv.referencias || hv.referencias.length === 0) && (
                                    <p className="text-gray-600 italic text-sm">No registradas</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            <style jsx global>{`
                @media print {
                    .no-print { display: none !important; }
                    body { background: white !important; color: black !important; }
                    .glass { background: white !important; border: 1px solid #eee !important; color: black !important; box-shadow: none !important; }
                    .text-white { color: black !important; }
                    .text-gray-400, .text-gray-500 { color: #666 !important; }
                    .text-blue-400, .text-blue-500 { color: #2563eb !important; }
                    .bg-[#0A0A0F] { background: white !important; }
                }
            `}</style>
        </div>
    );
}
