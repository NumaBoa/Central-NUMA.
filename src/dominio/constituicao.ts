/**
 * Regras de T06.06 (08-M06): o checklist de constituição. Bloqueado não é situação gravada: vem das dependências
 * (RN-06.10). A atividade de cada item é a do Meu dia, a mesma linha, criada ao iniciar e nunca em dobro.
 */
import { ErroDeRegra } from '@/dados/erros';
import { repositorios } from '@/dados/repositorios';
import { idDaPessoaAtual } from '@/dados/sessao';
import { emTransacao } from '@/dados/transacao';
import type { Atividade } from '@/dados/tipos/atividade';
import type { Entidade } from '@/dados/tipos/contraparte';
import type { Decisao } from '@/dados/tipos/decisao';
import type { ContaFinanceira } from '@/dados/tipos/financeiro';
import type { Pessoa } from '@/dados/tipos/pessoa';
import type { Acordo, AcordoVersao, ConstituicaoItem, Socia } from '@/dados/tipos/sociedade';
import { hojeISO } from '@/lib/datas';
import { versaoVigente } from './acordos';
import { bloquearAtividade, cancelarAtividade, concluirAtividade, desbloquearAtividade, estaAberta, moverAtividade, reabrirAtividade, trocarResponsavel } from './atividades';
import { AREA_GESTAO_GERAL, criarTarefaGerada, limitarTitulo } from './atividades-geradas';
import { itensATransferir, type ItemATransferir } from './ativos-a-transferir';
import { ORIGEM_CONSTITUICAO } from './integracoes/meu-dia-m06';
import { linkDoDriveValido, MENSAGEM_LINK_DRIVE } from './link-drive';
import { nomeDaPessoa, sociasAtivas } from './sociedade';

export const ROTULOS_SITUACAO_ITEM: Readonly<Record<ConstituicaoItem['situacao'], string>> = { a_fazer: 'A fazer', em_andamento: 'Em andamento', concluido: 'Concluído', nao_se_aplica: 'Não se aplica' };
export const ROTULOS_EVIDENCIA_ITEM: Readonly<Record<NonNullable<ConstituicaoItem['evidencia_tipo']>, string>> = { arquivo: 'Link do arquivo', acordo: 'Acordo vigente', decisao: 'Decisão registrada', ativos: 'Por ativo, em Ativos a transferir' };

const PREFIXO_DO_BLOQUEIO = 'Depende de: ';

export type EstadoDoItem = ConstituicaoItem['situacao'] | 'bloqueado';

const resolvido = (item: Pick<ConstituicaoItem, 'situacao'>) => item.situacao === 'concluido' || item.situacao === 'nao_se_aplica';

/** O que ainda segura o item. "Não se aplica" conta como resolvido: senão, nada depois dele andaria. */
export function dependenciasPendentes<T extends Pick<ConstituicaoItem, 'id' | 'situacao' | 'arquivado_em'>>(item: Pick<ConstituicaoItem, 'depende_de'>, itens: readonly T[]): T[] {
  return item.depende_de.flatMap((id) => {
    const dependencia = itens.find((outro) => outro.id === id && !outro.arquivado_em);
    return dependencia && !resolvido(dependencia) ? [dependencia] : [];
  });
}

export function estadoDoItem(item: Pick<ConstituicaoItem, 'situacao' | 'depende_de'>, itens: readonly Pick<ConstituicaoItem, 'id' | 'situacao' | 'arquivado_em'>[]): EstadoDoItem {
  if (resolvido(item)) return item.situacao;
  return dependenciasPendentes(item, itens).length ? 'bloqueado' : item.situacao;
}

export function motivoDoBloqueio(item: Pick<ConstituicaoItem, 'depende_de'>, itens: readonly Pick<ConstituicaoItem, 'id' | 'titulo' | 'situacao' | 'arquivado_em'>[]): string | null {
  const pendentes = dependenciasPendentes(item, itens);
  return pendentes.length ? `${PREFIXO_DO_BLOQUEIO}${pendentes.map((dependencia) => dependencia.titulo).join(', ')}` : null;
}

export type ProgressoDoChecklist = { concluidos: number; total: number; bloqueados: number; proximos: ConstituicaoItem[] };

/** "Não se aplica" sai da conta: 2 de 15 quer dizer que faltam 13 de verdade. */
export function progressoDoChecklist(itens: readonly ConstituicaoItem[]): ProgressoDoChecklist {
  const ordenados = [...itens].sort((a, b) => a.ordem - b.ordem);
  return {
    concluidos: itens.filter((item) => item.situacao === 'concluido').length,
    total: itens.filter((item) => item.situacao !== 'nao_se_aplica').length,
    bloqueados: itens.filter((item) => estadoDoItem(item, itens) === 'bloqueado').length,
    proximos: ordenados.filter((item) => item.situacao === 'a_fazer' || item.situacao === 'em_andamento').filter((item) => estadoDoItem(item, itens) !== 'bloqueado'),
  };
}

export const checklistIniciado = (itens: readonly Pick<ConstituicaoItem, 'atividade_id'>[]) => itens.some((item) => item.atividade_id);

// ---------- Responsável ----------

export function rotuloDoResponsavel(item: Pick<ConstituicaoItem, 'responsavel_tipo' | 'responsavel_id'>, pessoas: readonly Pick<Pessoa, 'id' | 'nome_completo'>[]): string {
  if (item.responsavel_tipo === 'ambas') return 'Ambas';
  if (item.responsavel_tipo === 'contador') return 'Contador';
  return nomeDaPessoa(pessoas, item.responsavel_id);
}

// ---------- Dados ----------

export type DadosDaConstituicao = {
  itens: ConstituicaoItem[];
  atividades: Atividade[];
  pessoas: Pessoa[];
  socias: Socia[];
  acordos: Acordo[];
  versoes: AcordoVersao[];
  decisoes: Decisao[];
  entidades: Entidade[];
  contas: ContaFinanceira[];
  pendentesDeTransferencia: ItemATransferir[];
};

export async function carregarConstituicao(): Promise<DadosDaConstituicao> {
  const [itens, atividades, pessoas, socias, acordos, versoes, decisoes, entidades, contas, ativos, ferramentas, contextos] = await Promise.all([
    repositorios.constituicao_item.listar(),
    repositorios.atividade.listar({ onde: { origem_tipo: ORIGEM_CONSTITUICAO } }),
    repositorios.pessoa.listar({ incluirArquivados: true }),
    repositorios.socia.listar(),
    repositorios.acordo_societario.listar(),
    repositorios.acordo_versao.listar(),
    repositorios.decisao.listar(),
    repositorios.entidade.listar(),
    repositorios.conta_financeira.listar(),
    repositorios.ativo_digital.listar(),
    repositorios.ferramenta.listar(),
    repositorios.ferramenta_contexto.listar(),
  ]);
  return { itens: [...itens].sort((a, b) => a.ordem - b.ordem), atividades, pessoas, socias, acordos, versoes, decisoes, entidades, contas, pendentesDeTransferencia: itensATransferir({ ativos, ferramentas, contextos, pessoas }) };
}

/** A Numa como PJ: a padrão, se for PJ, ou a primeira PJ que houver. */
export function entidadePrincipal<T extends Pick<Entidade, 'tipo_pessoa' | 'entidade_padrao' | 'situacao'>>(entidades: readonly T[]): T | undefined {
  const pjs = entidades.filter((entidade) => entidade.tipo_pessoa === 'pj' && entidade.situacao !== 'encerrada');
  return pjs.find((entidade) => entidade.entidade_padrao) ?? pjs[0];
}

export function contaDaPj(entidades: readonly Pick<Entidade, 'id' | 'tipo_pessoa' | 'situacao'>[], contas: readonly Pick<ContaFinanceira, 'tipo' | 'titular_entidade_id' | 'situacao'>[]): boolean {
  const pjsAtivas = entidades.filter((entidade) => entidade.tipo_pessoa === 'pj' && entidade.situacao === 'ativa').map((entidade) => entidade.id);
  return contas.some((conta) => conta.tipo === 'banco' && conta.situacao === 'ativa' && Boolean(conta.titular_entidade_id) && pjsAtivas.includes(conta.titular_entidade_id as string));
}

// ---------- Concluir (RN-06.10 e RN-06.11) ----------

/** O item 1 é o memorando ou o acordo de sócias, o 17 é o termo de cessão. Item novo aceita qualquer acordo vigente. */
export function acordosParaEvidencia(item: Pick<ConstituicaoItem, 'chave'>, { acordos, versoes }: Pick<DadosDaConstituicao, 'acordos' | 'versoes'>): Acordo[] {
  const tipos: readonly Acordo['tipo'][] | null = item.chave === 'memorando' ? ['memorando', 'acordo_socias'] : item.chave === 'cessao_pi' ? ['cessao_pi'] : null;
  return acordos.filter((acordo) => (!tipos || tipos.includes(acordo.tipo)) && Boolean(versaoVigente(acordo.id, versoes)));
}

export type EvidenciaInformada = { evidencia_url: string; evidencia_registro_id: string };

type ParaConcluir = Pick<DadosDaConstituicao, 'itens' | 'acordos' | 'versoes' | 'decisoes' | 'entidades' | 'contas' | 'pendentesDeTransferencia'>;

/** Por campo. Bloqueado com o motivo exibido (CA-06.05); sem a evidência exigida, não conclui. */
export function errosDaConclusao(item: ConstituicaoItem, { evidencia_url, evidencia_registro_id }: EvidenciaInformada, dados: ParaConcluir): Record<string, string> {
  const erros: Record<string, string> = {};
  const motivo = motivoDoBloqueio(item, dados.itens);
  if (motivo) erros.dependencias = motivo;
  if (item.exige_evidencia) {
    if (item.evidencia_tipo === 'arquivo' || item.evidencia_tipo === null) {
      if (!evidencia_url.trim()) erros.evidencia_url = 'Este item exige evidência: cole o link do arquivo.';
      else if (!linkDoDriveValido(evidencia_url)) erros.evidencia_url = MENSAGEM_LINK_DRIVE;
    } else if (item.evidencia_tipo === 'acordo') {
      if (!acordosParaEvidencia(item, dados).some((acordo) => acordo.id === evidencia_registro_id)) erros.evidencia_registro_id = 'Este item exige um acordo vigente como evidência.';
    } else if (item.evidencia_tipo === 'decisao') {
      if (!dados.decisoes.some((decisao) => decisao.id === evidencia_registro_id && decisao.situacao === 'registrada')) erros.evidencia_registro_id = 'Este item exige uma decisão registrada como evidência.';
    } else if (dados.pendentesDeTransferencia.length) {
      erros.ativos = dados.pendentesDeTransferencia.length === 1 ? 'Ainda há 1 item em Ativos a transferir.' : `Ainda há ${dados.pendentesDeTransferencia.length} itens em Ativos a transferir.`;
    }
  }
  if (item.chave === 'cnpj' && !dados.entidades.some((entidade) => entidade.tipo_pessoa === 'pj' && entidade.situacao === 'ativa')) erros.entidade = 'Complete os dados da entidade e deixe-a Ativa antes de concluir.';
  if (item.chave === 'conta_pj' && !contaDaPj(dados.entidades, dados.contas)) erros.conta = 'Cadastre a conta bancária da PJ em Contas financeiras antes de concluir.';
  return erros;
}

async function obterItem(id: string): Promise<ConstituicaoItem> {
  const item = await repositorios.constituicao_item.obter(id);
  if (!item) throw new ErroDeRegra('Este item não existe mais.');
  return item;
}

function exigirPessoa(): string {
  const pessoa = idDaPessoaAtual();
  if (!pessoa) throw new ErroDeRegra('Escolha quem é você em “Você é”.');
  return pessoa;
}

/** Concluir o item conclui a atividade dele, a mesma do Meu dia. O contrário não vale: sem a evidência, o item fica aberto. */
export async function concluirItem(id: string, evidencia: EvidenciaInformada, hoje: string = hojeISO()): Promise<void> {
  const dados = await carregarConstituicao();
  const item = dados.itens.find((linha) => linha.id === id);
  if (!item) throw new ErroDeRegra('Este item não existe mais.');
  if (resolvido(item)) throw new ErroDeRegra('Este item já foi resolvido.');
  const erro = Object.values(errosDaConclusao(item, evidencia, dados))[0];
  if (erro) throw new ErroDeRegra(erro);
  await emTransacao(async () => {
    await repositorios.constituicao_item.atualizar(id, { situacao: 'concluido', concluido_em: hoje, evidencia_url: evidencia.evidencia_url.trim() || null, evidencia_registro_id: evidencia.evidencia_registro_id || null });
    const atividade = item.atividade_id ? await repositorios.atividade.obter(item.atividade_id) : null;
    if (atividade && estaAberta(atividade)) await concluirAtividade(atividade.id, exigirPessoa());
    await sincronizarBloqueios();
  });
}

export async function iniciarItem(id: string): Promise<void> {
  const item = await obterItem(id);
  const itens = await repositorios.constituicao_item.listar();
  const motivo = motivoDoBloqueio(item, itens);
  if (motivo) throw new ErroDeRegra(motivo);
  if (item.situacao !== 'a_fazer') throw new ErroDeRegra('Este item já foi iniciado.');
  await emTransacao(async () => {
    await repositorios.constituicao_item.atualizar(id, { situacao: 'em_andamento' });
    const atividade = item.atividade_id ? await repositorios.atividade.obter(item.atividade_id) : null;
    if (atividade && estaAberta(atividade)) await moverAtividade(atividade.id, 'em_andamento');
  });
}

export async function marcarNaoSeAplica(id: string, motivo: string): Promise<void> {
  if (!motivo.trim()) throw new ErroDeRegra('“Não se aplica” exige o motivo.');
  const item = await obterItem(id);
  if (item.chave === 'cnpj') throw new ErroDeRegra('A entidade só fica Ativa com o CNPJ: este item não pode ficar de fora.');
  await emTransacao(async () => {
    await repositorios.constituicao_item.atualizar(id, { situacao: 'nao_se_aplica', motivo_nao_aplica: motivo.trim() }, { motivo: motivo.trim() });
    const atividade = item.atividade_id ? await repositorios.atividade.obter(item.atividade_id) : null;
    if (atividade && estaAberta(atividade)) await cancelarAtividade(atividade.id, `Não se aplica: ${motivo.trim()}`);
    await sincronizarBloqueios();
  });
}

/** Item que outro já concluído usou como base não reabre: antes é preciso reabrir o que veio depois. */
export async function reabrirItem(id: string, motivo: string): Promise<void> {
  if (!motivo.trim()) throw new ErroDeRegra('Informe o motivo para reabrir.');
  const item = await obterItem(id);
  if (!resolvido(item)) throw new ErroDeRegra('Este item já está aberto.');
  const itens = await repositorios.constituicao_item.listar();
  const dependentes = itens.filter((outro) => outro.depende_de.includes(id) && outro.situacao === 'concluido');
  if (dependentes.length) throw new ErroDeRegra(`Reabra antes: ${dependentes.map((outro) => outro.titulo).join(', ')}.`);
  await emTransacao(async () => {
    await repositorios.constituicao_item.atualizar(id, { situacao: 'a_fazer', concluido_em: null, motivo_nao_aplica: null }, { motivo: motivo.trim() });
    const atividade = item.atividade_id ? await repositorios.atividade.obter(item.atividade_id) : null;
    if (atividade && !estaAberta(atividade)) await reabrirAtividade(atividade.id, motivo.trim());
    await sincronizarBloqueios();
  });
}

// ---------- Atividades no Meu dia ----------

export const chaveDoItem = (id: string) => `${ORIGEM_CONSTITUICAO}:${id}`;

type Responsabilidade = { responsavel_id: string; participantes: string[]; descricao: string | null };

/**
 * A atividade tem uma responsável (RN-03.02). "Ambas": quem iniciou o checklist, com as outras sócias como participantes.
 * "Contador": quem iniciou acompanha, porque o contador é externo e não usa o Meu dia.
 */
export function responsabilidadeDaAtividade(item: Pick<ConstituicaoItem, 'responsavel_tipo' | 'responsavel_id'>, pessoaAtualId: string, ativas: readonly string[]): Responsabilidade {
  if (item.responsavel_tipo === 'pessoa') return { responsavel_id: item.responsavel_id as string, participantes: [], descricao: null };
  if (item.responsavel_tipo === 'ambas') return { responsavel_id: pessoaAtualId, participantes: ativas.filter((id) => id !== pessoaAtualId), descricao: null };
  return { responsavel_id: pessoaAtualId, participantes: [], descricao: 'Acompanhar com o contador.' };
}

/** Idempotente (T06.06): item com atividade, resolvido, ou que já teve a chave usada não ganha outra. Devolve quantas criou. */
export async function iniciarChecklist(hoje: string = hojeISO()): Promise<number> {
  const pessoaAtualId = exigirPessoa();
  const [itens, atividades, socias] = await Promise.all([repositorios.constituicao_item.listar(), repositorios.atividade.listar({ incluirArquivados: true }), repositorios.socia.listar()]);
  const ativas = sociasAtivas(socias, hoje).map((socia) => socia.pessoa_id);
  let novas = 0;
  await emTransacao(async () => {
    for (const item of [...itens].sort((a, b) => a.ordem - b.ordem)) {
      if (resolvido(item)) continue;
      const existente = atividades.find((atividade) => atividade.chave_idempotencia === chaveDoItem(item.id));
      if (existente) {
        if (item.atividade_id !== existente.id) await repositorios.constituicao_item.atualizar(item.id, { atividade_id: existente.id });
        continue;
      }
      const { responsavel_id, participantes, descricao } = responsabilidadeDaAtividade(item, pessoaAtualId, ativas);
      const atividade = await criarTarefaGerada({ titulo: limitarTitulo(item.titulo), descricao: item.descricao ? `${item.descricao}${descricao ? ` ${descricao}` : ''}` : descricao, responsavel_id, area_id: AREA_GESTAO_GERAL, prazo: item.prazo, origem_tipo: ORIGEM_CONSTITUICAO, origem_id: item.id, chave: chaveDoItem(item.id), bloqueio_motivo: motivoDoBloqueio(item, itens) }, { vinculo: { tipo: ORIGEM_CONSTITUICAO, id: item.id }, participantes });
      await repositorios.constituicao_item.atualizar(item.id, { atividade_id: atividade.id });
      novas += 1;
    }
  });
  return novas;
}

/** A dependência andou: o bloqueio que a Central pôs sai sozinho. O que alguém bloqueou à mão, por outro motivo, fica. */
export async function sincronizarBloqueios(): Promise<void> {
  const itens = await repositorios.constituicao_item.listar();
  for (const item of itens) {
    const atividade = item.atividade_id ? await repositorios.atividade.obter(item.atividade_id) : null;
    if (!atividade || !estaAberta(atividade)) continue;
    const motivo = motivoDoBloqueio(item, itens);
    if (motivo && atividade.bloqueio_motivo !== motivo && (!atividade.bloqueada || atividade.bloqueio_motivo?.startsWith(PREFIXO_DO_BLOQUEIO))) await bloquearAtividade(atividade.id, motivo);
    else if (!motivo && atividade.bloqueada && atividade.bloqueio_motivo?.startsWith(PREFIXO_DO_BLOQUEIO)) await desbloquearAtividade(atividade.id);
  }
}

// ---------- Editar o checklist ----------

export type FormularioItem = { titulo: string; descricao: string; depende_de: string[]; exige_evidencia: boolean; evidencia_tipo: NonNullable<ConstituicaoItem['evidencia_tipo']>; responsavel_tipo: ConstituicaoItem['responsavel_tipo']; responsavel_id: string; prazo: string };

export const formularioItemVazio = (pessoaId: string): FormularioItem => ({ titulo: '', descricao: '', depende_de: [], exige_evidencia: false, evidencia_tipo: 'arquivo', responsavel_tipo: 'pessoa', responsavel_id: pessoaId, prazo: '' });

export const formularioDoItem = (item: ConstituicaoItem): FormularioItem => ({ titulo: item.titulo, descricao: item.descricao ?? '', depende_de: item.depende_de, exige_evidencia: item.exige_evidencia, evidencia_tipo: item.evidencia_tipo ?? 'arquivo', responsavel_tipo: item.responsavel_tipo, responsavel_id: item.responsavel_id ?? '', prazo: item.prazo ?? '' });

/** Um item não pode depender de si, nem de quem depende dele, direta ou indiretamente. */
export function dependenciaCriaCiclo(id: string | undefined, dependeDe: readonly string[], itens: readonly Pick<ConstituicaoItem, 'id' | 'depende_de'>[]): boolean {
  if (!id) return false;
  const vistos = new Set<string>();
  const fila = [...dependeDe];
  while (fila.length) {
    const atual = fila.pop() as string;
    if (atual === id) return true;
    if (vistos.has(atual)) continue;
    vistos.add(atual);
    fila.push(...(itens.find((item) => item.id === atual)?.depende_de ?? []));
  }
  return false;
}

export function errosDoItem(formulario: FormularioItem, id: string | undefined, itens: readonly Pick<ConstituicaoItem, 'id' | 'depende_de'>[]): Record<string, string> {
  const erros: Record<string, string> = {};
  if (!formulario.titulo.trim()) erros.titulo = 'Informe o título do item.';
  if (formulario.responsavel_tipo === 'pessoa' && !formulario.responsavel_id) erros.responsavel_id = 'Escolha a responsável.';
  if (dependenciaCriaCiclo(id, formulario.depende_de, itens)) erros.depende_de = 'Esse item já depende deste: escolha outra dependência.';
  return erros;
}

/** A atividade acompanha o que mudou no item: é o mesmo trabalho, não uma cópia. */
export async function salvarItem(formulario: FormularioItem, id?: string, hoje: string = hojeISO()): Promise<ConstituicaoItem> {
  const itens = await repositorios.constituicao_item.listar();
  const erro = Object.values(errosDoItem(formulario, id, itens))[0];
  if (erro) throw new ErroDeRegra(erro);
  const atual = id ? itens.find((item) => item.id === id) : undefined;
  const dados = {
    titulo: formulario.titulo.trim(),
    descricao: formulario.descricao.trim() || null,
    depende_de: formulario.depende_de,
    exige_evidencia: formulario.exige_evidencia,
    evidencia_tipo: formulario.exige_evidencia ? (atual?.evidencia_tipo === 'ativos' ? 'ativos' : formulario.evidencia_tipo) : null,
    responsavel_tipo: formulario.responsavel_tipo,
    responsavel_id: formulario.responsavel_tipo === 'pessoa' ? formulario.responsavel_id : null,
    prazo: formulario.prazo || null,
  } as const;
  const salvo = await emTransacao(async () => {
    if (!atual) {
      const criado = await repositorios.constituicao_item.criar({ ...dados, ordem: itens.reduce((maior, item) => Math.max(maior, item.ordem), 0) + 1, chave: null, situacao: 'a_fazer', evidencia_url: null, evidencia_registro_id: null, motivo_nao_aplica: null, atividade_id: null, concluido_em: null });
      return criado;
    }
    const gravado = await repositorios.constituicao_item.atualizar(atual.id, dados);
    const atividade = atual.atividade_id ? await repositorios.atividade.obter(atual.atividade_id) : null;
    if (atividade && estaAberta(atividade)) {
      if (atividade.titulo !== limitarTitulo(dados.titulo) || atividade.prazo !== dados.prazo) await repositorios.atividade.atualizar(atividade.id, { titulo: limitarTitulo(dados.titulo), prazo: dados.prazo });
      if (dados.responsavel_tipo === 'pessoa' && dados.responsavel_id && atividade.responsavel_id !== dados.responsavel_id) await trocarResponsavel(atividade.id, dados.responsavel_id);
    }
    return gravado;
  });
  // Com o checklist já iniciado, item novo ganha a atividade na hora, pelo mesmo caminho idempotente.
  if (!atual && checklistIniciado(itens)) await iniciarChecklist(hoje);
  await sincronizarBloqueios();
  return salvo;
}

/** Quem depende dele precisa mudar antes. A atividade aberta sai junto, com o motivo. */
export async function removerItem(id: string): Promise<void> {
  const item = await obterItem(id);
  if (item.chave === 'cnpj') throw new ErroDeRegra('Este item ativa a entidade: não pode sair do checklist.');
  const itens = await repositorios.constituicao_item.listar();
  const dependentes = itens.filter((outro) => outro.depende_de.includes(id));
  if (dependentes.length) throw new ErroDeRegra(`Tire a dependência antes: ${dependentes.map((outro) => outro.titulo).join(', ')}.`);
  await emTransacao(async () => {
    const atividade = item.atividade_id ? await repositorios.atividade.obter(item.atividade_id) : null;
    if (atividade && estaAberta(atividade)) await cancelarAtividade(atividade.id, 'O item saiu do checklist de constituição.');
    await repositorios.constituicao_item.arquivar(id);
  });
}
