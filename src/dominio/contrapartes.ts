/** Regras de T02.06 (04-M02): contrapartes, sobretudo fornecedores na F0a. */
import { vinculosDeFerramentaDaContraparte } from './ferramentas';
import { z } from 'zod';
import { ErroDeDados, ErroDeRegra } from '@/dados/erros';
import { repositorios } from '@/dados/repositorios';
import type { Contraparte } from '@/dados/tipos/contraparte';
import type { Pessoa } from '@/dados/tipos/pessoa';
import { quantasAtividadesAbertasVinculadas } from './atividades';
import { camposDoEndereco, CAMPOS_ENDERECO_VAZIOS, cepValido, enderecoDosCampos, esquemaCamposEndereco } from './endereco';
import { cnpjValido, cpfValido, formatarCnpj, nomesParecidos, normalizarCnpj, normalizarTexto, soDigitos, telefoneValido } from './duplicidade';
import { PAIS_BRASIL } from './paises';
import { pessoasDoSeletor } from './pessoa-atual';
import { formatarCpf, formatarTelefone } from './pessoas';
import { pareceCredencial } from './segredos';

export const ROTULOS_TIPO_PESSOA = { pf: 'Pessoa física', pj: 'Pessoa jurídica', estrangeira: 'Estrangeira' } as const;
export const ROTULOS_PAPEL_CONTRAPARTE = { prospect: 'Prospect', cliente: 'Cliente', fornecedor: 'Fornecedor', parceiro: 'Parceiro', institucional: 'Institucional' } as const;
export const ROTULOS_ORIGEM = { indicacao: 'Indicação', rede_social: 'Rede social', site: 'Site', evento: 'Evento', busca_ativa: 'Busca ativa', lista_espera: 'Lista de espera', outro: 'Outro' } as const;
/** "Lista de espera" vem da M08: o formulário de T02.06 só oferece estas. */
export const ORIGENS_DO_FORMULARIO = ['indicacao', 'rede_social', 'site', 'evento', 'busca_ativa', 'outro'] as const;

const SITE_VALIDO = /^https?:\/\/[^\s.]+\.[^\s]+$/i;

export function documentoValido(tipo: Contraparte['tipo_pessoa'], documento: string): boolean {
  if (tipo === 'pf') return cpfValido(documento);
  if (tipo === 'pj') return cnpjValido(documento);
  return documento.trim().length > 0;
}

/** Só dígitos no CPF; letras maiúsculas e dígitos no CNPJ e no ID estrangeiro. */
export function normalizarDocumento(tipo: Contraparte['tipo_pessoa'], documento: string): string {
  if (tipo === 'pf') return soDigitos(documento);
  if (tipo === 'pj') return normalizarCnpj(documento);
  return documento.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function formatarDocumento(tipo: Contraparte['tipo_pessoa'], documento: string): string {
  if (tipo === 'pf') return formatarCpf(documento);
  if (tipo === 'pj') return formatarCnpj(documento);
  return documento;
}

export const esquemaFormularioContraparte = z
  .object({
    tipo_pessoa: z.enum(['pf', 'pj', 'estrangeira']),
    nome: z.string().trim().min(1, 'Informe o nome ou a razão social.'),
    nome_fantasia: z.string().trim(),
    documento: z.string().trim(),
    papeis: z.array(z.enum(['prospect', 'cliente', 'fornecedor', 'parceiro', 'institucional'])).min(1, 'Escolha pelo menos um papel.'),
    site: z
      .string()
      .trim()
      .refine((valor) => !valor || SITE_VALIDO.test(valor), 'Use o endereço completo, como https://exemplo.com.br.'),
    email: z
      .string()
      .trim()
      .refine((valor) => !valor || z.email().safeParse(valor).success, 'Informe um e-mail válido.'),
    telefone: z.string().trim(),
    endereco: esquemaCamposEndereco,
    pais: z.string().length(2, 'Escolha o país.'),
    origem: z.string(),
    responsavel_id: z.string().min(1, 'Escolha a pessoa responsável.'),
    observacoes: z.string().trim(),
    situacao: z.enum(['ativa', 'inativa']),
  })
  .superRefine((dados, contexto) => {
    if (dados.documento && !documentoValido(dados.tipo_pessoa, dados.documento)) {
      contexto.addIssue({ code: 'custom', path: ['documento'], message: dados.tipo_pessoa === 'pf' ? 'Este CPF não é válido. Confira os números.' : 'Este CNPJ não é válido. Confira os números.' });
    }
    if (dados.pais === PAIS_BRASIL && dados.telefone && !telefoneValido(dados.telefone)) {
      contexto.addIssue({ code: 'custom', path: ['telefone'], message: 'Use o formato (00) 00000-0000.' });
    }
    if (dados.pais === PAIS_BRASIL && dados.endereco.cep && !cepValido(dados.endereco.cep)) {
      contexto.addIssue({ code: 'custom', path: ['endereco', 'cep'], message: 'Use o formato 00000-000.' });
    }
  });

export type FormularioContraparte = z.infer<typeof esquemaFormularioContraparte>;

export function formularioContraparteVazio(responsavelId: string): FormularioContraparte {
  return {
    tipo_pessoa: 'pj',
    nome: '',
    nome_fantasia: '',
    documento: '',
    papeis: ['fornecedor'],
    site: '',
    email: '',
    telefone: '',
    endereco: { ...CAMPOS_ENDERECO_VAZIOS },
    pais: PAIS_BRASIL,
    origem: '',
    responsavel_id: responsavelId,
    observacoes: '',
    situacao: 'ativa',
  };
}

/** Pessoa interna (T02.06), ativa. */
export const pessoasParaContraparte = pessoasDoSeletor;

export function responsavelDaContraparteDisponivel(contraparte: Pick<Contraparte, 'responsavel_id'>, pessoas: readonly Pessoa[]): boolean {
  return pessoasParaContraparte(pessoas).some((pessoa) => pessoa.id === contraparte.responsavel_id);
}

export function formularioDaContraparte(contraparte: Contraparte, pessoas: readonly Pessoa[]): FormularioContraparte {
  return {
    tipo_pessoa: contraparte.tipo_pessoa,
    nome: contraparte.nome,
    nome_fantasia: contraparte.nome_fantasia ?? '',
    documento: contraparte.documento ? formatarDocumento(contraparte.tipo_pessoa, contraparte.documento) : '',
    papeis: contraparte.papeis,
    site: contraparte.site ?? '',
    email: contraparte.email ?? '',
    telefone: contraparte.telefone ? (contraparte.pais === PAIS_BRASIL ? formatarTelefone(contraparte.telefone) : contraparte.telefone) : '',
    endereco: camposDoEndereco(contraparte.endereco),
    pais: contraparte.pais,
    origem: contraparte.origem ?? '',
    responsavel_id: responsavelDaContraparteDisponivel(contraparte, pessoas) ? contraparte.responsavel_id : '',
    observacoes: contraparte.observacoes ?? '',
    situacao: contraparte.situacao,
  };
}

/** Vazio é vazio (RT-08). A classe fica no padrão (03 §0). */
export function dadosDaContraparte(formulario: FormularioContraparte) {
  const brasil = formulario.pais === PAIS_BRASIL;
  return {
    tipo_pessoa: formulario.tipo_pessoa,
    nome: formulario.nome,
    nome_fantasia: formulario.nome_fantasia || null,
    documento: formulario.documento ? normalizarDocumento(formulario.tipo_pessoa, formulario.documento) : null,
    documento_normalizado: formulario.documento ? normalizarDocumento(formulario.tipo_pessoa, formulario.documento) : null,
    papeis: formulario.papeis,
    site: formulario.site || null,
    email: formulario.email || null,
    telefone: formulario.telefone ? (brasil ? soDigitos(formulario.telefone) : formulario.telefone) : null,
    endereco: enderecoDosCampos(formulario.endereco),
    pais: formulario.pais,
    origem: (formulario.origem || null) as Contraparte['origem'],
    responsavel_id: formulario.responsavel_id,
    classe: 'int' as const,
    observacoes: formulario.observacoes || null,
    situacao: formulario.situacao,
  };
}

/** O nome fantasia aparece nas listas quando existir (T02.06). */
export function nomeDaContraparte(contraparte: Pick<Contraparte, 'nome' | 'nome_fantasia'>): string {
  return contraparte.nome_fantasia || contraparte.nome;
}

// ---------- Duplicidade (RN-02.01, RN-02.02 e CA-02.05) ----------

export type ConferenciaContraparte = {
  /** Documento igual bloqueia e oferece abrir a existente. */
  documentoRepetido: Contraparte | null;
  /** Só avisam e deixam continuar. */
  avisos: readonly string[];
};

export function conferirDadosDaContraparte(formulario: FormularioContraparte, contrapartes: readonly Contraparte[], idAtual?: string): ConferenciaContraparte {
  const dados = dadosDaContraparte(formulario);
  const outras = contrapartes.filter((contraparte) => contraparte.id !== idAtual);
  const avisos: string[] = [];
  for (const outra of outras) {
    const nome = nomeDaContraparte(outra);
    if (dados.email && outra.email && normalizarTexto(outra.email) === normalizarTexto(dados.email)) avisos.push(`E-mail igual ao de ${nome}.`);
    if (dados.telefone && outra.telefone === dados.telefone) avisos.push(`Telefone igual ao de ${nome}.`);
    if (nomesParecidos(dados.nome, outra.nome) || (dados.nome_fantasia && nomesParecidos(dados.nome_fantasia, nome))) avisos.push(`Nome parecido com ${nome}.`);
  }
  if (pareceCredencial(dados.observacoes ?? '')) avisos.push('As observações parecem conter uma senha ou um token, e a Central não guarda segredos.');
  const documentoRepetido = dados.documento_normalizado ? (outras.find((outra) => outra.documento_normalizado === dados.documento_normalizado) ?? null) : null;
  return { documentoRepetido, avisos };
}

export async function conferirContraparte(formulario: FormularioContraparte, idAtual?: string): Promise<ConferenciaContraparte> {
  return conferirDadosDaContraparte(formulario, await repositorios.contraparte.listar({ incluirArquivados: true }), idAtual);
}

export async function salvarContraparte(formulario: FormularioContraparte, id?: string): Promise<Contraparte> {
  const { documentoRepetido } = await conferirContraparte(formulario, id);
  if (documentoRepetido) throw new ErroDeRegra(`Já existe: ${nomeDaContraparte(documentoRepetido)}.`);
  const dados = dadosDaContraparte(formulario);
  return id ? repositorios.contraparte.atualizar(id, dados) : repositorios.contraparte.criar(dados);
}

// ---------- Vínculos e situação ----------

/** O que depende da contraparte. Cada módulo novo que apontar para ela acrescenta aqui (T04, T05…). */
export async function vinculosDaContraparte(id: string): Promise<string[]> {
  const titulos = (await repositorios.titulo.listar({ onde: { contraparte_id: id } })).length;
  const deFerramentas = [...(await vinculosDeFerramentaDaContraparte(id)), ...(titulos ? [titulos === 1 ? '1 lançamento' : `${titulos} lançamentos`] : [])];
  const [contatos, entidades, atividades] = await Promise.all([repositorios.pessoa.listar({ onde: { contraparte_id: id } }), repositorios.entidade.listar({ onde: { contador_id: id } }), quantasAtividadesAbertasVinculadas('contraparte', id)]);
  return [...contatos.map((pessoa) => `Contato: ${pessoa.nome_completo}`), ...entidades.map((entidade) => `Contador de ${entidade.nome}`), ...(atividades ? [atividades === 1 ? '1 atividade aberta' : `${atividades} atividades abertas`] : []), ...deFerramentas];
}

export async function inativarContraparte(id: string): Promise<void> {
  await repositorios.contraparte.atualizar(id, { situacao: 'inativa' });
}

export async function reativarContraparte(id: string): Promise<void> {
  await repositorios.contraparte.atualizar(id, { situacao: 'ativa' });
}

/** Decisão de 05/11/2026, a mesma das pessoas: com vínculos, só inativar. */
export async function arquivarContraparte(id: string): Promise<void> {
  const vinculos = await vinculosDaContraparte(id);
  if (vinculos.length) throw new ErroDeRegra(`Esta contraparte tem vínculos: ${vinculos.join(', ')}. Se não for mais usada, inative.`);
  if (!(await repositorios.contraparte.obter(id))) throw new ErroDeDados('nao_encontrado');
  await repositorios.contraparte.arquivar(id);
}

export async function restaurarContraparte(id: string): Promise<void> {
  await repositorios.contraparte.restaurar(id);
}

// ---------- Lista ----------

export type FiltrosContrapartes = {
  busca: string;
  papel: 'todos' | Contraparte['papeis'][number];
  situacao: 'todas' | Contraparte['situacao'];
  responsavel: string;
  uf: string;
  cidade: string;
  origem: string;
  arquivadas: boolean;
};

export const FILTROS_CONTRAPARTES_INICIAIS: FiltrosContrapartes = { busca: '', papel: 'todos', situacao: 'todas', responsavel: '', uf: '', cidade: '', origem: '', arquivadas: false };

/** Busca por nome, fantasia, documento ou e-mail. Quem tem dois papéis aparece nas duas visões (CA-02.06). */
export function filtrarContrapartes(contrapartes: readonly Contraparte[], { busca, papel, situacao, responsavel, uf, cidade, origem, arquivadas }: FiltrosContrapartes): Contraparte[] {
  const texto = normalizarTexto(busca);
  const documento = busca.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return contrapartes
    .filter((contraparte) => Boolean(contraparte.arquivado_em) === arquivadas)
    .filter((contraparte) => papel === 'todos' || contraparte.papeis.includes(papel))
    .filter((contraparte) => situacao === 'todas' || contraparte.situacao === situacao)
    .filter((contraparte) => !responsavel || contraparte.responsavel_id === responsavel)
    .filter((contraparte) => !uf || contraparte.endereco?.uf === uf)
    .filter((contraparte) => !cidade || normalizarTexto(contraparte.endereco?.cidade ?? '') === normalizarTexto(cidade))
    .filter((contraparte) => !origem || contraparte.origem === origem)
    .filter((contraparte) => !texto || normalizarTexto(`${contraparte.nome} ${contraparte.nome_fantasia ?? ''} ${contraparte.email ?? ''}`).includes(texto) || (documento.length > 0 && (contraparte.documento_normalizado ?? '').includes(documento)))
    .sort((a, b) => nomeDaContraparte(a).localeCompare(nomeDaContraparte(b), 'pt-BR'));
}

/** As cidades que aparecem nos cadastros, sem repetir por acento ou maiúscula: as opções do filtro. */
export function cidadesDasContrapartes(contrapartes: readonly Contraparte[]): string[] {
  const porChave = new Map<string, string>();
  for (const contraparte of contrapartes) {
    const cidade = contraparte.endereco?.cidade?.trim();
    if (cidade && !porChave.has(normalizarTexto(cidade))) porChave.set(normalizarTexto(cidade), cidade);
  }
  return [...porChave.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

export type DadosContrapartes = {
  contrapartes: Contraparte[];
  pessoas: Pessoa[];
};

export async function carregarContrapartes(): Promise<DadosContrapartes> {
  const [contrapartes, pessoas] = await Promise.all([repositorios.contraparte.listar({ incluirArquivados: true }), repositorios.pessoa.listar({ incluirArquivados: true })]);
  return { contrapartes, pessoas };
}
