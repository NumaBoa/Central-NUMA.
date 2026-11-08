import { Suspense } from 'react';
import type { Metadata } from 'next';
import { EstadoCarregando } from '@/componentes/padroes/estados';
import { TelaMarcasDaEmpresa } from './tela-marcas';

export const metadata: Metadata = { title: 'Marcas e processos' };

export default function MarcasDaEmpresa() {
  return (
    <Suspense fallback={<EstadoCarregando />}>
      <TelaMarcasDaEmpresa />
    </Suspense>
  );
}
