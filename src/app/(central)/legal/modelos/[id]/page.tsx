import type { Metadata } from 'next';
import { EditorDeModelo } from './editor-modelo';

export const metadata: Metadata = { title: 'Modelo de documento' };

export default function PaginaModelo() {
  return <EditorDeModelo />;
}
