import { Suspense } from 'react';
import type { Metadata } from 'next';
import { EstadoCarregando } from '@/componentes/padroes/estados';
import { TelaRotinas } from './tela-rotinas';

export const metadata: Metadata = { title: 'Rotinas' };

export default function Rotinas() {
  return (
    <Suspense fallback={<EstadoCarregando />}>
      <TelaRotinas />
    </Suspense>
  );
}
