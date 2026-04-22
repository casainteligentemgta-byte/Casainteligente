'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { 
    User, 
    GraduationCap, 
    Briefcase, 
    Link as LinkIcon, 
    Send, 
    ChevronRight, 
    ChevronLeft, 
    Plus, 
    Trash2, 
    CheckCircle2,
    Sparkles,
    Calendar,
    MapPin,
    Heart,
    Flag,
    Dna,
    Wallet
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function HojaVidaOnboarding() {
    const params = useParams();
    const router = useRouter();
    const supabase = createClient();
    
    const [loading, setLoading] = useState(true);
    const [candidate, setCandidate] = useState<any>(null);
    const [step, setStep] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [completed, setCompleted] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        info_personal: {
            direccion: '',
            fecha_nacimiento: '',
            estado_civil: '',
            nacionalidad: '',
            genero: ''
        },
        educacion: [] as any[],
        experiencia: [] as any[],
        habilidades: [] as string[],
        referencias: [] as any[],
        otros_datos: {
            licencia: 'No',
            vehiculo: 'No',
            disponibilidad: 'Inmediata',
            pretension_salarial: ''
        }
    });

    useEffect(() => {
        init();
    }, [params.token]);

    async function init() {
        const token = params.token as string;
        const { data, error } = await supabase
            .from('ci_empleados')
            .select('*')
            .eq('token', token)
            .single();

        if (error || !data) {
            router.push('/404');
            return;
        }

        if (data.estado_proceso === 'completado') {
            setCompleted(true);
        }

        setCandidate(data);
        setLoading(false);
    }

    const nextStep = () => setStep(s => s + 1);
    const prevStep = () => setStep(s => s - 1);

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            // 1. Insert into ci_hojas_vida
            const { error: hvError } = await supabase.from('ci_hojas_vida').insert({
                empleado_id: candidate.id,
                direccion: formData.info_personal.direccion,
                fecha_nacimiento: formData.info_personal.fecha_nacimiento || null,
                estado_civil: formData.info_personal.estado_civil,
                nacionalidad: formData.info_personal.nacionalidad,
                genero: formData.info_personal.genero,
                educacion: formData.educacion,
                experiencia: formData.experiencia,
                habilidades: formData.habilidades,
                referencias: formData.referencias,
                otros_datos: formData.otros_datos
            });

            if (hvError) throw hvError;

            // 2. Update candidate status
            const { error: eError } = await supabase
                .from('ci_empleados')
                .update({ estado_proceso: 'completado' })
                .eq('id', candidate.id);

            if (eError) throw eError;

            setCompleted(true);
        } catch (err) {
            console.error(err);
            alert('Error al guardar la información. Por favor intenta de nuevo.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
            </div>
        );
    }

    if (completed) {
        return (
            <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center p-6">
                <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="glass p-12 rounded-[40px] text-center max-w-lg w-full border border-white/10 shadow-2xl"
                >
                    <div className="w-24 h-24 bg-gradient-to-tr from-green-500 to-emerald-400 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-lg shadow-green-500/20">
                        <CheckCircle2 className="text-black" size={48} />
                    </div>
                    <h1 className="text-3xl font-black text-white mb-4">¡Registro Completado!</h1>
                    <p className="text-gray-400 leading-relaxed mb-8">
                        Muchas gracias, <span className="text-blue-400 font-bold">{candidate.nombres}</span>. 
                        Hemos recibido tu hoja de vida exitosamente. Nuestro equipo de RRHH la revisará y te contactaremos pronto.
                    </p>
                    <button 
                        onClick={() => window.close()}
                        className="w-full bg-white/5 hover:bg-white/10 text-white py-4 rounded-2xl font-bold transition-all border border-white/10"
                    >
                        Cerrar Ventana
                    </button>
                </motion.div>
            </div>
        );
    }

    const steps = [
        { id: 'personal', title: 'Datos Personales', icon: User },
        { id: 'educacion', title: 'Educación', icon: GraduationCap },
        { id: 'experiencia', title: 'Experiencia', icon: Briefcase },
        { id: 'otros', title: 'Habilidades y Otros', icon: Sparkles },
    ];

    const glass = "bg-white/5 backdrop-blur-xl border border-white/10 rounded-[32px]";
    const inputClass = "w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-5 text-white outline-none focus:border-blue-500 focus:bg-white/10 transition-all placeholder:text-gray-600";

    return (
        <div className="min-h-screen bg-[#0A0A0F] text-white p-4 md:p-8 font-sans selection:bg-blue-500/30">
            {/* Progress Bar */}
            <div className="max-w-4xl mx-auto mb-12">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-2xl font-black text-white tracking-tight">Postulación: {candidate.cargo}</h2>
                        <p className="text-blue-400 font-medium text-sm mt-0.5">Casa Inteligente • Formulario de Ingreso</p>
                    </div>
                    <div className="hidden md:flex gap-2">
                        {steps.map((s, i) => (
                            <div 
                                key={i}
                                className={`w-3 h-3 rounded-full transition-all duration-500 ${i <= step ? 'bg-blue-500 w-8' : 'bg-white/10'}`}
                            />
                        ))}
                    </div>
                </div>
            </div>

            <main className="max-w-4xl mx-auto">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={step}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className={`${glass} p-8 md:p-12 shadow-2xl relative overflow-hidden`}
                    >
                        {/* Header del Paso */}
                        <div className="flex items-center gap-4 mb-10">
                            <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-400 border border-blue-500/20">
                                {(() => {
                                    const Icon = steps[step].icon;
                                    return <Icon size={28} />;
                                })()}
                            </div>
                            <div>
                                <span className="text-blue-500 text-xs font-black uppercase tracking-[0.2em]">Paso {step + 1} de {steps.length}</span>
                                <h3 className="text-2xl font-bold text-white">{steps[step].title}</h3>
                            </div>
                        </div>

                        {/* Step 1: Personal */}
                        {step === 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2 md:col-span-2">
                                    <label className="text-xs font-bold text-gray-500 uppercase ml-1 flex items-center gap-2">
                                        <MapPin size={12} /> Dirección de Residencia
                                    </label>
                                    <input 
                                        type="text" 
                                        className={inputClass}
                                        placeholder="Ej: Calle 123, Barrio El Centro"
                                        value={formData.info_personal.direccion}
                                        onChange={e => setFormData({ ...formData, info_personal: { ...formData.info_personal, direccion: e.target.value } })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-500 uppercase ml-1 flex items-center gap-2">
                                        <Calendar size={12} /> Fecha de Nacimiento
                                    </label>
                                    <input 
                                        type="date" 
                                        className={inputClass}
                                        value={formData.info_personal.fecha_nacimiento}
                                        onChange={e => setFormData({ ...formData, info_personal: { ...formData.info_personal, fecha_nacimiento: e.target.value } })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-500 uppercase ml-1 flex items-center gap-2">
                                        <Heart size={12} /> Estado Civil
                                    </label>
                                    <select 
                                        className={inputClass}
                                        value={formData.info_personal.estado_civil}
                                        onChange={e => setFormData({ ...formData, info_personal: { ...formData.info_personal, estado_civil: e.target.value } })}
                                    >
                                        <option value="">Selecciona...</option>
                                        <option value="Soltero/a">Soltero/a</option>
                                        <option value="Casado/a">Casado/a</option>
                                        <option value="Unión Libre">Unión Libre</option>
                                        <option value="Divorciado/a">Divorciado/a</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-500 uppercase ml-1 flex items-center gap-2">
                                        <Flag size={12} /> Nacionalidad
                                    </label>
                                    <input 
                                        type="text" 
                                        className={inputClass}
                                        placeholder="Ej: Venezolana, Colombiana"
                                        value={formData.info_personal.nacionalidad}
                                        onChange={e => setFormData({ ...formData, info_personal: { ...formData.info_personal, nacionalidad: e.target.value } })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-500 uppercase ml-1 flex items-center gap-2">
                                        <Dna size={12} /> Género
                                    </label>
                                    <select 
                                        className={inputClass}
                                        value={formData.info_personal.genero}
                                        onChange={e => setFormData({ ...formData, info_personal: { ...formData.info_personal, genero: e.target.value } })}
                                    >
                                        <option value="">Selecciona...</option>
                                        <option value="Masculino">Masculino</option>
                                        <option value="Femenino">Femenino</option>
                                        <option value="Otro">Otro</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        {/* Step 2: Educación */}
                        {step === 1 && (
                            <div className="space-y-6">
                                {formData.educacion.map((edu, i) => (
                                    <div key={i} className="p-6 bg-white/5 border border-white/5 rounded-2xl relative group">
                                        <button 
                                            onClick={() => {
                                                const newEdu = [...formData.educacion];
                                                newEdu.splice(i, 1);
                                                setFormData({ ...formData, educacion: newEdu });
                                            }}
                                            className="absolute top-4 right-4 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <input 
                                                className={inputClass} 
                                                placeholder="Institución" 
                                                value={edu.institucion} 
                                                onChange={e => {
                                                    const newEdu = [...formData.educacion];
                                                    newEdu[i].institucion = e.target.value;
                                                    setFormData({ ...formData, educacion: newEdu });
                                                }}
                                            />
                                            <input 
                                                className={inputClass} 
                                                placeholder="Título obtenido" 
                                                value={edu.titulo} 
                                                onChange={e => {
                                                    const newEdu = [...formData.educacion];
                                                    newEdu[i].titulo = e.target.value;
                                                    setFormData({ ...formData, educacion: newEdu });
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))}
                                <button 
                                    onClick={() => setFormData({ ...formData, educacion: [...formData.educacion, { institucion: '', titulo: '', fecha_inicio: '', fecha_fin: '', nivel: '' }] })}
                                    className="w-full py-4 border-2 border-dashed border-white/10 rounded-2xl text-gray-500 hover:text-blue-400 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all flex items-center justify-center gap-2 font-bold"
                                >
                                    <Plus size={20} />
                                    Agregar Educación
                                </button>
                            </div>
                        )}

                        {/* Step 3: Experiencia */}
                        {step === 2 && (
                            <div className="space-y-6">
                                {formData.experiencia.map((exp, i) => (
                                    <div key={i} className="p-6 bg-white/5 border border-white/5 rounded-2xl relative group">
                                        <button 
                                            onClick={() => {
                                                const newExp = [...formData.experiencia];
                                                newExp.splice(i, 1);
                                                setFormData({ ...formData, experiencia: newExp });
                                            }}
                                            className="absolute top-4 right-4 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <input 
                                                className={inputClass} 
                                                placeholder="Empresa" 
                                                value={exp.empresa} 
                                                onChange={e => {
                                                    const newExp = [...formData.experiencia];
                                                    newExp[i].empresa = e.target.value;
                                                    setFormData({ ...formData, experiencia: newExp });
                                                }}
                                            />
                                            <input 
                                                className={inputClass} 
                                                placeholder="Cargo" 
                                                value={exp.cargo} 
                                                onChange={e => {
                                                    const newExp = [...formData.experiencia];
                                                    newExp[i].cargo = e.target.value;
                                                    setFormData({ ...formData, experiencia: newExp });
                                                }}
                                            />
                                            <textarea 
                                                className={`${inputClass} md:col-span-2 h-24 resize-none`} 
                                                placeholder="Descripción de funciones" 
                                                value={exp.descripcion} 
                                                onChange={e => {
                                                    const newExp = [...formData.experiencia];
                                                    newExp[i].descripcion = e.target.value;
                                                    setFormData({ ...formData, experiencia: newExp });
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))}
                                <button 
                                    onClick={() => setFormData({ ...formData, experiencia: [...formData.experiencia, { empresa: '', cargo: '', fecha_inicio: '', fecha_fin: '', descripcion: '' }] })}
                                    className="w-full py-4 border-2 border-dashed border-white/10 rounded-2xl text-gray-500 hover:text-blue-400 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all flex items-center justify-center gap-2 font-bold"
                                >
                                    <Plus size={20} />
                                    Agregar Experiencia Laboral
                                </button>
                            </div>
                        )}

                        {/* Step 4: Otros */}
                        {step === 3 && (
                            <div className="space-y-8">
                                {/* Habilidades */}
                                <div className="space-y-4">
                                    <label className="text-xs font-bold text-gray-500 uppercase ml-1">Habilidades Principales</label>
                                    <div className="flex flex-wrap gap-2">
                                        {formData.habilidades.map((skill, i) => (
                                            <span key={i} className="bg-blue-500/10 text-blue-400 px-3 py-1.5 rounded-xl text-sm font-bold border border-blue-500/20 flex items-center gap-2">
                                                {skill}
                                                <button onClick={() => {
                                                    const newSkills = [...formData.habilidades];
                                                    newSkills.splice(i, 1);
                                                    setFormData({ ...formData, habilidades: newSkills });
                                                }}>
                                                    <Trash2 size={14} className="text-red-400" />
                                                </button>
                                            </span>
                                        ))}
                                        <input 
                                            className="bg-transparent border-none outline-none text-white text-sm py-1 placeholder:text-gray-700 min-w-[150px]"
                                            placeholder="Escribe y presiona Enter..."
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') {
                                                    const val = (e.target as HTMLInputElement).value.trim();
                                                    if (val && !formData.habilidades.includes(val)) {
                                                        setFormData({ ...formData, habilidades: [...formData.habilidades, val] });
                                                        (e.target as HTMLInputElement).value = '';
                                                    }
                                                }
                                            }}
                                        />
                                    </div>
                                </div>

                                {/* Otros Datos */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-500 uppercase ml-1 flex items-center gap-2">
                                            <Wallet size={12} /> Pretensión Salarial
                                        </label>
                                        <input 
                                            type="text" 
                                            className={inputClass}
                                            placeholder="Ej: 1,500,000"
                                            value={formData.otros_datos.pretension_salarial}
                                            onChange={e => setFormData({ ...formData, otros_datos: { ...formData.otros_datos, pretension_salarial: e.target.value } })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-500 uppercase ml-1 flex items-center gap-2">
                                            <Clock size={12} /> Disponibilidad
                                        </label>
                                        <select 
                                            className={inputClass}
                                            value={formData.otros_datos.disponibilidad}
                                            onChange={e => setFormData({ ...formData, otros_datos: { ...formData.otros_datos, disponibilidad: e.target.value } })}
                                        >
                                            <option value="Inmediata">Inmediata</option>
                                            <option value="1 semana">1 semana</option>
                                            <option value="2 semanas">2 semanas</option>
                                            <option value="1 mes">1 mes</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Referencias */}
                                <div className="space-y-4">
                                    <label className="text-xs font-bold text-gray-500 uppercase ml-1">Referencias Personales / Laborales</label>
                                    {formData.referencias.map((ref, i) => (
                                        <div key={i} className="flex gap-4">
                                            <input 
                                                className={inputClass} 
                                                placeholder="Nombre" 
                                                value={ref.nombre} 
                                                onChange={e => {
                                                    const newRefs = [...formData.referencias];
                                                    newRefs[i].nombre = e.target.value;
                                                    setFormData({ ...formData, referencias: newRefs });
                                                }}
                                            />
                                            <input 
                                                className={inputClass} 
                                                placeholder="Teléfono" 
                                                value={ref.telefono} 
                                                onChange={e => {
                                                    const newRefs = [...formData.referencias];
                                                    newRefs[i].telefono = e.target.value;
                                                    setFormData({ ...formData, referencias: newRefs });
                                                }}
                                            />
                                        </div>
                                    ))}
                                    <button 
                                        onClick={() => setFormData({ ...formData, referencias: [...formData.referencias, { nombre: '', telefono: '', relacion: '' }] })}
                                        className="text-blue-400 text-sm font-bold flex items-center gap-2 hover:underline"
                                    >
                                        <Plus size={16} /> Agregar Referencia
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Navigation Buttons */}
                        <div className="flex justify-between items-center mt-12 pt-8 border-t border-white/5">
                            <button
                                onClick={prevStep}
                                disabled={step === 0}
                                className={`flex items-center gap-2 font-bold transition-all ${step === 0 ? 'text-gray-700' : 'text-gray-400 hover:text-white'}`}
                            >
                                <ChevronLeft size={20} />
                                Anterior
                            </button>
                            
                            {step < steps.length - 1 ? (
                                <button
                                    onClick={nextStep}
                                    className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-blue-600/20 active:scale-95"
                                >
                                    Siguiente
                                    <ChevronRight size={20} />
                                </button>
                            ) : (
                                <button
                                    onClick={handleSubmit}
                                    disabled={submitting}
                                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-10 py-4 rounded-2xl font-bold flex items-center gap-2 transition-all shadow-xl shadow-blue-600/20 active:scale-95 disabled:opacity-50"
                                >
                                    {submitting ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                            Enviando...
                                        </>
                                    ) : (
                                        <>
                                            Finalizar y Enviar
                                            <Send size={20} />
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    </motion.div>
                </AnimatePresence>
            </main>

            <footer className="max-w-4xl mx-auto mt-12 text-center">
                <p className="text-gray-600 text-[10px] font-bold uppercase tracking-[0.3em]">
                    Casa Inteligente • Soluciones Tecnológicas de Vanguardia
                </p>
            </footer>
        </div>
    );
}
