/** Regras de T02.04 (04-M02): cadastro básico do produto. A ficha completa fica em M07 (F0b). */
import { z } from 'zod';
import { ErroDeRegra } from '@/dados/erros';
import { repositorios } from '@/dados/repositorios';
import type { Produto } from '@/dados/tipos/marca';
import type { Pessoa } from '@/dados/tipos/pessoa';
import { quantasAtividadesAbertasNoProduto } from './atividades';
import { normalizarTexto } from './duplicidade';
import { pessoasDoSeletor } from './pessoa-atual';
import { pareceCredencial } from './segredos';

export const ROTULOS_TIPO_PRODUTO = { app_mobile: 'App mobile', web: 'Web', site: 'Site', servico: 'Serviço', outro: 'Outro' } as const;
export const ROTULOS_ESTAGIO = { ideia: 'Ideia', validacao: 'Validação', mvp: 'MVP', em_uso: 'Em uso', crescimento: 'Crescimento', pausado: 'Pausado', descontinuado: 'Descontinuado' } as const;
export const ROTULOS_SITUACAO_PRODUTO = { ativo: 'Ativo', pausado: 'Pausado', descontinuado: 'Descontinuado' } as const;

export const esquemaFormularioProduto = z.object({
  marca_id: z.string().min(1, 'Escolha a marca.'),
  nome: z.string().trim().min(1, 'Informe o nome do produto.'),
  codigo_curto: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3,6}$/, 'Use de 3 a 6 letras, como KIPI.')
    .transform((codigo) => codigo.toUpperCase()),
  tipo: z.enum(['app_mobile', 'web', 'site', 'servico', 'outro']),
  descricao_curta: z.string().trim().max(200, 'Use até 200 caracteres.'),
  estagio: z.enum(['ideia', 'validacao', 'mvp', 'em_uso', 'crescimento', 'pausado', 'descontinuado']),
  ordem_fila: z.string().trim().regex(/^\d{0,4}$/, 'Use só números, como 1.'),
  responsavel_id: z.string().min(1, 'Escolha a pessoa responsável pelo produto.'),
  entidade_id: z.string(),
  tem_usuarios_reais: z.boolean(),
  data_inicio: z.string(),
  situacao: z.enum(['ativo', 'pausado', 'descontinuado']),
  motivo: z.string().trim(),
});

export type FormularioProduto = z.input<typeof esquemaFormularioProduto>;
export type FormularioProdutoValidado = z.output<typeof esquemaFormularioProduto>;

export function formularioProdutoVazio(marcaId: string): FormularioProduto {
  return { marca_id: marcaId, nome: '', codigo_curto: '', tipo: 'app_mobile', descricao_curta: '', estagio: 'ideia', ordem_fila: '', responsavel_id: '', entidade_id: '', tem_usuarios_reais: false, data_inicio: '', situacao: 'ativo', motivo: '' };
}

export function formularioDoProduto(produto: Produto, pessoas: readonly Pessoa[]): FormularioProduto {
  return {
    marca_id: produto.marca_id,
    nome: produto.nome,
    codigo_curto: produto.codigo_curto,
    tipo: produto.tipo,
    descricao_curta: produto.descricao_curta ?? '',
    estagio: produto.estagio,
    ordem_fila: produto.ordem_fila === null ? '' : String(produto.ordem_fila),
    responsavel_id: responsavelDisponivel(produto, pessoas) ? (produto.responsavel_id ?? '') : '',
    entidade_id: produto.entidade_id ?? '',
    tem_usuarios_reais: produto.tem_usuarios_reais,
    data_inicio: produto.data_inicio ?? '',
    situacao: produto.situacao,
    motivo: '',
  };
}

/** Pessoa interna (T02.04). */
export const pessoasParaProduto = pessoasDoSeletor;

export function responsavelDisponivel(produto: Pick<Produto, 'responsavel_id'>, pessoas: readonly Pessoa[]): boolean {
  return pessoasParaProduto(pessoas).some((pessoa) => pessoa.id === produto.responsavel_id);
}

/** A fila só existe para o que ainda não saiu do papel (T02.04). */
export function usaFila(estagio: Produto['estagio']): boolean {
  return estagio === 'ideia' || estagio === 'validacao';
}

/** Descontinuar exige motivo (T02.04). A decisão registrada entra com M06, na F0b. */
export function exigeMotivo(situacaoNova: Produto['situacao'], situacaoAtual?: Produto['situacao']): boolean {
  return situacaoNova === 'descontinuado' && situacaoAtual !== 'descontinuado';
}

export function dadosDoProduto(formulario: FormularioProdutoValidado) {
  return {
    marca_id: formulario.marca_id,
    nome: formulario.nome,
    codigo_curto: formulario.codigo_curto,
    tipo: formulario.tipo,
    descricao_curta: formulario.descricao_curta || null,
    estagio: formulario.estagio,
    ordem_fila: usaFila(formulario.estagio) && formulario.ordem_fila ? Number(formulario.ordem_fila) : null,
    responsavel_id: formulario.responsavel_id,
    entidade_id: formulario.entidade_id || null,
    tem_usuarios_reais: formulario.tem_usuarios_reais,
    data_inicio: formulario.data_inicio || null,
    situacao: formulario.situacao,
  };
}

export type ConferenciaProduto = { erroNome: string | null; erroCodigo: string | null; avisos: readonly string[] };

/** Nome único na marca e código único em todo o sistema (16 §4.2). Texto livre passa pela RT-14. */
export function conferirDadosDoProduto(formulario: FormularioProdutoValidado, produtos: readonly Produto[], idAtual?: string): ConferenciaProduto {
  const outros = produtos.filter((produto) => produto.id !== idAtual);
  const nomeRepetido = outros.some((produto) => !produto.arquivado_em && produto.marca_id === formulario.marca_id && normalizarTexto(produto.nome) === normalizarTexto(formulario.nome));
  const codigoDe = outros.find((produto) => produto.codigo_curto === formulario.codigo_curto);
  const textosLivres = [formulario.descricao_curta, formulario.motivo];
  return {
    erroNome: nomeRepetido ? 'Esta marca já tem um produto com esse nome.' : null,
    erroCodigo: codigoDe ? `Este código já é de ${codigoDe.nome}.` : null,
    avisos: textosLivres.some(pareceCredencial) ? ['O texto parece conter uma senha ou um token, e a Central não guarda segredos.'] : [],
  };
}

export async function conferirProduto(formulario: FormularioProdutoValidado, idAtual?: string): Promise<ConferenciaProduto> {
  return conferirDadosDoProduto(formulario, await repositorios.produto.listar({ incluirArquivados: true }), idAtual);
}

export async function salvarProduto(formulario: FormularioProdutoValidado, id?: string): Promise<Produto> {
  const { erroNome, erroCodigo } = await conferirProduto(formulario, id);
  if (erroNome) throw new ErroDeRegra(erroNome);
  if (erroCodigo) throw new ErroDeRegra(erroCodigo);
  const dados = dadosDoProduto(formulario);
  if (!id) return repositorios.produto.criar(dados);
  const atual = await repositorios.produto.obter(id);
  if (exigeMotivo(formulario.situacao, atual?.situacao) && !formulario.motivo) throw new ErroDeRegra('Informe o motivo para descontinuar.');
  return repositorios.produto.atualizar(id, dados, { motivo: formulario.motivo || undefined });
}

/** Cada módulo novo que apontar para o produto bloqueia aqui, como a marca faz com os produtos. */
export async function arquivarProduto(id: string): Promise<void> {
  const abertas = await quantasAtividadesAbertasNoProduto(id);
  if (abertas) throw new ErroDeRegra(`Este produto tem ${abertas === 1 ? '1 atividade aberta' : `${abertas} atividades abertas`}. Conclua ou troque o contexto antes.`);
  await repositorios.produto.arquivar(id);
}

export async function restaurarProduto(id: string): Promise<void> {
  const produto = await repositorios.produto.obter(id);
  if (!produto) return;
  const ativos = await repositorios.produto.listar({ onde: { marca_id: produto.marca_id } });
  if (ativos.some((outro) => normalizarTexto(outro.nome) === normalizarTexto(produto.nome))) throw new ErroDeRegra('Esta marca já tem um produto com esse nome.');
  await repositorios.produto.restaurar(id);
}
