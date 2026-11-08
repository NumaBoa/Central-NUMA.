/**
 * T12.06 Horas (RN-12.12), antecipada para a F1 (D20): o apontamento alimenta as horas do simulador do M07,
 * a referência histórica (RN-12.06) e a rentabilidade do sob medida. Sem fechamento de competência nesta
 * etapa (T05.10 ainda não existe), a edição é livre.
 */
import { z } from 'zod';
import { ErroDeRegra } from '@/dados/erros';
import { repositorios } from '@/dados/repositorios';
import type { Atividade } from '@/dados/tipos/atividade';
import type { Contrato, ItemContrato } from '@/dados/tipos/contrato';
import type { Produto } from '@/dados/tipos/marca';
import type { ApontamentoHoras, Implantacao, SolicitacaoSuporte } from '@/dados/tipos/operacao';
import { REGISTROS_DAS_HORAS } from '@/dados/tipos/operacao';
import type { Pessoa } from '@/dados/tipos/pessoa';
import type { Titulo } from '@/dados/tipos/titulo';
import { hojeISO } from '@/lib/datas';
import { estaAberta } from './atividades';
import { ID_INSTITUCIONAL } from './contextos';
import { somarDias } from './repeticao';

export type RegistroDasHoras = (typeof REGISTROS_DAS_HORAS)[number];

export const ROTULOS_REGISTRO_HORAS: Readonly<Record<RegistroDasHoras, string>> = { implantacao: 'Implantação', contrato: 'Contrato', solicitacao_suporte: 'Solicitação de suporte', atividade: 'Atividade' };

export const HREF_DO_REGISTRO: Readonly<Record<RegistroDasHoras, (id: string) => string>> = {
  implantacao: (id) => `/operacao/${id}`,
  contrato: (id) => `/contratos/${id}`,
  solicitacao_suporte: (id) => `/operacao/suporte/${id}`,
  atividade: (id) => `/meu-dia?atividade=${id}`,
};

const arredondar = (valor: number) => Math.round((valor + Number.EPSILON) * 100) / 100;

/** "1,5", "1.5", "1:30" ou "1h30": a resposta em horas. Vazio é `null`; o que não se lê é `NaN`. */
export function lerHoras(texto: string): number | null {
  const limpo = texto.trim().toLowerCase().replace(/\s+/g, '');
  if (!limpo) return null;
  const relogio = /^(\d{1,2})(?::|h)(\d{1,2})?(?:min|m)?$/.exec(limpo);
  if (relogio) {
    const minutos = Number(relogio[2] ?? 0);
    return minutos >= 60 ? Number.NaN : Number(relogio[1]) + minutos / 60;
  }
  if (/^\d+([.,]\d+)?h?$/.test(limpo)) return Number(limpo.replace('h', '').replace(',', '.'));
  return Number.NaN;
}

export function formatarHoras(horas: number): string {
  return `${horas.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} h`;
}

export const MENSAGEM_QUARTOS = 'Use múltiplos de 15 minutos: 0,25, 0,5, 1,75…';

export const esquemaFormularioHoras = z
  .object({
    data: z.string().min(1, 'Informe a data.'),
    horas: z.string().trim().min(1, 'Informe as horas.'),
    contexto: z.string().min(1, 'Escolha o contexto.'),
    vinculo: z.string(),
    descricao: z.string().trim().max(500, 'Até 500 caracteres.'),
  })
  .superRefine((dados, contexto) => {
    const horas = lerHoras(dados.horas);
    if (horas === null) return;
    if (Number.isNaN(horas) || horas <= 0) contexto.addIssue({ code: 'custom', path: ['horas'], message: 'Use um número de horas, como 1,5 ou 1:30.' });
    else if (horas > 24) contexto.addIssue({ code: 'custom', path: ['horas'], message: 'Um apontamento vai até 24 horas.' });
    else if (!Number.isInteger(arredondar(horas * 4))) contexto.addIssue({ code: 'custom', path: ['horas'], message: MENSAGEM_QUARTOS });
  });
export type FormularioHoras = z.infer<typeof esquemaFormularioHoras>;

export function formularioHorasVazio(hoje: string, vinculo = '', contexto = ''): FormularioHoras {
  return { data: hoje, horas: '', contexto, vinculo, descricao: '' };
}

const textoDasHoras = (horas: number) => horas.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

export function formularioDoApontamento(apontamento: ApontamentoHoras): FormularioHoras {
  return { data: apontamento.data, horas: textoDasHoras(apontamento.horas), contexto: apontamento.produto_id ?? ID_INSTITUCIONAL, vinculo: apontamento.registro_tipo && apontamento.registro_id ? `${apontamento.registro_tipo}:${apontamento.registro_id}` : '', descricao: apontamento.descricao ?? '' };
}

/** "Repetir último": tudo do último apontamento, menos a data, que vira hoje. */
export function repetirApontamento(ultimo: ApontamentoHoras, hoje: string): FormularioHoras {
  return { ...formularioDoApontamento(ultimo), data: hoje };
}

// ---------- Vínculos ----------

export type OpcaoDeVinculo = { valor: string; tipo: RegistroDasHoras; id: string; rotulo: string; produtos: string[] };

export type DadosDosVinculos = { implantacoes: Implantacao[]; contratos: Contrato[]; itens: ItemContrato[]; solicitacoes: SolicitacaoSuporte[]; atividades: Atividade[]; produtosDasAtividades: { atividade_id: string; produto_id: string }[]; produtos: Produto[] };

/** Os produtos de um contrato: os dos itens da versão vigente (ou da última). */
export function produtosDoContrato(contrato: Pick<Contrato, 'versao_vigente_id' | 'versao_elaboracao_id'>, itens: readonly Pick<ItemContrato, 'versao_id' | 'produto_id'>[]): string[] {
  const versao = contrato.versao_vigente_id ?? contrato.versao_elaboracao_id;
  return [...new Set(itens.filter((item) => item.versao_id === versao && item.produto_id).map((item) => item.produto_id as string))];
}

/**
 * O que dá para vincular: implantações e solicitações não canceladas, contratos não cancelados e atividades
 * abertas ou concluídas nos últimos 30 dias (horas costumam ser apontadas depois de concluir).
 */
export function opcoesDeVinculo(dados: DadosDosVinculos, hoje: string, manter?: string): OpcaoDeVinculo[] {
  const nomeDoProduto = (id: string) => dados.produtos.find((produto) => produto.id === id)?.nome ?? 'Produto removido';
  const opcoes: OpcaoDeVinculo[] = [
    ...dados.implantacoes.filter((linha) => linha.situacao !== 'cancelada').map((linha) => ({ valor: `implantacao:${linha.id}`, tipo: 'implantacao' as const, id: linha.id, rotulo: `${linha.codigo} · ${nomeDoProduto(linha.produto_id)}`, produtos: [linha.produto_id] })),
    ...dados.contratos.filter((linha) => linha.situacao_documental !== 'cancelado').map((linha) => ({ valor: `contrato:${linha.id}`, tipo: 'contrato' as const, id: linha.id, rotulo: `${linha.codigo} · ${linha.titulo}`, produtos: produtosDoContrato(linha, dados.itens) })),
    ...dados.solicitacoes.filter((linha) => linha.situacao !== 'cancelada').map((linha) => ({ valor: `solicitacao_suporte:${linha.id}`, tipo: 'solicitacao_suporte' as const, id: linha.id, rotulo: `${linha.codigo} · ${linha.titulo}`, produtos: [linha.produto_id] })),
    ...dados.atividades
      .filter((linha) => linha.tipo !== 'alerta' && linha.tipo !== 'lembrete' && (estaAberta(linha) || (linha.situacao === 'concluida' && Boolean(linha.concluida_em) && (linha.concluida_em as string).slice(0, 10) >= somarDias(hoje, -30))))
      .map((linha) => ({ valor: `atividade:${linha.id}`, tipo: 'atividade' as const, id: linha.id, rotulo: `${linha.codigo} · ${linha.titulo}`, produtos: dados.produtosDasAtividades.filter((ligacao) => ligacao.atividade_id === linha.id).map((ligacao) => ligacao.produto_id) })),
  ];
  // O vínculo de um apontamento antigo continua aparecendo, mesmo que o registro já não entre na lista.
  if (manter && !opcoes.some((opcao) => opcao.valor === manter)) {
    const [tipo, id] = manter.split(':') as [RegistroDasHoras, string];
    opcoes.push({ valor: manter, tipo, id, rotulo: `${ROTULOS_REGISTRO_HORAS[tipo] ?? 'Registro'} (encerrado ou removido)`, produtos: [] });
  }
  return opcoes;
}

export async function carregarVinculos(): Promise<DadosDosVinculos> {
  const [implantacoes, contratos, itens, solicitacoes, atividades, produtosDasAtividades, produtos] = await Promise.all([repositorios.implantacao.listar(), repositorios.contrato.listar(), repositorios.item_contrato.listar(), repositorios.solicitacao_suporte.listar(), repositorios.atividade.listar(), repositorios.atividade_produto.listar(), repositorios.produto.listar({ incluirArquivados: true })]);
  return { implantacoes, contratos, itens, solicitacoes, atividades, produtosDasAtividades, produtos };
}

/** O contexto acompanha o vínculo: com um produto só, é ele; com vários, um deles. */
export function contextoSugerido(opcao: OpcaoDeVinculo | undefined): string | null {
  return opcao && opcao.produtos.length === 1 ? (opcao.produtos[0] as string) : null;
}

export function erroDoContexto(opcao: OpcaoDeVinculo | undefined, contexto: string, produtos: readonly Pick<Produto, 'id' | 'nome'>[]): string | null {
  if (!opcao || !opcao.produtos.length || opcao.produtos.includes(contexto)) return null;
  const nomes = opcao.produtos.map((id) => produtos.find((produto) => produto.id === id)?.nome ?? 'produto removido');
  return nomes.length === 1 ? `O vínculo é de ${nomes[0]}: o contexto precisa ser o mesmo.` : `O vínculo é de ${nomes.join(', ')}: escolha um desses produtos.`;
}

// ---------- Gravar ----------

export async function salvarApontamento(formulario: FormularioHoras, pessoaId: string, id?: string, hoje: string = hojeISO()): Promise<ApontamentoHoras> {
  const dados = esquemaFormularioHoras.parse(formulario);
  if (!pessoaId) throw new ErroDeRegra('Escolha quem você é, no topo, para apontar horas.');
  if (dados.data > hoje) throw new ErroDeRegra('Aponte só o que já foi feito: a data vai até hoje.');
  const horas = lerHoras(dados.horas) as number;
  const [tipo, registroId] = dados.vinculo ? (dados.vinculo.split(':') as [RegistroDasHoras, string]) : [null, null];
  if (tipo && !REGISTROS_DAS_HORAS.includes(tipo)) throw new ErroDeRegra('Vínculo desconhecido.');
  const vinculos = await carregarVinculos();
  const atual = id ? await repositorios.apontamento_horas.obter(id) : null;
  if (id && !atual) throw new ErroDeRegra('Este apontamento não existe mais.');
  const opcao = opcoesDeVinculo(vinculos, hoje, atual?.registro_tipo ? `${atual.registro_tipo}:${atual.registro_id}` : undefined).find((linha) => linha.valor === dados.vinculo);
  if (dados.vinculo && !opcao) throw new ErroDeRegra('O registro do vínculo não está mais disponível.');
  const contexto = dados.contexto === ID_INSTITUCIONAL ? null : dados.contexto;
  if (contexto && !vinculos.produtos.some((produto) => produto.id === contexto)) throw new ErroDeRegra('Escolha um produto que exista.');
  const erro = erroDoContexto(opcao, dados.contexto, vinculos.produtos);
  if (erro) throw new ErroDeRegra(erro);
  const registro = { pessoa_id: atual?.pessoa_id ?? pessoaId, data: dados.data, horas: arredondar(horas), produto_id: contexto, registro_tipo: tipo, registro_id: registroId, descricao: dados.descricao || null };
  return atual ? repositorios.apontamento_horas.atualizar(atual.id, registro) : repositorios.apontamento_horas.criar(registro);
}

export async function removerApontamento(id: string): Promise<void> {
  const atual = await repositorios.apontamento_horas.obter(id);
  if (!atual) throw new ErroDeRegra('Este apontamento não existe mais.');
  await repositorios.apontamento_horas.arquivar(id);
}

export async function ultimoApontamento(pessoaId: string): Promise<ApontamentoHoras | null> {
  const linhas = await repositorios.apontamento_horas.listar({ onde: { pessoa_id: pessoaId } });
  return [...linhas].sort((a, b) => b.criado_em.localeCompare(a.criado_em))[0] ?? null;
}

// ---------- Relatórios ----------

export const somarHoras = (linhas: readonly Pick<ApontamentoHoras, 'horas'>[]) => arredondar(linhas.reduce((total, linha) => total + linha.horas, 0));

export const mesDoApontamento = (linha: Pick<ApontamentoHoras, 'data'>) => linha.data.slice(0, 7);

/** Pessoa × produto num mês (T12.06): só as linhas e colunas que têm horas. */
export function horasPorPessoaEProduto(linhas: readonly ApontamentoHoras[], mes: string) {
  const doMes = linhas.filter((linha) => !linha.arquivado_em && mesDoApontamento(linha) === mes);
  const pessoas = [...new Set(doMes.map((linha) => linha.pessoa_id))];
  const contextos = [...new Set(doMes.map((linha) => linha.produto_id ?? ID_INSTITUCIONAL))];
  const celula = (pessoa: string, contexto: string) => somarHoras(doMes.filter((linha) => linha.pessoa_id === pessoa && (linha.produto_id ?? ID_INSTITUCIONAL) === contexto));
  return {
    pessoas,
    contextos,
    celula,
    totalDaPessoa: (pessoa: string) => somarHoras(doMes.filter((linha) => linha.pessoa_id === pessoa)),
    totalDoContexto: (contexto: string) => somarHoras(doMes.filter((linha) => (linha.produto_id ?? ID_INSTITUCIONAL) === contexto)),
    total: somarHoras(doMes),
  };
}

/** As horas de um registro: o que foi apontado nele e, no contrato, também nas implantações e solicitações dele. */
export function horasDoRegistro(linhas: readonly ApontamentoHoras[], tipo: RegistroDasHoras, id: string, ligados: { implantacoes?: readonly Pick<Implantacao, 'id' | 'contrato_id'>[]; solicitacoes?: readonly Pick<SolicitacaoSuporte, 'id' | 'contrato_id'>[] } = {}): ApontamentoHoras[] {
  const validas = linhas.filter((linha) => !linha.arquivado_em);
  if (tipo !== 'contrato') return validas.filter((linha) => linha.registro_tipo === tipo && linha.registro_id === id);
  const implantacoes = new Set((ligados.implantacoes ?? []).filter((linha) => linha.contrato_id === id).map((linha) => linha.id));
  const solicitacoes = new Set((ligados.solicitacoes ?? []).filter((linha) => linha.contrato_id === id).map((linha) => linha.id));
  return validas.filter((linha) => (linha.registro_tipo === 'contrato' && linha.registro_id === id) || (linha.registro_tipo === 'implantacao' && implantacoes.has(linha.registro_id ?? '')) || (linha.registro_tipo === 'solicitacao_suporte' && solicitacoes.has(linha.registro_id ?? '')));
}

export type HorasEReceita = { contrato: Contrato; horas: number; receitaContratada: number | null; recebido: number; porHora: number | null; semValor: number };

/**
 * Horas × receita do contrato (T12.06, 🔒 FIN; sem permissões nesta etapa, D27). A receita é a dos títulos
 * a receber do contrato, sem os cancelados: o contratado, e o recebido pelas baixas. Sem horas, não há "por hora".
 */
export function horasEReceita(contrato: Contrato, horas: number, titulos: readonly Titulo[], recebidoPorTitulo: (titulo: Titulo) => number): HorasEReceita {
  const validos = titulos.filter((titulo) => titulo.natureza === 'receber' && titulo.situacao !== 'cancelado' && !titulo.arquivado_em);
  const receitaContratada = validos.length ? arredondar(validos.reduce((total, titulo) => total + titulo.valor, 0)) : null;
  const recebido = arredondar(validos.reduce((total, titulo) => total + recebidoPorTitulo(titulo), 0));
  return { contrato, horas, receitaContratada, recebido, porHora: receitaContratada !== null && horas > 0 ? arredondar(receitaContratada / horas) : null, semValor: 0 };
}

/** O mês de `dia` e os anteriores, como aaaa-mm. */
export function mesesAntes(dia: string, quantos: number): string[] {
  const [ano, mes] = dia.split('-').map(Number) as [number, number];
  return Array.from({ length: quantos }, (_, indice) => {
    const total = ano * 12 + (mes - 1) - (indice + 1);
    return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
  });
}

export type MediaApontada = { media: number | null; mesesComHoras: number; meses: string[] };

/**
 * H do simulador (D20 e M07 §4): a média mensal apontada no produto nos 3 meses completos antes do atual,
 * só com os meses que têm apontamento, como o custo médio (RN-07.11). Sem apontamento, não há média.
 */
export function mediaMensalApontada(linhas: readonly Pick<ApontamentoHoras, 'data' | 'horas' | 'produto_id' | 'arquivado_em'>[], produtoId: string | null, hoje: string): MediaApontada {
  const meses = mesesAntes(hoje, 3);
  const doProduto = linhas.filter((linha) => !linha.arquivado_em && (linha.produto_id ?? null) === produtoId);
  const porMes = meses.map((mes) => doProduto.filter((linha) => linha.data.slice(0, 7) === mes)).filter((lista) => lista.length);
  if (!porMes.length) return { media: null, mesesComHoras: 0, meses };
  return { media: arredondar(porMes.reduce((total, lista) => total + somarHoras(lista), 0) / porMes.length), mesesComHoras: porMes.length, meses };
}

export async function mediaApontadaDoProduto(produtoId: string, hoje: string = hojeISO()): Promise<MediaApontada> {
  return mediaMensalApontada(await repositorios.apontamento_horas.listar(), produtoId, hoje);
}

// ---------- Tela ----------

export type DadosDasHoras = DadosDosVinculos & { apontamentos: ApontamentoHoras[]; pessoas: Pessoa[]; titulos: Titulo[]; recebidos: Map<string, number> };

export async function carregarHoras(): Promise<DadosDasHoras> {
  const [vinculos, apontamentos, pessoas, titulos, baixas] = await Promise.all([carregarVinculos(), repositorios.apontamento_horas.listar(), repositorios.pessoa.listar({ incluirArquivados: true }), repositorios.titulo.listar({ onde: { origem: 'contrato' } }), repositorios.baixa.listar()]);
  const recebidos = new Map<string, number>();
  for (const baixa of baixas) {
    if (baixa.tipo === 'ajuste') continue;
    recebidos.set(baixa.titulo_id, arredondar((recebidos.get(baixa.titulo_id) ?? 0) + (baixa.tipo === 'estorno' ? -baixa.valor_moeda : baixa.valor_moeda)));
  }
  return { ...vinculos, apontamentos, pessoas, titulos, recebidos };
}
