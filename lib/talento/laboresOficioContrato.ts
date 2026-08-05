/**
 * Labores por oficio del tabulador (GOE 6.752) para auto-relleno en contratos.
 * Solo oficios con ficha de labores en la referencia de gaceta del proyecto
 * (`requisitosOficiosGaceta`). Si el cargo no tiene ficha, no se inventa texto.
 */
import { cargoPorCodigo } from '@/lib/constants/cargosObreros';
import { fichaRequisitosPorCodigo } from '@/lib/constants/requisitosOficiosGaceta';

export type FuenteLaboresOficio = 'gaceta';

export type LaboresOficioContrato = {
  codigo: string;
  nombre: string;
  labores: string;
  fuente: FuenteLaboresOficio;
};

const LABORES_POR_CODIGO: Record<string, LaboresOficioContrato> = {
  '1.1': {
    codigo: '1.1',
    nombre: 'OBRERO DE 1era.',
    labores: 'Excavaciones, carga/descarga, apoyo general en obra.',
    fuente: 'gaceta' as const,
  },
  '1.2': {
    codigo: '1.2',
    nombre: 'VIGILANTE',
    labores: 'Organizar depósito, recibir mercancía, control de implementos de seguridad.',
    fuente: 'gaceta' as const,
  },
  '2.2': {
    codigo: '2.2',
    nombre: 'AUXILIAR DE DEPOSITO',
    labores: 'Despacho contra órdenes, organización de estanterías, inventario de seguridad.',
    fuente: 'gaceta' as const,
  },
  '2.3': {
    codigo: '2.3',
    nombre: 'CHOFER DE 4ta.',
    labores: 'Conducir vehículos ligeros (automóviles y camionetas) para recados o personal.',
    fuente: 'gaceta' as const,
  },
  '2.4': {
    codigo: '2.4',
    nombre: 'OPERADOR DE MARTILLO PERFORADOR',
    labores: 'Perforación de taladros verticales/horizontales y apoyo a equipos mayores.',
    fuente: 'gaceta' as const,
  },
  '2.6': {
    codigo: '2.6',
    nombre: 'AYUDANTE DE MECANICO DIESEL',
    labores: 'Limpieza de equipos, preparación de herramientas para el mecánico principal.',
    fuente: 'gaceta' as const,
  },
  '2.7': {
    codigo: '2.7',
    nombre: 'AYUDANTE DE TOPOGRAFO',
    labores: 'Transporte y cuido de instrumentos, colocación de estacas y señalamientos.',
    fuente: 'gaceta' as const,
  },
  '2.8': {
    codigo: '2.8',
    nombre: 'RASTRILLERO',
    labores: 'Colocación de asfalto en baches, construcción de juntas y drenajes.',
    fuente: 'gaceta' as const,
  },
  '2.9': {
    codigo: '2.9',
    nombre: 'ESPESORISTA',
    labores: 'Mantener uniformidad en el espesor del pavimento y verificar anchos de franja.',
    fuente: 'gaceta' as const,
  },
  '3.10': {
    codigo: '3.10',
    nombre: 'GINCHERO',
    labores: 'Instalación y operación de torres, cambio de guayas y mantenimiento menor.',
    fuente: 'gaceta' as const,
  },
  '3.11': {
    codigo: '3.11',
    nombre: 'MAQUINISTA DE CONCRETO DE 2da.',
    labores: 'Operar mezcladoras, verificar agregados y vibrar estructuras.',
    fuente: 'gaceta' as const,
  },
  '3.12': {
    codigo: '3.12',
    nombre: 'OPERADOR DE PLANTA FIJA DE 2da.',
    labores: 'Manipular controles, cambiar correas y controlar calidad del producto.',
    fuente: 'gaceta' as const,
  },
  '3.13': {
    codigo: '3.13',
    nombre: 'CHOFER DE 3ra. (HASTA 3 TONS)',
    labores: 'Manejo de camionetas de carga ligera.',
    fuente: 'gaceta' as const,
  },
  '3.16': {
    codigo: '3.16',
    nombre: 'ENGRASADOR',
    labores: 'Engrase general de maquinaria, revisión de baterías y cauchos, control de consumo.',
    fuente: 'gaceta' as const,
  },
  '3.17': {
    codigo: '3.17',
    nombre: 'CAUCHERO',
    labores: 'Montaje/desmontaje de cauchos, chequeo de presiones y reparaciones.',
    fuente: 'gaceta' as const,
  },
  '3.18': {
    codigo: '3.18',
    nombre: 'MECÁNICO DE GASOLINA DE 2da.',
    labores: 'Arreglar motores de equipos pequeños (vibradores, bombas, compactadores tipo "sapo", mezcladoras hasta 11 pies). Desarmar y limpiar motores bajo instrucciones.',
    fuente: 'gaceta' as const,
  },
  '3.19': {
    codigo: '3.19',
    nombre: 'SOLDADOR DE 3ra.',
    labores: 'Soldaduras de importancia secundaria en taller o campo y cortes con acetileno usuales en construcción.',
    fuente: 'gaceta' as const,
  },
  '3.20': {
    codigo: '3.20',
    nombre: 'LATONERO DE 2da.',
    labores: 'Identificar redes de suministro y retorno. Ensamblar y montar ductos de basura, ventilación y aire acondicionado simples. Fijar anclajes y rejillas.',
    fuente: 'gaceta' as const,
  },
  '3.21': {
    codigo: '3.21',
    nombre: 'INSTALADOR ELECTRICOMECANICO DE 2da.',
    labores: 'Instalar bombas, motores de combustión y eléctricos, filtros y válvulas sencillas. Tareas de plomería simple y asistir al montador de primera.',
    fuente: 'gaceta' as const,
  },
  '3.22': {
    codigo: '3.22',
    nombre: 'OPERADOR EQUIPO DE SANDBLASTING',
    labores: 'Manejo de compresor industrial, control de presión de aire y uso de pistola especial con materiales como arena silicia o carborundo para tratar metal o concreto.',
    fuente: 'gaceta' as const,
  },
  '4.1': {
    codigo: '4.1',
    nombre: 'MAQUINISTA DE CONCRETO DE 1ra.',
    labores: 'Operar con habilidad equipos de mezclar, transportar, vaciar y acabar concreto. Reparaciones menores y lubricación del equipo.',
    fuente: 'gaceta' as const,
  },
  '4.2': {
    codigo: '4.2',
    nombre: 'OPERADOR DE PLANTA FIJA DE 1ra.',
    labores: 'Operar plantas fijas, vigilar calderas y temperaturas, controlar el sistema de extracción de polvo y dirigir el despacho en calidad y cantidad.',
    fuente: 'gaceta' as const,
  },
  '4.3': {
    codigo: '4.3',
    nombre: 'CHOFER DE 2ra. (DE 3 A 8 TONS)',
    labores: 'Conducir vehículos de carga hasta 8 toneladas o 6 metros cúbicos. Manejar camiones de transporte de pasajeros dentro de estos límites.',
    fuente: 'gaceta' as const,
  },
  '4.5': {
    codigo: '4.5',
    nombre: 'MECANICO DE GASOLINA DE 1ra.',
    labores: 'Revisar y reparar toda clase de vehículos y equipos de construcción. Instruir a los mecánicos de segunda en el desarmado de mecanismos.',
    fuente: 'gaceta' as const,
  },
  '4.6': {
    codigo: '4.6',
    nombre: 'SOLDADOR DE 2da.',
    labores: 'Soldaduras autógenas, manejo de máquina de biselar tubos, soldadura de estaño, relleno de dientes de equipos pesados y unión de perfiles secundarios.',
    fuente: 'gaceta' as const,
  },
  '4.7': {
    codigo: '4.7',
    nombre: 'OPERADOR DE PAVIMENTADORA',
    labores: 'Operar el equipo pavimentador, leer chaflanes para distribuir el asfalto y trabajar bajo altas temperaturas de material.',
    fuente: 'gaceta' as const,
  },
  '5.9': {
    codigo: '5.9',
    nombre: 'CHOFER DE 1ra. (DE 8 A 15 TONS)',
    labores: 'Conducir camiones hasta 15 toneladas o 10 metros cúbicos. Manejar autobuses de transporte de trabajadores.',
    fuente: 'gaceta' as const,
  },
  '5.15': {
    codigo: '5.15',
    nombre: 'MECANICO EQUIPO PESADO DE 2da.',
    labores: 'Arreglar motores y partes de equipos pesados bajo instrucciones del Maestro o Mecánico de 1ra. No está obligado a usar catálogos.',
    fuente: 'gaceta' as const,
  },
  '5.16': {
    codigo: '5.16',
    nombre: 'OPERADOR MAQUINAS-HERRAMIENTAS 2da.',
    labores: 'Trazados mecánicos sencillos, limado manual, corte de metales con sierra mecánica y trabajos básicos en máquinas herramientas.',
    fuente: 'gaceta' as const,
  },
  '5.17': {
    codigo: '5.17',
    nombre: 'SOLDADOR DE 1ra.',
    labores: 'Soldaduras de tuberías de presión, perfiles estructurales, tanques y depósitos metálicos. Rellenar bocinas y ejes para rectificación en torno.',
    fuente: 'gaceta' as const,
  },
  '5.18': {
    codigo: '5.18',
    nombre: 'TUBERO FABRICADOR',
    labores: 'Corte y biselado de precisión, confección de juntas e instalación de válvulas.',
    fuente: 'gaceta' as const,
  },
  '5.19': {
    codigo: '5.19',
    nombre: 'MONTADOR',
    labores: 'Erección de estructuras, tanques y fijación de techos/paredes.',
    fuente: 'gaceta' as const,
  },
  '5.20': {
    codigo: '5.20',
    nombre: 'LATONERO DE 1ra.',
    labores: 'Despiece, fabricación y montaje de ductos y difusores.',
    fuente: 'gaceta' as const,
  },
  '5.21': {
    codigo: '5.21',
    nombre: 'INSTALADOR ELECTRICOMECANICO DE 1ra.',
    labores: 'Instalación de equipos industriales, paneles de control e instrumentos.',
    fuente: 'gaceta' as const,
  },
  '5.22': {
    codigo: '5.22',
    nombre: 'LINIERO DE 1ra.',
    labores: 'Mantenimiento de torres, cambio de aisladores y conexiones a tierra.',
    fuente: 'gaceta' as const,
  },
  '5.23': {
    codigo: '5.23',
    nombre: 'ALBAÑIL REFRACTARIO',
    labores: 'Revestir estructuras con ladrillos refractarios y frisar ductos térmicos.',
    fuente: 'gaceta' as const,
  },
  '6.2': {
    codigo: '6.2',
    nombre: 'CHOFER DE CAMIÓN MAS DE 15 TONS.',
    labores: 'Conducir camiones de alto tonelaje y unidades de transporte de obreros.',
    fuente: 'gaceta' as const,
  },
  '6.3': {
    codigo: '6.3',
    nombre: 'CHOFER DE GANDOLA DE 2da. (DE 15-40T)',
    labores: 'Conducir unidades pesadas y supervisar la estiba de equipos.',
    fuente: 'gaceta' as const,
  },
  '6.4': {
    codigo: '6.4',
    nombre: 'CHOFER DE CAMIÓN MEZCLADOR',
    labores: 'Operar el trompo mezclador, entrega en sitio y limpieza del equipo.',
    fuente: 'gaceta' as const,
  },
  '7.10': {
    codigo: '7.10',
    nombre: 'CHOFER DE GANDOLA DE 1ra. (TODO TON.)',
    labores: 'Conducción de cualquier vehículo asignado sin restricción de carga.',
    fuente: 'gaceta' as const,
  },
  '7.13': {
    codigo: '7.13',
    nombre: 'MAESTRO DE OBRAS ELECTROMECANICAS',
    labores: 'Supervisión de montaje de bombas, tableros y sistemas de control.',
    fuente: 'gaceta' as const,
  },
  '8.8': {
    codigo: '8.8',
    nombre: 'MECÁNICO EQUIPO PESADO DE 1ra.',
    labores: 'Reparación integral de flota pesada y manejo de catálogos técnicos.',
    fuente: 'gaceta' as const,
  },
  '8.9': {
    codigo: '8.9',
    nombre: 'OPERADOR MÁQUINAS-HERRAMIENTAS 1ra.',
    labores: 'Tallado de engranajes, roscados y piezas de alta precisión.',
    fuente: 'gaceta' as const,
  },
  '9.1': {
    codigo: '9.1',
    nombre: 'MAESTRO DE OBRA DE 1ra.',
    labores: 'Dirigir toda la obra, elaborar nóminas y organizar turnos de personal.',
    fuente: 'gaceta' as const,
  },
  '9.2': {
    codigo: '9.2',
    nombre: 'MAESTRO MECÁNICO',
    labores: 'Asignar labores a mecánicos, supervisar seguridad y optimizar tiempos de reparación.',
    fuente: 'gaceta' as const,
  },
};

function normNombre(s: string): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

const _byNombre = new Map<string, LaboresOficioContrato>();
for (const row of Object.values(LABORES_POR_CODIGO)) {
  _byNombre.set(normNombre(row.nombre), row);
}

/** Labores del oficio por código del tabulador (ej. `5.17`). Solo si hay ficha gaceta. */
export function laboresOficioPorCodigo(codigo: string | null | undefined): LaboresOficioContrato | null {
  const c = String(codigo ?? '').trim();
  if (!c) return null;
  const hit = LABORES_POR_CODIGO[c];
  if (hit) return hit;
  const ficha = fichaRequisitosPorCodigo(c);
  const cargo = cargoPorCodigo(c);
  if (ficha.estado === 'detallada' && ficha.tareas?.trim()) {
    return {
      codigo: c,
      nombre: cargo?.nombre ?? c,
      labores: ficha.tareas.trim(),
      fuente: 'gaceta',
    };
  }
  return null;
}

/** Resolver por nombre de cargo (solo oficios con labores gaceta). */
export function laboresOficioPorNombre(nombre: string | null | undefined): LaboresOficioContrato | null {
  const n = normNombre(nombre ?? '');
  if (!n) return null;
  const exact = _byNombre.get(n);
  if (exact) return exact;
  for (const row of Object.values(LABORES_POR_CODIGO)) {
    const rn = normNombre(row.nombre);
    if (rn.includes(n) || n.includes(rn)) return row;
  }
  return null;
}

const FALLBACK_GENERICO =
  'las tareas inherentes a su cargo y aquellas asignadas por su supervisor inmediato';

/**
 * Texto de labores para contrato (solo gaceta u override explícito).
 * Si el oficio no tiene ficha gaceta y no hay override, devuelve cadena vacía.
 */
export function laboresContratoDesdeCargo(opts: {
  cargoCodigo?: string | null;
  cargoNombre?: string | null;
  funcionesOficiales?: string | null;
  tareasEspecificas?: string | null;
  /** Si true, cuando no hay ficha/override usa el texto genérico (API markdown). */
  conFallbackGenerico?: boolean;
}): string {
  const override =
    String(opts.funcionesOficiales ?? '').trim() || String(opts.tareasEspecificas ?? '').trim();
  const nom = String(opts.cargoNombre ?? '').trim();
  if (override && (!nom || normNombre(override) !== normNombre(nom))) {
    return override;
  }
  const byCod = laboresOficioPorCodigo(opts.cargoCodigo);
  if (byCod?.labores) return byCod.labores;
  const byNom = laboresOficioPorNombre(opts.cargoNombre);
  if (byNom?.labores) return byNom.labores;
  if (opts.conFallbackGenerico) return override || FALLBACK_GENERICO;
  return '';
}

/** Frase lista para insertar en cláusula PRIMERA (vacía si no hay labores gaceta/override). */
export function fraseLaboresOficioContrato(opts: {
  cargoCodigo?: string | null;
  cargoNombre?: string | null;
  funcionesOficiales?: string | null;
  tareasEspecificas?: string | null;
}): string {
  const labores = laboresContratoDesdeCargo(opts);
  if (!labores) return '';
  return ` Las labores principales del oficio son: ${labores}.`;
}

/** Catálogo de oficios con labores gaceta (45). */
export function listarLaboresOficiosContrato(): LaboresOficioContrato[] {
  return Object.values(LABORES_POR_CODIGO).sort((a, b) => {
    const [a1, a2] = a.codigo.split('.').map(Number);
    const [b1, b2] = b.codigo.split('.').map(Number);
    return a1 - b1 || a2 - b2;
  });
}
