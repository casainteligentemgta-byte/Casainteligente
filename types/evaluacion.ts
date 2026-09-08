export type EvaluacionStatus = 'pending' | 'started' | 'completed' | 'expired'
export type Semaforo = 'verde' | 'amarillo' | 'rojo'
export type DominantDisc = 'D' | 'I' | 'S' | 'C'

export interface Evaluacion {
    id: string
    employee_id: string
    employee_name: string
    token: string
    link_expires_at: string
    status: EvaluacionStatus | string
    started_at?: string | null
    test_deadline?: string | null
    completed_at?: string | null
    tab_changes: number
    disqualified?: boolean
    disqualification_reason?: string | null
    answers?: number[]
    created_at?: string
    disc_d: number
    disc_i: number
    disc_s: number
    disc_c: number
    dark_psy: number
    dark_nar: number
    dark_irr: number
    dominant_disc: DominantDisc
    color_perfil: string
    risk_score: number
    semaforo: Semaforo
    integrity_score: number
    gma_score: number
    logic_tag: string | null
}
