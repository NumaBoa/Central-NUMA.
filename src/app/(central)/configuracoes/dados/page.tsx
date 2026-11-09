import type { Metadata } from 'next';
import { CabecalhoPagina } from '@/componentes/padroes/cabecalho-pagina';
import { AbasConfiguracoes } from '../abas';
import { PainelDados } from './painel-dados';

export const metadata: Metadata = { title: 'Dados' };

export default function Dados() {
  return (
    <>
      <CabecalhoPagina comoUsar="/ajuda/cadastros/exportar-backup" migalhas={['Central Numa', 'Configurações', 'Dados']} kicker="Configurações" titulo="Dados" resumo="Uma cópia guardada. Uma preocupação a menos." />
      <AbasConfiguracoes ativa="dados" />
      <PainelDados />
    </>
  );
}
