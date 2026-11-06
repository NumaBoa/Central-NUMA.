/** Regras de T02.03 (04-M02): áreas, responsável padrão e o que impede arquivar. */
import { z } from 'zod';
import { ErroDeRegra } from '@/dados/erros';
import { repositorios } from '@/dados/repositorios';
import type { Area, PessoaArea } from '@/dados/tipos/area';
import type { Pessoa } from '@/dados/tipos/pessoa';
import { quantasAtividadesAbertasNaArea } from './atividades';
import { normalizarTexto } from './duplicidade';
import { pessoasDoSeletor } from './pessoa-atual';

/** Compartilhada não tem responsável; a que não é compartilhada precisa de uma, para poder sugerir. */
export const esquemaFormularioArea = z
  .object({
    nome: z.string().trim().min(1, 'Informe o nome da área.'),
    compartilhada: z.boolean(),
    responsavel_padrao_id: z.string(),
  })
  .superRefine((area, contexto) => {
    if (!area.compartilhada && !area.responsavel_padrao_id) {
      contexto.addIssue({ code: 'custom', path: ['responsavel_padrao_id'], message: 'Escolha a responsável padrão, ou marque a área como compartilhada.' });
    }
  });

export type FormularioArea = z.infer<typeof esquemaFormularioArea>;

export const FORMULARIO_AREA_VAZIO: FormularioArea = { nome: '', compartilhada: false, responsavel_padrao_id: '' };

export const MENSAGEM_NOME_REPETIDO = 'Já existe uma área com esse nome.';

export function formularioDaArea(area: Area): FormularioArea {
  return { nome: area.nome, compartilhada: area.compartilhada, responsavel_padrao_id: area.responsavel_padrao_id ?? '' };
}

/** Nome único (16 §4.2), sem considerar acentos e maiúsculas, entre as áreas ativas. */
export function nomeDeAreaRepetido(nome: string, areas: readonly Area[], idAtual?: string): boolean {
  const procurado = normalizarTexto(nome);
  return areas.some((area) => area.id !== idAtual && !area.arquivado_em && normalizarTexto(area.nome) === procurado);
}

export const pessoasParaArea = pessoasDoSeletor;

/** A responsável pode ter saído da lista: a tela avisa e pede outra, sem trocar sozinha. */
export function responsavelForaDaLista(area: Area, pessoas: readonly Pessoa[]): boolean {
  return Boolean(area.responsavel_padrao_id) && !pessoasParaArea(pessoas).some((pessoa) => pessoa.id === area.responsavel_padrao_id);
}

export async function salvarArea(formulario: FormularioArea, id?: string): Promise<Area> {
  const areas = await repositorios.area.listar();
  if (nomeDeAreaRepetido(formulario.nome, areas, id)) throw new ErroDeRegra(MENSAGEM_NOME_REPETIDO);
  const dados = {
    nome: formulario.nome,
    compartilhada: formulario.compartilhada,
    responsavel_padrao_id: formulario.compartilhada ? null : formulario.responsavel_padrao_id,
  };
  if (id) return repositorios.area.atualizar(id, dados);
  const todas = await repositorios.area.listar({ incluirArquivados: true });
  return repositorios.area.criar({ ...dados, ordem: todas.reduce((maior, area) => Math.max(maior, area.ordem), 0) + 1 });
}

/** Quem usa a área. Cada módulo novo que apontar para ela acrescenta aqui (atividades, decisões…). */
export function pessoasDaArea(id: string, pessoas: readonly Pessoa[], ligacoes: readonly PessoaArea[]): Pessoa[] {
  const delas = new Set(ligacoes.filter((ligacao) => ligacao.area_id === id).map((ligacao) => ligacao.pessoa_id));
  return pessoas.filter((pessoa) => delas.has(pessoa.id));
}

/** "Não excluídas se em uso" (T02.03): em uso, fica bloqueada e diz por quem. */
export async function arquivarArea(id: string): Promise<void> {
  const [pessoas, ligacoes] = await Promise.all([repositorios.pessoa.listar({ incluirArquivados: true }), repositorios.pessoa_area.listar({ onde: { area_id: id } })]);
  const usadaPor = pessoasDaArea(id, pessoas, ligacoes);
  if (usadaPor.length) {
    throw new ErroDeRegra(`Esta área está em uso: ${usadaPor.map((pessoa) => pessoa.nome_completo).join(', ')} ${usadaPor.length === 1 ? 'atua' : 'atuam'} nela. Tire a área da ficha dessas pessoas antes de arquivar.`);
  }
  const abertas = await quantasAtividadesAbertasNaArea(id);
  if (abertas) throw new ErroDeRegra(`Esta área tem ${abertas === 1 ? '1 atividade aberta' : `${abertas} atividades abertas`}. Conclua ou troque a área antes.`);
  await repositorios.area.arquivar(id);
}

export async function restaurarArea(id: string): Promise<void> {
  const [area, ativas] = await Promise.all([repositorios.area.obter(id), repositorios.area.listar()]);
  if (area && nomeDeAreaRepetido(area.nome, ativas, id)) throw new ErroDeRegra(MENSAGEM_NOME_REPETIDO);
  await repositorios.area.restaurar(id);
}

export type DadosAreas = {
  areas: Area[];
  pessoas: Pessoa[];
  ligacoes: PessoaArea[];
};

export async function carregarAreas(): Promise<DadosAreas> {
  const [areas, pessoas, ligacoes] = await Promise.all([repositorios.area.listar({ incluirArquivados: true }), repositorios.pessoa.listar({ incluirArquivados: true }), repositorios.pessoa_area.listar()]);
  return { areas: areas.sort((a, b) => a.ordem - b.ordem), pessoas, ligacoes };
}
