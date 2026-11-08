import type { Metadata } from 'next';
import { FichaProduto } from '@/app/(central)/configuracoes/cadastros/marcas/produtos/[id]/ficha-produto';

export const metadata: Metadata = { title: 'Cadastro básico do produto' };

/** O cadastro básico fica dentro do produto, no módulo Produtos (decisão de Kimberly em 07/11/2026). */
export default function CadastroDoProduto() {
  return <FichaProduto />;
}
