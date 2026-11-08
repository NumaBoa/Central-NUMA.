import type { Metadata } from 'next';
import { TelaNotas } from './tela-notas';

export const metadata: Metadata = { title: 'Notas de liberação' };

export default function PaginaNotas() {
  return <TelaNotas />;
}
