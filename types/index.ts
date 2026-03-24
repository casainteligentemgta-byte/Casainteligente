export interface Budget {
    id: string
    sale_price: number
    cost_price: number
}

export type ProjectStatus = 'Pendiente' | 'En Progreso' | 'Pruebas' | 'Completado'

export interface Project {
    id: string
    name: string
    status: ProjectStatus
    budget_id?: string
    budget?: Budget
    description?: string
    installation_address?: string
}

export type { Customer, CustomerTipo, CustomerStatus, CustomerListItem, CustomerCategoriaUi } from './customer'
export type { Employee, EmployeeEstatus, EmployeeStudy, EmployeeExperience, EmployeeCourse, EmployeeReference, EmployeeAffiliation } from './employee'
export type { Product } from './product'
export type { Evaluacion, EvaluacionStatus, Semaforo, DominantDisc } from './evaluacion'
