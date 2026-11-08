import { Suspense } from 'react';
import type { Metadata } from 'next';
import { EstadoCarregando } from '@/componentes/padroes/estados';
import { TelaConteudo } from './tela-conteudo';

export const metadata: Metadata = { title: 'Calendário editorial' };

export default function Conteudo() {
  return (
    <Suspense fallback={<EstadoCarregando />}>
      <TelaConteudo />
    </Suspense>
  );
}
