import type { Metadata } from 'next';
import { TelaModelos } from './tela-modelos';

export const metadata: Metadata = { title: 'Modelos de documentos' };

export default function PaginaModelos() {
  return <TelaModelos />;
}
