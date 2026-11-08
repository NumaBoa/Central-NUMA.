import type { Metadata } from 'next';
import { TelaRepasses } from './tela-repasses';

export const metadata: Metadata = { title: 'Repasses a parceiros' };

export default function PaginaRepasses() {
  return <TelaRepasses />;
}
