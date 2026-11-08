import type { Metadata } from 'next';
import { TelaFechamento } from './tela-fechamento';

export const metadata: Metadata = { title: 'Fechamento mensal' };

export default function PaginaFechamento() {
  return <TelaFechamento />;
}
