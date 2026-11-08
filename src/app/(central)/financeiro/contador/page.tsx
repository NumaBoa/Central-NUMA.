import type { Metadata } from 'next';
import { TelaContador } from './tela-contador';

export const metadata: Metadata = { title: 'Pacote do contador' };

export default function PaginaContador() {
  return <TelaContador />;
}
