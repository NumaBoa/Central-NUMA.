import type { Metadata } from 'next';
import { TelaEstimado } from './tela-estimado';

export const metadata: Metadata = { title: 'Estimado × realizado' };

export default function PaginaEstimado() {
  return <TelaEstimado />;
}
