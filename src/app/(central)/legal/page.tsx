import type { Metadata } from 'next';
import { TelaDocumentosLegais } from './tela-documentos';

export const metadata: Metadata = { title: 'Documentos legais' };

export default function PaginaDocumentosLegais() {
  return <TelaDocumentosLegais />;
}
