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
    { id: 1, scenario: 'Un colega comete un error que afecta directamente tu proyecto. ¿Cuál es tu primera reacción?', options: [{ text: 'Lo confronto directamente para que resuelva el problema de inmediato.', disc: 'D', dark: null, darkScore: 0 }, { text: 'Busco la manera de motivarlo y apoyarlo para superar el error.', disc: 'I', dark: null, darkScore: 0 }, { text: 'Lo ayudo a corregirlo juntos, sin hacer drama del asunto.', disc: 'S', dark: null, darkScore: 0 }, { text: 'Documento el error cuidadosamente y lo reporto a quien corresponde.', disc: 'C', dark: null, darkScore: 0 }] },
    { id: 2, scenario: '¿Cuál de estas frases te describe mejor en el contexto profesional?', options: [{ text: '"Nací para liderar; los demás necesitan ser dirigidos."', disc: 'D', dark: 'NAR', darkScore: 2 }, { text: '"La vida y el trabajo son mejores cuando los disfrutamos en equipo."', disc: 'I', dark: null, darkScore: 0 }, { text: '"Prefiero estar seguro antes que arrepentido."', disc: 'S', dark: null, darkScore: 0 }, { text: '"Los datos no mienten; las emociones sí."', disc: 'C', dark: null, darkScore: 0 }] },
    { id: 3, scenario: 'Cometiste un error que perjudicó al equipo. ¿Qué haces?', options: [{ text: 'Lo asumo de inmediato y propongo una solución concreta.', disc: 'D', dark: null, darkScore: 0 }, { text: 'Lo reconozco abiertamente y me disculpo con el grupo.', disc: 'I', dark: null, darkScore: 0 }, { text: 'Necesito analizar bien si realmente fue mi responsabilidad.', disc: 'S', dark: 'IRR', darkScore: 2 }, { text: 'Lo proceso en privado y luego hablo cuando tenga claridad.', disc: 'C', dark: null, darkScore: 0 }] },
    { id: 4, scenario: 'Te ofrecen un cargo de mayor jerarquía con más responsabilidad. ¿Qué haces?', options: [{ text: 'Lo acepto sin dudarlo; es lo que me corresponde y merezco.', disc: 'D', dark: 'NAR', darkScore: 1 }, { text: 'Lo acepto con entusiasmo y lo celebro con el equipo.', disc: 'I', dark: null, darkScore: 0 }, { text: 'Lo evalúo con calma para asegurarme de estar verdaderamente preparado.', disc: 'S', dark: null, darkScore: 0 }, { text: 'Analizo los requisitos, el sueldo y las condiciones antes de decidir.', disc: 'C', dark: null, darkScore: 0 }] },
    { id: 5, scenario: 'Un cliente te presiona con insultos durante una reunión. ¿Cuál es tu reacción?', options: [{ text: 'Le digo claramente lo que pienso, sin filtros innecesarios.', disc: 'D', dark: 'PSY', darkScore: 1 }, { text: 'Intento calmarlo con empatía y un toque de humor positivo.', disc: 'I', dark: null, darkScore: 0 }, { text: 'Me mantengo calmado y busco una solución práctica al problema.', disc: 'S', dark: null, darkScore: 0 }, { text: 'Escalo el caso con evidencia documentada a quien corresponde.', disc: 'C', dark: null, darkScore: 0 }] },
    { id: 6, scenario: '¿Cómo describes tu relación personal con las normas y procedimientos de la empresa?', options: [{ text: 'Son guías, no límites absolutos; el resultado manda.', disc: 'D', dark: null, darkScore: 0 }, { text: 'Dependen del contexto; la flexibilidad es clave.', disc: 'I', dark: null, darkScore: 0 }, { text: 'Las respeto porque dan orden y estabilidad al trabajo.', disc: 'S', dark: null, darkScore: 0 }, { text: 'Son fundamentales para garantizar calidad y consistencia.', disc: 'C', dark: null, darkScore: 0 }] },
    { id: 7, scenario: 'Descubres que un compañero ha tomado crédito público por tu trabajo. ¿Qué haces?', options: [{ text: 'Lo confronto directamente frente al equipo o supervisor.', disc: 'D', dark: null, darkScore: 0 }, { text: 'Hablo con él en privado con actitud positiva y busco acuerdo.', disc: 'I', dark: null, darkScore: 0 }, { text: 'Lo dejo pasar para no generar un conflicto innecesario.', disc: 'S', dark: null, darkScore: 0 }, { text: 'Presento evidencia documentada de mi autoría al supervisor.', disc: 'C', dark: null, darkScore: 0 }] },
    { id: 8, scenario: 'Describe tu estilo cuando enfrentas una situación de presión extrema en el trabajo.', options: [{ text: 'Me activo automáticamente y tomo el control de la situación.', disc: 'D', dark: null, darkScore: 0 }, { text: 'Mantengo el ánimo del equipo elevado; el ambiente lo es todo.', disc: 'I', dark: null, darkScore: 0 }, { text: 'Me mantengo sereno y sigo el plan establecido paso a paso.', disc: 'S', dark: null, darkScore: 0 }, { text: 'Priorizo tareas racionalmente y gestiono los recursos disponibles.', disc: 'C', dark: null, darkScore: 0 }] },
    { id: 9, scenario: 'Si pudieras cambiar algo de tu trayectoria laboral anterior, ¿qué cambiarías?', options: [{ text: 'Absolutamente nada; cada decisión que tomé fue la correcta.', disc: 'D', dark: 'NAR', darkScore: 2 }, { text: 'Hubiera construido mejores redes de contacto y relaciones estratégicas.', disc: 'I', dark: null, darkScore: 0 }, { text: 'Hubiera sido más proactivo al proponer nuevas ideas.', disc: 'S', dark: null, darkScore: 0 }, { text: 'Hubiera documentado con mayor rigurosidad los procesos y resultados.', disc: 'C', dark: null, darkScore: 0 }] },
    { id: 10, scenario: '¿Cuál es tu postura frente a pedir ayuda cuando te atascas en un problema?', options: [{ text: 'Prefiero agotarme resolviendo solo antes de pedirla.', disc: 'D', dark: null, darkScore: 0 }, { text: 'Es completamente natural; fortalece las relaciones del equipo.', disc: 'I', dark: null, darkScore: 0 }, { text: 'La pido cuando genuinamente la necesito, sin problema alguno.', disc: 'S', dark: null, darkScore: 0 }, { text: 'La pido con datos específicos sobre el punto exacto del bloqueo.', disc: 'C', dark: null, darkScore: 0 }] },
    { id: 11, scenario: 'Un proyecto en el que participaste fracasa. Internamente, ¿a qué lo atribuyes?', options: [{ text: 'A decisiones erróneas tomadas por el liderazgo superior.', disc: 'D', dark: 'IRR', darkScore: 2 }, { text: 'A falta de comunicación y motivación grupal.', disc: 'I', dark: null, darkScore: 0 }, { text: 'A circunstancias externas que nadie podía controlar.', disc: 'S', dark: 'IRR', darkScore: 1 }, { text: 'A fallas específicas en la planificación y ejecución del plan.', disc: 'C', dark: null, darkScore: 0 }] },
    { id: 12, scenario: 'Tu supervisor te da una crítica directa sobre tu desempeño. ¿Cómo reaccionas internamente?', options: [{ text: 'La escucho pero filtro solo lo que considero útil para mí.', disc: 'D', dark: null, darkScore: 0 }, { text: 'La recibo bien si la percibo como constructiva y bien intencionada.', disc: 'I', dark: null, darkScore: 0 }, { text: 'Me afecta un poco emocionalmente, pero intento mejorar.', disc: 'S', dark: null, darkScore: 0 }, { text: 'La analizo objetivamente buscando datos concretos de mejora.', disc: 'C', dark: null, darkScore: 0 }] },
    { id: 13, scenario: 'Para ti, ¿qué significa el éxito profesional en su definición más honesta?', options: [{ text: 'Ganar, superar a los demás y ser reconocido como el mejor.', disc: 'D', dark: 'NAR', darkScore: 1 }, { text: 'Lograr metas importantes mientras disfruto el proceso con otros.', disc: 'I', dark: null, darkScore: 0 }, { text: 'Tener estabilidad, paz y contribuir al bienestar colectivo.', disc: 'S', dark: null, darkScore: 0 }, { text: 'Alcanzar resultados medibles con la más alta calidad posible.', disc: 'C', dark: null, darkScore: 0 }] },
    { id: 14, scenario: 'Descubres con certeza que un colega de confianza está cometiendo fraude interno. ¿Qué haces?', options: [{ text: 'Lo confronto directamente y le exijo que se detenga.', disc: 'D', dark: null, darkScore: 0 }, { text: 'Hablo con él en privado para entender qué lo llevó a esa situación.', disc: 'I', dark: null, darkScore: 0 }, { text: 'Lo reporto discretamente al supervisor siguiendo el protocolo.', disc: 'S', dark: null, darkScore: 0 }, { text: 'No es mi rol vigilar a otros; me enfoco exclusivamente en mis resultados.', disc: 'C', dark: 'PSY', darkScore: 3 }] },
    { id: 15, scenario: 'Se genera un conflicto serio dentro de tu equipo de trabajo. ¿Cuál es tu rol?', options: [{ text: 'Tomo el control de la situación y dicto la solución más eficiente.', disc: 'D', dark: null, darkScore: 0 }, { text: 'Facilito el diálogo activo para que las partes lleguen a un acuerdo.', disc: 'I', dark: null, darkScore: 0 }, { text: 'Escucho a todos los involucrados y busco el consenso del grupo.', disc: 'S', dark: null, darkScore: 0 }, { text: 'Analizo los hechos objetivamente y propongo una solución basada en datos.', disc: 'C', dark: null, darkScore: 0 }] },
    { id: 16, scenario: 'Tu supervisor te asigna una tarea importante fuera de tu rol habitual. ¿Qué haces?', options: [{ text: 'La ejecuto si me conviene estratégicamente; la delego o ignoro si no.', disc: 'D', dark: 'IRR', darkScore: 1 }, { text: 'La acepto con buena actitud; puede ser una oportunidad de crecimiento.', disc: 'I', dark: null, darkScore: 0 }, { text: 'La realizo sin reclamos; soy parte del equipo y eso implica flexibilidad.', disc: 'S', dark: null, darkScore: 0 }, { text: 'Consulto formalmente si está dentro del alcance de mi cargo antes de proceder.', disc: 'C', dark: null, darkScore: 0 }] },
    { id: 17, scenario: '¿Qué tan importante es para ti el reconocimiento público de tus logros profesionales?', options: [{ text: 'Es fundamental; merezco que todos sepan exactamente lo que logré.', disc: 'D', dark: 'NAR', darkScore: 3 }, { text: 'Me gusta mucho y además motiva e inspira a mi equipo.', disc: 'I', dark: null, darkScore: 0 }, { text: 'No es necesario; prefiero que el trabajo bien hecho hable solo.', disc: 'S', dark: null, darkScore: 0 }, { text: 'Prefiero métricas claras de desempeño antes que reconocimiento público.', disc: 'C', dark: null, darkScore: 0 }] },
    { id: 18, scenario: 'Un miembro de tu equipo muestra bajo rendimiento de forma persistente. ¿Cuál es tu enfoque?', options: [{ text: 'Le comunico firmemente que debe mejorar o habrá consecuencias directas.', disc: 'D', dark: null, darkScore: 0 }, { text: 'Busco entender qué le ocurre personalmente y lo motivo activamente.', disc: 'I', dark: null, darkScore: 0 }, { text: 'Lo apoyo con recursos, tiempo y retroalimentación continua y paciente.', disc: 'S', dark: null, darkScore: 0 }, { text: 'Escalo el caso formalmente a Recursos Humanos con datos de desempeño.', disc: 'C', dark: null, darkScore: 0 }] },
    { id: 19, scenario: 'Define tu postura honesta frente a las normas éticas de la organización.', options: [{ text: 'Las sigo cuando tienen sentido práctico para los resultados del negocio.', disc: 'D', dark: 'PSY', darkScore: 2 }, { text: 'Las respeto genuinamente y las promuevo activamente en mi equipo.', disc: 'I', dark: null, darkScore: 0 }, { text: 'Son parte de la cultura organizacional que realmente valoro.', disc: 'S', dark: null, darkScore: 0 }, { text: 'Son absolutamente no negociables para mí en cualquier contexto.', disc: 'C', dark: null, darkScore: 0 }] },
    { id: 20, scenario: 'Estás en una situación de altísima tensión laboral. ¿Cuál es tu primer movimiento?', options: [{ text: 'Actuar rápido y con decisión, aunque implique asumir riesgos inmediatos.', disc: 'D', dark: 'PSY', darkScore: 1 }, { text: 'Comunicar la situación de inmediato para activar y coordinar al equipo.', disc: 'I', dark: null, darkScore: 0 }, { text: 'Mantener la calma conscientemente y evitar reacciones impulsivas.', disc: 'S', dark: null, darkScore: 0 }, { text: 'Evaluar metódicamente todas las variables disponibles antes de actuar.', disc: 'C', dark: null, darkScore: 0 }] },
];

// ══════════════════════════════════════════════════════════════
// EJE Z — 5 Preguntas de Razonamiento Lógico (GMA)
// correct = índice de la opción correcta
// ══════════════════════════════════════════════════════════════
interface GMAQuestion { id: number; text: string; options: string[]; correct: number }

const GMA_QUESTIONS: GMAQuestion[] = [
    {
        id: 21, correct: 1,
        text: 'Observa la secuencia y selecciona el número que completa el patrón:\n2 → 4 → 8 → 16 → ___',
        options: ['24', '32', '18', '28'],
    },
    {
        id: 22, correct: 1,
        text: 'Si todos los Gerentes son Líderes, y algunos Líderes son Intuitivos, ¿qué se puede afirmar con certeza?',
        options: ['Todos los Gerentes son Intuitivos.', 'Algunos Gerentes podrían ser Intuitivos.', 'Ningún Gerente es Intuitivo.', 'Todos los Intuitivos son Gerentes.'],
    },
    {
        id: 23, correct: 2,
        text: 'Completa la analogía de magnitud:\nHora → Día → Semana  /  Centímetro → Metro → ___',
        options: ['Décima de centímetro', 'Milímetro', 'Kilómetro', 'Tonelada'],
    },
    {
        id: 24, correct: 3,
        text: 'En un equipo de 20 personas, el 35% son mujeres. ¿Cuántos hombres hay en el equipo?',
        options: ['7', '8', '12', '13'],
    },
    {
        id: 25, correct: 2,
        text: 'La afirmación "Los buenos empleados nunca cometen errores" es falsa.\n¿Cuál es su negación lógica correcta?',
        options: ['Los buenos empleados siempre cometen errores.', 'Todos los empleados cometen errores.', 'Algunos buenos empleados cometen errores.', 'Los malos empleados son buenos trabajadores.'],
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
            <p style={{ color: 'rgba(255,255,255,0.35)', margin: 0, fontSize: '14px' }}>Verificando acceso seguro…</p>
            <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
        </div>
    );

    if (phase === 'expired') return (
        <div style={{ minHeight: '100vh', background: '#0A0A0F', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px', textAlign: 'center', fontFamily: 'Inter,sans-serif', color: 'white' }}>
            <div style={{ fontSize: '72px', marginBottom: '24px' }}>🔒</div>
            <h1 style={{ fontSize: '30px', fontWeight: 900, color: '#FF3B30', marginBottom: '12px' }}>Proceso Cerrado</h1>
            <p style={{ color: 'rgba(255,255,255,0.4)', maxWidth: '400px', lineHeight: 1.8, fontSize: '15px' }}>
                El enlace de acceso ha expirado o ya no es válido.<br />Contacta a <strong style={{ color: 'white' }}>CASA INTELIGENTE</strong> para solicitar un nuevo proceso.
            </p>
            <div style={{ marginTop: '40px', padding: '14px 28px', borderRadius: '14px', background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.2)', fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}>
                🔐 Sistema de Seguridad — CASA INTELIGENTE
            </div>
        </div>
    );

    if (phase === 'disqualified') return (
        <div style={{ minHeight: '100vh', background: '#0A0A0F', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px', textAlign: 'center', fontFamily: 'Inter,sans-serif', color: 'white' }}>
            <div style={{ fontSize: '72px', marginBottom: '24px' }}>🚫</div>
            <h1 style={{ fontSize: '30px', fontWeight: 900, color: '#FF3B30', marginBottom: '12px' }}>Evaluación Descalificada</h1>
            <p style={{ color: 'rgba(255,255,255,0.5)', maxWidth: '440px', lineHeight: 1.8, fontSize: '15px' }}>
                Se detectó que abandonaste la ventana de evaluación <strong style={{ color: '#FF3B30' }}>en más de una ocasión</strong>. Por integridad del proceso, tu participación ha sido invalidada automáticamente.
            </p>
            <p style={{ marginTop: '16px', color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>
                Este evento ha sido registrado y notificado al equipo de selección de CASA INTELIGENTE.
            </p>
            <div style={{ marginTop: '40px', padding: '14px 28px', borderRadius: '14px', background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.2)', fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>
                ⚠️ Descalificación registrada · CASA INTELIGENTE
            </div>
        </div>
    );

    if (phase === 'done') return (
        <div style={{ minHeight: '100vh', background: '#0A0A0F', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px', textAlign: 'center', fontFamily: 'Inter,sans-serif', color: 'white' }}>
            <div style={{ fontSize: '72px', marginBottom: '24px' }}>🎯</div>
            <h1 style={{ fontSize: '30px', fontWeight: 900, color: '#34C759', marginBottom: '12px' }}>¡Evaluación Completada!</h1>
            <p style={{ color: 'rgba(255,255,255,0.4)', maxWidth: '400px', lineHeight: 1.8, fontSize: '15px' }}>
                Gracias por tu tiempo. El equipo de CASA INTELIGENTE analizará tu perfil y se pondrá en contacto contigo a la brevedad.
            </p>
            <div style={{ marginTop: '40px', padding: '14px 28px', borderRadius: '14px', background: 'rgba(52,199,89,0.08)', border: '1px solid rgba(52,199,89,0.2)', fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}>
                ✅ Evaluación registrada exitosamente · CASA INTELIGENTE
            </div>
        </div>
    );

    // ── WARNING 1 OVERLAY ─────────────────────────────────────
    const W1Overlay = phase === 'warning1' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(10,10,15,0.92)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
            <div style={{ maxWidth: '420px', width: '100%', background: 'rgba(255,59,48,0.08)', border: '2px solid rgba(255,59,48,0.4)', borderRadius: '24px', padding: '40px', textAlign: 'center' }}>
                <div style={{ fontSize: '56px', marginBottom: '16px' }}>⚠️</div>
                <h2 style={{ fontSize: '22px', fontWeight: 900, color: '#FF3B30', marginBottom: '12px' }}>
                    PRIMERA ADVERTENCIA
                </h2>
                <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.8, marginBottom: '8px' }}>
                    Detectamos que <strong style={{ color: 'white' }}>saliste de esta ventana</strong> durante la evaluación.
                </p>
                <p style={{ fontSize: '14px', color: '#FF9500', lineHeight: 1.7, marginBottom: '28px' }}>
                    ⛔ Si lo haces una segunda vez, serás <strong>descalificado automáticamente</strong> y el evento quedará registrado en tu expediente.
                </p>
                <button
                    onClick={() => setPhaseSync('active')}
                    style={{ padding: '14px 36px', borderRadius: '14px', border: 'none', background: 'linear-gradient(135deg,#FF3B30,#FF9500)', color: 'white', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 800, fontSize: '15px', width: '100%' }}>
                    Entiendo — Continuar Evaluación
                </button>
                <p style={{ marginTop: '16px', fontSize: '12px', color: 'rgba(255,255,255,0.25)' }}>
                    Advertencia 1 de 2 · El cronómetro sigue corriendo
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
                            {isGMA ? '🧠 Lógica' : '🧩 Perfil'} · {current + 1}/{TOTAL_Q}
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
                        {urgent && <div style={{ fontSize: '9px', fontWeight: 800, color: '#FF3B30', letterSpacing: '0.5px' }}>⚠️ TIEMPO CRÍTICO</div>}
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
                        🧠 Segunda Sección: Razonamiento Lógico — 5 ejercicios · Continúa con la misma concentración
                    </div>
                )}

                {/* Strike warning bar */}
                {strikes > 0 && (
                    <div style={{ maxWidth: '640px', margin: '6px auto 0', padding: '6px 12px', background: 'rgba(255,59,48,0.12)', borderRadius: '8px', fontSize: '12px', color: '#FF3B30', fontWeight: 600 }}>
                        ⚠️ Salida de ventana detectada: {strikes}/2 — {strikes >= 2 ? 'Proceso cerrado' : 'Una más y serás descalificado'}
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
                        {isGMA ? `Ejercicio de Lógica ${gmaIdx + 1}` : `Escenario Laboral ${current + 1}`}
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
            <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '14px 20px', background: 'rgba(10,10,15,0.97)', backdropFilter: 'blur(20px)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', gap: '10px' }}>
                    <button
                        onClick={() => setCurrent(Math.max(0, current - 1))}
                        disabled={current === 0}
                        style={{ padding: '14px 18px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: current === 0 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.6)', cursor: current === 0 ? 'default' : 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: '16px' }}>
                        ←
                    </button>

                    {current < TOTAL_Q - 1 ? (
                        <button
                            onClick={() => setCurrent(current + 1)}
                            style={{ flex: 1, padding: '14px', borderRadius: '14px', border: 'none', background: currentAnswer >= 0 ? (isGMA ? 'linear-gradient(135deg,#00AEEF,#34C759)' : 'linear-gradient(135deg,#FFD60A,#FF9500)') : 'rgba(255,255,255,0.07)', color: currentAnswer >= 0 ? '#000' : 'rgba(255,255,255,0.25)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 800, fontSize: '15px', transition: 'all 0.2s' }}>
                            Siguiente →
                        </button>
                    ) : (
                        <button
                            onClick={() => submitAnswers(answers, gmaAnswers, false, null, evalData)}
                            style={{ flex: 1, padding: '14px', borderRadius: '14px', border: 'none', background: 'linear-gradient(135deg,#34C759,#30D158)', color: 'white', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 800, fontSize: '15px', boxShadow: '0 4px 20px rgba(52,199,89,0.35)' }}>
                            ✅ Enviar Evaluación
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
