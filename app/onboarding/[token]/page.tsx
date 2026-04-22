'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Sparkles, Loader2, AlertCircle } from 'lucide-react';

export default function OnboardingPage() {
    const params = useParams();
    const router = useRouter();
    const [status, setStatus] = useState<'loading' | 'error' | 'success'>('loading');
    const [message, setMessage] = useState('Validando tu invitación...');

    useEffect(() => {
        const token = params.token as string;
        if (!token) return;

        const initOnboarding = async () => {
            const supabase = createClient();
            
            // 1. Verificar prospecto
            const { data: prospecto, error: pError } = await supabase
                .from('ci_prospectos')
                .select('*')
                .eq('token', token)
                .single();

            if (pError || !prospecto) {
                setStatus('error');
                setMessage('Invitación no válida o expirada.');
                return;
            }

            // 2. Si ya completó, redirigir al resultado o mostrar mensaje
            if (prospecto.estado === 'completado') {
                setStatus('error');
                setMessage('Esta evaluación ya ha sido completada.');
                return;
            }

            // 3. Crear evaluación si no existe
            const { data: evalExistente } = await supabase
                .from('ci_evaluaciones')
                .select('id')
                .eq('prospecto_id', prospecto.id)
                .single();

            if (!evalExistente) {
                // Generar registro de evaluación inicial vinculado al prospecto
                const { error: eError } = await supabase.from('ci_evaluaciones').insert({
                    prospecto_id: prospecto.id,
                    puntaje: 0,
                    respuestas: {}
                });

                if (eError) {
                    console.error('Error creating evaluation:', eError);
                }
            }

            // 4. Actualizar estado del prospecto
            await supabase
                .from('ci_prospectos')
                .update({ estado: 'en_evaluacion' })
                .eq('id', prospecto.id);

            // 5. Redirigir al test
            setStatus('success');
            setMessage('Redirigiendo a la evaluación...');
            setTimeout(() => {
                router.push(`/test/${token}`);
            }, 1500);
        };

        initOnboarding();
    }, [params.token, router]);

    return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 font-sans">
            <div className="glass p-8 rounded-3xl border border-white/10 shadow-2xl max-w-sm w-full text-center fade-in">
                <div className="flex justify-center mb-6">
                    <div className="w-16 h-16 bg-gradient-to-tr from-orange-500 to-yellow-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20">
                        <Sparkles className="text-black" size={32} />
                    </div>
                </div>
                
                <h1 className="text-white text-xl font-black mb-2 tracking-tight">
                    CASA INTELIGENTE
                </h1>
                
                <div className="space-y-4 mt-8">
                    {status === 'loading' && (
                        <div className="flex flex-col items-center gap-4">
                            <Loader2 className="text-orange-500 animate-spin" size={24} />
                            <p className="text-gray-400 text-sm font-medium">{message}</p>
                        </div>
                    )}

                    {status === 'error' && (
                        <div className="flex flex-col items-center gap-4 scale-in">
                            <AlertCircle className="text-red-500" size={32} />
                            <p className="text-white text-sm font-bold">{message}</p>
                            <button 
                                onClick={() => router.push('/')}
                                className="text-orange-500 text-xs font-bold uppercase tracking-widest mt-2 hover:underline"
                            >
                                Ir al Inicio
                            </button>
                        </div>
                    )}

                    {status === 'success' && (
                        <div className="flex flex-col items-center gap-4 slide-up">
                            <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center">
                                <div className="w-2 h-2 bg-green-500 rounded-full animate-ping" />
                            </div>
                            <p className="text-green-500 text-sm font-bold">{message}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
