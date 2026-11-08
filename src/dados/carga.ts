import { chaveDaTabela, driver, gravarTabelas, lerTabela } from './armazenamento';
import { acrescentarTabelasF1, modeloSaasInicial, VALORES_INICIAIS_F1, versaoSaasInicial } from './carga-f1';
import { novoEvento } from './evento';
import { controle, gerarExemplos } from './exemplos';
import { gerarUuid } from '@/lib/ids';
import { gravarMeta, lerMeta } from './meta';
import { VERSAO_DADOS } from './tabelas';
import type { EventoAuditoria } from './tipos/auditoria';
import { atividadesDeExemplo, ativosDeExemplo, titulosDeExemplo, categoriasDeFerramentaIniciais, contasDeExemplo, contrapartesDeExemplo, ferramentasDeExemplo, rotinaDeExemplo, rotinasIniciais } from './exemplos';
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
  recorrencia: rotinasIniciais,
  categoria_ferramenta: categoriasDeFerramentaIniciais,
  ...VALORES_INICIAIS_F1,
} as const;

export const TABELAS_COM_VALORES_INICIAIS = Object.keys(VALORES_INICIAIS) as (keyof typeof VALORES_INICIAIS)[];

export function valoresIniciais(tabela: keyof typeof VALORES_INICIAIS, agora: string): readonly unknown[] {
  return VALORES_INICIAIS[tabela](agora);
}

/** Os campos da oferta que chegaram na versão 18, vazios: nenhum padrão é inventado. */
const CAMPOS_NOVOS_DA_OFERTA = { regras_uso: null, suporte_canal: null, suporte_horario: null, suporte_prazo_critico: null, suporte_prazo_normal: null, disponibilidade_meta: null, disponibilidade_compensacao: null, teste_dias: null, adicionais_ids: [] };

const TABELAS_DO_M07 = ['decisao', 'decisao_decisor', 'produto_estagio_historico', 'objetivo', 'oferta', 'oferta_recurso', 'canal_venda', 'simulacao', 'preco_versao', 'concorrente_referencia', 'kpi_definicao', 'kpi_mensal', 'configuracao_contratual', 'orcamento', 'receita_canal'] as const;

/** Linhas iniciais de todas as tabelas: os exemplos e os padrões, com o histórico e os backups vazios. */
export function tabelasIniciais(agora: string) {
  return { ...gerarExemplos(agora), ...(Object.fromEntries(TABELAS_DO_M07.map((tabela) => [tabela, []])) as Record<(typeof TABELAS_DO_M07)[number], never[]>), configuracao: configuracoesIniciais(agora), area: areasIniciais(agora), pessoa_area: ligacoesIniciais(agora), marca: marcasIniciais(agora), produto: produtosIniciais(agora), entidade: entidadesIniciais(agora), entidade_representante: [], categoria_financeira: categoriasIniciais(agora), feriado: feriadosIniciais(agora), etiqueta: [], etiqueta_vinculo: [], cambio_referencia: [], backup_registro: [], recorrencia: [...rotinasIniciais(agora), rotinaDeExemplo(agora)], categoria_ferramenta: categoriasDeFerramentaIniciais(agora), modelo_documento: modeloSaasInicial(agora), modelo_versao: versaoSaasInicial(agora) };
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
  if (versao < 10 && driver().getItem(chaveDaTabela('notificacao')) === null) alteracoes.notificacao = [];
  if (versao < 11) {
    if (driver().getItem(chaveDaTabela('categoria_ferramenta')) === null) alteracoes.categoria_ferramenta = categoriasDeFerramentaIniciais(agora);
    if (driver().getItem(chaveDaTabela('ferramenta')) === null) {
      // Quem já limpou os exemplos não recebe exemplos novos.
      const exemplos = aindaHaExemplos() ? ferramentasDeExemplo(agora) : null;
      alteracoes.ferramenta = exemplos?.ferramenta ?? [];
      alteracoes.ferramenta_contexto = exemplos?.ferramenta_contexto ?? [];
      alteracoes.assinatura_ferramenta = exemplos?.assinatura_ferramenta ?? [];
      alteracoes.assinatura_valor_historico = [];
    }
  }
  // Quem já limpou os exemplos não recebe exemplos novos.
  if (versao < 12 && driver().getItem(chaveDaTabela('ativo_digital')) === null) alteracoes.ativo_digital = aindaHaExemplos() ? ativosDeExemplo(agora).ativo_digital : [];
  if (versao < 13 && driver().getItem(chaveDaTabela('titulo')) === null) {
    const exemplos = aindaHaExemplos() ? titulosDeExemplo(agora) : null;
    alteracoes.titulo = exemplos?.titulo ?? [];
    alteracoes.titulo_rateio = exemplos?.titulo_rateio ?? [];
    alteracoes.baixa = exemplos?.baixa ?? [];
    alteracoes.movimento_societario = exemplos?.movimento_societario ?? [];
  }
  if (versao < 14 && driver().getItem(chaveDaTabela('transferencia')) === null) {
    alteracoes.transferencia = [];
    alteracoes.conferencia_saldo = [];
  }
  if (versao < 15) {
    try {
      const transferencias = lerTabela<Record<string, unknown>>('transferencia');
      if (transferencias.some((linha) => !('transferencia_original_id' in linha))) alteracoes.transferencia = transferencias.map((linha) => ('transferencia_original_id' in linha ? linha : { ...linha, transferencia_original_id: null }));
    } catch {
      // tabela danificada: a tela de Dados mostra o problema e o caminho de saída
    }
  }
  // M07: tudo começa vazio (M07 §6: nenhum preço), para quem já usa a Central e para a primeira abertura.
  if (versao < 16) for (const tabela of TABELAS_DO_M07) if (driver().getItem(chaveDaTabela(tabela)) === null) alteracoes[tabela] = [];
  // 18: a oferta ganha os campos do contrato SaaS (19 §8), vazios; a configuração contratual (T07.10) começa vazia.
  if (versao < 19 && driver().getItem(chaveDaTabela('orcamento')) === null) alteracoes.orcamento = [];
  if (versao < 20 && driver().getItem(chaveDaTabela('receita_canal')) === null) alteracoes.receita_canal = [];
  if (versao < 22 && driver().getItem(chaveDaTabela('reajuste_aplicado')) === null) alteracoes.reajuste_aplicado = [];
  // 21: sai a fase da Numa (decisão de Kimberly em 08/11/2026). A rotina que ainda esperava a fase dela não
  // começa a gerar sozinha: fica pausada, e quem quiser a retoma em Meu dia › Rotinas.
  if (versao < 21) {
    try {
      const ordem = ['f0a', 'f0b', 'f1', 'f2', 'f3'];
      const configuracao = lerTabela<Record<string, unknown>>('configuracao');
      const linhaDaFase = configuracao.find((linha) => linha.chave === 'fase_ativa');
      const faseAtiva = ordem.indexOf(String(linhaDaFase?.valor ?? 'f0a'));
      if (linhaDaFase) alteracoes.configuracao = configuracao.filter((linha) => linha !== linhaDaFase);
      const rotinas = lerTabela<Record<string, unknown>>('recorrencia');
      if (rotinas.some((linha) => 'fase_minima' in linha)) {
        alteracoes.recorrencia = rotinas.map(({ fase_minima: faseMinima, ...linha }) => (linha.situacao === 'ativa' && typeof faseMinima === 'string' && ordem.indexOf(faseMinima) > faseAtiva ? { ...linha, situacao: 'pausada' } : linha));
      }
    } catch {
      // tabela danificada: a tela de Dados mostra o problema e o caminho de saída
    }
  }
  if (versao < 18) {
    if (driver().getItem(chaveDaTabela('configuracao_contratual')) === null) alteracoes.configuracao_contratual = [];
    try {
      const ofertas = lerTabela<Record<string, unknown>>('oferta');
      if (ofertas.some((linha) => !('adicionais_ids' in linha))) alteracoes.oferta = ofertas.map((linha) => ('adicionais_ids' in linha ? linha : { ...CAMPOS_NOVOS_DA_OFERTA, ...linha }));
    } catch {
      // tabela danificada: a tela de Dados mostra o problema e o caminho de saída
    }
  }
  // M09, M10 e M11: acrescenta o que faltar, seja qual for a versão de origem.
  acrescentarTabelasF1(alteracoes, agora);
  // A rotina de exemplo vem sem ocorrência passada: os códigos das atividades já estão em uso.
  if (versao < 9 && driver().getItem(chaveDaTabela('recorrencia')) === null) alteracoes.recorrencia = [...rotinasIniciais(agora), ...(aindaHaExemplos() ? [rotinaDeExemplo(agora)] : [])];
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
