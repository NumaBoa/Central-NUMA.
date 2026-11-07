/**
 * Adaptador do M07 para o Meu dia (M03): o único lugar em que o módulo de produtos fala com as atividades.
 *
 * Contrato usado do M03, que já existe no `main`:
 * - `atividadesDoRegistro('produto', id)`: leitura. É o mesmo registro: concluir no Meu dia aparece aqui, sem cópia.
 * - `criarAtividade(formulario)`: criação de uma atividade real, sempre por ação explícita de quem preenche o plano.
 *
 * O M07 não gera atividade por conta própria. O que o Meu dia pode ler para os alertas previstos em `05-M03 §6` está em
 * `pendenciasParaAlertas`: quem transforma em alerta é o M03, em `sincronizar…` próprio, e isso ainda não está ligado.
 */
import { repositorios } from '@/dados/repositorios';
import type { Atividade } from '@/dados/tipos/atividade';
import { hojeISO } from '@/lib/datas';
import { estaAberta, ordenarAtividades } from './atividades';
import { criarAtividade, esquemaFormularioAtividade, formularioAtividadeVazio } from './atividades-formulario';
import { atividadesDoRegistro } from './atividades-painel';
import { primeiroDiaDoMes } from './custos-produto';
import { somarMeses } from './cobrancas';
import { alertaDoCanal } from './precificacao';

export async function atividadesDoProduto(produtoId: string): Promise<Atividade[]> {
  return atividadesDoRegistro('produto', produtoId);
}

export async function atividadesAbertasDoProduto(produtoId: string, hoje: string = hojeISO()): Promise<Atividade[]> {
  return ordenarAtividades((await atividadesDoProduto(produtoId)).filter(estaAberta), hoje);
}

export type NovoPlanoDeEncerramento = { titulo: string; responsavel_id: string; prazo: string };

export function errosDoPlano(plano: NovoPlanoDeEncerramento): Readonly<Record<string, string>> {
  const erros: Record<string, string> = {};
  if (!plano.titulo.trim()) erros.titulo = 'Informe o título da atividade.';
  if (!plano.responsavel_id) erros.responsavel_id = 'Escolha a responsável.';
  if (!plano.prazo) erros.prazo = 'Informe o prazo.';
  return erros;
}

/** Cria de verdade no Meu dia, ligada ao produto. Dentro de uma transação, volta atrás junto com o resto. */
export async function criarPlanoDeEncerramento(produtoId: string, plano: NovoPlanoDeEncerramento): Promise<Atividade> {
  const base = formularioAtividadeVazio('tarefa', plano.responsavel_id, produtoId);
  return criarAtividade(esquemaFormularioAtividade.parse({ ...base, titulo: plano.titulo, responsavel_id: plano.responsavel_id, prazo: plano.prazo, contextos: [produtoId] }));
}

/** A atividade existente precisa ser aberta e deste produto: plano concluído ou de outro produto não conta. */
export async function planoExistenteServe(produtoId: string, atividadeId: string): Promise<boolean> {
  return (await atividadesDoProduto(produtoId)).some((atividade) => atividade.id === atividadeId && estaAberta(atividade));
}

export type PendenciaParaAlerta = { origem_tipo: 'canal_venda' | 'kpi_mensal'; origem_id: string; motivo: 'canal_sem_verificacao' | 'kpi_nao_preenchido'; data_referencia: string; responsavel_id: string | null; titulo: string; href: string };

/**
 * Os dados das duas fontes de alerta do M07 (`05-M03 §6`). Só leitura. Canal: 12 meses depois da última verificação
 * (a verificação nova encerra). KPI: dia 10 sem o registro do mês anterior. Responsável vazio quer dizer que o produto
 * ainda não tem: o M03 decide o que fazer (hoje ele usa a Kimberly na rotina de KPIs).
 */
export async function pendenciasParaAlertas(hoje: string = hojeISO()): Promise<PendenciaParaAlerta[]> {
  const [canais, produtos, kpis] = await Promise.all([repositorios.canal_venda.listar(), repositorios.produto.listar(), repositorios.kpi_mensal.listar()]);
  const dosCanais: PendenciaParaAlerta[] = canais
    .filter((canal) => canal.situacao === 'ativo' && alertaDoCanal(canal, hoje) === 'vencida')
    .map((canal) => ({ origem_tipo: 'canal_venda', origem_id: canal.id, motivo: 'canal_sem_verificacao', data_referencia: somarMeses(canal.verificado_em as string, 12), responsavel_id: null, titulo: `Revisar taxas do canal ${canal.nome}`, href: '/produtos/canais' }));
  if (Number(hoje.slice(8)) < 10) return dosCanais;
  const competencia = somarMeses(primeiroDiaDoMes(hoje), -1);
  const dosKpis: PendenciaParaAlerta[] = produtos
    .filter((produto) => produto.situacao === 'ativo' && !kpis.some((kpi) => kpi.produto_id === produto.id && kpi.competencia === competencia))
    .map((produto) => ({ origem_tipo: 'kpi_mensal', origem_id: produto.id, motivo: 'kpi_nao_preenchido', data_referencia: competencia, responsavel_id: produto.responsavel_id, titulo: `Preencher KPIs de ${produto.nome}`, href: `/produtos/${produto.id}?aba=indicadores` }));
  return [...dosCanais, ...dosKpis];
}
