import type { Metadata } from 'next';
import { TelaOrcamento } from './tela-orcamento';

export const metadata: Metadata = { title: 'Orçamento' };

export default function Orcamento() {
  return <TelaOrcamento />;
}
