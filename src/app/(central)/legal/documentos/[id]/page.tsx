import type { Metadata } from 'next';
import { FichaDocumentoLegal } from './ficha-documento';

export const metadata: Metadata = { title: 'Documento legal' };

export default function PaginaDocumentoLegal() {
  return <FichaDocumentoLegal />;
}
