import { chaveDaTabela, driver, gravarTabelas, lerTabela } from './armazenamento';
import { novoEvento } from './evento';
import { controle, gerarExemplos } from './exemplos';
import { gerarUuid } from '@/lib/ids';
import { gravarMeta, lerMeta } from './meta';
import { VERSAO_DADOS } from './tabelas';
import type { EventoAuditoria } from './tipos/auditoria';
import { AREAS_INICIAIS, MARCAS_INICIAIS, PRODUTOS_INICIAIS } from './exemplos/base';
import type { Area, PessoaArea } from './tipos/area';
import type { Marca, Produto } from './tipos/marca';
import { CATALOGO_CONFIGURACAO, CHAVES_CONFIGURACAO, VALORES_PADRAO, type Configuracao } from './tipos/configuracao';

/** Os padrões de T02.01, uma linha por chave. Não são exemplos: "Limpar exemplos" não mexe neles. */
export function configuracoesIniciais(agora: string): Configuracao[] {
  return CHAVES_CONFIGURACAO.map((chave) => ({
    ...controle(gerarUuid(), false, agora),
    chave,
    valor: VALORES_PADRAO[chave],
    descricao: CATALOGO_CONFIGURACAO[chave].descricao,
  }));
}

function areasIniciais(agora: string): Area[] {
  return AREAS_INICIAIS.map(({ id, nome, responsavel, compartilhada }, ordem) => ({
    ...controle(id, false, agora),
    nome,
    responsavel_padrao_id: responsavel,
    compartilhada,
    ordem: ordem + 1,
  }));
}

function ligacoesIniciais(agora: string): PessoaArea[] {
  return AREAS_INICIAIS.flatMap(({ id, pessoas }) => pessoas.map((pessoaId) => ({ ...controle(gerarUuid(), false, agora), pessoa_id: pessoaId, area_id: id })));
}

function marcasIniciais(agora: string): Marca[] {
  return MARCAS_INICIAIS.map(({ id, nome, cor, provisorio, institucional }) => ({ ...controle(id, false, agora), nome, provisorio, cor_hex: cor, logo_url: null, institucional, situacao: 'ativa' }));
}

function produtosIniciais(agora: string): Produto[] {
  return PRODUTOS_INICIAIS.map(({ id, marca, nome, codigo, tipo, estagio, fila, usuarios }) => ({
    ...controle(id, false, agora),
    marca_id: marca,
    nome,
    codigo_curto: codigo,
    tipo,
    descricao_curta: null,
    estagio,
    ordem_fila: fila,
    responsavel_id: null,
    entidade_id: null,
    tem_usuarios_reais: usuarios,
    data_inicio: null,
    situacao: 'ativo',
  }));
}

/**
 * Tabelas que não podem começar vazias: valores da especificação, não exemplos. Se um backup antigo
 * não as trouxer, voltam a estes valores.
 */
const VALORES_INICIAIS = {
  configuracao: configuracoesIniciais,
  area: areasIniciais,
  pessoa_area: ligacoesIniciais,
  marca: marcasIniciais,
  produto: produtosIniciais,
} as const;

export const TABELAS_COM_VALORES_INICIAIS = Object.keys(VALORES_INICIAIS) as (keyof typeof VALORES_INICIAIS)[];

export function valoresIniciais(tabela: keyof typeof VALORES_INICIAIS, agora: string): readonly unknown[] {
  return VALORES_INICIAIS[tabela](agora);
}

/** Linhas iniciais de todas as tabelas: os exemplos e os padrões, com o histórico e os backups vazios. */
export function tabelasIniciais(agora: string) {
  return { ...gerarExemplos(agora), configuracao: configuracoesIniciais(agora), area: areasIniciais(agora), pessoa_area: ligacoesIniciais(agora), marca: marcasIniciais(agora), produto: produtosIniciais(agora), cambio_referencia: [], backup_registro: [] };
}

/**
 * Acrescenta o que falta sem tocar no que existe: quem já usa a Central não perde nada. Não pode
 * depender de tabelas inteiras, porque importar e restaurar são a saída para dados danificados.
 */
function migrar(versao: number) {
  const agora = new Date().toISOString();
  const alteracoes: Record<string, readonly unknown[]> = {};
  if (versao < 2) {
    if (driver().getItem(chaveDaTabela('configuracao')) === null) alteracoes.configuracao = configuracoesIniciais(agora);
    if (driver().getItem(chaveDaTabela('cambio_referencia')) === null) alteracoes.cambio_referencia = [];
  }
  if (versao < 3) {
    if (driver().getItem(chaveDaTabela('area')) === null) alteracoes.area = areasIniciais(agora);
    if (driver().getItem(chaveDaTabela('pessoa_area')) === null) alteracoes.pessoa_area = ligacoesIniciais(agora);
  }
  if (versao < 4) {
    if (driver().getItem(chaveDaTabela('marca')) === null) alteracoes.marca = marcasIniciais(agora);
    if (driver().getItem(chaveDaTabela('produto')) === null) alteracoes.produto = produtosIniciais(agora);
    // O contexto escolhido era um nome fixo; agora é o id do produto.
    const produtoEscolhido = PRODUTOS_INICIAIS.find((produto) => produto.contextoAntigo === lerMeta().contexto_id);
    if (produtoEscolhido) gravarMeta({ contexto_id: produtoEscolhido.id });
  }
  try {
    alteracoes.auditoria = [...lerTabela<EventoAuditoria>('auditoria'), novoEvento({ usuarioId: null, acao: 'executou_acao', depois: { funcao: 'migrar_dados', de: versao, para: VERSAO_DADOS } })];
  } catch {
    // histórico danificado: a migração segue sem esse registro
  }
  gravarTabelas(alteracoes);
  gravarMeta({ versao_dados: VERSAO_DADOS });
}

/** Dados de exemplo carregados na primeira abertura; depois, só a migração de versões antigas (02 §0.3). */
export function garantirCarga() {
  const versao = lerMeta().versao_dados;
  if (versao !== null) {
    if (versao < VERSAO_DADOS) migrar(versao);
    return;
  }
  const agora = new Date().toISOString();
  gravarTabelas({
    ...tabelasIniciais(agora),
    auditoria: [novoEvento({ usuarioId: null, acao: 'executou_acao', depois: { funcao: 'carga_inicial' } })],
  });
  gravarMeta({ versao_dados: VERSAO_DADOS });
}
