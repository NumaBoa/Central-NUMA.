/** T05.06 e T05.07: transferências, saldos e extrato (RN-05.10 e RN-05.16). */
import { z } from 'zod';
import { ErroDeRegra } from '@/dados/erros';
import { repositorios } from '@/dados/repositorios';
import { idDaPessoaAtual } from '@/dados/sessao';
import { emTransacao } from '@/dados/transacao';
import type { CambioReferencia } from '@/dados/tipos/cambio-referencia';
import type { Entidade } from '@/dados/tipos/contraparte';
import type { CategoriaFinanceira, ContaFinanceira } from '@/dados/tipos/financeiro';
import type { Pessoa } from '@/dados/tipos/pessoa';
import type { Baixa, MovimentoSocietario, Titulo } from '@/dados/tipos/titulo';
import type { ConferenciaSaldo, Transferencia } from '@/dados/tipos/transferencia';
import { hojeISO } from '@/lib/datas';
import { controlaSaldo } from './contas';
import { lerCambio, lerValor, valorParaCampo } from './dinheiro';
import { normalizarTexto } from './duplicidade';
import { linkDoDriveValido, MENSAGEM_LINK_DRIVE } from './link-drive';
import { competenciaDoDia } from './titulos';

const arredondar = (valor: number) => Math.round((valor + Number.EPSILON) * 100) / 100;

// ---------- Transferências (T05.06) ----------

/** Entre contas próprias (RN-05.10). O que passa por conta pessoal de sócia é aporte ou retirada (RN-05.11). */
export const contasParaTransferencia = <T extends Pick<ContaFinanceira, 'arquivado_em' | 'situacao' | 'tipo'>>(contas: readonly T[]): T[] => contas.filter((conta) => !conta.arquivado_em && conta.situacao === 'ativa' && conta.tipo !== 'pessoal_socia');

export function criarEsquemaTransferencia(contas: readonly Pick<ContaFinanceira, 'id' | 'moeda'>[], hoje: string = hojeISO()) {
  return z
    .object({
      data: z.string().min(1, 'Informe a data.'),
      conta_origem_id: z.string().min(1, 'Escolha a conta de origem.'),
      conta_destino_id: z.string().min(1, 'Escolha a conta de destino.'),
      valor_origem: z.string().trim(),
      valor_destino: z.string().trim(),
      cambio: z.string().trim(),
      comprovante_url: z.string().trim(),
      sem_comprovante: z.boolean(),
      sem_comprovante_motivo: z.string().trim(),
      observacao: z.string().trim(),
    })
    .superRefine((dados, contexto) => {
      const falha = (campo: string, message: string) => contexto.addIssue({ code: 'custom', path: [campo], message });
      if (dados.data > hoje) falha('data', 'A data não pode ser futura.');
      if (dados.conta_origem_id && dados.conta_origem_id === dados.conta_destino_id) falha('conta_destino_id', 'A conta de destino precisa ser outra.');
      const valor = lerValor(dados.valor_origem);
      if (valor === null || valor <= 0) falha('valor_origem', 'Informe o valor, como 0,00.');
      const origem = contas.find((conta) => conta.id === dados.conta_origem_id);
      const destino = contas.find((conta) => conta.id === dados.conta_destino_id);
      if (origem && destino && origem.moeda !== destino.moeda) {
        if (!(Number(lerCambio(dados.cambio)) > 0)) falha('cambio', 'Informe o câmbio.');
        const chegou = lerValor(dados.valor_destino);
        if (chegou === null || chegou <= 0) falha('valor_destino', 'Informe quanto chegou na conta de destino.');
      }
      if (dados.sem_comprovante) {
        if (!dados.sem_comprovante_motivo) falha('sem_comprovante_motivo', 'Diga por que não tem comprovante.');
      } else if (!dados.comprovante_url) falha('comprovante_url', 'Cole o link do comprovante, ou marque que não tem.');
      else if (!linkDoDriveValido(dados.comprovante_url)) falha('comprovante_url', MENSAGEM_LINK_DRIVE);
    });
}

export type FormularioTransferencia = z.infer<ReturnType<typeof criarEsquemaTransferencia>>;

export const formularioTransferenciaVazio = (hoje: string = hojeISO()): FormularioTransferencia => ({ data: hoje, conta_origem_id: '', conta_destino_id: '', valor_origem: '', valor_destino: '', cambio: '', comprovante_url: '', sem_comprovante: false, sem_comprovante_motivo: '', observacao: '' });

/** O câmbio é sempre "reais por unidade da moeda estrangeira". Entre duas estrangeiras, destino por origem. */
export function sugestaoDoDestino(moedaOrigem: string, moedaDestino: string, valorOrigem: string, cambioTexto: string): string | null {
  const valor = lerValor(valorOrigem);
  const cambio = lerCambio(cambioTexto);
  if (valor === null || valor <= 0 || cambio === null || cambio <= 0 || moedaOrigem === moedaDestino) return null;
  return valorParaCampo(arredondar(moedaOrigem === 'BRL' ? valor / cambio : valor * cambio));
}

export async function registrarTransferencia(formulario: FormularioTransferencia, hoje: string = hojeISO()): Promise<Transferencia> {
  if (formulario.data > hoje) throw new ErroDeRegra('A data não pode ser futura.');
  const [origem, destino] = await Promise.all([repositorios.conta_financeira.obter(formulario.conta_origem_id), repositorios.conta_financeira.obter(formulario.conta_destino_id)]);
  if (!origem || !destino) throw new ErroDeRegra('Escolha as duas contas.');
  if (origem.id === destino.id) throw new ErroDeRegra('A conta de destino precisa ser outra.');
  if (contasParaTransferencia([origem, destino]).length < 2) throw new ErroDeRegra('As duas contas precisam ser da Numa e estar ativas.');
  const valorOrigem = lerValor(formulario.valor_origem) as number;
  const mesmaMoeda = origem.moeda === destino.moeda;
  const observacao = [formulario.observacao, formulario.sem_comprovante ? `Sem comprovante: ${formulario.sem_comprovante_motivo}` : ''].filter(Boolean).join(' · ');
  return repositorios.transferencia.criar({
    data: formulario.data,
    conta_origem_id: origem.id,
    conta_destino_id: destino.id,
    valor_origem: valorOrigem,
    moeda_origem: origem.moeda,
    valor_destino: mesmaMoeda ? valorOrigem : (lerValor(formulario.valor_destino) as number),
    moeda_destino: destino.moeda,
    cambio: mesmaMoeda ? null : lerCambio(formulario.cambio),
    comprovante_url: formulario.sem_comprovante ? null : formulario.comprovante_url || null,
    observacao: observacao || null,
  });
}

export type FiltrosTransferencias = { busca: string; conta: string };

export const FILTROS_TRANSFERENCIAS_INICIAIS: FiltrosTransferencias = { busca: '', conta: '' };

/** Da mais recente para a mais antiga. */
export function filtrarTransferencias<T extends Pick<Transferencia, 'data' | 'conta_origem_id' | 'conta_destino_id' | 'observacao'>>(transferencias: readonly T[], { busca, conta }: FiltrosTransferencias, nomeDaConta: (id: string) => string): T[] {
  const procurado = normalizarTexto(busca);
  return transferencias
    .filter((item) => !conta || item.conta_origem_id === conta || item.conta_destino_id === conta)
    .filter((item) => !procurado || normalizarTexto(`${nomeDaConta(item.conta_origem_id)} ${nomeDaConta(item.conta_destino_id)} ${item.observacao ?? ''}`).includes(procurado))
    .sort((a, b) => b.data.localeCompare(a.data));
}

// ---------- Saldo e extrato (RN-05.16) ----------

export type DadosDosSaldos = {
  contas: ContaFinanceira[];
  baixas: Baixa[];
  titulos: Titulo[];
  transferencias: Transferencia[];
  movimentos: MovimentoSocietario[];
  conferencias: ConferenciaSaldo[];
  categorias: CategoriaFinanceira[];
  cambios: CambioReferencia[];
  pessoas: Pessoa[];
  entidades: Entidade[];
};

export async function carregarSaldos(): Promise<DadosDosSaldos> {
  const [contas, baixas, titulos, transferencias, movimentos, conferencias, categorias, cambios, pessoas, entidades] = await Promise.all([
    repositorios.conta_financeira.listar({ incluirArquivados: true }),
    repositorios.baixa.listar(),
    repositorios.titulo.listar(),
    repositorios.transferencia.listar(),
    repositorios.movimento_societario.listar(),
    repositorios.conferencia_saldo.listar(),
    repositorios.categoria_financeira.listar(),
    repositorios.cambio_referencia.listar(),
    repositorios.pessoa.listar({ incluirArquivados: true }),
    repositorios.entidade.listar({ incluirArquivados: true }),
  ]);
  return { contas, baixas, titulos, transferencias, movimentos, conferencias, categorias, cambios, pessoas, entidades };
}

/** O que aparece em "Contas e saldos": as encerradas ficam por último. */
export function contasDoPainel<T extends Pick<ContaFinanceira, 'arquivado_em' | 'situacao' | 'nome'>>(contas: readonly T[]): T[] {
  return contas.filter((conta) => !conta.arquivado_em).sort((a, b) => Number(a.situacao === 'encerrada') - Number(b.situacao === 'encerrada') || a.nome.localeCompare(b.nome, 'pt-BR'));
}

export type LinhaDoExtrato = { id: string; data: string; descricao: string; entrada: number; saida: number; saldo: number | null; href: string | null };

type DadosDoExtrato = Pick<DadosDosSaldos, 'baixas' | 'titulos' | 'transferencias' | 'movimentos'>;

/** Pagar sai, receber entra; o estorno inverte. O valor do estorno é positivo, ligado à baixa original (RN-05.04). */
function sinalDaBaixa(baixa: Pick<Baixa, 'tipo'>, titulo: Pick<Titulo, 'natureza'> | undefined): 1 | -1 {
  const saida = titulo?.natureza !== 'receber';
  const estorno = baixa.tipo === 'estorno';
  return saida === estorno ? 1 : -1;
}

/** Do mais antigo ao mais recente. Numa conta controlada, só entra o que veio a partir da data do saldo inicial (RN-05.16). */
export function extratoDaConta(conta: ContaFinanceira, { baixas, titulos, transferencias, movimentos }: DadosDoExtrato): LinhaDoExtrato[] {
  const linhas: (Omit<LinhaDoExtrato, 'saldo'> & { criadoEm: string })[] = [];
  for (const baixa of baixas) {
    if (baixa.conta_financeira_id !== conta.id) continue;
    const titulo = titulos.find((item) => item.id === baixa.titulo_id);
    const sinal = sinalDaBaixa(baixa, titulo);
    const valor = conta.moeda === titulo?.moeda ? baixa.valor_moeda : baixa.valor_brl;
    const prefixo = baixa.tipo === 'estorno' ? 'Estorno: ' : baixa.tipo === 'ajuste' ? 'Ajuste: ' : '';
    linhas.push({ id: baixa.id, data: baixa.data, descricao: `${prefixo}${titulo?.descricao ?? 'Título removido'}`, entrada: sinal > 0 ? valor : 0, saida: sinal < 0 ? valor : 0, href: titulo ? `/financeiro/${titulo.id}` : null, criadoEm: baixa.criado_em });
  }
  for (const transferencia of transferencias) {
    if (transferencia.conta_origem_id === conta.id) linhas.push({ id: `${transferencia.id}-saida`, data: transferencia.data, descricao: 'Transferência enviada', entrada: 0, saida: transferencia.valor_origem, href: '/financeiro/transferencias', criadoEm: transferencia.criado_em });
    if (transferencia.conta_destino_id === conta.id) linhas.push({ id: `${transferencia.id}-entrada`, data: transferencia.data, descricao: 'Transferência recebida', entrada: transferencia.valor_destino, saida: 0, href: '/financeiro/transferencias', criadoEm: transferencia.criado_em });
  }
  // Aporte em dinheiro entra na conta da Numa. O que uma sócia pagou de despesa não passa por ela.
  for (const movimento of movimentos) {
    if (movimento.conta_financeira_id !== conta.id || movimento.forma !== 'dinheiro') continue;
    const aporte = movimento.tipo === 'aporte';
    linhas.push({ id: movimento.id, data: movimento.data, descricao: aporte ? 'Aporte em dinheiro' : 'Retirada', entrada: aporte ? movimento.valor_brl : 0, saida: aporte ? 0 : movimento.valor_brl, href: '/financeiro/socias', criadoEm: movimento.criado_em });
  }
  const controlado = controlaSaldo(conta.tipo) && conta.saldo_inicial !== null;
  const validas = controlado && conta.data_saldo_inicial ? linhas.filter((linha) => linha.data >= (conta.data_saldo_inicial as string)) : linhas;
  let acumulado = conta.saldo_inicial ?? 0;
  // No mesmo dia, na ordem em que aconteceu: o saldo de cada linha é o daquele momento.
  return [...validas]
    .sort((a, b) => a.data.localeCompare(b.data) || a.criadoEm.localeCompare(b.criadoEm))
    .map(({ criadoEm: _criadoEm, ...linha }) => {
      acumulado = arredondar(acumulado + linha.entrada - linha.saida);
      return { ...linha, saldo: controlado ? acumulado : null };
    });
}

/** `null` em conta sem saldo controlado, como cartão e conta pessoal de sócia. */
export function saldoDaConta(conta: ContaFinanceira, dados: DadosDoExtrato, ate?: string): number | null {
  if (!controlaSaldo(conta.tipo) || conta.saldo_inicial === null) return null;
  const ultima = extratoDaConta(conta, dados)
    .filter((linha) => !ate || linha.data <= ate)
    .at(-1);
  return ultima ? (ultima.saldo as number) : conta.saldo_inicial;
}

export function ultimaMovimentacao(conta: ContaFinanceira, dados: DadosDoExtrato): string | null {
  return extratoDaConta(conta, dados).at(-1)?.data ?? null;
}

// ---------- Conferir saldo (T05.07) ----------

export function criarEsquemaConferencia(conta: Pick<ContaFinanceira, 'data_saldo_inicial'>, hoje: string = hojeISO()) {
  return z
    .object({
      data: z.string().min(1, 'Informe a data.'),
      saldo_informado: z.string().trim(),
      ajustar: z.boolean(),
      motivo: z.string().trim(),
    })
    .superRefine((dados, contexto) => {
      const falha = (campo: string, message: string) => contexto.addIssue({ code: 'custom', path: [campo], message });
      if (dados.data > hoje) falha('data', 'A data não pode ser futura.');
      else if (dados.data && conta.data_saldo_inicial && dados.data < conta.data_saldo_inicial) falha('data', 'A conta começa depois disso: use uma data a partir do saldo inicial.');
      if (lerValor(dados.saldo_informado) === null) falha('saldo_informado', 'Informe o saldo do banco, como 0,00.');
      if (dados.ajustar && !dados.motivo) falha('motivo', 'Diga por que está ajustando.');
    });
}

export type FormularioConferencia = z.infer<ReturnType<typeof criarEsquemaConferencia>>;

export const formularioConferenciaVazio = (hoje: string = hojeISO()): FormularioConferencia => ({ data: hoje, saldo_informado: '', ajustar: false, motivo: '' });

/** Saldo do banco menos o do sistema: para mais, faltou entrada; para menos, faltou saída. */
export function diferencaDoSaldo(saldoSistema: number, saldoInformado: number): number {
  return arredondar(saldoInformado - saldoSistema);
}

/** Registra a conferência. Só ajusta se a pessoa confirmar, com motivo: nada muda sozinho. */
export async function conferirSaldo(contaId: string, { data, saldoInformado, ajustar, motivo }: { data: string; saldoInformado: number; ajustar: boolean; motivo: string }, responsavelId: string, hoje: string = hojeISO()): Promise<ConferenciaSaldo> {
  if (data > hoje) throw new ErroDeRegra('A data não pode ser futura.');
  return emTransacao(async () => {
    const dados = await carregarSaldos();
    const conta = dados.contas.find((item) => item.id === contaId);
    if (!conta) throw new ErroDeRegra('Esta conta não existe mais.');
    const saldoSistema = saldoDaConta(conta, dados, data);
    if (saldoSistema === null) throw new ErroDeRegra('Esta conta não tem saldo controlado.');
    if (conta.data_saldo_inicial && data < conta.data_saldo_inicial) throw new ErroDeRegra('A conta começa depois disso: use uma data a partir do saldo inicial.');
    const diferenca = diferencaDoSaldo(saldoSistema, saldoInformado);
    let ajusteId: string | null = null;
    if (ajustar && diferenca !== 0) {
      if (!motivo.trim()) throw new ErroDeRegra('Diga por que está ajustando.');
      ajusteId = await criarAjusteDeSaldo(conta, data, diferenca, motivo.trim(), responsavelId, dados);
    }
    return repositorios.conferencia_saldo.criar({ conta_id: contaId, data, saldo_informado: saldoInformado, saldo_sistema: saldoSistema, diferenca, ajuste_titulo_id: ajusteId });
  });
}

/** Diferença para mais entra, para menos sai: um título quitado, com a origem "ajuste" e a baixa nesta conta. */
async function criarAjusteDeSaldo(conta: ContaFinanceira, data: string, diferenca: number, motivo: string, responsavelId: string, { categorias, cambios }: Pick<DadosDosSaldos, 'categorias' | 'cambios'>): Promise<string> {
  const entrada = diferenca > 0;
  const nomeDaCategoria = entrada ? 'Outras receitas' : 'Outros';
  const categoria = categorias.find((item) => item.nome === nomeDaCategoria && item.pai_id);
  if (!categoria) throw new ErroDeRegra(`A categoria “${nomeDaCategoria}” não está mais disponível.`);
  const valor = Math.abs(diferenca);
  // RT-07: somar moedas diferentes só depois de converter, e em conta estrangeira o único câmbio aqui é o de referência.
  const cotacao = conta.moeda === 'BRL' ? null : [...cambios].filter((item) => item.moeda === conta.moeda).sort((a, b) => b.data_referencia.localeCompare(a.data_referencia))[0]?.valor_brl;
  if (cotacao === undefined) throw new ErroDeRegra(`Cadastre o câmbio de referência de ${conta.moeda} em Configurações antes de ajustar.`);
  const titulo = await repositorios.titulo.criar({
    natureza: entrada ? 'receber' : 'pagar',
    descricao: `Ajuste de saldo: ${conta.nome}`,
    contraparte_id: null,
    beneficiario_pessoa_id: null,
    categoria_id: categoria.id,
    competencia: competenciaDoDia(data),
    vencimento: data,
    valor,
    moeda: conta.moeda,
    situacao: 'quitado',
    responsavel_id: responsavelId,
    entidade_id: null,
    origem: 'ajuste',
    origem_id: conta.id,
    chave_idempotencia: null,
    ajustado_manualmente: false,
    ferramenta_id: null,
    assinatura_id: null,
    periodo_inicio: null,
    periodo_fim: null,
    suspenso: false,
    cancelado_motivo: null,
    observacao: motivo,
  });
  await repositorios.titulo_rateio.criar({ titulo_id: titulo.id, produto_id: null, percentual: 100, valor });
  await repositorios.baixa.criar({
    titulo_id: titulo.id,
    tipo: 'pagamento',
    baixa_original_id: null,
    data,
    conta_financeira_id: conta.id,
    valor_moeda: valor,
    cambio: cotacao,
    iof_brl: null,
    valor_brl: cotacao === null ? valor : arredondar(valor * cotacao),
    comprovante_url: null,
    sem_comprovante_motivo: `Ajuste de saldo: ${motivo}`,
    tratamento: null,
    movimento_societario_id: null,
    titulo_reembolso_id: null,
    motivo,
    registrado_por: idDaPessoaAtual(),
  });
  return titulo.id;
}
