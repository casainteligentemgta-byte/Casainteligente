'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function crearPersona(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from('personas').insert({
    nombre: formData.get('nombre') as string,
    apellidos: (formData.get('apellidos') as string) || null,
    documento: (formData.get('documento') as string) || null,
    direccion: (formData.get('direccion') as string) || null,
    ciudad: (formData.get('ciudad') as string) || null,
    codigo_postal: (formData.get('codigo_postal') as string) || null,
    telefono: (formData.get('telefono') as string) || null,
    email: (formData.get('email') as string) || null,
  });
  if (error) throw error;
  revalidatePath('/personas');
}
