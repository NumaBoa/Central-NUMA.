import { Suspense } from 'react';
import type { Metadata } from 'next';
import { EstadoCarregando } from '@/componentes/padroes/estados';
import { TelaMarcas } from '@/app/(central)/configuracoes/cadastros/marcas/tela-marcas';

export const metadata: Metadata = { title: 'Marcas e produtos' };

/** Desde 07/11/2026 em Produtos (decisão de Kimberly); o endereço antigo de Configurações redireciona. */
export default function Marcas() {
  return (
    <Suspense fallback={<EstadoCarregando />}>
      <TelaMarcas />
    </Suspense>
  );
}
