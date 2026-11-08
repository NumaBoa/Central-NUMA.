/**
 * Atividades que nascem de um registro do M06: itens de ação da reunião (RN-06.14) e itens da constituição (T06.06).
 * É a mesma tabela do Meu dia, sem cópia. Quem chama diz a origem, e o vínculo faz a atividade aparecer na ficha (RN-03.20).
 */
import { AREAS_INICIAIS } from '@/dados/exemplos/base';
import { repositorios } from '@/dados/repositorios';
import { emTransacao } from '@/dados/transacao';
import { parDoVinculo } from '@/dados/tipos/apoio';
import type { Atividade } from '@/dados/tipos/atividade';
import { MAXIMO_NO_TITULO } from './atividades';

export const AREA_GESTAO_GERAL = AREAS_INICIAIS.find((area) => area.nome === 'Gestão geral')?.id ?? null;
export const AREA_JURIDICO = AREAS_INICIAIS.find((area) => area.nome === 'Jurídico e privacidade')?.id ?? null;
export const AREA_TECNOLOGIA = AREAS_INICIAIS.find((area) => area.nome === 'Tecnologia')?.id ?? null;

export const limitarTitulo = (texto: string) => (texto.length <= MAXIMO_NO_TITULO ? texto : `${texto.slice(0, MAXIMO_NO_TITULO - 1).trimEnd()}…`);

export type TarefaGerada = {
  titulo: string;
  descricao?: string | null;
  responsavel_id: string;
  area_id?: string | null;
  prazo?: string | null;
  origem_tipo: string;
  origem_id: string;
  chave?: string | null;
  bloqueio_motivo?: string | null;
};

export function dadosDaTarefaGerada(tarefa: TarefaGerada) {
  return {
    tipo: 'tarefa' as const,
    titulo: limitarTitulo(tarefa.titulo),
    descricao: tarefa.descricao ?? null,
    area_id: tarefa.area_id ?? null,
    responsavel_id: tarefa.responsavel_id,
    prioridade: 'normal' as const,
    situacao: 'a_fazer' as const,
    bloqueada: Boolean(tarefa.bloqueio_motivo),
    bloqueio_motivo: tarefa.bloqueio_motivo ?? null,
    bloqueada_em: tarefa.bloqueio_motivo ? new Date().toISOString() : null,
    inicio: null,
    prazo: tarefa.prazo ?? null,
    prazo_hora: null,
    aviso_em: null,
    solicitante_pessoa_id: null,
    solicitante_texto: null,
    resultado_esperado: null,
    aguardando_de_pessoa_id: null,
    aguardando_de_texto: null,
    aguardando_desde: null,
    acompanhamento_em: null,
    recorrencia_id: null,
    ocorrencia_numero: null,
    ocorrencia_data: null,
    editada_individualmente: false,
    origem_tipo: tarefa.origem_tipo,
    origem_id: tarefa.origem_id,
    alerta_motivo: null,
    alerta_data_referencia: null,
    alerta_acao: null,
    chave_idempotencia: tarefa.chave ?? null,
    adiamentos: 0,
    concluida_em: null,
    concluida_por: null,
    conclusao_nota: null,
    cancelada_motivo: null,
    dispensada_motivo: null,
  };
}

type Ligacoes = { vinculo: { tipo: string; id: string }; participantes?: readonly string[]; produtos?: readonly string[] };

/** Grava a atividade e as ligações de uma vez (AR-02). */
export async function criarTarefaGerada(tarefa: TarefaGerada, { vinculo, participantes = [], produtos = [] }: Ligacoes): Promise<Atividade> {
  return emTransacao(async () => {
    const atividade = await repositorios.atividade.criar(dadosDaTarefaGerada(tarefa));
    await repositorios.vinculo.criar(parDoVinculo({ tipo: 'atividade', id: atividade.id }, vinculo));
    for (const pessoa_id of participantes.filter((id) => id !== tarefa.responsavel_id)) await repositorios.atividade_participante.criar({ atividade_id: atividade.id, pessoa_id });
    for (const produto_id of produtos) await repositorios.atividade_produto.criar({ atividade_id: atividade.id, produto_id });
    return atividade;
  });
}
