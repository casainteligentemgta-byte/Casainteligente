import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';

export const metadata = {
    title: 'Contratos — Dashboard',
    description: 'Gestión de contratos de administración delegada',
};

export default function ContractsIndexPage() {
    return (
        <div className="mx-auto max-w-3xl space-y-6 p-6 md:p-8">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-[#1C1C1E]">
                        Contratos
                    </h1>
                    <p className="text-sm text-[#8E8E93]">
                        Administración Delegada
                    </p>
                </div>
                <Button asChild>
                    <Link href="/dashboard/contracts/new">Nuevo contrato</Link>
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Listado</CardTitle>
                    <CardDescription>
                        La lista de contratos se conectará a Supabase en el siguiente paso.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-[#8E8E93]">
                        Aún no hay contratos cargados. Crea uno nuevo para probar el formulario.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
