import type { Metadata } from 'next';
import { CabecalhoPagina } from '@/componentes/padroes/cabecalho-pagina';
import { AbasConfiguracoes } from './abas';
import { PainelGeral } from './painel-geral';

export const metadata: Metadata = { title: 'Configurações gerais' };

export default function ConfiguracoesGerais() {
  return (
    <>
      <CabecalhoPagina migalhas={['Central Numa', 'Configurações', 'Geral']} kicker="Configurações" titulo="Configurações gerais" resumo="Dados e preferências da Central Numa." />
      <AbasConfiguracoes ativa="geral" />
      <PainelGeral />
    </>
  );
}
