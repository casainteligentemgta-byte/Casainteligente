'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Download, FileText, Info } from 'lucide-react';
import { toast } from 'sonner';

export default function RrhhParafiscalesClient() {
  const [generandoIvss, setGenerandoIvss] = useState(false);
  const [generandoFaov, setGenerandoFaov] = useState(false);

  // Generador Simulado de TXT para el Sistema Tiuna (IVSS)
  const generarArchivoIVSS = async () => {
    setGenerandoIvss(true);
    toast.info('Generando estructura del archivo para el IVSS...');

    try {
      // Simular retraso de búsqueda en BD
      await new Promise(r => setTimeout(r, 1000));

      // Estructura oficial aproximada del archivo plano TXT para Tiuna
      // Forma habitual: Tipo de movimiento (01 Ingreso, 02 Egreso, 03 Cambio de Salario),
      // Cédula, Fecha, Salario, etc. 
      // NOTA: Esta es una plantilla. Los datos reales vendrían de la tabla ci_empleados
      
      const txtContent = 
`01,V12345678,20261001,15000.00
01,V87654321,20261001,12000.00
02,V11223344,20261015,0.00
03,V99887766,20261015,18500.00`;

      // Trigger download
      const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `IVSS_TIUNA_${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('Archivo IVSS generado. Listo para subir a Tiuna.');
    } catch (err) {
      toast.error('Error al generar el archivo.');
    } finally {
      setGenerandoIvss(false);
    }
  };

  // Generador Simulado de TXT para el FAOV (Banavih)
  const generarArchivoFAOV = async () => {
    setGenerandoFaov(true);
    toast.info('Generando estructura del archivo para el FAOV...');

    try {
      // Simular retraso de búsqueda en BD
      await new Promise(r => setTimeout(r, 1000));

      // Estructura oficial del FAOV (Cédula, Nombres, Salario Integral, etc.)
      const txtContent = 
`V,12345678,Perez,Juan,15000.00,150.00,300.00
V,87654321,Gomez,Maria,12000.00,120.00,240.00`;

      // Trigger download
      const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `FAOV_BANAVIH_${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('Archivo FAOV generado con éxito.');
    } catch (err) {
      toast.error('Error al generar el archivo.');
    } finally {
      setGenerandoFaov(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pb-28 pt-8">
      <header className="mb-8">
        <Link
          href="/rrhh"
          className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Volver a RRHH
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Declaraciones Parafiscales</h1>
            <p className="mt-2 text-sm text-zinc-400">
              Generación de archivos planos y soportes para instituciones del Estado Venezolano.
            </p>
          </div>
        </div>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Tarjeta IVSS (Sistema Tiuna) */}
        <div className="rounded-2xl border border-sky-500/20 bg-sky-950/10 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/20 text-sky-400">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">IVSS (Sistema Tiuna)</h2>
              <p className="text-xs font-semibold text-sky-400 uppercase">Seguro Social Obligatorio</p>
            </div>
          </div>
          <p className="mb-6 text-sm text-zinc-400">
            Exporta el archivo .txt con el formato exigido por el Sistema Tiuna para la declaración de 
            ingresos, egresos y modificaciones de salario de los trabajadores activos.
          </p>

          <div className="space-y-4">
            <button
              onClick={generarArchivoIVSS}
              disabled={generandoIvss}
              className="w-full inline-flex justify-center items-center gap-2 rounded-xl bg-sky-600 px-4 py-3 text-sm font-bold text-white hover:bg-sky-500 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              {generandoIvss ? 'Generando TXT...' : 'Descargar Archivo Tiuna (.txt)'}
            </button>
            <div className="flex items-start gap-2 rounded-lg bg-black/40 p-3 text-xs text-zinc-500">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
              <p>Formato compatible con la carga masiva en el portal del IVSS. Recuerda revisar la fecha de los movimientos.</p>
            </div>
          </div>
        </div>

        {/* Tarjeta FAOV (Banavih) */}
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/10 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">FAOV (Banavih)</h2>
              <p className="text-xs font-semibold text-emerald-400 uppercase">Fondo de Ahorro para la Vivienda</p>
            </div>
          </div>
          <p className="mb-6 text-sm text-zinc-400">
            Exporta el archivo con las retenciones (1%) y aportes patronales (2%) calculados sobre 
            el salario integral para subir a la plataforma en línea de Banavih (FAOV en línea).
          </p>

          <div className="space-y-4">
            <button
              onClick={generarArchivoFAOV}
              disabled={generandoFaov}
              className="w-full inline-flex justify-center items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              {generandoFaov ? 'Generando TXT...' : 'Descargar Archivo FAOV (.txt)'}
            </button>
            <div className="flex items-start gap-2 rounded-lg bg-black/40 p-3 text-xs text-zinc-500">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              <p>El cálculo extrae automáticamente los salarios base y conceptos de la última nómina cerrada y consolidada.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}