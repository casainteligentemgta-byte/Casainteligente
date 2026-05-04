import EntidadesPatronoClient from './EntidadesPatronoClient';

export const metadata = {
  title: 'Entidades legales | Casa Inteligente',
  description: 'Patronos: razón social, RIF, representante, registro mercantil y permisología para contratos.',
};

export default function ConfiguracionEntidadesPage() {
  return <EntidadesPatronoClient />;
}
