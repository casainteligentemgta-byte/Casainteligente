import { chunkTranscriptByWords } from '@/lib/pheme/chunkTranscript';
import { parsePhemeInforme } from '@/lib/pheme/parsePhemeInforme';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function run() {
  const words = Array.from({ length: 1200 }, (_, i) => `palabra${i + 1}`);
  const chunks = chunkTranscriptByWords(words.join(' '), 500, 40);
  assert(chunks.length >= 3, `esperaba >=3 chunks, got ${chunks.length}`);
  assert(chunks[0].split(' ').length === 500, 'primer chunk debe tener 500 palabras');

  const empty = chunkTranscriptByWords('   ');
  assert(empty.length === 0, 'texto vacío → sin chunks');

  const informe = parsePhemeInforme(`{
    "resumen_ejecutivo": {
      "objetivo_principal": "Definir presupuesto",
      "acuerdos_clave": ["Congelar alcance"],
      "tareas_pendientes": [{"tarea": "Enviar Excel", "responsable": "Ana", "fecha_limite": "Pendiente"}]
    },
    "matriz_viabilidad": {
      "ideas_analizadas": [{
        "idea": "Importar desde CSV",
        "viabilidad": "alta",
        "pros": ["Rápido"],
        "contras_riesgos": ["Datos sucios"],
        "dictamen": "Viable con limpieza previa"
      }]
    },
    "mapa_mental_mermaid": "graph TD\\n  A[Reunion] --> B[Presupuesto]",
    "analisis_comunicacion": {
      "tono_general": "Profesional",
      "objeciones_detectadas": ["Costo"],
      "puntos_de_duda_o_vacilacion": ["Fecha de entrega"],
      "recomendacion_seguimiento": "Revisar CSV el lunes"
    }
  }`);

  assert(informe.resumen_ejecutivo.objetivo_principal === 'Definir presupuesto', 'objetivo');
  assert(informe.matriz_viabilidad.ideas_analizadas[0].viabilidad === 'Alta', 'viabilidad normalizada');
  assert(informe.mapa_mental_mermaid.includes('graph TD'), 'mermaid');

  console.log('pheme chunk/parse tests OK');
}

run();
