import type { Metadata } from 'next';
import { FichaPessoa } from './ficha-pessoa';

export const metadata: Metadata = { title: 'Ficha da pessoa' };

export default function PaginaFichaPessoa() {
  return <FichaPessoa />;
}
