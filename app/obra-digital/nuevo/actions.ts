'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function crearContratoExpedienteObraDigital(formData: FormData) {
  const worker_name = String(formData.get('worker_name') ?? '').trim();
  const worker_ci = String(formData.get('worker_ci') ?? '').trim();
  const oficio = String(formData.get('oficio') ?? '').trim();
  const salary_per_day = String(formData.get('salary_per_day') ?? '').replace(',', '.').trim();
  const lulo_partida_meta = String(formData.get('lulo_partida_meta') ?? '').trim();

  if (!worker_name || !worker_ci || !oficio || !salary_per_day || !lulo_partida_meta) {
    throw new Error('Completa todos los campos obligatorios.');
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('obra_digital_labor_contracts')
    .insert({
      worker_name,
      worker_ci,
      oficio,
      salary_per_day,
      lulo_partida_meta,
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const id = (data as { id: string }).id;
  redirect(`/obra-digital/expediente/${id}`);
}
