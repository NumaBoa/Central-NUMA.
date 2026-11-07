import { Suspense } from 'react';
import type { Metadata } from 'next';
import { EstadoCarregando } from '@/componentes/padroes/estados';
import { NovoContratoSaas } from './novo-saas';

export const metadata: Metadata = { title: 'Novo contrato de assinatura' };

export default function PaginaNovoContratoSaas() {
  return (
    <Suspense fallback={<EstadoCarregando />}>
      <NovoContratoSaas />
    </Suspense>
  );
}
