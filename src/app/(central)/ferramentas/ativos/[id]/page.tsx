import type { Metadata } from 'next';
import { FichaAtivo } from './ficha-ativo';

export const metadata: Metadata = { title: 'Ativo digital' };

export default function PaginaDoAtivo() {
  return <FichaAtivo />;
}
