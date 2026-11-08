/**
 * Regras de T06.09 (08-M06): reuniões e o registro completo de decisões. Item de ação é uma atividade do Meu dia, a mesma
 * linha, sem cópia (RN-06.14): concluir em qualquer lugar vale para os dois. Decisão registrada não muda (RN-06.13).
 */
import { ErroDeRegra } from '@/dados/erros';
import { repositorios } from '@/dados/repositorios';
import { emTransacao } from '@/dados/transacao';
import type { Vinculo } from '@/dados/tipos/apoio';
import type { Area } from '@/dados/tipos/area';
import type { Atividade } from '@/dados/tipos/atividade';
import type { Decisao, DecisaoDecisor } from '@/dados/tipos/decisao';
import type { Marca, Produto } from '@/dados/tipos/marca';
import type { Pessoa } from '@/dados/tipos/pessoa';
import type { Reuniao, ReuniaoParticipante } from '@/dados/tipos/sociedade';
import { diaEHoraNoFuso, hojeISO, instanteNoFuso } from '@/lib/datas';
import { estaAberta } from './atividades';
import { AREA_GESTAO_GERAL, criarTarefaGerada } from './atividades-geradas';
import { atividadesDoRegistro, nomeDoRegistro, REGISTROS_VINCULAVEIS } from './atividades-painel';
import { errosDaDecisao, sociasParaDecidir, vincularDecisao } from './decisoes';
import { normalizarTexto } from './duplicidade';
import { ORIGEM_REUNIAO } from './integracoes/meu-dia-m06';

// ---------- Reunião ----------

export type DadosDasReunioes = {
  reunioes: Reuniao[];
  participantes: ReuniaoParticipante[];
  decisoes: Decisao[];
  decisores: DecisaoDecisor[];
  acoes: Atividade[];
  pessoas: Pessoa[];
  produtos: Produto[];
  marcas: Marca[];
  areas: Area[];
  vinculos: Vinculo[];
  saidas: string[];
};

export async function carregarReunioes(): Promise<DadosDasReunioes> {
  const [reunioes, participantes, decisoes, decisores, acoes, pessoas, produtos, marcas, areas, vinculos, socias] = await Promise.all([repositorios.reuniao.listar({ incluirArquivados: true }), repositorios.reuniao_participante.listar(), repositorios.decisao.listar(), repositorios.decisao_decisor.listar(), repositorios.atividade.listar({ onde: { origem_tipo: ORIGEM_REUNIAO } }), repositorios.pessoa.listar({ incluirArquivados: true }), repositorios.produto.listar({ incluirArquivados: true }), repositorios.marca.listar({ incluirArquivados: true }), repositorios.area.listar(), repositorios.vinculo.listar(), repositorios.socia.listar()]);
  const hoje = hojeISO();
  return { reunioes, participantes, decisoes, decisores, acoes, pessoas, produtos, marcas, areas, vinculos, saidas: socias.filter((socia) => socia.saida_em && socia.saida_em <= hoje).map((socia) => socia.pessoa_id) };
}

export const nomeDoContexto = (produtoId: string | null, produtos: readonly Pick<Produto, 'id' | 'nome'>[]) => (produtoId ? (produtos.find((produto) => produto.id === produtoId)?.nome ?? 'Produto removido') : 'Numa');

export type LinhaDaReuniao = { reuniao: Reuniao; dia: string; hora: string; participantes: string[]; contexto: string; decisoes: number; acoesAbertas: number };

export function linhasDasReunioes({ reunioes, participantes, decisoes, acoes, pessoas, produtos }: Pick<DadosDasReunioes, 'reunioes' | 'participantes' | 'decisoes' | 'acoes' | 'pessoas' | 'produtos'>): LinhaDaReuniao[] {
  return reunioes
    .map((reuniao) => {
      const { dia, hora } = diaEHoraNoFuso(reuniao.data_hora);
      return {
        reuniao,
        dia,
        hora,
        participantes: participantes.filter((linha) => linha.reuniao_id === reuniao.id).map((linha) => pessoas.find((pessoa) => pessoa.id === linha.pessoa_id)?.nome_completo ?? 'Pessoa removida'),
        contexto: nomeDoContexto(reuniao.produto_id, produtos),
        decisoes: decisoes.filter((decisao) => decisao.reuniao_id === reuniao.id).length,
        acoesAbertas: acoes.filter((acao) => acao.origem_id === reuniao.id && estaAberta(acao)).length,
      };
    })
    .sort((a, b) => b.reuniao.data_hora.localeCompare(a.reuniao.data_hora));
}

export type FormularioReuniao = { titulo: string; data: string; hora: string; participantes: string[]; produto_id: string; pauta: string; notas: string };

export const formularioReuniaoVazio = (pessoaId: string, hoje: string = hojeISO()): FormularioReuniao => ({ titulo: '', data: hoje, hora: '', participantes: [pessoaId], produto_id: '', pauta: '', notas: '' });

export function formularioDaReuniao(reuniao: Reuniao, participantes: readonly string[]): FormularioReuniao {
  const { dia, hora } = diaEHoraNoFuso(reuniao.data_hora);
  return { titulo: reuniao.titulo, data: dia, hora, participantes: [...participantes], produto_id: reuniao.produto_id ?? '', pauta: reuniao.pauta.join('\n'), notas: reuniao.notas ?? '' };
}

export function errosDaReuniao(formulario: FormularioReuniao): Record<string, string> {
  const erros: Record<string, string> = {};
  if (!formulario.titulo.trim()) erros.titulo = 'Informe o título da reunião.';
  if (!formulario.data) erros.data = 'Informe a data.';
  if (!formulario.hora) erros.hora = 'Informe a hora.';
  if (!formulario.participantes.length) erros.participantes = 'Marque quem participa.';
  return erros;
}

const itensDaPauta = (texto: string) =>
  texto
    .split('\n')
    .map((linha) => linha.replace(/^[\s•\-*]+/, '').trim())
    .filter(Boolean);

export async function salvarReuniao(formulario: FormularioReuniao, id?: string): Promise<Reuniao> {
  const erro = Object.values(errosDaReuniao(formulario))[0];
  if (erro) throw new ErroDeRegra(erro);
  const dados = { titulo: formulario.titulo.trim(), data_hora: instanteNoFuso(formulario.data, formulario.hora), produto_id: formulario.produto_id || null, pauta: itensDaPauta(formulario.pauta), notas: formulario.notas.trim() || null };
  return emTransacao(async () => {
    const reuniao = id ? await repositorios.reuniao.atualizar(id, dados) : await repositorios.reuniao.criar(dados);
    const atuais = await repositorios.reuniao_participante.listar({ onde: { reuniao_id: reuniao.id } });
    for (const linha of atuais) if (!formulario.participantes.includes(linha.pessoa_id)) await repositorios.reuniao_participante.arquivar(linha.id);
    for (const pessoa_id of formulario.participantes) if (!atuais.some((linha) => linha.pessoa_id === pessoa_id)) await repositorios.reuniao_participante.criar({ reuniao_id: reuniao.id, pessoa_id });
    return reuniao;
  });
}

export async function salvarNotasDaReuniao(id: string, notas: string): Promise<void> {
  await repositorios.reuniao.atualizar(id, { notas: notas.trim() || null });
}

/** Decisão e ação continuam valendo mesmo sem a reunião: por isso, com elas, não arquiva. */
export async function arquivarReuniao(id: string): Promise<void> {
  const { decisoes, acoes } = await carregarReunioes();
  if (decisoes.some((decisao) => decisao.reuniao_id === id)) throw new ErroDeRegra('Esta reunião tem decisões registradas: ela fica, para o histórico.');
  if (acoes.some((acao) => acao.origem_id === id && estaAberta(acao))) throw new ErroDeRegra('Esta reunião tem ações abertas. Conclua ou cancele antes.');
  await repositorios.reuniao.arquivar(id);
}

export async function restaurarReuniao(id: string): Promise<void> {
  await repositorios.reuniao.restaurar(id);
}

// ---------- Itens de ação (RN-06.14 e CA-06.07) ----------

export type FormularioAcao = { titulo: string; responsavel_id: string; prazo: string };

export function errosDaAcao(formulario: FormularioAcao): Record<string, string> {
  const erros: Record<string, string> = {};
  if (!formulario.titulo.trim()) erros.titulo = 'Diga qual é a ação.';
  if (!formulario.responsavel_id) erros.responsavel_id = 'Escolha a responsável.';
  return erros;
}

/** Vira atividade no Meu dia, com origem e vínculo na reunião. A mesma ação ainda aberta não entra duas vezes. */
export async function adicionarAcao(reuniaoId: string, formulario: FormularioAcao): Promise<Atividade> {
  const erro = Object.values(errosDaAcao(formulario))[0];
  if (erro) throw new ErroDeRegra(erro);
  const reuniao = await repositorios.reuniao.obter(reuniaoId);
  if (!reuniao) throw new ErroDeRegra('Esta reunião não existe mais.');
  const titulo = formulario.titulo.trim();
  const abertas = (await atividadesDoRegistro('reuniao', reuniaoId)).filter(estaAberta);
  if (abertas.some((acao) => normalizarTexto(acao.titulo) === normalizarTexto(titulo))) throw new ErroDeRegra('Esta ação já está aberta nesta reunião.');
  return criarTarefaGerada({ titulo, responsavel_id: formulario.responsavel_id, area_id: AREA_GESTAO_GERAL, prazo: formulario.prazo || null, origem_tipo: ORIGEM_REUNIAO, origem_id: reuniaoId }, { vinculo: { tipo: 'reuniao', id: reuniaoId }, produtos: reuniao.produto_id ? [reuniao.produto_id] : [] });
}

export const acoesDaReuniao = (id: string) => atividadesDoRegistro('reuniao', id);

// ---------- Decisões ----------

export type RegistroAfetado = { tipo: string; id: string };

export type FormularioDecisao = {
  titulo: string;
  produto_id: string;
  area_id: string;
  descricao: string;
  motivo: string;
  alternativas: string;
  decisores: string[];
  data: string;
  impacto: string;
  registros: RegistroAfetado[];
  substitui_id: string;
  reuniao_id: string;
};

export const formularioDecisaoVazio = (pessoaId: string, socias: readonly Pick<Pessoa, 'id'>[], hoje: string = hojeISO()): FormularioDecisao => ({ titulo: '', produto_id: '', area_id: '', descricao: '', motivo: '', alternativas: '', decisores: socias.some((socia) => socia.id === pessoaId) ? [pessoaId] : [], data: hoje, impacto: '', registros: [], substitui_id: '', reuniao_id: '' });

/** "Substituir": parte do que está valendo, porque em geral só um ponto muda. O motivo é o da substituição. */
export function formularioDaSubstituicao(decisao: Decisao, decisores: readonly string[], registros: readonly RegistroAfetado[], hoje: string = hojeISO()): FormularioDecisao {
  return { titulo: decisao.titulo, produto_id: decisao.produto_id ?? '', area_id: decisao.area_id ?? '', descricao: decisao.descricao, motivo: '', alternativas: decisao.alternativas ?? '', decisores: [...decisores], data: hoje, impacto: decisao.impacto ?? '', registros: [...registros], substitui_id: decisao.id, reuniao_id: '' };
}

export function errosDoFormularioDecisao(formulario: FormularioDecisao, hoje: string = hojeISO()): Record<string, string> {
  const erros: Record<string, string> = { ...errosDaDecisao({ modo: 'registrar', ...formulario }, hoje) };
  if (formulario.substitui_id && !formulario.motivo.trim()) erros.motivo = 'Informe o motivo da substituição.';
  return erros;
}

/** RN-06.13: registra de uma vez a nova decisão, quem decidiu, os vínculos e a substituição da anterior, se houver. */
export async function registrarDecisao(formulario: FormularioDecisao, hoje: string = hojeISO()): Promise<Decisao> {
  const erro = Object.values(errosDoFormularioDecisao(formulario, hoje))[0];
  if (erro) throw new ErroDeRegra(erro);
  const dados = await carregarReunioes();
  const socias = new Set(sociasParaDecidir(dados.pessoas).filter((pessoa) => !dados.saidas.includes(pessoa.id)).map((pessoa) => pessoa.id));
  if (!formulario.decisores.every((id) => socias.has(id))) throw new ErroDeRegra('Só uma sócia ativa pode constar como quem decidiu.');
  const anterior = formulario.substitui_id ? dados.decisoes.find((decisao) => decisao.id === formulario.substitui_id) : undefined;
  if (formulario.substitui_id && !anterior) throw new ErroDeRegra('A decisão a substituir não existe mais.');
  if (anterior && anterior.situacao !== 'registrada') throw new ErroDeRegra('Esta decisão já foi substituída. Substitua a que está valendo.');
  return emTransacao(async () => {
    const nova = await repositorios.decisao.criar({
      titulo: formulario.titulo.trim(),
      descricao: formulario.descricao.trim(),
      motivo: formulario.motivo.trim() || null,
      alternativas: formulario.alternativas.trim() || null,
      impacto: formulario.impacto.trim() || null,
      data: formulario.data,
      area_id: formulario.area_id || null,
      produto_id: formulario.produto_id || null,
      reuniao_id: formulario.reuniao_id || null,
      situacao: 'registrada',
      substituida_por_id: null,
      assunto: anterior?.assunto ?? 'geral',
    });
    for (const pessoa_id of formulario.decisores) await repositorios.decisao_decisor.criar({ decisao_id: nova.id, pessoa_id });
    for (const registro of formulario.registros) await vincularDecisao(nova.id, registro.tipo, registro.id);
    if (anterior) await repositorios.decisao.atualizar(anterior.id, { situacao: 'substituida', substituida_por_id: nova.id }, { motivo: formulario.motivo.trim() });
    return nova;
  });
}

export const nomesDosDecisores = (decisaoId: string, { decisores, pessoas }: Pick<DadosDasReunioes, 'decisores' | 'pessoas'>) => decisores.filter((linha) => linha.decisao_id === decisaoId).map((linha) => pessoas.find((pessoa) => pessoa.id === linha.pessoa_id)?.nome_completo ?? 'Pessoa removida');

export const idsDosDecisores = (decisaoId: string, decisores: readonly DecisaoDecisor[]) => decisores.filter((linha) => linha.decisao_id === decisaoId).map((linha) => linha.pessoa_id);

/** Os registros afetados, nos dois sentidos do vínculo. */
export function registrosDaDecisao(decisaoId: string, vinculos: readonly Vinculo[]): RegistroAfetado[] {
  return vinculos.flatMap((vinculo) => {
    if (vinculo.origem_tipo === 'decisao' && vinculo.origem_id === decisaoId) return [{ tipo: vinculo.destino_tipo, id: vinculo.destino_id }];
    if (vinculo.destino_tipo === 'decisao' && vinculo.destino_id === decisaoId) return [{ tipo: vinculo.origem_tipo, id: vinculo.origem_id }];
    return [];
  });
}

export type RegistroComNome = RegistroAfetado & { rotulo: string; nome: string; href: string | null };

export async function nomearRegistros(registros: readonly RegistroAfetado[]): Promise<RegistroComNome[]> {
  return Promise.all(
    registros.map(async (registro) => {
      const destino = REGISTROS_VINCULAVEIS[registro.tipo];
      return { ...registro, rotulo: destino?.rotulo ?? registro.tipo, nome: await nomeDoRegistro(registro.tipo, registro.id), href: destino?.href(registro.id) ?? null };
    }),
  );
}

/** A decisão que esta substituiu, se houver. */
export const decisaoSubstituida = (decisaoId: string, decisoes: readonly Decisao[]) => decisoes.find((decisao) => decisao.substituida_por_id === decisaoId) ?? null;

export type FiltrosDecisoes = { busca: string; situacao: string; contexto: string; area: string };
export const FILTROS_DECISOES_INICIAIS: FiltrosDecisoes = { busca: '', situacao: '', contexto: '', area: '' };

export function filtrarDecisoes(decisoes: readonly Decisao[], { busca, situacao, contexto, area }: FiltrosDecisoes): Decisao[] {
  const termo = busca.trim().toLocaleLowerCase('pt-BR');
  return decisoes
    .filter((decisao) => (!termo || `${decisao.codigo} ${decisao.titulo} ${decisao.descricao}`.toLocaleLowerCase('pt-BR').includes(termo)) && (!situacao || decisao.situacao === situacao) && (!contexto || (contexto === 'numa' ? !decisao.produto_id : decisao.produto_id === contexto)) && (!area || decisao.area_id === area))
    .sort((a, b) => b.data.localeCompare(a.data) || b.codigo.localeCompare(a.codigo));
}

export type OpcoesDeRegistro = { tipo: string; rotulo: string; itens: { id: string; nome: string }[] };

/** O que uma decisão pode afetar (T06.09): os registros que já existem na Central. */
export async function opcoesDeRegistros(): Promise<OpcoesDeRegistro[]> {
  const [produtos, ferramentas, ativos, acordos, contratos] = await Promise.all([repositorios.produto.listar(), repositorios.ferramenta.listar(), repositorios.ativo_digital.listar(), repositorios.acordo_societario.listar(), repositorios.contrato.listar()]);
  return [
    { tipo: 'produto', rotulo: 'Produto', itens: produtos.map((item) => ({ id: item.id, nome: item.nome })) },
    { tipo: 'ferramenta', rotulo: 'Ferramenta', itens: ferramentas.map((item) => ({ id: item.id, nome: item.nome })) },
    { tipo: 'ativo_digital', rotulo: 'Ativo digital', itens: ativos.map((item) => ({ id: item.id, nome: item.identificador })) },
    { tipo: 'acordo_societario', rotulo: 'Acordo societário', itens: acordos.map((item) => ({ id: item.id, nome: item.titulo })) },
    { tipo: 'contrato', rotulo: 'Contrato', itens: contratos.map((item) => ({ id: item.id, nome: item.titulo })) },
  ].filter((grupo) => grupo.itens.length > 0);
}
