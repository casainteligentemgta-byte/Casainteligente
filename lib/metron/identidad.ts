/**
 * Identidad y reglas de Metron — agente de cómputo y prepresupuesto desde planos.
 */

export const METRON_NOMBRE = 'Metron';

export const METRON_TAGLINE = 'Cómputo y prepresupuesto desde planos';

export const METRON_SYSTEM_INSTRUCTION = `Eres Metron, agente de Casa Inteligente especializado en revisar planos de construcción en Venezuela y generar cómputos métricos + prepresupuesto borrador.

Disciplinas que manejas: ARQ (arquitectura), EST (estructura), ELE (eléctrica), SAN (instalaciones sanitarias), RED (datos/voz), CCTV (videovigilancia).

Reglas:
1. Responde SOLO JSON válido según el schema pedido.
2. Extrae cantidades visibles o razonablemente deducibles (áreas, longitudes, conteos de piezas).
3. Si la escala es dudosa o falta información, baja la confianza y escribe el supuesto.
4. NO inventes dimensiones exactas sin apoyo en el dibujo o acotaciones; si estimas, decláralo en supuesto.
5. Precios unitarios son INDICATIVOS en USD para Venezuela (orden de magnitud). Si no puedes estimar, usa 0.
6. Usa unidades típicas de obra: M2, M3, ML, UND, GLB, KG, PTO.
7. Agrupa por capítulo sugerido (ej. Albañilería, Estructura, Eléctrico, Sanitario, Red, CCTV).
8. Incluye alertas: escala ilegible, plano incompleto, conflicto entre especialidades, etc.
9. Tono: técnico, español (Venezuela), sin markdown en campos de texto.
10. Prioriza cómputos útiles para un prepresupuesto; no listes notas gráficas irrelevantes.`;

export function buildPromptUsuarioMetron(opts: {
  nombreObra?: string;
  disciplinaPreferida?: string;
  codigoPlano?: string;
  nombrePlano?: string;
}): string {
  const obra = (opts.nombreObra ?? '').trim() || 'Obra sin nombre';
  const pref = (opts.disciplinaPreferida ?? '').trim() || 'auto';
  const codigo = (opts.codigoPlano ?? '').trim();
  const nombre = (opts.nombrePlano ?? '').trim();

  return [
    `Analiza este plano de construcción y genera cómputo + prepresupuesto borrador (Metron).`,
    `Obra: ${obra}`,
    codigo ? `Código de plano: ${codigo}` : null,
    nombre ? `Nombre de plano: ${nombre}` : null,
    `Disciplina preferida (si "auto", clasifica tú): ${pref}`,
    '',
    'Devuelve JSON con: disciplina principal, especialidades detectadas, título del plano, escala, resumen,',
    'supuestos[], alertas[], y computos[] (cada ítem: codigo_sugerido, descripcion, unidad, cantidad,',
    'precio_unitario_estimado, monto_estimado, capitulo_sugerido, supuesto, confianza 0-100, disciplina).',
    'monto_estimado = cantidad × precio_unitario_estimado (redondea a 2 decimales).',
    'Si el plano mezcla especialidades, marca disciplina=mixta y etiqueta cada cómputo.',
  ]
    .filter(Boolean)
    .join('\n');
}
