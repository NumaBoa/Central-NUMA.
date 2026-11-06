import type { Metadata } from 'next';
import { TelaAtivos } from './tela-ativos';

export const metadata: Metadata = { title: 'Ativos digitais' };

export default function Ativos() {
  return <TelaAtivos />;
}
