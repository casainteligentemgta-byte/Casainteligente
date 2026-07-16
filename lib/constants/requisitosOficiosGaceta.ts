/**
 * Requisitos por oficio según la estructura de oficios y requisitos de la Gaceta Oficial
 * (texto de referencia aportado al proyecto). Los códigos coinciden con `CARGOS_OBREROS`
 * en `cargosObreros.ts` (formato X.Y).
 *
 * Uso: consultar `fichaRequisitosPorCodigo` para HR/reclutamiento y como guía de criterios
 * de instrucción, experiencia, conocimientos y tareas cuando el texto fuente las detalla.
 */

export type EstadoFichaRequisitos = 'detallada' | 'sin_descripcion_fuente' | 'no_en_resumen';

export interface FichaRequisitosOficio {
  codigo: string;
  estado: EstadoFichaRequisitos;
  instruccion?: string;
  experiencia?: string;
  conocimientos?: string;
  tareas?: string;
}

/** Notas al pie por nivel (texto fuente incompleto para todo el tabulador). */
export const NOTAS_NIVEL_REQUISITOS_GACETA: Readonly<Record<number, string>> = {
  3: 'Cargos 3.1 a 3.9 (p. ej. Caporal, Albañil 2da., Carpintero 2da.): en el texto de referencia no se detallaron Conocimientos ni Tareas por código; consultar tabulador oficial completo.',
  5: 'Cargos 5.1 a 5.8 y 5.10 a 5.14: en el texto de referencia no se incluyeron Conocimientos ni Tareas para no inventar requisitos. 5.24 a 5.26: sin descripción técnica en el mismo texto.',
  7: 'Cargos 7.1 a 7.9: sin descripción técnica en el texto de referencia; el resto del nivel puede tener ficha abajo.',
};

const DETALLADAS: Readonly<Record<string, Omit<FichaRequisitosOficio, 'codigo' | 'estado'>>> = {
  '1.1': {
    instruccion: 'Saber leer y escribir.',
    experiencia: 'Mínimo 2 años como Ayudante.',
    conocimientos: 'Herramientas manuales, mezclas básicas y seguridad.',
    tareas: 'Excavaciones, carga/descarga, apoyo general en obra.',
  },
  '1.2': {
    instruccion: 'Saber leer y escribir.',
    experiencia: '4 años como Obrero de 1era. Buena conducta.',
    conocimientos: 'Nombres de materiales, repuestos y herramientas. Control de entradas/salidas.',
    tareas: 'Organizar depósito, recibir mercancía, control de implementos de seguridad.',
  },
  '2.2': {
    instruccion: '3er grado o saber leer, escribir y aritmética básica.',
    experiencia: '4 años como Obrero de 1era o Ayudante.',
    conocimientos: 'Identificación de materiales y repuestos. Cubicaje y conteo.',
    tareas: 'Despacho contra órdenes, organización de estanterías, inventario de seguridad.',
  },
  '2.3': {
    instruccion: '3er grado o saber leer, escribir y aritmética básica.',
    experiencia: '3 años como Ayudante.',
    conocimientos: 'Motores a gasolina, lubricación, Ley de Tránsito.',
    tareas: 'Conducir vehículos ligeros (automóviles y camionetas) para recados o personal.',
  },
  '2.4': {
    instruccion: 'Saber leer y escribir.',
    experiencia: '2 años como Obrero de 1era.',
    conocimientos: 'Acoplamiento de mangueras de aire, brocas y riesgos de presión.',
    tareas: 'Perforación de taladros verticales/horizontales y apoyo a equipos mayores.',
  },
  '2.6': {
    instruccion: 'Saber leer, escribir y aritmética básica.',
    experiencia: '3 años como Obrero de 1era.',
    conocimientos: 'Nombres de herramientas y equipos livianos. Nociones de motores.',
    tareas: 'Limpieza de equipos, preparación de herramientas para el mecánico principal.',
  },
  '2.7': {
    instruccion: '6to grado.',
    experiencia: '2 años como Obrero de 1era.',
    conocimientos: 'Conceptos de talud y relleno. Identificación de teodolito, mira y prismas.',
    tareas: 'Transporte y cuido de instrumentos, colocación de estacas y señalamientos.',
  },
  '2.8': {
    instruccion: '6to grado.',
    experiencia: '1 año como Ayudante.',
    conocimientos: 'Métodos de acabado asfáltico y espesores de capas.',
    tareas: 'Colocación de asfalto en baches, construcción de juntas y drenajes.',
  },
  '2.9': {
    instruccion: '6to grado.',
    experiencia: '1 año como Ayudante.',
    conocimientos: 'Graduación de pavimentadoras y relación de compactación.',
    tareas: 'Mantener uniformidad en el espesor del pavimento y verificar anchos de franja.',
  },
  '3.10': {
    instruccion: 'Saber leer y escribir.',
    experiencia: '2 años como Obrero de 1era.',
    conocimientos: 'Manejo de guinches y torres elevadoras. Pesos de materiales.',
    tareas: 'Instalación y operación de torres, cambio de guayas y mantenimiento menor.',
  },
  '3.11': {
    instruccion: 'Saber leer y escribir.',
    experiencia: '2 años como Obrero de 1era.',
    conocimientos: 'Mezcladoras hasta 0.50m³, vibradores y carretillas mecánicas.',
    tareas: 'Operar mezcladoras, verificar agregados y vibrar estructuras.',
  },
  '3.12': {
    instruccion: '6to grado.',
    experiencia: '2 años como Ayudante de Planta.',
    conocimientos: 'Plantas picadoras y dosificadoras portátiles. Desgaste de muelas/cedazos.',
    tareas: 'Manipular controles, cambiar correas y controlar calidad del producto.',
  },
  '3.13': {
    instruccion: '3er grado o saber leer y escribir.',
    experiencia: '2 años como Chofer de 4ta.',
    conocimientos: 'Capacidad de carga y límites de camionetas de 3 toneladas.',
    tareas: 'Manejo de camionetas de carga ligera.',
  },
  '3.16': {
    instruccion: '4to grado.',
    experiencia: '3 años como Operador de Equipo Liviano.',
    conocimientos: 'Tipos de lubricantes (aceites/grasas), presiones y niveles de fluidos.',
    tareas: 'Engrase general de maquinaria, revisión de baterías y cauchos, control de consumo.',
  },
  '3.17': {
    instruccion: '6to grado.',
    experiencia: '2 años como Obrero de 1era.',
    conocimientos: 'Manómetros, válvulas y seguridad en inflado.',
    tareas: 'Montaje/desmontaje de cauchos, chequeo de presiones y reparaciones.',
  },
  '3.18': {
    instruccion: '4to grado o título de Escuela Técnica Industrial.',
    experiencia: 'Poseer diploma de Mecánico o 4 años como Ayudante.',
    conocimientos:
      'Herramientas de taller (manejo de lima), motores de gasolina, sistemas de inyección y encendido, esmerilado de válvulas.',
    tareas:
      'Arreglar motores de equipos pequeños (vibradores, bombas, compactadores tipo "sapo", mezcladoras hasta 11 pies). Desarmar y limpiar motores bajo instrucciones.',
  },
  '3.19': {
    instruccion: '3er grado de instrucción primaria.',
    experiencia: 'Haber trabajado como Ayudante no menos de 4 años.',
    conocimientos:
      'Máquinas de soldar, electrodos comunes, nociones de equipos de oxi-acetileno y seguridad industrial.',
    tareas: 'Soldaduras de importancia secundaria en taller o campo y cortes con acetileno usuales en construcción.',
  },
  '3.20': {
    instruccion: '6to grado y operaciones aritméticas fundamentales.',
    experiencia: '2 años como Ayudante.',
    conocimientos:
      'Herramientas de ductos, materiales y características de sistemas de ductos usuales. Operación de andamios y seguridad.',
    tareas:
      'Identificar redes de suministro y retorno. Ensamblar y montar ductos de basura, ventilación y aire acondicionado simples. Fijar anclajes y rejillas.',
  },
  '3.21': {
    instruccion: '6to grado de instrucción primaria.',
    experiencia: '3 años como Ayudante.',
    conocimientos:
      'Nociones de electricidad industrial, mecánica diesel y gasolina. Bombas, válvulas sencillas y motores eléctricos.',
    tareas:
      'Instalar bombas, motores de combustión y eléctricos, filtros y válvulas sencillas. Tareas de plomería simple y asistir al montador de primera.',
  },
  '3.22': {
    instruccion: 'Educación Básica.',
    experiencia: 'Haber trabajado como Ayudante en el oficio.',
    conocimientos:
      'Denominación de materiales, manejo de equipos y herramientas de limpieza por chorro de arena bajo medidas de seguridad.',
    tareas:
      'Manejo de compresor industrial, control de presión de aire y uso de pistola especial con materiales como arena silicia o carborundo para tratar metal o concreto.',
  },
  '4.1': {
    instruccion: '3er grado o saber leer, escribir y aritmética básica.',
    experiencia: '3 años como Maquinista de Segunda.',
    conocimientos:
      'Mezcladoras de más de 0.50 m³, bombas, pavimentadores y montaje de equipos. Conocimiento de lubricantes.',
    tareas:
      'Operar con habilidad equipos de mezclar, transportar, vaciar y acabar concreto. Reparaciones menores y lubricación del equipo.',
  },
  '4.2': {
    instruccion: '6to grado de instrucción primaria.',
    experiencia: '2 años como Operador de Segunda.',
    conocimientos: 'Dosificadoras de concreto fijas y de asfalto. Tipos de mezclas asfálticas y resistencias de concreto.',
    tareas:
      'Operar plantas fijas, vigilar calderas y temperaturas, controlar el sistema de extracción de polvo y dirigir el despacho en calidad y cantidad.',
  },
  '4.3': {
    instruccion: '3er grado o saber leer, escribir y aritmética básica.',
    experiencia: '2 años como Chofer de Tercera.',
    conocimientos: 'Características de motores a gasolina, detalles de funcionamiento del vehículo y límites de carga/volteo.',
    tareas:
      'Conducir vehículos de carga hasta 8 toneladas o 6 metros cúbicos. Manejar camiones de transporte de pasajeros dentro de estos límites.',
  },
  '4.5': {
    instruccion: '6to grado de instrucción primaria.',
    experiencia: '3 años como Mecánico de Gasolina de Segunda.',
    conocimientos:
      'Máquinas de alineación y balanceo, graduación de inyección, convertidores de torsión y sistemas hidráulicos. Interpretación de catálogos.',
    tareas:
      'Revisar y reparar toda clase de vehículos y equipos de construcción. Instruir a los mecánicos de segunda en el desarmado de mecanismos.',
  },
  '4.6': {
    instruccion: '4to grado o título de Escuela Técnica Industrial.',
    experiencia: '2 años como Soldador de Tercera.',
    conocimientos:
      'Generadores y transformadores de soldadura, amperajes, tipos de soldadura (tope, bisel), equipos de oxicorte y soldadura autógena.',
    tareas:
      'Soldaduras autógenas, manejo de máquina de biselar tubos, soldadura de estaño, relleno de dientes de equipos pesados y unión de perfiles secundarios.',
  },
  '4.7': {
    instruccion: '6to grado de instrucción primaria.',
    experiencia: '2 años como Ayudante de Pavimentadora y Espesorista.',
    conocimientos: 'Características de pavimentadoras de oruga o caucho, temperaturas y densidades de capas asfálticas.',
    tareas: 'Operar el equipo pavimentador, leer chaflanes para distribuir el asfalto y trabajar bajo altas temperaturas de material.',
  },
  '5.9': {
    instruccion: '4to grado de instrucción primaria.',
    experiencia: '2 años como Chofer de Segunda.',
    conocimientos:
      'Motores diesel, principios de mecánica aplicada, distancias de frenado, señales de tránsito y aditamentos mecánicos de carga.',
    tareas:
      'Conducir camiones hasta 15 toneladas o 10 metros cúbicos. Manejar autobuses de transporte de trabajadores.',
  },
  '5.15': {
    instruccion: '4to grado o título de Escuela Técnica Industrial.',
    experiencia: '4 años como Ayudante.',
    conocimientos:
      'Nombres y características de equipos pesados (motoniveladoras, palas, grúas). Funcionamiento de motores diesel y accesorios (bombas de agua, dinamos).',
    tareas:
      'Arreglar motores y partes de equipos pesados bajo instrucciones del Maestro o Mecánico de 1ra. No está obligado a usar catálogos.',
  },
  '5.16': {
    instruccion: '3er año de bachillerato.',
    experiencia: '2 años como Ayudante.',
    conocimientos:
      'Características de materiales, uso de torno, fresadora o limadora. Instrumentos de verificación y control. Interpretación de dibujos sencillos.',
    tareas: 'Trazados mecánicos sencillos, limado manual, corte de metales con sierra mecánica y trabajos básicos en máquinas herramientas.',
  },
  '5.17': {
    instruccion: '6to grado de instrucción primaria.',
    experiencia: '3 años como Soldador de Segunda.',
    conocimientos:
      'Métodos de soldadura eléctrica y autógena de alta dificultad, pruebas de calidad (Rayos X), estimado de materiales y condiciones de equipos.',
    tareas:
      'Soldaduras de tuberías de presión, perfiles estructurales, tanques y depósitos metálicos. Rellenar bocinas y ejes para rectificación en torno.',
  },
  '5.18': {
    instruccion: '6to grado.',
    experiencia: '3 años como Soldador de 2da.',
    conocimientos: 'Lectura de planos e isometrías.',
    tareas: 'Corte y biselado de precisión, confección de juntas e instalación de válvulas.',
  },
  '5.19': {
    instruccion: '4to grado.',
    experiencia: '4 años como Ayudante.',
    conocimientos: 'Perfiles metálicos, sistema métrico y seguridad en alturas.',
    tareas: 'Erección de estructuras, tanques y fijación de techos/paredes.',
  },
  '5.20': {
    instruccion: '6to grado y aritmética.',
    experiencia: '3 años como Latonero de 2da.',
    conocimientos: 'Planos de ductos de aire/basura. Uso de dobladoras y guillotinas.',
    tareas: 'Despiece, fabricación y montaje de ductos y difusores.',
  },
  '5.21': {
    instruccion: '3er año de bachillerato.',
    experiencia: '4 años como Montador de 2da.',
    conocimientos: 'Tableros de control, alta tensión y diagramas complejos.',
    tareas: 'Instalación de equipos industriales, paneles de control e instrumentos.',
  },
  '5.22': {
    instruccion: '5to año de bachillerato + curso técnico.',
    experiencia: '2 años como Liniero de 2da.',
    conocimientos: 'Sistemas de transmisión, trabajo en caliente y frío.',
    tareas: 'Mantenimiento de torres, cambio de aisladores y conexiones a tierra.',
  },
  '5.23': {
    instruccion: 'Educación Básica.',
    experiencia: '1 a 2 años como Albañil.',
    conocimientos: 'Mezcla refractaria y anclajes.',
    tareas: 'Revestir estructuras con ladrillos refractarios y frisar ductos térmicos.',
  },
  '6.2': {
    instruccion: '4to grado.',
    experiencia: '3 años como Chofer de 1era.',
    conocimientos: 'Todos los de categorías inferiores.',
    tareas: 'Conducir camiones de alto tonelaje y unidades de transporte de obreros.',
  },
  '6.3': {
    instruccion: '6to grado.',
    experiencia: '5 años como Chofer de 1era.',
    conocimientos: 'Bateas, low boys y métodos de carga de maquinaria.',
    tareas: 'Conducir unidades pesadas y supervisar la estiba de equipos.',
  },
  '6.4': {
    instruccion: '6to grado.',
    experiencia: '1 año como Chofer de 1era.',
    conocimientos: 'Tiempos de fraguado y trabajabilidad (slump).',
    tareas: 'Operar el trompo mezclador, entrega en sitio y limpieza del equipo.',
  },
  '7.10': {
    instruccion: '6to grado.',
    experiencia: '3 años como Chofer de Gandola de 2da.',
    conocimientos: 'Dominio total de cualquier unidad de transporte.',
    tareas: 'Conducción de cualquier vehículo asignado sin restricción de carga.',
  },
  '7.13': {
    instruccion: '5to año de bachillerato (Ciencias) + cursos especializados.',
    experiencia: '4 años como Montador de 1era.',
    conocimientos: 'Planos complejos, diagramas de flujo y soldadura.',
    tareas: 'Supervisión de montaje de bombas, tableros y sistemas de control.',
  },
  '8.8': {
    instruccion: '6to grado.',
    experiencia: '3 años como Mecánico de 2da.',
    conocimientos: 'Motores diesel complejos y ensamblaje de maquinaria pesada.',
    tareas: 'Reparación integral de flota pesada y manejo de catálogos técnicos.',
  },
  '8.9': {
    instruccion: '5to año de bachillerato.',
    experiencia: '2 años como Operador de 2da.',
    conocimientos: 'Torno, fresadora y limadora (avanzado). Dibujo complejo.',
    tareas: 'Tallado de engranajes, roscados y piezas de alta precisión.',
  },
  '9.1': {
    instruccion: 'Título de Escuela Técnica o Asociación de Maestros.',
    experiencia: '5 años como Maestro de 2da.',
    conocimientos: 'Topografía, costos, leyes laborales y todas las especialidades.',
    tareas: 'Dirigir toda la obra, elaborar nóminas y organizar turnos de personal.',
  },
  '9.2': {
    instruccion: 'Título de Mecánico de Escuela Técnica.',
    experiencia: '5 años como Mecánico de 1era.',
    conocimientos: 'Organización de talleres, pedidos de repuestos y gestión de personal.',
    tareas: 'Asignar labores a mecánicos, supervisar seguridad y optimizar tiempos de reparación.',
  },
};

/** Códigos que el texto fuente marcó explícitamente sin descripción técnica. */
const SOLO_SIN_DESCRIPCION_FUENTE = new Set([
  '2.1',
  '2.5',
  '2.10',
  '3.14',
  '3.15',
  '5.24',
  '5.25',
  '5.26',
  '6.5',
  '6.6',
  '6.7',
  '8.2',
]);

export function fichaRequisitosPorCodigo(codigo: string): FichaRequisitosOficio {
  const d = DETALLADAS[codigo];
  if (d) {
    return { codigo, estado: 'detallada', ...d };
  }
  if (SOLO_SIN_DESCRIPCION_FUENTE.has(codigo)) {
    return {
      codigo,
      estado: 'sin_descripcion_fuente',
    };
  }
  return {
    codigo,
    estado: 'no_en_resumen',
  };
}
