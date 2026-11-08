/** T06.07: a ficha da entidade (T02.05) vista pela Empresa, com as abas a mais do M06. Não existe um segundo cadastro. */
import { repositorios } from '@/dados/repositorios';
import type { AtivoDigital } from '@/dados/tipos/ativo';
import type { Contrato } from '@/dados/tipos/contrato';
import type { Entidade } from '@/dados/tipos/contraparte';
import type { Ferramenta } from '@/dados/tipos/ferramenta';
import type { ConstituicaoItem, Obrigacao } from '@/dados/tipos/sociedade';
import { carregarContas, type DadosContas } from './contas';
import { carregarEntidades, type DadosEntidades } from './entidades';
import type { Fase } from './navegacao';

export type DadosDaEntidadeDaEmpresa = {
  cadastro: DadosEntidades;
  contas: DadosContas;
  ativos: AtivoDigital[];
  ferramentas: Ferramenta[];
  contratos: Contrato[];
  obrigacoes: Obrigacao[];
  itens: ConstituicaoItem[];
  fase: Fase;
};

export async function carregarEntidadeDaEmpresa(): Promise<DadosDaEntidadeDaEmpresa> {
  const [cadastro, contas, ativos, ferramentas, contratos, obrigacoes, itens, configuracoes] = await Promise.all([carregarEntidades(), carregarContas(), repositorios.ativo_digital.listar(), repositorios.ferramenta.listar(), repositorios.contrato.listar(), repositorios.obrigacao_corporativa.listar(), repositorios.constituicao_item.listar(), repositorios.configuracao.ler()]);
  return { cadastro, contas, ativos, ferramentas, contratos, obrigacoes, itens, fase: configuracoes.fase_ativa };
}

export type PendenciaParaAtivar = { rotulo: string; feito: boolean };

/** T02.05: o que falta para a entidade ficar Ativa. PF usa CPF; PJ, CNPJ. */
export function pendenciasParaAtivar(entidade: Pick<Entidade, 'id' | 'tipo_pessoa' | 'documento' | 'endereco' | 'data_abertura'>, representantes: readonly string[]): PendenciaParaAtivar[] {
  return [
    { rotulo: entidade.tipo_pessoa === 'pf' ? 'CPF' : 'CNPJ', feito: Boolean(entidade.documento) },
    { rotulo: 'Endereço', feito: Boolean(entidade.endereco) },
    { rotulo: 'Representante legal', feito: representantes.length > 0 },
    { rotulo: 'Data de abertura', feito: Boolean(entidade.data_abertura) },
  ];
}

/** A entidade que a tela abre primeiro: a padrão, ou a primeira que não foi encerrada. */
export function entidadeInicial<T extends Pick<Entidade, 'id' | 'entidade_padrao' | 'situacao' | 'arquivado_em'>>(entidades: readonly T[]): T | undefined {
  const vivas = entidades.filter((entidade) => !entidade.arquivado_em);
  return vivas.find((entidade) => entidade.entidade_padrao) ?? vivas.find((entidade) => entidade.situacao !== 'encerrada') ?? vivas[0];
}
