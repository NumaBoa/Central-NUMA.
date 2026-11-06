import type { Metadata } from 'next';
import { TelaContas } from './tela-contas';

export const metadata: Metadata = { title: 'Contas e saldos' };

export default function ContasESaldos() {
  return <TelaContas />;
}
