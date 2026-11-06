import { Database, Settings } from 'lucide-react';
import { AbasPagina } from '@/componentes/padroes/cabecalho-pagina';

/** As abas de Configurações: Geral (T02.01) e Dados (02 §0.3). */
export function AbasConfiguracoes({ ativa }: { ativa: 'geral' | 'dados' }) {
  return (
    <AbasPagina
      rotulo="Seções de configurações"
      abas={[
        { rotulo: 'Geral', icone: Settings, href: '/configuracoes', ativa: ativa === 'geral' },
        { rotulo: 'Dados', icone: Database, href: '/configuracoes/dados', ativa: ativa === 'dados' },
      ]}
    />
  );
}
