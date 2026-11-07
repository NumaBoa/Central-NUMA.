/** Regras de T03.05 (05-M03): rotinas e suas ocorrências (RN-03.15 a RN-03.18). */
import { z } from 'zod';
import { ErroDeRegra } from '@/dados/erros';
import { ID_ROTINA_BACKUP } from '@/dados/exemplos/base';
import { repositorios } from '@/dados/repositorios';
import { emTransacao } from '@/dados/transacao';
import { parDoVinculo } from '@/dados/tipos/apoio';
import type { Area } from '@/dados/tipos/area';
import type { Atividade } from '@/dados/tipos/atividade';
import type { Marca, Produto } from '@/dados/tipos/marca';
import type { Pessoa } from '@/dados/tipos/pessoa';
import type { ModeloDaRecorrencia, Recorrencia } from '@/dados/tipos/recorrencia';
import { hojeISO, instanteNoFuso } from '@/lib/datas';
import { cancelarAtividade, estaAberta, MAXIMO_NO_TITULO, MINHAS, passaNoContexto, prazoEfetivo } from './atividades';
import { definirContextos, definirParticipantes } from './atividades-painel';
import { ID_CONSOLIDADA, ID_INSTITUCIONAL } from './contextos';
import { FASES, type Fase } from './navegacao';
import { linkDoDriveValido, MENSAGEM_LINK_DRIVE } from './link-drive';
import { normalizarTexto } from './duplicidade';
import { datasDaRegra, errosDaRepeticao, esquemaCamposRepeticao, formularioDaRegra, mesmaAgenda, proximaData, proximasDatas, regraDoFormulario, regraPorExtenso, repeticaoPadrao, somarDias, type RegraDeRepeticao } from './repeticao';
import { AVISO_CREDENCIAL, pareceCredencial } from './segredos';

/** RN-03.15: até 30 dias à frente. */
export const DIAS_A_FRENTE = 30;

export const ROTULOS_SITUACAO_ROTINA = { ativa: 'Ativa', pausada: 'Pausada', encerrada: 'Encerrada' } as const;

export const chaveDaOcorrencia = (rotinaId: string, data: string) => `recorrencia:${rotinaId}:${data}`;

export function modeloVazio(tipo: ModeloDaRecorrencia['tipo'] = 'tarefa'): ModeloDaRecorrencia {
  return { tipo, descricao: null, area_id: null, prioridade: 'normal', produtos: [], participantes: [], solicitante_pessoa_id: null, solicitante_texto: null, resultado_esperado: null, checklist: [], vinculos: [], arquivos: [] };
}

// ---------- Gerar ocorrências (RN-03.15) ----------

/** O que ainda existe: área, produto ou pessoa arquivados não entram nas próximas ocorrências. */
type Ativos = { areas: ReadonlySet<string>; produtos: ReadonlySet<string>; pessoas: ReadonlySet<string> };

async function lerAtivos(): Promise<Ativos> {
  const [areas, produtos, pessoas] = await Promise.all([repositorios.area.listar(), repositorios.produto.listar(), repositorios.pessoa.listar()]);
  return { areas: new Set(areas.map((area) => area.id)), produtos: new Set(produtos.map((produto) => produto.id)), pessoas: new Set(pessoas.map((pessoa) => pessoa.id)) };
}

function datasDaOcorrencia(rotina: Pick<Recorrencia, 'hora' | 'modelo'>, data: string): Pick<Atividade, 'prazo' | 'prazo_hora' | 'aviso_em'> {
  if (rotina.modelo.tipo === 'lembrete') return { prazo: null, prazo_hora: null, aviso_em: instanteNoFuso(data, rotina.hora ?? '09:00') };
  return { prazo: data, prazo_hora: rotina.hora, aviso_em: null };
}

function camposDoModelo(rotina: Pick<Recorrencia, 'titulo' | 'responsavel_id' | 'modelo'>, ativos: Ativos) {
  const { modelo } = rotina;
  return {
    tipo: modelo.tipo,
    titulo: rotina.titulo,
    descricao: modelo.descricao,
    area_id: modelo.area_id && ativos.areas.has(modelo.area_id) ? modelo.area_id : null,
    responsavel_id: rotina.responsavel_id,
    prioridade: modelo.prioridade,
    solicitante_pessoa_id: modelo.tipo === 'demanda' ? modelo.solicitante_pessoa_id : null,
    solicitante_texto: modelo.tipo === 'demanda' ? modelo.solicitante_texto : null,
    resultado_esperado: modelo.tipo === 'demanda' ? modelo.resultado_esperado : null,
  };
}

async function criarOcorrencia(rotina: Recorrencia, data: string, numero: number, ativos: Ativos): Promise<Atividade> {
  const { modelo, exemplo } = rotina;
  const atividade = await repositorios.atividade.criar({
    ...camposDoModelo(rotina, ativos),
    ...datasDaOcorrencia(rotina, data),
    situacao: 'a_fazer',
    bloqueada: false,
    bloqueio_motivo: null,
    bloqueada_em: null,
    inicio: null,
    aguardando_de_pessoa_id: null,
    aguardando_de_texto: null,
    aguardando_desde: null,
    acompanhamento_em: null,
    recorrencia_id: rotina.id,
    ocorrencia_numero: numero,
    ocorrencia_data: data,
    editada_individualmente: false,
    origem_tipo: null,
    origem_id: null,
    alerta_motivo: null,
    alerta_data_referencia: null,
    alerta_acao: null,
    chave_idempotencia: chaveDaOcorrencia(rotina.id, data),
    adiamentos: 0,
    concluida_em: null,
    concluida_por: null,
    conclusao_nota: null,
    cancelada_motivo: null,
    dispensada_motivo: null,
    exemplo,
  });
  for (const produto_id of modelo.produtos.filter((id) => ativos.produtos.has(id))) await repositorios.atividade_produto.criar({ atividade_id: atividade.id, produto_id, exemplo });
  for (const pessoa_id of modelo.participantes.filter((id) => id !== rotina.responsavel_id && ativos.pessoas.has(id))) await repositorios.atividade_participante.criar({ atividade_id: atividade.id, pessoa_id, exemplo });
  let ordem = 0;
  for (const texto of modelo.checklist) await repositorios.checklist_item.criar({ registro_tipo: 'atividade', registro_id: atividade.id, ordem: ordem++, texto, responsavel_id: null, feito: false, feito_por: null, feito_em: null, exemplo });
  for (const destino of modelo.vinculos) await repositorios.vinculo.criar({ ...parDoVinculo({ tipo: 'atividade', id: atividade.id }, destino), exemplo });
  for (const url of modelo.arquivos) await repositorios.anexo_link.criar({ registro_tipo: 'atividade', registro_id: atividade.id, titulo: 'Arquivo do Drive', url, exemplo });
  return atividade;
}

/** As datas de hoje até o fim da janela que ainda não viraram atividade. A chave nunca volta a ser usada (RT-09). */
async function gerarDaRotina(rotina: Recorrencia, hoje: string, chaves: Set<string>, ativos: Ativos): Promise<number> {
  const datas = datasDaRegra(rotina, somarDias(hoje, DIAS_A_FRENTE));
  let novas = 0;
  for (const [indice, data] of datas.entries()) {
    const chave = chaveDaOcorrencia(rotina.id, data);
    if (data < hoje || chaves.has(chave)) continue;
    await criarOcorrencia(rotina, data, indice + 1, ativos);
    chaves.add(chave);
    novas += 1;
  }
  return novas;
}

export const faseAlcancada = (rotina: Pick<Recorrencia, 'fase_minima'>, faseAtiva: Fase) => !rotina.fase_minima || FASES.indexOf(rotina.fase_minima) <= FASES.indexOf(faseAtiva);

async function chavesExistentes(): Promise<Set<string>> {
  const atividades = await repositorios.atividade.listar({ incluirArquivados: true });
  return new Set(atividades.flatMap((atividade) => (atividade.chave_idempotencia ? [atividade.chave_idempotencia] : [])));
}

/**
 * A rotina do dia `gerar_ocorrencias` (02 §8). Rodar duas vezes não duplica (CA-03.09): o que já foi
 * gerado continua como está, inclusive o que foi concluído, cancelado ou editado.
 */
export async function gerarOcorrencias(hoje: string = hojeISO()): Promise<number> {
  const { fase_ativa } = await repositorios.configuracao.ler();
  const rotinas = (await repositorios.recorrencia.listar({ onde: { situacao: 'ativa' } })).filter((rotina) => faseAlcancada(rotina, fase_ativa));
  if (!rotinas.length) return 0;
  return emTransacao(async () => {
    const [chaves, ativos] = await Promise.all([chavesExistentes(), lerAtivos()]);
    let novas = 0;
    for (const rotina of rotinas) {
      novas += await gerarDaRotina(rotina, hoje, chaves, ativos);
      if (proximaData(rotina, hoje) === null) await repositorios.recorrencia.atualizar(rotina.id, { situacao: 'encerrada' });
    }
    return novas;
  });
}

// ---------- Criar ----------

export type DadosDaRotina = { titulo: string; responsavel_id: string; modelo: ModeloDaRecorrencia; regra: RegraDeRepeticao };

/**
 * A primeira ocorrência nasce já, mesmo fora da janela de 30 dias: quem acabou de criar precisa ver
 * o item aparecer (T03.03). As demais vêm com a janela.
 */
async function nascerComPrimeira(rotina: Recorrencia, hoje: string): Promise<Atividade | null> {
  const ativos = await lerAtivos();
  const chaves = await chavesExistentes();
  const primeiraData = proximaData(rotina, rotina.inicio > hoje ? rotina.inicio : hoje);
  if (!primeiraData) return null;
  const numero = datasDaRegra(rotina, primeiraData).length;
  const primeira = chaves.has(chaveDaOcorrencia(rotina.id, primeiraData)) ? null : await criarOcorrencia(rotina, primeiraData, numero, ativos);
  chaves.add(chaveDaOcorrencia(rotina.id, primeiraData));
  await gerarDaRotina(rotina, hoje, chaves, ativos);
  return primeira;
}

function novaRotina({ titulo, responsavel_id, modelo, regra }: DadosDaRotina, extras: Partial<Pick<Recorrencia, 'situacao' | 'substitui_id' | 'fase_minima' | 'exemplo'>> = {}) {
  return { titulo, responsavel_id, modelo, ...regra, situacao: 'ativa' as const, substitui_id: null, fase_minima: null, ...extras };
}

export async function criarRotina(dados: DadosDaRotina, hoje: string = hojeISO()): Promise<{ rotina: Recorrencia; primeira: Atividade | null }> {
  if (!proximaData(dados.regra, dados.regra.inicio)) throw new ErroDeRegra('Com esse fim, a rotina não teria nenhuma ocorrência.');
  return emTransacao(async () => {
    const rotina = await repositorios.recorrencia.criar(novaRotina(dados));
    return { rotina, primeira: await nascerComPrimeira(rotina, hoje) };
  });
}

// ---------- Editar a rotina ----------

const ehCandidataARefazer = (atividade: Atividade) => atividade.situacao === 'a_fazer' && !atividade.bloqueada && !atividade.editada_individualmente;

async function ocorrenciasAbertas(rotinaId: string, desde: string): Promise<Atividade[]> {
  const delas = await repositorios.atividade.listar({ onde: { recorrencia_id: rotinaId } });
  return delas.filter((atividade) => estaAberta(atividade) && (atividade.ocorrencia_data ?? '') >= desde);
}

async function trocarLigacoes(atividadeId: string, modelo: ModeloDaRecorrencia, responsavelId: string, ativos: Ativos): Promise<void> {
  await definirContextos(atividadeId, modelo.produtos.filter((id) => ativos.produtos.has(id)));
  await definirParticipantes(atividadeId, modelo.participantes.filter((id) => id !== responsavelId && ativos.pessoas.has(id)));
}

/** A rotina do backup e a configuração de T02.01 dizem a mesma coisa: quem muda uma, muda a outra. */
async function alinharConfiguracaoDoBackup(rotinaId: string, responsavelId: string): Promise<void> {
  if (rotinaId !== ID_ROTINA_BACKUP) return;
  const { responsavel_backup_id } = await repositorios.configuracao.ler();
  if (responsavel_backup_id !== responsavelId) await repositorios.configuracao.salvar({ responsavel_backup_id: responsavelId });
}

/**
 * Sem mudar a agenda, o que muda vale para a própria rotina e para as próximas ocorrências que
 * ninguém editou à parte. Mudando a agenda, a regra atual encerra e nasce outra (RN-03.17).
 * Ocorrências passadas nunca mudam.
 */
export async function editarRotina(id: string, dados: DadosDaRotina, hoje: string = hojeISO()): Promise<Recorrencia> {
  const atual = await repositorios.recorrencia.obter(id);
  if (!atual) throw new ErroDeRegra('Esta rotina não existe mais.');
  if (atual.situacao === 'encerrada') throw new ErroDeRegra('Esta rotina está encerrada.');
  return emTransacao(async () => {
    await alinharConfiguracaoDoBackup(id, dados.responsavel_id);
    if (mesmaAgenda(atual, dados.regra)) {
      const rotina = await repositorios.recorrencia.atualizar(id, { titulo: dados.titulo, responsavel_id: dados.responsavel_id, modelo: dados.modelo });
      const ativos = await lerAtivos();
      for (const atividade of await ocorrenciasAbertas(id, hoje)) {
        if (atividade.editada_individualmente) continue;
        await repositorios.atividade.atualizar(atividade.id, camposDoModelo(rotina, ativos));
        await trocarLigacoes(atividade.id, rotina.modelo, rotina.responsavel_id, ativos);
      }
      return rotina;
    }
    const inicio = dados.regra.inicio > hoje ? dados.regra.inicio : hoje;
    const regra = { ...dados.regra, inicio };
    if (!proximaData(regra, inicio)) throw new ErroDeRegra('Com esse fim, a rotina não teria nenhuma ocorrência.');
    await repositorios.recorrencia.atualizar(id, { situacao: 'encerrada', fim_data: somarDias(inicio, -1) });
    const nova = await repositorios.recorrencia.criar(novaRotina({ ...dados, regra }, { situacao: atual.situacao, substitui_id: id, fase_minima: atual.fase_minima, exemplo: atual.exemplo }));
    const datasNovas = datasDaRegra(regra, somarDias(hoje, 400));
    for (const atividade of await ocorrenciasAbertas(id, inicio)) {
      if (ehCandidataARefazer(atividade)) {
        await repositorios.atividade.arquivar(atividade.id, 'Rotina alterada');
        continue;
      }
      // Quem já foi mexida fica, e assume a data dela na regra nova quando existir.
      const posicao = datasNovas.indexOf(atividade.ocorrencia_data ?? '');
      if (posicao >= 0) await repositorios.atividade.atualizar(atividade.id, { recorrencia_id: nova.id, ocorrencia_numero: posicao + 1, chave_idempotencia: chaveDaOcorrencia(nova.id, atividade.ocorrencia_data as string) });
    }
    if (nova.situacao === 'ativa') await nascerComPrimeira(nova, hoje);
    return nova;
  });
}

// ---------- Editar uma ocorrência (RN-03.17) ----------

export type EscopoDaEdicao = 'esta' | 'proximas';

export type CamposDaOcorrencia = Partial<Pick<Atividade, 'titulo' | 'descricao' | 'area_id' | 'prioridade' | 'responsavel_id' | 'solicitante_pessoa_id' | 'solicitante_texto' | 'resultado_esperado'>> & {
  produtos?: string[];
  participantes?: string[];
};

function separarLigacoes({ produtos, participantes, ...simples }: CamposDaOcorrencia) {
  return { simples, produtos, participantes };
}

/** Só mexe no que veio: um produto arquivado continua na atividade enquanto ninguém o tirar. */
async function aplicarNaOcorrencia(atividade: Atividade, campos: CamposDaOcorrencia, individual: boolean): Promise<void> {
  const { simples, produtos, participantes } = separarLigacoes(campos);
  await repositorios.atividade.atualizar(atividade.id, { ...simples, ...(individual ? { editada_individualmente: true } : {}) });
  if (produtos) await definirContextos(atividade.id, produtos);
  const responsavel = simples.responsavel_id ?? atividade.responsavel_id;
  if (participantes) await definirParticipantes(atividade.id, participantes.filter((id) => id !== responsavel));
  else if (simples.responsavel_id) {
    const ligados = await repositorios.atividade_participante.listar({ onde: { atividade_id: atividade.id, pessoa_id: responsavel } });
    for (const ligacao of ligados) await repositorios.atividade_participante.arquivar(ligacao.id);
  }
}

/**
 * "Somente esta" fica marcada, para a rotina não passar por cima dela. "Esta e as próximas" encerra a
 * regra na data e cria outra a partir dela; as anteriores não mudam.
 */
export async function editarOcorrencia(id: string, campos: CamposDaOcorrencia, escopo: EscopoDaEdicao): Promise<void> {
  const atividade = await repositorios.atividade.obter(id);
  if (!atividade) throw new ErroDeRegra('Esta atividade não existe mais.');
  if (!estaAberta(atividade)) throw new ErroDeRegra('Esta atividade está encerrada: reabra para mudar.');
  if (campos.titulo !== undefined) {
    const limpo = campos.titulo.trim();
    if (!limpo) throw new ErroDeRegra('Informe o título.');
    if (limpo.length > MAXIMO_NO_TITULO) throw new ErroDeRegra(`Use até ${MAXIMO_NO_TITULO} caracteres.`);
    campos = { ...campos, titulo: limpo };
  }
  await emTransacao(async () => {
    const rotina = atividade.recorrencia_id ? await repositorios.recorrencia.obter(atividade.recorrencia_id) : null;
    if (escopo === 'esta' || !rotina || !atividade.ocorrencia_data) {
      await aplicarNaOcorrencia(atividade, campos, Boolean(atividade.recorrencia_id));
      return;
    }
    const data = atividade.ocorrencia_data;
    const { simples, produtos, participantes } = separarLigacoes(campos);
    const modelo: ModeloDaRecorrencia = {
      ...rotina.modelo,
      ...(simples.descricao !== undefined ? { descricao: simples.descricao } : {}),
      ...(simples.area_id !== undefined ? { area_id: simples.area_id } : {}),
      ...(simples.prioridade ? { prioridade: simples.prioridade } : {}),
      ...(simples.solicitante_pessoa_id !== undefined ? { solicitante_pessoa_id: simples.solicitante_pessoa_id } : {}),
      ...(simples.solicitante_texto !== undefined ? { solicitante_texto: simples.solicitante_texto } : {}),
      ...(simples.resultado_esperado !== undefined ? { resultado_esperado: simples.resultado_esperado } : {}),
      ...(produtos ? { produtos } : {}),
      ...(participantes ? { participantes } : {}),
    };
    const restantes = rotina.fim_ocorrencias ? Math.max(1, rotina.fim_ocorrencias - ((atividade.ocorrencia_numero ?? 1) - 1)) : null;
    await repositorios.recorrencia.atualizar(rotina.id, { situacao: 'encerrada', fim_data: somarDias(data, -1) });
    const nova = await repositorios.recorrencia.criar({ titulo: simples.titulo ?? rotina.titulo, responsavel_id: simples.responsavel_id ?? rotina.responsavel_id, modelo, frequencia: rotina.frequencia, intervalo: rotina.intervalo, dias_semana: rotina.dias_semana, dia_mes: rotina.dia_mes, ultimo_dia: rotina.ultimo_dia, mes: rotina.mes, hora: rotina.hora, inicio: data, fim_data: rotina.fim_data, fim_ocorrencias: restantes, situacao: rotina.situacao, substitui_id: rotina.id, fase_minima: rotina.fase_minima, exemplo: rotina.exemplo });
    await alinharConfiguracaoDoBackup(rotina.id, nova.responsavel_id);
    const datas = datasDaRegra(nova, somarDias(data, 400));
    for (const outra of await ocorrenciasAbertas(rotina.id, data)) {
      const posicao = datas.indexOf(outra.ocorrencia_data ?? '');
      await repositorios.atividade.atualizar(outra.id, { recorrencia_id: nova.id, ...(posicao >= 0 ? { ocorrencia_numero: posicao + 1 } : {}), chave_idempotencia: chaveDaOcorrencia(nova.id, outra.ocorrencia_data as string) });
      if (outra.id === atividade.id || !outra.editada_individualmente) await aplicarNaOcorrencia({ ...outra, recorrencia_id: nova.id }, campos, false);
    }
  });
}

// ---------- Pausar e encerrar (RN-03.18) ----------

export async function pausarRotina(id: string): Promise<void> {
  await repositorios.recorrencia.atualizar(id, { situacao: 'pausada' });
}

export async function retomarRotina(id: string): Promise<void> {
  await repositorios.recorrencia.atualizar(id, { situacao: 'ativa' });
}

export async function quantasOcorrenciasFuturas(id: string, hoje: string = hojeISO()): Promise<number> {
  return (await ocorrenciasAbertas(id, hoje)).length;
}

/** Encerrar pergunta se cancela as ocorrências futuras abertas, com motivo. As de antes de hoje ficam. */
export async function encerrarRotina(id: string, { cancelarFuturas, motivo }: { cancelarFuturas: boolean; motivo: string }, hoje: string = hojeISO()): Promise<number> {
  const limpo = motivo.trim();
  if (cancelarFuturas && !limpo) throw new ErroDeRegra('Informe o motivo para cancelar as ocorrências.');
  return emTransacao(async () => {
    await repositorios.recorrencia.atualizar(id, { situacao: 'encerrada' }, limpo ? { motivo: limpo } : undefined);
    if (!cancelarFuturas) return 0;
    const futuras = await ocorrenciasAbertas(id, hoje);
    for (const atividade of futuras) await cancelarAtividade(atividade.id, limpo);
    return futuras.length;
  });
}

// ---------- Uma atividade passa a repetir ----------

/** A atividade vira a primeira ocorrência, na primeira data da regra; o resto vem com a janela. */
export async function repetirAtividade(id: string, regra: RegraDeRepeticao, hoje: string = hojeISO()): Promise<Recorrencia> {
  const atividade = await repositorios.atividade.obter(id);
  if (!atividade) throw new ErroDeRegra('Esta atividade não existe mais.');
  if (!estaAberta(atividade)) throw new ErroDeRegra('Esta atividade está encerrada: reabra para mudar.');
  if (atividade.recorrencia_id) throw new ErroDeRegra('Esta atividade já faz parte de uma rotina.');
  if (atividade.tipo === 'alerta') throw new ErroDeRegra('Alerta não repete: quem cria é o sistema.');
  const primeira = proximaData(regra, regra.inicio);
  if (!primeira) throw new ErroDeRegra('Com esse fim, a rotina não teria nenhuma ocorrência.');
  return emTransacao(async () => {
    const [produtos, participantes, itens, vinculos, anexos] = await Promise.all([
      repositorios.atividade_produto.listar({ onde: { atividade_id: id } }),
      repositorios.atividade_participante.listar({ onde: { atividade_id: id } }),
      repositorios.checklist_item.listar({ onde: { registro_id: id } }),
      repositorios.vinculo.listar(),
      repositorios.anexo_link.listar({ onde: { registro_id: id } }),
    ]);
    const modelo: ModeloDaRecorrencia = {
      tipo: atividade.tipo as ModeloDaRecorrencia['tipo'],
      descricao: atividade.descricao,
      area_id: atividade.area_id,
      prioridade: atividade.prioridade,
      produtos: produtos.map((ligacao) => ligacao.produto_id),
      participantes: participantes.map((ligacao) => ligacao.pessoa_id),
      solicitante_pessoa_id: atividade.solicitante_pessoa_id,
      solicitante_texto: atividade.solicitante_texto,
      resultado_esperado: atividade.resultado_esperado,
      checklist: itens.sort((a, b) => a.ordem - b.ordem).map((item) => item.texto),
      vinculos: vinculos.flatMap((vinculo) => {
        if (vinculo.origem_tipo === 'atividade' && vinculo.origem_id === id) return [{ tipo: vinculo.destino_tipo, id: vinculo.destino_id }];
        if (vinculo.destino_tipo === 'atividade' && vinculo.destino_id === id) return [{ tipo: vinculo.origem_tipo, id: vinculo.origem_id }];
        return [];
      }),
      arquivos: anexos.map((anexo) => anexo.url),
    };
    const rotina = await repositorios.recorrencia.criar(novaRotina({ titulo: atividade.titulo, responsavel_id: atividade.responsavel_id, modelo, regra }, { exemplo: atividade.exemplo }));
    await repositorios.atividade.atualizar(id, { ...datasDaOcorrencia(rotina, primeira), recorrencia_id: rotina.id, ocorrencia_numero: 1, ocorrencia_data: primeira, chave_idempotencia: chaveDaOcorrencia(rotina.id, primeira) });
    await gerarDaRotina(rotina, hoje, await chavesExistentes(), await lerAtivos());
    return rotina;
  });
}

// ---------- Formulário de T03.05 ----------

export const esquemaFormularioRotina = z.object({
  tipo: z.enum(['tarefa', 'demanda', 'lembrete']),
  titulo: z.string().trim().min(1, 'Informe o título.').max(MAXIMO_NO_TITULO, `Use até ${MAXIMO_NO_TITULO} caracteres.`),
  responsavel_id: z.string().min(1, 'Escolha a responsável.'),
  repeticao: esquemaCamposRepeticao,
  descricao: z.string().trim(),
  area_id: z.string(),
  contextos: z.array(z.string()),
  participantes: z.array(z.string()),
  prioridade: z.enum(['baixa', 'normal', 'alta', 'urgente']),
  solicitante: z.string(),
  solicitante_texto: z.string().trim(),
  resultado_esperado: z.string().trim(),
  checklist: z.string(),
  arquivo: z.string().trim(),
});

export type FormularioRotina = z.infer<typeof esquemaFormularioRotina>;

export const SOLICITANTE_OUTRA_ROTINA = 'outra';

/** Só na criação o início precisa ser de hoje em diante: uma rotina em uso já começou. */
export function esquemaDoFormularioRotina(minimoInicio?: string) {
  return esquemaFormularioRotina.superRefine((dados, contexto) => {
    const falha = (caminho: (string | number)[], message: string) => contexto.addIssue({ code: 'custom', path: caminho, message });
    for (const [campo, mensagem] of Object.entries(errosDaRepeticao(dados.repeticao, { lembrete: dados.tipo === 'lembrete', minimoInicio }))) falha(['repeticao', campo], mensagem);
    if (dados.tipo === 'demanda') {
      if (!dados.solicitante) falha(['solicitante'], 'Diga quem pediu.');
      else if (dados.solicitante === SOLICITANTE_OUTRA_ROTINA && !dados.solicitante_texto) falha(['solicitante_texto'], 'Escreva quem pediu.');
    }
    if (dados.arquivo && !linkDoDriveValido(dados.arquivo)) falha(['arquivo'], MENSAGEM_LINK_DRIVE);
  });
}

export function contextosDoGlobal(contextoGlobalId: string): string[] {
  return contextoGlobalId === ID_CONSOLIDADA || contextoGlobalId === ID_INSTITUCIONAL ? [] : [contextoGlobalId];
}

export function formularioRotinaVazio(pessoaId: string, contextoGlobalId: string, hoje: string = hojeISO()): FormularioRotina {
  return { tipo: 'tarefa', titulo: '', responsavel_id: pessoaId, repeticao: repeticaoPadrao(hoje), descricao: '', area_id: '', contextos: contextosDoGlobal(contextoGlobalId), participantes: [], prioridade: 'normal', solicitante: pessoaId, solicitante_texto: '', resultado_esperado: '', checklist: '', arquivo: '' };
}

export function formularioDaRotina(rotina: Recorrencia): FormularioRotina {
  const { modelo } = rotina;
  return {
    tipo: modelo.tipo,
    titulo: rotina.titulo,
    responsavel_id: rotina.responsavel_id,
    repeticao: formularioDaRegra(rotina),
    descricao: modelo.descricao ?? '',
    area_id: modelo.area_id ?? '',
    contextos: modelo.produtos,
    participantes: modelo.participantes,
    prioridade: modelo.prioridade,
    solicitante: modelo.solicitante_pessoa_id ?? (modelo.solicitante_texto ? SOLICITANTE_OUTRA_ROTINA : rotina.responsavel_id),
    solicitante_texto: modelo.solicitante_texto ?? '',
    resultado_esperado: modelo.resultado_esperado ?? '',
    checklist: modelo.checklist.join('\n'),
    arquivo: modelo.arquivos[0] ?? '',
  };
}

export function dadosDoFormularioRotina(formulario: FormularioRotina, rotinaAtual?: Recorrencia | null): DadosDaRotina {
  const demanda = formulario.tipo === 'demanda';
  const pessoa = demanda && formulario.solicitante !== SOLICITANTE_OUTRA_ROTINA ? formulario.solicitante : null;
  return {
    titulo: formulario.titulo,
    responsavel_id: formulario.responsavel_id,
    regra: regraDoFormulario(formulario.repeticao),
    modelo: {
      tipo: formulario.tipo,
      descricao: formulario.descricao || null,
      area_id: formulario.area_id || null,
      prioridade: formulario.prioridade,
      produtos: formulario.contextos,
      participantes: formulario.participantes.filter((id) => id !== formulario.responsavel_id),
      solicitante_pessoa_id: pessoa || null,
      solicitante_texto: demanda && !pessoa ? formulario.solicitante_texto || null : null,
      resultado_esperado: demanda ? formulario.resultado_esperado || null : null,
      checklist: formulario.checklist
        .split('\n')
        .map((linha) => linha.trim())
        .filter(Boolean),
      vinculos: rotinaAtual?.modelo.vinculos ?? [],
      arquivos: formulario.arquivo ? [formulario.arquivo, ...(rotinaAtual?.modelo.arquivos.slice(1) ?? [])] : (rotinaAtual?.modelo.arquivos.slice(1) ?? []),
    },
  };
}

/** Só avisam e deixam continuar (RT-14). */
export function avisosDaRotina(formulario: Pick<FormularioRotina, 'titulo' | 'descricao' | 'resultado_esperado' | 'checklist'>): readonly string[] {
  return [formulario.titulo, formulario.descricao, formulario.resultado_esperado, formulario.checklist].some(pareceCredencial) ? [AVISO_CREDENCIAL] : [];
}

// ---------- Carga de T03.05 ----------

export type LinhaDaRotina = Recorrencia & {
  /** A próxima data da regra que ainda não foi encerrada. */
  proxima: string | null;
  abertas: number;
  /** Rotina de uma fase que ainda não chegou (T03.05). */
  aguardaFase: Fase | null;
};

export type DadosDasRotinas = { rotinas: LinhaDaRotina[]; pessoas: Pessoa[]; areas: Area[]; produtos: Produto[]; marcas: Marca[]; hoje: string };

function linhaDaRotina(rotina: Recorrencia, ocorrencias: readonly Atividade[], hoje: string, faseAtiva: Fase): LinhaDaRotina {
  const delas = ocorrencias.filter((atividade) => atividade.recorrencia_id === rotina.id);
  const fechadas = new Set(delas.filter((atividade) => !estaAberta(atividade)).map((atividade) => atividade.ocorrencia_data));
  const espera = !faseAlcancada(rotina, faseAtiva);
  const proxima = rotina.situacao === 'ativa' && !espera ? (proximasDatas(rotina, hoje, 40).find((dia) => !fechadas.has(dia)) ?? null) : null;
  return { ...rotina, proxima, abertas: delas.filter(estaAberta).length, aguardaFase: espera ? rotina.fase_minima : null };
}

export async function carregarRotinas(hoje: string = hojeISO()): Promise<DadosDasRotinas> {
  const [rotinas, atividades, pessoas, areas, produtos, marcas, { fase_ativa }] = await Promise.all([
    repositorios.recorrencia.listar(),
    repositorios.atividade.listar(),
    repositorios.pessoa.listar({ incluirArquivados: true }),
    repositorios.area.listar({ incluirArquivados: true }),
    repositorios.produto.listar({ incluirArquivados: true }),
    repositorios.marca.listar({ incluirArquivados: true }),
    repositorios.configuracao.ler(),
  ]);
  return { rotinas: rotinas.map((rotina) => linhaDaRotina(rotina, atividades, hoje, fase_ativa)), pessoas, areas, produtos, marcas, hoje };
}

// ---------- Filtros de T03.05 (o mesmo padrão do Meu dia) ----------

export type PeriodoDaRotina = '' | 'hoje' | 'semana' | '30dias' | 'sem_proxima' | 'intervalo';
export const ROTULOS_PERIODO_ROTINA = { hoje: 'Hoje', semana: 'Esta semana', '30dias': 'Próximos 30 dias', sem_proxima: 'Sem próxima', intervalo: 'Intervalo' } as const;

export type FiltrosRotinas = {
  busca: string;
  /** Vazio é Todas; 'minhas' é a pessoa atual; ou o id de uma pessoa. */
  pessoa: string;
  soResponsavel: boolean;
  periodo: PeriodoDaRotina;
  proximaDe: string;
  proximaAte: string;
  area: string;
  tipo: string;
  prioridades: string[];
  /** O cartão clicado. */
  situacao: '' | Recorrencia['situacao'];
};

export const FILTROS_ROTINAS_INICIAIS: FiltrosRotinas = { busca: '', pessoa: '', soResponsavel: false, periodo: '', proximaDe: '', proximaAte: '', area: '', tipo: '', prioridades: [], situacao: '' };

export type OpcoesDasRotinas = { hoje: string; pessoaAtualId: string; contextoGlobalId: string; nomeDaPessoa: (id: string) => string };

/** Domingo da semana de hoje, como no Meu dia. */
function fimDaSemana(hoje: string): string {
  const dia = new Date(`${hoje}T00:00:00Z`).getUTCDay();
  return somarDias(hoje, dia === 0 ? 0 : 7 - dia);
}

function passaNaProxima({ proxima }: LinhaDaRotina, { periodo, proximaDe, proximaAte }: FiltrosRotinas, hoje: string): boolean {
  switch (periodo) {
    case 'hoje':
      return proxima === hoje;
    case 'semana':
      return proxima !== null && proxima <= fimDaSemana(hoje);
    case '30dias':
      return proxima !== null && proxima <= somarDias(hoje, DIAS_A_FRENTE);
    case 'sem_proxima':
      return proxima === null;
    case 'intervalo':
      return proxima !== null && (!proximaDe || proxima >= proximaDe) && (!proximaAte || proxima <= proximaAte);
    default:
      return true;
  }
}

function rotinasDoRecorte(rotinas: readonly LinhaDaRotina[], filtros: FiltrosRotinas, { hoje, pessoaAtualId, contextoGlobalId, nomeDaPessoa }: OpcoesDasRotinas): LinhaDaRotina[] {
  const texto = normalizarTexto(filtros.busca);
  const alvo = filtros.pessoa === MINHAS ? pessoaAtualId : filtros.pessoa;
  return rotinas.filter(
    (rotina) =>
      (!texto || normalizarTexto(`${rotina.titulo} ${nomeDaPessoa(rotina.responsavel_id)} ${regraPorExtenso(rotina)}`).includes(texto)) &&
      (!alvo || rotina.responsavel_id === alvo || (!filtros.soResponsavel && rotina.modelo.participantes.includes(alvo))) &&
      passaNoContexto(rotina.modelo.produtos, contextoGlobalId) &&
      passaNaProxima(rotina, filtros, hoje) &&
      (!filtros.area || rotina.modelo.area_id === filtros.area) &&
      (!filtros.tipo || rotina.modelo.tipo === filtros.tipo) &&
      (!filtros.prioridades.length || filtros.prioridades.includes(rotina.modelo.prioridade)),
  );
}

/** A próxima primeiro; as que não têm próxima vão para o fim. */
export function rotinasVisiveis(rotinas: readonly LinhaDaRotina[], filtros: FiltrosRotinas, opcoes: OpcoesDasRotinas): LinhaDaRotina[] {
  return rotinasDoRecorte(rotinas, filtros, opcoes)
    .filter((rotina) => !filtros.situacao || rotina.situacao === filtros.situacao)
    .sort((a, b) => (a.proxima ?? '9999').localeCompare(b.proxima ?? '9999') || a.titulo.localeCompare(b.titulo, 'pt-BR'));
}

/** RN-03.19: os contadores seguem o recorte. Só a situação, que é o que os cartões escolhem, não conta. */
export function resumoDasRotinas(rotinas: readonly LinhaDaRotina[], filtros: FiltrosRotinas, opcoes: OpcoesDasRotinas): Record<Recorrencia['situacao'], number> {
  const doRecorte = rotinasDoRecorte(rotinas, filtros, opcoes);
  const conta = (situacao: Recorrencia['situacao']) => doRecorte.filter((rotina) => rotina.situacao === situacao).length;
  return { ativa: conta('ativa'), pausada: conta('pausada'), encerrada: conta('encerrada') };
}

// ---------- Vínculos e a configuração do backup ----------

/** Quem responde por uma rotina em uso continua nela até alguém trocar (RN-02.04). */
export async function vinculosDeRotinaDaPessoa(id: string): Promise<string[]> {
  const rotinas = (await repositorios.recorrencia.listar()).filter((rotina) => rotina.situacao !== 'encerrada');
  const responsavel = rotinas.filter((rotina) => rotina.responsavel_id === id).length;
  if (!responsavel) return [];
  return [`Responsável por ${responsavel === 1 ? '1 rotina' : `${responsavel} rotinas`}`];
}

/** T02.01 mudou quem faz o backup semanal: a rotina e as próximas ocorrências acompanham. */
export async function alinharRotinaDoBackup(responsavelId: string, hoje: string = hojeISO()): Promise<void> {
  const rotina = await repositorios.recorrencia.obter(ID_ROTINA_BACKUP);
  if (!rotina || rotina.responsavel_id === responsavelId || rotina.situacao === 'encerrada') return;
  await emTransacao(async () => {
    await repositorios.recorrencia.atualizar(rotina.id, { responsavel_id: responsavelId });
    for (const atividade of await ocorrenciasAbertas(rotina.id, hoje)) {
      if (!atividade.editada_individualmente) await repositorios.atividade.atualizar(atividade.id, { responsavel_id: responsavelId });
    }
  });
}

/** A data da ocorrência na lista: lembrete pelo aviso, os outros pelo prazo. */
export const dataDaOcorrencia = (atividade: Atividade) => atividade.ocorrencia_data ?? prazoEfetivo(atividade);
