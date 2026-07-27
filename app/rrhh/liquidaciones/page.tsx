import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import RrhhLiquidacionesClient from '@/components/rrhh/liquidaciones/RrhhLiquidacionesClient';

export const dynamic = 'force-dynamic';

export default async function RrhhLiquidacionesPage() {
  const supabase = await createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect('/login');
  }

  // Traer lista de empleados para seleccionar en la calculadora
  const { data: empleados } = await supabase
    .from('ci_empleados')
    .select('id, cedula, nombre_completo, cargo, created_at')
    .order('nombre_completo', { ascending: true });

  const empleadosFormateados = (empleados || []).map(emp => ({
    id: emp.id,
    cedula: emp.cedula || '',
    nombres: emp.nombre_completo || '',
    apellidos: '', // Unido en nombre_completo
    cargo: emp.cargo || 'No especificado',
    salario_base: 0, // Se ingresará manual para asegurar exactitud
    fecha_ingreso: emp.created_at || new Date().toISOString()
  }));

  return (
    <div className="flex flex-col gap-6">
      <RrhhLiquidacionesClient empleados={empleadosFormateados} />
    </div>
  );
}
