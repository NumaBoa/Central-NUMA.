/** Regras de T02.05 (04-M02): quem assina pela Numa. */
import { z } from 'zod';
import { ErroDeRegra } from '@/dados/erros';
import { repositorios } from '@/dados/repositorios';
import { emTransacao } from '@/dados/transacao';
import type { Contraparte, Entidade, EntidadeRepresentante } from '@/dados/tipos/contraparte';
import type { EntidadeLicenciante, EntidadeSocias } from '@/dados/tipos/contrato';
import type { Pessoa } from '@/dados/tipos/pessoa';
import { sincronizarAlertasDeTransferencia } from './alertas-m06';
import { nomeDaContraparte } from './contrapartes';
import { camposDoEndereco, CAMPOS_ENDERECO_VAZIOS, cepValido, enderecoCompleto, enderecoDosCampos, esquemaCamposEndereco } from './endereco';
import { cnpjValido, cpfValido, formatarCnpj, normalizarCnpj, soDigitos } from './duplicidade';
import { pessoasDoSeletor } from './pessoa-atual';
import { formatarCpf } from './pessoas';

export const ROTULOS_SITUACAO_ENTIDADE = { planejada: 'Planejada', em_constituicao: 'Em constituição', ativa: 'Ativa', encerrada: 'Encerrada' } as const;
export const ROTULOS_TIPO_ENTIDADE = { pj: 'Pessoa jurídica', pf: 'Pessoa física', socias_pf: 'Sócias pessoas físicas' } as const;

function documentoDaEntidadeValido(tipo: Entidade['tipo_pessoa'], documento: string): boolean {
  return tipo === 'pf' ? cpfValido(documento) : cnpjValido(documento);
}

/** Uma sócia, como sai no contrato (19 §8). O percentual é texto no formulário. */
const esquemaLicenciante = z.object({ pessoa_id: z.string(), nome_civil: z.string().trim(), nacionalidade: z.string().trim(), cpf: z.string().trim(), endereco: z.string().trim(), email: z.string().trim(), responsabilidade_pct: z.string().trim() });
export type FormularioLicenciante = z.infer<typeof esquemaLicenciante>;

const lerPercentual = (texto: string) => {
  const valor = Number(texto.replace(',', '.'));
  return texto && Number.isFinite(valor) ? valor : null;
};

/** D-CTR-01: soma 100%, ou a emissão fica bloqueada (CA-11.21). */
export function proporcoesFecham(percentuais: readonly (number | null)[]): boolean {
  if (!percentuais.length || percentuais.some((valor) => valor === null)) return false;
  return Math.abs(percentuais.reduce<number>((total, valor) => total + (valor ?? 0), 0) - 100) < 0.0001;
}

export const esquemaFormularioEntidade = z
  .object({
    tipo_pessoa: z.enum(['pf', 'pj', 'socias_pf']),
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
    marca_comercial: z.string().trim(),
    licenciantes: z.array(esquemaLicenciante),
  })
  .superRefine((dados, contexto) => {
    const rotulo = dados.tipo_pessoa === 'pf' ? 'CPF' : 'CNPJ';
    const falha = (path: (string | number)[], message: string) => contexto.addIssue({ code: 'custom', path, message });
    if (dados.tipo_pessoa === 'socias_pf') {
      if (dados.situacao === 'encerrada' && dados.entidade_padrao) falha(['entidade_padrao'], 'Uma entidade encerrada não pode ser a padrão.');
      if (!dados.marca_comercial) falha(['marca_comercial'], 'Informe a marca comercial.');
      dados.licenciantes.forEach((sociaDoForm, indice) => {
        if (sociaDoForm.cpf && !cpfValido(sociaDoForm.cpf)) falha(['licenciantes', indice, 'cpf'], 'Este CPF não é válido. Confira os números.');
      });
      // D-CTR-06: Ativa sem CNPJ, com os dados de cada sócia e as proporções fechando 100%.
      if (dados.situacao === 'ativa') {
        if (!dados.licenciantes.length) falha(['licenciantes'], 'Para ativar, inclua as sócias.');
        const incompleta = dados.licenciantes.find((sociaDoForm) => !sociaDoForm.nome_civil || !sociaDoForm.cpf || !sociaDoForm.endereco);
        if (incompleta) falha(['licenciantes'], 'Para ativar, cada sócia precisa de nome civil, CPF e endereço.');
        if (!proporcoesFecham(dados.licenciantes.map((sociaDoForm) => lerPercentual(sociaDoForm.responsabilidade_pct)))) falha(['licenciantes'], 'Para ativar, as proporções de responsabilidade precisam somar 100%.');
      }
      return;
    }
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
  marca_comercial: '',
  licenciantes: [],
};

export function formatarDocumentoDaEntidade(tipo: Entidade['tipo_pessoa'], documento: string): string {
  if (tipo === 'socias_pf') return documento;
  return tipo === 'pf' ? formatarCpf(documento) : formatarCnpj(documento);
}

export function formularioDaEntidade(entidade: Entidade, representantes: readonly string[], socias?: { socias: EntidadeSocias | null; licenciantes: readonly EntidadeLicenciante[] }): FormularioEntidade {
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
    marca_comercial: socias?.socias?.marca_comercial ?? '',
    licenciantes: (socias?.licenciantes ?? []).map((linha) => ({ pessoa_id: linha.pessoa_id, nome_civil: linha.nome_civil ?? '', nacionalidade: linha.nacionalidade ?? '', cpf: linha.cpf ? formatarCpf(linha.cpf) : '', endereco: linha.endereco ?? '', email: linha.email ?? '', responsabilidade_pct: linha.responsabilidade_pct === null ? '' : String(linha.responsabilidade_pct).replace('.', ',') })),
  };
}

export function dadosDaEntidade(formulario: FormularioEntidade) {
  return {
    tipo_pessoa: formulario.tipo_pessoa,
    nome: formulario.nome,
    nome_fantasia: formulario.nome_fantasia || null,
    documento: formulario.documento && formulario.tipo_pessoa !== 'socias_pf' ? (formulario.tipo_pessoa === 'pf' ? soDigitos(formulario.documento) : normalizarCnpj(formulario.documento)) : null,
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

/** A marca comercial e as sócias (19 §8). Quem saiu é arquivado: o que já foi emitido guarda o próprio snapshot. */
async function definirSocias(entidadeId: string, formulario: FormularioEntidade) {
  const [atual] = await repositorios.entidade_socias.listar({ onde: { entidade_id: entidadeId } });
  if (formulario.tipo_pessoa === 'socias_pf') {
    if (atual) await repositorios.entidade_socias.atualizar(atual.id, { marca_comercial: formulario.marca_comercial });
    else await repositorios.entidade_socias.criar({ entidade_id: entidadeId, marca_comercial: formulario.marca_comercial });
  }
  const linhas = await repositorios.entidade_licenciante.listar({ onde: { entidade_id: entidadeId } });
  const desejadas = formulario.tipo_pessoa === 'socias_pf' ? formulario.licenciantes : [];
  for (const linha of linhas) if (!desejadas.some((socia) => socia.pessoa_id === linha.pessoa_id)) await repositorios.entidade_licenciante.arquivar(linha.id);
  for (const socia of desejadas) {
    const dados = { nome_civil: socia.nome_civil || null, nacionalidade: socia.nacionalidade || null, cpf: socia.cpf ? soDigitos(socia.cpf) : null, endereco: socia.endereco || null, email: socia.email || null, responsabilidade_pct: lerPercentual(socia.responsabilidade_pct) };
    const existente = linhas.find((linha) => linha.pessoa_id === socia.pessoa_id);
    if (existente) await repositorios.entidade_licenciante.atualizar(existente.id, dados);
    else await repositorios.entidade_licenciante.criar({ entidade_id: entidadeId, pessoa_id: socia.pessoa_id, ...dados });
  }
}

/** RN-11.02 e RN-11.35 a: o que falta para a entidade servir à emissão final. Cada linha diz o que corrigir. */
export function pendenciasDaEntidade(entidade: Pick<Entidade, 'tipo_pessoa' | 'situacao' | 'nome'>, licenciantes: readonly EntidadeLicenciante[]): string[] {
  if (entidade.tipo_pessoa === 'socias_pf') {
    const pendencias: string[] = [];
    if (!licenciantes.length) pendencias.push('Entidade: nenhuma sócia cadastrada.');
    for (const socia of licenciantes) {
      const nome = socia.nome_civil ?? 'sócia sem nome civil';
      if (!socia.nome_civil) pendencias.push('Entidade: nome civil de uma sócia não informado.');
      if (!socia.cpf) pendencias.push(`Entidade: CPF de ${nome} não informado`);
      if (!socia.endereco) pendencias.push(`Entidade: endereço de ${nome} não informado`);
    }
    if (licenciantes.length && !proporcoesFecham(licenciantes.map((socia) => socia.responsabilidade_pct))) pendencias.push('Entidade: proporção de responsabilidade das sócias');
    if (entidade.situacao !== 'ativa') pendencias.push(`Entidade: ${entidade.nome} ainda não está Ativa.`);
    return pendencias;
  }
  return entidade.situacao === 'ativa' ? [] : [`Entidade: ${entidade.nome} ainda não está Ativa. Rascunho pode; emissão final, não.`];
}

/** Grava a entidade e os representantes de uma vez. "Entidade padrão": só uma (T02.05). PJ que fica Ativa gera as transferências pendentes (RN-06.07). */
export async function salvarEntidade(formulario: FormularioEntidade, id?: string): Promise<Entidade> {
  const dados = dadosDaEntidade(formulario);
  const salva = await emTransacao(async () => {
    const entidade = id ? await repositorios.entidade.atualizar(id, dados) : await repositorios.entidade.criar(dados);
    if (dados.entidade_padrao) {
      for (const outra of await repositorios.entidade.listar({ onde: { entidade_padrao: true } })) {
        if (outra.id !== entidade.id) await repositorios.entidade.atualizar(outra.id, { entidade_padrao: false });
      }
    }
    await definirRepresentantes(entidade.id, formulario.tipo_pessoa === 'socias_pf' ? [] : formulario.representantes);
    await definirSocias(entidade.id, formulario);
    return entidade;
  });
  if (salva.tipo_pessoa === 'pj' && salva.situacao === 'ativa') await sincronizarAlertasDeTransferencia();
  return salva;
}

/** O que depende da entidade. Contratos e propostas acrescentam aqui na F1. */
export async function vinculosDaEntidade(id: string): Promise<string[]> {
  const [produtos, contas] = await Promise.all([repositorios.produto.listar({ onde: { entidade_id: id } }), repositorios.conta_financeira.listar({ onde: { titular_entidade_id: id } })]);
  return [...produtos.map((produto) => `Produto ${produto.nome}`), ...contas.map((conta) => `Conta ${conta.nome}`)];
}

/** Arquivada não é sugerida em novos contratos: deixa de ser a padrão, e não volta a ser ao restaurar. */
export async function arquivarEntidade(id: string): Promise<void> {
  const vinculos = await vinculosDaEntidade(id);
  if (vinculos.length) throw new ErroDeRegra(`Esta entidade está em uso: ${vinculos.join(', ')}. Troque a entidade desses registros antes.`);
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
  socias: EntidadeSocias[];
  licenciantes: EntidadeLicenciante[];
};

export async function carregarEntidades(): Promise<DadosEntidades> {
  const [entidades, representantes, pessoas, contrapartes, socias, licenciantes] = await Promise.all([repositorios.entidade.listar({ incluirArquivados: true }), repositorios.entidade_representante.listar(), repositorios.pessoa.listar({ incluirArquivados: true }), repositorios.contraparte.listar(), repositorios.entidade_socias.listar(), repositorios.entidade_licenciante.listar()]);
  return { entidades: ordenarEntidades(entidades), representantes, pessoas, socias, licenciantes, contrapartes: [...contrapartes].sort((a, b) => nomeDaContraparte(a).localeCompare(nomeDaContraparte(b), 'pt-BR')) };
}

export function representantesDaEntidade(id: string, representantes: readonly EntidadeRepresentante[]): string[] {
  return representantes.filter((ligacao) => ligacao.entidade_id === id).map((ligacao) => ligacao.pessoa_id);
}
