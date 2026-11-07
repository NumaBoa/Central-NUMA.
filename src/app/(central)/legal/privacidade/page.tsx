import type { Metadata } from 'next';
import { TelaInventario } from './tela-inventario';

export const metadata: Metadata = { title: 'Inventário de tratamento' };

export default function PaginaInventario() {
  return <TelaInventario />;
}
