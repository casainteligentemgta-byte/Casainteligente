'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calculator, Save, FileText, User } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

interface Empleado {
  id: string;
  cedula: string;
  nombres: string;
  apellidos: string;
  cargo: string;
  salario_base: number;
  fecha_ingreso: string;
}

export default function RrhhLiquidacionesClient({ empleados }: { empleados: Empleado[] }) {
  const supabase = createClient();
  const [empleadoId, setEmpleadoId] = useState<string>('');
  const [fechaEgreso, setFechaEgreso] = useState<string>(new Date().toISOString().split('T')[0]);
  const [motivo, setMotivo] = useState<string>('renuncia');
  const [salarioManual, setSalarioManual] = useState<number>(0);
  const [diasUtilidades, setDiasUtilidades] = useState<number>(30); // Mínimo LOTTT
  const [diasBonoVacacional, setDiasBonoVacacional] = useState<number>(15); // Mínimo LOTTT
  
  const [guardando, setGuardando] = useState(false);

  const empleadoSeleccionado = useMemo(() => {
    return empleados.find(e => e.id === empleadoId) || null;
  }, [empleadoId, empleados]);

  // Actualizar salario manual si cambia empleado
  useMemo(() => {
    if (empleadoSeleccionado) {
      setSalarioManual(empleadoSeleccionado.salario_base || 0);
    }
  }, [empleadoSeleccionado]);

  // --- MOTOR DE CÁLCULO LOTTT ---
  const calculo = useMemo(() => {
    if (!empleadoSeleccionado || !fechaEgreso) return null;

    const fechaIngreso = new Date(empleadoSeleccionado.fecha_ingreso);
    const fechaSalida = new Date(fechaEgreso);
    
    if (fechaSalida < fechaIngreso) return null;

    const msDiff = fechaSalida.getTime() - fechaIngreso.getTime();
    const daysDiff = Math.floor(msDiff / (1000 * 60 * 60 * 24));
    
    const anosCompletos = Math.floor(daysDiff / 365);
    const mesesCompletos = Math.floor(daysDiff / 30);
    const mesesRestantes = mesesCompletos % 12;
    
    // Meses en el año actual (para utilidades, que son por año calendario civil en Vzla)
    const inicioAnoActual = new Date(fechaSalida.getFullYear(), 0, 1);
    let msAnoActual = fechaSalida.getTime() - Math.max(fechaIngreso.getTime(), inicioAnoActual.getTime());
    const mesesAnoActual = Math.floor(msAnoActual / (1000 * 60 * 60 * 24 * 30));

    // 1. Salario Diario Integral (SDI)
    const sdn = salarioManual / 30;
    const alicuotaUtilidades = (diasUtilidades / 360) * sdn;
    // Días de bono vacacional aumentan 1 día por año según LOTTT (Art 192)
    const diasBvActual = diasBonoVacacional + anosCompletos;
    const alicuotaBv = (diasBvActual / 360) * sdn;
    const sdi = sdn + alicuotaUtilidades + alicuotaBv;

    // 2. Garantía de Prestaciones (Art 142 A y B)
    // 15 días por cada trimestre
    const trimestres = Math.floor(mesesCompletos / 3);
    const diasGarantiaTrimestral = trimestres * 15;
    
    // 2 días adicionales por año a partir del 2do año
    let diasAdicionales = 0;
    if (anosCompletos >= 2) {
        // Se calculan 2 días por cada año a partir del segundo, acumulativo
        // Ej: año 2 = 2 días, año 3 = 4 días... max 30 días acumulados
        for (let i = 2; i <= anosCompletos; i++) {
            diasAdicionales += 2;
        }
        if (diasAdicionales > 30) diasAdicionales = 30; // Tope máximo ley 30 días acumulados totales o anuales según interpretación, usaremos tope de 30 acumulados.
    }
    const montoGarantia = (diasGarantiaTrimestral + diasAdicionales) * sdi;

    // 3. Cálculo Retroactivo (Art 142 C)
    // 30 días por año o fracción mayor a 6 meses
    let anosRetroactivos = anosCompletos;
    if (mesesRestantes > 6) anosRetroactivos += 1;
    const montoRetroactivo = anosRetroactivos * 30 * sdi;

    // Mayor entre garantía y retroactivo
    const montoPrestaciones = Math.max(montoGarantia, montoRetroactivo);

    // 4. Fracciones
    // Vacaciones fraccionadas (Art 196) - Días por ley = 15 + 1 por año
    const diasVacacionesActuales = 15 + anosCompletos;
    const montoVacacionesFrac = ((mesesRestantes * diasVacacionesActuales) / 12) * sdn;
    
    // Bono Vacacional fraccionado (Art 192)
    const montoBvFrac = ((mesesRestantes * diasBvActual) / 12) * sdn;

    // Utilidades fraccionadas (Art 131)
    const montoUtilidadesFrac = ((mesesAnoActual * diasUtilidades) / 12) * sdn;

    // 5. Indemnización por despido injustificado (Art 92) - Doblete
    let montoIndemnizacion = 0;
    if (motivo === 'despido_injustificado') {
      montoIndemnizacion = montoPrestaciones; // Monto igual al de las prestaciones
    }

    const montoTotal = montoPrestaciones + montoVacacionesFrac + montoBvFrac + montoUtilidadesFrac + montoIndemnizacion;

    return {
      anosCompletos,
      mesesCompletos,
      mesesRestantes,
      sdn,
      sdi,
      montoGarantia,
      montoRetroactivo,
      montoPrestaciones,
      montoVacacionesFrac,
      montoBvFrac,
      montoUtilidadesFrac,
      montoIndemnizacion,
      montoTotal
    };
  }, [empleadoSeleccionado, fechaEgreso, motivo, salarioManual, diasUtilidades, diasBonoVacacional]);

  const guardarLiquidacion = async () => {
    if (!empleadoSeleccionado || !calculo) return;

    try {
      setGuardando(true);

      const payload = {
        empleado_id: empleadoId,
        fecha_ingreso: empleadoSeleccionado.fecha_ingreso,
        fecha_egreso: fechaEgreso,
        motivo,
        salario_base_mensual: salarioManual,
        dias_utilidades: diasUtilidades,
        dias_bono_vacacional: diasBonoVacacional,
        tiempo_servicio_meses: calculo.mesesCompletos,
        salario_diario_normal: calculo.sdn,
        salario_diario_integral: calculo.sdi,
        monto_garantia_prestaciones: calculo.montoGarantia,
        monto_prestaciones_retroactivas: calculo.montoRetroactivo,
        monto_prestaciones_pagar: calculo.montoPrestaciones,
        monto_vacaciones_fraccionadas: calculo.montoVacacionesFrac,
        monto_bono_vacacional_fraccionado: calculo.montoBvFrac,
        monto_utilidades_fraccionadas: calculo.montoUtilidadesFrac,
        monto_indemnizacion_despido: calculo.montoIndemnizacion,
        monto_total: calculo.montoTotal,
        estado: 'borrador'
      };

      const { error } = await supabase.from('ci_nomina_liquidaciones').insert([payload]);

      if (error) throw error;

      toast.success('Cálculo de liquidación guardado exitosamente.');
      
    } catch (error: any) {
      toast.error('Error al guardar: ' + error.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Liquidaciones y Finiquitos</h1>
          <p className="text-muted-foreground mt-1">Calculadora LOTTT de prestaciones sociales y fracciones.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* PARÁMETROS */}
        <Card className="lg:col-span-1 border-blue-100 shadow-sm">
          <CardHeader className="bg-blue-50/50 pb-4">
            <CardTitle className="text-lg flex items-center gap-2 text-blue-800">
              <Calculator className="h-5 w-5" />
              Parámetros de Cálculo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            
            <div className="space-y-2">
              <Label>Trabajador</Label>
              <Select value={empleadoId} onValueChange={setEmpleadoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione un empleado..." />
                </SelectTrigger>
                <SelectContent>
                  {empleados.map(emp => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.nombres} {emp.apellidos} - {emp.cedula}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {empleadoSeleccionado && (
              <div className="text-xs text-muted-foreground bg-gray-50 p-2 rounded border">
                <strong>Ingreso:</strong> {new Date(empleadoSeleccionado.fecha_ingreso).toLocaleDateString()}<br/>
                <strong>Cargo:</strong> {empleadoSeleccionado.cargo}
              </div>
            )}

            <div className="space-y-2">
              <Label>Fecha de Egreso</Label>
              <Input 
                type="date" 
                value={fechaEgreso} 
                onChange={(e) => setFechaEgreso(e.target.value)} 
              />
            </div>

            <div className="space-y-2">
              <Label>Motivo del Egreso</Label>
              <Select value={motivo} onValueChange={setMotivo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="renuncia">Renuncia Voluntaria</SelectItem>
                  <SelectItem value="despido_justificado">Despido Justificado</SelectItem>
                  <SelectItem value="despido_injustificado">Despido Injustificado (Doble)</SelectItem>
                  <SelectItem value="mutuo_acuerdo">Mutuo Acuerdo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Salario Mensual Base (Bs/USD)</Label>
              <Input 
                type="number" 
                value={salarioManual || ''} 
                onChange={(e) => setSalarioManual(Number(e.target.value))} 
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Días Utilidades</Label>
                <Input 
                  type="number" 
                  value={diasUtilidades} 
                  onChange={(e) => setDiasUtilidades(Number(e.target.value))} 
                />
              </div>
              <div className="space-y-2">
                <Label>Días Bono Vac.</Label>
                <Input 
                  type="number" 
                  value={diasBonoVacacional} 
                  onChange={(e) => setDiasBonoVacacional(Number(e.target.value))} 
                />
              </div>
            </div>

          </CardContent>
        </Card>

        {/* RESULTADOS */}
        <Card className="lg:col-span-2 shadow-sm border-gray-200">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Desglose del Finiquito</CardTitle>
            <CardDescription>Cálculo estimado según Ley Orgánica del Trabajo (LOTTT)</CardDescription>
          </CardHeader>
          <CardContent>
            {!calculo ? (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground border-2 border-dashed rounded-md bg-gray-50">
                <FileText className="h-8 w-8 mb-2 opacity-50" />
                <p>Seleccione un trabajador y fechas para ver el cálculo.</p>
              </div>
            ) : (
              <div className="space-y-6">
                
                {/* Métricas base */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-slate-50 p-3 rounded border">
                    <p className="text-xs text-slate-500 font-semibold uppercase">Tiempo de Servicio</p>
                    <p className="text-lg font-bold">{calculo.anosCompletos}a {calculo.mesesRestantes}m</p>
                  </div>
                  <div className="bg-slate-50 p-3 rounded border">
                    <p className="text-xs text-slate-500 font-semibold uppercase">Salario D. Normal</p>
                    <p className="text-lg font-bold">{calculo.sdn.toFixed(2)}</p>
                  </div>
                  <div className="bg-indigo-50 p-3 rounded border border-indigo-100">
                    <p className="text-xs text-indigo-500 font-semibold uppercase">Salario D. Integral</p>
                    <p className="text-lg font-bold text-indigo-700">{calculo.sdi.toFixed(2)}</p>
                  </div>
                  <div className="bg-slate-50 p-3 rounded border">
                    <p className="text-xs text-slate-500 font-semibold uppercase">Meses Totales</p>
                    <p className="text-lg font-bold">{calculo.mesesCompletos}</p>
                  </div>
                </div>

                <div className="border rounded-md overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="text-left py-2 px-3">Concepto (LOTTT)</th>
                        <th className="text-right py-2 px-3">Monto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      <tr>
                        <td className="py-2 px-3">
                          <strong>Garantía de Prestaciones (Art. 142 A/B)</strong>
                          <p className="text-xs text-muted-foreground">15 días/trimestre + 2 días adicionales por año.</p>
                        </td>
                        <td className="text-right py-2 px-3">{calculo.montoGarantia.toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3">
                          <strong>Cálculo Retroactivo (Art. 142 C)</strong>
                          <p className="text-xs text-muted-foreground">{calculo.anosCompletos} años x 30 días x SDI.</p>
                        </td>
                        <td className="text-right py-2 px-3">{calculo.montoRetroactivo.toFixed(2)}</td>
                      </tr>
                      <tr className="bg-blue-50/30">
                        <td className="py-2 px-3">
                          <strong className="text-blue-800">PRESTACIONES A PAGAR (El mayor de los anteriores)</strong>
                        </td>
                        <td className="text-right py-2 px-3 font-bold text-blue-800">{calculo.montoPrestaciones.toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3">
                          <strong>Vacaciones Fraccionadas</strong>
                        </td>
                        <td className="text-right py-2 px-3">{calculo.montoVacacionesFrac.toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3">
                          <strong>Bono Vacacional Fraccionado</strong>
                        </td>
                        <td className="text-right py-2 px-3">{calculo.montoBvFrac.toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3">
                          <strong>Utilidades Fraccionadas</strong>
                        </td>
                        <td className="text-right py-2 px-3">{calculo.montoUtilidadesFrac.toFixed(2)}</td>
                      </tr>
                      
                      {motivo === 'despido_injustificado' && (
                        <tr className="bg-red-50/50">
                          <td className="py-2 px-3">
                            <strong className="text-red-700">Indemnización por Despido (Art. 92)</strong>
                            <p className="text-xs text-red-600">Equivalente al monto de prestaciones sociales (Doblete).</p>
                          </td>
                          <td className="text-right py-2 px-3 font-bold text-red-700">{calculo.montoIndemnizacion.toFixed(2)}</td>
                        </tr>
                      )}
                      
                    </tbody>
                    <tfoot className="bg-gray-800 text-white">
                      <tr>
                        <td className="py-3 px-3 text-lg font-bold uppercase">Total Liquidación Estimada</td>
                        <td className="text-right py-3 px-3 text-xl font-bold">{calculo.montoTotal.toFixed(2)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <div className="flex justify-end gap-3 mt-4">
                  <Button variant="outline" onClick={() => toast.info('Aún no implementado: Ver Plantilla')}>
                    <FileText className="w-4 h-4 mr-2" />
                    Ver Plantilla Finiquito
                  </Button>
                  <Button onClick={guardarLiquidacion} disabled={guardando}>
                    <Save className="w-4 h-4 mr-2" />
                    {guardando ? 'Guardando...' : 'Guardar Liquidación'}
                  </Button>
                </div>

              </div>
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
