import { Suspense } from 'react';
import type { Metadata } from 'next';
import { EstadoCarregando } from '@/componentes/padroes/estados';
import { TelaResumoDiario } from './tela-resumo-diario';

export const metadata: Metadata = { title: 'Resumo diário por e-mail' };

export default function ResumoDiario() {
  return (
    <Suspense fallback={<EstadoCarregando />}>
      <TelaResumoDiario />
    </Suspense>
  );
}
