import type { Metadata } from 'next';
import { FichaConta } from './ficha-conta';

export const metadata: Metadata = { title: 'Conta' };

export default function PaginaDaConta() {
  return <FichaConta />;
}
