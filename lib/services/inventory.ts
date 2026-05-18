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

        const prevStock = Number(item.stock_available);
        const prevCost = Number(item.average_weighted_cost);
        let newStock = prevStock;
        let newCost = prevCost;

        // 2. Calculate new stock and cost based on movement type
        switch (type) {
            case '101': // Entry by Purchase
                newStock = prevStock + quantity;
                if (unit_price !== undefined) {
                    // Average Weighted Cost Formula: (Stock Anterior * Costo Anterior + Stock Nuevo * Precio Nuevo) / (Stock Total)
                    newCost = (prevStock * prevCost + quantity * unit_price) / newStock;
                }
                break;
            case '201': // Consumption
                newStock = prevStock - quantity;
                break;
            case '311': // Transfer (In this simple model, we just record the movement, maybe stock doesn't change if it's within same logical inventory)
                // Usually 311 involves two movements (one out, one in). For now let's assume it's just a record.
                break;
            case '501': // Audit Entry
                newStock = prevStock + quantity;
                break;
            case '601': // Return
                newStock = prevStock + quantity;
                break;
        }

        // 3. Update Global Inventory
        const { error: updateError } = await this.supabase
            .from('global_inventory')
            .update({
                stock_available: newStock,
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
            previous_stock: prevStock,
            new_stock: newStock,
            previous_cost: prevCost,
            new_cost: newCost,
            reference_id: reference_id || null,
            user_id: user_id ?? null,
        };

        const { error: movementError } = await this.supabase
            .from('inventory_movements')
            .insert(movement);

        if (movementError) throw movementError;

        return { newStock, newCost };
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
