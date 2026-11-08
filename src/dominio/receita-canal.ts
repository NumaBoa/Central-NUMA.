/**
 * T05.12 Receita por canal (F1, RN-05.21): para adesão padrão (lojas e gateways), um lançamento por
 * produto × canal × competência, com bruto, taxas do canal e líquido. O líquido gera o título a receber do canal,
 * com vencimento pelo prazo de repasse. RN-05.20: o título nunca nasce recebido; só a baixa manual marca o recebimento.
 */
import { repositorios } from '@/dados/repositorios';
import { emTransacao } from '@/dados/transacao';
import { ErroDeRegra } from '@/dados/erros';
import type { CanalVenda } from '@/dados/tipos/precificacao';
import type { ReceitaCanal } from '@/dados/tipos/receita-canal';
import { lerValor } from './dinheiro';
import { gravarRateio } from './titulos';

export type FormularioReceita = {
  produto_id: string;
  canal_id: string;
  /** `AAAA-MM`. */
  competencia: string;
  moeda: string;
  receita_bruta: string;
  taxas: string;
  assinantes_ativos: string;
  novos: string;
  cancelados: string;
  fonte_url: string;
};

export const FORMULARIO_RECEITA_VAZIO: FormularioReceita = { produto_id: '', canal_id: '', competencia: '', moeda: 'BRL', receita_bruta: '', taxas: '', assinantes_ativos: '', novos: '', cancelados: '', fonte_url: '' };

const redondo = (valor: number) => Math.round(valor * 100) / 100;

/** Taxa sugerida pelo canal (M07): percentual sobre o bruto. A taxa fixa por transação depende do número de vendas e não entra. Sem taxa informada, não há sugestão. */
export function taxaSugerida(canal: Pick<CanalVenda, 'taxa_percentual'> | undefined, bruto: number | null): number | null {
  if (!canal || canal.taxa_percentual === null || bruto === null) return null;
  return redondo((bruto * canal.taxa_percentual) / 100);
}

/** Último dia do mês da competência, mais o prazo de repasse do canal. Sem prazo informado, o último dia do mês. */
export function vencimentoDoRepasse(competencia: string, prazoDias: number | null): string {
  const [ano, mes] = competencia.split('-').map(Number) as [number, number];
  const ultimo = new Date(Date.UTC(ano, mes, 0));
  ultimo.setUTCDate(ultimo.getUTCDate() + (prazoDias ?? 0));
  return ultimo.toISOString().slice(0, 10);
}

const inteiro = (texto: string, rotulo: string): number | null => {
  const limpo = texto.trim();
  if (!limpo) return null;
  if (!/^\d{1,7}$/.test(limpo)) throw new ErroDeRegra(`${rotulo}: informe um número inteiro.`);
  return Number(limpo);
};

const dinheiro = (texto: string, rotulo: string, obrigatorio: boolean): number | null => {
  const limpo = texto.trim();
  if (!limpo) {
    if (obrigatorio) throw new ErroDeRegra(`Informe ${rotulo}.`);
    return null;
  }
  const valor = lerValor(limpo);
  if (valor === null || valor < 0) throw new ErroDeRegra(`${rotulo[0]!.toUpperCase()}${rotulo.slice(1)}: use o formato 1.250,00.`);
  return redondo(valor);
};

export function formularioDaReceita(registro: ReceitaCanal): FormularioReceita {
  const num = (valor: number | null) => (valor === null ? '' : String(valor));
  const brl = (valor: number) => valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return {
    produto_id: registro.produto_id,
    canal_id: registro.canal_id,
    competencia: registro.competencia.slice(0, 7),
    moeda: registro.moeda,
    receita_bruta: brl(registro.receita_bruta),
    taxas: brl(registro.taxas),
    assinantes_ativos: num(registro.assinantes_ativos),
    novos: num(registro.novos),
    cancelados: num(registro.cancelados),
    fonte_url: registro.fonte_url ?? '',
  };
}

/**
 * Grava o mês do canal e o título a receber. Editar ajusta o título enquanto ele não tem baixa;
 * com baixa, o valor fica travado (estorne antes), mas assinantes e fonte continuam editáveis.
 */
export async function salvarReceita(formulario: FormularioReceita, responsavelId: string, id?: string): Promise<ReceitaCanal> {
  if (!formulario.produto_id) throw new ErroDeRegra('Escolha o produto.');
  if (!formulario.canal_id) throw new ErroDeRegra('Escolha o canal.');
  if (!/^\d{4}-\d{2}$/.test(formulario.competencia)) throw new ErroDeRegra('Escolha a competência.');
  if (!responsavelId) throw new ErroDeRegra('Escolha quem você é, no topo, antes de lançar a receita.');
  const bruto = dinheiro(formulario.receita_bruta, 'a receita bruta', true) as number;
  const taxas = dinheiro(formulario.taxas, 'as taxas', false) ?? 0;
  if (taxas > bruto) throw new ErroDeRegra('As taxas não podem passar da receita bruta.');
  const fonte = formulario.fonte_url.trim();
  if (fonte && !/^https?:\/\/\S+$/i.test(fonte)) throw new ErroDeRegra('Fonte: informe o link completo, começando por https://.');
  const competencia = `${formulario.competencia}-01`;
  const dados = {
    produto_id: formulario.produto_id,
    canal_id: formulario.canal_id,
    competencia,
    moeda: formulario.moeda || 'BRL',
    receita_bruta: bruto,
    taxas,
    receita_liquida: redondo(bruto - taxas),
    assinantes_ativos: inteiro(formulario.assinantes_ativos, 'Assinantes ativos'),
    novos: inteiro(formulario.novos, 'Novos'),
    cancelados: inteiro(formulario.cancelados, 'Cancelados'),
    fonte_url: fonte || null,
  };

  const [existentes, canal, produto, categorias] = await Promise.all([repositorios.receita_canal.listar(), repositorios.canal_venda.obter(formulario.canal_id), repositorios.produto.obter(formulario.produto_id), repositorios.categoria_financeira.listar()]);
  if (!canal) throw new ErroDeRegra('Este canal não existe mais.');
  if (existentes.some((item) => item.id !== id && item.produto_id === dados.produto_id && item.canal_id === dados.canal_id && item.competencia === competencia)) throw new ErroDeRegra('Já há receita deste produto neste canal nessa competência. Abra o lançamento existente para editar.');
  const atual = id ? existentes.find((item) => item.id === id) : undefined;
  if (id && !atual) throw new ErroDeRegra('Este lançamento não existe mais.');
  // A categoria vem da carga inicial (Receitas › Assinaturas): sem ela, não se inventa outra.
  const categoria = categorias.find((item) => item.tipo === 'receita' && item.pai_id && item.nome === 'Assinaturas');
  if (!categoria) throw new ErroDeRegra('Falta a categoria de receita “Assinaturas” em Configurações › Categorias.');

  const descricao = `Receita ${canal.nome} · ${produto?.nome ?? 'Produto'} · ${formulario.competencia.slice(5, 7)}/${formulario.competencia.slice(0, 4)}`;
  const vencimento = vencimentoDoRepasse(formulario.competencia, canal.prazo_repasse_dias);
  return emTransacao(async () => {
    let tituloId = atual?.titulo_id ?? null;
    const titulo = tituloId ? await repositorios.titulo.obter(tituloId) : null;
    if (titulo) {
      const baixas = (await repositorios.baixa.listar({ onde: { titulo_id: titulo.id } })).filter((baixa) => !baixa.arquivado_em);
      const mudouValor = titulo.valor !== dados.receita_liquida || titulo.moeda !== dados.moeda || titulo.competencia !== competencia;
      if (baixas.length && mudouValor) throw new ErroDeRegra('O título deste mês já tem recebimento. Para mudar valor, moeda ou competência, estorne o recebimento antes.');
      if (!baixas.length) {
        await repositorios.titulo.atualizar(titulo.id, { valor: dados.receita_liquida, moeda: dados.moeda, competencia, vencimento, descricao });
        await gravarRateio(titulo.id, dados.receita_liquida, [{ contexto: dados.produto_id, percentual: 100 }]);
      }
    } else if (dados.receita_liquida > 0) {
      const novo = await repositorios.titulo.criar({
        natureza: 'receber',
        descricao,
        contraparte_id: null,
        beneficiario_pessoa_id: null,
        categoria_id: categoria.id,
        competencia,
        vencimento,
        valor: dados.receita_liquida,
        moeda: dados.moeda,
        situacao: 'aberto',
        responsavel_id: responsavelId,
        entidade_id: null,
        origem: 'canal',
        origem_id: null,
        chave_idempotencia: `canal:${dados.produto_id}:${dados.canal_id}:${competencia}`,
        ajustado_manualmente: false,
        ferramenta_id: null,
        assinatura_id: null,
        periodo_inicio: null,
        periodo_fim: null,
        suspenso: false,
        cancelado_motivo: null,
        observacao: 'Gerado pela receita por canal (T05.12). Recebido só com a baixa (RN-05.20).',
      });
      await gravarRateio(novo.id, novo.valor, [{ contexto: dados.produto_id, percentual: 100 }]);
      tituloId = novo.id;
    }
    const registro = atual ? await repositorios.receita_canal.atualizar(atual.id, { ...dados, titulo_id: tituloId }) : await repositorios.receita_canal.criar({ ...dados, titulo_id: tituloId, exemplo: false });
    if (tituloId && !atual?.titulo_id) await repositorios.titulo.atualizar(tituloId, { origem_id: registro.id });
    return registro;
  });
}

export type LinhaDaReceita = ReceitaCanal & { produto: string; canal: string; recebido: boolean };
export type TelaDaReceita = { linhas: LinhaDaReceita[]; porMes: { competencia: string; liquida: number; bruta: number; moeda: string }[]; produtos: { id: string; nome: string }[]; canais: CanalVenda[] };

/** A lista e os totais por mês (só em reais somam; outras moedas aparecem separadas na lista). */
export async function carregarReceitas(contextoGlobalId: string): Promise<TelaDaReceita> {
  const [registros, produtos, canais, baixas] = await Promise.all([repositorios.receita_canal.listar(), repositorios.produto.listar(), repositorios.canal_venda.listar(), repositorios.baixa.listar()]);
  const nome = (lista: readonly { id: string; nome: string }[], id: string) => lista.find((item) => item.id === id)?.nome ?? 'Removido';
  const visiveis = registros.filter((item) => contextoGlobalId === 'consolidada' || item.produto_id === contextoGlobalId);
  const linhas = visiveis
    .map((item) => ({ ...item, produto: nome(produtos, item.produto_id), canal: nome(canais, item.canal_id), recebido: Boolean(item.titulo_id && baixas.some((baixa) => baixa.titulo_id === item.titulo_id && !baixa.arquivado_em && baixa.tipo === 'pagamento')) }))
    .sort((a, b) => b.competencia.localeCompare(a.competencia) || a.produto.localeCompare(b.produto, 'pt-BR'));
  const meses = [...new Set(linhas.filter((linha) => linha.moeda === 'BRL').map((linha) => linha.competencia))].sort();
  const porMes = meses.map((competencia) => {
    const doMes = linhas.filter((linha) => linha.moeda === 'BRL' && linha.competencia === competencia);
    return { competencia, liquida: redondo(doMes.reduce((soma, linha) => soma + linha.receita_liquida, 0)), bruta: redondo(doMes.reduce((soma, linha) => soma + linha.receita_bruta, 0)), moeda: 'BRL' };
  });
  return { linhas, porMes, produtos, canais };
}
