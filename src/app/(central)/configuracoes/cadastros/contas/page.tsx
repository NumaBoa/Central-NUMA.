import type { Metadata } from 'next';
import { TelaContas } from './tela-contas';

export const metadata: Metadata = { title: 'Contas financeiras' };

export default function Contas() {
  return <TelaContas />;
}
