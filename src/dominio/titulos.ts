/**
 * Regras de T05.01 a T05.04 (07-M05): títulos, rateio, baixas e o que uma baixa com conta de sócia cria.
 * A F1 acrescenta receitas, fechamento de competência e contratos.
 */
import { z } from 'zod';
import { ErroDeRegra } from '@/dados/erros';
import { repositorios } from '@/dados/repositorios';
import { idDaPessoaAtual } from '@/dados/sessao';
import { emTransacao } from '@/dados/transacao';
import type { AssinaturaFerramenta, Ferramenta, FerramentaContexto } from '@/dados/tipos/ferramenta';
import type { CategoriaFinanceira, ContaFinanceira } from '@/dados/tipos/financeiro';
import type { Baixa, Titulo, TituloRateio } from '@/dados/tipos/titulo';
import { hojeISO } from '@/lib/datas';
import { cobrancasPrevistas } from './cobrancas';
import { ID_INSTITUCIONAL } from './contextos';
import { lerCambio, lerValor, valorParaCampo } from './dinheiro';
import { linkDoDriveValido, MENSAGEM_LINK_DRIVE } from './link-drive';
import { AVISO_CREDENCIAL, pareceCredencial } from './segredos';

export const ROTULOS_NATUREZA_TITULO = { pagar: 'A pagar', receber: 'A receber' } as const;
export const ROTULOS_SITUACAO_TITULO: Readonly<Record<Titulo['situacao'], string>> = { previsto: 'Previsto', aberto: 'Em aberto', parcial: 'Parcial', quitado: 'Quitado', cancelado: 'Cancelado' };
export const ROTULOS_ORIGEM_TITULO: Readonly<Record<Titulo['origem'], string>> = { manual: 'Manual', assinatura: 'Assinatura', contrato: 'Contrato', reembolso: 'Reembolso', canal: 'Canal', repasse: 'Repasse', obrigacao_corporativa: 'Obrigação', ajuste: 'Ajuste' };
export const ROTULOS_TIPO_BAIXA: Readonly<Record<Baixa['tipo'], string>> = { pagamento: 'Pagamento', estorno: 'Estorno', ajuste: 'Ajuste' };
export const ROTULOS_TRATAMENTO = { aporte: 'Aporte', reembolso: 'Reembolso' } as const;

export const CATEGORIA_REEMBOLSO = 'Reembolso de despesas';
export const CATEGORIA_JUROS = 'Juros e multas';

const arredondar = (valor: number) => Math.round((valor + Number.EPSILON) * 100) / 100;

// ---------- Saldo e situação (RN-05.02) ----------

/** Na moeda do título. Ajuste (juros, multa) sai do caixa, mas não mexe no saldo. */
export function saldoDoTitulo(titulo: Pick<Titulo, 'valor' | 'situacao'>, baixas: readonly Pick<Baixa, 'tipo' | 'valor_moeda' | 'arquivado_em'>[]): number {
  if (titulo.situacao === 'cancelado') return 0;
  const movimento = baixas.filter((baixa) => !baixa.arquivado_em).reduce((total, baixa) => total + (baixa.tipo === 'pagamento' ? baixa.valor_moeda : baixa.tipo === 'estorno' ? -baixa.valor_moeda : 0), 0);
  return arredondar(titulo.valor - movimento);
}

/** Previsto continua previsto até alguém confirmar ou pagar. Estornar tudo volta para em aberto. */
export function situacaoPelasBaixas(titulo: Pick<Titulo, 'valor' | 'situacao'>, baixas: readonly Pick<Baixa, 'tipo' | 'valor_moeda' | 'arquivado_em'>[]): Titulo['situacao'] {
  if (titulo.situacao === 'cancelado') return 'cancelado';
  const saldo = saldoDoTitulo(titulo, baixas);
  if (saldo <= 0) return 'quitado';
  if (saldo < titulo.valor) return 'parcial';
  return titulo.situacao === 'previsto' && !baixas.some((baixa) => !baixa.arquivado_em) ? 'previsto' : 'aberto';
}

/** Derivado: em aberto ou parcial, com vencimento antes de hoje (M05 §2). */
export function estaVencido(titulo: Pick<Titulo, 'situacao' | 'vencimento'>, hoje: string): boolean {
  return (titulo.situacao === 'aberto' || titulo.situacao === 'parcial') && titulo.vencimento < hoje;
}

async function atualizarSituacao(tituloId: string): Promise<void> {
  const [titulo, baixas] = await Promise.all([repositorios.titulo.obter(tituloId), repositorios.baixa.listar({ onde: { titulo_id: tituloId } })]);
  if (!titulo) return;
  const situacao = situacaoPelasBaixas(titulo, baixas);
  if (situacao !== titulo.situacao) await repositorios.titulo.atualizar(tituloId, { situacao });
}

/** Quem responde por um título em aberto não sai sem passar a responsabilidade (RN-02.02). */
export async function vinculosDeTituloDaPessoa(id: string): Promise<string[]> {
  const titulos = await repositorios.titulo.listar({ onde: { responsavel_id: id } });
  const abertos = titulos.filter((titulo) => titulo.situacao === 'previsto' || titulo.situacao === 'aberto' || titulo.situacao === 'parcial').length;
  return abertos ? [abertos === 1 ? 'Responsável por 1 lançamento em aberto' : `Responsável por ${abertos} lançamentos em aberto`] : [];
}

/** T02.06, ficha da contraparte. */
export async function titulosDaContraparte(id: string): Promise<Titulo[]> {
  return (await repositorios.titulo.listar({ onde: { contraparte_id: id } })).sort((a, b) => b.vencimento.localeCompare(a.vencimento));
}

// ---------- Competência ----------

export const competenciaDoDia = (dia: string) => `${dia.slice(0, 7)}-01`;
export const mesDaCompetencia = (competencia: string) => competencia.slice(0, 7);

const NOMES_DOS_MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export function rotuloDaCompetencia(competencia: string): string {
  const [ano, mes] = competencia.split('-');
  return `${NOMES_DOS_MESES[Number(mes) - 1]}/${ano}`;
}

// ---------- Rateio (RN-05.08) ----------

export type LinhaRateio = { contexto: string; percentual: string };

/** Partes iguais, com 2 casas; a última fica com o que sobra para fechar 100%. */
export function rateioEmPartesIguais(contextos: readonly string[]): LinhaRateio[] {
  if (!contextos.length) return [];
  const parte = Math.floor(10000 / contextos.length) / 100;
  return contextos.map((contexto, indice) => ({ contexto, percentual: (indice === contextos.length - 1 ? arredondar(100 - parte * (contextos.length - 1)) : parte).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) }));
}

export function erroDoRateioDoTitulo(linhas: readonly Pick<LinhaRateio, 'percentual'>[]): string | null {
  if (linhas.length <= 1) return null;
  const valores = linhas.map((linha) => lerValor(linha.percentual));
  if (valores.some((valor) => valor === null || valor <= 0 || valor > 100)) return 'Use percentuais de 0 a 100.';
  const soma = valores.reduce<number>((total, valor) => total + (valor ?? 0), 0);
  return Math.abs(soma - 100) < 0.0001 ? null : `A soma precisa dar 100%. Está em ${String(arredondar(soma)).replace('.', ',')}%.`;
}

/** Em valor: cada um pelo percentual, e o último fecha o total (RN-05.08). */
export function valoresDoRateio(valor: number, percentuais: readonly number[]): number[] {
  let somado = 0;
  return percentuais.map((percentual, indice) => {
    const parte = indice === percentuais.length - 1 ? arredondar(valor - somado) : arredondar((valor * percentual) / 100);
    somado = arredondar(somado + parte);
    return parte;
  });
}

/** O valor mudou: os percentuais ficam, e os valores acompanham. */
export async function recalcularRateio(tituloId: string, valor: number): Promise<void> {
  const linhas = await repositorios.titulo_rateio.listar({ onde: { titulo_id: tituloId } });
  const valores = valoresDoRateio(
    valor,
    linhas.map((linha) => linha.percentual),
  );
  for (const [indice, linha] of linhas.entries()) await repositorios.titulo_rateio.atualizar(linha.id, { valor: valores[indice] as number });
}

const paraProduto = (contexto: string) => (contexto === ID_INSTITUCIONAL ? null : contexto);

async function gravarRateio(tituloId: string, valor: number, linhas: readonly { contexto: string; percentual: number }[]): Promise<void> {
  const valores = valoresDoRateio(
    valor,
    linhas.map((linha) => linha.percentual),
  );
  for (const [indice, linha] of linhas.entries()) await repositorios.titulo_rateio.criar({ titulo_id: tituloId, produto_id: paraProduto(linha.contexto), percentual: linha.percentual, valor: valores[indice] as number });
}

// ---------- Baixa (RN-05.03, RN-05.05, RN-05.06 e RN-05.12) ----------

export type DadosDoPagamento = {
  data: string;
  contaId: string;
  valorMoeda: number;
  /** Só em moeda estrangeira. */
  cambio: number | null;
  iofBrl: number | null;
  /** Calculado e editável, para casar com a fatura. Em reais, é o próprio valor. */
  valorBrl: number;
  comprovanteUrl: string | null;
  semComprovanteMotivo: string | null;
  /** Obrigatório em conta pessoal de sócia. */
  tratamento: Baixa['tratamento'];
  vencimentoReembolso: string | null;
  /** Pago a mais: a diferença vira ajuste, em "Juros e multas" (RN-05.03). */
  pagoAMais: boolean;
  motivo: string | null;
};

/** USD × câmbio + IOF (RN-05.05). */
export function valorEmReais(valorMoeda: number, cambio: number, iof: number | null): number {
  return arredondar(valorMoeda * cambio + (iof ?? 0));
}

async function categoriaPeloNome(nome: string): Promise<CategoriaFinanceira> {
  const categoria = (await repositorios.categoria_financeira.listar()).find((item) => item.nome === nome);
  if (!categoria) throw new ErroDeRegra(`A categoria “${nome}” não está mais disponível. Restaure em Configurações.`);
  return categoria;
}

async function criarTratamento(titulo: Titulo, baixa: Baixa, conta: ContaFinanceira, tratamento: NonNullable<Baixa['tratamento']>, vencimentoReembolso: string | null): Promise<Partial<Baixa>> {
  const socia = conta.titular_pessoa_id as string;
  if (tratamento === 'aporte') {
    const movimento = await repositorios.movimento_societario.criar({ tipo: 'aporte', socia_id: socia, data: baixa.data, valor_brl: baixa.valor_brl, forma: 'pagamento_despesa', titulo_origem_id: titulo.id, baixa_origem_id: baixa.id, conta_financeira_id: conta.id, comprovante_url: baixa.comprovante_url, observacao: null });
    return { movimento_societario_id: movimento.id };
  }
  if (!vencimentoReembolso) throw new ErroDeRegra('Informe o vencimento do reembolso.');
  const categoria = await categoriaPeloNome(CATEGORIA_REEMBOLSO);
  const reembolso = await repositorios.titulo.criar({
    natureza: 'pagar',
    descricao: `Reembolso: ${titulo.descricao}`,
    contraparte_id: null,
    beneficiario_pessoa_id: socia,
    categoria_id: categoria.id,
    competencia: titulo.competencia,
    vencimento: vencimentoReembolso,
    valor: baixa.valor_brl,
    moeda: 'BRL',
    situacao: 'aberto',
    responsavel_id: titulo.responsavel_id,
    entidade_id: titulo.entidade_id,
    origem: 'reembolso',
    origem_id: titulo.id,
    chave_idempotencia: `reembolso:${baixa.id}`,
    ajustado_manualmente: false,
    ferramenta_id: null,
    assinatura_id: null,
    periodo_inicio: null,
    periodo_fim: null,
    suspenso: false,
    cancelado_motivo: null,
    observacao: null,
  });
  // Os mesmos contextos da despesa, para aparecer no filtro. Custo é só a despesa original (RN-05.07).
  const rateio = await repositorios.titulo_rateio.listar({ onde: { titulo_id: titulo.id } });
  await gravarRateio(
    reembolso.id,
    reembolso.valor,
    rateio.map((linha) => ({ contexto: linha.produto_id ?? ID_INSTITUCIONAL, percentual: linha.percentual })),
  );
  return { titulo_reembolso_id: reembolso.id };
}

/** Grava a baixa e o que nasce dela, numa transação só (AR-02). */
export async function registrarPagamento(tituloId: string, dados: DadosDoPagamento, hoje: string = hojeISO()): Promise<Baixa> {
  return emTransacao(async () => {
    const titulo = await repositorios.titulo.obter(tituloId);
    if (!titulo) throw new ErroDeRegra('Este título não existe mais.');
    if (titulo.situacao === 'cancelado') throw new ErroDeRegra('Este título está cancelado.');
    if (dados.data > hoje) throw new ErroDeRegra('A data do pagamento não pode ser futura.');
    const conta = await repositorios.conta_financeira.obter(dados.contaId);
    if (!conta) throw new ErroDeRegra('Escolha a conta usada.');
    if (dados.valorMoeda <= 0) throw new ErroDeRegra('Informe o valor pago.');
    if (dados.comprovanteUrl && !linkDoDriveValido(dados.comprovanteUrl)) throw new ErroDeRegra(MENSAGEM_LINK_DRIVE);
    if (!dados.comprovanteUrl && !dados.semComprovanteMotivo?.trim()) throw new ErroDeRegra('Informe o comprovante ou o motivo de não ter (RN-05.12).');
    const deSocia = conta.tipo === 'pessoal_socia';
    if (deSocia && titulo.origem === 'reembolso') throw new ErroDeRegra('O reembolso é pago pela Numa: escolha uma conta da empresa.');
    if (deSocia && !dados.tratamento) throw new ErroDeRegra('Conta de sócia: escolha entre aporte e reembolso (RN-05.06).');
    const baixasAtuais = await repositorios.baixa.listar({ onde: { titulo_id: tituloId } });
    const saldo = saldoDoTitulo(titulo, baixasAtuais);
    const excedente = arredondar(dados.valorMoeda - saldo);
    if (excedente > 0 && !dados.pagoAMais) throw new ErroDeRegra(`O saldo é menor que o valor. Se pagou a mais, marque “Valor pago maior”.`);
    const valorDaBaixa = excedente > 0 ? saldo : dados.valorMoeda;
    if (valorDaBaixa <= 0) throw new ErroDeRegra('Este título não tem saldo.');
    const proporcao = valorDaBaixa / dados.valorMoeda;
    const comum = {
      titulo_id: tituloId,
      data: dados.data,
      conta_financeira_id: dados.contaId,
      cambio: dados.cambio,
      comprovante_url: dados.comprovanteUrl,
      sem_comprovante_motivo: dados.comprovanteUrl ? null : (dados.semComprovanteMotivo?.trim() ?? null),
      registrado_por: idDaPessoaAtual(),
    };
    const baixa = await repositorios.baixa.criar({
      ...comum,
      tipo: 'pagamento',
      baixa_original_id: null,
      valor_moeda: valorDaBaixa,
      iof_brl: dados.iofBrl,
      valor_brl: arredondar(dados.valorBrl * proporcao),
      tratamento: dados.tratamento,
      movimento_societario_id: null,
      titulo_reembolso_id: null,
      motivo: dados.motivo?.trim() || null,
    });
    if (excedente > 0) {
      await categoriaPeloNome(CATEGORIA_JUROS);
      await repositorios.baixa.criar({ ...comum, tipo: 'ajuste', baixa_original_id: baixa.id, valor_moeda: excedente, iof_brl: null, valor_brl: arredondar(dados.valorBrl - baixa.valor_brl), tratamento: null, movimento_societario_id: null, titulo_reembolso_id: null, motivo: CATEGORIA_JUROS });
    }
    const ligacoes = dados.tratamento && deSocia ? await criarTratamento(titulo, baixa, conta, dados.tratamento, dados.vencimentoReembolso) : {};
    const salva = Object.keys(ligacoes).length ? await repositorios.baixa.atualizar(baixa.id, ligacoes) : baixa;
    await atualizarSituacao(tituloId);
    return salva;
  });
}

/**
 * RN-05.06: desfaz o aporte ou o reembolso que nasceu da baixa e, se houver outro tratamento, cria.
 * Reembolso que já recebeu pagamento segura: é preciso estornar esse pagamento antes.
 */
export async function refazerTratamento(baixa: Baixa, novo: Baixa['tratamento'], vencimentoReembolso: string | null, motivo: string): Promise<Baixa> {
  if (baixa.titulo_reembolso_id) {
    const reembolso = await repositorios.titulo.obter(baixa.titulo_reembolso_id);
    if (reembolso && reembolso.situacao !== 'cancelado') {
      if (saldoDoTitulo(reembolso, await repositorios.baixa.listar({ onde: { titulo_id: reembolso.id } })) !== reembolso.valor) throw new ErroDeRegra('O reembolso já foi pago: estorne o pagamento dele antes.');
      await repositorios.titulo.atualizar(reembolso.id, { situacao: 'cancelado', cancelado_motivo: motivo, ajustado_manualmente: true }, { motivo });
    }
  }
  if (baixa.movimento_societario_id) await repositorios.movimento_societario.arquivar(baixa.movimento_societario_id, motivo);
  const limpa = { tratamento: novo, movimento_societario_id: null, titulo_reembolso_id: null };
  if (!novo) {
    // O estorno guarda o tratamento original na baixa, para o histórico continuar dizendo o que houve.
    return baixa;
  }
  const [titulo, conta] = await Promise.all([repositorios.titulo.obter(baixa.titulo_id), repositorios.conta_financeira.obter(baixa.conta_financeira_id)]);
  if (!titulo || !conta) throw new ErroDeRegra('O título ou a conta desta baixa não existe mais.');
  const ligacoes = await criarTratamento(titulo, baixa, conta, novo, vencimentoReembolso);
  return repositorios.baixa.atualizar(baixa.id, { ...limpa, ...ligacoes }, { motivo });
}

// ---------- Nova despesa (T05.02) ----------

const textoCurto = z.string().trim();

export const esquemaBaseDespesa = z.object({
  descricao: z.string().trim().min(1, 'Diga o que foi essa despesa.'),
  contraparte_id: z.string(),
  valor: textoCurto,
  moeda: z.string(),
  pago: z.boolean(),
  vencimento: z.string(),
  competencia: z.string().min(1, 'Informe a competência.'),
  categoria_id: z.string().min(1, 'Escolha a categoria.'),
  contextos: z.array(z.string()).min(1, 'Escolha a Numa ou um produto.'),
  percentuais: z.record(z.string(), z.string()),
  ferramenta_id: z.string(),
  assinatura_id: z.string(),
  data_pagamento: z.string(),
  conta_id: z.string(),
  cambio: textoCurto,
  iof: textoCurto,
  valor_brl: textoCurto,
  tratamento: z.enum(['', 'aporte', 'reembolso']),
  vencimento_reembolso: z.string(),
  comprovante_url: textoCurto,
  sem_comprovante: z.boolean(),
  sem_comprovante_motivo: textoCurto,
  observacao: textoCurto,
});

export type FormularioDespesa = z.infer<typeof esquemaBaseDespesa>;

const numeroPositivo = (texto: string) => {
  const valor = lerValor(texto);
  return valor !== null && valor > 0;
};

/** O tratamento depende do tipo da conta: o esquema nasce com as contas da tela. */
export function criarEsquemaDespesa(contas: readonly Pick<ContaFinanceira, 'id' | 'tipo'>[], hoje: string = hojeISO()) {
  return esquemaBaseDespesa.superRefine((dados, contexto) => {
    const falha = (campo: keyof FormularioDespesa, message: string) => contexto.addIssue({ code: 'custom', path: [campo], message });
    if (!numeroPositivo(dados.valor)) falha('valor', 'Informe o valor, como 0,00.');
    if (dados.contextos.length > 1) {
      const erro = erroDoRateioDoTitulo(dados.contextos.map((id) => ({ percentual: dados.percentuais[id] ?? '' })));
      if (erro) falha('percentuais', erro);
    }
    if (!dados.pago) {
      if (!dados.vencimento) falha('vencimento', 'Informe o vencimento.');
      return;
    }
    if (!dados.data_pagamento) falha('data_pagamento', 'Informe a data do pagamento.');
    else if (dados.data_pagamento > hoje) falha('data_pagamento', 'A data do pagamento não pode ser futura.');
    if (!dados.conta_id) falha('conta_id', 'Escolha a conta usada.');
    if (dados.moeda !== 'BRL') {
      if (!(Number(lerCambio(dados.cambio)) > 0)) falha('cambio', 'Informe o câmbio pago.');
      if (dados.iof && lerValor(dados.iof) === null) falha('iof', 'Use só números, como 0,00.');
      if (!numeroPositivo(dados.valor_brl)) falha('valor_brl', 'Informe o valor efetivo em reais.');
    }
    if (contas.find((conta) => conta.id === dados.conta_id)?.tipo === 'pessoal_socia') {
      if (!dados.tratamento) falha('tratamento', 'Conta de sócia: escolha entre aporte e reembolso.');
      if (dados.tratamento === 'reembolso' && !dados.vencimento_reembolso) falha('vencimento_reembolso', 'Informe quando a Numa vai reembolsar.');
    }
    if (dados.sem_comprovante) {
      if (!dados.sem_comprovante_motivo) falha('sem_comprovante_motivo', 'Diga por que não tem comprovante.');
    } else if (!dados.comprovante_url) falha('comprovante_url', 'Cole o link do comprovante, ou marque que não tem.');
    else if (!linkDoDriveValido(dados.comprovante_url)) falha('comprovante_url', MENSAGEM_LINK_DRIVE);
  });
}

export function formularioDespesaVazio(contextoGlobalId: string, moeda: string, hoje: string = hojeISO()): FormularioDespesa {
  return {
    descricao: '',
    contraparte_id: '',
    valor: '',
    moeda,
    pago: true,
    vencimento: '',
    competencia: mesDaCompetencia(competenciaDoDia(hoje)),
    categoria_id: '',
    contextos: contextoGlobalId === 'consolidada' ? [] : [contextoGlobalId],
    percentuais: {},
    ferramenta_id: '',
    assinatura_id: '',
    data_pagamento: hoje,
    conta_id: '',
    cambio: '',
    iof: '',
    valor_brl: '',
    tratamento: '',
    vencimento_reembolso: '',
    comprovante_url: '',
    sem_comprovante: false,
    sem_comprovante_motivo: '',
    observacao: '',
  };
}

export type ConferenciaDespesa = { avisos: string[] };

/** RN-05.15: mesma contraparte, valor e vencimento ±3 dias só avisa. Texto que parece senha também (RT-14). */
export function conferirDespesa(formulario: FormularioDespesa, existentes: readonly Pick<Titulo, 'codigo' | 'contraparte_id' | 'valor' | 'vencimento' | 'situacao'>[]): ConferenciaDespesa {
  const avisos: string[] = [];
  const valor = lerValor(formulario.valor);
  const vencimento = formulario.pago ? formulario.vencimento || formulario.data_pagamento : formulario.vencimento;
  if (formulario.contraparte_id && valor !== null && vencimento) {
    const dia = new Date(`${vencimento}T00:00:00Z`).getTime();
    const igual = existentes.find((titulo) => titulo.situacao !== 'cancelado' && titulo.contraparte_id === formulario.contraparte_id && titulo.valor === valor && Math.abs(new Date(`${titulo.vencimento}T00:00:00Z`).getTime() - dia) <= 3 * 86400000);
    if (igual) avisos.push(`Possível duplicidade: ${igual.codigo}.`);
  }
  if ([formulario.descricao, formulario.observacao, formulario.sem_comprovante_motivo].some(pareceCredencial)) avisos.push(AVISO_CREDENCIAL);
  return { avisos };
}

/** O valor em reais do que foi pago: calculado em BRL, e informado (já calculado na tela) em outra moeda. */
function pagamentoDoFormulario(formulario: FormularioDespesa, valor: number): DadosDoPagamento {
  const estrangeira = formulario.moeda !== 'BRL';
  return {
    data: formulario.data_pagamento,
    contaId: formulario.conta_id,
    valorMoeda: valor,
    cambio: estrangeira ? lerCambio(formulario.cambio) : null,
    iofBrl: estrangeira ? lerValor(formulario.iof) : null,
    valorBrl: estrangeira ? (lerValor(formulario.valor_brl) as number) : valor,
    comprovanteUrl: formulario.sem_comprovante ? null : formulario.comprovante_url,
    semComprovanteMotivo: formulario.sem_comprovante ? formulario.sem_comprovante_motivo : null,
    tratamento: formulario.tratamento || null,
    vencimentoReembolso: formulario.vencimento_reembolso || null,
    pagoAMais: false,
    motivo: null,
  };
}

/** T05.02: o título, o rateio e, se já foi pago, a baixa com o que nasce dela. */
export async function criarDespesa(formulario: FormularioDespesa, responsavelId: string, hoje: string = hojeISO()): Promise<Titulo> {
  const valor = lerValor(formulario.valor);
  if (valor === null || valor <= 0) throw new ErroDeRegra('Informe o valor, como 0,00.');
  return emTransacao(async () => {
    const vencimento = formulario.pago ? formulario.vencimento || formulario.data_pagamento : formulario.vencimento;
    const titulo = await repositorios.titulo.criar({
      natureza: 'pagar',
      descricao: formulario.descricao,
      contraparte_id: formulario.contraparte_id || null,
      beneficiario_pessoa_id: null,
      categoria_id: formulario.categoria_id,
      competencia: `${formulario.competencia}-01`,
      vencimento,
      valor,
      moeda: formulario.moeda,
      situacao: 'aberto',
      responsavel_id: responsavelId,
      entidade_id: null,
      origem: 'manual',
      origem_id: null,
      chave_idempotencia: formulario.assinatura_id ? chaveDaCobranca(formulario.assinatura_id, vencimento) : null,
      ajustado_manualmente: false,
      ferramenta_id: formulario.ferramenta_id || null,
      assinatura_id: formulario.assinatura_id || null,
      periodo_inicio: null,
      periodo_fim: null,
      suspenso: false,
      cancelado_motivo: null,
      observacao: formulario.observacao || null,
    });
    const percentuais = formulario.contextos.length === 1 ? [100] : formulario.contextos.map((id) => lerValor(formulario.percentuais[id] ?? '') ?? 0);
    await gravarRateio(
      titulo.id,
      valor,
      formulario.contextos.map((contexto, indice) => ({ contexto, percentual: percentuais[indice] as number })),
    );
    if (formulario.pago) await registrarPagamento(titulo.id, pagamentoDoFormulario(formulario, valor), hoje);
    return (await repositorios.titulo.obter(titulo.id)) as Titulo;
  });
}

/** T05.03, "Duplicar": os mesmos dados, em aberto, sem data nem pagamento. */
export function formularioParaDuplicar(titulo: Titulo & { rateio: readonly Pick<TituloRateio, 'produto_id' | 'percentual'>[] }, hoje: string = hojeISO()): FormularioDespesa {
  const contextos = titulo.rateio.map((linha) => linha.produto_id ?? ID_INSTITUCIONAL);
  return {
    ...formularioDespesaVazio('consolidada', titulo.moeda, hoje),
    descricao: titulo.descricao,
    contraparte_id: titulo.contraparte_id ?? '',
    valor: valorParaCampo(titulo.valor),
    pago: false,
    categoria_id: titulo.categoria_id,
    contextos,
    percentuais: Object.fromEntries(titulo.rateio.map((linha) => [linha.produto_id ?? ID_INSTITUCIONAL, valorParaCampo(linha.percentual)])),
    ferramenta_id: titulo.ferramenta_id ?? '',
    observacao: titulo.observacao ?? '',
  };
}

// ---------- Sugestões de T05.02 ----------

/** Sugestões a partir de descrições anteriores, sem repetir, das mais recentes para as mais antigas. */
export function descricoesAnteriores(titulos: readonly Pick<Titulo, 'descricao' | 'origem' | 'criado_em'>[]): string[] {
  const manuais = titulos.filter((titulo) => titulo.origem === 'manual').sort((a, b) => b.criado_em.localeCompare(a.criado_em));
  return [...new Set(manuais.map((titulo) => titulo.descricao))].slice(0, 30);
}

/** A categoria usada da última vez com este fornecedor. */
export function categoriaDoFornecedor(contraparteId: string, titulos: readonly Pick<Titulo, 'contraparte_id' | 'categoria_id' | 'criado_em'>[]): string | null {
  const dele = titulos.filter((titulo) => titulo.contraparte_id === contraparteId).sort((a, b) => b.criado_em.localeCompare(a.criado_em));
  return dele[0]?.categoria_id ?? null;
}

/** RN-04.04: fornecedor (e categoria, se já escolhida) de uma assinatura paga em uso. */
export function assinaturaSugerida<F extends Pick<Ferramenta, 'id' | 'nome' | 'fornecedor_id' | 'situacao' | 'arquivado_em'>, A extends Pick<AssinaturaFerramenta, 'ferramenta_id' | 'modalidade' | 'situacao' | 'categoria_financeira_id'>>(contraparteId: string, categoriaId: string, ferramentas: readonly F[], assinaturas: readonly A[]): { ferramenta: F; assinatura: A } | null {
  if (!contraparteId) return null;
  for (const ferramenta of ferramentas) {
    if (ferramenta.fornecedor_id !== contraparteId || ferramenta.arquivado_em || ferramenta.situacao === 'cancelada') continue;
    const assinatura = assinaturas.find((item) => item.ferramenta_id === ferramenta.id && item.situacao === 'ativa' && item.modalidade === 'paga' && (!categoriaId || !item.categoria_financeira_id || item.categoria_financeira_id === categoriaId));
    if (assinatura) return { ferramenta, assinatura };
  }
  return null;
}

// ---------- Títulos das assinaturas (RN-04.03, RN-04.10 e RN-04.17) ----------

export const chaveDaCobranca = (assinaturaId: string, dia: string) => `assinatura:${assinaturaId}:${dia}`;

const TRES_DIAS = 3 * 86400000;
const pertoDe = (a: string, b: string) => Math.abs(new Date(`${a}T00:00:00Z`).getTime() - new Date(`${b}T00:00:00Z`).getTime()) <= TRES_DIAS;

/** O rateio da ferramenta vira o do título (RN-05.08). Sem percentuais, tudo para o contexto principal (RN-04.05). */
function rateioDaFerramenta(contextos: readonly Pick<FerramentaContexto, 'produto_id' | 'percentual_rateio'>[]): { contexto: string; percentual: number }[] {
  const comPercentual = contextos.filter((ligacao) => ligacao.percentual_rateio !== null);
  if (comPercentual.length && comPercentual.length === contextos.length) return contextos.map((ligacao) => ({ contexto: ligacao.produto_id ?? ID_INSTITUCIONAL, percentual: ligacao.percentual_rateio as number }));
  const principal = contextos[0];
  return [{ contexto: principal?.produto_id ?? ID_INSTITUCIONAL, percentual: 100 }];
}

/**
 * Um título por cobrança prevista, com chave `assinatura + data`: gerar de novo não duplica (CA-04.04).
 * Uma despesa já lançada à mão para a mesma assinatura, até 3 dias de diferença, conta como a mesma cobrança (RN-04.04).
 * Previsto que deixou de ser previsto (a data mudou, a geração desligou) é cancelado, a menos que alguém tenha mexido nele.
 */
export async function sincronizarTitulosDaAssinatura(ferramenta: Pick<Ferramenta, 'id' | 'nome' | 'fornecedor_id' | 'responsavel_financeiro_id' | 'responsavel_tecnico_id'>, assinatura: AssinaturaFerramenta, hoje: string = hojeISO()): Promise<number> {
  const semValor = assinatura.valor === null || !assinatura.categoria_financeira_id;
  const datas = semValor ? [] : cobrancasPrevistas(assinatura, hoje);
  const existentes = await repositorios.titulo.listar({ onde: { assinatura_id: assinatura.id } });
  const contextos = await repositorios.ferramenta_contexto.listar({ onde: { ferramenta_id: ferramenta.id } });
  let novos = 0;
  await emTransacao(async () => {
    for (const titulo of existentes) {
      if (titulo.situacao === 'previsto' && !titulo.ajustado_manualmente && titulo.vencimento >= hoje && !datas.includes(titulo.vencimento)) await repositorios.titulo.atualizar(titulo.id, { situacao: 'cancelado', cancelado_motivo: 'A cobrança da assinatura mudou.' });
    }
    for (const dia of datas) {
      const mesmaChave = existentes.find((titulo) => titulo.chave_idempotencia === chaveDaCobranca(assinatura.id, dia));
      if (mesmaChave?.situacao === 'cancelado') {
        // Cancelado à mão fica cancelado (RN-05.13); o que a própria geração cancelou volta, se a data voltou.
        if (!mesmaChave.ajustado_manualmente) await repositorios.titulo.atualizar(mesmaChave.id, { situacao: 'previsto', cancelado_motivo: null, valor: assinatura.valor as number });
        continue;
      }
      if (mesmaChave || existentes.some((titulo) => titulo.situacao !== 'cancelado' && pertoDe(titulo.vencimento, dia))) continue;
      const titulo = await repositorios.titulo.criar({
        natureza: 'pagar',
        descricao: assinatura.plano ? `${ferramenta.nome} · ${assinatura.plano}` : ferramenta.nome,
        contraparte_id: ferramenta.fornecedor_id,
        beneficiario_pessoa_id: null,
        categoria_id: assinatura.categoria_financeira_id as string,
        competencia: competenciaDoDia(dia),
        vencimento: dia,
        valor: assinatura.valor as number,
        moeda: assinatura.moeda,
        situacao: 'previsto',
        responsavel_id: ferramenta.responsavel_financeiro_id ?? ferramenta.responsavel_tecnico_id,
        entidade_id: null,
        origem: 'assinatura',
        origem_id: assinatura.id,
        chave_idempotencia: chaveDaCobranca(assinatura.id, dia),
        ajustado_manualmente: false,
        ferramenta_id: ferramenta.id,
        assinatura_id: assinatura.id,
        periodo_inicio: null,
        periodo_fim: null,
        suspenso: false,
        cancelado_motivo: null,
        observacao: null,
      });
      await gravarRateio(titulo.id, titulo.valor, rateioDaFerramenta(contextos));
      novos += 1;
    }
  });
  return novos;
}

/** "Estender programação" (02 §0.5): todas as assinaturas em uso. */
export async function estenderProgramacao(hoje: string = hojeISO()): Promise<number> {
  const [assinaturas, ferramentas] = await Promise.all([repositorios.assinatura_ferramenta.listar({ onde: { situacao: 'ativa' } }), repositorios.ferramenta.listar()]);
  let novos = 0;
  for (const assinatura of assinaturas) {
    const ferramenta = ferramentas.find((item) => item.id === assinatura.ferramenta_id);
    if (ferramenta && ferramenta.situacao !== 'cancelada') novos += await sincronizarTitulosDaAssinatura(ferramenta, assinatura, hoje);
  }
  return novos;
}

/** Título que ainda pode mudar por causa da assinatura: sem baixa, em aberto ou previsto. */
const semBaixa = (titulo: Pick<Titulo, 'situacao'>) => titulo.situacao === 'previsto' || titulo.situacao === 'aberto';

/** Trocar de plano: as cobranças previstas do plano antigo deixam de existir. As mexidas à mão ficam. */
export async function cancelarPrevistosDaAssinatura(assinaturaId: string, hoje: string, motivo: string): Promise<void> {
  const titulos = await repositorios.titulo.listar({ onde: { assinatura_id: assinaturaId, situacao: 'previsto' } });
  for (const titulo of titulos) {
    if (titulo.vencimento >= hoje && !titulo.ajustado_manualmente) await repositorios.titulo.atualizar(titulo.id, { situacao: 'cancelado', cancelado_motivo: motivo }, { motivo });
  }
}

/** RN-04.10: os títulos futuros não pagos, depois da data efetiva, para a prévia (P6). */
export async function titulosFuturosDaFerramenta(ferramentaId: string, depoisDe: string): Promise<Titulo[]> {
  const titulos = await repositorios.titulo.listar({ onde: { ferramenta_id: ferramentaId } });
  return titulos.filter((titulo) => semBaixa(titulo) && titulo.vencimento > depoisDe).sort((a, b) => a.vencimento.localeCompare(b.vencimento));
}

export async function cancelarTitulosFuturos(ferramentaId: string, depoisDe: string, motivo: string): Promise<number> {
  const titulos = await titulosFuturosDaFerramenta(ferramentaId, depoisDe);
  for (const titulo of titulos) await repositorios.titulo.atualizar(titulo.id, { situacao: 'cancelado', cancelado_motivo: motivo }, { motivo });
  return titulos.length;
}

/** RN-04.17: o reajuste só muda títulos futuros, não pagos e não ajustados à mão (RN-05.13). */
export async function titulosAfetadosPeloReajuste(assinaturaId: string, hoje: string = hojeISO()): Promise<Titulo[]> {
  const titulos = await repositorios.titulo.listar({ onde: { assinatura_id: assinaturaId } });
  return titulos.filter((titulo) => semBaixa(titulo) && titulo.vencimento >= hoje && !titulo.ajustado_manualmente).sort((a, b) => a.vencimento.localeCompare(b.vencimento));
}

export async function aplicarReajuste(assinaturaId: string, valor: number, motivo: string, hoje: string = hojeISO()): Promise<number> {
  const titulos = await titulosAfetadosPeloReajuste(assinaturaId, hoje);
  for (const titulo of titulos) {
    await repositorios.titulo.atualizar(titulo.id, { valor }, { motivo });
    await recalcularRateio(titulo.id, valor);
  }
  return titulos.length;
}

/** Rotina do dia: previsto que chegou no vencimento passa a contar como em aberto, e daí como vencido. */
export async function atualizarSituacoesDosTitulos(hoje: string = hojeISO()): Promise<number> {
  const previstos = await repositorios.titulo.listar({ onde: { situacao: 'previsto' } });
  const chegaram = previstos.filter((titulo) => titulo.vencimento <= hoje);
  await emTransacao(async () => {
    for (const titulo of chegaram) await repositorios.titulo.atualizar(titulo.id, { situacao: 'aberto' });
  });
  return chegaram.length;
}
