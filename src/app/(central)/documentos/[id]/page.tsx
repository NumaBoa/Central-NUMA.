import type { Metadata } from 'next';
import { VistaDoDocumento } from './vista-documento';

export const metadata: Metadata = { title: 'Documento emitido' };

export default function PaginaDocumento() {
  return <VistaDoDocumento />;
}
