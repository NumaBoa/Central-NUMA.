/**
 * Regras de T08.06 (10-M08), no recorte básico da F1. O dinheiro continua no M05 e as oportunidades no M10:
 * aqui só há vínculos. Atribuição e custo por inscrito são da F2. Vínculo não prova que a campanha causou a venda.
 */
import { z } from 'zod';
import { ErroDeRegra } from '@/dados/erros';
import { repositorios } from '@/dados/repositorios';
import type { Vinculo } from '@/dados/tipos/apoio';
import { parDoVinculo } from '@/dados/tipos/apoio';
import type { Oportunidade } from '@/dados/tipos/comercial';
import type { Marca, Produto } from '@/dados/tipos/marca';
import { CANAIS_DE_CONTEUDO, SITUACOES_DE_CAMPANHA, type Arquivo, type ArquivoVinculo, type Campanha, type Inscrito, type ListaEspera, type PecaConteudo } from '@/dados/tipos/marketing';
import type { Pessoa } from '@/dados/tipos/pessoa';
import type { Titulo } from '@/dados/tipos/titulo';
import { hojeISO } from '@/lib/datas';
import { podeVerClasse } from './classes';
import { ID_CONSOLIDADA, ID_INSTITUCIONAL } from './contextos';
import { lerValor, valorParaCampo } from './dinheiro';
import { normalizarTexto } from './duplicidade';
import { AVISO_CREDENCIAL, pareceCredencial } from './segredos';

export const ROTULOS_SITUACAO_CAMPANHA: Readonly<Record<(typeof SITUACOES_DE_CAMPANHA)[number], string>> = { planejada: 'Planejada', em_andamento: 'Em andamento', encerrada: 'Encerrada', cancelada: 'Cancelada' };

export const CRITERIO_DE_ORIGEM = 'Origem informada manualmente: o vínculo não comprova que a campanha causou a venda.';

const TIPO_CAMPANHA = 'campanha';
const TIPO_TITULO = 'titulo';
const TIPO_LISTA = 'lista_espera';

const curto = z.string().trim();
const numeroVazio = z.string().trim().regex(/^\d*$/, 'Use só números inteiros.');

export const esquemaFormularioCampanha = z
  .object({
    nome: curto.min(1, 'Dê um nome à campanha.'),
    contexto: z.string().min(1, 'Escolha a Numa ou um produto.'),
    objetivo: curto,
    publico: curto,
    canais: z.array(z.enum(CANAIS_DE_CONTEUDO)),
    inicio: z.string(),
    fim: z.string(),
    orcamento: curto,
    responsavel_id: z.string().min(1, 'Escolha a responsável.'),
    situacao: z.enum(SITUACOES_DE_CAMPANHA),
    cancelada_motivo: curto,
  })
  .superRefine((dados, contexto) => {
    const falha = (campo: string, message: string) => contexto.addIssue({ code: 'custom', path: [campo], message });
    if (dados.inicio && dados.fim && dados.fim < dados.inicio) falha('fim', 'O fim vem antes do início.');
    if (dados.orcamento && lerValor(dados.orcamento) === null) falha('orcamento', 'Use um valor como 1.500,00, ou deixe vazio.');
    if (dados.situacao === 'em_andamento' && !dados.inicio) falha('inicio', 'Campanha em andamento precisa da data de início.');
  });
export type FormularioCampanha = z.infer<typeof esquemaFormularioCampanha>;

export function formularioCampanhaVazio(responsavelId: string, contextoGlobalId: string): FormularioCampanha {
  return { nome: '', contexto: contextoGlobalId === ID_CONSOLIDADA ? '' : contextoGlobalId, objetivo: '', publico: '', canais: [], inicio: '', fim: '', orcamento: '', responsavel_id: responsavelId, situacao: 'planejada', cancelada_motivo: '' };
}

export function formularioDaCampanha(campanha: Campanha): FormularioCampanha {
  return {
    nome: campanha.nome,
    contexto: campanha.produto_id ?? ID_INSTITUCIONAL,
    objetivo: campanha.objetivo ?? '',
    publico: campanha.publico ?? '',
    canais: campanha.canais.filter((canal): canal is (typeof CANAIS_DE_CONTEUDO)[number] => (CANAIS_DE_CONTEUDO as readonly string[]).includes(canal)),
    inicio: campanha.inicio ?? '',
    fim: campanha.fim ?? '',
    orcamento: campanha.orcamento === null ? '' : valorParaCampo(campanha.orcamento),
    responsavel_id: campanha.responsavel_id,
    situacao: campanha.situacao,
    cancelada_motivo: campanha.cancelada_motivo ?? '',
  };
}

const nulo = (texto: string) => texto.trim() || null;

function dadosDaCampanha(formulario: FormularioCampanha) {
  return {
    nome: formulario.nome,
    produto_id: formulario.contexto === ID_INSTITUCIONAL ? null : formulario.contexto,
    objetivo: nulo(formulario.objetivo),
    publico: nulo(formulario.publico),
    canais: formulario.canais,
    inicio: nulo(formulario.inicio),
    fim: nulo(formulario.fim),
    // Vazio é "não definido", nunca zero (RT-08).
    orcamento: formulario.orcamento ? lerValor(formulario.orcamento) : null,
    responsavel_id: formulario.responsavel_id,
    situacao: formulario.situacao,
    cancelada_motivo: formulario.situacao === 'cancelada' ? nulo(formulario.cancelada_motivo) : null,
  };
}

export function avisosDaCampanha(formulario: Pick<FormularioCampanha, 'objetivo' | 'publico'>): string[] {
  return [formulario.objetivo, formulario.publico].some(pareceCredencial) ? [AVISO_CREDENCIAL] : [];
}

const RESULTADOS_VAZIOS = { inscritos: null, contatos: null, oportunidades: null, vendas: null, medido_em: null, observacao: null };

export async function criarCampanha(formulario: FormularioCampanha): Promise<Campanha> {
  return repositorios.campanha.criar({ ...dadosDaCampanha(esquemaFormularioCampanha.parse(formulario)), resultados: RESULTADOS_VAZIOS });
}

export async function salvarCampanha(id: string, formulario: FormularioCampanha): Promise<Campanha> {
  return repositorios.campanha.atualizar(id, dadosDaCampanha(esquemaFormularioCampanha.parse(formulario)));
}

export async function arquivarCampanha(id: string): Promise<void> {
  const pecas = await repositorios.peca_conteudo.listar({ onde: { campanha_id: id } });
  const abertas = pecas.filter((peca) => peca.situacao !== 'publicado' && peca.situacao !== 'cancelado');
  if (abertas.length) throw new ErroDeRegra(`Esta campanha tem ${abertas.length === 1 ? '1 peça em aberto' : `${abertas.length} peças em aberto`}. Publique, cancele ou tire o vínculo antes.`);
  await repositorios.campanha.arquivar(id);
}

export async function restaurarCampanha(id: string): Promise<void> {
  await repositorios.campanha.restaurar(id);
}

// ---------- Resultados manuais ----------

export const esquemaResultadosCampanha = z
  .object({ inscritos: numeroVazio, contatos: numeroVazio, oportunidades: numeroVazio, vendas: numeroVazio, medido_em: z.string(), observacao: curto })
  .superRefine((dados, contexto) => {
    const temNumero = [dados.inscritos, dados.contatos, dados.oportunidades, dados.vendas].some(Boolean);
    if (temNumero && !dados.medido_em) contexto.addIssue({ code: 'custom', path: ['medido_em'], message: 'Informe a data da medição.' });
    if (dados.medido_em && dados.medido_em > hojeISO()) contexto.addIssue({ code: 'custom', path: ['medido_em'], message: 'A medição não pode estar no futuro.' });
  });
export type FormularioResultados = z.infer<typeof esquemaResultadosCampanha>;

const paraTexto = (valor: number | null) => (valor === null ? '' : String(valor));
const paraNumero = (texto: string) => (texto.trim() === '' ? null : Number(texto));

export function formularioDosResultados(campanha: Campanha): FormularioResultados {
  const { inscritos, contatos, oportunidades, vendas, medido_em, observacao } = campanha.resultados;
  return { inscritos: paraTexto(inscritos), contatos: paraTexto(contatos), oportunidades: paraTexto(oportunidades), vendas: paraTexto(vendas), medido_em: medido_em ?? '', observacao: observacao ?? '' };
}

export async function salvarResultados(id: string, formulario: FormularioResultados): Promise<void> {
  const dados = esquemaResultadosCampanha.parse(formulario);
  await repositorios.campanha.atualizar(id, { resultados: { inscritos: paraNumero(dados.inscritos), contatos: paraNumero(dados.contatos), oportunidades: paraNumero(dados.oportunidades), vendas: paraNumero(dados.vendas), medido_em: nulo(dados.medido_em), observacao: nulo(dados.observacao) } });
}

// ---------- Vínculos ----------

const donoDoVinculo = (vinculo: Vinculo, tipo: string, id: string, outroTipo: string): string | null => {
  if (vinculo.origem_tipo === tipo && vinculo.origem_id === id && vinculo.destino_tipo === outroTipo) return vinculo.destino_id;
  if (vinculo.destino_tipo === tipo && vinculo.destino_id === id && vinculo.origem_tipo === outroTipo) return vinculo.origem_id;
  return null;
};

export const idsVinculados = (campanhaId: string, outroTipo: string, vinculos: readonly Vinculo[]): string[] => vinculos.flatMap((vinculo) => (vinculo.arquivado_em ? [] : (donoDoVinculo(vinculo, TIPO_CAMPANHA, campanhaId, outroTipo) ?? [])));

async function ligar(campanhaId: string, outroTipo: string, outroId: string) {
  const par = parDoVinculo({ tipo: TIPO_CAMPANHA, id: campanhaId }, { tipo: outroTipo, id: outroId });
  const existentes = await repositorios.vinculo.listar({ onde: par });
  if (existentes.length) throw new ErroDeRegra('Esse vínculo já existe.');
  await repositorios.vinculo.criar(par);
}

async function desligar(campanhaId: string, outroTipo: string, outroId: string) {
  const par = parDoVinculo({ tipo: TIPO_CAMPANHA, id: campanhaId }, { tipo: outroTipo, id: outroId });
  for (const vinculo of await repositorios.vinculo.listar({ onde: par })) await repositorios.vinculo.arquivar(vinculo.id);
}

/** O título continua sendo do M05: o vínculo não cria despesa nem muda o valor. */
export const vincularTitulo = (campanhaId: string, tituloId: string) => ligar(campanhaId, TIPO_TITULO, tituloId);
export const desvincularTitulo = (campanhaId: string, tituloId: string) => desligar(campanhaId, TIPO_TITULO, tituloId);
export const vincularLista = (campanhaId: string, listaId: string) => ligar(campanhaId, TIPO_LISTA, listaId);
export const desvincularLista = (campanhaId: string, listaId: string) => desligar(campanhaId, TIPO_LISTA, listaId);

/**
 * RN-08.12: a oportunidade indica a campanha de origem. O campo é do M10 (`oportunidade.campanha_id`), e o
 * formulário de lá ainda não o oferece; este é o ponto de conexão, e o histórico da oportunidade registra quem indicou.
 */
export async function indicarCampanhaDaOportunidade(oportunidadeId: string, campanhaId: string | null): Promise<void> {
  await repositorios.oportunidade.atualizar(oportunidadeId, { campanha_id: campanhaId }, { motivo: 'Origem informada manualmente na campanha.' });
}

export async function vincularPeca(pecaId: string, campanhaId: string | null): Promise<void> {
  await repositorios.peca_conteudo.atualizar(pecaId, { campanha_id: campanhaId });
}

/** Sem somar moedas. Cancelado não conta: não vai ser pago. O saldo e as baixas continuam na ficha do M05. */
export function totaisDosTitulos(titulos: readonly Pick<Titulo, 'valor' | 'moeda' | 'situacao' | 'arquivado_em'>[]): { moeda: string; valor: number; quantos: number }[] {
  const porMoeda = new Map<string, { valor: number; quantos: number }>();
  for (const titulo of titulos) {
    if (titulo.arquivado_em || titulo.situacao === 'cancelado') continue;
    const atual = porMoeda.get(titulo.moeda) ?? { valor: 0, quantos: 0 };
    porMoeda.set(titulo.moeda, { valor: Math.round((atual.valor + titulo.valor) * 100) / 100, quantos: atual.quantos + 1 });
  }
  return [...porMoeda].map(([moeda, total]) => ({ moeda, ...total })).sort((a, b) => a.moeda.localeCompare(b.moeda));
}

// ---------- Carga e filtros ----------

export type DadosDasCampanhas = {
  campanhas: Campanha[];
  pecas: PecaConteudo[];
  listas: ListaEspera[];
  inscritos: Inscrito[];
  vinculos: Vinculo[];
  titulos: Titulo[];
  oportunidades: Oportunidade[];
  arquivos: Arquivo[];
  vinculosDeArquivos: ArquivoVinculo[];
  pessoas: Pessoa[];
  produtos: Produto[];
  marcas: Marca[];
};

export async function carregarCampanhas(): Promise<DadosDasCampanhas> {
  const [campanhas, pecas, listas, inscritos, vinculos, titulos, oportunidades, arquivos, vinculosDeArquivos, pessoas, produtos, marcas] = await Promise.all([
    repositorios.campanha.listar({ incluirArquivados: true }),
    repositorios.peca_conteudo.listar(),
    repositorios.lista_espera.listar(),
    repositorios.inscrito.listar(),
    repositorios.vinculo.listar(),
    repositorios.titulo.listar(),
    repositorios.oportunidade.listar(),
    repositorios.arquivo.listar(),
    repositorios.arquivo_vinculo.listar({ onde: { registro_tipo: TIPO_CAMPANHA } }),
    repositorios.pessoa.listar({ incluirArquivados: true }),
    repositorios.produto.listar({ incluirArquivados: true }),
    repositorios.marca.listar({ incluirArquivados: true }),
  ]);
  return { campanhas, pecas, listas, inscritos, vinculos, titulos, oportunidades, arquivos: arquivos.filter((arquivo) => podeVerClasse(arquivo.classe)), vinculosDeArquivos, pessoas, produtos, marcas };
}

export type FiltrosCampanhas = { busca: string; contexto: string; situacao: string; responsavel: string; canal: string; arquivados: boolean };
export const FILTROS_CAMPANHAS_INICIAIS: FiltrosCampanhas = { busca: '', contexto: '', situacao: '', responsavel: '', canal: '', arquivados: false };

const ORDEM_DA_SITUACAO: Readonly<Record<Campanha['situacao'], number>> = { em_andamento: 0, planejada: 1, encerrada: 2, cancelada: 3 };

/** Em andamento primeiro: é onde há trabalho. */
export function filtrarCampanhas(campanhas: readonly Campanha[], filtros: FiltrosCampanhas, contextoGlobalId: string): Campanha[] {
  const texto = normalizarTexto(filtros.busca);
  const contexto = filtros.contexto || (contextoGlobalId === ID_CONSOLIDADA ? '' : contextoGlobalId);
  return campanhas
    .filter((campanha) => {
      if (Boolean(campanha.arquivado_em) !== filtros.arquivados) return false;
      if (texto && !normalizarTexto(`${campanha.codigo} ${campanha.nome} ${campanha.objetivo ?? ''}`).includes(texto)) return false;
      if (contexto && (campanha.produto_id ?? ID_INSTITUCIONAL) !== contexto) return false;
      if (filtros.situacao && campanha.situacao !== filtros.situacao) return false;
      if (filtros.responsavel && campanha.responsavel_id !== filtros.responsavel) return false;
      if (filtros.canal && !campanha.canais.includes(filtros.canal)) return false;
      return true;
    })
    .sort((a, b) => ORDEM_DA_SITUACAO[a.situacao] - ORDEM_DA_SITUACAO[b.situacao] || a.nome.localeCompare(b.nome, 'pt-BR'));
}

/** Registros apontando para a campanha: é uma contagem, não atribuição. */
export function ligadosACampanha(campanhaId: string, dados: Pick<DadosDasCampanhas, 'pecas' | 'inscritos' | 'oportunidades' | 'vinculos' | 'titulos' | 'listas'>) {
  const pecas = dados.pecas.filter((peca) => peca.campanha_id === campanhaId);
  const inscritos = dados.inscritos.filter((inscrito) => inscrito.campanha_id === campanhaId);
  const oportunidades = dados.oportunidades.filter((oportunidade) => oportunidade.campanha_id === campanhaId);
  const idsTitulos = idsVinculados(campanhaId, TIPO_TITULO, dados.vinculos);
  const idsListas = idsVinculados(campanhaId, TIPO_LISTA, dados.vinculos);
  return { pecas, inscritos, oportunidades, titulos: dados.titulos.filter((titulo) => idsTitulos.includes(titulo.id)), listas: dados.listas.filter((lista) => idsListas.includes(lista.id)) };
}
