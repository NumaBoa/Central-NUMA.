/** T07.01 a T07.03: portfólio, fila, ficha do produto, objetivos e mudança de estágio (RN-07.08). */
import { z } from 'zod';
import { ErroDeRegra } from '@/dados/erros';
import { repositorios } from '@/dados/repositorios';
import { emTransacao } from '@/dados/transacao';
import type { Atividade } from '@/dados/tipos/atividade';
import type { Entidade } from '@/dados/tipos/contraparte';
import type { Marca, Produto } from '@/dados/tipos/marca';
import type { Pessoa } from '@/dados/tipos/pessoa';
import type { CambioReferencia } from '@/dados/tipos/cambio-referencia';
import type { CanalVenda, Concorrente, EstagioHistorico, Objetivo, Oferta, PrecoVersao, Simulacao } from '@/dados/tipos/precificacao';
import { hojeISO } from '@/lib/datas';
import { ID_CONSOLIDADA, ID_INSTITUCIONAL } from './contextos';
import { custosMediosDosProdutos, type CustoMedio } from './custos-produto';
import { errosDaDecisao, resolverDecisao, vincularDecisao, type EntradaDecisao } from './decisoes';
import { normalizarTexto } from './duplicidade';
import { KPI_USUARIOS_ATIVOS, ultimoValorDoKpi } from './kpis';
import type { Fase } from './navegacao';
import { situacaoEfetivaDaOferta } from './precificacao';
import { atividadesAbertasDoProduto, criarPlanoDeEncerramento, errosDoPlano, planoExistenteServe, type NovoPlanoDeEncerramento } from './produto-atividades';
import { pessoasParaProduto, ROTULOS_ESTAGIO, usaFila } from './produtos';

export { ROTULOS_ESTAGIO };

// ---------- Áreas da ficha (T07.02) ----------

export type IdDaArea = 'visao' | 'estagio' | 'ofertas' | 'simulacoes' | 'indicadores' | 'objetivos' | 'custos' | 'ferramentas' | 'legal' | 'contrato' | 'marca' | 'atividades' | 'historico' | 'clientes' | 'assinantes';

export type AreaDaFicha = { id: IdDaArea; rotulo: string; grupo: 'principal' | 'mais'; fase: Fase; pronta: boolean };

/**
 * A ordem da navegação da ficha. Clientes e Assinantes são da F1 e dependem de M11 e M05: ficam registradas aqui,
 * com `pronta: false`, e não aparecem até serem construídas e a fase chegar. Quem as construir só muda `pronta`.
 */
export const AREAS_DA_FICHA: readonly AreaDaFicha[] = [
  { id: 'visao', rotulo: 'Visão geral', grupo: 'principal', fase: 'f0b', pronta: true },
  { id: 'estagio', rotulo: 'Estágio e decisões', grupo: 'principal', fase: 'f0b', pronta: true },
  { id: 'ofertas', rotulo: 'Ofertas e preços', grupo: 'principal', fase: 'f0b', pronta: true },
  { id: 'simulacoes', rotulo: 'Simulações', grupo: 'principal', fase: 'f0b', pronta: true },
  { id: 'indicadores', rotulo: 'Indicadores', grupo: 'principal', fase: 'f0b', pronta: true },
  { id: 'objetivos', rotulo: 'Objetivos', grupo: 'mais', fase: 'f0b', pronta: true },
  { id: 'custos', rotulo: 'Custos', grupo: 'mais', fase: 'f0b', pronta: true },
  { id: 'ferramentas', rotulo: 'Ferramentas e ativos', grupo: 'mais', fase: 'f0b', pronta: true },
  { id: 'legal', rotulo: 'Legal e privacidade', grupo: 'mais', fase: 'f0b', pronta: true },
  { id: 'contrato', rotulo: 'Contrato', grupo: 'mais', fase: 'f1', pronta: true },
  { id: 'marca', rotulo: 'Marca e arquivos', grupo: 'mais', fase: 'f0b', pronta: true },
  { id: 'atividades', rotulo: 'Atividades', grupo: 'mais', fase: 'f0b', pronta: true },
  { id: 'historico', rotulo: 'Histórico', grupo: 'mais', fase: 'f0b', pronta: true },
  { id: 'clientes', rotulo: 'Clientes', grupo: 'mais', fase: 'f1', pronta: false },
  { id: 'assinantes', rotulo: 'Assinantes', grupo: 'mais', fase: 'f1', pronta: false },
];

/** Decisão de 07/11/2026: toda área construída aparece, em qualquer fase. As que ainda não existem continuam fora. */
export function areasDisponiveis(): AreaDaFicha[] {
  return AREAS_DA_FICHA.filter((area) => area.pronta);
}

// ---------- Fila ----------

/** Só Ideia e Validação, por `ordem_fila`; quem ainda não tem ordem vem no fim, por nome. */
export function produtosDaFila<T extends Pick<Produto, 'estagio' | 'ordem_fila' | 'nome' | 'arquivado_em'>>(produtos: readonly T[]): T[] {
  return produtos
    .filter((produto) => !produto.arquivado_em && usaFila(produto.estagio))
    .sort((a, b) => (a.ordem_fila ?? Number.POSITIVE_INFINITY) - (b.ordem_fila ?? Number.POSITIVE_INFINITY) || a.nome.localeCompare(b.nome, 'pt-BR'));
}

/** Subir e Descer: o comando equivalente a arrastar (RT-19). */
export function moverNaFila(ids: readonly string[], id: string, direcao: -1 | 1): string[] {
  const indice = ids.indexOf(id);
  const alvo = indice + direcao;
  if (indice < 0 || alvo < 0 || alvo >= ids.length) return [...ids];
  const nova = [...ids];
  [nova[indice], nova[alvo]] = [nova[alvo] as string, nova[indice] as string];
  return nova;
}

export function moverParaPosicao(ids: readonly string[], id: string, posicao: number): string[] {
  const sem = ids.filter((item) => item !== id);
  sem.splice(Math.max(0, Math.min(posicao, sem.length)), 0, id);
  return sem;
}

/** A nova ordem de uma vez, com a decisão, e o vínculo da decisão com cada produto da fila. */
export async function reordenarFila(ids: readonly string[], decisao: EntradaDecisao | null, hoje: string = hojeISO()): Promise<void> {
  const fila = produtosDaFila(await repositorios.produto.listar());
  const atual = fila.map((produto) => produto.id);
  if (ids.length !== atual.length || !atual.every((id) => ids.includes(id))) throw new ErroDeRegra('A fila mudou enquanto você reordenava. Revise e tente de novo.');
  if (ids.every((id, indice) => id === atual[indice])) throw new ErroDeRegra('A ordem não mudou.');
  await emTransacao(async () => {
    const registrada = await resolverDecisao(decisao, { produto_id: null, assunto: 'fila', qualquerProduto: true }, hoje);
    for (const [indice, id] of ids.entries()) {
      await repositorios.produto.atualizar(id, { ordem_fila: indice + 1 }, { motivo: `Fila reordenada: ${registrada.codigo}.` });
      await vincularDecisao(registrada.id, 'produto', id);
    }
  });
}

// ---------- Mudar estágio (T07.03 e RN-07.08) ----------

export const ITENS_DE_DESCONTINUAR = [
  { id: 'ferramentas', rotulo: 'Ferramentas vinculadas revisadas: canceladas ou mantidas' },
  { id: 'ativos', rotulo: 'Ativos transferidos ou encerrados' },
  { id: 'legal', rotulo: 'Documentos legais revisados' },
  { id: 'comunicacao', rotulo: 'Comunicação aos usuários definida' },
] as const;

export type EntradaDoPlano = { modo: 'existente'; atividade_id: string } | ({ modo: 'nova' } & NovoPlanoDeEncerramento);

export type DadosDaMudanca = {
  novo: Produto['estagio'] | '';
  criterio: string;
  metrica: string;
  resultado: string;
  data: string;
  decisao: EntradaDecisao | null;
  plano: EntradaDoPlano | null;
  checklist: readonly string[];
};

export function errosDaMudanca(atual: Produto['estagio'], dados: DadosDaMudanca, hoje: string): Readonly<Record<string, string>> {
  const erros: Record<string, string> = {};
  if (!dados.novo) erros.novo = 'Escolha o novo estágio.';
  else if (dados.novo === atual) erros.novo = 'O produto já está neste estágio.';
  if (!dados.criterio.trim()) erros.criterio = 'Diga qual critério foi atendido.';
  if (!dados.data) erros.data = 'Informe a data.';
  else if (dados.data > hoje) erros.data = 'A mudança precisa já ter acontecido.';
  for (const [campo, mensagem] of Object.entries(errosDaDecisao(dados.decisao, hoje))) erros[`decisao_${campo}`] = mensagem;
  if (dados.novo === 'descontinuado') {
    if (!dados.plano) erros.plano = 'Descontinuar exige o plano de encerramento, em uma atividade.';
    else if (dados.plano.modo === 'existente') {
      if (!dados.plano.atividade_id) erros.plano = 'Escolha a atividade do plano de encerramento.';
    } else for (const [campo, mensagem] of Object.entries(errosDoPlano(dados.plano))) erros[`plano_${campo}`] = mensagem;
    const faltando = ITENS_DE_DESCONTINUAR.filter((item) => !dados.checklist.includes(item.id));
    if (faltando.length) erros.checklist = `Falta conferir: ${faltando.map((item) => item.rotulo.toLocaleLowerCase('pt-BR')).join('; ')}.`;
  }
  return erros;
}

/** A situação acompanha o estágio: Pausado e Descontinuado têm a sua; os demais são Ativo. */
export function situacaoDoEstagio(estagio: Produto['estagio']): Produto['situacao'] {
  if (estagio === 'pausado') return 'pausado';
  return estagio === 'descontinuado' ? 'descontinuado' : 'ativo';
}

export async function mudarEstagio(produtoId: string, dados: DadosDaMudanca, hoje: string = hojeISO()): Promise<EstagioHistorico> {
  const produto = await repositorios.produto.obter(produtoId);
  if (!produto) throw new ErroDeRegra('Este produto não existe mais.');
  const primeiro = Object.values(errosDaMudanca(produto.estagio, dados, hoje))[0];
  if (primeiro) throw new ErroDeRegra(primeiro);
  const novo = dados.novo as Produto['estagio'];
  if (novo === 'descontinuado' && dados.plano?.modo === 'existente' && !(await planoExistenteServe(produtoId, dados.plano.atividade_id))) throw new ErroDeRegra('Esta atividade não está aberta neste produto. Escolha outra ou crie o plano.');

  return emTransacao(async () => {
    const decisao = await resolverDecisao(dados.decisao, { produto_id: produtoId, assunto: 'estagio' }, hoje);
    let planoId: string | null = null;
    if (novo === 'descontinuado' && dados.plano) planoId = dados.plano.modo === 'existente' ? dados.plano.atividade_id : (await criarPlanoDeEncerramento(produtoId, dados.plano)).id;

    const fila = produtosDaFila(await repositorios.produto.listar()).filter((outro) => outro.id !== produtoId);
    const naFilaAgora = usaFila(novo);
    await repositorios.produto.atualizar(produtoId, { estagio: novo, situacao: situacaoDoEstagio(novo), ordem_fila: naFilaAgora ? (usaFila(produto.estagio) ? produto.ordem_fila : fila.length + 1) : null }, { motivo: `Mudança de estágio: ${decisao.codigo}.` });
    // Quem sai da fila não deixa buraco na numeração.
    if (!naFilaAgora && usaFila(produto.estagio)) for (const [indice, outro] of fila.entries()) if (outro.ordem_fila !== indice + 1) await repositorios.produto.atualizar(outro.id, { ordem_fila: indice + 1 });

    return repositorios.produto_estagio_historico.criar({ produto_id: produtoId, estagio_anterior: produto.estagio, estagio_novo: novo, data: dados.data, criterio: dados.criterio.trim(), metrica: dados.metrica.trim() || null, resultado: dados.resultado.trim() || null, decisao_id: decisao.id, atividade_encerramento_id: planoId, checklist: novo === 'descontinuado' ? [...dados.checklist] : [] });
  });
}

export type LinhaDoEstagio = EstagioHistorico & { codigoDaDecisao: string; tituloDaDecisao: string; tituloDoPlano: string | null };

export async function estagiosDoProduto(produtoId: string): Promise<LinhaDoEstagio[]> {
  const [linhas, decisoes, atividades] = await Promise.all([repositorios.produto_estagio_historico.listar({ onde: { produto_id: produtoId } }), repositorios.decisao.listar({ incluirArquivados: true }), repositorios.atividade.listar({ incluirArquivados: true })]);
  return linhas
    .map((linha) => {
      const decisao = decisoes.find((item) => item.id === linha.decisao_id);
      return { ...linha, codigoDaDecisao: decisao?.codigo ?? 'Decisão removida', tituloDaDecisao: decisao?.titulo ?? '', tituloDoPlano: atividades.find((atividade) => atividade.id === linha.atividade_encerramento_id)?.titulo ?? null };
    })
    .sort((a, b) => b.data.localeCompare(a.data) || b.criado_em.localeCompare(a.criado_em));
}

// ---------- Ficha: campos do M07 no produto (T07.02) ----------

const esquemaLink = z.object({
  rotulo: z.string().trim().min(1, 'Diga o que é o link.'),
  url: z.string().trim().refine((texto) => {
    try {
      return ['http:', 'https:'].includes(new URL(texto).protocol);
    } catch {
      return false;
    }
  }, 'Use um link completo, começando com https://.'),
});

export const esquemaFormularioFicha = z.object({
  descricao_curta: z.string().trim().max(200, 'Use até 200 caracteres.'),
  descricao: z.string().trim(),
  proposta_valor: z.string().trim(),
  publico: z.string().trim(),
  problema: z.string().trim(),
  como_nasceu: z.string().trim(),
  links: z.array(esquemaLink),
  responsavel_id: z.string().min(1, 'Escolha a pessoa responsável pelo produto.'),
  entidade_id: z.string(),
  tem_usuarios_reais: z.boolean(),
  data_inicio: z.string(),
  definicao_usuario_ativo: z.string().trim(),
});

export type FormularioFicha = z.infer<typeof esquemaFormularioFicha>;

export function formularioDaFicha(produto: Produto, pessoas: readonly Pessoa[]): FormularioFicha {
  const responsavelValido = pessoasParaProduto(pessoas).some((pessoa) => pessoa.id === produto.responsavel_id);
  return {
    descricao_curta: produto.descricao_curta ?? '',
    descricao: produto.descricao ?? '',
    proposta_valor: produto.proposta_valor ?? '',
    publico: produto.publico ?? '',
    problema: produto.problema ?? '',
    como_nasceu: produto.como_nasceu ?? '',
    links: produto.links ?? [],
    responsavel_id: responsavelValido ? (produto.responsavel_id ?? '') : '',
    entidade_id: produto.entidade_id ?? '',
    tem_usuarios_reais: produto.tem_usuarios_reais,
    data_inicio: produto.data_inicio ?? '',
    definicao_usuario_ativo: produto.definicao_usuario_ativo ?? '',
  };
}

/** Nome, marca e código ficam no cadastro de T02.04; estágio, fila e situação só mudam com decisão. */
export async function salvarFicha(id: string, formulario: FormularioFicha): Promise<Produto> {
  return repositorios.produto.atualizar(id, {
    descricao_curta: formulario.descricao_curta || null,
    descricao: formulario.descricao || null,
    proposta_valor: formulario.proposta_valor || null,
    publico: formulario.publico || null,
    problema: formulario.problema || null,
    como_nasceu: formulario.como_nasceu || null,
    links: formulario.links,
    responsavel_id: formulario.responsavel_id,
    entidade_id: formulario.entidade_id || null,
    tem_usuarios_reais: formulario.tem_usuarios_reais,
    data_inicio: formulario.data_inicio || null,
    definicao_usuario_ativo: formulario.definicao_usuario_ativo || null,
  });
}

// ---------- Objetivos (T07.02) ----------

export const ROTULOS_SITUACAO_OBJETIVO: Readonly<Record<Objetivo['situacao'], string>> = { aberto: 'Aberto', atingido: 'Atingido', nao_atingido: 'Não atingido', cancelado: 'Cancelado' };

export const esquemaFormularioObjetivo = z.object({
  titulo: z.string().trim().min(1, 'Informe o título do objetivo.'),
  metrica: z.string().trim(),
  meta: z.string().trim(),
  prazo: z.string(),
  situacao: z.enum(['aberto', 'atingido', 'nao_atingido', 'cancelado']),
  responsavel_id: z.string().min(1, 'Escolha a responsável.'),
});

export type FormularioObjetivo = z.infer<typeof esquemaFormularioObjetivo>;

export async function salvarObjetivo(produtoId: string, formulario: FormularioObjetivo, id?: string): Promise<Objetivo> {
  const dados = { titulo: formulario.titulo, metrica: formulario.metrica || null, meta: formulario.meta || null, prazo: formulario.prazo || null, situacao: formulario.situacao, responsavel_id: formulario.responsavel_id };
  return id ? repositorios.objetivo.atualizar(id, dados) : repositorios.objetivo.criar({ produto_id: produtoId, ...dados });
}

export async function objetivosDoProduto(produtoId: string): Promise<Objetivo[]> {
  return (await repositorios.objetivo.listar({ onde: { produto_id: produtoId } })).sort((a, b) => (a.prazo ?? '9999').localeCompare(b.prazo ?? '9999'));
}

// ---------- Portfólio (T07.01) ----------

export type LinhaDoPortfolio = Produto & {
  marca: Marca | null;
  responsavel: string | null;
  custo: CustoMedio;
  ofertasAprovadas: number;
  ofertasEmEstudo: number;
  usuariosAtivos: { competencia: string; valor: number } | null;
  proximasAtividades: Atividade[];
};

export type DadosDoPortfolio = { linhas: LinhaDoPortfolio[]; marcas: Marca[]; pessoas: Pessoa[]; entidades: Entidade[]; produtos: Produto[] };

export async function carregarPortfolio(hoje: string = hojeISO()): Promise<DadosDoPortfolio> {
  const [produtos, marcas, pessoas, entidades, ofertas, precos, kpis] = await Promise.all([repositorios.produto.listar({ incluirArquivados: true }), repositorios.marca.listar({ incluirArquivados: true }), repositorios.pessoa.listar({ incluirArquivados: true }), repositorios.entidade.listar({ incluirArquivados: true }), repositorios.oferta.listar(), repositorios.preco_versao.listar(), repositorios.kpi_mensal.listar()]);
  const ativos = produtos.filter((produto) => !produto.arquivado_em);
  const custos = await custosMediosDosProdutos(ativos.map((produto) => produto.id), hoje);
  const linhas = await Promise.all(
    ativos.map(async (produto) => {
      const dele = ofertas.filter((oferta) => oferta.produto_id === produto.id);
      const situacoes = dele.map((oferta) => situacaoEfetivaDaOferta(oferta, precos.filter((preco) => preco.oferta_id === oferta.id), hoje));
      return {
        ...produto,
        marca: marcas.find((marca) => marca.id === produto.marca_id) ?? null,
        responsavel: pessoasParaProduto(pessoas).find((pessoa) => pessoa.id === produto.responsavel_id)?.nome_completo ?? null,
        custo: custos.get(produto.id) as CustoMedio,
        ofertasAprovadas: situacoes.filter((situacao) => situacao === 'aprovada').length,
        ofertasEmEstudo: situacoes.filter((situacao) => situacao === 'em_estudo').length,
        usuariosAtivos: ultimoValorDoKpi(kpis.filter((kpi) => kpi.produto_id === produto.id), KPI_USUARIOS_ATIVOS),
        proximasAtividades: (await atividadesAbertasDoProduto(produto.id, hoje)).slice(0, 3),
      };
    }),
  );
  return { linhas, marcas, pessoas, entidades, produtos };
}

export type FiltrosPortfolio = { busca: string; estagio: string; responsavel: string; situacao: string; marca: string };

export const FILTROS_PORTFOLIO_INICIAIS: FiltrosPortfolio = { busca: '', estagio: '', responsavel: '', situacao: '', marca: '' };

export const SEM_RESPONSAVEL = 'a_definir';

/** O contexto global também recorta (RT-11): um produto mostra só ele, e a Numa institucional não tem produtos. */
export function filtrarPortfolio<T extends LinhaDoPortfolio>(linhas: readonly T[], filtros: FiltrosPortfolio, contextoId: string): T[] {
  const termo = normalizarTexto(filtros.busca);
  return linhas.filter((linha) => {
    if (contextoId === ID_INSTITUCIONAL) return false;
    if (contextoId !== ID_CONSOLIDADA && linha.id !== contextoId) return false;
    if (termo && !normalizarTexto(`${linha.nome} ${linha.codigo_curto} ${linha.marca?.nome ?? ''} ${linha.descricao_curta ?? ''}`).includes(termo)) return false;
    if (filtros.estagio && linha.estagio !== filtros.estagio) return false;
    if (filtros.situacao && linha.situacao !== filtros.situacao) return false;
    if (filtros.marca && linha.marca_id !== filtros.marca) return false;
    if (filtros.responsavel === SEM_RESPONSAVEL) return linha.responsavel === null;
    return !filtros.responsavel || linha.responsavel_id === filtros.responsavel;
  });
}

export type DadosDaFicha = { linha: LinhaDoPortfolio; marcas: Marca[]; pessoas: Pessoa[]; entidades: Entidade[]; temOfertas: boolean };

export async function carregarFicha(id: string, hoje: string = hojeISO()): Promise<DadosDaFicha | null> {
  const dados = await carregarPortfolio(hoje);
  const linha = dados.linhas.find((item) => item.id === id);
  if (!linha) return null;
  return { linha, marcas: dados.marcas, pessoas: dados.pessoas, entidades: dados.entidades, temOfertas: linha.ofertasAprovadas + linha.ofertasEmEstudo > 0 };
}

export type DadosDoSimulador = {
  produto: Produto | null;
  ofertas: Oferta[];
  canais: CanalVenda[];
  cambios: CambioReferencia[];
  custo: CustoMedio | null;
  concorrentes: Concorrente[];
  precos: PrecoVersao[];
  /** Recalcular: a simulação salva de onde esta parte. */
  base: Simulacao | null;
};

export async function carregarSimulador(produtoId: string | null, baseId: string | null, hoje: string = hojeISO()): Promise<DadosDoSimulador> {
  const [produto, canais, cambios, base] = await Promise.all([produtoId ? repositorios.produto.obter(produtoId) : Promise.resolve(null), repositorios.canal_venda.listar(), repositorios.cambio_referencia.listar(), baseId ? repositorios.simulacao.obter(baseId) : Promise.resolve(null)]);
  if (!produto) return { produto: null, ofertas: [], canais, cambios, custo: null, concorrentes: [], precos: [], base: null };
  const [ofertas, concorrentes, precos, custos] = await Promise.all([repositorios.oferta.listar({ onde: { produto_id: produto.id } }), repositorios.concorrente_referencia.listar({ onde: { produto_id: produto.id } }), repositorios.preco_versao.listar(), custosMediosDosProdutos([produto.id], hoje)]);
  const dasOfertas = new Set(ofertas.map((oferta) => oferta.id));
  return { produto, ofertas, canais: canais.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), cambios, custo: custos.get(produto.id) ?? null, concorrentes, precos: precos.filter((preco) => dasOfertas.has(preco.oferta_id)), base: base?.produto_id === produto.id ? base : null };
}

/** O texto de um custo médio: sem histórico não é zero (RT-08). */
export function textoDoCusto(custo: CustoMedio, formatar: (valor: number) => string): string {
  if (custo.situacao === 'sem_historico') return 'Sem histórico';
  if (custo.situacao === 'sem_cambio') return `Falta câmbio de ${custo.moedasSemCambio.join(', ')}`;
  return `${formatar(custo.valor as number)}/mês${custo.estimado ? ' (estimado)' : ''}`;
}
