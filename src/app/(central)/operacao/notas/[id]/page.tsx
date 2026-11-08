import type { Metadata } from 'next';
import { FichaNota } from './ficha-nota';

export const metadata: Metadata = { title: 'Nota de liberação' };

export default function PaginaNota() {
  return <FichaNota />;
}
