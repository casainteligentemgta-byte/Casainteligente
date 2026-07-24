"use client";

import { useState } from "react";
import { CheckCircle2, ArrowRight, ArrowLeft, ShieldAlert } from "lucide-react";

interface Option {
  texto: string;
  valor: string;
}

interface Question {
  id: string;
  categoria: string;
  pregunta: string;
  opciones: Option[];
}

interface FormularioProps {
  preguntas: Question[];
  token: string;
  rol: string;
  onFinalizar: (resultado: any) => void;
}

export default function FormularioEvaluacion({ preguntas, token, rol, onFinalizar }: FormularioProps) {
  const [indiceActual, setIndiceActual] = useState(0);
  const [respuestas, setRespuestas] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preguntaActual = preguntas[indiceActual];
  const totalPreguntas = preguntas.length;
  const progresoPorcentaje = Math.round(((indiceActual + 1) / totalPreguntas) * 100);

  const manejarSeleccion = (valorOpcion: string) => {
    setRespuestas((prev) => ({
      ...prev,
      [preguntaActual.id]: valorOpcion,
    }));
  };

  const irAlSiguiente = () => {
    if (indiceActual < totalPreguntas - 1) {
      setIndiceActual(indiceActual + 1);
    }
  };

  const irAlAnterior = () => {
    if (indiceActual > 0) {
      setIndiceActual(indiceActual - 1);
    }
  };

  const enviarEvaluacion = async () => {
    setEnviando(true);
    setError(null);

    try {
      const response = await fetch("/api/talento/examen/evaluar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          rol,
          respuestas,
        }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "Error al enviar la evaluación");

      onFinalizar(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  };

  const respuestaSeleccionada = respuestas[preguntaActual.id];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-between p-4 font-sans selection:bg-amber-500 selection:text-black">
      
      {/* Cabecera / Progreso */}
      <header className="w-full max-w-md mx-auto pt-4">
        <div className="flex justify-between items-center text-xs text-zinc-400 font-medium mb-2">
          <span className="uppercase tracking-wider text-amber-500 font-semibold">Evaluación de Ingreso</span>
          <span>Pregunta {indiceActual + 1} de {totalPreguntas}</span>
        </div>
        {/* Barra de progreso fluida */}
        <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden border border-zinc-850">
          <div 
            className="h-full bg-gradient-to-r from-amber-600 to-amber-400 transition-all duration-300 ease-out"
            style={{ width: `${progresoPorcentaje}%` }}
          />
        </div>
      </header>

      {/* Cuerpo Principal: Pregunta y Opciones */}
      <main className="w-full max-w-md mx-auto flex-1 flex flex-col justify-center my-8">
        <div className="bg-zinc-900/50 border border-zinc-800/80 p-6 rounded-2xl shadow-xl backdrop-blur-sm">
          
          {/* Enunciado de la Pregunta */}
          <h2 className="text-xl font-medium leading-relaxed text-zinc-100 mb-6">
            {preguntaActual.pregunta}
          </h2>

          {/* Lista de Opciones Estilo Tarjeta Rápida */}
          <div className="flex flex-col gap-3">
            {preguntaActual.opciones.map((opcion) => {
              const esSeleccionada = respuestaSeleccionada === opcion.valor;
              return (
                <button
                  key={opcion.valor}
                  onClick={() => manejarSeleccion(opcion.valor)}
                  className={`w-full text-left p-4 rounded-xl border text-base transition-all duration-200 flex items-start gap-3 active:scale-[0.99] ${
                    esSeleccionada
                      ? "bg-amber-500/10 border-amber-500 text-amber-400 font-medium shadow-[0_0_15px_rgba(245,158,11,0.05)]"
                      : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-850"
                  }`}
                >
                  <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                    esSeleccionada ? "border-amber-500 bg-amber-500" : "border-zinc-600"
                  }`}>
                    {esSeleccionada && <div className="w-2 h-2 rounded-full bg-zinc-950" />}
                  </div>
                  <span className="leading-normal">{opcion.texto}</span>
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </main>

      {/* Barra de Navegación Inferior (Sticky / Fixed para Pulgares) */}
      <footer className="w-full max-w-md mx-auto pb-4 pt-2 bg-gradient-to-t from-zinc-950 via-zinc-950 to-transparent">
        <div className="flex gap-4">
          {/* Botón Atrás */}
          <button
            onClick={irAlAnterior}
            disabled={indiceActual === 0 || enviando}
            className="flex-1 py-3.5 px-4 rounded-xl border border-zinc-800 text-zinc-400 font-medium hover:text-zinc-200 hover:bg-zinc-900 disabled:opacity-0 transition-all flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Atrás
          </button>

          {/* Botón Siguiente / Enviar */}
          {indiceActual < totalPreguntas - 1 ? (
            <button
              onClick={irAlSiguiente}
              disabled={!respuestaSeleccionada}
              className="flex-[2] py-3.5 px-4 rounded-xl bg-zinc-100 text-zinc-950 font-semibold hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-600 transition-all flex items-center justify-center gap-2 shadow-lg"
            >
              Siguiente
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={enviarEvaluacion}
              disabled={!respuestaSeleccionada || enviando}
              className="flex-[2] py-3.5 px-4 rounded-xl bg-amber-500 text-zinc-950 font-bold hover:bg-amber-400 disabled:bg-zinc-800 disabled:text-zinc-600 transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/10"
            >
              {enviando ? "Guardando..." : "Finalizar y Enviar"}
              <CheckCircle2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </footer>

    </div>
  );
}
