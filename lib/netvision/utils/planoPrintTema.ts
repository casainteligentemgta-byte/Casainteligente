/** Tema visual de la hoja de «Imprimir / PDF» del plano. */

export const PLANO_PRINT_TEMAS = ['tactico', 'arcade', 'tiempo-real'] as const

export type PlanoPrintTema = (typeof PLANO_PRINT_TEMAS)[number]

export const PLANO_PRINT_TEMA_DEFAULT: PlanoPrintTema = 'tactico'

export const PLANO_PRINT_TEMA_LABEL: Record<PlanoPrintTema, string> = {
  tactico: 'Táctico',
  arcade: 'Arcade',
  'tiempo-real': 'Tiempo real',
}

/** Color de la página al imprimir: el mismo con que termina la hoja, para que no haya corte. */
export const PLANO_PRINT_TEMA_PAGE_BG: Record<PlanoPrintTema, string> = {
  tactico: '#07110d',
  arcade: '#7a2bd3',
  'tiempo-real': '#050505',
}

export const PLANO_PRINT_TEMA_STORAGE_KEY = 'nexus.netvision.planoPrint.tema'

export function parsePlanoPrintTema(value: string | null | undefined): PlanoPrintTema | null {
  const v = value?.trim().toLowerCase()
  return (PLANO_PRINT_TEMAS as readonly string[]).includes(v ?? '')
    ? (v as PlanoPrintTema)
    : null
}

/** Tema a usar: `?tema=` del enlace, luego el último elegido, luego táctico. */
export function loadPlanoPrintTema(queryValue?: string | null): PlanoPrintTema {
  const fromQuery = parsePlanoPrintTema(queryValue)
  if (fromQuery) return fromQuery
  if (typeof localStorage === 'undefined') return PLANO_PRINT_TEMA_DEFAULT
  try {
    return (
      parsePlanoPrintTema(localStorage.getItem(PLANO_PRINT_TEMA_STORAGE_KEY)) ??
      PLANO_PRINT_TEMA_DEFAULT
    )
  } catch {
    return PLANO_PRINT_TEMA_DEFAULT
  }
}

export function savePlanoPrintTema(tema: PlanoPrintTema): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(PLANO_PRINT_TEMA_STORAGE_KEY, tema)
  } catch {
    /* quota / modo privado */
  }
}

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

/** «04 de octubre de 2026» → «04.10.2026». `null` si la fecha no tiene ese formato. */
export function rotuloFechaDigitos(dateLabel: string | null | undefined): string | null {
  const m = /^\s*(\d{1,2})\s+de\s+([a-záéíóúñ]+)\s+de\s+(\d{4})\s*$/i.exec(dateLabel ?? '')
  if (!m) return null
  const nombre = m[2]!.toLowerCase()
  const mes = MESES.indexOf(nombre === 'setiembre' ? 'septiembre' : nombre)
  if (mes < 0) return null
  return `${m[1]!.padStart(2, '0')}.${String(mes + 1).padStart(2, '0')}.${m[3]}`
}

/** Contador de lectura digital: 0 → «00», 13 → «13», sin dato → «--». */
export function contadorDosDigitos(n: number | null | undefined): string {
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) return '--'
  return String(Math.round(n)).padStart(2, '0')
}
