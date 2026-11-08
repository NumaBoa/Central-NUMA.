import type { Metadata } from 'next';
import { TelaAtivosATransferir } from './tela-ativos-a-transferir';

export const metadata: Metadata = { title: 'Ativos a transferir' };

export default function AtivosATransferir() {
  return <TelaAtivosATransferir />;
}
