import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { GoogleGenAI } from '@google/genai';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const aiKey = process.env.GEMINI_API_KEY;
    if (!aiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY no configurada.' }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey: aiKey });

    // 1. Obtener Obligaciones
    const { data: obligaciones, error: errObligaciones } = await supabase
      .from('ci_legal_obligaciones')
      .select('*')
      .eq('estado', 'activo');

    if (errObligaciones) throw new Error(errObligaciones.message);
    if (!obligaciones || obligaciones.length === 0) {
      return NextResponse.json({ error: 'No hay obligaciones activas en la Biblioteca Legal.' }, { status: 400 });
    }

    // 2. Recopilar Datos de RRHH (Contexto)
    const contextData: any = {};
    
    // a. Total Empleados Activos
    const { count: empleadosActivos } = await supabase
      .from('ci_empleados')
      .select('id', { count: 'exact' })
      .in('estado', ['aprobado', 'evaluacion_pendiente']);
    contextData.empleadosActivos = empleadosActivos;

    // b. Contratos Activos
    const { count: contratosActivos } = await supabase
      .from('ci_contratos_empleado_obra')
      .select('id', { count: 'exact' })
      .is('fecha_fin_real', null);
    contextData.contratosActivos = contratosActivos;

    // c. Última Nómina Procesada
    const { data: ultimasNominas } = await supabase
      .from('ci_nomina_periodos')
      .select('numero_semana, estado, fecha_fin')
      .order('fecha_fin', { ascending: false })
      .limit(3);
    contextData.nominasRecientes = ultimasNominas;

    // 3. Crear el Registro de Auditoría
    const { data: auditoria, error: errAuditoria } = await supabase
      .from('ci_legal_auditorias')
      .insert({
        estado: 'en_proceso',
        realizada_por: session.user.id,
        metadata: {
          contexto_utilizado: contextData
        }
      })
      .select('id')
      .single();

    if (errAuditoria) throw new Error(errAuditoria.message);

    // 4. Prompt para el Agente (Gemini)
    const prompt = `Eres un auditor legal laboral experto en las leyes de Venezuela (LOTTT, IVSS, LPH, etc).
Te daré una lista de "Obligaciones del Patrono" y los datos actuales del departamento de RRHH.
Tu tarea es evaluar el cumplimiento de cada obligación basado SOLO en los datos provistos.
Si faltan datos, indícalo como "no_evaluado" o "advertencia".

Datos de RRHH (Contexto Actual):
${JSON.stringify(contextData, null, 2)}

Obligaciones a evaluar:
${JSON.stringify(obligaciones.map(o => ({ id: o.id, titulo: o.titulo, descripcion: o.descripcion, frecuencia: o.frecuencia })), null, 2)}

Responde OBLIGATORIAMENTE en este formato JSON estricto (sin markdown de bloques de código extra, o si usas markdown que sea solo el bloque json):
{
  "resumen_ejecutivo": "Breve conclusión general de la auditoría en 2 líneas.",
  "puntaje_general": 85.5, // de 0 a 100
  "resultados": [
    {
      "obligacion_id": "uuid-de-la-obligacion",
      "estado_cumplimiento": "cumple" | "advertencia" | "no_cumple" | "no_evaluado",
      "hallazgos": "Por qué se determinó este estado (basado en los datos).",
      "recomendacion": "Qué acción debe tomar el patrono para mejorar."
    }
  ]
}`;

    // 5. Llamar a Gemini
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      }
    });

    const responseText = response.text || '{}';
    let resultJson;
    try {
      // Remover bloques de código si la AI los mandó
      const jsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      resultJson = JSON.parse(jsonStr);
    } catch (e) {
      console.error("Error parseando respuesta de Gemini", responseText);
      await supabase.from('ci_legal_auditorias').update({ estado: 'fallida' }).eq('id', auditoria.id);
      return NextResponse.json({ error: 'Fallo al interpretar respuesta de la IA' }, { status: 500 });
    }

    // 6. Guardar Resultados
    const { resumen_ejecutivo, puntaje_general, resultados } = resultJson;

    await supabase
      .from('ci_legal_auditorias')
      .update({
        estado: 'completada',
        resumen_ejecutivo: resumen_ejecutivo || 'Auditoría finalizada.',
        puntaje: puntaje_general || 0
      })
      .eq('id', auditoria.id);

    if (Array.isArray(resultados) && resultados.length > 0) {
      const inserts = resultados.map((r: any) => ({
        auditoria_id: auditoria.id,
        obligacion_id: r.obligacion_id,
        estado_cumplimiento: r.estado_cumplimiento || 'no_evaluado',
        hallazgos: r.hallazgos || '',
        recomendacion: r.recomendacion || ''
      }));

      const { error: errResultados } = await supabase
        .from('ci_legal_auditoria_resultados')
        .insert(inserts);

      if (errResultados) console.error("Error guardando resultados", errResultados);
    }

    return NextResponse.json({ ok: true, auditoriaId: auditoria.id });

  } catch (error: any) {
    console.error('Error en auditor legal:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}