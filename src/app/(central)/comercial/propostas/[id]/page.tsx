import type { Metadata } from 'next';
import { EditorProposta } from './editor-proposta';

export const metadata: Metadata = { title: 'Proposta' };

export default function PaginaProposta() {
  return <EditorProposta />;
}
