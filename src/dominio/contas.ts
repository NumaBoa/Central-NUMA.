/** Regras de T02.08 (04-M02): contas financeiras. Saldos e baixas entram com T05. */
import { z } from 'zod';
import { ErroDeRegra } from '@/dados/erros';
import { repositorios } from '@/dados/repositorios';
import type { Entidade } from '@/dados/tipos/contraparte';
import type { ContaFinanceira } from '@/dados/tipos/financeiro';
import type { Pessoa } from '@/dados/tipos/pessoa';
import { lerValor, valorParaCampo } from './dinheiro';
import { normalizarTexto } from './duplicidade';
import { entidadesParaVincular, nomeDaEntidade } from './entidades';
import { vinculosDeFerramentaDaConta } from './ferramentas';
import { pessoasDoSeletor } from './pessoa-atual';
import { AVISO_CREDENCIAL, pareceCredencial } from './segredos';

type TipoConta = ContaFinanceira['tipo'];

export const ROTULOS_TIPO_CONTA = { banco: 'Conta bancária', cartao: 'Cartão de crédito', carteira: 'Carteira digital', pessoal_socia: 'Conta pessoal de sócia', caixa: 'Caixa' } as const;
export const ROTULOS_SITUACAO_CONTA = { ativa: 'Ativa', encerrada: 'Encerrada' } as const;

/** Só contas bancárias e caixa têm saldo controlado; cartões e contas pessoais, não (T02.08). */
export function controlaSaldo(tipo: TipoConta): boolean {
  return tipo === 'banco' || tipo === 'caixa';
}

/** RT-14: nunca o número completo. Entre 13 e 19 dígitos seguidos é o tamanho de um número de cartão. */
export function temNumeroCompleto(texto: string): boolean {
  return /(?:\d[ .-]?){13,19}/.test(texto);
}

const ERRO_NUMERO_COMPLETO = 'Não guarde o número completo: use só os 4 últimos dígitos, no campo Final.';

export const esquemaFormularioConta = z
  .object({
    nome: z.string().trim().min(1, 'Informe o nome.'),
    tipo: z.enum(['banco', 'cartao', 'carteira', 'pessoal_socia', 'caixa']),
    /** `pessoa:<id>` ou `entidade:<id>`: a tela escolhe um só titular. */
    titular: z.string(),
    instituicao: z.string().trim(),
    final_numero: z.string().trim(),
    moeda: z.string().regex(/^[A-Z]{3}$/, 'Escolha a moeda.'),
    saldo_inicial: z.string().trim(),
    data_saldo_inicial: z.string(),
    situacao: z.enum(['ativa', 'encerrada']),
    motivo: z.string().trim(),
  })
  .superRefine((dados, contexto) => {
    const falha = (campo: string, message: string) => contexto.addIssue({ code: 'custom', path: [campo], message });
    const pessoal = dados.tipo === 'pessoal_socia';
    if (!dados.titular) falha('titular', pessoal ? 'Escolha a sócia.' : 'Escolha o titular.');
    else if (pessoal && !dados.titular.startsWith('pessoa:')) falha('titular', 'Conta pessoal é de uma sócia.');
    if (temNumeroCompleto(dados.nome)) falha('nome', ERRO_NUMERO_COMPLETO);
    if (temNumeroCompleto(dados.instituicao)) falha('instituicao', ERRO_NUMERO_COMPLETO);
    if (dados.final_numero && !/^\d{4}$/.test(dados.final_numero)) falha('final_numero', 'Use os 4 últimos dígitos.');
    if (controlaSaldo(dados.tipo)) {
      if (!dados.saldo_inicial) falha('saldo_inicial', 'Informe o saldo inicial.');
      else if (lerValor(dados.saldo_inicial) === null) falha('saldo_inicial', 'Use só números, como 1.234,56.');
      if (!dados.data_saldo_inicial) falha('data_saldo_inicial', 'Informe a data do saldo.');
    }
  });

export type FormularioConta = z.infer<typeof esquemaFormularioConta>;

export function formularioContaVazio(moeda: string): FormularioConta {
  return { nome: '', tipo: 'banco', titular: '', instituicao: '', final_numero: '', moeda, saldo_inicial: '', data_saldo_inicial: '', situacao: 'ativa', motivo: '' };
}

const titularDaConta = (conta: Pick<ContaFinanceira, 'titular_entidade_id' | 'titular_pessoa_id'>) => (conta.titular_pessoa_id ? `pessoa:${conta.titular_pessoa_id}` : `entidade:${conta.titular_entidade_id}`);

// ---------- Titular ----------

/** Pessoa sócia, interna e ativa. */
export function sociasParaConta(pessoas: readonly Pessoa[]): Pessoa[] {
  return pessoasDoSeletor(pessoas).filter((pessoa) => pessoa.eh_socia);
}

export type DadosContas = {
  contas: ContaFinanceira[];
  pessoas: Pessoa[];
  entidades: Entidade[];
  moedaPadrao: string;
};

type DadosDoTitular = Pick<DadosContas, 'pessoas' | 'entidades'>;

/** Conta pessoal só tem sócia; as demais, entidade ou sócia. */
export function opcoesDeTitular(tipo: TipoConta, { pessoas, entidades }: DadosDoTitular) {
  return { socias: sociasParaConta(pessoas), entidades: tipo === 'pessoal_socia' ? [] : entidadesParaVincular(entidades) };
}

export function titularDisponivel(conta: Pick<ContaFinanceira, 'tipo' | 'titular_entidade_id' | 'titular_pessoa_id'>, dados: DadosDoTitular): boolean {
  const { socias, entidades } = opcoesDeTitular(conta.tipo, dados);
  return conta.titular_pessoa_id ? socias.some((pessoa) => pessoa.id === conta.titular_pessoa_id) : entidades.some((entidade) => entidade.id === conta.titular_entidade_id);
}

export function nomeDoTitular(conta: Pick<ContaFinanceira, 'titular_entidade_id' | 'titular_pessoa_id'>, { pessoas, entidades }: DadosDoTitular): string {
  if (conta.titular_pessoa_id) return pessoas.find((pessoa) => pessoa.id === conta.titular_pessoa_id)?.nome_completo ?? 'Pessoa removida';
  const entidade = entidades.find((item) => item.id === conta.titular_entidade_id);
  return entidade ? nomeDaEntidade(entidade) : 'Entidade removida';
}

// ---------- Conversão ----------

/** Titular que saiu da lista fica vazio: a tela avisa e pede outro, sem trocar sozinha. */
export function formularioDaConta(conta: ContaFinanceira, dados: DadosDoTitular): FormularioConta {
  return {
    nome: conta.nome,
    tipo: conta.tipo,
    titular: titularDisponivel(conta, dados) ? titularDaConta(conta) : '',
    instituicao: conta.instituicao ?? '',
    final_numero: conta.final_numero ?? '',
    moeda: conta.moeda,
    saldo_inicial: conta.saldo_inicial === null ? '' : valorParaCampo(conta.saldo_inicial),
    data_saldo_inicial: conta.data_saldo_inicial ?? '',
    situacao: conta.situacao,
    motivo: '',
  };
}

export function dadosDaConta(formulario: FormularioConta) {
  const [lado, id = null] = formulario.titular.split(':');
  const comSaldo = controlaSaldo(formulario.tipo);
  return {
    nome: formulario.nome,
    tipo: formulario.tipo,
    titular_entidade_id: lado === 'entidade' ? id : null,
    titular_pessoa_id: lado === 'pessoa' ? id : null,
    instituicao: formulario.instituicao || null,
    final_numero: formulario.final_numero || null,
    moeda: formulario.moeda,
    saldo_inicial: comSaldo ? lerValor(formulario.saldo_inicial) : null,
    data_saldo_inicial: comSaldo ? formulario.data_saldo_inicial || null : null,
    situacao: formulario.situacao,
  };
}

// ---------- Encerrar ----------

/** Por enquanto o saldo é o inicial: a T05.07 acrescenta o que entrou e saiu. Sem saldo controlado, conta como zero. */
function saldoDoFormulario(formulario: FormularioConta): number {
  return controlaSaldo(formulario.tipo) ? (lerValor(formulario.saldo_inicial) ?? 0) : 0;
}

/** T02.08: encerrar exige saldo zero ou motivo. */
export function exigeMotivoParaEncerrar(formulario: FormularioConta, conta?: ContaFinanceira | null): boolean {
  return formulario.situacao === 'encerrada' && conta?.situacao !== 'encerrada' && saldoDoFormulario(formulario) !== 0;
}

// ---------- Conferência e gravação ----------

export function conferirDadosDaConta(formulario: FormularioConta, contas: readonly ContaFinanceira[], idAtual?: string): readonly string[] {
  const nome = normalizarTexto(formulario.nome);
  const avisos: string[] = [];
  if (contas.some((conta) => conta.id !== idAtual && normalizarTexto(conta.nome) === nome)) avisos.push(`Já existe uma conta chamada ${formulario.nome}.`);
  if ([formulario.nome, formulario.instituicao, formulario.motivo].some(pareceCredencial)) avisos.push(AVISO_CREDENCIAL);
  return avisos;
}

export async function conferirConta(formulario: FormularioConta, idAtual?: string): Promise<readonly string[]> {
  return conferirDadosDaConta(formulario, await repositorios.conta_financeira.listar({ incluirArquivados: true }), idAtual);
}

export async function salvarConta(formulario: FormularioConta, id?: string): Promise<ContaFinanceira> {
  const dados = dadosDaConta(formulario);
  if (dados.titular_pessoa_id) {
    const pessoa = await repositorios.pessoa.obter(dados.titular_pessoa_id);
    if (!pessoa?.eh_socia) throw new ErroDeRegra('O titular precisa ser uma sócia ou uma entidade.');
  }
  if (!id) return repositorios.conta_financeira.criar(dados);
  const atual = await repositorios.conta_financeira.obter(id);
  const exige = exigeMotivoParaEncerrar(formulario, atual);
  if (exige && !formulario.motivo) throw new ErroDeRegra('Informe o motivo para encerrar uma conta com saldo.');
  return repositorios.conta_financeira.atualizar(id, dados, exige ? { motivo: formulario.motivo } : undefined);
}

export async function arquivarConta(id: string): Promise<void> {
  const vinculos = await vinculosDeFerramentaDaConta(id);
  if (vinculos.length) throw new ErroDeRegra(`Esta conta está em uso: ${vinculos.join(', ')}. Troque a conta antes.`);
  await repositorios.conta_financeira.arquivar(id);
}

export async function restaurarConta(id: string): Promise<void> {
  await repositorios.conta_financeira.restaurar(id);
}

// ---------- Lista ----------

export type FiltrosContas = {
  busca: string;
  tipo: 'todos' | TipoConta;
  situacao: 'todas' | ContaFinanceira['situacao'];
  arquivadas: boolean;
};

export const FILTROS_CONTAS_INICIAIS: FiltrosContas = { busca: '', tipo: 'todos', situacao: 'todas', arquivadas: false };

/** Busca por nome, instituição, final e titular. */
export function filtrarContas(contas: readonly ContaFinanceira[], { busca, tipo, situacao, arquivadas }: FiltrosContas, dados: DadosDoTitular): ContaFinanceira[] {
  const texto = normalizarTexto(busca);
  return contas
    .filter((conta) => Boolean(conta.arquivado_em) === arquivadas)
    .filter((conta) => tipo === 'todos' || conta.tipo === tipo)
    .filter((conta) => situacao === 'todas' || conta.situacao === situacao)
    .filter((conta) => !texto || normalizarTexto(`${conta.nome} ${conta.instituicao ?? ''} ${conta.final_numero ?? ''} ${nomeDoTitular(conta, dados)}`).includes(texto))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export async function carregarContas(): Promise<DadosContas> {
  const [contas, pessoas, entidades, configuracoes] = await Promise.all([repositorios.conta_financeira.listar({ incluirArquivados: true }), repositorios.pessoa.listar({ incluirArquivados: true }), repositorios.entidade.listar({ incluirArquivados: true }), repositorios.configuracao.ler()]);
  return { contas, pessoas, entidades, moedaPadrao: configuracoes.moeda_padrao };
}
