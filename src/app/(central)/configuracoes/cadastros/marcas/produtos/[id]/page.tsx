import type { Metadata } from 'next';
import { FichaProduto } from './ficha-produto';

export const metadata: Metadata = { title: 'Ficha do produto' };

export default function PaginaFichaProduto() {
  return <FichaProduto />;
}
