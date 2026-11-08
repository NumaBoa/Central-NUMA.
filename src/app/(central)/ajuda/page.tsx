import type { Metadata } from 'next';
import { IndiceDosManuais } from '@/componentes/ajuda/paginas';

export const metadata: Metadata = { title: 'Como usar' };

export default function Ajuda() {
  return <IndiceDosManuais />;
}
