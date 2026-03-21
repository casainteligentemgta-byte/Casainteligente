'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

/**
 * Crea una venta sencilla con una sola línea (producto + cantidad).
 */
export async function crearVenta(formData: FormData) {
  const supabase = createClient(cookies());

  const clienteRef = (formData.get('cliente_ref') as string) ?? '';
  const productoId = formData.get('producto_id') as string;
  const cantidadRaw = (formData.get('cantidad') as string) ?? '1';
  const precioUnitarioRaw = (formData.get('precio_unitario') as string) ?? '0';

  const cantidad = cantidadRaw.replace(',', '.');
  const precioUnitario = precioUnitarioRaw.replace(',', '.');

  const subtotal = String(
    Number.parseFloat(cantidad || '0') * Number.parseFloat(precioUnitario || '0'),
  );

  let empresaId: string | null = null;
  let personaId: string | null = null;
  const parts = clienteRef.split(':');
  if (parts.length === 2 && parts[0] === 'empresa') {
    empresaId = parts[1];
  } else if (parts.length === 2 && parts[0] === 'persona') {
    personaId = parts[1];
  } else {
    throw new Error('Selecciona un cliente (empresa o persona).');
  }

  const { data: ventaData, error: ventaError } = await supabase
    .from('ventas')
    .insert({
      empresa_id: empresaId,
      persona_id: personaId,
      importe_total: subtotal,
      estado: 'pendiente',
      notas: (formData.get('notas') as string) || null,
    })
    .select('id')
    .single();

  if (ventaError) {
    throw ventaError;
  }

  const ventaId = ventaData.id as string;

  const { error: itemError } = await supabase.from('venta_items').insert({
    venta_id: ventaId,
    producto_id: productoId,
    cantidad,
    precio_unitario: precioUnitario,
    subtotal,
  });

  if (itemError) {
    throw itemError;
  }

  revalidatePath('/ventas');
}

