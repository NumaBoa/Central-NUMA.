/**
 * T03.02 (protótipo aprovado): na janela da atividade, os campos de Geral e Agendamento são um rascunho, salvo
 * de uma vez em "Salvar alterações". Checklist, vínculos, arquivos e comentários continuam valendo na hora.
 */
import type { Atividade } from '@/dados/tipos/atividade';
import { emTransacao } from '@/dados/transacao';
import { diaEHoraNoFuso } from '@/lib/datas';
import { MAXIMO_NO_TITULO } from './atividades';
import { alterarCampos, alterarDatas, errosDasDatas, type DadosDoPainel, type DatasDaAtividade } from './atividades-painel';
import { definirEtiquetasDoRegistro } from './etiquetas';
import { editarOcorrencia, type CamposDaOcorrencia, type EscopoDaEdicao } from './recorrencias';

export type RascunhoDaAtividade = DatasDaAtividade & {
  titulo: string;
  descricao: string;
  responsavel_id: string;
  participantes: string[];
  prioridade: Atividade['prioridade'];
  area_id: string;
  produtos: string[];
  solicitante_pessoa_id: string;
  solicitante_texto: string;
  resultado_esperado: string;
  acompanhamento_em: string;
  etiquetas: string[];
};

export type ErrosDoRascunho = Partial<Record<keyof RascunhoDaAtividade, string>>;

type Painel = Pick<DadosDoPainel, 'atividade' | 'produtos' | 'participantes' | 'etiquetas'>;

export function rascunhoDoPainel({ atividade, produtos, participantes, etiquetas }: Painel): RascunhoDaAtividade {
  const aviso = atividade.aviso_em ? diaEHoraNoFuso(atividade.aviso_em) : { dia: '', hora: '' };
  return {
    titulo: atividade.titulo,
    descricao: atividade.descricao ?? '',
    responsavel_id: atividade.responsavel_id,
    participantes,
    prioridade: atividade.prioridade,
    area_id: atividade.area_id ?? '',
    produtos,
    inicio: atividade.inicio ?? '',
    prazo: atividade.prazo ?? '',
    prazo_hora: atividade.prazo_hora ?? '',
    aviso_dia: aviso.dia,
    aviso_hora: aviso.hora,
    solicitante_pessoa_id: atividade.solicitante_pessoa_id ?? '',
    solicitante_texto: atividade.solicitante_texto ?? '',
    resultado_esperado: atividade.resultado_esperado ?? '',
    acompanhamento_em: atividade.acompanhamento_em ?? '',
    etiquetas,
  };
}

/** Os erros na ordem dos campos da tela: o primeiro é onde o foco vai parar. */
export function errosDoRascunho(rascunho: RascunhoDaAtividade, tipo: Atividade['tipo']): ErrosDoRascunho {
  const titulo = rascunho.titulo.trim();
  return {
    ...(!titulo ? { titulo: 'Informe o título.' } : titulo.length > MAXIMO_NO_TITULO ? { titulo: `Use até ${MAXIMO_NO_TITULO} caracteres.` } : {}),
    ...(tipo === 'demanda' && !rascunho.solicitante_pessoa_id && !rascunho.solicitante_texto.trim() ? { solicitante_texto: 'Diga quem pediu.' } : {}),
    ...(!rascunho.responsavel_id ? { responsavel_id: 'Escolha a responsável.' } : {}),
    ...errosDasDatas(rascunho, tipo),
  };
}

const mesmosItens = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((item) => b.includes(item));
const textoOuNada = (texto: string) => texto.trim() || null;

export type MudancasDoRascunho = {
  /** Os campos que uma rotina também guarda: numa ocorrência, perguntam até onde valem (RN-03.17). */
  campos: CamposDaOcorrencia;
  /** As datas de uma ocorrência valem só para ela, sem perguntar. */
  datas: boolean;
  acompanhamento: boolean;
  etiquetas: boolean;
};

export function mudancasDoRascunho(painel: Painel, rascunho: RascunhoDaAtividade): MudancasDoRascunho {
  const { atividade } = painel;
  const antes = rascunhoDoPainel(painel);
  const campos: CamposDaOcorrencia = {};
  if (rascunho.titulo.trim() !== atividade.titulo) campos.titulo = rascunho.titulo.trim();
  if (textoOuNada(rascunho.descricao) !== atividade.descricao) campos.descricao = textoOuNada(rascunho.descricao);
  if (rascunho.responsavel_id !== atividade.responsavel_id) campos.responsavel_id = rascunho.responsavel_id;
  if (rascunho.prioridade !== atividade.prioridade) campos.prioridade = rascunho.prioridade;
  if ((rascunho.area_id || null) !== atividade.area_id) campos.area_id = rascunho.area_id || null;
  if ((rascunho.solicitante_pessoa_id || null) !== atividade.solicitante_pessoa_id) campos.solicitante_pessoa_id = rascunho.solicitante_pessoa_id || null;
  const quemPediu = rascunho.solicitante_pessoa_id ? null : textoOuNada(rascunho.solicitante_texto);
  if (quemPediu !== atividade.solicitante_texto) campos.solicitante_texto = quemPediu;
  if (textoOuNada(rascunho.resultado_esperado) !== atividade.resultado_esperado) campos.resultado_esperado = textoOuNada(rascunho.resultado_esperado);
  if (!mesmosItens(rascunho.produtos, antes.produtos)) campos.produtos = rascunho.produtos;
  if (!mesmosItens(rascunho.participantes, antes.participantes)) campos.participantes = rascunho.participantes;
  const camposDasDatas = ['inicio', 'prazo', 'prazo_hora', 'aviso_dia', 'aviso_hora'] as const;
  return {
    campos,
    datas: camposDasDatas.some((campo) => rascunho[campo] !== antes[campo]),
    acompanhamento: rascunho.acompanhamento_em !== antes.acompanhamento_em,
    etiquetas: !mesmosItens(rascunho.etiquetas, antes.etiquetas),
  };
}

export const temMudancas = ({ campos, datas, acompanhamento, etiquetas }: MudancasDoRascunho) => Object.keys(campos).length > 0 || datas || acompanhamento || etiquetas;

/** Tudo de uma vez, ou nada (AR-02). */
export async function salvarRascunho(id: string, painel: Painel, rascunho: RascunhoDaAtividade, escopo: EscopoDaEdicao): Promise<void> {
  const mudancas = mudancasDoRascunho(painel, rascunho);
  await emTransacao(async () => {
    if (Object.keys(mudancas.campos).length) await editarOcorrencia(id, mudancas.campos, escopo);
    if (mudancas.datas) await alterarDatas(id, rascunho);
    if (mudancas.acompanhamento) await alterarCampos(id, { acompanhamento_em: rascunho.acompanhamento_em || null });
    if (mudancas.etiquetas) await definirEtiquetasDoRegistro('atividade', id, rascunho.etiquetas);
  });
}
