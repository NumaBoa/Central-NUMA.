/**
 * T06.04 (RN-06.07): a lista é derivada de Ferramentas e ativos (M04), sem tabela própria. O requisito vem do próprio
 * ativo: não existe um bloqueio único para toda transferência (LEIA-ME do M06). Registrar a transferência é o fluxo do M04.
 * Sem importar `ativos.ts`, que chama os alertas daqui: a lista precisa ser pura.
 */
import { repositorios } from '@/dados/repositorios';
import type { Atividade } from '@/dados/tipos/atividade';
import type { AtivoDigital } from '@/dados/tipos/ativo';
import type { Ferramenta, FerramentaContexto } from '@/dados/tipos/ferramenta';
import type { Marca, Produto } from '@/dados/tipos/marca';
import type { Pessoa } from '@/dados/tipos/pessoa';
import { estaAberta } from './atividades';
import { ORIGEM_TRANSFERENCIA } from './integracoes/meu-dia-m06';
import { textoDoTitular, titularEhODesejado } from './titularidade';

export type SituacaoATransferir = 'pendente' | 'em_andamento' | 'impedida';

export const ROTULOS_SITUACAO_A_TRANSFERIR: Readonly<Record<SituacaoATransferir, string>> = { pendente: 'Pendente', em_andamento: 'Em andamento', impedida: 'Impedida' };

export type ItemATransferir = {
  id: string;
  origem: 'ativo' | 'ferramenta';
  codigo: string;
  nome: string;
  tipoAtivo: AtivoDigital['tipo'] | null;
  /** Vazio é a Numa. */
  produtos: string[];
  titularAtual: string;
  titularDesejado: string;
  requisito: string | null;
  critico: boolean;
  situacao: SituacaoATransferir;
  impedimento: string | null;
  responsavelId: string;
  criadoEm: string;
  exemplo: boolean;
};

type Fontes = {
  ativos: readonly AtivoDigital[];
  ferramentas: readonly Ferramenta[];
  contextos: readonly FerramentaContexto[];
  pessoas: readonly Pick<Pessoa, 'id' | 'nome_completo'>[];
};

/** Titular atual diferente do desejado, e a transferência ainda não feita. Ferramenta não guarda situação: é sempre "Pendente". */
export function itensATransferir({ ativos, ferramentas, contextos, pessoas }: Fontes): ItemATransferir[] {
  const dosAtivos = ativos.flatMap((ativo): ItemATransferir[] => {
    const situacao = ativo.transferencia_situacao;
    if (ativo.arquivado_em || (situacao !== 'pendente' && situacao !== 'em_andamento' && situacao !== 'impedida') || titularEhODesejado(ativo, ativo.titular_desejado, pessoas)) return [];
    return [
      {
        id: ativo.id,
        origem: 'ativo',
        codigo: ativo.codigo,
        nome: ativo.identificador,
        tipoAtivo: ativo.tipo,
        produtos: ativo.produto_id ? [ativo.produto_id] : [],
        titularAtual: textoDoTitular(ativo, pessoas),
        titularDesejado: ativo.titular_desejado,
        requisito: ativo.requisito_transferencia,
        critico: ativo.critico,
        situacao,
        impedimento: situacao === 'impedida' ? (ativo.impedimento_motivo ?? null) : null,
        responsavelId: ativo.responsavel_id,
        criadoEm: ativo.criado_em,
        exemplo: ativo.exemplo,
      },
    ];
  });
  const dasFerramentas = ferramentas.flatMap((ferramenta): ItemATransferir[] => {
    if (ferramenta.arquivado_em || ferramenta.situacao === 'cancelada' || titularEhODesejado(ferramenta, ferramenta.titular_desejado, pessoas)) return [];
    return [
      {
        id: ferramenta.id,
        origem: 'ferramenta',
        codigo: ferramenta.codigo,
        nome: ferramenta.nome,
        tipoAtivo: null,
        produtos: contextos.filter((contexto) => contexto.ferramenta_id === ferramenta.id && contexto.produto_id).map((contexto) => contexto.produto_id as string),
        titularAtual: textoDoTitular(ferramenta, pessoas),
        titularDesejado: ferramenta.titular_desejado,
        requisito: null,
        critico: ferramenta.critica,
        situacao: 'pendente',
        impedimento: null,
        responsavelId: ferramenta.responsavel_tecnico_id,
        criadoEm: ferramenta.criado_em,
        exemplo: ferramenta.exemplo,
      },
    ];
  });
  return [...dosAtivos, ...dasFerramentas].sort((a, b) => Number(b.critico) - Number(a.critico) || a.nome.localeCompare(b.nome, 'pt-BR'));
}

export const criticosPendentes = (itens: readonly Pick<ItemATransferir, 'critico'>[]) => itens.filter((item) => item.critico).length;

export function nomesDosProdutos(item: Pick<ItemATransferir, 'produtos'>, produtos: readonly Pick<Produto, 'id' | 'nome'>[], marcas: readonly Pick<Marca, 'institucional' | 'nome'>[]): string {
  if (!item.produtos.length) return marcas.find((marca) => marca.institucional)?.nome ?? 'Numa';
  return item.produtos.map((id) => produtos.find((produto) => produto.id === id)?.nome ?? 'Produto removido').join(', ');
}

export type FiltrosATransferir = { busca: string; produto: string; situacao: string; critico: string };
export const FILTROS_A_TRANSFERIR_INICIAIS: FiltrosATransferir = { busca: '', produto: '', situacao: '', critico: '' };

export function filtrarItensATransferir<T extends ItemATransferir>(itens: readonly T[], { busca, produto, situacao, critico }: FiltrosATransferir, textoExtra: (item: T) => string = () => ''): T[] {
  const termo = busca.trim().toLocaleLowerCase('pt-BR');
  return itens.filter(
    (item) =>
      (!termo || `${item.nome} ${item.codigo} ${item.titularAtual} ${textoExtra(item)}`.toLocaleLowerCase('pt-BR').includes(termo)) &&
      (!situacao || item.situacao === situacao) &&
      (!critico || (critico === 'sim' ? item.critico : !item.critico)) &&
      (!produto || (produto === 'numa' ? !item.produtos.length : item.produtos.includes(produto))),
  );
}

export type ItemComAtividade = ItemATransferir & { atividade: Pick<Atividade, 'id' | 'titulo' | 'situacao'> | null };

/** A atividade do item: o alerta dele (aberto primeiro) ou uma atividade aberta já ligada a ele. É a mesma linha do Meu dia. */
export function atividadeDoItem(id: string, atividades: readonly Atividade[], ligadas: ReadonlyMap<string, string>): Atividade | null {
  const alertas = atividades.filter((atividade) => atividade.origem_tipo === ORIGEM_TRANSFERENCIA && atividade.origem_id === id);
  const ligada = ligadas.get(id);
  return alertas.find(estaAberta) ?? atividades.find((atividade) => atividade.id === ligada) ?? alertas[0] ?? null;
}

export type DadosATransferir = { itens: ItemComAtividade[]; produtos: Produto[]; marcas: Marca[]; pessoas: Pessoa[] };

export async function carregarAtivosATransferir(): Promise<DadosATransferir> {
  const [ativos, ferramentas, contextos, pessoas, produtos, marcas, atividades, vinculos] = await Promise.all([repositorios.ativo_digital.listar(), repositorios.ferramenta.listar(), repositorios.ferramenta_contexto.listar(), repositorios.pessoa.listar({ incluirArquivados: true }), repositorios.produto.listar({ incluirArquivados: true }), repositorios.marca.listar({ incluirArquivados: true }), repositorios.atividade.listar(), repositorios.vinculo.listar()]);
  const abertas = new Set(atividades.filter(estaAberta).map((atividade) => atividade.id));
  const ligadas = new Map(
    vinculos.flatMap((vinculo): [string, string][] => {
      if (vinculo.origem_tipo === 'atividade' && abertas.has(vinculo.origem_id)) return [[vinculo.destino_id, vinculo.origem_id]];
      if (vinculo.destino_tipo === 'atividade' && abertas.has(vinculo.destino_id)) return [[vinculo.origem_id, vinculo.destino_id]];
      return [];
    }),
  );
  const itens = itensATransferir({ ativos, ferramentas, contextos, pessoas }).map((item) => ({ ...item, atividade: atividadeDoItem(item.id, atividades, ligadas) }));
  return { itens, produtos, marcas, pessoas };
}
