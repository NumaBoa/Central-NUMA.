import type { Metadata } from 'next';
import { TelaIncidentes } from './tela-incidentes';

export const metadata: Metadata = { title: 'Incidentes de disponibilidade' };

export default function PaginaIncidentes() {
  return <TelaIncidentes />;
}
