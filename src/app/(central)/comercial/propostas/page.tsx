import type { Metadata } from 'next';
import { TelaPropostas } from './tela-propostas';

export const metadata: Metadata = { title: 'Propostas' };

export default function PaginaPropostas() {
  return <TelaPropostas />;
}
