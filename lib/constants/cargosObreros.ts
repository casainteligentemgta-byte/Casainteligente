/**
 * Tabulador «Nivel / Oficio / Denominación» de la Convención Colectiva de la Construcción
 * (GOE N° 6.752 Extraordinario, 2023). Cláusula 3 y tabulador anexo.
 * Códigos normalizados con punto (ej. 1.1, 2.10, 5.26).
 */

export type TipoVacante = 'obrero_basico' | 'obrero_especializado';

export interface CargoObrero {
  nivel: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
  codigo: string;
  /** Denominación oficial del tabulador (mayúsculas, texto íntegro). */
  nombre: string;
}

/** Asignación automática según nivel salarial 1–4 vs 5–9. */
export function tipoVacantePorNivel(nivel: number): TipoVacante {
  if (nivel >= 1 && nivel <= 4) return 'obrero_basico';
  return 'obrero_especializado';
}

export const CARGOS_OBREROS: readonly CargoObrero[] = [
  // Nivel 1
  { nivel: 1, codigo: '1.1', nombre: 'OBRERO DE 1era.' },
  { nivel: 1, codigo: '1.2', nombre: 'VIGILANTE' },
  // Nivel 2
  { nivel: 2, codigo: '2.1', nombre: 'AYUDANTE' },
  { nivel: 2, codigo: '2.2', nombre: 'AUXILIAR DE DEPOSITO' },
  { nivel: 2, codigo: '2.3', nombre: 'CHOFER DE 4ta.' },
  { nivel: 2, codigo: '2.4', nombre: 'OPERADOR DE MARTILLO PERFORADOR' },
  { nivel: 2, codigo: '2.5', nombre: 'AYUDANTE DE OPERADORES' },
  { nivel: 2, codigo: '2.6', nombre: 'AYUDANTE DE MECANICO DIESEL' },
  { nivel: 2, codigo: '2.7', nombre: 'AYUDANTE DE TOPOGRAFO' },
  { nivel: 2, codigo: '2.8', nombre: 'RASTRILLERO' },
  { nivel: 2, codigo: '2.9', nombre: 'ESPESORISTA' },
  { nivel: 2, codigo: '2.10', nombre: 'PALERO ASFALTICO' },
  // Nivel 3
  { nivel: 3, codigo: '3.1', nombre: 'CAPORAL' },
  { nivel: 3, codigo: '3.2', nombre: 'ALBAÑIL DE 2da.' },
  { nivel: 3, codigo: '3.3', nombre: 'CARPINTERO DE 2da.' },
  { nivel: 3, codigo: '3.4', nombre: 'CABILLERO DE 2da.' },
  { nivel: 3, codigo: '3.5', nombre: 'PLOMERO DE 2da.' },
  { nivel: 3, codigo: '3.6', nombre: 'ELECTRICISTA DE 2da.' },
  { nivel: 3, codigo: '3.7', nombre: 'GRANITERO DE 2da.' },
  { nivel: 3, codigo: '3.8', nombre: 'PINTOR DE 2da.' },
  { nivel: 3, codigo: '3.9', nombre: 'IMPERMEABILIZADOR DE 2da.' },
  { nivel: 3, codigo: '3.10', nombre: 'GINCHERO' },
  { nivel: 3, codigo: '3.11', nombre: 'MAQUINISTA DE CONCRETO DE 2da.' },
  { nivel: 3, codigo: '3.12', nombre: 'OPERADOR DE PLANTA FIJA DE 2da.' },
  { nivel: 3, codigo: '3.13', nombre: 'CHOFER DE 3ra. (HASTA 3 TONS)' },
  { nivel: 3, codigo: '3.14', nombre: 'OPERADOR DE EQUIPO PERFORADOR' },
  { nivel: 3, codigo: '3.15', nombre: 'OPERADOR DE EQUIPO LIVIANO' },
  { nivel: 3, codigo: '3.16', nombre: 'ENGRASADOR' },
  { nivel: 3, codigo: '3.17', nombre: 'CAUCHERO' },
  { nivel: 3, codigo: '3.18', nombre: 'MECÁNICO DE GASOLINA DE 2da.' },
  { nivel: 3, codigo: '3.19', nombre: 'SOLDADOR DE 3ra.' },
  { nivel: 3, codigo: '3.20', nombre: 'LATONERO DE 2da.' },
  { nivel: 3, codigo: '3.21', nombre: 'INSTALADOR ELECTRICOMECANICO DE 2da.' },
  { nivel: 3, codigo: '3.22', nombre: 'OPERADOR EQUIPO DE SANDBLASTING' },
  // Nivel 4
  { nivel: 4, codigo: '4.1', nombre: 'MAQUINISTA DE CONCRETO DE 1ra.' },
  { nivel: 4, codigo: '4.2', nombre: 'OPERADOR DE PLANTA FIJA DE 1ra.' },
  { nivel: 4, codigo: '4.3', nombre: 'CHOFER DE 2ra. (DE 3 A 8 TONS)' },
  { nivel: 4, codigo: '4.4', nombre: 'OPERADOR DE PALA HASTA 1YARDA CUB.' },
  { nivel: 4, codigo: '4.5', nombre: 'MECANICO DE GASOLINA DE 1ra.' },
  { nivel: 4, codigo: '4.6', nombre: 'SOLDADOR DE 2da.' },
  { nivel: 4, codigo: '4.7', nombre: 'OPERADOR DE PAVIMENTADORA' },
  // Nivel 5
  { nivel: 5, codigo: '5.1', nombre: 'ALBAÑIL DE 1ra.' },
  { nivel: 5, codigo: '5.2', nombre: 'CARPINTERO DE 1ra.' },
  { nivel: 5, codigo: '5.3', nombre: 'CABILLERO DE 1ra.' },
  { nivel: 5, codigo: '5.4', nombre: 'PLOMERO DE 1ra.' },
  { nivel: 5, codigo: '5.5', nombre: 'ELECTRICISTA DE 1ra.' },
  { nivel: 5, codigo: '5.6', nombre: 'GRANITERO DE 1ra.' },
  { nivel: 5, codigo: '5.7', nombre: 'PINTOR DE 1ra.' },
  { nivel: 5, codigo: '5.8', nombre: 'IMPERMEABILIZADOR DE 1ra.' },
  { nivel: 5, codigo: '5.9', nombre: 'CHOFER DE 1ra. (DE 8 A 15 TONS)' },
  { nivel: 5, codigo: '5.10', nombre: 'OPERADOR DE EQUIPO PESADO DE 2da.' },
  { nivel: 5, codigo: '5.11', nombre: 'TRACTORISTA DE 2da.' },
  { nivel: 5, codigo: '5.12', nombre: 'OPERADOR DE MOTOTRAILLA DE 2da.' },
  { nivel: 5, codigo: '5.13', nombre: 'OPERADOR DE MOTONIVELADORA DE 2da.' },
  { nivel: 5, codigo: '5.14', nombre: 'OPERADOR DE GRUA (GRUERO) DE 2da.' },
  { nivel: 5, codigo: '5.15', nombre: 'MECANICO EQUIPO PESADO DE 2da.' },
  { nivel: 5, codigo: '5.16', nombre: 'OPERADOR MAQUINAS-HERRAMIENTAS 2da.' },
  { nivel: 5, codigo: '5.17', nombre: 'SOLDADOR DE 1ra.' },
  { nivel: 5, codigo: '5.18', nombre: 'TUBERO FABRICADOR' },
  { nivel: 5, codigo: '5.19', nombre: 'MONTADOR' },
  { nivel: 5, codigo: '5.20', nombre: 'LATONERO DE 1ra.' },
  { nivel: 5, codigo: '5.21', nombre: 'INSTALADOR ELECTRICOMECANICO DE 1ra.' },
  { nivel: 5, codigo: '5.22', nombre: 'LINIERO DE 1ra.' },
  { nivel: 5, codigo: '5.23', nombre: 'ALBAÑIL REFRACTARIO' },
  { nivel: 5, codigo: '5.24', nombre: 'DEPOSITARIO' },
  { nivel: 5, codigo: '5.25', nombre: 'DUCTERO' },
  { nivel: 5, codigo: '5.26', nombre: 'ARMADOR METALICO' },
  // Nivel 6
  { nivel: 6, codigo: '6.1', nombre: 'MAESTRO CARPINTERO DE 2da.' },
  { nivel: 6, codigo: '6.2', nombre: 'CHOFER DE CAMIÓN MAS DE 15 TONS.' },
  { nivel: 6, codigo: '6.3', nombre: 'CHOFER DE GANDOLA DE 2da. (DE 15-40T)' },
  { nivel: 6, codigo: '6.4', nombre: 'CHOFER DE CAMIÓN MEZCLADOR' },
  { nivel: 6, codigo: '6.5', nombre: 'OPERADOR DE PALA MAS 1YARDA CUB. DE 2da.' },
  { nivel: 6, codigo: '6.6', nombre: 'PROYECTADOR DE CONCRETO' },
  { nivel: 6, codigo: '6.7', nombre: 'CHOFER DE VOLTEO DE 30 O MAS TONELADAS' },
  // Nivel 7
  { nivel: 7, codigo: '7.1', nombre: 'MAESTRO ALBAÑIL' },
  { nivel: 7, codigo: '7.2', nombre: 'MAESTRO CARPINTERO DE 1ra.' },
  { nivel: 7, codigo: '7.3', nombre: 'MAESTRO CABILLERO' },
  { nivel: 7, codigo: '7.4', nombre: 'MAESTRO PLOMERO DE 1ra.' },
  { nivel: 7, codigo: '7.5', nombre: 'MAESTRO ELECTRICISTA' },
  { nivel: 7, codigo: '7.6', nombre: 'MAESTRO GRANITERO' },
  { nivel: 7, codigo: '7.7', nombre: 'MAESTRO PINTOR' },
  { nivel: 7, codigo: '7.8', nombre: 'MAESTRO IMPERMEABILIZADOR' },
  { nivel: 7, codigo: '7.9', nombre: 'MAESTRO DE OBRA DE 2da.' },
  { nivel: 7, codigo: '7.10', nombre: 'CHOFER DE GANDOLA DE 1ra. (TODO TON.)' },
  { nivel: 7, codigo: '7.11', nombre: 'DINAMITERO' },
  { nivel: 7, codigo: '7.12', nombre: 'CAPORAL DE EQUIPO' },
  { nivel: 7, codigo: '7.13', nombre: 'MAESTRO DE OBRAS ELECTROMECANICAS' },
  { nivel: 7, codigo: '7.14', nombre: 'ALINEADOR DE GRUA (REGGE)' },
  { nivel: 7, codigo: '7.15', nombre: 'MINERO' },
  // Nivel 8
  { nivel: 8, codigo: '8.1', nombre: 'MAESTRO DE VOLADURAS' },
  { nivel: 8, codigo: '8.2', nombre: 'OPERADOR DE EQUIPO PESADO DE 1ra.' },
  { nivel: 8, codigo: '8.3', nombre: 'TRACTORISTA DE 1ra.' },
  { nivel: 8, codigo: '8.4', nombre: 'OPERADOR DE MOTOTRAILLA DE 1ra.' },
  { nivel: 8, codigo: '8.5', nombre: 'OPERADOR DE PALA MAS 1YARDA CUB. DE 1ra.' },
  { nivel: 8, codigo: '8.6', nombre: 'OPERADOR DE MOTONIVELADORA DE 1ra.' },
  { nivel: 8, codigo: '8.7', nombre: 'OPERADOR DE GRÚA (GRUERO) DE 1ra.' },
  { nivel: 8, codigo: '8.8', nombre: 'MECÁNICO EQUIPO PESADO DE 1ra.' },
  { nivel: 8, codigo: '8.9', nombre: 'OPERADOR MÁQUINAS-HERRAMIENTAS 1ra.' },
  { nivel: 8, codigo: '8.10', nombre: 'OPERADOR DE PLANTA' },
  { nivel: 8, codigo: '8.11', nombre: 'OPERADOR DE ALIVA' },
  // Nivel 9
  { nivel: 9, codigo: '9.1', nombre: 'MAESTRO DE OBRA DE 1ra.' },
  { nivel: 9, codigo: '9.2', nombre: 'MAESTRO MECÁNICO' },
] as const;

const _byCodigo = new Map(CARGOS_OBREROS.map((c) => [c.codigo, c]));

export function cargoPorCodigo(codigo: string): CargoObrero | undefined {
  return _byCodigo.get(codigo);
}

/** Agrupa cargos por nivel (p. ej. para <optgroup>). */
export function cargosAgrupadosPorNivel(
  cargos: readonly CargoObrero[],
): Map<number, CargoObrero[]> {
  const m = new Map<number, CargoObrero[]>();
  for (const c of cargos) {
    const arr = m.get(c.nivel) ?? [];
    arr.push(c);
    m.set(c.nivel, arr);
  }
  return m;
}
