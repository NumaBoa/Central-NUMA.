/** Regras de T02.02 (04-M02): cadastro, duplicidade, situação, arquivo e o que depende de cada pessoa. */
import { z } from 'zod';
import { ErroDeDados, ErroDeRegra } from '@/dados/erros';
import { repositorios } from '@/dados/repositorios';
import { emTransacao } from '@/dados/transacao';
import type { Area, PessoaArea } from '@/dados/tipos/area';
import type { Contraparte } from '@/dados/tipos/contraparte';
import type { Pessoa } from '@/dados/tipos/pessoa';
import { vinculosDeAtividadeDaPessoa } from './atividades';
import { vinculosDeAtivoDaPessoa } from './ativos';
import { vinculosDeFerramentaDaPessoa } from './ferramentas';
import { vinculosDeRotinaDaPessoa } from './recorrencias';
import { cpfValido, nomesParecidos, normalizarTexto, soDigitos, telefoneValido } from './duplicidade';
import { pessoasDoSeletor } from './pessoa-atual';
import { pareceCredencial } from './segredos';

export const ROTULOS_TIPO = { interna: 'Interna', externa: 'Externa' } as const;
export const ROTULOS_SITUACAO = { ativa: 'Ativa', inativa: 'Inativa' } as const;
export const ROTULOS_PAPEL = { principal: 'Principal', financeiro: 'Financeiro', tecnico: 'Técnico', juridico: 'Jurídico', outro: 'Outro' } as const;

export type PapelContato = keyof typeof ROTULOS_PAPEL;

const opcional = (valido: (valor: string) => boolean, mensagem: string) =>
  z
    .string()
    .trim()
    .refine((valor) => !valor || valido(valor), mensagem);

export const esquemaFormularioPessoa = z.object({
  nome_completo: z.string().trim().min(1, 'Informe o nome completo.'),
  nome_exibicao: z.string().trim(),
  tipo: z.enum(['interna', 'externa']),
  eh_socia: z.boolean(),
  contraparte_id: z.string(),
  papeis_contato: z.array(z.enum(['principal', 'financeiro', 'tecnico', 'juridico', 'outro'])),
  funcao: z.string().trim(),
  email: opcional((valor) => z.email().safeParse(valor).success, 'Informe um e-mail válido.'),
  telefone: opcional(telefoneValido, 'Use o formato (00) 00000-0000.'),
  cpf: opcional(cpfValido, 'Este CPF não é válido. Confira os números.'),
  areas: z.array(z.string()),
  observacoes: z.string().trim(),
  situacao: z.enum(['ativa', 'inativa']),
});

export type FormularioPessoa = z.infer<typeof esquemaFormularioPessoa>;

export const FORMULARIO_PESSOA_VAZIO: FormularioPessoa = {
  nome_completo: '',
  nome_exibicao: '',
  tipo: 'interna',
  eh_socia: false,
  contraparte_id: '',
  papeis_contato: [],
  funcao: '',
  email: '',
  telefone: '',
  cpf: '',
  areas: [],
  observacoes: '',
  situacao: 'ativa',
};

// ---------- Máscaras ----------

/** (00) 00000-0000, ou (00) 0000-0000 no fixo, enquanto se digita. */
export function formatarTelefone(texto: string): string {
  const digitos = soDigitos(texto).slice(0, 11);
  if (digitos.length <= 2) return digitos ? `(${digitos}` : '';
  const ddd = digitos.slice(0, 2);
  const numero = digitos.slice(2);
  const corte = digitos.length === 11 ? 5 : 4;
  return numero.length <= corte ? `(${ddd}) ${numero}` : `(${ddd}) ${numero.slice(0, corte)}-${numero.slice(corte)}`;
}

/** 000.000.000-00, enquanto se digita. */
export function formatarCpf(texto: string): string {
  const digitos = soDigitos(texto).slice(0, 11);
  return digitos.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
}

/** Padrão de T02.02: primeiro nome + sobrenome. */
export function nomeDeExibicaoPadrao(nomeCompleto: string): string {
  const partes = nomeCompleto.trim().split(/\s+/);
  return partes.length > 1 ? `${partes[0]} ${partes[partes.length - 1]}` : (partes[0] ?? '');
}

// ---------- Conversão ----------

export function formularioDaPessoa(pessoa: Pessoa, areasDaPessoa: readonly string[]): FormularioPessoa {
  return {
    nome_completo: pessoa.nome_completo,
    nome_exibicao: pessoa.nome_exibicao ?? '',
    tipo: pessoa.tipo,
    eh_socia: pessoa.eh_socia,
    contraparte_id: pessoa.contraparte_id ?? '',
    papeis_contato: pessoa.papeis_contato,
    funcao: pessoa.funcao ?? '',
    email: pessoa.email ?? '',
    telefone: pessoa.telefone ? formatarTelefone(pessoa.telefone) : '',
    cpf: pessoa.cpf ? formatarCpf(pessoa.cpf) : '',
    areas: [...areasDaPessoa],
    observacoes: pessoa.observacoes ?? '',
    situacao: pessoa.situacao,
  };
}

/** Vazio é vazio (RT-08). O que só vale para um tipo some ao mudar de tipo. */
export function dadosDoFormulario(formulario: FormularioPessoa) {
  const interna = formulario.tipo === 'interna';
  return {
    nome_completo: formulario.nome_completo,
    nome_exibicao: formulario.nome_exibicao || nomeDeExibicaoPadrao(formulario.nome_completo),
    tipo: formulario.tipo,
    eh_socia: interna && formulario.eh_socia,
    contraparte_id: interna ? null : formulario.contraparte_id || null,
    papeis_contato: interna ? [] : formulario.papeis_contato,
    funcao: formulario.funcao || null,
    email: formulario.email || null,
    telefone: formulario.telefone ? soDigitos(formulario.telefone) : null,
    cpf: formulario.cpf ? soDigitos(formulario.cpf) : null,
    observacoes: formulario.observacoes || null,
    situacao: formulario.situacao,
  };
}

// ---------- Duplicidade (RN-02.02) ----------

export type Conferencia = {
  /** CPF igual bloqueia (CA-02.01). */
  cpfRepetido: Pessoa | null;
  /** Só avisam e deixam continuar. */
  avisos: readonly string[];
};

export function conferirDados(formulario: FormularioPessoa, pessoas: readonly Pessoa[], idAtual?: string): Conferencia {
  const dados = dadosDoFormulario(formulario);
  const outras = pessoas.filter((pessoa) => pessoa.id !== idAtual);
  const avisos: string[] = [];
  for (const pessoa of outras) {
    if (dados.email && pessoa.email && normalizarTexto(pessoa.email) === normalizarTexto(dados.email)) avisos.push(`E-mail igual ao de ${pessoa.nome_completo}.`);
    if (dados.telefone && pessoa.telefone === dados.telefone) avisos.push(`Telefone igual ao de ${pessoa.nome_completo}.`);
    if (nomesParecidos(dados.nome_completo, pessoa.nome_completo)) avisos.push(`Nome parecido com ${pessoa.nome_completo}.`);
  }
  if (pareceCredencial(dados.observacoes ?? '')) avisos.push('As observações parecem conter uma senha ou um token, e a Central não guarda segredos.');
  return { cpfRepetido: dados.cpf ? (outras.find((pessoa) => pessoa.cpf === dados.cpf) ?? null) : null, avisos };
}

export async function conferirPessoa(formulario: FormularioPessoa, idAtual?: string): Promise<Conferencia> {
  return conferirDados(formulario, await repositorios.pessoa.listar({ incluirArquivados: true }), idAtual);
}

// ---------- "Você é" precisa de alguém ----------

export const MENSAGEM_ULTIMA_PESSOA = 'Esta é a única pessoa interna ativa, e o “Você é” precisa de pelo menos uma. Cadastre outra antes.';

/** Verdadeiro se, depois da mudança, ainda houver alguém para escolher em "Você é" (02 §0.4). */
export function restaAlguemNoSeletor(pessoas: readonly Pessoa[], id: string, mudanca: Partial<Pessoa>): boolean {
  return pessoasDoSeletor(pessoas.map((pessoa) => (pessoa.id === id ? { ...pessoa, ...mudanca } : pessoa))).length > 0;
}

async function exigirAlguemNoSeletor(id: string, mudanca: Partial<Pessoa>) {
  if (!restaAlguemNoSeletor(await repositorios.pessoa.listar(), id, mudanca)) throw new ErroDeRegra(MENSAGEM_ULTIMA_PESSOA);
}

// ---------- Salvar ----------

/** As áreas da pessoa passam a ser exatamente estas: o que saiu é arquivado, o que entrou é criado. */
async function definirAreas(pessoaId: string, areas: readonly string[], interna: boolean) {
  const desejadas = new Set(interna ? areas : []);
  const atuais = await repositorios.pessoa_area.listar({ onde: { pessoa_id: pessoaId } });
  for (const ligacao of atuais) {
    if (!desejadas.has(ligacao.area_id)) await repositorios.pessoa_area.arquivar(ligacao.id);
    desejadas.delete(ligacao.area_id);
  }
  for (const areaId of desejadas) await repositorios.pessoa_area.criar({ pessoa_id: pessoaId, area_id: areaId });
}

/** Grava a pessoa e as áreas dela de uma vez. CPF repetido é barrado aqui também, não só na tela. */
export async function salvarPessoa(formulario: FormularioPessoa, id?: string): Promise<Pessoa> {
  const { cpfRepetido } = await conferirPessoa(formulario, id);
  if (cpfRepetido) throw new ErroDeRegra(`Já existe: ${cpfRepetido.nome_completo}.`);
  const dados = dadosDoFormulario(formulario);
  if (id) await exigirAlguemNoSeletor(id, { tipo: dados.tipo, situacao: dados.situacao });
  return emTransacao(async () => {
    const pessoa = id ? await repositorios.pessoa.atualizar(id, dados) : await repositorios.pessoa.criar(dados);
    await definirAreas(pessoa.id, formulario.areas, dados.tipo === 'interna');
    return pessoa;
  });
}

// ---------- Vínculos e situação ----------

/** O que depende da pessoa. Cada módulo novo que apontar para ela acrescenta a sua linha aqui. */
export async function vinculosDaPessoa(id: string): Promise<string[]> {
  const [areas, ligacoes, configuracoes, produtos, contrapartes, entidades, representacoes, contas] = await Promise.all([
    repositorios.area.listar(),
    repositorios.pessoa_area.listar({ onde: { pessoa_id: id } }),
    repositorios.configuracao.ler(),
    repositorios.produto.listar({ onde: { responsavel_id: id } }),
    repositorios.contraparte.listar({ onde: { responsavel_id: id } }),
    repositorios.entidade.listar(),
    repositorios.entidade_representante.listar({ onde: { pessoa_id: id } }),
    repositorios.conta_financeira.listar({ onde: { titular_pessoa_id: id } }),
  ]);
  const deAtividades = [...(await vinculosDeAtividadeDaPessoa(id)), ...(await vinculosDeRotinaDaPessoa(id)), ...(await vinculosDeFerramentaDaPessoa(id)), ...(await vinculosDeAtivoDaPessoa(id))];
  const nomeDaArea = new Map(areas.map((area) => [area.id, area.nome]));
  return [
    ...areas.filter((area) => area.responsavel_padrao_id === id).map((area) => `Responsável padrão de ${area.nome}`),
    ...ligacoes.flatMap((ligacao) => {
      const nome = nomeDaArea.get(ligacao.area_id);
      return nome ? [`Atua em ${nome}`] : [];
    }),
    ...produtos.map((produto) => `Responsável pelo produto ${produto.nome}`),
    ...contrapartes.map((contraparte) => `Responsável por ${contraparte.nome_fantasia || contraparte.nome}`),
    ...contas.map((conta) => `Titular da conta ${conta.nome}`),
    ...deAtividades,
    ...representacoes.flatMap((representacao) => {
      const entidade = entidades.find((item) => item.id === representacao.entidade_id);
      return entidade ? [`Representante de ${entidade.nome}`] : [];
    }),
    ...(configuracoes.responsavel_backup_id === id ? ['Responsável pelo backup semanal'] : []),
  ];
}

/** Inativa não aparece nos seletores de novos registros, mas continua nos antigos (RN-02.04, CA-02.02). */
export async function inativarPessoa(id: string): Promise<void> {
  await exigirAlguemNoSeletor(id, { situacao: 'inativa' });
  await repositorios.pessoa.atualizar(id, { situacao: 'inativa' });
}

export async function reativarPessoa(id: string): Promise<void> {
  await repositorios.pessoa.atualizar(id, { situacao: 'ativa' });
}

/** Decisão de 05/11/2026: com vínculos, só inativar; sem vínculos, pode arquivar. */
export async function arquivarPessoa(id: string): Promise<void> {
  const vinculos = await vinculosDaPessoa(id);
  if (vinculos.length) throw new ErroDeRegra(`Esta pessoa tem vínculos: ${vinculos.join(', ')}. Se ela saiu, inative.`);
  const pessoa = await repositorios.pessoa.obter(id);
  if (!pessoa) throw new ErroDeDados('nao_encontrado');
  await exigirAlguemNoSeletor(id, { arquivado_em: new Date().toISOString() });
  await repositorios.pessoa.arquivar(id);
}

export async function restaurarPessoa(id: string): Promise<void> {
  await repositorios.pessoa.restaurar(id);
}

// ---------- Lista ----------

export type FiltrosPessoas = {
  busca: string;
  tipo: 'todas' | Pessoa['tipo'];
  situacao: 'todas' | Pessoa['situacao'];
  contraparte: string;
  arquivadas: boolean;
};

export const FILTROS_PESSOAS_INICIAIS: FiltrosPessoas = { busca: '', tipo: 'todas', situacao: 'todas', contraparte: '', arquivadas: false };

/** Busca por nome, e-mail ou telefone, sem considerar acentos nem pontuação do número. */
export function filtrarPessoas(pessoas: readonly Pessoa[], { busca, tipo, situacao, contraparte, arquivadas }: FiltrosPessoas): Pessoa[] {
  const texto = normalizarTexto(busca);
  const numeros = soDigitos(busca);
  return pessoas
    .filter((pessoa) => Boolean(pessoa.arquivado_em) === arquivadas)
    .filter((pessoa) => tipo === 'todas' || pessoa.tipo === tipo)
    .filter((pessoa) => situacao === 'todas' || pessoa.situacao === situacao)
    .filter((pessoa) => !contraparte || pessoa.contraparte_id === contraparte)
    .filter((pessoa) => !texto || normalizarTexto(`${pessoa.nome_completo} ${pessoa.email ?? ''}`).includes(texto) || (numeros.length > 0 && (pessoa.telefone ?? '').includes(numeros)))
    .sort((a, b) => a.nome_completo.localeCompare(b.nome_completo, 'pt-BR'));
}

// ---------- Telas ----------

export type DadosPessoas = {
  pessoas: Pessoa[];
  areas: Area[];
  ligacoes: PessoaArea[];
  contrapartes: Contraparte[];
};

export async function carregarPessoas(): Promise<DadosPessoas> {
  const [pessoas, areas, ligacoes, contrapartes] = await Promise.all([repositorios.pessoa.listar({ incluirArquivados: true }), repositorios.area.listar(), repositorios.pessoa_area.listar(), repositorios.contraparte.listar({ incluirArquivados: true })]);
  const nomeDe = (contraparte: Contraparte) => contraparte.nome_fantasia || contraparte.nome;
  return { pessoas, areas: areas.sort((a, b) => a.ordem - b.ordem), ligacoes, contrapartes: contrapartes.sort((a, b) => nomeDe(a).localeCompare(nomeDe(b), 'pt-BR')) };
}

export function areasDaPessoa(id: string, { areas, ligacoes }: Pick<DadosPessoas, 'areas' | 'ligacoes'>): Area[] {
  const dela = new Set(ligacoes.filter((ligacao) => ligacao.pessoa_id === id).map((ligacao) => ligacao.area_id));
  return areas.filter((area) => dela.has(area.id));
}
