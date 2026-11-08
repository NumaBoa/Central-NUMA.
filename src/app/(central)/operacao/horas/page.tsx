import type { Metadata } from 'next';
import { TelaHoras } from './tela-horas';

export const metadata: Metadata = { title: 'Horas' };

export default function PaginaHoras() {
  return <TelaHoras />;
}
