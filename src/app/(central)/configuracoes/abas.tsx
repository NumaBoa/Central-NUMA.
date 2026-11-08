import { BookUser, Database, Settings } from 'lucide-react';
import { AbasPagina } from '@/componentes/padroes/cabecalho-pagina';
import { Subabas } from '@/componentes/padroes/subabas';

/** As abas de Configurações (01 §4): Geral (T02.01), Cadastros base e Dados (02 §0.3). */
export function AbasConfiguracoes({ ativa }: { ativa: 'geral' | 'cadastros' | 'dados' }) {
  return (
    <AbasPagina
      rotulo="Seções de configurações"
      abas={[
        { rotulo: 'Geral', icone: Settings, href: '/configuracoes', ativa: ativa === 'geral' },
        { rotulo: 'Cadastros base', icone: BookUser, href: '/configuracoes/cadastros/pessoas', ativa: ativa === 'cadastros' },
        { rotulo: 'Dados', icone: Database, href: '/configuracoes/dados', ativa: ativa === 'dados' },
      ]}
    />
  );
}

/**
 * Segundo nível de "Cadastros base". Decisão de Kimberly em 07/11/2026: o que já tem lugar num módulo sai daqui
 * (marcas → Produtos; contrapartes → Comercial; categorias e contas → Financeiro), e o endereço antigo redireciona.
 */
const CADASTROS = [
  { id: 'pessoas', rotulo: 'Pessoas', href: '/configuracoes/cadastros/pessoas' },
  { id: 'areas', rotulo: 'Áreas', href: '/configuracoes/cadastros/areas' },
  { id: 'entidades', rotulo: 'Entidades', href: '/configuracoes/cadastros/entidades' },
  { id: 'calendario', rotulo: 'Calendário', href: '/configuracoes/cadastros/calendario' },
  { id: 'etiquetas', rotulo: 'Etiquetas', href: '/configuracoes/cadastros/etiquetas' },
] as const;

export function SubabasCadastros({ ativa }: { ativa: (typeof CADASTROS)[number]['id'] }) {
  return <Subabas rotulo="Cadastros base" itens={CADASTROS.map(({ id, rotulo, href }) => ({ rotulo, href, ativa: id === ativa }))} />;
}
