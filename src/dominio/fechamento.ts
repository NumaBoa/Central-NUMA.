/**
 * T05.10 Fechamento mensal (F1, RN-05.18). Um checklist por competência: o que a Central confere sozinha
 * (previstos, comprovantes, conferência dos saldos, KPIs, envio ao contador) e o que alguém marca à mão (rateios,
 * receitas por canal, reembolsos). Fechar bloqueia lançamentos, baixas e rateios da competência (`competencias.ts`);
 * com pendência, fechar exige dizer por quê. Reabrir exige motivo, e tudo fica no histórico.
 */
import { ErroDeRegra } from '@/dados/erros';
import { repositorios } from '@/dados/repositorios';
import type { CompetenciaFechamento } from '@/dados/tipos/fechamento';
import { hojeISO } from '@/lib/datas';
import { controlaSaldo } from './contas';
import { partesDeCusto, partesDeReceita, resultado, somar, type Soma } from './custos-relatorio';
import { lerFontes } from './custos-produto';
import { carregarSaldos, saldoDaConta } from './saldos';

export const ITENS_DO_FECHAMENTO = [
  { id: 'despesas', rotulo: 'Todas as despesas do mês lançadas, sem itens “a confirmar”', manual: false, href: '/financeiro' },
  { id: 'comprovantes', rotulo: 'Baixas com comprovante', manual: false, href: '/financeiro' },
  { id: 'saldos', rotulo: 'Saldos das contas conferidos', manual: false, href: '/financeiro/contas' },
  { id: 'rateios', rotulo: 'Rateios revisados', manual: true, href: '/financeiro/custos' },
  { id: 'receitas', rotulo: 'Receitas por canal lançadas', manual: true, href: '/financeiro/receitas' },
  { id: 'reembolsos', rotulo: 'Reembolsos a sócias em aberto revisados', manual: true, href: '/financeiro/socias' },
  { id: 'kpis', rotulo: 'KPIs mensais dos produtos preenchidos', manual: false, href: '/produtos' },
  { id: 'contador', rotulo: 'Pacote do contador gerado e enviado', manual: false, href: '/financeiro/contador' },
] as const;
export type IdDoItem = (typeof ITENS_DO_FECHAMENTO)[number]['id'];

export type ItemDoChecklist = { id: IdDoItem; rotulo: string; manual: boolean; href: string; ok: boolean; detalhe: string; marca: { por: string; em: string } | null };

const ultimoDia = (mes: string) => {
  const [ano, numero] = mes.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(ano, numero, 0)).toISOString().slice(0, 10);
};
const somarDias = (dia: string, dias: number) => {
  const data = new Date(`${dia}T00:00:00.000Z`);
  data.setUTCDate(data.getUTCDate() + dias);
  return data.toISOString().slice(0, 10);
};
const redondo = (valor: number) => Math.round((valor + Number.EPSILON) * 100) / 100;
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** O mês que se fecha por padrão: o anterior ao de hoje. */
export function competenciaPadrao(hoje: string): string {
  const [ano, mes] = hoje.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(ano, mes - 2, 1)).toISOString().slice(0, 7);
}

export type ResumoDoMes = { entradas: number; saidas: number; resultado: Soma; aportes: number; retiradas: number; saldos: { contaId: string; nome: string; moeda: string; saldo: number | null }[] };
export type TelaDoFechamento = { mes: string; registro: CompetenciaFechamento | null; itens: ItemDoChecklist[]; pendencias: number; resumo: ResumoDoMes; nomes: Record<string, string> };

export async function carregarFechamento(mes: string): Promise<TelaDoFechamento> {
  const [saldos, fontes, registros, receitas, kpis, produtos] = await Promise.all([carregarSaldos(), lerFontes(), repositorios.competencia_fechamento.listar(), repositorios.receita_canal.listar(), repositorios.kpi_mensal.listar(), repositorios.produto.listar()]);
  const inicio = `${mes}-01`;
  const fim = ultimoDia(mes);
  const registro = registros.find((linha) => linha.competencia === inicio) ?? null;
  const doMes = (dia: string) => dia >= inicio && dia <= fim;
  const tituloDe = new Map(saldos.titulos.map((titulo) => [titulo.id, titulo]));

  // 1. Previstos ("a confirmar") da competência.
  const previstos = saldos.titulos.filter((titulo) => !titulo.arquivado_em && titulo.natureza === 'pagar' && titulo.situacao === 'previsto' && titulo.competencia.slice(0, 7) === mes);
  // 2. Pagamentos do mês sem comprovante e sem a exceção justificada (D17).
  const semComprovante = saldos.baixas.filter((baixa) => !baixa.arquivado_em && baixa.tipo === 'pagamento' && doMes(baixa.data) && !baixa.comprovante_url && !baixa.sem_comprovante_motivo);
  // 3. Cada conta com saldo controlado conferida no mês ou até o dia 10 do mês seguinte (T05.07).
  const controladas = saldos.contas.filter((conta) => !conta.arquivado_em && conta.situacao === 'ativa' && controlaSaldo(conta.tipo));
  const limiteDaConferencia = somarDias(fim, 10);
  const naoConferidas = controladas.filter((conta) => !saldos.conferencias.some((conferencia) => conferencia.conta_id === conta.id && conferencia.data >= inicio && conferencia.data <= limiteDaConferencia));
  // 7. KPIs mensais dos produtos ativos (M07).
  const ativos = produtos.filter((produto) => !produto.arquivado_em && produto.situacao !== 'descontinuado');
  const semKpi = ativos.filter((produto) => !kpis.some((kpi) => kpi.produto_id === produto.id && kpi.competencia === inicio));
  const reembolsosAbertos = saldos.titulos.filter((titulo) => !titulo.arquivado_em && titulo.origem === 'reembolso' && ['aberto', 'parcial', 'previsto'].includes(titulo.situacao)).length;
  const receitasDoMes = receitas.filter((linha) => linha.competencia === inicio).length;

  const automatico: Record<string, { ok: boolean; detalhe: string }> = {
    despesas: { ok: previstos.length === 0, detalhe: previstos.length ? `${plural(previstos.length, 'previsto', 'previstos')} a confirmar` : 'Nenhum previsto a confirmar' },
    comprovantes: { ok: semComprovante.length === 0, detalhe: semComprovante.length ? `${plural(semComprovante.length, 'pagamento', 'pagamentos')} sem comprovante: ${semComprovante.slice(0, 3).map((baixa) => tituloDe.get(baixa.titulo_id)?.descricao ?? 'Título').join(', ')}` : 'Todos com comprovante ou exceção justificada' },
    saldos: { ok: naoConferidas.length === 0, detalhe: !controladas.length ? 'Nenhuma conta com saldo controlado' : naoConferidas.length ? `Falta conferir: ${naoConferidas.map((conta) => conta.nome).join(', ')}` : 'Todas conferidas' },
    contador: { ok: Boolean(registro?.envios_contador?.length), detalhe: registro?.envios_contador?.length ? `Enviado em ${registro.envios_contador.at(-1)!.data.split('-').reverse().join('/')} para ${registro.envios_contador.at(-1)!.para}` : 'Gere o pacote e registre o envio em Financeiro › Contador' },
    kpis: { ok: semKpi.length === 0, detalhe: semKpi.length ? `Falta: ${semKpi.map((produto) => produto.nome).join(', ')}` : 'Todos preenchidos' },
  };
  const manual: Record<string, string> = {
    rateios: 'Confira os rateios do mês em Resultado por produto',
    receitas: receitasDoMes ? `${plural(receitasDoMes, 'lançamento', 'lançamentos')} no mês` : 'Nenhum lançamento de canal no mês',
    reembolsos: reembolsosAbertos ? `${plural(reembolsosAbertos, 'reembolso', 'reembolsos')} em aberto` : 'Nenhum reembolso em aberto',
  };
  const itens: ItemDoChecklist[] = ITENS_DO_FECHAMENTO.map((item) => {
    const marca = registro?.checklist[item.id] ?? null;
    return item.manual ? { ...item, ok: Boolean(marca), detalhe: manual[item.id]!, marca } : { ...item, ...automatico[item.id]!, marca: null };
  });

  // Resumo do mês (pelo caixa: baixas e movimentos com data no mês; resultado pela competência).
  const doMesEmReais = saldos.baixas.filter((baixa) => !baixa.arquivado_em && doMes(baixa.data));
  const sinal = (tipo: string) => (tipo === 'estorno' ? -1 : 1);
  const entradas = redondo(doMesEmReais.filter((baixa) => tituloDe.get(baixa.titulo_id)?.natureza === 'receber').reduce((soma, baixa) => soma + sinal(baixa.tipo) * baixa.valor_brl, 0));
  const saidas = redondo(doMesEmReais.filter((baixa) => tituloDe.get(baixa.titulo_id)?.natureza === 'pagar').reduce((soma, baixa) => soma + sinal(baixa.tipo) * baixa.valor_brl, 0));
  const periodo = { de: mes, ate: mes, natureza: '' as const, incluirInvestimento: true };
  const movimentos = saldos.movimentos.filter((movimento) => !movimento.arquivado_em && doMes(movimento.data));
  const resumo: ResumoDoMes = {
    entradas,
    saidas,
    resultado: resultado(somar(partesDeReceita(fontes, periodo)), somar(partesDeCusto(fontes, periodo))),
    aportes: redondo(movimentos.filter((movimento) => movimento.tipo === 'aporte').reduce((soma, movimento) => soma + movimento.valor_brl, 0)),
    retiradas: redondo(movimentos.filter((movimento) => movimento.tipo !== 'aporte').reduce((soma, movimento) => soma + movimento.valor_brl, 0)),
    saldos: controladas.map((conta) => ({ contaId: conta.id, nome: conta.nome, moeda: conta.moeda, saldo: saldoDaConta(conta, saldos, fim) })),
  };
  const nomes = Object.fromEntries(saldos.pessoas.map((pessoa) => [pessoa.id, pessoa.nome_exibicao ?? pessoa.nome_completo]));
  return { mes, registro, itens, pendencias: itens.filter((item) => !item.ok).length, resumo, nomes };
}

async function registroDoMes(mes: string): Promise<CompetenciaFechamento> {
  const competencia = `${mes}-01`;
  const existente = (await repositorios.competencia_fechamento.listar({ onde: { competencia } }))[0];
  if (existente) return existente;
  return repositorios.competencia_fechamento.criar({ competencia, situacao: 'em_fechamento', checklist: {}, fechada_em: null, fechada_por: null, fechada_com_pendencias: null, reaberta_em: null, reaberta_motivo: null, envios_contador: [], exemplo: false });
}

/** Marca ou desmarca um item conferido à mão. Competência fechada não muda. */
export async function marcarItem(mes: string, item: IdDoItem, feito: boolean, responsavelId: string): Promise<void> {
  if (!responsavelId) throw new ErroDeRegra('Escolha quem você é, no topo, antes de marcar o item.');
  if (!ITENS_DO_FECHAMENTO.find((linha) => linha.id === item)?.manual) throw new ErroDeRegra('Este item a Central confere sozinha.');
  const registro = await registroDoMes(mes);
  if (registro.situacao === 'fechada') throw new ErroDeRegra('A competência está fechada. Reabra para mudar o checklist.');
  const checklist = { ...registro.checklist };
  if (feito) checklist[item] = { por: responsavelId, em: new Date().toISOString() };
  else delete checklist[item];
  await repositorios.competencia_fechamento.atualizar(registro.id, { checklist, situacao: 'em_fechamento' });
}

/** `fechar_competencia` (P5). O mês corrente e os futuros não fecham. Com pendência, exige o motivo. */
export async function fecharCompetencia(mes: string, responsavelId: string, motivoDasPendencias: string, hoje: string = hojeISO()): Promise<void> {
  if (!responsavelId) throw new ErroDeRegra('Escolha quem você é, no topo, antes de fechar a competência.');
  if (mes >= hoje.slice(0, 7)) throw new ErroDeRegra('Só se fecha um mês que já terminou.');
  const tela = await carregarFechamento(mes);
  if (tela.registro?.situacao === 'fechada') throw new ErroDeRegra('Esta competência já está fechada.');
  const motivo = motivoDasPendencias.trim();
  if (tela.pendencias && !motivo) throw new ErroDeRegra('Há itens pendentes: diga por que fechar assim mesmo.');
  const registro = await registroDoMes(mes);
  await repositorios.competencia_fechamento.atualizar(registro.id, { situacao: 'fechada', fechada_em: new Date().toISOString(), fechada_por: responsavelId, fechada_com_pendencias: tela.pendencias ? motivo : null });
}

/** `reabrir_competencia` (RN-05.18): exige motivo; o histórico guarda quem reabriu. */
export async function reabrirCompetencia(mes: string, motivo: string, responsavelId: string): Promise<void> {
  const limpo = motivo.trim();
  if (!limpo) throw new ErroDeRegra('Reabrir exige motivo.');
  if (!responsavelId) throw new ErroDeRegra('Escolha quem você é, no topo, antes de reabrir.');
  const registro = (await repositorios.competencia_fechamento.listar({ onde: { competencia: `${mes}-01` } }))[0];
  if (!registro || registro.situacao !== 'fechada') throw new ErroDeRegra('Esta competência não está fechada.');
  await repositorios.competencia_fechamento.atualizar(registro.id, { situacao: 'aberta', reaberta_em: new Date().toISOString(), reaberta_motivo: limpo }, { motivo: limpo });
}
