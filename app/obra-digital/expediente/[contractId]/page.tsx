import Link from 'next/link';
import { notFound } from 'next/navigation';
import ObraDigitalExpedienteClient from '@/components/obra-digital/ObraDigitalExpedienteClient';
import { diagnosticoAnticipoPorPeriodo } from '@/lib/obra-digital/anticipoExpediente';
import { createClient } from '@/lib/supabase/server';

export default async function ObraDigitalExpedientePage({ params }: { params: { contractId: string } }) {
  const contractId = String(params.contractId ?? '').trim();
  const supabase = await createClient();

  const { data: contract, error: e0 } = await supabase
    .from('obra_digital_labor_contracts')
    .select('*')
    .eq('id', contractId)
    .maybeSingle();

  if (e0 || !contract) {
    notFound();
  }

  const [{ data: documents }, { data: tools }, { data: advances }, { data: daily }] = await Promise.all([
    supabase.from('obra_digital_documents').select('*').eq('contract_id', contractId).order('uploaded_at', { ascending: false }),
    supabase.from('obra_digital_tool_assignments').select('*').eq('contract_id', contractId),
    supabase.from('obra_digital_monthly_advances').select('*').eq('contract_id', contractId).order('year', { ascending: false }).order('month', { ascending: false }),
    supabase.from('obra_digital_daily_progress').select('*').eq('contract_id', contractId).order('work_date', { ascending: false }).limit(60),
  ]);

  const docRows = (documents ?? []) as Array<{
    doc_type: string;
    reference_month: number | null;
    reference_year: number | null;
    escaneo_firma_visible: boolean;
    escaneo_huella_visible: boolean;
  }>;
  const advRows = (advances ?? []) as Array<{ month: number; year: number; status: string }>;
  const advanceDiagnostics = diagnosticoAnticipoPorPeriodo(docRows, advRows);

  return (
    <div className="min-h-screen bg-[#0a0a0b]">
      <div className="border-b border-zinc-800 px-4 py-3">
        <Link href="/obra-digital" className="text-sm text-zinc-400 hover:text-white">
          ← Expedientes
        </Link>
      </div>
      <ObraDigitalExpedienteClient
        contract={contract as never}
        documents={(documents ?? []) as never}
        tools={(tools ?? []) as never}
        advances={(advances ?? []) as never}
        daily={(daily ?? []) as never}
        advanceDiagnostics={advanceDiagnostics}
      />
    </div>
  );
}
