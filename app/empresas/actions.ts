'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function crearEmpresa(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from('empresas').insert({
    nombre: formData.get('nombre') as string,
    cif: (formData.get('cif') as string) || null,
    direccion: (formData.get('direccion') as string) || null,
    ciudad: (formData.get('ciudad') as string) || null,
    codigo_postal: (formData.get('codigo_postal') as string) || null,
    telefono: (formData.get('telefono') as string) || null,
    email: (formData.get('email') as string) || null,
  });
  if (error) throw error;
  revalidatePath('/empresas');
}
