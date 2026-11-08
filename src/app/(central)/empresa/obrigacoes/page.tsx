import { Suspense } from 'react';
import type { Metadata } from 'next';
import { EstadoCarregando } from '@/componentes/padroes/estados';
import { TelaObrigacoes } from './tela-obrigacoes';

export const metadata: Metadata = { title: 'Obrigações corporativas' };

export default function Obrigacoes() {
  return (
    <Suspense fallback={<EstadoCarregando />}>
      <TelaObrigacoes />
    </Suspense>
  );
}
