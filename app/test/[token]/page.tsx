'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// ══════════════════════════════════════════════════════════════
// EJE X — 20 Preguntas DISC + Dark Triad
// ══════════════════════════════════════════════════════════════
type Dim = 'D' | 'I' | 'S' | 'C';
type DarkType = 'PSY' | 'NAR' | 'IRR';
interface POption { text: string; disc: Dim; dark: DarkType | null; darkScore: number }
interface PQuestion { id: number; scenario: string; options: POption[] }

const QUESTIONS: PQuestion[] = [
    { id: 1, scenario: 'Un compañero comete un error que te afecta. ¿Qué es lo primero que haces?', options: [{ text: 'Lo busco de inmediato para que lo arregle ahora mismo.', disc: 'D', dark: null, darkScore: 0 }, { text: 'Le doy ánimos y lo ayudo para que se sienta mejor.', disc: 'I', dark: null, darkScore: 0 }, { text: 'Lo ayudamos a arreglarlo entre los dos sin pelear.', disc: 'S', dark: null, darkScore: 0 }, { text: 'Anoto el fallo con detalle y aviso a mi jefe de inmediato.', disc: 'C', dark: null, darkScore: 0 }] },
    { id: 2, scenario: '¿Qué frase te describe mejor en el trabajo?', options: [{ text: '"Yo nací para mandar; los demás necesitan que alguien los guíe."', disc: 'D', dark: 'NAR', darkScore: 2 }, { text: '"El trabajo es mejor cuando todos nos llevamos bien en equipo."', disc: 'I', dark: null, darkScore: 0 }, { text: '"Prefiero estar seguro de algo antes que equivocarme."', disc: 'S', dark: null, darkScore: 0 }, { text: '"Los números dicen la verdad; las emociones no."', disc: 'C', dark: null, darkScore: 0 }] },
    { id: 3, scenario: 'Cometiste un error que perjudicó al equipo. ¿Qué haces?', options: [{ text: 'Lo reconozco rápido y busco una solución de una vez.', disc: 'D', dark: null, darkScore: 0 }, { text: 'Pido perdón a todos y admito que me equivoqué.', disc: 'I', dark: null, darkScore: 0 }, { text: 'Primero reviso bien si de verdad toda la culpa fue mía.', disc: 'S', dark: 'IRR', darkScore: 2 }, { text: 'Lo pienso a solas y luego hablo cuando esté más tranquilo.', disc: 'C', dark: null, darkScore: 0 }] },
    { id: 4, scenario: 'Te ofrecen un puesto más alto con más mando. ¿Qué haces?', options: [{ text: 'Lo acepto sin dudar; es lo que me merezco por ser el mejor.', disc: 'D', dark: 'NAR', darkScore: 1 }, { text: 'Lo acepto feliz y lo celebro con mis compañeros.', disc: 'I', dark: null, darkScore: 0 }, { text: 'Lo pienso con calma para ver si de verdad estoy listo.', disc: 'S', dark: null, darkScore: 0 }, { text: 'Reviso bien cuánto voy a ganar y qué tendré que hacer antes de decir sí.', disc: 'C', dark: null, darkScore: 0 }] },
    { id: 5, scenario: 'Un cliente se pone pesado y te insulta en una reunión. ¿Qué haces?', options: [{ text: 'Le digo las cosas claras y no me quedo callado.', disc: 'D', dark: 'PSY', darkScore: 1 }, { text: 'Trato de calmarlo con buena cara y algún comentario positivo.', disc: 'I', dark: null, darkScore: 0 }, { text: 'Me quedo tranquilo y busco cómo resolver el problema rápido.', disc: 'S', dark: null, darkScore: 0 }, { text: 'Anoto todo lo que pasó y paso el reporte a mi superior.', disc: 'C', dark: null, darkScore: 0 }] },
    { id: 6, scenario: '¿Qué piensas de las reglas de la empresa?', options: [{ text: 'Son solo guías; lo más importante es dar resultados.', disc: 'D', dark: null, darkScore: 0 }, { text: 'Hay que ser flexibles; a veces las reglas cambian.', disc: 'I', dark: null, darkScore: 0 }, { text: 'Las sigo porque dan orden y tranquilidad al trabajo.', disc: 'S', dark: null, darkScore: 0 }, { text: 'Son lo más importante para que el trabajo salga siempre bien.', disc: 'C', dark: null, darkScore: 0 }] },
    { id: 7, scenario: 'Un compañero dice que él hizo algo que en verdad hiciste tú. ¿Qué haces?', options: [{ text: 'Lo confronto delante de todos o hablo con el jefe.', disc: 'D', dark: null, darkScore: 0 }, { text: 'Hablo con él a solas con buena actitud para arreglarlo.', disc: 'I', dark: null, darkScore: 0 }, { text: 'No digo nada para evitar peleas innecesarias.', disc: 'S', dark: null, darkScore: 0 }, { text: 'Le enseño pruebas a mi jefe de que el trabajo fue mío.', disc: 'C', dark: null, darkScore: 0 }] },
    { id: 8, scenario: '¿Cómo te pones cuando hay muchísima presión en el trabajo?', options: [{ text: 'Me activo rápido y tomo el mando de la situación.', disc: 'D', dark: null, darkScore: 0 }, { text: 'Trato de que todos sigan con buen ánimo; el ambiente importa.', disc: 'I', dark: null, darkScore: 0 }, { text: 'Me quedo calmado y sigo el plan paso a paso.', disc: 'S', dark: null, darkScore: 0 }, { text: 'Pienso qué es lo más urgente y ordeno bien mis tareas.', disc: 'C', dark: null, darkScore: 0 }] },
    { id: 9, scenario: 'Si pudieras cambiar algo de tus trabajos anteriores, ¿qué sería?', options: [{ text: 'Nada; todas las decisiones que tomé estuvieron bien.', disc: 'D', dark: 'NAR', darkScore: 2 }, { text: 'Hubiera hecho más amigos y conocidos importantes.', disc: 'I', dark: null, darkScore: 0 }, { text: 'Hubiera dado más ideas nuevas de mi parte.', disc: 'S', dark: null, darkScore: 0 }, { text: 'Hubiera anotado mejor cómo se hacían todos los procesos.', disc: 'C', dark: null, darkScore: 0 }] },
    { id: 10, scenario: '¿Qué haces cuando no sabes cómo resolver un problema?', options: [{ text: 'Trato de resolverlo yo solo aunque me canse mucho.', disc: 'D', dark: null, darkScore: 0 }, { text: 'Pido ayuda rápido; para eso está el equipo.', disc: 'I', dark: null, darkScore: 0 }, { text: 'Pido ayuda solo si de verdad veo que no puedo.', disc: 'S', dark: null, darkScore: 0 }, { text: 'Pido ayuda explicando exactamente en qué parte me trabé.', disc: 'C', dark: null, darkScore: 0 }] },
    { id: 11, scenario: 'Un proyecto en el que trabajaste sale mal. ¿Por qué crees que pasó?', options: [{ text: 'Por malas decisiones de los jefes de arriba.', disc: 'D', dark: 'IRR', darkScore: 2 }, { text: 'Porque no nos comunicamos bien ni nos motivamos.', disc: 'I', dark: null, darkScore: 0 }, { text: 'Por cosas de afuera que nadie podía controlar.', disc: 'S', dark: 'IRR', darkScore: 1 }, { text: 'Porque el plan no se hizo o no se siguió bien.', disc: 'C', dark: null, darkScore: 0 }] },
    { id: 12, scenario: 'Tu jefe te dice que algo hiciste mal. ¿Cómo te sientes por dentro?', options: [{ text: 'Lo escucho, pero solo me quedo con lo que me sirve a mí.', disc: 'D', dark: null, darkScore: 0 }, { text: 'Me lo tomo bien si veo que me lo dice para ayudar.', disc: 'I', dark: null, darkScore: 0 }, { text: 'Me pongo un poco triste, pero trato de mejorar.', disc: 'S', dark: null, darkScore: 0 }, { text: 'Lo analizo con calma para ver exactamente en qué mejorar.', disc: 'C', dark: null, darkScore: 0 }] },
    { id: 13, scenario: 'Para ti, ¿qué es tener éxito en el trabajo?', options: [{ text: 'Ganar siempre, ser mejor que los demás y que me feliciten.', disc: 'D', dark: 'NAR', darkScore: 1 }, { text: 'Lograr metas grandes mientras la paso bien con otros.', disc: 'I', dark: null, darkScore: 0 }, { text: 'Tener un trabajo estable, tranquilo y ayudar a todos.', disc: 'S', dark: null, darkScore: 0 }, { text: 'Dar resultados perfectos y de la mejor calidad.', disc: 'C', dark: null, darkScore: 0 }] },
    { id: 14, scenario: 'Te enteras de que un compañero de confianza está robando dinero a la empresa. ¿Qué haces?', options: [{ text: 'Lo enfrento cara a cara y le digo que pare ya mismo.', disc: 'D', dark: null, darkScore: 0 }, { text: 'Hablo con él a solas para ver por qué lo está haciendo.', disc: 'I', dark: null, darkScore: 0 }, { text: 'Aviso a mi jefe con cuidado siguiendo las reglas.', disc: 'S', dark: null, darkScore: 0 }, { text: 'No es mi problema vigilar a otros; yo solo hago mi trabajo.', disc: 'C', dark: 'PSY', darkScore: 3 }] },
    { id: 15, scenario: 'Hay una pelea fuerte entre tus compañeros de equipo. ¿Qué haces tú?', options: [{ text: 'Tomo el control y digo cuál es la solución más rápida.', disc: 'D', dark: null, darkScore: 0 }, { text: 'Ayudo a que hablen para que se arreglen entre ellos.', disc: 'I', dark: null, darkScore: 0 }, { text: 'Escucho a todos y trato de que todos estemos de acuerdo.', disc: 'S', dark: null, darkScore: 0 }, { text: 'Miro los hechos sin elegir bando y propongo una solución lógica.', disc: 'C', dark: null, darkScore: 0 }] },
    { id: 16, scenario: 'Tu jefe te pide hacer algo que no te toca hacer normalmente. ¿Qué haces?', options: [{ text: 'Lo hago solo si me conviene; si no, busco a otro o no lo hago.', disc: 'D', dark: 'IRR', darkScore: 1 }, { text: 'Lo acepto con buena cara; puede ser bueno para aprender.', disc: 'I', dark: null, darkScore: 0 }, { text: 'Lo hago sin quejarme; somos un equipo y hay que ayudar.', disc: 'S', dark: null, darkScore: 0 }, { text: 'Pregunto primero si eso de verdad me toca hacerlo a mí.', disc: 'C', dark: null, darkScore: 0 }] },
    { id: 17, scenario: '¿Qué tan importante es para ti que te feliciten delante de todos?', options: [{ text: 'Es muy importante; me gusta que todos sepan lo que logré.', disc: 'D', dark: 'NAR', darkScore: 3 }, { text: 'Me gusta mucho y además motiva a mis compañeros.', disc: 'I', dark: null, darkScore: 0 }, { text: 'No hace falta; prefiero que mi buen trabajo se vea solo.', disc: 'S', dark: null, darkScore: 0 }, { text: 'Prefiero que me den datos reales de mi trabajo antes que felicitaciones.', disc: 'C', dark: null, darkScore: 0 }] },
    { id: 18, scenario: 'Un compañero de tu equipo trabaja muy mal siempre. ¿Qué haces?', options: [{ text: 'Le digo firme que debe mejorar o tendrá problemas.', disc: 'D', dark: null, darkScore: 0 }, { text: 'Trato de ver si tiene problemas personales y lo animo.', disc: 'I', dark: null, darkScore: 0 }, { text: 'Lo ayudo con paciencia y le enseño cómo hacerlo mejor.', disc: 'S', dark: null, darkScore: 0 }, { text: 'Le aviso formalmente a Recursos Humanos con pruebas de su mal trabajo.', disc: 'C', dark: null, darkScore: 0 }] },
    { id: 19, scenario: '¿Qué piensas de portarse bien y ser honesto en el trabajo?', options: [{ text: 'Lo hago cuando es bueno para los resultados del negocio.', disc: 'D', dark: 'PSY', darkScore: 2 }, { text: 'Lo hago de verdad y trato de que mi equipo también lo haga.', disc: 'I', dark: null, darkScore: 0 }, { text: 'Es parte de la forma de ser de la empresa y me gusta.', disc: 'S', dark: null, darkScore: 0 }, { text: 'Para mí eso no se discute; siempre hay que ser honesto.', disc: 'C', dark: null, darkScore: 0 }] },
    { id: 20, scenario: 'Estás en un momento de mucho nerviosismo en el trabajo. ¿Qué es lo primero que haces?', options: [{ text: 'Actuar rápido y decidir algo aunque sea arriesgado.', disc: 'D', dark: 'PSY', darkScore: 1 }, { text: 'Avisar rápido a todos para que nos organicemos juntos.', disc: 'I', dark: null, darkScore: 0 }, { text: 'Tratar de estar tranquilo y no hacer cosas sin pensar.', disc: 'S', dark: null, darkScore: 0 }, { text: 'Revisar bien toda la información antes de hacer nada.', disc: 'C', dark: null, darkScore: 0 }] },
];


// ══════════════════════════════════════════════════════════════
// EJE Z — 5 Preguntas de Razonamiento Lógico (GMA)
// correct = índice de la opción correcta
// ══════════════════════════════════════════════════════════════
interface GMAQuestion { id: number; text: string; options: string[]; correct: number }

const GMA_QUESTIONS: GMAQuestion[] = [
    {
        id: 21, correct: 1,
        text: '¿Qué número sigue en esta lista?\n2 → 4 → 8 → 16 → ___',
        options: ['24', '32', '18', '28'],
    },
    {
        id: 22, correct: 1,
        text: 'Si todas las manzanas son frutas, y algunas frutas son rojas, ¿qué podemos decir que es verdad siempre?',
        options: ['Todas las manzanas son rojas.', 'Algunas manzanas podrían ser rojas.', 'Ninguna manzana es roja.', 'Todas las frutas son manzanas.'],
    },
    {
        id: 23, correct: 2,
        text: 'Si Hora es a Día, lo que Centímetro es a...',
        options: ['Regla', 'Lápiz', 'Metro', 'Kilo'],
    },
    {
        id: 24, correct: 3,
        text: 'En un grupo de 20 personas, 7 son mujeres. ¿Cuántos hombres hay?',
        options: ['7', '10', '12', '13'],
    },
    {
        id: 25, correct: 2,
        text: 'Si te dicen que "Es mentira que todos los días llueve", ¿qué significa eso de verdad?',
        options: ['Que nunca llueve.', 'Que siempre sale el sol.', 'Que algunos días no llueve.', 'Que mañana va a llover.'],
    },
];

const TOTAL_Q = QUESTIONS.length + GMA_QUESTIONS.length; // 25
const MAX_DARK = { PSY: 7, NAR: 9, IRR: 6 };

// ── Algoritmo de scoring ───────────────────────────────────────
function computeScores(answers: number[], gmaAnswers: number[]) {
    const disc = { D: 0, I: 0, S: 0, C: 0 };
    const dark = { PSY: 0, NAR: 0, IRR: 0 };

    answers.forEach((ansIdx, qIdx) => {
        if (ansIdx < 0 || !QUESTIONS[qIdx]) return;
        const opt = QUESTIONS[qIdx].options[ansIdx];
        disc[opt.disc]++;
        if (opt.dark) dark[opt.dark] += opt.darkScore;
    });

    const dominantDisc = (Object.keys(disc) as Dim[]).reduce((a, b) => disc[a] >= disc[b] ? a : b);
    const colorMap: Record<Dim, string> = { D: 'Rojo', I: 'Amarillo', S: 'Verde', C: 'Azul' };

    // Eje Y — Integridad (0–10, alto = alto riesgo)
    const integrityScore = parseFloat(
        ((dark.PSY / MAX_DARK.PSY * 0.35 + dark.NAR / MAX_DARK.NAR * 0.35 + dark.IRR / MAX_DARK.IRR * 0.30) * 10).toFixed(1)
    );

    // Base risk
    let riskScore = integrityScore * 10; // 0-100

    // Cross-validation: inconsistencias DISC vs oscuro
    if (dominantDisc === 'D' && dark.PSY / MAX_DARK.PSY > 0.5) riskScore = Math.min(100, riskScore + 15);
    if (dominantDisc === 'I' && dark.NAR / MAX_DARK.NAR > 0.5) riskScore = Math.min(100, riskScore + 10);
    if (dark.IRR / MAX_DARK.IRR > 0.6) riskScore = Math.min(100, riskScore + 20);
    riskScore = Math.round(riskScore * 10) / 10;

    const semaforo = riskScore < 30 ? 'verde' : riskScore < 60 ? 'amarillo' : 'rojo';

    // Eje Z — GMA / Lógica (0–5)
    const gmaScore = GMA_QUESTIONS.reduce((acc, q, idx) =>
        acc + (gmaAnswers[idx] === q.correct ? 1 : 0), 0);

    // Cross-check 3 ejes: Lógica alta + Integridad baja = MANIPULADOR
    let logicTag: string | null = null;
    if (gmaScore >= 4 && integrityScore > 7)        logicTag = 'ALTO RIESGO — MANIPULADOR';
    else if (gmaScore >= 3 && integrityScore > 5)   logicTag = 'RIESGO MODERADO — MONITOREAR';
    else if (gmaScore >= 4 && integrityScore <= 4)  logicTag = 'ALTA INTELIGENCIA — PERFIL SEGURO';

    return {
        disc_d: disc.D, disc_i: disc.I, disc_s: disc.S, disc_c: disc.C,
        dark_psy: dark.PSY, dark_nar: dark.NAR, dark_irr: dark.IRR,
        dominant_disc: dominantDisc,
        color_perfil: colorMap[dominantDisc],
        risk_score: riskScore,
        semaforo,
        integrity_score: integrityScore,
        gma_score: gmaScore,
        logic_tag: logicTag,
    };
}

function formatTime(secs: number) {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

type Phase = 'loading' | 'expired' | 'warning1' | 'disqualified' | 'active' | 'done';

export default function TestPage() {
    const { token } = useParams<{ token: string }>();
    const [evalData, setEvalData] = useState<any>(null);
    const [phase, setPhase] = useState<Phase>('loading');
    const phaseRef = useRef<Phase>('loading');
    const setPhaseSync = (p: Phase) => { phaseRef.current = p; setPhase(p); };

    const [current, setCurrent] = useState(0);
    const [answers, setAnswers] = useState<number[]>(new Array(QUESTIONS.length).fill(-1));
    const [gmaAnswers, setGmaAnswers] = useState<number[]>(new Array(GMA_QUESTIONS.length).fill(-1));
    const answersRef = useRef(answers);
    const gmaAnswersRef = useRef(gmaAnswers);
    useEffect(() => { answersRef.current = answers; }, [answers]);
    useEffect(() => { gmaAnswersRef.current = gmaAnswers; }, [gmaAnswers]);

    const [timeLeft, setTimeLeft] = useState(900);
    const [strikes, setStrikes] = useState(0);
    const strikesRef = useRef(0);
    const submittingRef = useRef(false);

    const isGMA = current >= QUESTIONS.length;
    const gmaIdx = current - QUESTIONS.length;
    const supabase = createClient();

    // ── Cargar evaluación ─────────────────────────────────────
    useEffect(() => {
        async function load() {
            const { data } = await supabase
                .from('evaluaciones').select('*').eq('token', token).single();
            if (!data) { setPhaseSync('expired'); return; }
            if (data.status === 'completed') { setPhaseSync('done'); setEvalData(data); return; }
            if (data.status === 'expired' || data.disqualified) { setPhaseSync('expired'); return; }

            const now = Date.now();
            if (data.status === 'pending') {
                if (now > new Date(data.link_expires_at).getTime()) {
                    await supabase.from('evaluaciones').update({ status: 'expired' }).eq('token', token);
                    setPhaseSync('expired'); return;
                }
                const testDeadline = new Date(now + 15 * 60 * 1000).toISOString();
                await supabase.from('evaluaciones').update({
                    status: 'started', started_at: new Date(now).toISOString(), test_deadline: testDeadline,
                }).eq('token', token);
                setTimeLeft(900);
            } else if (data.status === 'started') {
                const remaining = Math.max(0, Math.floor((new Date(data.test_deadline).getTime() - now) / 1000));
                if (remaining === 0) { submitAnswers([], [], true, 'Tiempo agotado', data); return; }
                setTimeLeft(remaining);
            }

            setEvalData(data);
            setPhaseSync('active');
        }
        load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    // ── Countdown ─────────────────────────────────────────────
    useEffect(() => {
        if (phase !== 'active') return;
        const interval = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(interval);
                    submitAnswers(answersRef.current, gmaAnswersRef.current, false, null, evalData);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase]);

    // ── Seguridad: Bloqueos + Blur con 2 Strikes ──────────────
    useEffect(() => {
        if (phase !== 'active' && phase !== 'warning1') return;

        const blockMenu  = (e: MouseEvent) => e.preventDefault();
        const blockClip  = (e: ClipboardEvent) => e.preventDefault();
        const blockKeys  = (e: KeyboardEvent) => {
            // Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+P, Ctrl+A, PrintScreen
            if ((e.ctrlKey || e.metaKey) && ['c','v','x','p','a','s'].includes(e.key.toLowerCase())) e.preventDefault();
            if (e.key === 'PrintScreen') {
                e.preventDefault();
                navigator.clipboard.writeText('').catch(() => {});
            }
        };
        const handleBlur = async () => {
            // Solo disparar si el candidato está activamente en el test
            if (phaseRef.current !== 'active') return;
            strikesRef.current++;
            setStrikes(strikesRef.current);
            await supabase.from('evaluaciones').update({ tab_changes: strikesRef.current }).eq('token', token);
            if (strikesRef.current === 1) {
                setPhaseSync('warning1'); // Primera advertencia — overlay rojo
            } else if (strikesRef.current >= 2) {
                // Segunda infracción — DESCALIFICADO
                submitAnswers(answersRef.current, gmaAnswersRef.current, false, 'Cambio de ventana detectado 2 veces', evalData);
                setPhaseSync('disqualified');
            }
        };

        document.addEventListener('contextmenu', blockMenu);
        document.addEventListener('copy', blockClip);
        document.addEventListener('paste', blockClip);
        document.addEventListener('cut', blockClip);
        document.addEventListener('keydown', blockKeys);
        window.addEventListener('blur', handleBlur);
        return () => {
            document.removeEventListener('contextmenu', blockMenu);
            document.removeEventListener('copy', blockClip);
            document.removeEventListener('paste', blockClip);
            document.removeEventListener('cut', blockClip);
            document.removeEventListener('keydown', blockKeys);
            window.removeEventListener('blur', handleBlur);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase]);

    // ── Submit central ────────────────────────────────────────
    const submitAnswers = useCallback(async (
        pAnswers: number[], gAnswers: number[],
        autoTimeout: boolean, reason: string | null, evData: any
    ) => {
        if (submittingRef.current) return;
        submittingRef.current = true;

        // Verificar deadline server-side antes de guardar
        if (!autoTimeout && evData?.test_deadline) {
            const deadline = new Date(evData.test_deadline).getTime();
            if (Date.now() > deadline + 5000) {
                // Fuera de tiempo — rechazar submission
                await supabase.from('evaluaciones').update({ status: 'expired' }).eq('token', token);
                setPhaseSync('expired'); return;
            }
        }

        const scores = computeScores(pAnswers, gAnswers);
        const disqualified = !!reason && reason.includes('ventana');
        await supabase.from('evaluaciones').update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            answers: pAnswers,
            disqualified,
            disqualification_reason: reason,
            ...scores,
        }).eq('token', token);

        setPhaseSync(disqualified ? 'disqualified' : 'done');
    }, [token, supabase]);

    function selectAnswer(optionIndex: number) {
        if (isGMA) {
            setGmaAnswers(prev => { const n = [...prev]; n[gmaIdx] = optionIndex; return n; });
        } else {
            setAnswers(prev => { const n = [...prev]; n[current] = optionIndex; return n; });
        }
    }

    function getCurrentAnswer() {
        return isGMA ? gmaAnswers[gmaIdx] : answers[current];
    }

    const answeredCount = answers.filter(a => a >= 0).length + gmaAnswers.filter(a => a >= 0).length;
    const pct = Math.round((answeredCount / TOTAL_Q) * 100);
    const timerColor = timeLeft > 300 ? '#34C759' : timeLeft > 120 ? '#FF9500' : '#FF3B30';
    const urgent = timeLeft < 120;

    // ══════════════════════════════════════════════════════════
    // RENDERS
    // ══════════════════════════════════════════════════════════

    if (phase === 'loading') return (
        <div style={{ minHeight: '100vh', background: '#0A0A0F', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', color: 'white', fontFamily: 'Inter,sans-serif' }}>
            <div style={{ width: '48px', height: '48px', border: '4px solid rgba(255,214,10,0.15)', borderTopColor: '#FFD60A', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <p style={{ color: 'rgba(255,255,255,0.35)', margin: 0, fontSize: '14px' }}>Cargando tu examen...</p>
            <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
        </div>
    );

    if (phase === 'expired') return (
        <div style={{ minHeight: '100vh', background: '#0A0A0F', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px', textAlign: 'center', fontFamily: 'Inter,sans-serif', color: 'white' }}>
            <div style={{ fontSize: '72px', marginBottom: '24px' }}>🔒</div>
            <h1 style={{ fontSize: '30px', fontWeight: 900, color: '#FF3B30', marginBottom: '12px' }}>Enlace vencido</h1>
            <p style={{ color: 'rgba(255,255,255,0.4)', maxWidth: '400px', lineHeight: 1.8, fontSize: '15px' }}>
                El tiempo para entrar se acabó o ya usaste este enlace.<br />Habla con la empresa para pedir uno nuevo.
            </p>
            <div style={{ marginTop: '40px', padding: '14px 28px', borderRadius: '14px', background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.2)', fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}>
                🔐 Sistema de Seguridad — CASA INTELIGENTE
            </div>
        </div>
    );

    if (phase === 'disqualified') return (
        <div style={{ minHeight: '100vh', background: '#0A0A0F', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px', textAlign: 'center', fontFamily: 'Inter,sans-serif', color: 'white' }}>
            <div style={{ fontSize: '72px', marginBottom: '24px' }}>🚫</div>
            <h1 style={{ fontSize: '30px', fontWeight: 900, color: '#FF3B30', marginBottom: '12px' }}>Examen cancelado</h1>
            <p style={{ color: 'rgba(255,255,255,0.5)', maxWidth: '440px', lineHeight: 1.8, fontSize: '15px' }}>
                Saliste de la pantalla del examen <strong style={{ color: '#FF3B30' }}>2 veces</strong>. Por seguridad, no puedes seguir con la prueba.
            </p>
            <p style={{ marginTop: '16px', color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>
                Esto ya fue avisado al equipo de Casa Inteligente.
            </p>
            <div style={{ marginTop: '40px', padding: '14px 28px', borderRadius: '14px', background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.2)', fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>
                ⚠️ Descalificación registrada · CASA INTELIGENTE
            </div>
        </div>
    );

    if (phase === 'done') return (
        <div style={{ minHeight: '100vh', background: '#0A0A0F', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px', textAlign: 'center', fontFamily: 'Inter,sans-serif', color: 'white' }}>
            <div style={{ fontSize: '72px', marginBottom: '24px' }}>🎯</div>
            <h1 style={{ fontSize: '30px', fontWeight: 900, color: '#34C759', marginBottom: '12px' }}>¡Listo! Terminaste</h1>
            <p style={{ color: 'rgba(255,255,255,0.4)', maxWidth: '400px', lineHeight: 1.8, fontSize: '15px' }}>
                Gracias por tu tiempo. Ya guardamos tus respuestas y pronto te avisaremos qué sigue.
            </p>
            <div style={{ marginTop: '40px', padding: '14px 28px', borderRadius: '14px', background: 'rgba(52,199,89,0.08)', border: '1px solid rgba(52,199,89,0.2)', fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}>
                ✅ Examen enviado con éxito · CASA INTELIGENTE
            </div>
        </div>
    );

    // ── WARNING 1 OVERLAY ─────────────────────────────────────
    const W1Overlay = phase === 'warning1' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(10,10,15,0.92)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
            <div style={{ maxWidth: '420px', width: '100%', background: 'rgba(255,59,48,0.08)', border: '2px solid rgba(255,59,48,0.4)', borderRadius: '24px', padding: '40px', textAlign: 'center' }}>
                <div style={{ fontSize: '56px', marginBottom: '16px' }}>⚠️</div>
                <h2 style={{ fontSize: '22px', fontWeight: 900, color: '#FF3B30', marginBottom: '12px' }}>
                    ¡CUIDADO!
                </h2>
                <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.8, marginBottom: '8px' }}>
                    Vimos que <strong style={{ color: 'white' }}>saliste de esta pantalla</strong>. No lo hagas de nuevo.
                </p>
                <p style={{ fontSize: '14px', color: '#FF9500', lineHeight: 1.7, marginBottom: '28px' }}>
                    ⛔ Si sales otra vez, el examen <strong style={{ color: '#FF3B30' }}>se cerrará solo</strong> y perderás tu oportunidad.
                </p>
                <button
                    onClick={() => setPhaseSync('active')}
                    style={{ padding: '14px 36px', borderRadius: '14px', border: 'none', background: 'linear-gradient(135deg,#FF3B30,#FF9500)', color: 'white', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 800, fontSize: '15px', width: '100%' }}>
                    Entendido, seguir con el examen
                </button>
                <p style={{ marginTop: '16px', fontSize: '12px', color: 'rgba(255,255,255,0.25)' }}>
                    Aviso 1 de 2. El tiempo sigue pasando.
                </p>
            </div>
        </div>
    );

    // ── ACTIVE TEST ───────────────────────────────────────────
    const currentAnswer = getCurrentAnswer();
    const question = isGMA ? GMA_QUESTIONS[gmaIdx] : QUESTIONS[current];
    const options = isGMA
        ? (question as GMAQuestion).options.map(t => ({ text: t }))
        : (question as PQuestion).options;

    return (
        <div style={{ minHeight: '100vh', background: '#0A0A0F', fontFamily: 'Inter,-apple-system,sans-serif', color: 'white', userSelect: 'none', WebkitUserSelect: 'none' }}>
            {W1Overlay}

            {/* ── Sticky header ── */}
            <div style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(10,10,15,0.97)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '10px 20px' }}>
                <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                    <div>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: '1px', textTransform: 'uppercase' }}>CASA INTELIGENTE</div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.55)' }}>
                            {isGMA ? '🧠 Parte 2: Lógica' : '🧩 Parte 1: Escenarios'} · {current + 1}/{TOTAL_Q}
                        </div>
                    </div>

                    {/* TIMER */}
                    <div style={{ textAlign: 'center' }}>
                        <div style={{
                            fontSize: '32px', fontWeight: 900, color: timerColor,
                            letterSpacing: '-1.5px', fontVariantNumeric: 'tabular-nums',
                            transition: 'color 0.5s', animation: urgent ? 'pulse 1s ease-in-out infinite' : 'none',
                        }}>
                            {formatTime(timeLeft)}
                        </div>
                        {urgent && <div style={{ fontSize: '9px', fontWeight: 800, color: '#FF3B30', letterSpacing: '0.5px' }}>⚠️ ¡POCO TIEMPO!</div>}
                    </div>

                    {/* Progress */}
                    <div style={{ textAlign: 'right', minWidth: '80px' }}>
                        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginBottom: '4px' }}>{answeredCount}/{TOTAL_Q}</div>
                        <div style={{ width: '80px', height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: isGMA ? 'linear-gradient(90deg,#00AEEF,#34C759)' : 'linear-gradient(90deg,#FFD60A,#FF9500)', transition: 'width 0.4s' }} />
                        </div>
                    </div>
                </div>

                {/* Section transition banner */}
                {current === QUESTIONS.length && (
                    <div style={{ maxWidth: '640px', margin: '8px auto 0', padding: '8px 14px', background: 'rgba(0,174,239,0.1)', borderRadius: '10px', border: '1px solid rgba(0,174,239,0.25)', fontSize: '12px', color: '#00AEEF', fontWeight: 600, textAlign: 'center' }}>
                        🧠 Ahora siguen 5 preguntas de lógica. ¡Tú puedes!
                    </div>
                )}

                {/* Strike warning bar */}
                {strikes > 0 && (
                    <div style={{ maxWidth: '640px', margin: '6px auto 0', padding: '6px 12px', background: 'rgba(255,59,48,0.12)', borderRadius: '8px', fontSize: '12px', color: '#FF3B30', fontWeight: 600 }}>
                        ⚠️ Saliste de la pantalla: {strikes}/2 — {strikes >= 2 ? 'Cerrando...' : '¡Si lo haces de nuevo pierdes el examen!'}
                    </div>
                )}
            </div>

            {/* ── Question content ── */}
            <div style={{ maxWidth: '640px', margin: '0 auto', padding: '28px 20px 120px' }}>
                <div style={{
                    background: isGMA ? 'rgba(0,174,239,0.06)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${isGMA ? 'rgba(0,174,239,0.2)' : 'rgba(255,255,255,0.08)'}`,
                    borderRadius: '20px', padding: '28px', marginBottom: '20px',
                }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: isGMA ? '#00AEEF' : '#FFD60A', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '12px' }}>
                        {isGMA ? `Pregunta de lógica ${gmaIdx + 1}` : `Situación de trabajo ${current + 1}`}
                    </div>
                    <p style={{ fontSize: '17px', fontWeight: 600, lineHeight: 1.7, color: 'rgba(255,255,255,0.92)', margin: 0, whiteSpace: 'pre-line' }}>
                        {isGMA ? (question as GMAQuestion).text : (question as PQuestion).scenario}
                    </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {options.map((opt, idx) => {
                        const selected = currentAnswer === idx;
                        return (
                            <button
                                key={idx}
                                onClick={() => selectAnswer(idx)}
                                style={{
                                    display: 'flex', alignItems: 'flex-start', gap: '14px',
                                    padding: '16px 18px', borderRadius: '14px', cursor: 'pointer',
                                    fontFamily: 'inherit', textAlign: 'left',
                                    background: selected
                                        ? (isGMA ? 'rgba(0,174,239,0.12)' : 'rgba(255,214,10,0.12)')
                                        : 'rgba(255,255,255,0.04)',
                                    border: selected
                                        ? `1.5px solid ${isGMA ? 'rgba(0,174,239,0.55)' : 'rgba(255,214,10,0.55)'}`
                                        : '1px solid rgba(255,255,255,0.06)',
                                    transform: selected ? 'scale(1.01)' : 'scale(1)',
                                    transition: 'all 0.18s',
                                    boxShadow: selected ? `0 4px 20px ${isGMA ? 'rgba(0,174,239,0.15)' : 'rgba(255,214,10,0.15)'}` : 'none',
                                }}>
                                <div style={{
                                    width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0,
                                    background: selected ? (isGMA ? '#00AEEF' : '#FFD60A') : 'rgba(255,255,255,0.07)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '12px', fontWeight: 800,
                                    color: selected ? '#000' : 'rgba(255,255,255,0.4)',
                                }}>
                                    {String.fromCharCode(65 + idx)}
                                </div>
                                <span style={{ fontSize: '14px', lineHeight: 1.65, color: selected ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.6)', fontWeight: selected ? 600 : 400 }}>
                                    {opt.text}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ── Fixed bottom navigation ── */}
            <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1000, padding: '14px 20px', background: 'rgba(10,10,15,0.97)', backdropFilter: 'blur(20px)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', gap: '10px' }}>
                    <button
                        onClick={() => setCurrent(Math.max(0, current - 1))}
                        disabled={current === 0}
                        style={{ padding: '14px 18px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: current === 0 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.6)', cursor: current === 0 ? 'default' : 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: '16px' }}>
                        ←
                    </button>

                    {current < TOTAL_Q - 1 ? (
                        <button
                            onClick={() => { if (currentAnswer >= 0) setCurrent(current + 1); }}
                            style={{ 
                                flex: 1, padding: '14px', borderRadius: '14px', border: 'none', 
                                background: currentAnswer >= 0 ? (isGMA ? 'linear-gradient(135deg,#00AEEF,#34C759)' : 'linear-gradient(135deg,#FFD60A,#FF9500)') : 'rgba(255,255,255,0.1)', 
                                color: currentAnswer >= 0 ? '#000' : 'rgba(255,255,255,0.3)', 
                                cursor: currentAnswer >= 0 ? 'pointer' : 'not-allowed', 
                                opacity: currentAnswer >= 0 ? 1 : 0.6,
                                fontFamily: 'inherit', fontWeight: 800, fontSize: '15px', transition: 'all 0.2s' 
                            }}>
                            Siguiente →
                        </button>
                    ) : (
                        <button
                            onClick={() => submitAnswers(answers, gmaAnswers, false, null, evalData)}
                            style={{ flex: 1, padding: '14px', borderRadius: '14px', border: 'none', background: 'linear-gradient(135deg,#34C759,#30D158)', color: 'white', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 800, fontSize: '15px', boxShadow: '0 4px 20px rgba(52,199,89,0.35)' }}>
                            ✅ Terminar y enviar
                        </button>
                    )}
                </div>
            </div>

            <style>{`
                @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
                @keyframes spin  { to{transform:rotate(360deg)} }
                * { -webkit-user-select:none; user-select:none; }
            `}</style>
        </div>
    );
}
