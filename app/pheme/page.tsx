import PhemeMinutaClient from '@/components/pheme/PhemeMinutaClient';

export const metadata = {
  title: 'Pheme — Minuta de reunión | Casa Inteligente',
  description:
    'Agente Pheme: analiza transcripciones de reuniones y genera minutas con acuerdos y alertas.',
};

export default function PhemePage() {
  return (
    <main className="pb-24">
      <PhemeMinutaClient />
    </main>
  );
}
