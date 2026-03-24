export type CustomerTipo = 'Personal' | 'Empresa'
export type CustomerStatus = 'activo' | 'pendiente' | 'inactivo'

export interface Customer {
    id: string
    tipo: CustomerTipo
    rif: string
    nombre: string
    razon_social: string | null
    email: string
    movil: string
    direccion: string
    latitude: number | null
    longitude: number | null
    imagen: string | null
    color: string
    status: CustomerStatus | null
    fecha_nacimiento?: string | null
    estado_civil?: string | null
    nombre_comercial?: string | null
    created_at?: string
    updated_at?: string
}

export type CustomerCategoriaUi = 'personal' | 'empresa'

export interface CustomerListItem extends Customer {
    initials: string
    categoria: CustomerCategoriaUi
    telefono: string
}
