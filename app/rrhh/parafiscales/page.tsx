import RrhhParafiscalesClient from '@/components/rrhh/parafiscales/RrhhParafiscalesClient';

export const metadata = {
  title: 'Parafiscales (IVSS, FAOV) | RRHH',
  description: 'Generación de archivos planos TXT para el Seguro Social (Tiuna) y FAOV.',
};

export default function RrhhParafiscalesPage() {
  return <RrhhParafiscalesClient />;
}