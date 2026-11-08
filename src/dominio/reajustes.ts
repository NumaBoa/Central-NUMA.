/**
 * T11.10 Reajuste (RN-11.20, CA-11.09). Regra padrão (D25): IPCA, anual, data-base = início da vigência; editável por
 * contrato nas condições (`reajuste_indice`, `reajuste_periodicidade_meses`, `reajuste_aviso_dias`).
 * O índice é informado à mão, com fonte e data. A prévia mostra os itens recorrentes e os títulos futuros não pagos;
 * aplicar muda só esses títulos (os quitados ficam com o valor original), e a programação passa a gerar com o novo valor.
 * Dispensar exige motivo.
 */
import { ErroDeRegra } from '@/dados/erros';
import { repositorios } from '@/dados/repositorios';
import { emTransacao } from '@/dados/transacao';
import type { ItemContrato } from '@/dados/tipos/contrato';
import type { LinhaDaPrevia, ReajusteAplicado } from '@/dados/tipos/reajuste';
import type { Baixa, Titulo } from '@/dados/tipos/titulo';
import { hojeISO } from '@/lib/datas';
import { somarMeses } from './cobrancas';
import { carregarContratos, fatorDosReajustes, type LinhaDoContrato } from './contratos';

export { fatorDosReajustes };
import { lerValor } from './dinheiro';
import { recalcularRateio } from './titulos';

export const INDICE_PADRAO = 'IPCA';
export const PERIODICIDADE_PADRAO_MESES = 12;
/** A lista mostra as datas-base dos próximos 60 dias (T11.10). */
export const HORIZONTE_DIAS = 60;

const redondo = (valor: number) => Math.round((valor + Number.EPSILON) * 100) / 100;
const somarDias = (dia: string, dias: number) => {
  const data = new Date(`${dia}T00:00:00.000Z`);
  data.setUTCDate(data.getUTCDate() + dias);
  return data.toISOString().slice(0, 10);
};

/**
 * O próximo aniversário ainda não tratado (nem aplicado nem dispensado), se cair até o fim do horizonte.
 * Aniversário vencido e não tratado continua aparecendo: o reajuste não some sozinho.
 */
export function proximaDataBase(inicio: string | null, periodicidadeMeses: number | null, tratadas: readonly string[], hoje: string, fimDaVigencia: string | null = null): string | null {
  if (!inicio) return null;
  const passo = periodicidadeMeses && periodicidadeMeses > 0 ? periodicidadeMeses : PERIODICIDADE_PADRAO_MESES;
  const limite = somarDias(hoje, HORIZONTE_DIAS);
  for (let indice = 1; indice <= 40; indice += 1) {
    const data = somarMeses(inicio, passo * indice);
    if (data > limite || (fimDaVigencia && data > fimDaVigencia)) return null;
    if (!tratadas.includes(data)) return data;
  }
  return null;
}

export function lerPercentual(texto: string): number | null {
  const limpo = texto.trim().replace('%', '').trim();
  if (!limpo) return null;
  const valor = lerValor(limpo);
  if (valor === null || valor <= -100 || valor > 100) throw new ErroDeRegra('Percentual: use um número como 4,68.');
  return valor;
}

const comPercentual = (valor: number, percentual: number) => redondo(valor * (1 + percentual / 100));

/** O título ainda pode mudar de valor: a receber ou a pagar, em aberto ou previsto, sem nenhum pagamento. */
export function tituloReajustavel(titulo: Pick<Titulo, 'id' | 'situacao' | 'arquivado_em' | 'vencimento'>, baixas: readonly Pick<Baixa, 'titulo_id' | 'arquivado_em'>[], dataBase: string): boolean {
  if (titulo.arquivado_em || !['aberto', 'previsto'].includes(titulo.situacao) || titulo.vencimento < dataBase) return false;
  return !baixas.some((baixa) => baixa.titulo_id === titulo.id && !baixa.arquivado_em);
}

/** CA-11.09: os itens recorrentes e os títulos futuros não pagos, antes e depois. */
export function previaDoReajuste(
  itens: readonly Pick<ItemContrato, 'id' | 'descricao' | 'recorrente' | 'valor_unitario' | 'valor_total'>[],
  titulos: readonly Pick<Titulo, 'id' | 'descricao' | 'valor' | 'situacao' | 'arquivado_em' | 'vencimento'>[],
  baixas: readonly Pick<Baixa, 'titulo_id' | 'arquivado_em'>[],
  dataBase: string,
  percentual: number,
): { itens: LinhaDaPrevia[]; titulos: LinhaDaPrevia[] } {
  return {
    itens: itens.filter((item) => item.recorrente && item.valor_total !== null).map((item) => ({ id: item.id, descricao: item.descricao, de: item.valor_total as number, para: comPercentual(item.valor_total as number, percentual), vencimento: null })),
    titulos: titulos
      .filter((titulo) => tituloReajustavel(titulo, baixas, dataBase))
      .sort((a, b) => a.vencimento.localeCompare(b.vencimento))
      .map((titulo) => ({ id: titulo.id, descricao: titulo.descricao, de: titulo.valor, para: comPercentual(titulo.valor, percentual), vencimento: titulo.vencimento })),
  };
}


export type LinhaDoReajuste = {
  contrato: LinhaDoContrato;
  contraparte: string;
  dataBase: string;
  indice: string;
  periodicidadeMeses: number;
  avisoDias: number | null;
  /** O cálculo salvo para esta data-base, se houver. */
  registro: ReajusteAplicado | null;
};

export type TelaDosReajustes = { pendentes: LinhaDoReajuste[]; tratados: (ReajusteAplicado & { codigo: string; contraparte: string })[] };

export async function carregarReajustes(hoje: string = hojeISO()): Promise<TelaDosReajustes> {
  const [{ linhas, contrapartes }, registros, itens] = await Promise.all([carregarContratos(hoje), repositorios.reajuste_aplicado.listar(), repositorios.item_contrato.listar()]);
  const nomeDe = (id: string) => contrapartes.find((contraparte) => contraparte.id === id)?.nome_fantasia ?? contrapartes.find((contraparte) => contraparte.id === id)?.nome ?? 'Contraparte removida';
  const pendentes: LinhaDoReajuste[] = [];
  for (const contrato of linhas) {
    if (contrato.arquivado_em || !contrato.vigente || !['vigente', 'futuro', 'suspenso'].includes(contrato.vigencia)) continue;
    if (!itens.some((item) => item.versao_id === contrato.vigente!.id && item.recorrente)) continue;
    const condicoes = contrato.vigente.condicoes;
    const dados = contrato.vigente.dados_saas;
    const proprios = registros.filter((registro) => registro.contrato_id === contrato.id);
    const tratadas = proprios.filter((registro) => registro.situacao !== 'calculado').map((registro) => registro.data_base);
    const periodicidade = condicoes.reajuste_periodicidade_meses ?? PERIODICIDADE_PADRAO_MESES;
    const dataBase = proximaDataBase(contrato.inicio, periodicidade, tratadas, hoje, contrato.fim);
    if (!dataBase) continue;
    pendentes.push({
      contrato,
      contraparte: nomeDe(contrato.contraparte_id),
      dataBase,
      indice: condicoes.reajuste_indice ?? dados?.reajuste_indice ?? INDICE_PADRAO,
      periodicidadeMeses: periodicidade,
      avisoDias: condicoes.reajuste_aviso_dias ?? dados?.reajuste_aviso_dias ?? null,
      registro: proprios.find((registro) => registro.data_base === dataBase && registro.situacao === 'calculado') ?? null,
    });
  }
  const codigo = (id: string) => linhas.find((linha) => linha.id === id)?.codigo ?? 'Contrato removido';
  const contraparteDe = (id: string) => nomeDe(linhas.find((linha) => linha.id === id)?.contraparte_id ?? '');
  return {
    pendentes: pendentes.sort((a, b) => a.dataBase.localeCompare(b.dataBase)),
    tratados: registros.filter((registro) => registro.situacao !== 'calculado').sort((a, b) => b.data_base.localeCompare(a.data_base)).map((registro) => ({ ...registro, codigo: codigo(registro.contrato_id), contraparte: contraparteDe(registro.contrato_id) })),
  };
}

export type FormularioDoReajuste = { percentual: string; fonte: string; data: string };
export const FORMULARIO_REAJUSTE_VAZIO: FormularioDoReajuste = { percentual: '', fonte: '', data: '' };

/** Lê o que o contrato tem hoje para a prévia: itens da versão vigente e títulos do contrato. */
async function fontesDaPrevia(contratoId: string, versaoId: string) {
  const [itens, titulos, baixas] = await Promise.all([repositorios.item_contrato.listar({ onde: { versao_id: versaoId } }), repositorios.titulo.listar({ onde: { origem: 'contrato', origem_id: contratoId } }), repositorios.baixa.listar()]);
  return { itens, titulos, baixas };
}

export async function calcularPrevia(linha: Pick<LinhaDoReajuste, 'contrato' | 'dataBase'>, percentual: number) {
  const { itens, titulos, baixas } = await fontesDaPrevia(linha.contrato.id, linha.contrato.vigente!.id);
  return previaDoReajuste(itens, titulos, baixas, linha.dataBase, percentual);
}

/** Salva o cálculo (situação "calculado"): índice com fonte e data, e a prévia. Ainda não muda nada. */
export async function salvarCalculo(linha: Pick<LinhaDoReajuste, 'contrato' | 'dataBase' | 'indice' | 'registro'>, formulario: FormularioDoReajuste): Promise<ReajusteAplicado> {
  const percentual = lerPercentual(formulario.percentual);
  if (percentual === null) throw new ErroDeRegra('Informe o percentual do índice no período.');
  const fonte = formulario.fonte.trim();
  if (!fonte) throw new ErroDeRegra('Informe a fonte do índice (RN-11.20).');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(formulario.data)) throw new ErroDeRegra('Informe a data do índice.');
  const previa = await calcularPrevia(linha, percentual);
  const dados = { contrato_id: linha.contrato.id, versao_id: linha.contrato.vigente!.id, data_base: linha.dataBase, indice_nome: linha.indice, percentual, indice_fonte: fonte, indice_data: formulario.data, previa, situacao: 'calculado' as const };
  if (linha.registro) return repositorios.reajuste_aplicado.atualizar(linha.registro.id, dados);
  return repositorios.reajuste_aplicado.criar({ ...dados, aplicado_por: null, aplicado_em: null, dispensado_motivo: null, comunicado_em: null, comunicado_canal: null, comunicado_evidencia_url: null, exemplo: false });
}

/**
 * Aplica a prévia salva (`aplicar_reajuste(id, previa)`). Só mudam os títulos que continuam sem pagamento; o que foi
 * pago depois do cálculo fica de fora e com o valor original (CA-11.09).
 */
export async function aplicarReajuste(id: string, responsavelId: string): Promise<number> {
  if (!responsavelId) throw new ErroDeRegra('Escolha quem você é, no topo, antes de aplicar o reajuste.');
  const registro = await repositorios.reajuste_aplicado.obter(id);
  if (!registro) throw new ErroDeRegra('Este cálculo não existe mais.');
  if (registro.situacao !== 'calculado') throw new ErroDeRegra('Este reajuste já foi tratado.');
  const [titulos, baixas] = await Promise.all([repositorios.titulo.listar({ onde: { origem: 'contrato', origem_id: registro.contrato_id } }), repositorios.baixa.listar()]);
  return emTransacao(async () => {
    let alterados = 0;
    for (const linha of registro.previa.titulos) {
      const titulo = titulos.find((item) => item.id === linha.id);
      if (!titulo || !tituloReajustavel(titulo, baixas, registro.data_base) || titulo.valor !== linha.de) continue;
      await repositorios.titulo.atualizar(titulo.id, { valor: linha.para, ajustado_manualmente: true });
      await recalcularRateio(titulo.id, linha.para);
      alterados += 1;
    }
    await repositorios.reajuste_aplicado.atualizar(registro.id, { situacao: 'aplicado', aplicado_por: responsavelId, aplicado_em: new Date().toISOString() });
    return alterados;
  });
}

/** Dispensar exige motivo (RN-11.20). A data-base fica tratada e sai da lista. */
export async function dispensarReajuste(linha: Pick<LinhaDoReajuste, 'contrato' | 'dataBase' | 'indice' | 'registro'>, motivo: string, responsavelId: string): Promise<ReajusteAplicado> {
  const limpo = motivo.trim();
  if (!limpo) throw new ErroDeRegra('Dispensar o reajuste exige motivo.');
  if (!responsavelId) throw new ErroDeRegra('Escolha quem você é, no topo, antes de dispensar o reajuste.');
  const dados = { situacao: 'dispensado' as const, dispensado_motivo: limpo, aplicado_por: responsavelId, aplicado_em: new Date().toISOString() };
  if (linha.registro) return repositorios.reajuste_aplicado.atualizar(linha.registro.id, dados);
  return repositorios.reajuste_aplicado.criar({ contrato_id: linha.contrato.id, versao_id: linha.contrato.vigente!.id, data_base: linha.dataBase, indice_nome: linha.indice, percentual: null, indice_fonte: null, indice_data: null, previa: { itens: [], titulos: [] }, comunicado_em: null, comunicado_canal: null, comunicado_evidencia_url: null, exemplo: false, ...dados });
}

/** Registro da comunicação ao cliente: data, canal e evidência (link). */
export async function registrarComunicacao(id: string, { data, canal, evidencia }: { data: string; canal: string; evidencia: string }): Promise<ReajusteAplicado> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new ErroDeRegra('Informe a data da comunicação.');
  if (!canal.trim()) throw new ErroDeRegra('Informe o canal da comunicação.');
  const link = evidencia.trim();
  if (link && !/^https?:\/\/\S+$/i.test(link)) throw new ErroDeRegra('Evidência: informe o link completo, começando por https://.');
  const registro = await repositorios.reajuste_aplicado.obter(id);
  if (!registro || registro.situacao !== 'aplicado') throw new ErroDeRegra('Registre a comunicação de um reajuste aplicado.');
  return repositorios.reajuste_aplicado.atualizar(id, { comunicado_em: data, comunicado_canal: canal.trim(), comunicado_evidencia_url: link || null });
}

export const ROTULOS_SITUACAO_REAJUSTE: Readonly<Record<ReajusteAplicado['situacao'], string>> = { calculado: 'Calculado', aplicado: 'Aplicado', dispensado: 'Dispensado' };
