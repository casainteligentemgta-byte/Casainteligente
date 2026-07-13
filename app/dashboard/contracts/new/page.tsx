import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { NewContractForm } from './new-contract-form';
import { Button } from '@/components/ui/button';

export const metadata = {
    title: 'Nuevo Contrato — Administración Delegada',
    description: 'Formulario de creación de contratos de administración delegada',
};

export default function NewContractPage() {
    return (
        <div className="mx-auto max-w-3xl space-y-6 p-6 md:p-8">
            <div className="flex items-center gap-3">
                <Button variant="outline" size="icon" asChild>
                    <Link href="/dashboard/contracts" aria-label="Volver">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-[#1C1C1E]">
                        Nuevo Contrato
                    </h1>
                    <p className="text-sm text-[#8E8E93]">
                        Administración Delegada — completa el cuestionario
                    </p>
                </div>
            </div>

            <NewContractForm />
        </div>
    );
}
