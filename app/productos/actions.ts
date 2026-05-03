'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function crearProducto(formData: FormData) {
  const supabase = await createClient();

  const precioRaw = (formData.get('precio') as string) ?? '';
  const precio = precioRaw.replace(',', '.');

  const { error } = await supabase.from('productos').insert({
    nombre: formData.get('nombre') as string,
    descripcion: (formData.get('descripcion') as string) || null,
    precio,
    activo: true,
  });

  if (error) {
    throw error;
  }

  revalidatePath('/productos');
}

