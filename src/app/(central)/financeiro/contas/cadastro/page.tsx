import type { Metadata } from 'next';
import { TelaContas } from '@/app/(central)/configuracoes/cadastros/contas/tela-contas';

export const metadata: Metadata = { title: 'Contas financeiras' };

/** Desde 07/11/2026 em Financeiro › Contas e saldos (decisão de Kimberly); o endereço antigo redireciona. */
export default function CadastroDasContas() {
  return <TelaContas />;
}
