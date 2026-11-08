import type { Metadata } from 'next';
import { TelaApresentacoes } from './tela-apresentacoes';

export const metadata: Metadata = { title: 'Apresentações' };

export default function Apresentacoes() {
  return <TelaApresentacoes />;
}
