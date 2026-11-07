/**
 * Regras de T08.04 (10-M08): identidade por marca, sobre o cadastro único de marcas e produtos (T02.04).
 * Logos e aplicações são itens da biblioteca; redes são ativos do M04. Nada é duplicado aqui.
 */
import { z } from 'zod';
import { ErroDeRegra } from '@/dados/erros';
import { repositorios } from '@/dados/repositorios';
import type { AtivoDigital } from '@/dados/tipos/ativo';
import type { Marca, Produto } from '@/dados/tipos/marca';
import type { Arquivo, ArquivoContexto, CorDaPaleta, FonteDaMarca, MarcaIdentidade, TipoDeArquivo } from '@/dados/tipos/marketing';
import { podeVerClasse } from './classes';
import { contrasteEntre } from './cores';
import { linkDoDriveValido, MENSAGEM_LINK_DRIVE } from './link-drive';

export type NivelDeContraste = 'suficiente' | 'so_texto_grande' | 'insuficiente';

/** WCAG AA: 4,5:1 para texto comum e 3:1 para texto grande (18 §3.4). */
export function avaliarContraste(textoHex: string, fundoHex: string): { razao: number; nivel: NivelDeContraste; rotulo: string } {
  const razao = contrasteEntre(textoHex, fundoHex);
  if (razao >= 4.5) return { razao, nivel: 'suficiente', rotulo: 'Contraste suficiente para texto' };
  if (razao >= 3) return { razao, nivel: 'so_texto_grande', rotulo: 'Só para texto grande ou ícones' };
  return { razao, nivel: 'insuficiente', rotulo: 'Contraste insuficiente' };
}

const curto = z.string().trim();

export const esquemaFormularioIdentidade = z
  .object({
    proposta: curto,
    publico: curto,
    personalidade: curto,
    tom_faca: curto,
    tom_nao_faca: curto,
    frases: curto,
    paleta: z.array(z.object({ nome: curto.min(1, 'Dê um nome à cor.'), hex: curto.regex(/^#[0-9A-Fa-f]{6}$/, 'Use o formato #RRGGBB.'), uso: curto })),
    tipografia: z.array(z.object({ fonte: curto.min(1, 'Informe a fonte.'), pesos: curto, uso: curto })),
    manual_url: curto,
  })
  .superRefine((dados, contexto) => {
    if (dados.manual_url && !linkDoDriveValido(dados.manual_url)) contexto.addIssue({ code: 'custom', path: ['manual_url'], message: MENSAGEM_LINK_DRIVE });
  });
export type FormularioIdentidade = z.infer<typeof esquemaFormularioIdentidade>;

const linhas = (texto: string) =>
  texto
    .split(/\r?\n/)
    .map((linha) => linha.trim())
    .filter(Boolean);
const nulo = (texto: string) => texto.trim() || null;

export function formularioDaIdentidade(identidade: MarcaIdentidade | null): FormularioIdentidade {
  return {
    proposta: identidade?.proposta ?? '',
    publico: identidade?.publico ?? '',
    personalidade: identidade?.personalidade ?? '',
    tom_faca: identidade?.tom_faca.join('\n') ?? '',
    tom_nao_faca: identidade?.tom_nao_faca.join('\n') ?? '',
    frases: identidade?.frases.join('\n') ?? '',
    paleta: identidade?.paleta.map((cor) => ({ nome: cor.nome, hex: cor.hex, uso: cor.uso ?? '' })) ?? [],
    tipografia: identidade?.tipografia.map((fonte) => ({ fonte: fonte.fonte, pesos: fonte.pesos ?? '', uso: fonte.uso ?? '' })) ?? [],
    manual_url: identidade?.manual_url ?? '',
  };
}

/** Uma identidade por marca: grava na que existe, ou cria a primeira. */
export async function salvarIdentidade(marcaId: string, formulario: FormularioIdentidade): Promise<MarcaIdentidade> {
  const conferido = esquemaFormularioIdentidade.safeParse(formulario);
  if (!conferido.success) throw new ErroDeRegra(conferido.error.issues[0]?.message ?? 'Confira os dados da identidade.');
  const dados = conferido.data;
  const valores = {
    marca_id: marcaId,
    proposta: nulo(dados.proposta),
    publico: nulo(dados.publico),
    personalidade: nulo(dados.personalidade),
    tom_faca: linhas(dados.tom_faca),
    tom_nao_faca: linhas(dados.tom_nao_faca),
    frases: linhas(dados.frases),
    paleta: dados.paleta.map((cor): CorDaPaleta => ({ nome: cor.nome, hex: cor.hex.toUpperCase(), uso: nulo(cor.uso) })),
    tipografia: dados.tipografia.map((fonte): FonteDaMarca => ({ fonte: fonte.fonte, pesos: nulo(fonte.pesos), uso: nulo(fonte.uso) })),
    manual_url: nulo(dados.manual_url),
  };
  const [atual] = await repositorios.marca_identidade.listar({ onde: { marca_id: marcaId } });
  return atual ? repositorios.marca_identidade.atualizar(atual.id, valores) : repositorios.marca_identidade.criar(valores);
}

export type DadosDasMarcas = {
  marcas: Marca[];
  produtos: Produto[];
  identidades: MarcaIdentidade[];
  arquivos: Arquivo[];
  contextos: ArquivoContexto[];
  ativos: AtivoDigital[];
};

export async function carregarIdentidades(): Promise<DadosDasMarcas> {
  const [marcas, produtos, identidades, arquivos, contextos, ativos] = await Promise.all([repositorios.marca.listar(), repositorios.produto.listar(), repositorios.marca_identidade.listar(), repositorios.arquivo.listar(), repositorios.arquivo_contexto.listar(), repositorios.ativo_digital.listar()]);
  return { marcas, produtos, identidades, arquivos: arquivos.filter((arquivo) => podeVerClasse(arquivo.classe)), contextos, ativos };
}

/** Os produtos da marca; a marca institucional é o contexto "Numa" (`produto_id` vazio). */
const pertenceAMarca = (marca: Pick<Marca, 'id' | 'institucional'>, produtoId: string | null, produtos: readonly Pick<Produto, 'id' | 'marca_id'>[]) => (produtoId === null ? marca.institucional : produtos.some((produto) => produto.id === produtoId && produto.marca_id === marca.id));

export function arquivosDaMarca(marca: Pick<Marca, 'id' | 'institucional'>, tipos: readonly TipoDeArquivo[], { arquivos, contextos, produtos }: Pick<DadosDasMarcas, 'arquivos' | 'contextos' | 'produtos'>): Arquivo[] {
  const ids = new Set(contextos.filter((contexto) => pertenceAMarca(marca, contexto.produto_id, produtos)).map((contexto) => contexto.arquivo_id));
  return arquivos.filter((arquivo) => tipos.includes(arquivo.tipo) && ids.has(arquivo.id)).sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR'));
}

export const TIPOS_DE_LOGO: readonly TipoDeArquivo[] = ['logo', 'icone'];
export const TIPOS_DE_APLICACAO: readonly TipoDeArquivo[] = ['imagem', 'video', 'print'];

/** T08.04: ativos digitais do tipo rede social (M04). O cadastro continua lá. */
export function redesDaMarca(marca: Pick<Marca, 'id' | 'institucional'>, { ativos, produtos }: Pick<DadosDasMarcas, 'ativos' | 'produtos'>): AtivoDigital[] {
  return ativos.filter((ativo) => ativo.tipo === 'rede_social' && pertenceAMarca(marca, ativo.produto_id, produtos)).sort((a, b) => a.identificador.localeCompare(b.identificador, 'pt-BR'));
}
