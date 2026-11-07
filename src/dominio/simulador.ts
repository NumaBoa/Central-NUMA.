/**
 * Simulador de preços (M07 §4). Só contas, sem acesso a dados: é a mesma implementação na tela, ao salvar e
 * na aprovação. Calcula com precisão completa; arredondar é trabalho de quem mostra.
 */
import type { CanalDaSimulacao, LinhaDeResultado, Premissas, Resultados } from '@/dados/tipos/precificacao';

export const MAXIMO_DE_CANAIS = 4;
export const MAXIMO_DE_VOLUMES = 5;
export const VOLUMES_PADRAO = [10, 50, 200] as const;

export const MENSAGEM_TAXAS_100 = 'Taxas, tributos e margem somam 100% ou mais';
export const AVISO_ESTIMATIVA = 'Estimativa — não é garantia de resultado';

/** Folga para somas como 33,3 + 33,3 + 33,4 não escaparem do bloqueio por causa do ponto flutuante. */
const FOLGA = 1e-9;

export function premissasVazias(): Premissas {
  return {
    moeda: 'BRL',
    periodicidade: 'mensal',
    cf: null,
    cf_calculado: null,
    cf_justificativa: null,
    cv: null,
    tributos_pct: null,
    margem_pct: null,
    // D20: as horas entram por padrão, e o valor-hora nunca vem preenchido.
    incluir_horas: true,
    horas: null,
    valor_hora: null,
    canais: [],
    volumes: [...VOLUMES_PADRAO],
    preco_teste: null,
    principal: null,
  };
}

/** Anual é dividido por 12 para comparar, e a taxa fixa cai uma vez por cobrança, não doze (LEIA-ME do M07). */
export function mesesDaCobranca(periodicidade: Premissas['periodicidade']): number {
  return periodicidade === 'anual' ? 12 : 1;
}

/** O preço informado, no equivalente mensal. */
export function precoMensal(preco: number, periodicidade: Premissas['periodicidade']): number {
  return preco / mesesDaCobranca(periodicidade);
}

/** Valor mensal de volta para o que se cobra: em plano anual, 12 meses. */
export function precoDaCobranca(mensal: number, periodicidade: Premissas['periodicidade']): number {
  return mensal * mesesDaCobranca(periodicidade);
}

/** Horas × valor-hora, ou `null` quando falta algum dos dois. Sem a opção marcada, não entra. */
function custoDasHoras(premissas: Premissas): number | null {
  if (!premissas.incluir_horas) return 0;
  if (premissas.horas === null || premissas.valor_hora === null) return null;
  return premissas.horas * premissas.valor_hora;
}

/** O que falta de cada origem, sem repetir, na ordem das premissas (RN-07.16). */
export function faltasDasPremissas(premissas: Premissas): string[] {
  const faltas: string[] = [];
  if (premissas.cf === null) faltas.push('custo fixo');
  if (premissas.cv === null) faltas.push('custo variável');
  if (premissas.tributos_pct === null) faltas.push('tributos');
  if (premissas.margem_pct === null) faltas.push('margem desejada');
  if (premissas.incluir_horas) {
    if (premissas.horas === null) faltas.push('horas das fundadoras');
    if (premissas.valor_hora === null) faltas.push('valor-hora');
  }
  if (!premissas.canais.length) faltas.push('canal de venda');
  for (const canal of premissas.canais) {
    if (canal.taxa_percentual === null) faltas.push(`taxa percentual de ${canal.nome}`);
    if (canal.taxa_fixa === null) faltas.push(canal.taxa_fixa_original !== null && canal.taxa_fixa_moeda ? `câmbio de ${canal.taxa_fixa_moeda} para ${canal.nome}` : `taxa fixa de ${canal.nome}`);
  }
  if (!premissas.volumes.length) faltas.push('volume de clientes');
  if (premissas.preco_teste === null) faltas.push('preço de teste');
  return faltas;
}

/** RN-07.12: `1 − t_c − t_i − m ≤ 0`, ou `null` enquanto faltar alguma das três. */
export function canalBloqueado(canal: Pick<CanalDaSimulacao, 'taxa_percentual'>, premissas: Pick<Premissas, 'tributos_pct' | 'margem_pct'>): boolean {
  if (canal.taxa_percentual === null || premissas.tributos_pct === null || premissas.margem_pct === null) return false;
  return 100 - canal.taxa_percentual - premissas.tributos_pct - premissas.margem_pct <= FOLGA;
}

/** Só as taxas e os tributos: quando somam 100% ou mais, nem o piso existe. */
function semPiso(canal: Pick<CanalDaSimulacao, 'taxa_percentual'>, premissas: Pick<Premissas, 'tributos_pct'>): boolean {
  if (canal.taxa_percentual === null || premissas.tributos_pct === null) return false;
  return 100 - canal.taxa_percentual - premissas.tributos_pct <= FOLGA;
}

/** `RL = p × (1 − t_c − t_i) − f_c`, com `p` e `f_c` já no equivalente mensal. */
function receitaLiquidaPorCliente(canal: CanalDaSimulacao, premissas: Premissas): number | null {
  if (premissas.preco_teste === null || canal.taxa_percentual === null || canal.taxa_fixa === null || premissas.tributos_pct === null) return null;
  const meses = mesesDaCobranca(premissas.periodicidade);
  return (premissas.preco_teste / meses) * ((100 - canal.taxa_percentual - premissas.tributos_pct) / 100) - canal.taxa_fixa / meses;
}

/** `MC = RL − CV`, por cliente e por mês. */
function margemDeContribuicao(canal: CanalDaSimulacao, premissas: Premissas): number | null {
  const receita = receitaLiquidaPorCliente(canal, premissas);
  return receita === null || premissas.cv === null ? null : receita - premissas.cv;
}

function calcularLinha(canal: CanalDaSimulacao, volume: number, premissas: Premissas): LinhaDeResultado {
  const horas = custoDasHoras(premissas);
  const meses = mesesDaCobranca(premissas.periodicidade);
  const cheio = premissas.cf === null || horas === null ? null : premissas.cf + horas;
  const custoFixoPorCliente = cheio === null ? null : cheio / volume;
  const custoPorCliente = custoFixoPorCliente === null || premissas.cv === null ? null : premissas.cv + custoFixoPorCliente;
  const taxaFixaMensal = canal.taxa_fixa === null ? null : canal.taxa_fixa / meses;
  const bloqueado = canalBloqueado(canal, premissas);
  const taxasCompletas = canal.taxa_percentual !== null && premissas.tributos_pct !== null;

  const baseDoPreco = custoPorCliente === null || taxaFixaMensal === null ? null : custoPorCliente + taxaFixaMensal;
  const preco_sugerido = baseDoPreco === null || !taxasCompletas || premissas.margem_pct === null || bloqueado ? null : baseDoPreco / ((100 - (canal.taxa_percentual as number) - (premissas.tributos_pct as number) - premissas.margem_pct) / 100);
  const piso = baseDoPreco === null || !taxasCompletas || semPiso(canal, premissas) ? null : baseDoPreco / ((100 - (canal.taxa_percentual as number) - (premissas.tributos_pct as number)) / 100);

  const receita_liquida = receitaLiquidaPorCliente(canal, premissas);
  const margem_contribuicao = margemDeContribuicao(canal, premissas);
  const resultado_mensal = margem_contribuicao === null || cheio === null ? null : volume * margem_contribuicao - cheio;
  // Acréscimo sobre custo, com rótulo próprio: não é a margem sobre a receita.
  const markup = premissas.preco_teste === null || custoPorCliente === null || custoPorCliente === 0 ? null : (premissas.preco_teste / meses - custoPorCliente) / custoPorCliente;

  return { canal_id: canal.canal_id, volume, preco_sugerido, piso, receita_liquida, margem_contribuicao, resultado_mensal, markup };
}

/** `N* = ⌈(CF + H × vh) / MC⌉`, só com `MC > 0`. */
function calcularEquilibrio(canal: CanalDaSimulacao, premissas: Premissas): Resultados['equilibrio'][number] {
  const base = { canal_id: canal.canal_id };
  if (semPiso(canal, premissas)) return { ...base, clientes: null, situacao: 'bloqueado' };
  const horas = custoDasHoras(premissas);
  const margem = margemDeContribuicao(canal, premissas);
  if (margem === null || premissas.cf === null || horas === null) return { ...base, clientes: null, situacao: 'falta' };
  if (margem <= FOLGA) return { ...base, clientes: null, situacao: 'sem_equilibrio' };
  return { ...base, clientes: Math.max(0, Math.ceil((premissas.cf + horas) / margem - FOLGA)), situacao: 'calculado' };
}

export function calcularSimulacao(premissas: Premissas): Resultados {
  const bloqueios = premissas.canais.filter((canal) => canalBloqueado(canal, premissas)).map((canal) => ({ canal_id: canal.canal_id, mensagem: MENSAGEM_TAXAS_100 }));
  return {
    bloqueios,
    faltas: faltasDasPremissas(premissas),
    linhas: premissas.canais.flatMap((canal) => premissas.volumes.map((volume) => calcularLinha(canal, volume, premissas))),
    equilibrio: premissas.canais.map((canal) => calcularEquilibrio(canal, premissas)),
  };
}

/** O canal e o volume escolhidos como principais; sem escolha, o primeiro canal e o volume do meio. */
export function cenarioPrincipal(premissas: Pick<Premissas, 'canais' | 'volumes' | 'principal'>): { canal_id: string; volume: number } | null {
  const principal = premissas.principal;
  if (principal && premissas.canais.some((canal) => canal.canal_id === principal.canal_id) && premissas.volumes.includes(principal.volume)) return principal;
  const canal = premissas.canais[0];
  const volume = premissas.volumes[Math.floor((premissas.volumes.length - 1) / 2)];
  return canal && volume !== undefined ? { canal_id: canal.canal_id, volume } : null;
}

export function linhaPrincipal(premissas: Premissas, resultados: Resultados): LinhaDeResultado | null {
  const principal = cenarioPrincipal(premissas);
  return principal ? (resultados.linhas.find((linha) => linha.canal_id === principal.canal_id && linha.volume === principal.volume) ?? null) : null;
}

/** RN-07.11: mudou a média calculada, ou não há média, precisa de justificativa. */
export function custoFixoFoiSubstituido(premissas: Pick<Premissas, 'cf' | 'cf_calculado'>): boolean {
  return premissas.cf !== null && premissas.cf !== premissas.cf_calculado;
}

/** Pontos do gráfico: o resultado de cada canal de 0 até além do maior volume. É uma reta, então bastam os extremos e os volumes. */
export function pontosDoGrafico(premissas: Premissas, resultados: Resultados): { canal_id: string; nome: string; pontos: { x: number; y: number }[] }[] {
  const horas = custoDasHoras(premissas);
  if (premissas.cf === null || horas === null) return [];
  const cheio = premissas.cf + horas;
  const maiorVolume = Math.max(0, ...premissas.volumes);
  const maiorEquilibrio = Math.max(0, ...resultados.equilibrio.map((item) => item.clientes ?? 0));
  const fim = Math.max(maiorVolume, Math.min(maiorEquilibrio, maiorVolume * 3));
  if (fim <= 0) return [];
  return premissas.canais.flatMap((canal) => {
    const margem = margemDeContribuicao(canal, premissas);
    if (margem === null || semPiso(canal, premissas)) return [];
    const xs = [...new Set([0, ...premissas.volumes, fim])].sort((a, b) => a - b);
    return [{ canal_id: canal.canal_id, nome: canal.nome, pontos: xs.map((x) => ({ x, y: x * margem - cheio })) }];
  });
}
