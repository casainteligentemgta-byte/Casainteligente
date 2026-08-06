/**
 * Catálogo fijo de fases técnicas de obra (cláusula PRIMERA).
 * Fuente de selección en Express / Editar / módulo de proyecto.
 */

export type CategoriaFaseTecnica = {
  id: string;
  nombre: string;
  fases: string[];
};

export const CATALOGO_FASES_TECNICAS_OBRA: CategoriaFaseTecnica[] = [
  {
    id: 'preliminar-movimiento-tierras',
    nombre: 'Preliminar y Movimiento de Tierras',
    fases: [
      'Deforestación, limpieza y desmalezamiento del terreno',
      'Replanteo, topografía y nivelación',
      'Excavación en tierra/roca a cielo abierto',
      'Excavación de zanjas y zapatas',
      'Carga, transporte y bote de material sobrante',
      'Relleno y compactación de terrenos',
      'Demolición de estructuras o pavimentos existentes',
    ],
  },
  {
    id: 'fundaciones-estructura',
    nombre: 'Fundaciones y Estructura (Edificaciones)',
    fases: [
      'Vaciado de concreto de limpieza (piedra picada/pobre)',
      'Armado de acero de refuerzo para fundaciones y zapatas',
      'Encofrado de fundaciones, vigas de riostra y pilotes',
      'Vaciado de concreto en pilotes o pantallas',
      'Vaciado de concreto en zapatas y pedestales',
      'Armado y encofrado de columnas y pantallas',
      'Vaciado de concreto en columnas y losas de piso',
      'Encofrado y armado de losas de entrepiso y techo',
      'Vaciado de concreto en losas (macizas, nervadas o losacero)',
      'Montaje e instalación de estructuras metálicas',
      'Desencofrado y curado de elementos de concreto',
    ],
  },
  {
    id: 'albanileria-acabados',
    nombre: 'Albañilería, Cerramientos y Acabados',
    fases: [
      'Construcción de paredes de bloque (arcilla o concreto)',
      'Friso base, salpicado y encamisado de paredes',
      'Friso acabado (liso/texturizado) en interiores y exteriores',
      'Colocación de sobrepisos, carpetas y vaciado de granito',
      'Colocación de revestimientos cerámicos, porcelanatos o piedras',
      'Instalación de tabiquería liviana (Drywall / Superboard)',
      'Instalación de cielos rasos (suspendidos o fijos)',
      'Pintura general en paredes, techos y fachadas',
      'Impermeabilización de losas, techos y jardineras',
    ],
  },
  {
    id: 'instalaciones',
    nombre: 'Instalaciones Sanitaria, Eléctrica y Mecánica (Edificaciones)',
    fases: [
      'Tendido de tuberías de red de agua potable (blanca)',
      'Tendido de tuberías de aguas servidas (negras) y de lluvia',
      'Instalación de piezas y artefactos sanitarios',
      'Cableado, empotramiento y tubería eléctrica (IEM)',
      'Instalación de tableros, breakers e interruptores',
      'Instalación de sistemas contra incendios (mangueras/rociadores)',
      'Instalación de sistemas de aire acondicionado y ductería',
    ],
  },
  {
    id: 'obras-viales',
    nombre: 'Obras Viales y Asfaltado',
    fases: [
      'Preparación y conformación de la subrasante',
      'Suministro, tendido y compactación de sub-base',
      'Suministro, tendido y compactación de base granular',
      'Riego de adherencia e imprimación asfáltica',
      'Colocación y compactación de mezcla asfáltica en caliente',
      'Construcción de brocales, aceras y cunetas de concreto',
      'Demarcación vial y señalización (horizontal y vertical)',
    ],
  },
  {
    id: 'hidraulica-urbanismo',
    nombre: 'Hidráulica, Cloacas y Urbanismo',
    fases: [
      'Excavación de zanjas para tuberías de alcantarillado',
      'Colocación de tuberías para redes de cloacas (PVC/Concreto)',
      'Construcción de bocas de visita y empotramientos domiciliarios',
      'Construcción de sumideros de ventana y rejas',
      'Construcción de gaviones y muros de contención',
    ],
  },
  {
    id: 'obras-finales',
    nombre: 'Obras Finales y Auxiliares',
    fases: [
      'Instalación de carpintería metálica (puertas, rejas, ventanas)',
      'Instalación de carpintería de madera (clósets, puertas, cocinas)',
      'Instalación de vidrios, ventanales y cristalería',
      'Limpieza general de obra y retiro de escombros',
    ],
  },
];

const SEPARADOR_FASES = '; ';

export function todasFasesCatalogo(): string[] {
  return CATALOGO_FASES_TECNICAS_OBRA.flatMap((c) => c.fases);
}

export function categoriaDeFase(fase: string): CategoriaFaseTecnica | undefined {
  const t = fase.trim();
  return CATALOGO_FASES_TECNICAS_OBRA.find((c) => c.fases.some((f) => f === t));
}

/** Parte el texto de la cláusula en ítems (por `;` o saltos de línea). */
export function parseFasesDesdeTexto(texto: string | null | undefined): string[] {
  const raw = String(texto ?? '').trim();
  if (!raw) return [];
  return raw
    .split(/\s*;\s*|\n+/)
    .map((s) => s.trim().replace(/^\d+[\.\)]\s*/, ''))
    .filter((s) => s.length >= 2);
}

export function componerTextoFases(fases: string[]): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const f of fases) {
    const t = f.trim().replace(/\s+/g, ' ');
    if (t.length < 2) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out.join(SEPARADOR_FASES);
}

/** Activa/desactiva una fase del catálogo dentro del texto compuesto. */
export function toggleFaseEnTexto(textoActual: string, fase: string): string {
  const faseTrim = fase.trim();
  if (faseTrim.length < 2) return String(textoActual ?? '').trim();
  const actuales = parseFasesDesdeTexto(textoActual);
  const key = faseTrim.toLowerCase();
  const idx = actuales.findIndex((f) => f.toLowerCase() === key);
  if (idx >= 0) {
    actuales.splice(idx, 1);
  } else {
    actuales.push(faseTrim);
  }
  return componerTextoFases(actuales);
}

export function faseEstaSeleccionada(textoActual: string, fase: string): boolean {
  const key = fase.trim().toLowerCase();
  if (!key) return false;
  return parseFasesDesdeTexto(textoActual).some((f) => f.toLowerCase() === key);
}
