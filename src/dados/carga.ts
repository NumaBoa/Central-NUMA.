import { chaveDaTabela, driver, gravarTabelas, lerTabela } from './armazenamento';
import { novoEvento } from './evento';
import { controle, gerarExemplos } from './exemplos';
import { gerarUuid } from '@/lib/ids';
import { gravarMeta, lerMeta } from './meta';
import { VERSAO_DADOS } from './tabelas';
import type { EventoAuditoria } from './tipos/auditoria';
import { atividadesDeExemplo, contasDeExemplo, contrapartesDeExemplo } from './exemplos';
import { AREAS_INICIAIS, CATEGORIAS_INICIAIS, ID_ENTIDADE_PLANEJADA, MARCAS_INICIAIS, PRODUTOS_INICIAIS } from './exemplos/base';
import { feriadosDoAno } from './referencia/feriados';
import { hojeISO } from '@/lib/datas';
import type { Area, PessoaArea } from './tipos/area';
import type { Feriado } from './tipos/calendario';
import type { Entidade } from './tipos/contraparte';
import type { CategoriaFinanceira } from './tipos/financeiro';
import type { Marca, Produto } from './tipos/marca';
import type { Pessoa } from './tipos/pessoa';
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

/** T02.05: "Uma entidade 'Planejada — Numa' é criada na carga inicial para permitir rascunhos." */
function entidadesIniciais(agora: string): Entidade[] {
  return [
    {
      ...controle(ID_ENTIDADE_PLANEJADA, false, agora),
      tipo_pessoa: 'pj',
      nome: 'Planejada — Numa',
      nome_fantasia: null,
      documento: null,
      situacao: 'planejada',
      natureza_juridica: null,
      regime_tributario: null,
      inscricao_municipal: null,
      inscricao_estadual: null,
      endereco: null,
      data_abertura: null,
      entidade_padrao: true,
      contador_id: null,
    },
  ];
}

function categoriasIniciais(agora: string): CategoriaFinanceira[] {
  return CATEGORIAS_INICIAIS.map(({ id, nome, tipo, pai }) => ({ ...controle(id, false, agora), nome, tipo, natureza_custo: null, pai_id: pai, situacao: 'ativa' }));
}

/** O calendário do ano em que a Central foi aberta, no local padrão de T02.01 (D16). */
function feriadosIniciais(agora: string): Feriado[] {
  const ano = Number(hojeISO(new Date(agora)).slice(0, 4));
  return feriadosDoAno(ano, { uf: VALORES_PADRAO.uf_padrao, municipio: VALORES_PADRAO.municipio_padrao }).map((feriado) => ({ ...controle(gerarUuid(), false, agora), ...feriado }));
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
  entidade: entidadesIniciais,
  categoria_financeira: categoriasIniciais,
  feriado: feriadosIniciais,
} as const;

export const TABELAS_COM_VALORES_INICIAIS = Object.keys(VALORES_INICIAIS) as (keyof typeof VALORES_INICIAIS)[];

export function valoresIniciais(tabela: keyof typeof VALORES_INICIAIS, agora: string): readonly unknown[] {
  return VALORES_INICIAIS[tabela](agora);
}

/** Linhas iniciais de todas as tabelas: os exemplos e os padrões, com o histórico e os backups vazios. */
export function tabelasIniciais(agora: string) {
  return { ...gerarExemplos(agora), configuracao: configuracoesIniciais(agora), area: areasIniciais(agora), pessoa_area: ligacoesIniciais(agora), marca: marcasIniciais(agora), produto: produtosIniciais(agora), entidade: entidadesIniciais(agora), entidade_representante: [], categoria_financeira: categoriasIniciais(agora), feriado: feriadosIniciais(agora), etiqueta: [], etiqueta_vinculo: [], cambio_referencia: [], backup_registro: [] };
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
  if (versao < 5) {
    if (driver().getItem(chaveDaTabela('entidade')) === null) alteracoes.entidade = entidadesIniciais(agora);
    if (driver().getItem(chaveDaTabela('entidade_representante')) === null) alteracoes.entidade_representante = [];
    // Quem já limpou os exemplos não recebe exemplos novos.
    if (driver().getItem(chaveDaTabela('contraparte')) === null) alteracoes.contraparte = aindaHaExemplos() ? contrapartesDeExemplo(agora) : [];
  }
  if (versao < 6) {
    if (driver().getItem(chaveDaTabela('categoria_financeira')) === null) alteracoes.categoria_financeira = categoriasIniciais(agora);
    if (driver().getItem(chaveDaTabela('feriado')) === null) alteracoes.feriado = feriadosIniciais(agora);
    if (driver().getItem(chaveDaTabela('etiqueta')) === null) alteracoes.etiqueta = [];
    if (driver().getItem(chaveDaTabela('etiqueta_vinculo')) === null) alteracoes.etiqueta_vinculo = [];
    // Quem já limpou os exemplos não recebe exemplos novos.
    if (driver().getItem(chaveDaTabela('conta_financeira')) === null) alteracoes.conta_financeira = aindaHaExemplos() ? contasDeExemplo(agora) : [];
  }
  if (versao < 7 && driver().getItem(chaveDaTabela('atividade')) === null) {
    // Quem já limpou os exemplos não recebe exemplos novos.
    const { atividade, atividade_produto, atividade_participante } = aindaHaExemplos() ? atividadesDeExemplo(agora) : { atividade: [], atividade_produto: [], atividade_participante: [] };
    alteracoes.atividade = atividade;
    alteracoes.atividade_produto = atividade_produto;
    alteracoes.atividade_participante = atividade_participante;
  }
  if (versao < 8) {
    const recemCriadas = alteracoes.atividade as readonly { exemplo: boolean }[] | undefined;
    const exemplos = (recemCriadas ? recemCriadas.some((linha) => linha.exemplo) : lerAtividadesComExemplo()) ? atividadesDeExemplo(agora) : null;
    for (const tabela of ['checklist_item', 'comentario', 'vinculo', 'anexo_link'] as const) {
      if (driver().getItem(chaveDaTabela(tabela)) === null) alteracoes[tabela] = exemplos ? exemplos[tabela] : [];
    }
  }
  try {
    alteracoes.auditoria = [...lerTabela<EventoAuditoria>('auditoria'), novoEvento({ usuarioId: null, acao: 'executou_acao', depois: { funcao: 'migrar_dados', de: versao, para: VERSAO_DADOS } })];
  } catch {
    // histórico danificado: a migração segue sem esse registro
  }
  gravarTabelas(alteracoes);
  gravarMeta({ versao_dados: VERSAO_DADOS });
}

/** As atividades de exemplo ainda estão lá: os itens e comentários de exemplo têm a quem pertencer. */
function lerAtividadesComExemplo(): boolean {
  try {
    return lerTabela<{ exemplo: boolean }>('atividade').some((linha) => linha.exemplo);
  } catch {
    return false;
  }
}

function aindaHaExemplos(): boolean {
  try {
    return lerTabela<Pessoa>('pessoa').some((pessoa) => pessoa.exemplo);
  } catch {
    return false;
  }
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
