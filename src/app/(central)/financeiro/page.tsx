import type { Metadata } from 'next';
import { TelaLancamentos } from './tela-lancamentos';

export const metadata: Metadata = { title: 'Lançamentos' };

export default function Financeiro() {
  return <TelaLancamentos />;
}
