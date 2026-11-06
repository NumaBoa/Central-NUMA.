import { Suspense } from 'react';
import type { Metadata } from 'next';
import { EstadoCarregando } from '@/componentes/padroes/estados';
import { TelaHistorico } from './tela-historico';

export const metadata: Metadata = { title: 'Histórico' };

export default function Historico() {
  return (
    <Suspense fallback={<EstadoCarregando />}>
      <TelaHistorico />
    </Suspense>
  );
}
