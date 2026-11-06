/** Regras de T03.03 (05-M03): adicionar Tarefa, Demanda ou Lembrete. */
import { z } from 'zod';
import { repositorios } from '@/dados/repositorios';
import { emTransacao } from '@/dados/transacao';
import type { Area } from '@/dados/tipos/area';
import { parDoVinculo } from '@/dados/tipos/apoio';
import type { Atividade } from '@/dados/tipos/atividade';
import type { Contraparte } from '@/dados/tipos/contraparte';
import type { Marca, Produto } from '@/dados/tipos/marca';
import type { Pessoa } from '@/dados/tipos/pessoa';
import { instanteNoFuso } from '@/lib/datas';
import { MAXIMO_NO_TITULO } from './atividades';
import { ID_CONSOLIDADA, ID_INSTITUCIONAL } from './contextos';
import { linkDoDriveValido, MENSAGEM_LINK_DRIVE } from './link-drive';
import { pessoasDoSeletor } from './pessoa-atual';
import { AVISO_CREDENCIAL, pareceCredencial } from './segredos';

export type TipoNovo = 'tarefa' | 'demanda' | 'lembrete';

/** Pessoa escolhida como solicitante, ou texto livre. */
export const SOLICITANTE_OUTRA = 'outra';

export const esquemaFormularioAtividade = z
  .object({
    tipo: z.enum(['tarefa', 'demanda', 'lembrete']),
    titulo: z.string().trim().min(1, 'Informe o título.').max(MAXIMO_NO_TITULO, `Use até ${MAXIMO_NO_TITULO} caracteres.`),
    descricao: z.string().trim(),
    area_id: z.string(),
    contextos: z.array(z.string()),
    responsavel_id: z.string().min(1, 'Escolha a responsável.'),
    participantes: z.array(z.string()),
    prioridade: z.enum(['baixa', 'normal', 'alta', 'urgente']),
    inicio: z.string(),
    prazo: z.string(),
    prazo_hora: z.string(),
    aviso_dia: z.string(),
    aviso_hora: z.string(),
    solicitante: z.string(),
    solicitante_texto: z.string().trim(),
    resultado_esperado: z.string().trim(),
    checklist: z.string(),
    /** `tipo:id` do registro escolhido. */
    vinculo: z.string(),
    arquivo: z.string().trim(),
  })
  .superRefine((dados, contexto) => {
    const falha = (campo: string, message: string) => contexto.addIssue({ code: 'custom', path: [campo], message });
    if (dados.tipo === 'lembrete') {
      // CA-03.06: criar um lembrete sem data e hora é bloqueado, com a mensagem junto ao campo.
      if (!dados.aviso_dia) falha('aviso_dia', 'Informe a data do aviso.');
      if (!dados.aviso_hora) falha('aviso_hora', 'Informe a hora do aviso.');
      return finalizarComuns(dados, falha);
    }
    if (dados.tipo === 'demanda') {
      if (!dados.solicitante) falha('solicitante', 'Diga quem pediu.');
      else if (dados.solicitante === SOLICITANTE_OUTRA && !dados.solicitante_texto) falha('solicitante_texto', 'Escreva quem pediu.');
    }
    if (dados.prazo_hora && !dados.prazo) falha('prazo', 'Informe o dia do prazo.');
    if (dados.inicio && dados.prazo && dados.inicio > dados.prazo) falha('inicio', 'O início precisa ser antes do prazo.');
    if (Boolean(dados.aviso_dia) !== Boolean(dados.aviso_hora)) falha(dados.aviso_dia ? 'aviso_hora' : 'aviso_dia', 'Informe o dia e a hora do aviso.');
    else if (dados.aviso_dia && dados.prazo && dados.aviso_dia > dados.prazo) falha('aviso_dia', 'O aviso precisa ser antes do prazo.');
    finalizarComuns(dados, falha);
  });

function finalizarComuns(dados: { arquivo: string }, falha: (campo: string, mensagem: string) => void) {
  if (dados.arquivo && !linkDoDriveValido(dados.arquivo)) falha('arquivo', MENSAGEM_LINK_DRIVE);
}

export type FormularioAtividade = z.infer<typeof esquemaFormularioAtividade>;

/** Padrão: contexto global atual; a Numa e a visão consolidada ficam vazias (T03.03). */
export function contextosIniciais(contextoGlobalId: string): string[] {
  return contextoGlobalId === ID_CONSOLIDADA || contextoGlobalId === ID_INSTITUCIONAL ? [] : [contextoGlobalId];
}

/** RN-03.02: em criação manual, a pessoa conectada. */
export function formularioAtividadeVazio(tipo: TipoNovo, pessoaId: string, contextoGlobalId: string): FormularioAtividade {
  return {
    tipo,
    titulo: '',
    descricao: '',
    area_id: '',
    contextos: contextosIniciais(contextoGlobalId),
    responsavel_id: pessoaId,
    participantes: [],
    prioridade: 'normal',
    inicio: '',
    prazo: '',
    prazo_hora: '',
    aviso_dia: '',
    aviso_hora: '',
    solicitante: pessoaId,
    solicitante_texto: '',
    resultado_esperado: '',
    checklist: '',
    vinculo: '',
    arquivo: '',
  };
}

/** CA-03.07: mantém tipo, contexto e responsável, e limpa o resto. */
export function formularioDoProximo(atual: FormularioAtividade, pessoaId: string): FormularioAtividade {
  return { ...formularioAtividadeVazio(atual.tipo, pessoaId, ID_CONSOLIDADA), contextos: atual.contextos, responsavel_id: atual.responsavel_id };
}

/** RN-03.02: área não compartilhada sugere a responsável padrão; compartilhada exige escolha (`null`). */
export function responsavelDaArea(areaId: string, areas: readonly Area[], pessoas: readonly Pessoa[]): string | null {
  const area = areas.find((item) => item.id === areaId);
  if (!area || area.compartilhada || !area.responsavel_padrao_id) return null;
  return pessoasDoSeletor(pessoas).some((pessoa) => pessoa.id === area.responsavel_padrao_id) ? area.responsavel_padrao_id : null;
}

export function areaCompartilhada(areaId: string, areas: readonly Area[]): boolean {
  return Boolean(areas.find((item) => item.id === areaId)?.compartilhada);
}

export type PrazoRapido = 'hoje' | 'amanha' | 'semana';

function diasDepois(dia: string, dias: number): string {
  const data = new Date(`${dia}T00:00:00Z`);
  data.setUTCDate(data.getUTCDate() + dias);
  return data.toISOString().slice(0, 10);
}

/** Os atalhos da folha (18 §10.6). "Esta semana" é a sexta; depois da sexta, o domingo. */
export function dataDoPrazoRapido(opcao: PrazoRapido, hoje: string): string {
  if (opcao === 'hoje') return hoje;
  if (opcao === 'amanha') return diasDepois(hoje, 1);
  const dia = new Date(`${hoje}T00:00:00Z`).getUTCDay();
  if (dia === 0) return hoje;
  return diasDepois(hoje, dia <= 5 ? 5 - dia : 1);
}

/** Um item por linha, sem linhas vazias. */
export function itensDoChecklist(texto: string): string[] {
  return texto
    .split('\n')
    .map((linha) => linha.trim())
    .filter(Boolean);
}

/** Só avisam e deixam continuar (RT-14). */
export function avisosDaAtividade(formulario: Pick<FormularioAtividade, 'titulo' | 'descricao' | 'resultado_esperado' | 'checklist'>): readonly string[] {
  return [formulario.titulo, formulario.descricao, formulario.resultado_esperado, formulario.checklist].some(pareceCredencial) ? [AVISO_CREDENCIAL] : [];
}

export function dadosDaAtividadeNova(formulario: FormularioAtividade) {
  const lembrete = formulario.tipo === 'lembrete';
  const demanda = formulario.tipo === 'demanda';
  const solicitantePessoa = demanda && formulario.solicitante !== SOLICITANTE_OUTRA ? formulario.solicitante : null;
  return {
    tipo: formulario.tipo,
    titulo: formulario.titulo,
    descricao: formulario.descricao || null,
    area_id: formulario.area_id || null,
    responsavel_id: formulario.responsavel_id,
    prioridade: formulario.prioridade,
    situacao: 'a_fazer' as const,
    bloqueada: false,
    bloqueio_motivo: null,
    bloqueada_em: null,
    inicio: lembrete ? null : formulario.inicio || null,
    prazo: lembrete ? null : formulario.prazo || null,
    prazo_hora: lembrete ? null : formulario.prazo_hora || null,
    aviso_em: formulario.aviso_dia && formulario.aviso_hora ? instanteNoFuso(formulario.aviso_dia, formulario.aviso_hora) : null,
    solicitante_pessoa_id: solicitantePessoa || null,
    solicitante_texto: demanda && !solicitantePessoa ? formulario.solicitante_texto || null : null,
    resultado_esperado: demanda ? formulario.resultado_esperado || null : null,
    aguardando_de_pessoa_id: null,
    aguardando_de_texto: null,
    aguardando_desde: null,
    acompanhamento_em: null,
    recorrencia_id: null,
    ocorrencia_numero: null,
    ocorrencia_data: null,
    editada_individualmente: false,
    origem_tipo: null,
    origem_id: null,
    alerta_motivo: null,
    alerta_data_referencia: null,
    alerta_acao: null,
    chave_idempotencia: null,
    adiamentos: 0,
    concluida_em: null,
    concluida_por: null,
    conclusao_nota: null,
    cancelada_motivo: null,
    dispensada_motivo: null,
  };
}

/** Grava a atividade e tudo o que vem com ela de uma vez, ou nada (AR-02). */
export async function criarAtividade(formulario: FormularioAtividade): Promise<Atividade> {
  return emTransacao(async () => {
    const atividade = await repositorios.atividade.criar(dadosDaAtividadeNova(formulario));
    for (const produto_id of formulario.contextos.filter((id) => id !== ID_INSTITUCIONAL)) await repositorios.atividade_produto.criar({ atividade_id: atividade.id, produto_id });
    for (const pessoa_id of formulario.participantes.filter((id) => id !== formulario.responsavel_id)) await repositorios.atividade_participante.criar({ atividade_id: atividade.id, pessoa_id });
    if (formulario.tipo !== 'lembrete') {
      let ordem = 0;
      for (const texto of itensDoChecklist(formulario.checklist)) await repositorios.checklist_item.criar({ registro_tipo: 'atividade', registro_id: atividade.id, ordem: ordem++, texto, responsavel_id: null, feito: false, feito_por: null, feito_em: null });
    }
    const [tipo, id] = formulario.vinculo.split(':');
    if (tipo && id) await repositorios.vinculo.criar(parDoVinculo({ tipo: 'atividade', id: atividade.id }, { tipo, id }));
    if (formulario.arquivo) await repositorios.anexo_link.criar({ registro_tipo: 'atividade', registro_id: atividade.id, titulo: 'Arquivo do Drive', url: formulario.arquivo });
    return atividade;
  });
}

export const MENSAGEM_DE_CRIADA: Readonly<Record<TipoNovo, string>> = { tarefa: 'Tarefa criada.', demanda: 'Demanda criada.', lembrete: 'Lembrete criado.' };

export type DadosDoFormulario = {
  pessoas: Pessoa[];
  areas: Area[];
  produtos: Produto[];
  marcas: Marca[];
  contrapartes: Contraparte[];
};

export async function carregarFormularioAtividade(): Promise<DadosDoFormulario> {
  const [pessoas, areas, produtos, marcas, contrapartes] = await Promise.all([repositorios.pessoa.listar(), repositorios.area.listar(), repositorios.produto.listar(), repositorios.marca.listar(), repositorios.contraparte.listar()]);
  return { pessoas, areas: areas.sort((a, b) => a.ordem - b.ordem), produtos: produtos.filter((produto) => produto.situacao === 'ativo'), marcas, contrapartes };
}
