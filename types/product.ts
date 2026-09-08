export interface Product {
    id: number
    external_id?: number | null
    nombre: string
    categoria: string | null
    marca: string | null
    modelo: string | null
    descripcion: string | null
    costo: number | null
    precio: number | null
    utilidad: number | null
    cantidad: number | null
    image_url: string | null
    ubicacion?: string | null
    created_at?: string
    updated_at?: string
}
