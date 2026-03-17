import NuevoClienteForm from '@/components/clientes/NuevoClienteForm';

export const metadata = {
    title: 'Nuevo Cliente — Casa Inteligente CRM',
    description: 'Registrar nuevo cliente personal o empresarial',
};

export default function NuevoClientePage() {
    return <NuevoClienteForm />;
}
