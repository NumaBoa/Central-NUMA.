import type { Metadata } from 'next';
import { TelaCategorias } from '@/app/(central)/configuracoes/cadastros/categorias/tela-categorias';

export const metadata: Metadata = { title: 'Categorias financeiras' };

/** Desde 07/11/2026 em Financeiro (decisão de Kimberly); o endereço antigo de Configurações redireciona. */
export default function Categorias() {
  return <TelaCategorias />;
}
