import { mapaEvaluacionDesdeRol } from '@/lib/talento/psique/mapaEvaluacion';
import type { RecomendacionPsiqueResult } from '@/lib/talento/psique/recomendarPruebasPsique';
import { rolExamenDesdePsique } from '@/lib/talento/psique/recomendarPruebasPsique';

/** JSON a persistir en `ci_empleados.psique_recomendacion`. */
export function snapshotPsiqueRecomendacion(rec: RecomendacionPsiqueResult) {
  const rol = rolExamenDesdePsique(rec.rol_examen_sugerido);
  const mapa = mapaEvaluacionDesdeRol(rol);
  return {
    palabras_clave: rec.palabras_clave,
    pruebas: rec.pruebas.map((p) => ({
      id_prueba: p.id_prueba,
      nombre_prueba: p.nombre_prueba,
      categoria: p.categoria,
      rol_examen_sugerido: p.rol_examen_sugerido,
      es_clinico: p.es_clinico,
    })),
    rol_examen_sugerido: rol,
    motor_semaforo: mapa.motor,
    libro: mapa.libro,
    banco: mapa.banco,
    fuente: rec.fuente,
    aviso: rec.aviso ?? null,
    at: new Date().toISOString(),
  };
}
