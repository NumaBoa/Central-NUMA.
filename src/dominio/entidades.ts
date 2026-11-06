/** Regras de T02.05 (04-M02): quem assina pela Numa. */
import { z } from 'zod';
import { ErroDeRegra } from '@/dados/erros';
import { repositorios } from '@/dados/repositorios';
import { emTransacao } from '@/dados/transacao';
import type { Contraparte, Entidade, EntidadeRepresentante } from '@/dados/tipos/contraparte';
import type { Pessoa } from '@/dados/tipos/pessoa';
import { nomeDaContraparte } from './contrapartes';
import { camposDoEndereco, CAMPOS_ENDERECO_VAZIOS, cepValido, enderecoCompleto, enderecoDosCampos, esquemaCamposEndereco } from './endereco';
import { cnpjValido, cpfValido, formatarCnpj, normalizarCnpj, soDigitos } from './duplicidade';
import { pessoasDoSeletor } from './pessoa-atual';
import { formatarCpf } from './pessoas';

export const ROTULOS_SITUACAO_ENTIDADE = { planejada: 'Planejada', em_constituicao: 'Em constituição', ativa: 'Ativa', encerrada: 'Encerrada' } as const;
export const ROTULOS_TIPO_ENTIDADE = { pj: 'Pessoa jurídica', pf: 'Pessoa física' } as const;

function documentoDaEntidadeValido(tipo: Entidade['tipo_pessoa'], documento: string): boolean {
  return tipo === 'pf' ? cpfValido(documento) : cnpjValido(documento);
}

export const esquemaFormularioEntidade = z
  .object({
    tipo_pessoa: z.enum(['pf', 'pj']),
    nome: z.string().trim().min(1, 'Informe o nome ou a razão social.'),
    nome_fantasia: z.string().trim(),
    documento: z.string().trim(),
    situacao: z.enum(['planejada', 'em_constituicao', 'ativa', 'encerrada']),
    natureza_juridica: z.string().trim(),
    regime_tributario: z.string().trim(),
    inscricao_municipal: z.string().trim(),
    inscricao_estadual: z.string().trim(),
    endereco: esquemaCamposEndereco,
    representantes: z.array(z.string()),
    data_abertura: z.string(),
    entidade_padrao: z.boolean(),
    contador_id: z.string(),
  })
  .superRefine((dados, contexto) => {
    const rotulo = dados.tipo_pessoa === 'pf' ? 'CPF' : 'CNPJ';
    const falha = (path: (string | number)[], message: string) => contexto.addIssue({ code: 'custom', path, message });
    if (dados.documento && !documentoDaEntidadeValido(dados.tipo_pessoa, dados.documento)) falha(['documento'], `Este ${rotulo} não é válido. Confira os números.`);
    if (dados.endereco.cep && !cepValido(dados.endereco.cep)) falha(['endereco', 'cep'], 'Use o formato 00000-000.');
    if (dados.situacao === 'encerrada' && dados.entidade_padrao) falha(['entidade_padrao'], 'Uma entidade encerrada não pode ser a padrão.');
    // T02.05: passar para Ativa exige documento válido, endereço, representante e data de abertura.
    if (dados.situacao === 'ativa') {
      if (!dados.documento) falha(['documento'], `Para ativar, informe o ${rotulo}.`);
      if (!enderecoCompleto(dados.endereco)) falha(['endereco', 'logradouro'], 'Para ativar, preencha o endereço: CEP, logradouro, número, bairro, cidade e estado.');
      if (!dados.representantes.length) falha(['representantes'], 'Para ativar, escolha pelo menos um representante legal.');
      if (!dados.data_abertura) falha(['data_abertura'], 'Para ativar, informe a data de abertura.');
    }
  });

export type FormularioEntidade = z.infer<typeof esquemaFormularioEntidade>;

export const FORMULARIO_ENTIDADE_VAZIO: FormularioEntidade = {
  tipo_pessoa: 'pj',
  nome: '',
  nome_fantasia: '',
  documento: '',
  situacao: 'planejada',
  natureza_juridica: '',
  regime_tributario: '',
  inscricao_municipal: '',
  inscricao_estadual: '',
  endereco: { ...CAMPOS_ENDERECO_VAZIOS },
  representantes: [],
  data_abertura: '',
  entidade_padrao: false,
  contador_id: '',
};

export function formatarDocumentoDaEntidade(tipo: Entidade['tipo_pessoa'], documento: string): string {
  return tipo === 'pf' ? formatarCpf(documento) : formatarCnpj(documento);
}

export function formularioDaEntidade(entidade: Entidade, representantes: readonly string[]): FormularioEntidade {
  return {
    tipo_pessoa: entidade.tipo_pessoa,
    nome: entidade.nome,
    nome_fantasia: entidade.nome_fantasia ?? '',
    documento: entidade.documento ? formatarDocumentoDaEntidade(entidade.tipo_pessoa, entidade.documento) : '',
    situacao: entidade.situacao,
    natureza_juridica: entidade.natureza_juridica ?? '',
    regime_tributario: entidade.regime_tributario ?? '',
    inscricao_municipal: entidade.inscricao_municipal ?? '',
    inscricao_estadual: entidade.inscricao_estadual ?? '',
    endereco: camposDoEndereco(entidade.endereco),
    representantes: [...representantes],
    data_abertura: entidade.data_abertura ?? '',
    entidade_padrao: entidade.entidade_padrao,
    contador_id: entidade.contador_id ?? '',
  };
}

export function dadosDaEntidade(formulario: FormularioEntidade) {
  return {
    tipo_pessoa: formulario.tipo_pessoa,
    nome: formulario.nome,
    nome_fantasia: formulario.nome_fantasia || null,
    documento: formulario.documento ? (formulario.tipo_pessoa === 'pf' ? soDigitos(formulario.documento) : normalizarCnpj(formulario.documento)) : null,
    situacao: formulario.situacao,
    natureza_juridica: formulario.natureza_juridica || null,
    regime_tributario: formulario.regime_tributario || null,
    inscricao_municipal: formulario.inscricao_municipal || null,
    inscricao_estadual: formulario.inscricao_estadual || null,
    endereco: enderecoDosCampos(formulario.endereco),
    data_abertura: formulario.data_abertura || null,
    entidade_padrao: formulario.entidade_padrao,
    contador_id: formulario.contador_id || null,
  };
}

export function nomeDaEntidade(entidade: Pick<Entidade, 'nome' | 'nome_fantasia'>): string {
  return entidade.nome_fantasia || entidade.nome;
}

export function ordenarEntidades<T extends Pick<Entidade, 'nome' | 'nome_fantasia'>>(entidades: readonly T[]): T[] {
  return [...entidades].sort((a, b) => nomeDaEntidade(a).localeCompare(nomeDaEntidade(b), 'pt-BR'));
}

/** Pessoas internas (T02.05). */
export const pessoasParaRepresentante = pessoasDoSeletor;

/** CA-02.04: "Planejada" pode ser vinculada a produtos e rascunhos, mas não aparece para emissão final. */
export function entidadesParaEmissao(entidades: readonly Entidade[]): Entidade[] {
  return entidades.filter((entidade) => entidade.situacao === 'ativa' && !entidade.arquivado_em);
}

/** Para produtos e rascunhos: qualquer uma que não tenha sido encerrada ou arquivada. */
export function entidadesParaVincular(entidades: readonly Entidade[]): Entidade[] {
  return ordenarEntidades(entidades.filter((entidade) => entidade.situacao !== 'encerrada' && !entidade.arquivado_em));
}

async function definirRepresentantes(entidadeId: string, pessoas: readonly string[]) {
  const desejados = new Set(pessoas);
  const atuais = await repositorios.entidade_representante.listar({ onde: { entidade_id: entidadeId } });
  for (const ligacao of atuais) {
    if (!desejados.has(ligacao.pessoa_id)) await repositorios.entidade_representante.arquivar(ligacao.id);
    desejados.delete(ligacao.pessoa_id);
  }
  for (const pessoaId of desejados) await repositorios.entidade_representante.criar({ entidade_id: entidadeId, pessoa_id: pessoaId });
}

/** Grava a entidade e os representantes de uma vez. "Entidade padrão": só uma (T02.05). */
export async function salvarEntidade(formulario: FormularioEntidade, id?: string): Promise<Entidade> {
  const dados = dadosDaEntidade(formulario);
  return emTransacao(async () => {
    const entidade = id ? await repositorios.entidade.atualizar(id, dados) : await repositorios.entidade.criar(dados);
    if (dados.entidade_padrao) {
      for (const outra of await repositorios.entidade.listar({ onde: { entidade_padrao: true } })) {
        if (outra.id !== entidade.id) await repositorios.entidade.atualizar(outra.id, { entidade_padrao: false });
      }
    }
    await definirRepresentantes(entidade.id, formulario.representantes);
    return entidade;
  });
}

/** O que depende da entidade. Contratos e propostas acrescentam aqui na F1. */
export async function vinculosDaEntidade(id: string): Promise<string[]> {
  const produtos = await repositorios.produto.listar({ onde: { entidade_id: id } });
  return produtos.map((produto) => `Produto ${produto.nome}`);
}

/** Arquivada não é sugerida em novos contratos: deixa de ser a padrão, e não volta a ser ao restaurar. */
export async function arquivarEntidade(id: string): Promise<void> {
  const vinculos = await vinculosDaEntidade(id);
  if (vinculos.length) throw new ErroDeRegra(`Esta entidade está em uso: ${vinculos.join(', ')}. Troque a entidade desses produtos antes.`);
  await emTransacao(async () => {
    if ((await repositorios.entidade.obter(id))?.entidade_padrao) await repositorios.entidade.atualizar(id, { entidade_padrao: false });
    await repositorios.entidade.arquivar(id);
  });
}

export async function restaurarEntidade(id: string): Promise<void> {
  await repositorios.entidade.restaurar(id);
}

export type DadosEntidades = {
  entidades: Entidade[];
  representantes: EntidadeRepresentante[];
  pessoas: Pessoa[];
  contrapartes: Contraparte[];
};

export async function carregarEntidades(): Promise<DadosEntidades> {
  const [entidades, representantes, pessoas, contrapartes] = await Promise.all([repositorios.entidade.listar({ incluirArquivados: true }), repositorios.entidade_representante.listar(), repositorios.pessoa.listar({ incluirArquivados: true }), repositorios.contraparte.listar()]);
  return { entidades: ordenarEntidades(entidades), representantes, pessoas, contrapartes: [...contrapartes].sort((a, b) => nomeDaContraparte(a).localeCompare(nomeDaContraparte(b), 'pt-BR')) };
}

export function representantesDaEntidade(id: string, representantes: readonly EntidadeRepresentante[]): string[] {
  return representantes.filter((ligacao) => ligacao.entidade_id === id).map((ligacao) => ligacao.pessoa_id);
}
