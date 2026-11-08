import type { Metadata } from 'next';
import { TelaReunioes } from './tela-reunioes';

export const metadata: Metadata = { title: 'Reuniões' };

export default function Reunioes() {
  return <TelaReunioes />;
}
