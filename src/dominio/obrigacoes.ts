/**
 * Regras de T06.08 (08-M06, F1). O cadastro é definido com o contador: nada aqui presume uma obrigação fiscal. Concluir o
 * alerta no Meu dia não cumpre a ocorrência, e cumprir a ocorrência não paga o título: pagamento só existe com baixa no M05.
 */
import { ErroDeRegra } from '@/dados/erros';
import { repositorios } from '@/dados/repositorios';
import { comoSistema } from '@/dados/sessao';
import { emTransacao } from '@/dados/transacao';
import type { Atividade } from '@/dados/tipos/atividade';
import type { Entidade } from '@/dados/tipos/contraparte';
import type { CategoriaFinanceira } from '@/dados/tipos/financeiro';
import type { Pessoa } from '@/dados/tipos/pessoa';
import type { Obrigacao, ObrigacaoOcorrencia } from '@/dados/tipos/sociedade';
import type { Titulo } from '@/dados/tipos/titulo';
import { hojeISO } from '@/lib/datas';
import { sincronizarAlertasDasObrigacoes } from './alertas-m06';
import { somarMeses } from './cobrancas';
import { lerValor, valorParaCampo } from './dinheiro';
import { ORIGEM_OCORRENCIA } from './integracoes/meu-dia-m06';
import { linkDoDriveValido, MENSAGEM_LINK_DRIVE } from './link-drive';
import { faseLiberada, type Fase } from './navegacao';
import { somarDias } from './repeticao';

export const ROTULOS_PERIODICIDADE_OBRIGACAO: Readonly<Record<Obrigacao['periodicidade'], string>> = { mensal: 'Mensal', trimestral: 'Trimestral', anual: 'Anual', outra: 'Outra' };
export const ROTULOS_SITUACAO_OBRIGACAO: Readonly<Record<Obrigacao['situacao'], string>> = { rascunho: 'Rascunho', ativa: 'Ativa', encerrada: 'Encerrada' };

export const NOTA_SEM_PRESUNCAO = 'Cadastro definido com o contador. Nenhuma obrigação fiscal é presumida pelo sistema.';
export const NOTA_PAGAMENTO = 'O sistema não presume pagamento quando a tarefa é concluída.';
export const MENSAGEM_FASE_DAS_OBRIGACOES = 'As obrigações geram ocorrências a partir da Fase 1. Até lá, salve como rascunho.';
export const MENSAGEM_ENTIDADE_PLANEJADA = 'Com a entidade ainda não Ativa, salve como rascunho e valide com o contador antes de ativar.';

const MESES: Readonly<Partial<Record<Obrigacao['periodicidade'], number>>> = { mensal: 1, trimestral: 3, anual: 12 };

/** Do vencimento base até `ate`. "Outra" não se repete sozinha: a próxima ocorrência é informada à mão. */
export function vencimentosAte(obrigacao: Pick<Obrigacao, 'periodicidade' | 'vencimento_base'>, ate: string): string[] {
  const passo = MESES[obrigacao.periodicidade];
  if (!passo) return obrigacao.vencimento_base <= ate ? [obrigacao.vencimento_base] : [];
  const dia = Number(obrigacao.vencimento_base.slice(8));
  const lista: string[] = [];
  for (let ciclo = 0; ciclo < 1200; ciclo += 1) {
    const vencimento = somarMeses(obrigacao.vencimento_base, ciclo * passo, dia);
    if (vencimento > ate) break;
    lista.push(vencimento);
  }
  return lista;
}

/** O próximo vencimento: uma ocorrência em aberto ou o próximo do calendário. "Outra" sem ocorrência em aberto não tem. */
export function proximoVencimento(obrigacao: Pick<Obrigacao, 'periodicidade' | 'vencimento_base' | 'situacao'>, ocorrencias: readonly Pick<ObrigacaoOcorrencia, 'referencia' | 'vencimento' | 'cumprida_em'>[]): string | null {
  const aberta = ocorrencias.filter((ocorrencia) => !ocorrencia.cumprida_em).sort((a, b) => a.vencimento.localeCompare(b.vencimento))[0];
  if (aberta) return aberta.vencimento;
  if (obrigacao.situacao === 'encerrada') return null;
  const passo = MESES[obrigacao.periodicidade];
  const usadas = new Set(ocorrencias.map((ocorrencia) => ocorrencia.referencia));
  if (!passo) return usadas.has(obrigacao.vencimento_base) ? null : obrigacao.vencimento_base;
  const dia = Number(obrigacao.vencimento_base.slice(8));
  for (let ciclo = 0; ciclo < 1200; ciclo += 1) {
    const vencimento = somarMeses(obrigacao.vencimento_base, ciclo * passo, dia);
    if (!usadas.has(vencimento)) return vencimento;
  }
  return null;
}

// ---------- Dados ----------

export type DadosDasObrigacoes = {
  obrigacoes: Obrigacao[];
  ocorrencias: ObrigacaoOcorrencia[];
  entidades: Entidade[];
  pessoas: Pessoa[];
  categorias: CategoriaFinanceira[];
  titulos: Titulo[];
  alertas: Atividade[];
  fase: Fase;
};

export async function carregarObrigacoes(): Promise<DadosDasObrigacoes> {
  const [obrigacoes, ocorrencias, entidades, pessoas, categorias, titulos, alertas, configuracoes] = await Promise.all([repositorios.obrigacao_corporativa.listar(), repositorios.obrigacao_corporativa_ocorrencia.listar(), repositorios.entidade.listar(), repositorios.pessoa.listar({ incluirArquivados: true }), repositorios.categoria_financeira.listar(), repositorios.titulo.listar(), repositorios.atividade.listar({ onde: { origem_tipo: ORIGEM_OCORRENCIA } }), repositorios.configuracao.ler()]);
  return { obrigacoes, ocorrencias, entidades, pessoas, categorias, titulos, alertas, fase: configuracoes.fase_ativa };
}

export const ocorrenciasDaObrigacao = <T extends Pick<ObrigacaoOcorrencia, 'obrigacao_id' | 'vencimento'>>(id: string, ocorrencias: readonly T[]): T[] => ocorrencias.filter((ocorrencia) => ocorrencia.obrigacao_id === id).sort((a, b) => b.vencimento.localeCompare(a.vencimento));

export type LinhaDaObrigacao = { obrigacao: Obrigacao; proximo: string | null; ultimaCumprida: ObrigacaoOcorrencia | null };

export function linhasDasObrigacoes({ obrigacoes, ocorrencias }: Pick<DadosDasObrigacoes, 'obrigacoes' | 'ocorrencias'>): LinhaDaObrigacao[] {
  return obrigacoes
    .map((obrigacao) => {
      const dela = ocorrenciasDaObrigacao(obrigacao.id, ocorrencias);
      return { obrigacao, proximo: proximoVencimento(obrigacao, dela), ultimaCumprida: dela.find((ocorrencia) => ocorrencia.cumprida_em) ?? null };
    })
    .sort((a, b) => (a.proximo ?? '9999').localeCompare(b.proximo ?? '9999') || a.obrigacao.nome.localeCompare(b.obrigacao.nome, 'pt-BR'));
}

/** O painel da empresa: as próximas 5 (T06.01). */
export function proximasObrigacoes(dados: Pick<DadosDasObrigacoes, 'obrigacoes' | 'ocorrencias'>, quantas = 5): LinhaDaObrigacao[] {
  return linhasDasObrigacoes(dados)
    .filter((linha) => linha.obrigacao.situacao === 'ativa' && linha.proximo)
    .slice(0, quantas);
}

export type FiltrosObrigacoes = { busca: string; entidade: string; situacao: string; periodicidade: string; responsavel: string; categoria: string };
export const FILTROS_OBRIGACOES_INICIAIS: FiltrosObrigacoes = { busca: '', entidade: '', situacao: '', periodicidade: '', responsavel: '', categoria: '' };

export function filtrarObrigacoes(linhas: readonly LinhaDaObrigacao[], filtros: FiltrosObrigacoes): LinhaDaObrigacao[] {
  const termo = filtros.busca.trim().toLocaleLowerCase('pt-BR');
  return linhas.filter(({ obrigacao }) => (!termo || `${obrigacao.nome} ${obrigacao.orgao ?? ''}`.toLocaleLowerCase('pt-BR').includes(termo)) && (!filtros.entidade || obrigacao.entidade_id === filtros.entidade) && (!filtros.situacao || obrigacao.situacao === filtros.situacao) && (!filtros.periodicidade || obrigacao.periodicidade === filtros.periodicidade) && (!filtros.responsavel || obrigacao.responsavel_id === filtros.responsavel) && (!filtros.categoria || obrigacao.categoria_id === filtros.categoria));
}

// ---------- Formulário ----------

export type FormularioObrigacao = { nome: string; descricao: string; entidade_id: string; orgao: string; periodicidade: Obrigacao['periodicidade']; vencimento_base: string; antecedencia_dias: string; responsavel_id: string; gera_titulo: boolean; categoria_id: string; valor_estimado: string; situacao: Obrigacao['situacao'] };

export const formularioObrigacaoVazio = (entidadeId: string, pessoaId: string): FormularioObrigacao => ({ nome: '', descricao: '', entidade_id: entidadeId, orgao: '', periodicidade: 'mensal', vencimento_base: '', antecedencia_dias: '', responsavel_id: pessoaId, gera_titulo: false, categoria_id: '', valor_estimado: '', situacao: 'rascunho' });

export const formularioDaObrigacao = (obrigacao: Obrigacao): FormularioObrigacao => ({ nome: obrigacao.nome, descricao: obrigacao.descricao ?? '', entidade_id: obrigacao.entidade_id, orgao: obrigacao.orgao ?? '', periodicidade: obrigacao.periodicidade, vencimento_base: obrigacao.vencimento_base, antecedencia_dias: String(obrigacao.antecedencia_dias), responsavel_id: obrigacao.responsavel_id, gera_titulo: obrigacao.gera_titulo, categoria_id: obrigacao.categoria_id ?? '', valor_estimado: obrigacao.valor_estimado === null ? '' : valorParaCampo(obrigacao.valor_estimado), situacao: obrigacao.situacao });

type Conferencia = { entidades: readonly Pick<Entidade, 'id' | 'situacao'>[]; fase: Fase; hoje: string; baseAtual?: string };

export function errosDaObrigacao(formulario: FormularioObrigacao, { entidades, fase, hoje, baseAtual }: Conferencia): Record<string, string> {
  const erros: Record<string, string> = {};
  if (!formulario.nome.trim()) erros.nome = 'Informe o nome da obrigação.';
  if (!formulario.entidade_id) erros.entidade_id = 'Escolha a entidade.';
  if (!formulario.responsavel_id) erros.responsavel_id = 'Escolha a responsável.';
  if (!formulario.vencimento_base) erros.vencimento_base = 'Informe o próximo vencimento.';
  else if (formulario.vencimento_base !== baseAtual && formulario.vencimento_base < hoje) erros.vencimento_base = 'O próximo vencimento não pode ter passado.';
  const antecedencia = Number(formulario.antecedencia_dias);
  if (!formulario.antecedencia_dias.trim() || !Number.isInteger(antecedencia) || antecedencia < 0 || antecedencia > 365) erros.antecedencia_dias = 'Informe de 0 a 365 dias.';
  if (formulario.gera_titulo) {
    if (!formulario.categoria_id) erros.categoria_id = 'Quem gera título precisa da categoria financeira.';
    if (formulario.valor_estimado.trim() && lerValor(formulario.valor_estimado) === null) erros.valor_estimado = 'Use um valor em reais, como 150,00.';
  }
  if (formulario.situacao === 'ativa') {
    const entidade = entidades.find((item) => item.id === formulario.entidade_id);
    if (!faseLiberada('f1', fase)) erros.situacao = MENSAGEM_FASE_DAS_OBRIGACOES;
    else if (entidade && entidade.situacao !== 'ativa') erros.situacao = MENSAGEM_ENTIDADE_PLANEJADA;
  }
  return erros;
}

export async function salvarObrigacao(formulario: FormularioObrigacao, id?: string, hoje: string = hojeISO()): Promise<Obrigacao> {
  const [entidades, configuracoes, atual] = await Promise.all([repositorios.entidade.listar(), repositorios.configuracao.ler(), id ? repositorios.obrigacao_corporativa.obter(id) : Promise.resolve(null)]);
  const erro = Object.values(errosDaObrigacao(formulario, { entidades, fase: configuracoes.fase_ativa, hoje, ...(atual ? { baseAtual: atual.vencimento_base } : {}) }))[0];
  if (erro) throw new ErroDeRegra(erro);
  const dados = {
    nome: formulario.nome.trim(),
    descricao: formulario.descricao.trim() || null,
    entidade_id: formulario.entidade_id,
    orgao: formulario.orgao.trim() || null,
    periodicidade: formulario.periodicidade,
    dia: formulario.periodicidade === 'outra' ? null : Number(formulario.vencimento_base.slice(8)),
    vencimento_base: formulario.vencimento_base,
    antecedencia_dias: Number(formulario.antecedencia_dias),
    responsavel_id: formulario.responsavel_id,
    categoria_id: formulario.gera_titulo ? formulario.categoria_id : null,
    gera_titulo: formulario.gera_titulo,
    valor_estimado: formulario.gera_titulo ? lerValor(formulario.valor_estimado) : null,
    situacao: formulario.situacao,
  };
  const salva = id ? await repositorios.obrigacao_corporativa.atualizar(id, dados) : await repositorios.obrigacao_corporativa.criar(dados);
  if (salva.situacao === 'ativa') await gerarOcorrenciasDasObrigacoes(hoje);
  else await sincronizarAlertasDasObrigacoes();
  return salva;
}

// ---------- Ocorrências: idempotentes por (obrigação, referência) ----------

export const chaveDoTitulo = (obrigacaoId: string, referencia: string) => `obrigacao_corporativa:${obrigacaoId}:${referencia}`;

/** Título previsto (T06.08). Sem valor estimado não há o que prever: `titulo.valor` é obrigatório, e o título é lançado quando chegar a guia. */
async function tituloDaOcorrencia(obrigacao: Obrigacao, ocorrencia: ObrigacaoOcorrencia): Promise<string | null> {
  if (!obrigacao.gera_titulo || !obrigacao.categoria_id || obrigacao.valor_estimado === null) return null;
  const chave = chaveDoTitulo(obrigacao.id, ocorrencia.referencia);
  const [existente] = await repositorios.titulo.listar({ onde: { chave_idempotencia: chave }, incluirArquivados: true });
  if (existente) return existente.id;
  const titulo = await repositorios.titulo.criar({
    natureza: 'pagar',
    descricao: obrigacao.nome,
    contraparte_id: null,
    beneficiario_pessoa_id: null,
    categoria_id: obrigacao.categoria_id,
    competencia: `${ocorrencia.vencimento.slice(0, 7)}-01`,
    vencimento: ocorrencia.vencimento,
    valor: obrigacao.valor_estimado,
    moeda: 'BRL',
    situacao: 'previsto',
    responsavel_id: obrigacao.responsavel_id,
    entidade_id: obrigacao.entidade_id,
    origem: 'obrigacao_corporativa',
    origem_id: ocorrencia.id,
    chave_idempotencia: chave,
    ajustado_manualmente: false,
    ferramenta_id: null,
    assinatura_id: null,
    periodo_inicio: null,
    periodo_fim: null,
    suspenso: false,
    cancelado_motivo: null,
    observacao: 'Valor estimado. Só conta como pago com a baixa em Financeiro.',
  });
  await repositorios.titulo_rateio.criar({ titulo_id: titulo.id, produto_id: null, percentual: 100, valor: obrigacao.valor_estimado });
  return titulo.id;
}

async function criarOcorrencia(obrigacao: Obrigacao, vencimento: string): Promise<ObrigacaoOcorrencia> {
  const ocorrencia = await repositorios.obrigacao_corporativa_ocorrencia.criar({ obrigacao_id: obrigacao.id, referencia: vencimento, vencimento, cumprida_em: null, comprovante_url: null, titulo_id: null, atividade_id: null, observacao: null });
  const tituloId = await tituloDaOcorrencia(obrigacao, ocorrencia);
  return tituloId ? repositorios.obrigacao_corporativa_ocorrencia.atualizar(ocorrencia.id, { titulo_id: tituloId }) : ocorrencia;
}

/**
 * RN-06.12: a rotina do dia. Gera o que já entrou na janela de antecedência e não existe. Só com a F1 ativa, a obrigação
 * Ativa e a entidade Ativa. Rodar de novo não duplica ocorrência, alerta nem título (RT-09).
 */
export async function gerarOcorrenciasDasObrigacoes(hoje: string = hojeISO()): Promise<number> {
  const { fase_ativa } = await repositorios.configuracao.ler();
  if (!faseLiberada('f1', fase_ativa)) return 0;
  const [obrigacoes, ocorrencias, entidades] = await Promise.all([repositorios.obrigacao_corporativa.listar({ onde: { situacao: 'ativa' } }), repositorios.obrigacao_corporativa_ocorrencia.listar({ incluirArquivados: true }), repositorios.entidade.listar()]);
  let novas = 0;
  await comoSistema(() =>
    emTransacao(async () => {
      for (const obrigacao of obrigacoes) {
        if (entidades.find((entidade) => entidade.id === obrigacao.entidade_id)?.situacao !== 'ativa') continue;
        const usadas = new Set(ocorrencias.filter((ocorrencia) => ocorrencia.obrigacao_id === obrigacao.id).map((ocorrencia) => ocorrencia.referencia));
        for (const vencimento of vencimentosAte(obrigacao, somarDias(hoje, obrigacao.antecedencia_dias))) {
          if (usadas.has(vencimento)) continue;
          await criarOcorrencia(obrigacao, vencimento);
          novas += 1;
        }
      }
    }),
  );
  await sincronizarAlertasDasObrigacoes();
  return novas;
}

/** "Outra" não se repete sozinha: quem cuida informa o próximo vencimento. A mesma data não entra duas vezes. */
export async function adicionarOcorrencia(obrigacaoId: string, vencimento: string): Promise<ObrigacaoOcorrencia> {
  if (!vencimento) throw new ErroDeRegra('Informe o vencimento.');
  const obrigacao = await repositorios.obrigacao_corporativa.obter(obrigacaoId);
  if (obrigacao?.situacao !== 'ativa') throw new ErroDeRegra('Só uma obrigação Ativa gera ocorrências.');
  const existentes = await repositorios.obrigacao_corporativa_ocorrencia.listar({ onde: { obrigacao_id: obrigacaoId, referencia: vencimento } });
  if (existentes.length) throw new ErroDeRegra('Já existe uma ocorrência com esse vencimento.');
  const ocorrencia = await emTransacao(() => criarOcorrencia(obrigacao, vencimento));
  await sincronizarAlertasDasObrigacoes();
  return ocorrencia;
}

// ---------- Cumprimento ----------

export type FormularioCumprimento = { cumprida_em: string; comprovante_url: string; titulo_id: string; observacao: string };

export const formularioCumprimentoVazio = (ocorrencia: Pick<ObrigacaoOcorrencia, 'titulo_id'>, hoje: string = hojeISO()): FormularioCumprimento => ({ cumprida_em: hoje, comprovante_url: '', titulo_id: ocorrencia.titulo_id ?? '', observacao: '' });

export function errosDoCumprimento(formulario: FormularioCumprimento, hoje: string = hojeISO()): Record<string, string> {
  const erros: Record<string, string> = {};
  if (!formulario.cumprida_em) erros.cumprida_em = 'Informe a data do cumprimento.';
  else if (formulario.cumprida_em > hoje) erros.cumprida_em = 'Use hoje ou uma data passada.';
  if (!formulario.comprovante_url.trim()) erros.comprovante_url = 'Cumprir exige o comprovante: cole o link do Drive.';
  else if (!linkDoDriveValido(formulario.comprovante_url)) erros.comprovante_url = MENSAGEM_LINK_DRIVE;
  return erros;
}

/** Títulos que podem ser vinculados: a pagar e não cancelados. Quem diz se foi pago é a baixa no M05. */
export const titulosParaOcorrencia = (titulos: readonly Titulo[]) => titulos.filter((titulo) => titulo.natureza === 'pagar' && titulo.situacao !== 'cancelado');

/** Registra o cumprimento, e o alerta se resolve. O título não muda: vincular não é pagar. */
export async function registrarCumprimento(id: string, formulario: FormularioCumprimento, hoje: string = hojeISO()): Promise<void> {
  const erro = Object.values(errosDoCumprimento(formulario, hoje))[0];
  if (erro) throw new ErroDeRegra(erro);
  const ocorrencia = await repositorios.obrigacao_corporativa_ocorrencia.obter(id);
  if (!ocorrencia) throw new ErroDeRegra('Esta ocorrência não existe mais.');
  if (ocorrencia.cumprida_em) throw new ErroDeRegra('Esta ocorrência já foi cumprida.');
  await repositorios.obrigacao_corporativa_ocorrencia.atualizar(id, { cumprida_em: formulario.cumprida_em, comprovante_url: formulario.comprovante_url.trim(), titulo_id: formulario.titulo_id || null, observacao: formulario.observacao.trim() || null });
  await sincronizarAlertasDasObrigacoes();
}

export async function reabrirOcorrencia(id: string, motivo: string): Promise<void> {
  if (!motivo.trim()) throw new ErroDeRegra('Informe o motivo para reabrir.');
  await repositorios.obrigacao_corporativa_ocorrencia.atualizar(id, { cumprida_em: null, comprovante_url: null }, { motivo: motivo.trim() });
  await sincronizarAlertasDasObrigacoes();
}

/** O alerta aberto de uma ocorrência: é o que aparece no Meu dia. */
export const alertaDaOcorrencia = (ocorrenciaId: string, alertas: readonly Atividade[]) => alertas.find((alerta) => alerta.origem_id === ocorrenciaId) ?? null;
