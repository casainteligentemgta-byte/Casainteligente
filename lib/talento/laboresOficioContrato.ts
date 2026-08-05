/**
 * Labores por oficio del tabulador (GOE 6.752) para auto-relleno en contratos.
 * - `gaceta`: tomadas de `requisitosOficiosGaceta` (texto de referencia).
 * - `derivada`: redactadas a partir de la denominación del oficio (cobertura del catálogo).
 * - `generica`: fallback residual.
 */
import { CARGOS_OBREROS, cargoPorCodigo } from '@/lib/constants/cargosObreros';
import { fichaRequisitosPorCodigo } from '@/lib/constants/requisitosOficiosGaceta';

export type FuenteLaboresOficio = 'gaceta' | 'derivada' | 'generica';

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
  '2.1': {
    codigo: '2.1',
    nombre: 'AYUDANTE',
    labores: 'Apoyar a oficiales y maestros en labores de construcción: acarreo de materiales, limpieza de área, preparación de mezclas sencillas y asistencia en obra.',
    fuente: 'derivada' as const,
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
  '2.5': {
    codigo: '2.5',
    nombre: 'AYUDANTE DE OPERADORES',
    labores: 'Asistir al operador de maquinaria: limpieza, abastecimiento, señales de seguridad y apoyo en el mantenimiento menor del equipo.',
    fuente: 'derivada' as const,
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
  '2.10': {
    codigo: '2.10',
    nombre: 'PALERO ASFALTICO',
    labores: 'Extender, nivelar y compactar material asfáltico con pala; preparar juntas y apoyar al rastrillero y espesorista en pavimentación.',
    fuente: 'derivada' as const,
  },
  '3.1': {
    codigo: '3.1',
    nombre: 'CAPORAL',
    labores: 'Dirigir y coordinar cuadrillas de obra básica; asignar tareas diarias, controlar avance y velar por el cumplimiento de normas de seguridad.',
    fuente: 'derivada' as const,
  },
  '3.2': {
    codigo: '3.2',
    nombre: 'ALBAÑIL DE 2da.',
    labores: 'Ejecutar trabajos de albañilería de segunda: muros, frisos sencillos, mezclas, colocación de bloques y apoyo al albañil de primera.',
    fuente: 'derivada' as const,
  },
  '3.3': {
    codigo: '3.3',
    nombre: 'CARPINTERO DE 2da.',
    labores: 'Ejecutar carpintería de segunda: encofrados sencillos, corte y armado de madera, apoyo al carpintero de primera.',
    fuente: 'derivada' as const,
  },
  '3.4': {
    codigo: '3.4',
    nombre: 'CABILLERO DE 2da.',
    labores: 'Cortar, doblar y amarrar cabillas según indicaciones; armar hierros sencillos y apoyar al cabillero de primera.',
    fuente: 'derivada' as const,
  },
  '3.5': {
    codigo: '3.5',
    nombre: 'PLOMERO DE 2da.',
    labores: 'Instalar tuberías y accesorios de plomería sencillos; apoyar al plomero de primera en redes de agua y desagüe.',
    fuente: 'derivada' as const,
  },
  '3.6': {
    codigo: '3.6',
    nombre: 'ELECTRICISTA DE 2da.',
    labores: 'Ejecutar instalaciones eléctricas sencillas: canalizaciones, tendido de conductores y apoyo al electricista de primera.',
    fuente: 'derivada' as const,
  },
  '3.7': {
    codigo: '3.7',
    nombre: 'GRANITERO DE 2da.',
    labores: 'Preparar y colocar granito o terrazos sencillos; pulir y apoyar al granitero de primera.',
    fuente: 'derivada' as const,
  },
  '3.8': {
    codigo: '3.8',
    nombre: 'PINTOR DE 2da.',
    labores: 'Preparar superficies y aplicar pintura en obras de segunda; apoyar al pintor de primera.',
    fuente: 'derivada' as const,
  },
  '3.9': {
    codigo: '3.9',
    nombre: 'IMPERMEABILIZADOR DE 2da.',
    labores: 'Aplicar impermeabilizantes en superficies sencillas; preparar materiales y apoyar al impermeabilizador de primera.',
    fuente: 'derivada' as const,
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
  '3.14': {
    codigo: '3.14',
    nombre: 'OPERADOR DE EQUIPO PERFORADOR',
    labores: 'Operar equipos perforadores según instrucción; mantener el área segura y realizar mantenimiento menor del equipo.',
    fuente: 'derivada' as const,
  },
  '3.15': {
    codigo: '3.15',
    nombre: 'OPERADOR DE EQUIPO LIVIANO',
    labores: 'Operar equipo liviano de construcción (compactadores, mezcladoras menores, etc.) y cuidar su correcto uso y limpieza.',
    fuente: 'derivada' as const,
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
  '4.4': {
    codigo: '4.4',
    nombre: 'OPERADOR DE PALA HASTA 1YARDA CUB.',
    labores: 'Operar pala mecánica hasta 1 yarda cúbica: excavación, carga y movimiento de materiales según planos y señales de obra.',
    fuente: 'derivada' as const,
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
  '5.1': {
    codigo: '5.1',
    nombre: 'ALBAÑIL DE 1ra.',
    labores: 'Ejecutar albañilería de primera: muros, frisos, acabados, lectura de planos y dirección de ayudantes en su especialidad.',
    fuente: 'derivada' as const,
  },
  '5.2': {
    codigo: '5.2',
    nombre: 'CARPINTERO DE 1ra.',
    labores: 'Ejecutar carpintería de primera: encofrados complejos, estructuras de madera, lectura de planos y supervisión de ayudantes.',
    fuente: 'derivada' as const,
  },
  '5.3': {
    codigo: '5.3',
    nombre: 'CABILLERO DE 1ra.',
    labores: 'Armar hierro de primera según planos estructurales; cortar, doblar, amarrar y dirigir ayudantes de cabillería.',
    fuente: 'derivada' as const,
  },
  '5.4': {
    codigo: '5.4',
    nombre: 'PLOMERO DE 1ra.',
    labores: 'Instalar redes de plomería de primera: agua potable, sanitarios, pruebas de presión y lectura de planos.',
    fuente: 'derivada' as const,
  },
  '5.5': {
    codigo: '5.5',
    nombre: 'ELECTRICISTA DE 1ra.',
    labores: 'Ejecutar instalaciones eléctricas de primera: tableros, circuitos, fuerza y alumbrado conforme a planos y normas.',
    fuente: 'derivada' as const,
  },
  '5.6': {
    codigo: '5.6',
    nombre: 'GRANITERO DE 1ra.',
    labores: 'Ejecutar granito/terrazo de primera: colocación, pulido, acabados y control de calidad de superficies.',
    fuente: 'derivada' as const,
  },
  '5.7': {
    codigo: '5.7',
    nombre: 'PINTOR DE 1ra.',
    labores: 'Ejecutar pintura de primera: preparación, aplicación, acabados finos y protección de superficies.',
    fuente: 'derivada' as const,
  },
  '5.8': {
    codigo: '5.8',
    nombre: 'IMPERMEABILIZADOR DE 1ra.',
    labores: 'Ejecutar impermeabilización de primera: membranas, impermeabilizantes, detalles críticos y control de filtraciones.',
    fuente: 'derivada' as const,
  },
  '5.9': {
    codigo: '5.9',
    nombre: 'CHOFER DE 1ra. (DE 8 A 15 TONS)',
    labores: 'Conducir camiones hasta 15 toneladas o 10 metros cúbicos. Manejar autobuses de transporte de trabajadores.',
    fuente: 'gaceta' as const,
  },
  '5.10': {
    codigo: '5.10',
    nombre: 'OPERADOR DE EQUIPO PESADO DE 2da.',
    labores: 'Operar equipo pesado de segunda bajo supervisión: movimiento de tierra y materiales conforme a señales y normas de seguridad.',
    fuente: 'derivada' as const,
  },
  '5.11': {
    codigo: '5.11',
    nombre: 'TRACTORISTA DE 2da.',
    labores: 'Operar tractores de segunda: empuje, nivelación básica y movimiento de materiales en obra.',
    fuente: 'derivada' as const,
  },
  '5.12': {
    codigo: '5.12',
    nombre: 'OPERADOR DE MOTOTRAILLA DE 2da.',
    labores: 'Operar mototraílla de segunda: corte, transporte y depósito de material conforme a instrucción del caporal o maestro.',
    fuente: 'derivada' as const,
  },
  '5.13': {
    codigo: '5.13',
    nombre: 'OPERADOR DE MOTONIVELADORA DE 2da.',
    labores: 'Operar motoniveladora de segunda: perfilado y nivelación de vías y plataformas según cotas indicadas.',
    fuente: 'derivada' as const,
  },
  '5.14': {
    codigo: '5.14',
    nombre: 'OPERADOR DE GRUA (GRUERO) DE 2da.',
    labores: 'Operar grúa de segunda: izado y traslado de cargas bajo señales del rigger/caporal, respetando capacidades y radio de trabajo.',
    fuente: 'derivada' as const,
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
  '5.24': {
    codigo: '5.24',
    nombre: 'DEPOSITARIO',
    labores: 'Administrar depósito de obra: recepción, resguardo, despacho e inventario de materiales y herramientas.',
    fuente: 'derivada' as const,
  },
  '5.25': {
    codigo: '5.25',
    nombre: 'DUCTERO',
    labores: 'Fabricar e instalar ductos (aire, basura u otros) según planos; cortes, uniones y montaje en obra.',
    fuente: 'derivada' as const,
  },
  '5.26': {
    codigo: '5.26',
    nombre: 'ARMADOR METALICO',
    labores: 'Armar y montar estructuras metálicas: perfiles, uniones, aplomado y fijación conforme a planos.',
    fuente: 'derivada' as const,
  },
  '6.1': {
    codigo: '6.1',
    nombre: 'MAESTRO CARPINTERO DE 2da.',
    labores: 'Supervisar carpintería de segunda como maestro: organizar cuadrilla, controlar calidad de encofrados y materiales.',
    fuente: 'derivada' as const,
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
  '6.5': {
    codigo: '6.5',
    nombre: 'OPERADOR DE PALA MAS 1YARDA CUB. DE 2da.',
    labores: 'Operar pala de más de 1 yarda cúbica de segunda: excavaciones mayores y carga de material bajo supervisión.',
    fuente: 'derivada' as const,
  },
  '6.6': {
    codigo: '6.6',
    nombre: 'PROYECTADOR DE CONCRETO',
    labores: 'Proyectar concreto (shotcrete/gunite) sobre superficies; controlar mezcla, presión y acabado.',
    fuente: 'derivada' as const,
  },
  '6.7': {
    codigo: '6.7',
    nombre: 'CHOFER DE VOLTEO DE 30 O MAS TONELADAS',
    labores: 'Conducir camiones de volteo de 30 o más toneladas; cargar, transportar y descargar material de forma segura.',
    fuente: 'derivada' as const,
  },
  '7.1': {
    codigo: '7.1',
    nombre: 'MAESTRO ALBAÑIL',
    labores: 'Dirigir labores de albañilería como maestro: planificar, asignar, controlar calidad y avance de la cuadrilla.',
    fuente: 'derivada' as const,
  },
  '7.2': {
    codigo: '7.2',
    nombre: 'MAESTRO CARPINTERO DE 1ra.',
    labores: 'Dirigir carpintería de primera como maestro: encofrados, estructuras y control de calidad.',
    fuente: 'derivada' as const,
  },
  '7.3': {
    codigo: '7.3',
    nombre: 'MAESTRO CABILLERO',
    labores: 'Dirigir cabillería como maestro: interpretación de planos estructurales y control del armado de hierro.',
    fuente: 'derivada' as const,
  },
  '7.4': {
    codigo: '7.4',
    nombre: 'MAESTRO PLOMERO DE 1ra.',
    labores: 'Dirigir plomería de primera como maestro: redes, pruebas y coordinación con otras especialidades.',
    fuente: 'derivada' as const,
  },
  '7.5': {
    codigo: '7.5',
    nombre: 'MAESTRO ELECTRICISTA',
    labores: 'Dirigir instalaciones eléctricas como maestro electricista: planos, tableros, seguridad eléctrica y cuadrilla.',
    fuente: 'derivada' as const,
  },
  '7.6': {
    codigo: '7.6',
    nombre: 'MAESTRO GRANITERO',
    labores: 'Dirigir granitería como maestro: acabados, pulidos y control de calidad de superficies.',
    fuente: 'derivada' as const,
  },
  '7.7': {
    codigo: '7.7',
    nombre: 'MAESTRO PINTOR',
    labores: 'Dirigir pintura como maestro: programación de acabados, materiales y calidad de aplicación.',
    fuente: 'derivada' as const,
  },
  '7.8': {
    codigo: '7.8',
    nombre: 'MAESTRO IMPERMEABILIZADOR',
    labores: 'Dirigir impermeabilización como maestro: sistemas, detalles críticos y garantía de estanqueidad.',
    fuente: 'derivada' as const,
  },
  '7.9': {
    codigo: '7.9',
    nombre: 'MAESTRO DE OBRA DE 2da.',
    labores: 'Dirigir la obra como maestro de segunda: coordinar oficios, avance diario y seguridad en el frente de trabajo.',
    fuente: 'derivada' as const,
  },
  '7.10': {
    codigo: '7.10',
    nombre: 'CHOFER DE GANDOLA DE 1ra. (TODO TON.)',
    labores: 'Conducción de cualquier vehículo asignado sin restricción de carga.',
    fuente: 'gaceta' as const,
  },
  '7.11': {
    codigo: '7.11',
    nombre: 'DINAMITERO',
    labores: 'Preparar y ejecutar voladuras menores como dinamitero: carga, conexionado y disparo bajo normas de seguridad.',
    fuente: 'derivada' as const,
  },
  '7.12': {
    codigo: '7.12',
    nombre: 'CAPORAL DE EQUIPO',
    labores: 'Coordinar equipos y operadores como caporal de equipo: asignación, señales, productividad y seguridad.',
    fuente: 'derivada' as const,
  },
  '7.13': {
    codigo: '7.13',
    nombre: 'MAESTRO DE OBRAS ELECTROMECANICAS',
    labores: 'Supervisión de montaje de bombas, tableros y sistemas de control.',
    fuente: 'gaceta' as const,
  },
  '7.14': {
    codigo: '7.14',
    nombre: 'ALINEADOR DE GRUA (REGGE)',
    labores: 'Alinear y calibrar grúas (regge): nivelación, aplomado y verificación de condiciones de operación.',
    fuente: 'derivada' as const,
  },
  '7.15': {
    codigo: '7.15',
    nombre: 'MINERO',
    labores: 'Ejecutar labores de minería/excavación en túneles o frentes mineros: perforación, sostenimiento y seguridad.',
    fuente: 'derivada' as const,
  },
  '8.1': {
    codigo: '8.1',
    nombre: 'MAESTRO DE VOLADURAS',
    labores: 'Planificar y dirigir voladuras como maestro: diseños de carga, seguridad perimetral y coordinación del disparo.',
    fuente: 'derivada' as const,
  },
  '8.2': {
    codigo: '8.2',
    nombre: 'OPERADOR DE EQUIPO PESADO DE 1ra.',
    labores: 'Operar equipo pesado de primera: movimiento de tierra complejo, alta productividad y mantenimiento operativo.',
    fuente: 'derivada' as const,
  },
  '8.3': {
    codigo: '8.3',
    nombre: 'TRACTORISTA DE 1ra.',
    labores: 'Operar tractores de primera: movimientos de tierra exigentes, perfilado y trabajo en pendientes/condiciones difíciles.',
    fuente: 'derivada' as const,
  },
  '8.4': {
    codigo: '8.4',
    nombre: 'OPERADOR DE MOTOTRAILLA DE 1ra.',
    labores: 'Operar mototraílla de primera: corte y transporte de grandes volúmenes con control de pendientes y ciclos.',
    fuente: 'derivada' as const,
  },
  '8.5': {
    codigo: '8.5',
    nombre: 'OPERADOR DE PALA MAS 1YARDA CUB. DE 1ra.',
    labores: 'Operar pala de más de 1 yarda cúbica de primera: excavaciones mayores, precisión y alto rendimiento.',
    fuente: 'derivada' as const,
  },
  '8.6': {
    codigo: '8.6',
    nombre: 'OPERADOR DE MOTONIVELADORA DE 1ra.',
    labores: 'Operar motoniveladora de primera: nivelación fina de vías, taludes y plataformas según proyecto.',
    fuente: 'derivada' as const,
  },
  '8.7': {
    codigo: '8.7',
    nombre: 'OPERADOR DE GRÚA (GRUERO) DE 1ra.',
    labores: 'Operar grúa de primera: izados críticos, cargas complejas y coordinación con rigger en altura.',
    fuente: 'derivada' as const,
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
  '8.10': {
    codigo: '8.10',
    nombre: 'OPERADOR DE PLANTA',
    labores: 'Operar planta industrial/de proceso: control de procesos, parámetros de producción y seguridad de la instalación.',
    fuente: 'derivada' as const,
  },
  '8.11': {
    codigo: '8.11',
    nombre: 'OPERADOR DE ALIVA',
    labores: 'Operar equipo Aliva (proyección de concreto): control de mezcla, presión y aplicación en túneles u obra.',
    fuente: 'derivada' as const,
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

/** Labores del oficio por código del tabulador (ej. `5.1`). */
export function laboresOficioPorCodigo(codigo: string | null | undefined): LaboresOficioContrato | null {
  const c = String(codigo ?? '').trim();
  if (!c) return null;
  const hit = LABORES_POR_CODIGO[c];
  if (hit) return hit;
  // Preferir tareas de ficha gaceta si el mapa está desfasado
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
  if (cargo) {
    return {
      codigo: c,
      nombre: cargo.nombre,
      labores: `Ejecutar las labores propias del oficio ${cargo.nombre} conforme al tabulador de la Convención Colectiva de la Construcción y las instrucciones de la entidad de trabajo.`,
      fuente: 'generica',
    };
  }
  return null;
}

/** Resolver por nombre de cargo (p. ej. fila de `ci_config_nomina.cargo_nombre`). */
export function laboresOficioPorNombre(nombre: string | null | undefined): LaboresOficioContrato | null {
  const n = normNombre(nombre ?? '');
  if (!n) return null;
  const exact = _byNombre.get(n);
  if (exact) return exact;
  // coincidencia parcial
  for (const row of Object.values(LABORES_POR_CODIGO)) {
    const rn = normNombre(row.nombre);
    if (rn.includes(n) || n.includes(rn)) return row;
  }
  return null;
}

/**
 * Texto de labores para contrato: prioriza código tabulador, luego nombre,
 * luego `funciones_oficiales` / override explícito.
 */
export function laboresContratoDesdeCargo(opts: {
  cargoCodigo?: string | null;
  cargoNombre?: string | null;
  funcionesOficiales?: string | null;
  tareasEspecificas?: string | null;
}): string {
  const override =
    String(opts.funcionesOficiales ?? '').trim() || String(opts.tareasEspecificas ?? '').trim();
  // Si ya hay texto guardado en BD/planilla y no es solo el nombre del cargo, respetarlo
  const nom = String(opts.cargoNombre ?? '').trim();
  if (override && (!nom || normNombre(override) !== normNombre(nom))) {
    return override;
  }
  const byCod = laboresOficioPorCodigo(opts.cargoCodigo);
  if (byCod?.labores) return byCod.labores;
  const byNom = laboresOficioPorNombre(opts.cargoNombre);
  if (byNom?.labores) return byNom.labores;
  return (
    override ||
    'las tareas inherentes a su cargo y aquellas asignadas por su supervisor inmediato'
  );
}

/** Catálogo completo (102 oficios) — útil para auditoría / UI. */
export function listarLaboresOficiosContrato(): LaboresOficioContrato[] {
  return CARGOS_OBREROS.map((c) => LABORES_POR_CODIGO[c.codigo]!).filter(Boolean);
}
