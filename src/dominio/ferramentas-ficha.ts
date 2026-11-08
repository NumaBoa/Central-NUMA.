/**
 * Revisão do M04 (07/11/2026): o que a ficha da ferramenta e a do ativo mostram sobre cobranças, pagamentos,
 * cancelamento, titularidade e pendências. Lê os lançamentos do Financeiro (M05), sem guardar cópia, e só grava
 * pelo repositório do título, como o próprio Financeiro.
 */
import { ErroDeRegra } from '@/dados/erros';
import { repositorios } from '@/dados/repositorios';
import { emTransacao } from '@/dados/transacao';
import type { AssinaturaFerramenta, Ferramenta } from '@/dados/tipos/ferramenta';
import type { Entidade } from '@/dados/tipos/contraparte';
import type { Pessoa } from '@/dados/tipos/pessoa';
import type { Baixa, Titulo } from '@/dados/tipos/titulo';
import { hojeISO } from '@/lib/datas';
import { sincronizarAlertasDosTitulos } from './alertas';
import { cobrancasPrevistas } from './cobrancas';
import { normalizarTexto } from './duplicidade';
import { montarLinhaDoTitulo, type LinhaDoTitulo } from './lancamentos';
import { titularEhODesejado, type Titular } from './titularidade';
import { chaveDaCobranca } from './titulos';

// ---------- Carga ----------

export type FinanceiroDaFerramenta = {
  /** Os lançamentos da ferramenta, como o Financeiro os mostra (com baixas e saldo), do mais antigo ao mais novo. */
  titulos: LinhaDoTitulo[];
  entidades: Entidade[];
};

/** Lê do Financeiro, sem cópia: o que muda lá aparece aqui na hora. */
export async function carregarFinanceiroDaFerramenta(id: string, hoje: string = hojeISO()): Promise<FinanceiroDaFerramenta> {
  const [titulos, rateios, baixas, entidades] = await Promise.all([repositorios.titulo.listar({ onde: { ferramenta_id: id } }), repositorios.titulo_rateio.listar(), repositorios.baixa.listar(), repositorios.entidade.listar()]);
  return { titulos: titulos.map((titulo) => montarLinhaDoTitulo(titulo, rateios, baixas, hoje)).sort((a, b) => a.vencimento.localeCompare(b.vencimento)), entidades };
}

// ---------- Prévia das cobranças (RN-04.03 e RN-04.04) ----------

/** A mesma tolerância da geração (`sincronizarTitulosDaAssinatura`): até 3 dias de diferença é a mesma cobrança. */
const TRES_DIAS = 3 * 86400000;
const pertoDe = (a: string, b: string) => Math.abs(new Date(`${a}T00:00:00Z`).getTime() - new Date(`${b}T00:00:00Z`).getTime()) <= TRES_DIAS;

export type EstadoDaCobranca = 'a_gerar' | 'ja_existe' | 'sem_valor';
export const ROTULOS_ESTADO_COBRANCA: Readonly<Record<EstadoDaCobranca, string>> = { a_gerar: 'A gerar', ja_existe: 'Já lançada', sem_valor: 'Aguarda o valor' };

export type CobrancaDaPrevia = { dia: string; valor: number | null; moeda: string; estado: EstadoDaCobranca; codigo: string | null };

type AssinaturaDaPrevia = Pick<AssinaturaFerramenta, 'modalidade' | 'valor' | 'moeda' | 'periodicidade' | 'proxima_cobranca' | 'gerar_titulos'>;
type TituloDaPrevia = Pick<Titulo, 'vencimento' | 'situacao' | 'codigo' | 'chave_idempotencia'>;

/**
 * As cobranças que a assinatura prevê (mensal: até 3 meses; as demais: só a próxima) e o que acontece com cada
 * uma ao salvar. Já lançada (gerada antes ou lançada à mão e vinculada) não é criada de novo. Paga sem valor
 * não gera nada até o valor ser confirmado: nunca um título de zero.
 */
export function previaDasCobrancas(assinatura: AssinaturaDaPrevia, existentes: readonly TituloDaPrevia[], assinaturaId: string | null, hoje: string = hojeISO()): CobrancaDaPrevia[] {
  return cobrancasPrevistas(assinatura, hoje).map((dia) => {
    const existente = existentes.find((titulo) => titulo.situacao !== 'cancelado' && ((assinaturaId && titulo.chave_idempotencia === chaveDaCobranca(assinaturaId, dia)) || pertoDe(titulo.vencimento, dia)));
    const estado: EstadoDaCobranca = existente ? 'ja_existe' : assinatura.valor === null ? 'sem_valor' : 'a_gerar';
    return { dia, valor: assinatura.valor, moeda: assinatura.moeda, estado, codigo: existente?.codigo ?? null };
  });
}

// ---------- Pagamento efetivo (RN-04.06) ----------

export type PagamentoEfetivo = { data: string; valorBrl: number; valorMoeda: number };

/** O que foi pago de fato, pelas baixas: pagamentos menos estornos. A data é a do último pagamento que continua de pé. */
export function pagamentoEfetivo(baixas: readonly Pick<Baixa, 'id' | 'tipo' | 'data' | 'valor_brl' | 'valor_moeda' | 'baixa_original_id'>[]): PagamentoEfetivo | null {
  const estornadas = new Set(baixas.filter((baixa) => baixa.tipo === 'estorno').map((baixa) => baixa.baixa_original_id));
  const pagamentos = baixas.filter((baixa) => baixa.tipo === 'pagamento');
  const sinal = (baixa: (typeof baixas)[number]) => (baixa.tipo === 'estorno' ? -1 : baixa.tipo === 'pagamento' ? 1 : 0);
  const valorBrl = baixas.reduce((total, baixa) => total + sinal(baixa) * baixa.valor_brl, 0);
  const valorMoeda = baixas.reduce((total, baixa) => total + sinal(baixa) * baixa.valor_moeda, 0);
  const dePe = pagamentos.filter((baixa) => !estornadas.has(baixa.id)).sort((a, b) => b.data.localeCompare(a.data));
  if (valorBrl <= 0.004 || !dePe[0]) return null;
  return { data: dePe[0].data, valorBrl: Math.round(valorBrl * 100) / 100, valorMoeda: Math.round(valorMoeda * 100) / 100 };
}

export type TituloComBaixas = Titulo & { baixas: readonly Baixa[] };

/** O último pagamento da ferramenta, com o vencimento previsto ao lado (RN-04.06: os dois aparecem). */
export function ultimoPagamento<T extends TituloComBaixas>(titulos: readonly T[]): { titulo: T; pagamento: PagamentoEfetivo } | null {
  const pagos = titulos.flatMap((titulo) => {
    const pagamento = pagamentoEfetivo(titulo.baixas);
    return pagamento ? [{ titulo, pagamento }] : [];
  });
  return pagos.sort((a, b) => b.pagamento.data.localeCompare(a.pagamento.data))[0] ?? null;
}

/** "Registrar pagamento" só abre a baixa de um lançamento válido em aberto: o mais antigo com saldo. */
export function proximoEmAberto<T extends Pick<Titulo, 'situacao' | 'vencimento' | 'arquivado_em' | 'natureza'> & { saldo: number }>(titulos: readonly T[]): T | null {
  return [...titulos].filter((titulo) => titulo.natureza === 'pagar' && titulo.saldo > 0 && titulo.situacao !== 'cancelado' && !titulo.arquivado_em).sort((a, b) => a.vencimento.localeCompare(b.vencimento))[0] ?? null;
}

// ---------- Prévia do cancelamento (RN-04.10) ----------

export type EfeitoDoCancelamento = 'sera_cancelado' | 'preservado_pago' | 'preservado_anterior' | 'ja_cancelado';
export const ROTULOS_EFEITO_CANCELAMENTO: Readonly<Record<EfeitoDoCancelamento, string>> = { sera_cancelado: 'Será cancelado', preservado_pago: 'Preservado (pago)', preservado_anterior: 'Preservado', ja_cancelado: 'Já cancelado' };

/**
 * O que acontece com cada lançamento da ferramenta: só os futuros sem pagamento, com vencimento depois da data
 * efetiva, são cancelados. Vencimento no próprio dia fica. Pago ou parcial nunca muda. É a mesma regra de
 * `titulosFuturosDaFerramenta`, que é quem cancela de fato.
 */
export function previaDoCancelamento<T extends Pick<Titulo, 'vencimento' | 'situacao'>>(titulos: readonly T[], dataEfetiva: string): { titulo: T; efeito: EfeitoDoCancelamento }[] {
  return [...titulos]
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento))
    .map((titulo) => {
      if (titulo.situacao === 'cancelado') return { titulo, efeito: 'ja_cancelado' as const };
      if (titulo.situacao === 'quitado' || titulo.situacao === 'parcial') return { titulo, efeito: 'preservado_pago' as const };
      if (dataEfetiva && titulo.vencimento > dataEfetiva) return { titulo, efeito: 'sera_cancelado' as const };
      return { titulo, efeito: 'preservado_anterior' as const };
    });
}

// ---------- Titularidade (RN-04.14) ----------

const ehNuma = (texto: string) => ['numa', 'numa (pj)'].includes(normalizarTexto(texto));

/** As entidades de T02.05, para a titularidade ler o estado real da Numa. */
export async function carregarEntidades(): Promise<Entidade[]> {
  return repositorios.entidade.listar();
}

/** Há entidade PJ ativa (M06/T02.05)? Sem ela, nada passa para o nome da Numa. */
export function numaTemEntidadeAtiva(entidades: readonly Pick<Entidade, 'tipo_pessoa' | 'situacao' | 'arquivado_em'>[]): boolean {
  return entidades.some((entidade) => !entidade.arquivado_em && entidade.tipo_pessoa === 'pj' && entidade.situacao === 'ativa');
}

export type EstadoDaTitularidade = 'igual' | 'aguarda_entidade' | 'pendente';
export type Titularidade = { estado: EstadoDaTitularidade; texto: string };

/**
 * Ferramenta não guarda a situação da transferência: ela é lida do titular atual, do desejado e da entidade.
 * Escolher o desejado nunca muda o atual. Se o desejado é a Numa e ela ainda não tem entidade PJ ativa, a
 * transferência fica a planejar, sem prometer que já pode ser feita.
 */
export function titularidade(registro: Titular & { titular_desejado: string }, pessoas: readonly Pick<Pessoa, 'id' | 'nome_completo'>[], entidades: readonly Pick<Entidade, 'tipo_pessoa' | 'situacao' | 'arquivado_em'>[]): Titularidade {
  if (titularEhODesejado(registro, registro.titular_desejado, pessoas)) return { estado: 'igual', texto: 'O titular atual já é o desejado.' };
  if (ehNuma(registro.titular_desejado) && !numaTemEntidadeAtiva(entidades)) return { estado: 'aguarda_entidade', texto: 'Transferência a planejar: a Numa ainda não tem entidade PJ ativa.' };
  return { estado: 'pendente', texto: `Transferência pendente para ${registro.titular_desejado}.` };
}

// ---------- Pendências da ferramenta ----------

export type Pendencia = { id: string; tom: 'atencao' | 'info'; texto: string };

type FerramentaDaPendencia = Pick<Ferramenta, 'situacao' | 'critica' | 'caminho_recuperacao' | 'mfa_conta' | 'trata_dados_pessoais' | 'acordo_dados_situacao' | 'arquivado_em' | 'titular_atual_tipo' | 'titular_atual_pessoa_id' | 'titular_atual_texto' | 'titular_desejado'> & { assinatura: Pick<AssinaturaFerramenta, 'modalidade' | 'valor'> | null };

/**
 * O que falta, lido do próprio cadastro: nada é inventado nem marcado como feito. O caminho de recuperação é
 * recomendado nas críticas (D14), sem virar obrigatório.
 */
export function pendenciasDaFerramenta(ferramenta: FerramentaDaPendencia, pessoas: readonly Pick<Pessoa, 'id' | 'nome_completo'>[], entidades: readonly Pick<Entidade, 'tipo_pessoa' | 'situacao' | 'arquivado_em'>[]): Pendencia[] {
  if (ferramenta.arquivado_em || ferramenta.situacao === 'cancelada') return [];
  const pendencias: Pendencia[] = [];
  if (ferramenta.situacao === 'teste_expirado') pendencias.push({ id: 'teste', tom: 'atencao', texto: 'O teste acabou: decidir se assina ou cancela.' });
  if (ferramenta.assinatura?.modalidade === 'paga' && ferramenta.assinatura.valor === null) pendencias.push({ id: 'valor', tom: 'atencao', texto: 'Confirmar o valor da assinatura. Sem ele, nenhuma cobrança é gerada.' });
  if (!ferramenta.assinatura) pendencias.push({ id: 'custo', tom: 'info', texto: 'Definir o custo: gratuita, paga ou em teste.' });
  const dono = titularidade(ferramenta, pessoas, entidades);
  if (dono.estado !== 'igual') pendencias.push({ id: 'titular', tom: dono.estado === 'pendente' ? 'atencao' : 'info', texto: dono.texto });
  if (ferramenta.critica && ferramenta.mfa_conta === 'nao') pendencias.push({ id: 'duas-etapas', tom: 'atencao', texto: 'A autenticação em duas etapas está desligada, e a ferramenta é crítica.' });
  if (ferramenta.critica && ferramenta.mfa_conta === 'desconhecido') pendencias.push({ id: 'duas-etapas', tom: 'info', texto: 'Confirmar se a autenticação em duas etapas está ligada.' });
  if (ferramenta.critica && !ferramenta.caminho_recuperacao?.trim()) pendencias.push({ id: 'recuperacao', tom: 'info', texto: 'Recomendado: registrar o caminho de recuperação, por ser crítica.' });
  if (ferramenta.trata_dados_pessoais && (!ferramenta.acordo_dados_situacao || ferramenta.acordo_dados_situacao === 'nao_avaliado')) pendencias.push({ id: 'acordo', tom: 'atencao', texto: 'Avaliar o acordo de tratamento de dados com o fornecedor.' });
  return pendencias;
}

// ---------- Vincular um lançamento que já existe (RN-04.04) ----------

/**
 * Despesas a pagar que ainda não pertencem a nenhuma assinatura. Com fornecedor na ferramenta, só as dele:
 * é o mesmo critério da sugestão do Financeiro (`assinaturaSugerida`).
 */
export async function lancamentosParaVincular(ferramentaId: string): Promise<Titulo[]> {
  const [ferramenta, titulos] = await Promise.all([repositorios.ferramenta.obter(ferramentaId), repositorios.titulo.listar()]);
  if (!ferramenta) return [];
  return titulos
    .filter((titulo) => titulo.natureza === 'pagar' && !titulo.assinatura_id && titulo.situacao !== 'cancelado' && (!ferramenta.fornecedor_id || titulo.contraparte_id === ferramenta.fornecedor_id || titulo.ferramenta_id === ferramentaId))
    .sort((a, b) => b.vencimento.localeCompare(a.vencimento));
}

/**
 * Liga a despesa à assinatura paga em uso, em vez de gerar outra (RN-04.04). A cobrança prevista gerada para a
 * mesma data (até 3 dias) deixa de existir, e fica marcada como mexida à mão para a geração não a trazer de volta.
 * Não registra pagamento nem muda valor: isso é do Financeiro.
 */
export async function vincularLancamento(tituloId: string, ferramentaId: string, hoje: string = hojeISO()): Promise<{ substituidos: number }> {
  const [titulo, assinaturas, ferramenta] = await Promise.all([repositorios.titulo.obter(tituloId), repositorios.assinatura_ferramenta.listar({ onde: { ferramenta_id: ferramentaId, situacao: 'ativa' } }), repositorios.ferramenta.obter(ferramentaId)]);
  const assinatura = assinaturas[0];
  if (!ferramenta || !titulo) throw new ErroDeRegra('Esse lançamento não existe mais.');
  if (ferramenta.situacao === 'cancelada' || ferramenta.arquivado_em) throw new ErroDeRegra('Ferramenta cancelada ou arquivada não recebe lançamentos.');
  if (!assinatura || assinatura.modalidade !== 'paga') throw new ErroDeRegra('Só uma assinatura paga em uso recebe lançamentos.');
  if (titulo.natureza !== 'pagar' || titulo.situacao === 'cancelado') throw new ErroDeRegra('Só uma despesa a pagar, não cancelada, pode ser vinculada.');
  if (titulo.assinatura_id) throw new ErroDeRegra(titulo.assinatura_id === assinatura.id ? 'Esse lançamento já está vinculado a esta assinatura.' : 'Esse lançamento já pertence a outra assinatura.');
  const gerados = await repositorios.titulo.listar({ onde: { assinatura_id: assinatura.id } });
  const substituidos = gerados.filter((gerado) => gerado.situacao === 'previsto' && gerado.origem === 'assinatura' && !gerado.ajustado_manualmente && pertoDe(gerado.vencimento, titulo.vencimento));
  const motivo = `Vinculado à assinatura de ${ferramenta.nome}.`;
  await emTransacao(async () => {
    for (const gerado of substituidos) await repositorios.titulo.atualizar(gerado.id, { situacao: 'cancelado', ajustado_manualmente: true, cancelado_motivo: `Substituído pelo lançamento ${titulo.codigo}, vinculado à assinatura.` }, { motivo });
    await repositorios.titulo.atualizar(titulo.id, { ferramenta_id: ferramentaId, assinatura_id: assinatura.id, chave_idempotencia: chaveDaCobranca(assinatura.id, titulo.vencimento) }, { motivo });
  });
  await sincronizarAlertasDosTitulos([titulo.id, ...substituidos.map((gerado) => gerado.id)], hoje);
  return { substituidos: substituidos.length };
}
