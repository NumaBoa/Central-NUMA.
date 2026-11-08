import type { Metadata } from 'next';
import { TelaImplantacoes } from './tela-implantacoes';

export const metadata: Metadata = { title: 'Implantações' };

export default function PaginaImplantacoes() {
  return <TelaImplantacoes />;
}
