import { createClient } from '@/lib/supabase/client';
import {
    InventoryItem,
    InventoryMovement,
    MovementType,
    PurchaseInvoice,
    PurchaseDetail,
    QualityInspection
} from '@/types/inventory';

export class InventoryService {
    private static supabase = createClient();

    /**
     * Register a new inventory movement and update stock/cost
     */
    static async registerMovement(params: {
        material_id: string;
        type: MovementType;
        quantity: number;
        reference_id?: string;
        unit_price?: number; // Needed for 101 (Entry)
        user_id?: string | null;
    }) {
        const { material_id, type, quantity, reference_id, unit_price, user_id } = params;

        // 1. Get current item state
        const { data: item, error: itemError } = await this.supabase
            .from('global_inventory')
            .select('*')
            .eq('id', material_id)
            .single();

        if (itemError || !item) throw new Error('Material not found');

        const prevCost = Number(item.average_weighted_cost);
        let newCost = prevCost;

        // Stock físico: inventario_stock + RPC; aquí solo costo en maestro SKU
        if (type === '101' && unit_price !== undefined && quantity > 0) {
            newCost = unit_price;
        }

        const { error: updateError } = await this.supabase
            .from('global_inventory')
            .update({
                average_weighted_cost: newCost,
                updated_at: new Date().toISOString()
            })
            .eq('id', material_id);

        if (updateError) throw updateError;

        // 4. Record Movement in Kardex
        const movement: Omit<InventoryMovement, 'id' | 'created_at'> = {
            material_id,
            movement_type_code: type,
            quantity,
            previous_stock: 0,
            new_stock: 0,
            previous_cost: prevCost,
            new_cost: newCost,
            reference_id: reference_id || null,
            user_id: user_id ?? null,
        };

        const { error: movementError } = await this.supabase
            .from('inventory_movements')
            .insert(movement);

        if (movementError) throw movementError;

        return { newStock: 0, newCost };
    }

    /**
     * Process a Quality Inspection approval
     */
    static async approveQuality(inspection_id: string, user_id?: string | null) {
        const { approveQualityInspection } = await import(
            '@/lib/almacen/approveQualityInspection'
        );
        return approveQualityInspection(this.supabase, inspection_id, user_id);
    }
}
