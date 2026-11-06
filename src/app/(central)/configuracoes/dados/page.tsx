import type { Metadata } from 'next';
import { Database, Settings } from 'lucide-react';
import { AbasPagina, CabecalhoPagina } from '@/componentes/padroes/cabecalho-pagina';
import { PainelDados } from './painel-dados';

export const metadata: Metadata = { title: 'Dados' };

export default function Dados() {
  return (
    <>
      <CabecalhoPagina migalhas={['Central Numa', 'Configurações', 'Dados']} kicker="Configurações" titulo="Dados" resumo="Uma cópia guardada. Uma preocupação a menos." />
      <AbasPagina
        rotulo="Seções de configurações"
        abas={[
          { rotulo: 'Geral', icone: Settings },
          { rotulo: 'Dados', icone: Database, href: '/configuracoes/dados', ativa: true },
        ]}
      />
      <PainelDados />
    </>
  );
}
