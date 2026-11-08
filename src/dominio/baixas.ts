/** T05.03 e T05.04: registrar, estornar e ajustar baixas; editar, cancelar e confirmar títulos. */
import { z } from 'zod';
import { ErroDeRegra } from '@/dados/erros';
import { repositorios } from '@/dados/repositorios';
import { garantirCompetenciaAberta } from './competencias';
import { idDaPessoaAtual } from '@/dados/sessao';
import { emTransacao } from '@/dados/transacao';
import type { ContaFinanceira } from '@/dados/tipos/financeiro';
import type { Baixa, MovimentoSocietario, Titulo } from '@/dados/tipos/titulo';
import { hojeISO } from '@/lib/datas';
import { lerCambio, lerValor, valorParaCampo } from './dinheiro';
import { sincronizarAlertasDosTitulos } from './alertas';
import { carregarLancamentos, type DadosDosLancamentos, type LinhaDoTitulo } from './lancamentos';
import { linkDoDriveValido, MENSAGEM_LINK_DRIVE } from './link-drive';
import { erroDoRateioDoTitulo, recalcularRateio, refazerTratamento, registrarPagamento, saldoDoTitulo, situacaoPelasBaixas, valorEmReais, type DadosDoPagamento } from './titulos';

const textoCurto = z.string().trim();
const arredondar = (valor: number) => Math.round((valor + Number.EPSILON) * 100) / 100;

// ---------- T05.04: o diálogo ----------

export const esquemaBaseBaixa = z.object({
  tipo: z.enum(['pagamento', 'estorno', 'ajuste']),
  baixa_original_id: z.string(),
  data: z.string(),
  conta_id: z.string(),
  valor: textoCurto,
  cambio: textoCurto,
  iof: textoCurto,
  valor_brl: textoCurto,
  pago_a_mais: z.boolean(),
  comprovante_url: textoCurto,
  sem_comprovante: z.boolean(),
  sem_comprovante_motivo: textoCurto,
  tratamento: z.enum(['', 'aporte', 'reembolso']),
  vencimento_reembolso: z.string(),
  motivo: textoCurto,
});

export type FormularioBaixa = z.infer<typeof esquemaBaseBaixa>;

export function formularioBaixaVazio(titulo: Pick<Titulo, 'moeda'>, saldo: number, hoje: string = hojeISO()): FormularioBaixa {
  const emReais = titulo.moeda === 'BRL';
  return { tipo: 'pagamento', baixa_original_id: '', data: hoje, conta_id: '', valor: saldo > 0 ? valorParaCampo(saldo) : '', cambio: '', iof: '', valor_brl: emReais && saldo > 0 ? valorParaCampo(saldo) : '', pago_a_mais: false, comprovante_url: '', sem_comprovante: false, sem_comprovante_motivo: '', tratamento: '', vencimento_reembolso: '', motivo: '' };
}

const numeroPositivo = (texto: string) => {
  const valor = lerValor(texto);
  return valor !== null && valor > 0;
};

/** O que vale para este título: o saldo, a moeda e o tipo da conta. */
export function criarEsquemaBaixa(titulo: Pick<Titulo, 'moeda' | 'origem'>, saldo: number, contas: readonly Pick<ContaFinanceira, 'id' | 'tipo'>[], hoje: string = hojeISO()) {
  return esquemaBaseBaixa.superRefine((dados, contexto) => {
    const falha = (campo: keyof FormularioBaixa, message: string) => contexto.addIssue({ code: 'custom', path: [campo], message });
    if (dados.tipo === 'estorno') {
      if (!dados.baixa_original_id) falha('baixa_original_id', 'Escolha o pagamento a estornar.');
      if (!dados.motivo) falha('motivo', 'Diga por que está estornando.');
      return;
    }
    if (!dados.data) falha('data', 'Informe a data.');
    else if (dados.data > hoje) falha('data', 'A data não pode ser futura.');
    if (!dados.conta_id) falha('conta_id', 'Escolha a conta.');
    const valor = lerValor(dados.valor);
    if (!numeroPositivo(dados.valor)) falha('valor', 'Informe o valor, como 0,00.');
    if (titulo.moeda !== 'BRL') {
      if (!(Number(lerCambio(dados.cambio)) > 0)) falha('cambio', 'Informe o câmbio pago.');
      if (dados.iof && lerValor(dados.iof) === null) falha('iof', 'Use só números, como 0,00.');
      if (!numeroPositivo(dados.valor_brl)) falha('valor_brl', 'Informe o valor efetivo em reais.');
    }
    if (dados.sem_comprovante) {
      if (!dados.sem_comprovante_motivo) falha('sem_comprovante_motivo', 'Diga por que não tem comprovante.');
    } else if (!dados.comprovante_url) falha('comprovante_url', 'Cole o link do comprovante, ou marque que não tem.');
    else if (!linkDoDriveValido(dados.comprovante_url)) falha('comprovante_url', MENSAGEM_LINK_DRIVE);
    if (dados.tipo === 'ajuste') {
      if (!dados.motivo) falha('motivo', 'Diga do que é o ajuste.');
      return;
    }
    // RN-05.03.
    if (valor !== null && valor > saldo && !dados.pago_a_mais) falha('valor', 'É mais que o saldo. Se pagou juros ou multa, marque “Valor pago maior”.');
    const deSocia = contas.find((conta) => conta.id === dados.conta_id)?.tipo === 'pessoal_socia';
    if (deSocia && titulo.origem === 'reembolso') falha('conta_id', 'O reembolso é pago pela Numa: escolha uma conta da empresa.');
    else if (deSocia) {
      if (!dados.tratamento) falha('tratamento', 'Conta de sócia: escolha entre aporte e reembolso.');
      if (dados.tratamento === 'reembolso' && !dados.vencimento_reembolso) falha('vencimento_reembolso', 'Informe quando a Numa vai reembolsar.');
    }
  });
}

function pagamentoDoFormulario(formulario: FormularioBaixa, moeda: string): DadosDoPagamento {
  const valor = lerValor(formulario.valor) as number;
  const estrangeira = moeda !== 'BRL';
  return {
    data: formulario.data,
    contaId: formulario.conta_id,
    valorMoeda: valor,
    cambio: estrangeira ? lerCambio(formulario.cambio) : null,
    iofBrl: estrangeira ? lerValor(formulario.iof) : null,
    valorBrl: estrangeira ? (lerValor(formulario.valor_brl) as number) : valor,
    comprovanteUrl: formulario.sem_comprovante ? null : formulario.comprovante_url,
    semComprovanteMotivo: formulario.sem_comprovante ? formulario.sem_comprovante_motivo : null,
    tratamento: formulario.tratamento || null,
    vencimentoReembolso: formulario.vencimento_reembolso || null,
    pagoAMais: formulario.pago_a_mais,
    motivo: formulario.motivo || null,
  };
}

/** RN-03.12 e CA-03.11: o que muda aqui chega ao Meu dia sem esperar a rotina do dia. */
async function avisarAlertas(ids: readonly (string | null | undefined)[], hoje?: string): Promise<void> {
  const unicos = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (unicos.length) await sincronizarAlertasDosTitulos(unicos, hoje);
}

export async function registrarBaixa(titulo: Pick<Titulo, 'id' | 'moeda'>, formulario: FormularioBaixa, hoje: string = hojeISO()): Promise<void> {
  if (formulario.tipo === 'estorno') {
    await estornarBaixa(formulario.baixa_original_id, formulario.motivo, hoje);
    return;
  }
  if (formulario.tipo === 'ajuste') {
    await registrarAjuste(titulo.id, pagamentoDoFormulario(formulario, titulo.moeda), formulario.motivo, hoje);
    return;
  }
  await registrarPagamento(titulo.id, pagamentoDoFormulario(formulario, titulo.moeda), hoje);
  await avisarAlertas([titulo.id], hoje);
}

/** Juros, multa, tarifa: sai do caixa e não mexe no saldo do título. */
export async function registrarAjuste(tituloId: string, dados: DadosDoPagamento, motivo: string, hoje: string = hojeISO()): Promise<void> {
  if (dados.data > hoje) throw new ErroDeRegra('A data não pode ser futura.');
  if (!motivo.trim()) throw new ErroDeRegra('Diga do que é o ajuste.');
  await repositorios.baixa.criar({
    titulo_id: tituloId,
    tipo: 'ajuste',
    baixa_original_id: null,
    data: dados.data,
    conta_financeira_id: dados.contaId,
    valor_moeda: dados.valorMoeda,
    cambio: dados.cambio,
    iof_brl: dados.iofBrl,
    valor_brl: dados.valorBrl,
    comprovante_url: dados.comprovanteUrl,
    sem_comprovante_motivo: dados.semComprovanteMotivo,
    tratamento: null,
    movimento_societario_id: null,
    titulo_reembolso_id: null,
    motivo: motivo.trim(),
    registrado_por: idDaPessoaAtual(),
  });
}

/** Pagamentos que ainda podem ser estornados. */
export function pagamentosEstornaveis(baixas: readonly Baixa[]): Baixa[] {
  const estornados = new Set(baixas.filter((baixa) => baixa.tipo === 'estorno').map((baixa) => baixa.baixa_original_id));
  return baixas.filter((baixa) => baixa.tipo === 'pagamento' && !baixa.arquivado_em && !estornados.has(baixa.id));
}

/** RN-05.04: baixa negativa, ligada à original, que nunca é apagada. Desfaz também o aporte ou o reembolso que nasceu dela. */
export async function estornarBaixa(baixaId: string, motivo: string, hoje: string = hojeISO()): Promise<void> {
  const limpo = motivo.trim();
  if (!limpo) throw new ErroDeRegra('Diga por que está estornando.');
  let afetados: (string | null)[] = [];
  await emTransacao(async () => {
    const original = await repositorios.baixa.obter(baixaId);
    if (!original || original.tipo !== 'pagamento') throw new ErroDeRegra('Escolha o pagamento a estornar.');
    afetados = [original.titulo_id, original.titulo_reembolso_id];
    const doTitulo = await repositorios.baixa.listar({ onde: { titulo_id: original.titulo_id } });
    if (doTitulo.some((baixa) => baixa.tipo === 'estorno' && baixa.baixa_original_id === baixaId)) throw new ErroDeRegra('Este pagamento já foi estornado.');
    await refazerTratamento(original, null, null, limpo);
    await repositorios.baixa.criar({
      titulo_id: original.titulo_id,
      tipo: 'estorno',
      baixa_original_id: baixaId,
      data: hoje,
      conta_financeira_id: original.conta_financeira_id,
      valor_moeda: original.valor_moeda,
      cambio: original.cambio,
      iof_brl: original.iof_brl,
      valor_brl: original.valor_brl,
      comprovante_url: original.comprovante_url,
      sem_comprovante_motivo: original.sem_comprovante_motivo,
      tratamento: null,
      movimento_societario_id: null,
      titulo_reembolso_id: null,
      motivo: limpo,
      registrado_por: idDaPessoaAtual(),
    });
    // Juros pagos junto saem com o pagamento: o que foi pago volta inteiro.
    for (const ajuste of doTitulo.filter((baixa) => baixa.tipo === 'ajuste' && baixa.baixa_original_id === baixaId)) await repositorios.baixa.arquivar(ajuste.id, limpo);
    const titulo = await repositorios.titulo.obter(original.titulo_id);
    if (titulo) {
      const baixas = await repositorios.baixa.listar({ onde: { titulo_id: titulo.id } });
      await repositorios.titulo.atualizar(titulo.id, { situacao: situacaoPelasBaixas(titulo, baixas) });
    }
  });
  await avisarAlertas(afetados, hoje);
}

/** RN-05.06: o tratamento pode mudar depois, com motivo, desfazendo e refazendo o que nasceu dele. */
export async function alterarTratamento(baixaId: string, novo: NonNullable<Baixa['tratamento']>, vencimentoReembolso: string | null, motivo: string): Promise<void> {
  const limpo = motivo.trim();
  if (!limpo) throw new ErroDeRegra('Diga por que o tratamento mudou.');
  let antes: (string | null)[] = [];
  await emTransacao(async () => {
    const baixa = await repositorios.baixa.obter(baixaId);
    if (!baixa) throw new ErroDeRegra('Esta baixa não existe mais.');
    if (baixa.tratamento === novo) throw new ErroDeRegra('Este já é o tratamento.');
    antes = [baixa.titulo_id, baixa.titulo_reembolso_id];
    await refazerTratamento(baixa, novo, vencimentoReembolso, limpo);
  });
  await avisarAlertas([...antes, (await repositorios.baixa.obter(baixaId))?.titulo_reembolso_id]);
}

// ---------- Baixa em lote (T05.01) ----------

export type DadosDoLote = Pick<DadosDoPagamento, 'data' | 'contaId' | 'comprovanteUrl' | 'semComprovanteMotivo' | 'tratamento' | 'vencimentoReembolso'>;

export function erroDoLote(titulos: readonly Pick<LinhaDoTitulo, 'moeda' | 'saldo' | 'situacao' | 'origem'>[], deSocia: boolean): string | null {
  if (!titulos.length) return 'Selecione ao menos um título.';
  if (titulos.some((titulo) => titulo.moeda !== 'BRL')) return 'Em moeda estrangeira, cada baixa tem o próprio câmbio: registre uma por uma.';
  if (titulos.some((titulo) => titulo.situacao === 'cancelado' || titulo.saldo <= 0)) return 'Há títulos sem saldo na seleção.';
  if (deSocia && titulos.some((titulo) => titulo.origem === 'reembolso')) return 'Reembolso é pago pela Numa: escolha uma conta da empresa.';
  return null;
}

/** O saldo inteiro de cada um, com a mesma conta e a mesma data. Ou todos, ou nenhum. */
export async function registrarBaixaEmLote(ids: readonly string[], dados: DadosDoLote, hoje: string = hojeISO()): Promise<number> {
  await emTransacao(async () => {
    for (const id of ids) {
      const titulo = await repositorios.titulo.obter(id);
      if (!titulo) continue;
      const saldo = saldoDoTitulo(titulo, await repositorios.baixa.listar({ onde: { titulo_id: id } }));
      await registrarPagamento(id, { ...dados, valorMoeda: saldo, cambio: null, iofBrl: null, valorBrl: saldo, pagoAMais: false, motivo: null }, hoje);
    }
  });
  await avisarAlertas(ids, hoje);
  return ids.length;
}

// ---------- Editar, confirmar e cancelar (T05.03) ----------

export const esquemaFormularioTitulo = z.object({
  descricao: z.string().trim().min(1, 'Diga o que é este lançamento.'),
  contraparte_id: z.string(),
  categoria_id: z.string().min(1, 'Escolha a categoria.'),
  competencia: z.string().min(1, 'Informe a competência.'),
  vencimento: z.string().min(1, 'Informe o vencimento.'),
  valor: z.string().trim().refine(numeroPositivo, 'Informe o valor, como 0,00.'),
  responsavel_id: z.string().min(1, 'Escolha a responsável.'),
  observacao: textoCurto,
  motivo: textoCurto,
});

export type FormularioTitulo = z.infer<typeof esquemaFormularioTitulo>;

export function formularioDoTitulo(titulo: Titulo): FormularioTitulo {
  return { descricao: titulo.descricao, contraparte_id: titulo.contraparte_id ?? '', categoria_id: titulo.categoria_id, competencia: titulo.competencia.slice(0, 7), vencimento: titulo.vencimento, valor: valorParaCampo(titulo.valor), responsavel_id: titulo.responsavel_id, observacao: titulo.observacao ?? '', motivo: '' };
}

/** RN-05.13: mudar valor ou vencimento de um título gerado pede motivo, e ele deixa de ser sobrescrito. */
export function edicaoPedeMotivo(titulo: Pick<Titulo, 'origem' | 'valor' | 'vencimento'>, formulario: Pick<FormularioTitulo, 'valor' | 'vencimento'>): boolean {
  return titulo.origem !== 'manual' && (lerValor(formulario.valor) !== titulo.valor || formulario.vencimento !== titulo.vencimento);
}

export async function salvarTitulo(id: string, formulario: FormularioTitulo): Promise<Titulo> {
  const salvo = await gravarTitulo(id, formulario);
  // CA-03.13: adiar o vencimento atualiza o alerta aberto, sem outro.
  await avisarAlertas([id]);
  return salvo;
}

async function gravarTitulo(id: string, formulario: FormularioTitulo): Promise<Titulo> {
  return emTransacao(async () => {
    const titulo = await repositorios.titulo.obter(id);
    if (!titulo) throw new ErroDeRegra('Este título não existe mais.');
    if (titulo.situacao === 'cancelado' || titulo.situacao === 'quitado') throw new ErroDeRegra('Título quitado ou cancelado não se edita.');
    await garantirCompetenciaAberta(titulo.competencia);
    await garantirCompetenciaAberta(formulario.competencia);
    const valor = lerValor(formulario.valor) as number;
    const baixas = await repositorios.baixa.listar({ onde: { titulo_id: id } });
    const pago = arredondar(titulo.valor - saldoDoTitulo(titulo, baixas));
    if (valor < pago) throw new ErroDeRegra('O valor não pode ser menor que o que já foi pago.');
    const pedeMotivo = edicaoPedeMotivo(titulo, formulario);
    if (pedeMotivo && !formulario.motivo.trim()) throw new ErroDeRegra('Diga por que este título gerado mudou.');
    const novo = await repositorios.titulo.atualizar(
      id,
      {
        descricao: formulario.descricao,
        contraparte_id: formulario.contraparte_id || null,
        categoria_id: formulario.categoria_id,
        competencia: `${formulario.competencia}-01`,
        vencimento: formulario.vencimento,
        valor,
        responsavel_id: formulario.responsavel_id,
        observacao: formulario.observacao || null,
        ajustado_manualmente: titulo.ajustado_manualmente || pedeMotivo,
      },
      pedeMotivo ? { motivo: formulario.motivo.trim() } : undefined,
    );
    if (valor !== titulo.valor) await recalcularRateio(id, valor);
    const situacao = situacaoPelasBaixas(novo, baixas);
    return situacao !== novo.situacao ? repositorios.titulo.atualizar(id, { situacao }) : novo;
  });
}

/** Previsto vira em aberto quando a cobrança se confirma. */
export async function confirmarTitulo(id: string): Promise<void> {
  const titulo = await repositorios.titulo.obter(id);
  if (titulo?.situacao !== 'previsto') throw new ErroDeRegra('Só título previsto precisa de confirmação.');
  await repositorios.titulo.atualizar(id, { situacao: 'aberto' });
  await avisarAlertas([id]);
}

/** RN-05.14: exige motivo, e título com baixas precisa de estorno antes. */
export async function cancelarTitulo(id: string, motivo: string): Promise<void> {
  const limpo = motivo.trim();
  if (!limpo) throw new ErroDeRegra('Diga por que está cancelando.');
  const titulo = await repositorios.titulo.obter(id);
  if (!titulo) throw new ErroDeRegra('Este título não existe mais.');
  const baixas = await repositorios.baixa.listar({ onde: { titulo_id: id } });
  if (saldoDoTitulo(titulo, baixas) !== titulo.valor) throw new ErroDeRegra('Este título tem pagamentos. Estorne antes de cancelar.');
  // Marcado à mão, a geração não traz de volta (RN-05.13).
  await repositorios.titulo.atualizar(id, { situacao: 'cancelado', cancelado_motivo: limpo, ajustado_manualmente: true }, { motivo: limpo });
  await avisarAlertas([id]);
}

export type LinhaRateioDoTitulo = { ligacaoId: string; percentual: string };

/** T05.03, aba Rateio. */
export async function editarRateioDoTitulo(id: string, linhas: readonly LinhaRateioDoTitulo[]): Promise<void> {
  const erro = erroDoRateioDoTitulo(linhas);
  if (erro) throw new ErroDeRegra(erro);
  await emTransacao(async () => {
    for (const { ligacaoId, percentual } of linhas) await repositorios.titulo_rateio.atualizar(ligacaoId, { percentual: lerValor(percentual) as number });
    const titulo = await repositorios.titulo.obter(id);
    if (titulo) await recalcularRateio(id, titulo.valor);
  });
}

// ---------- Ficha ----------

export type FichaDoTitulo = {
  titulo: LinhaDoTitulo;
  dados: DadosDosLancamentos;
  /** A despesa de onde um reembolso nasceu. */
  origem: Titulo | null;
  /** Os reembolsos que nasceram das baixas deste título. */
  reembolsos: Titulo[];
  movimentos: MovimentoSocietario[];
};

export async function carregarFichaDoTitulo(id: string, hoje: string = hojeISO()): Promise<FichaDoTitulo | null> {
  const dados = await carregarLancamentos(hoje);
  const titulo = dados.titulos.find((item) => item.id === id);
  if (!titulo) return null;
  const movimentos = await repositorios.movimento_societario.listar({ onde: { titulo_origem_id: id }, incluirArquivados: true });
  return {
    titulo,
    dados,
    origem: titulo.origem === 'reembolso' ? (dados.titulos.find((item) => item.id === titulo.origem_id) ?? null) : null,
    reembolsos: dados.titulos.filter((item) => item.origem === 'reembolso' && item.origem_id === id),
    movimentos,
  };
}

/** Valor em reais sugerido no diálogo (RN-05.05). */
export function sugestaoEmReais(formulario: Pick<FormularioBaixa, 'valor' | 'cambio' | 'iof'>): string | null {
  const valor = lerValor(formulario.valor);
  const cambio = lerCambio(formulario.cambio);
  return valor !== null && cambio !== null && cambio > 0 ? valorParaCampo(valorEmReais(valor, cambio, lerValor(formulario.iof))) : null;
}
