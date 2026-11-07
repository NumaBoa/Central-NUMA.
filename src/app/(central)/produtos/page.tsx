import { Suspense } from 'react';
import type { Metadata } from 'next';
import { EstadoCarregando } from '@/componentes/padroes/estados';
import { TelaPortfolio } from './tela-portfolio';

export const metadata: Metadata = { title: 'Produtos' };

export default function Produtos() {
  return (
    <Suspense fallback={<EstadoCarregando />}>
      <TelaPortfolio />
    </Suspense>
  );
}
