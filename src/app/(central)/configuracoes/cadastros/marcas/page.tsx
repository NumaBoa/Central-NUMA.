import { Suspense } from 'react';
import type { Metadata } from 'next';
import { EstadoCarregando } from '@/componentes/padroes/estados';
import { TelaMarcas } from './tela-marcas';

export const metadata: Metadata = { title: 'Marcas e produtos' };

export default function MarcasEProdutos() {
  return (
    <Suspense fallback={<EstadoCarregando />}>
      <TelaMarcas />
    </Suspense>
  );
}
