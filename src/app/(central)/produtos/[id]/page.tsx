import { Suspense } from 'react';
import type { Metadata } from 'next';
import { EstadoCarregando } from '@/componentes/padroes/estados';
import { FichaDoProduto } from './ficha-do-produto';

export const metadata: Metadata = { title: 'Ficha do produto' };

export default function Produto() {
  return (
    <Suspense fallback={<EstadoCarregando />}>
      <FichaDoProduto />
    </Suspense>
  );
}
