import type { Metadata } from 'next';
import { TelaCanais } from './tela-canais';

export const metadata: Metadata = { title: 'Canais de venda' };

export default function CanaisDeVenda() {
  return <TelaCanais />;
}
