import type { Metadata } from 'next';
import { TelaReceitas } from './tela-receitas';

export const metadata: Metadata = { title: 'Receita por canal' };

export default function Receitas() {
  return <TelaReceitas />;
}
