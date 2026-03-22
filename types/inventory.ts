/** Código de unidad almacenado en global_inventory.unit (catálogo inventory_units). */
export type UnitType = string;

export interface MaterialCategory {
    id: string;
    name: string;
    parent_id: string | null;
    level: number;
    created_at?: string;
}

export interface InventoryItem {
    id: string;
    sap_code: string | null;
    name: string;
    category_id: string;
    unit: UnitType;
    stock_available: number;
    stock_quarantine: number;
    reorder_point: number;
    average_weighted_cost: number;
    location: string | null;
    deposit_id?: string | null;
    furniture_id?: string | null;
    shelf_number?: number | null;
    image_url: string | null;
    last_purchase_date: string | null;
    last_purchase_price: number | null;
    last_supplier_id: string | null;
    // Specialized fields for tools/assets
    brand?: string;
    model?: string;
    serial_number?: string;
    observations?: string;
    status?: 'OPERATIVO' | 'EN REPARACION' | 'BAJA';
    created_at?: string;
    updated_at?: string;
}

export type MovementType = '101' | '201' | '311' | '501' | '601';

export interface InventoryMovement {
    id: string;
    material_id: string;
    movement_type_code: MovementType;
    quantity: number;
    previous_stock: number;
    new_stock: number;
    previous_cost: number;
    new_cost: number;
    reference_id: string | null;
    user_id: string;
    created_at?: string;
}

export interface PurchaseInvoice {
    id: string;
    invoice_number: string;
    supplier_rif: string;
    supplier_name: string;
    date: string;
    total_amount: number;
    status: 'PENDIENTE' | 'COMPLETADO' | 'CANCELADO';
    created_at?: string;
}

export interface PurchaseDetail {
    id: string;
    invoice_id: string;
    material_id: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    created_at?: string;
}

export interface QualityInspection {
    id: string;
    invoice_id: string;
    material_id: string;
    quantity: number;
    status: 'PENDIENTE' | 'APROBADO' | 'RECHAZADO';
    inspector_id: string | null;
    remarks: string | null;
    purchase_detail_id: string;
    created_at?: string;
    inspected_at?: string;
}
