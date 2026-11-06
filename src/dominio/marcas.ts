/** Regras de T02.04 (04-M02): marcas. */
import { z } from 'zod';
import { ErroDeRegra } from '@/dados/erros';
import { repositorios } from '@/dados/repositorios';
import type { Entidade } from '@/dados/tipos/contraparte';
import type { Marca, Produto } from '@/dados/tipos/marca';
import type { Pessoa } from '@/dados/tipos/pessoa';
import { corVisivel } from './cores';
import { normalizarTexto } from './duplicidade';
import { linkDoDriveValido, MENSAGEM_LINK_DRIVE } from './link-drive';

export const ROTULOS_SITUACAO_MARCA = { ativa: 'Ativa', pausada: 'Pausada', encerrada: 'Encerrada' } as const;

export const esquemaFormularioMarca = z.object({
  nome: z.string().trim().min(1, 'Informe o nome da marca.'),
  provisorio: z.boolean(),
  cor_hex: z
    .string()
    .trim()
    .regex(/^#[0-9A-Fa-f]{6}$/, { error: 'Use uma cor no formato #RRGGBB.', abort: true })
    .refine(corVisivel, 'Esta cor é clara demais para aparecer nas etiquetas. Escolha uma mais forte.'),
  logo_url: z
    .string()
    .trim()
    .refine((valor) => !valor || linkDoDriveValido(valor), MENSAGEM_LINK_DRIVE),
  situacao: z.enum(['ativa', 'pausada', 'encerrada']),
});

export type FormularioMarca = z.infer<typeof esquemaFormularioMarca>;

export const FORMULARIO_MARCA_VAZIO: FormularioMarca = { nome: '', provisorio: false, cor_hex: '#6366F1', logo_url: '', situacao: 'ativa' };

export const MENSAGEM_MARCA_REPETIDA = 'Já existe uma marca com esse nome.';

export function formularioDaMarca(marca: Marca): FormularioMarca {
  return { nome: marca.nome, provisorio: marca.provisorio, cor_hex: marca.cor_hex, logo_url: marca.logo_url ?? '', situacao: marca.situacao };
}

/** Nome único, sem considerar acentos e maiúsculas, entre as marcas ativas. */
export function nomeDeMarcaRepetido(nome: string, marcas: readonly Marca[], idAtual?: string): boolean {
  const procurado = normalizarTexto(nome);
  return marcas.some((marca) => marca.id !== idAtual && !marca.arquivado_em && normalizarTexto(marca.nome) === procurado);
}

export async function salvarMarca(formulario: FormularioMarca, id?: string): Promise<Marca> {
  const marcas = await repositorios.marca.listar();
  if (nomeDeMarcaRepetido(formulario.nome, marcas, id)) throw new ErroDeRegra(MENSAGEM_MARCA_REPETIDA);
  const atual = id ? (marcas.find((marca) => marca.id === id) ?? null) : null;
  const dados = {
    nome: formulario.nome,
    provisorio: formulario.provisorio,
    cor_hex: formulario.cor_hex.toUpperCase(),
    logo_url: formulario.logo_url || null,
    // A marca institucional é a própria Numa: sempre ativa, nunca provisória.
    situacao: atual?.institucional ? ('ativa' as const) : formulario.situacao,
  };
  if (id) return repositorios.marca.atualizar(id, atual?.institucional ? { ...dados, provisorio: false } : dados);
  return repositorios.marca.criar({ ...dados, institucional: false });
}

/** Marca com produtos fica bloqueada (RN-02.04); a institucional, sempre. */
export async function arquivarMarca(id: string): Promise<void> {
  const [marca, produtos] = await Promise.all([repositorios.marca.obter(id), repositorios.produto.listar({ onde: { marca_id: id } })]);
  if (marca?.institucional) throw new ErroDeRegra('A marca institucional não pode ser arquivada.');
  if (produtos.length) throw new ErroDeRegra(`Esta marca tem ${produtos.length === 1 ? 'um produto' : 'produtos'}: ${produtos.map((produto) => produto.nome).join(', ')}. Arquive antes.`);
  await repositorios.marca.arquivar(id);
}

export async function restaurarMarca(id: string): Promise<void> {
  const [marca, ativas] = await Promise.all([repositorios.marca.obter(id), repositorios.marca.listar()]);
  if (marca && nomeDeMarcaRepetido(marca.nome, ativas, id)) throw new ErroDeRegra(MENSAGEM_MARCA_REPETIDA);
  await repositorios.marca.restaurar(id);
}

export type DadosMarcas = {
  marcas: Marca[];
  produtos: Produto[];
  pessoas: Pessoa[];
  entidades: Entidade[];
};

export async function carregarMarcas(): Promise<DadosMarcas> {
  const [marcas, produtos, pessoas, entidades] = await Promise.all([repositorios.marca.listar({ incluirArquivados: true }), repositorios.produto.listar({ incluirArquivados: true }), repositorios.pessoa.listar({ incluirArquivados: true }), repositorios.entidade.listar({ incluirArquivados: true })]);
  return { marcas, produtos, pessoas, entidades };
}
