/**
 * Regras de T13.03 (15-M13): a busca global. Procura nas telas que já existem; cada módulo novo
 * acrescenta o seu grupo (ferramentas, ativos, lançamentos…), na ordem da especificação.
 */
import { repositorios } from '@/dados/repositorios';
import type { Atividade } from '@/dados/tipos/atividade';
import { CAMINHO_DA_ATIVIDADE, carregarMeuDia, contextosDaAtividade, estaAberta, ROTULOS_SITUACAO_ATIVIDADE, ROTULOS_TIPO_ATIVIDADE } from './atividades';
import { nomeDaContraparte } from './contrapartes';
import { formatarDiaISO } from '@/lib/formatacao';
import { ROTULOS_TIPO_ATIVO } from './ativos';
import { ROTULOS_SITUACAO_TITULO } from './titulos';
import { normalizarTexto } from './duplicidade';
import { ROTULOS_SITUACAO_FERRAMENTA } from './ferramentas';
import { ROTULOS_TIPO } from './pessoas';
import { candidatosDoM08 } from './integracoes/busca-m08';

export const MINIMO_PARA_BUSCAR = 2;
const POR_GRUPO = 5;

export type ResultadoDaBusca = { id: string; codigo: string | null; titulo: string; detalhe: string; href: string };
export type GrupoDaBusca = { tipo: string; rotulo: string; itens: ResultadoDaBusca[]; total: number };

type Candidato = ResultadoDaBusca & { /** Onde procurar. */ texto: string; /** Abertas antes das encerradas. */ peso: number };

/** Código exato primeiro: é ele que vai direto ao registro. Depois, o título que começa com a busca. */
function relevancia(candidato: Candidato, termo: string): number {
  if (candidato.codigo && normalizarTexto(candidato.codigo) === termo) return 0;
  const titulo = normalizarTexto(candidato.titulo);
  if (titulo === termo) return 1;
  if (titulo.startsWith(termo)) return 2;
  return titulo.includes(termo) ? 3 : 4;
}

function montarGrupo(tipo: string, rotulo: string, candidatos: readonly Candidato[], termo: string): GrupoDaBusca | null {
  const palavras = termo.split(/\s+/).filter(Boolean);
  const achados = candidatos
    .filter((candidato) => {
      const alvo = normalizarTexto(candidato.texto);
      return palavras.every((palavra) => alvo.includes(palavra));
    })
    .sort((a, b) => relevancia(a, termo) - relevancia(b, termo) || a.peso - b.peso || a.titulo.localeCompare(b.titulo, 'pt-BR'));
  if (!achados.length) return null;
  return { tipo, rotulo, total: achados.length, itens: achados.slice(0, POR_GRUPO).map(({ id, codigo, titulo, detalhe, href }) => ({ id, codigo, titulo, detalhe, href })) };
}

function detalheDaAtividade(atividade: Atividade, contextos: readonly string[]): string {
  return [ROTULOS_TIPO_ATIVIDADE[atividade.tipo], ROTULOS_SITUACAO_ATIVIDADE[atividade.situacao], ...contextos].join(' · ');
}

/** Os grupos na ordem da especificação; o que tem o código exato vem antes. Respeitar permissões entra com o login. */
export async function buscarNaCentral(busca: string): Promise<GrupoDaBusca[]> {
  const termo = normalizarTexto(busca).trim();
  if (termo.length < MINIMO_PARA_BUSCAR) return [];
  const [meuDia, contrapartes, pessoas, produtos, marcas, ferramentas, ativos, titulos] = await Promise.all([carregarMeuDia(), repositorios.contraparte.listar(), repositorios.pessoa.listar(), repositorios.produto.listar(), repositorios.marca.listar(), repositorios.ferramenta.listar(), repositorios.ativo_digital.listar(), repositorios.titulo.listar()]);
  const doM08 = await candidatosDoM08();

  const grupos = [
    montarGrupo(
      'atividades',
      'Atividades',
      meuDia.atividades.map((atividade) => ({
        id: atividade.id,
        codigo: atividade.codigo,
        titulo: atividade.titulo,
        detalhe: detalheDaAtividade(
          atividade,
          contextosDaAtividade(atividade, meuDia).map((contexto) => contexto.nome),
        ),
        href: CAMINHO_DA_ATIVIDADE(atividade.id),
        texto: `${atividade.codigo} ${atividade.titulo} ${atividade.descricao ?? ''}`,
        peso: estaAberta(atividade) ? 0 : 1,
      })),
      termo,
    ),
    montarGrupo(
      'contrapartes',
      'Contrapartes',
      contrapartes.map((contraparte) => ({
        id: contraparte.id,
        codigo: null,
        titulo: nomeDaContraparte(contraparte),
        detalhe: contraparte.nome_fantasia ? contraparte.nome : (contraparte.email ?? 'Contraparte'),
        href: `/comercial/contrapartes/${contraparte.id}/cadastro`,
        texto: `${contraparte.nome} ${contraparte.nome_fantasia ?? ''} ${contraparte.documento ?? ''} ${contraparte.documento_normalizado ?? ''} ${contraparte.email ?? ''}`,
        peso: 0,
      })),
      termo,
    ),
    montarGrupo(
      'pessoas',
      'Pessoas',
      pessoas.map((pessoa) => ({
        id: pessoa.id,
        codigo: null,
        titulo: pessoa.nome_completo,
        detalhe: pessoa.funcao ?? ROTULOS_TIPO[pessoa.tipo],
        href: `/configuracoes/cadastros/pessoas/${pessoa.id}`,
        texto: `${pessoa.nome_completo} ${pessoa.nome_exibicao ?? ''} ${pessoa.email ?? ''}`,
        peso: pessoa.situacao === 'ativa' ? 0 : 1,
      })),
      termo,
    ),
    montarGrupo(
      'ferramentas',
      'Ferramentas',
      ferramentas.map((ferramenta) => ({
        id: ferramenta.id,
        codigo: ferramenta.codigo,
        titulo: ferramenta.nome,
        detalhe: ROTULOS_SITUACAO_FERRAMENTA[ferramenta.situacao],
        href: `/ferramentas/${ferramenta.id}`,
        texto: `${ferramenta.codigo} ${ferramenta.nome} ${ferramenta.finalidade}`,
        peso: ferramenta.situacao === 'cancelada' ? 1 : 0,
      })),
      termo,
    ),
    montarGrupo(
      'titulos',
      'Lançamentos',
      titulos.map((titulo) => ({
        id: titulo.id,
        codigo: titulo.codigo,
        titulo: titulo.descricao,
        detalhe: `${ROTULOS_SITUACAO_TITULO[titulo.situacao]} · ${formatarDiaISO(titulo.vencimento)}`,
        href: `/financeiro/${titulo.id}`,
        texto: `${titulo.codigo} ${titulo.descricao}`,
        peso: titulo.situacao === 'cancelado' ? 1 : 0,
      })),
      termo,
    ),
    montarGrupo(
      'ativos',
      'Ativos digitais',
      ativos.map((ativo) => ({
        id: ativo.id,
        codigo: ativo.codigo,
        titulo: ativo.identificador,
        detalhe: ROTULOS_TIPO_ATIVO[ativo.tipo],
        href: `/ferramentas/ativos/${ativo.id}`,
        texto: `${ativo.codigo} ${ativo.identificador}`,
        peso: 0,
      })),
      termo,
    ),
    montarGrupo(
      'produtos',
      'Produtos',
      produtos.map((produto) => ({
        id: produto.id,
        codigo: produto.codigo_curto,
        titulo: produto.nome,
        detalhe: `Marca ${marcas.find((marca) => marca.id === produto.marca_id)?.nome ?? 'removida'}`,
        href: `/produtos/${produto.id}`,
        texto: `${produto.nome} ${produto.codigo_curto}`,
        peso: produto.situacao === 'ativo' ? 0 : 1,
      })),
      termo,
    ),
    ...doM08.map(({ tipo, rotulo, candidatos }) => montarGrupo(tipo, rotulo, candidatos, termo)),
  ].filter((grupo): grupo is GrupoDaBusca => grupo !== null);

  const temCodigoExato = (grupo: GrupoDaBusca) => grupo.itens.some((item) => item.codigo && normalizarTexto(item.codigo) === termo);
  return [...grupos.filter(temCodigoExato), ...grupos.filter((grupo) => !temCodigoExato(grupo))];
}
