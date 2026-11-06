import { Suspense } from 'react';
import type { Metadata } from 'next';
import { EstadoCarregando } from '@/componentes/padroes/estados';
import { TelaMeuDia } from './tela-meu-dia';

export const metadata: Metadata = { title: 'Meu dia' };

export default function MeuDia() {
  return (
    <Suspense fallback={<EstadoCarregando />}>
      <TelaMeuDia />
    </Suspense>
  );
}
