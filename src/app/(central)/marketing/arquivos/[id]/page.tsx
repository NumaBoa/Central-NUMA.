import type { Metadata } from 'next';
import { FichaArquivo } from './ficha-arquivo';

export const metadata: Metadata = { title: 'Ficha do arquivo' };

export default function Arquivo() {
  return <FichaArquivo />;
}
