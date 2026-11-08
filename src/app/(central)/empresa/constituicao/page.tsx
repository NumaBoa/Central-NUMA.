import { Suspense } from 'react';
import type { Metadata } from 'next';
import { EstadoCarregando } from '@/componentes/padroes/estados';
import { TelaConstituicao } from './tela-constituicao';

export const metadata: Metadata = { title: 'Constituição da empresa' };

export default function Constituicao() {
  return (
    <Suspense fallback={<EstadoCarregando />}>
      <TelaConstituicao />
    </Suspense>
  );
}
