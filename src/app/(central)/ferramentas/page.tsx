import type { Metadata } from 'next';
import { TelaFerramentas } from './tela-ferramentas';

export const metadata: Metadata = { title: 'Ferramentas' };

export default function Ferramentas() {
  return <TelaFerramentas />;
}
