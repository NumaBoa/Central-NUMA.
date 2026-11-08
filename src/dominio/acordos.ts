/**
 * Regras de T06.03 (08-M06): acordos, versões e confirmações. O sistema não gera minuta jurídica: guarda o resumo
 * estruturado, o arquivo assinado, a data e quem confirmou. Na etapa local, a pessoa de "Você é" só simula a autoria:
 * isto não é autenticação nem assinatura eletrônica. Com login, `confirmarAssinatura` recebe a pessoa da sessão.
 */
import { ErroDeRegra } from '@/dados/erros';
import { repositorios } from '@/dados/repositorios';
import { idDaPessoaAtual } from '@/dados/sessao';
import { emTransacao } from '@/dados/transacao';
import type { AnexoLink } from '@/dados/tipos/apoio';
import type { Entidade } from '@/dados/tipos/contraparte';
import type { Pessoa } from '@/dados/tipos/pessoa';
import type { Acordo, AcordoAssinatura, AcordoVersao, ResumoDoAcordo, Socia } from '@/dados/tipos/sociedade';
import { hojeISO } from '@/lib/datas';
import { formatarDiaISO, formatarDinheiro } from '@/lib/formatacao';
import { sincronizarAlertasDosAcordos } from './alertas-m06';
import { lerValor, valorParaCampo } from './dinheiro';
import { proporcoesFecham } from './entidades';
import { linkDoDriveValido, MENSAGEM_LINK_DRIVE } from './link-drive';
import { lerParticipacao, nomeDaPessoa, sociasAtivas, textoDaParticipacao } from './sociedade';

export const ROTULOS_TIPO_ACORDO: Readonly<Record<Acordo['tipo'], string>> = { memorando: 'Memorando de entendimento', acordo_socias: 'Acordo de sócias', ata: 'Ata', cessao_pi: 'Termo de cessão de PI', alteracao_contratual: 'Alteração contratual', outro: 'Outro' };
export const ROTULOS_SITUACAO_VERSAO: Readonly<Record<AcordoVersao['situacao'], string>> = { rascunho: 'Rascunho', em_revisao: 'Em revisão', aguardando_assinaturas: 'Aguardando assinaturas', vigente: 'Vigente', substituida: 'Substituída', cancelada: 'Cancelada' };

/** "Participação por sócia" é obrigatória para Vigente nestes tipos (T06.03). */
export const TIPOS_COM_PARTICIPACAO: readonly Acordo['tipo'][] = ['memorando', 'acordo_socias'];
/** CA-06.01: são estes que fazem o marco ME-04. */
export const exigeParticipacao = (tipo: Acordo['tipo']) => TIPOS_COM_PARTICIPACAO.includes(tipo);

const SITUACOES_EM_ANDAMENTO: readonly AcordoVersao['situacao'][] = ['rascunho', 'em_revisao', 'aguardando_assinaturas'];
export const versaoEmAndamento = (versao: Pick<AcordoVersao, 'situacao'>) => SITUACOES_EM_ANDAMENTO.includes(versao.situacao);
export const versaoEditavel = (versao: Pick<AcordoVersao, 'situacao'>) => versao.situacao === 'rascunho' || versao.situacao === 'em_revisao';

/** O roteiro do memorando (T06.03): tópicos para preencher. O texto final é redigido fora e validado por Kimberly. */
export const ROTEIRO_DO_MEMORANDO: readonly { topico: string; guia: string }[] = [
  { topico: 'Partes', guia: 'Quem assina: as sócias e, quando existir, a entidade.' },
  { topico: 'Participação', guia: 'O percentual de cada sócia, somando 100%.' },
  { topico: 'Aportes previstos', guia: 'O que cada sócia pretende aportar, com valores, se já houver.' },
  { topico: 'Dedicação', guia: 'O que se espera de cada sócia.' },
  { topico: 'Regras de decisão', guia: 'O que precisa de unanimidade e o que cada uma decide sozinha.' },
  { topico: 'Titularidade de ativos e PI', guia: 'Se os ativos e a PI dos produtos pertencem à Numa (D1).' },
  { topico: 'Destino dos produtos em caso de saída', guia: 'O que acontece com cada produto se uma sócia sair.' },
  { topico: 'Saída, não concorrência e confidencialidade', guia: 'As condições de saída e o que continua valendo depois dela.' },
  { topico: 'Vigência e revisão prevista', guia: 'Quando revisar o acordo. A data gera um alerta.' },
];

export const versoesDoAcordo = <T extends Pick<AcordoVersao, 'acordo_id' | 'numero'>>(acordoId: string, versoes: readonly T[]): T[] => versoes.filter((versao) => versao.acordo_id === acordoId).sort((a, b) => b.numero - a.numero);

/** A que a tela mostra: a mais nova que não foi cancelada. */
export function versaoAtual<T extends Pick<AcordoVersao, 'situacao' | 'numero' | 'acordo_id'>>(acordoId: string, versoes: readonly T[]): T | undefined {
  const doAcordo = versoesDoAcordo(acordoId, versoes);
  return doAcordo.find((versao) => versao.situacao !== 'cancelada') ?? doAcordo[0];
}

export function versaoVigente<T extends Pick<AcordoVersao, 'situacao' | 'numero' | 'acordo_id'>>(acordoId: string, versoes: readonly T[]): T | undefined {
  return versoesDoAcordo(acordoId, versoes).find((versao) => versao.situacao === 'vigente');
}

/** RN-06.06: nenhum acordo vigente com a titularidade de ativos e PI marcada para a Numa. */
export function faltaTitularidade(versoes: readonly Pick<AcordoVersao, 'situacao' | 'titularidade_numa'>[]): boolean {
  return !versoes.some((versao) => versao.situacao === 'vigente' && versao.titularidade_numa);
}

// ---------- Formulário ----------

export type FormularioAcordo = {
  titulo: string;
  tipo: Acordo['tipo'];
  partes: string[];
  parte_entidade_id: string;
  participacao: Record<string, string>;
  aportes: string;
  aportes_valores: Record<string, string>;
  dedicacao: Record<string, string>;
  decisao: string;
  destino_produtos: string;
  saida: string;
  observacoes: string;
  titularidade_numa: boolean;
  revisao_prevista: string;
};

const porPessoa = (linhas: readonly { pessoa_id: string }[], valor: (linha: never) => string) => Object.fromEntries(linhas.map((linha) => [linha.pessoa_id, valor(linha as never)]));

export function formularioAcordoVazio(socias: readonly Pick<Socia, 'pessoa_id' | 'participacao'>[]): FormularioAcordo {
  return {
    titulo: '',
    tipo: 'memorando',
    partes: socias.map((socia) => socia.pessoa_id),
    parte_entidade_id: '',
    participacao: Object.fromEntries(socias.map((socia) => [socia.pessoa_id, String(socia.participacao).replace('.', ',')])),
    aportes: '',
    aportes_valores: {},
    dedicacao: {},
    decisao: '',
    destino_produtos: '',
    saida: '',
    observacoes: '',
    titularidade_numa: false,
    revisao_prevista: '',
  };
}

export function formularioDaVersao(acordo: Pick<Acordo, 'titulo' | 'tipo'>, versao: Pick<AcordoVersao, 'resumo' | 'titularidade_numa' | 'revisao_prevista'>): FormularioAcordo {
  const { resumo } = versao;
  return {
    titulo: acordo.titulo,
    tipo: acordo.tipo,
    partes: resumo.partes,
    parte_entidade_id: resumo.parte_entidade_id ?? '',
    participacao: porPessoa(resumo.participacao, (linha: { percentual: number }) => String(linha.percentual).replace('.', ',')),
    aportes: resumo.aportes ?? '',
    aportes_valores: porPessoa(resumo.aportes_valores, (linha: { valor: number }) => valorParaCampo(linha.valor)),
    dedicacao: porPessoa(resumo.dedicacao, (linha: { texto: string }) => linha.texto),
    decisao: resumo.decisao ?? '',
    destino_produtos: resumo.destino_produtos ?? '',
    saida: resumo.saida ?? '',
    observacoes: resumo.observacoes ?? '',
    titularidade_numa: versao.titularidade_numa,
    revisao_prevista: versao.revisao_prevista ?? '',
  };
}

/** Em rascunho, só título, tipo e o formato do que foi preenchido. O resto é cobrado ao pedir as assinaturas. */
export function errosDoAcordo(formulario: FormularioAcordo): Record<string, string> {
  const erros: Record<string, string> = {};
  if (!formulario.titulo.trim()) erros.titulo = 'Informe o título do acordo.';
  for (const pessoa of formulario.partes) {
    const percentual = formulario.participacao[pessoa]?.trim();
    if (percentual && lerParticipacao(percentual) === null) erros[`participacao_${pessoa}`] = 'Use um percentual de 0 a 100.';
    const valor = formulario.aportes_valores[pessoa]?.trim();
    if (valor && lerValor(valor) === null) erros[`aporte_${pessoa}`] = 'Use um valor em reais, como 1.500,00.';
  }
  return erros;
}

export function resumoDoFormulario(formulario: FormularioAcordo): Pick<AcordoVersao, 'resumo' | 'titularidade_numa' | 'revisao_prevista'> {
  const limpo = (texto: string) => texto.trim() || null;
  const resumo: ResumoDoAcordo = {
    partes: formulario.partes,
    parte_entidade_id: formulario.parte_entidade_id || null,
    participacao: formulario.partes.flatMap((pessoa_id) => {
      const percentual = lerParticipacao(formulario.participacao[pessoa_id] ?? '');
      return percentual === null ? [] : [{ pessoa_id, percentual }];
    }),
    aportes: limpo(formulario.aportes),
    aportes_valores: formulario.partes.flatMap((pessoa_id) => {
      const valor = lerValor(formulario.aportes_valores[pessoa_id] ?? '');
      return valor === null ? [] : [{ pessoa_id, valor }];
    }),
    dedicacao: formulario.partes.flatMap((pessoa_id) => {
      const texto = formulario.dedicacao[pessoa_id]?.trim();
      return texto ? [{ pessoa_id, texto }] : [];
    }),
    decisao: limpo(formulario.decisao),
    destino_produtos: limpo(formulario.destino_produtos),
    saida: limpo(formulario.saida),
    observacoes: limpo(formulario.observacoes),
  };
  return { resumo, titularidade_numa: formulario.titularidade_numa, revisao_prevista: formulario.revisao_prevista || null };
}

// ---------- O que falta ----------

/** Os obrigatórios para Vigente que dependem só do resumo (T06.03). São cobrados ao pedir as assinaturas. */
export function pendenciasDoResumo(acordo: Pick<Acordo, 'tipo'>, versao: Pick<AcordoVersao, 'resumo'>): string[] {
  const pendencias: string[] = [];
  if (!versao.resumo.partes.length) pendencias.push('Faltam as partes.');
  if (exigeParticipacao(acordo.tipo)) {
    const { partes, participacao } = versao.resumo;
    if (partes.some((pessoa) => !participacao.some((linha) => linha.pessoa_id === pessoa))) pendencias.push('Falta a participação de cada sócia.');
    else if (!proporcoesFecham(participacao.map((linha) => linha.percentual))) pendencias.push('A participação das sócias deve somar 100%.');
  }
  return pendencias;
}

type ParaVigencia = { acordo: Pick<Acordo, 'tipo'>; versao: Pick<AcordoVersao, 'id' | 'resumo' | 'arquivo_url' | 'data_assinatura'>; assinaturas: readonly Pick<AcordoAssinatura, 'versao_id' | 'pessoa_id'>[]; socias: readonly Pick<Socia, 'pessoa_id' | 'saida_em' | 'arquivado_em'>[]; pessoas: readonly Pick<Pessoa, 'id' | 'nome_completo'>[]; hoje: string };

/** RN-06.04 e CA-06.03: arquivo assinado, data e a confirmação de cada sócia ativa. Cada linha diz o que falta. */
export function pendenciasDaVigencia({ acordo, versao, assinaturas, socias, pessoas, hoje }: ParaVigencia): string[] {
  const pendencias = pendenciasDoResumo(acordo, versao);
  if (!versao.arquivo_url) pendencias.push('Falta o arquivo assinado.');
  if (!versao.data_assinatura) pendencias.push('Falta a data de assinatura.');
  for (const socia of sociasAtivas(socias, hoje)) {
    if (!assinaturas.some((assinatura) => assinatura.versao_id === versao.id && assinatura.pessoa_id === socia.pessoa_id)) pendencias.push(`Falta a confirmação de ${nomeDaPessoa(pessoas, socia.pessoa_id)}.`);
  }
  return pendencias;
}

// ---------- Dados ----------

export type DadosDosAcordos = { acordos: Acordo[]; versoes: AcordoVersao[]; assinaturas: AcordoAssinatura[]; socias: Socia[]; pessoas: Pessoa[]; entidades: Entidade[]; anexos: AnexoLink[] };

export async function carregarAcordos(): Promise<DadosDosAcordos> {
  const [acordos, versoes, assinaturas, socias, pessoas, entidades, anexos] = await Promise.all([repositorios.acordo_societario.listar(), repositorios.acordo_versao.listar(), repositorios.acordo_assinatura.listar(), repositorios.socia.listar(), repositorios.pessoa.listar({ incluirArquivados: true }), repositorios.entidade.listar(), repositorios.anexo_link.listar({ onde: { registro_tipo: 'acordo_societario' } })]);
  return { acordos, versoes, assinaturas, socias, pessoas, entidades, anexos };
}

export type FiltrosAcordos = { busca: string; tipo: string; situacao: string };
export const FILTROS_ACORDOS_INICIAIS: FiltrosAcordos = { busca: '', tipo: '', situacao: '' };

export type LinhaDoAcordo = { acordo: Acordo; versao: AcordoVersao | undefined; vigente: AcordoVersao | undefined; assinatura: string; revisao: string | null };

/** "Pendente a confirmação de Camila Lima", "Assinado em 06/11/2026": a coluna Assinatura de T06.03. */
export function textoDaAssinatura(versao: AcordoVersao | undefined, { assinaturas, socias, pessoas }: Pick<DadosDosAcordos, 'assinaturas' | 'socias' | 'pessoas'>, hoje: string = hojeISO()): string {
  if (!versao) return 'Não registrada';
  if (versao.situacao === 'vigente' || versao.situacao === 'substituida') return versao.data_assinatura ? `Assinado em ${formatarDiaISO(versao.data_assinatura)}` : 'Assinado';
  if (versao.situacao !== 'aguardando_assinaturas') return 'Não registrada';
  const faltam = sociasAtivas(socias, hoje).filter((socia) => !assinaturas.some((assinatura) => assinatura.versao_id === versao.id && assinatura.pessoa_id === socia.pessoa_id));
  return faltam.length ? `Pendente: ${faltam.map((socia) => nomeDaPessoa(pessoas, socia.pessoa_id)).join(' e ')}` : 'Todas confirmaram';
}

export function linhasDosAcordos(dados: DadosDosAcordos, { busca, tipo, situacao }: FiltrosAcordos, hoje: string = hojeISO()): LinhaDoAcordo[] {
  const termo = busca.trim().toLocaleLowerCase('pt-BR');
  return dados.acordos
    .map((acordo) => {
      const versao = versaoAtual(acordo.id, dados.versoes);
      const vigente = versaoVigente(acordo.id, dados.versoes);
      return { acordo, versao, vigente, assinatura: textoDaAssinatura(versao, dados, hoje), revisao: (vigente ?? versao)?.revisao_prevista ?? null };
    })
    .filter(({ acordo, versao }) => (!termo || acordo.titulo.toLocaleLowerCase('pt-BR').includes(termo) || acordo.codigo.toLocaleLowerCase('pt-BR').includes(termo)) && (!tipo || acordo.tipo === tipo) && (!situacao || versao?.situacao === situacao))
    .sort((a, b) => a.acordo.codigo.localeCompare(b.acordo.codigo));
}

// ---------- Gravar ----------

async function obterVersao(id: string): Promise<AcordoVersao> {
  const versao = await repositorios.acordo_versao.obter(id);
  if (!versao) throw new ErroDeRegra('Esta versão não existe mais.');
  return versao;
}

const VAZIO: Pick<AcordoVersao, 'arquivo_url' | 'data_assinatura' | 'validacao_id' | 'cancelada_motivo'> = { arquivo_url: null, data_assinatura: null, validacao_id: null, cancelada_motivo: null };

export async function criarAcordo(formulario: FormularioAcordo): Promise<Acordo> {
  const erro = Object.values(errosDoAcordo(formulario))[0];
  if (erro) throw new ErroDeRegra(erro);
  return emTransacao(async () => {
    const acordo = await repositorios.acordo_societario.criar({ titulo: formulario.titulo.trim(), tipo: formulario.tipo, versao_vigente_id: null });
    await repositorios.acordo_versao.criar({ acordo_id: acordo.id, numero: 1, situacao: 'rascunho', ...resumoDoFormulario(formulario), ...VAZIO });
    return acordo;
  });
}

/** Só em Rascunho e Em revisão: quem já foi para assinatura não muda de conteúdo. */
export async function salvarVersaoDoAcordo(versaoId: string, formulario: FormularioAcordo): Promise<void> {
  const erro = Object.values(errosDoAcordo(formulario))[0];
  if (erro) throw new ErroDeRegra(erro);
  const versao = await obterVersao(versaoId);
  if (!versaoEditavel(versao)) throw new ErroDeRegra('Esta versão não pode mais ser editada. Crie uma nova versão.');
  await emTransacao(async () => {
    await repositorios.acordo_versao.atualizar(versaoId, resumoDoFormulario(formulario));
    const versoes = await repositorios.acordo_versao.listar({ onde: { acordo_id: versao.acordo_id } });
    // Depois da primeira vigência, o acordo mantém título e tipo: as versões antigas falam dele.
    if (!versoes.some((item) => item.situacao === 'vigente' || item.situacao === 'substituida')) await repositorios.acordo_societario.atualizar(versao.acordo_id, { titulo: formulario.titulo.trim(), tipo: formulario.tipo });
  });
}

export async function enviarParaRevisao(versaoId: string): Promise<void> {
  const versao = await obterVersao(versaoId);
  if (versao.situacao !== 'rascunho') throw new ErroDeRegra('Só um rascunho vai para revisão.');
  await repositorios.acordo_versao.atualizar(versaoId, { situacao: 'em_revisao' });
}

export async function pedirAssinaturas(versaoId: string): Promise<void> {
  const versao = await obterVersao(versaoId);
  if (versao.situacao !== 'em_revisao') throw new ErroDeRegra('Só uma versão em revisão vai para assinatura.');
  const acordo = await repositorios.acordo_societario.obter(versao.acordo_id);
  const pendencia = acordo ? pendenciasDoResumo(acordo, versao)[0] : 'Este acordo não existe mais.';
  if (pendencia) throw new ErroDeRegra(pendencia);
  await repositorios.acordo_versao.atualizar(versaoId, { situacao: 'aguardando_assinaturas' });
}

/** Mudar o conteúdo invalida o que foi assinado: as confirmações, o arquivo e a data saem, e o histórico guarda. */
export async function voltarParaRevisao(versaoId: string, motivo: string): Promise<void> {
  if (!motivo.trim()) throw new ErroDeRegra('Informe o motivo.');
  const versao = await obterVersao(versaoId);
  if (versao.situacao !== 'aguardando_assinaturas') throw new ErroDeRegra('Só uma versão aguardando assinaturas volta para revisão.');
  await emTransacao(async () => {
    for (const assinatura of await repositorios.acordo_assinatura.listar({ onde: { versao_id: versaoId } })) await repositorios.acordo_assinatura.arquivar(assinatura.id, motivo.trim());
    await repositorios.acordo_versao.atualizar(versaoId, { situacao: 'em_revisao', arquivo_url: null, data_assinatura: null }, { motivo: motivo.trim() });
  });
}

/** RN-06.04: cada sócia confirma a própria. Quem está em "Você é" nunca confirma por outra. */
export async function confirmarAssinatura(versaoId: string, pessoaId: string, hoje: string = hojeISO()): Promise<void> {
  const versao = await obterVersao(versaoId);
  if (versao.situacao !== 'aguardando_assinaturas') throw new ErroDeRegra('Esta versão não está aguardando assinaturas.');
  const pessoas = await repositorios.pessoa.listar({ incluirArquivados: true });
  const atual = idDaPessoaAtual();
  if (atual !== pessoaId) throw new ErroDeRegra(`Você, ${nomeDaPessoa(pessoas, atual)}, não pode confirmar em nome de ${nomeDaPessoa(pessoas, pessoaId)}.`);
  const socias = await repositorios.socia.listar();
  if (!sociasAtivas(socias, hoje).some((socia) => socia.pessoa_id === pessoaId)) throw new ErroDeRegra('Só uma sócia ativa confirma um acordo.');
  const existentes = await repositorios.acordo_assinatura.listar({ onde: { versao_id: versaoId, pessoa_id: pessoaId } });
  if (existentes.length) return;
  await repositorios.acordo_assinatura.criar({ versao_id: versaoId, pessoa_id: pessoaId, confirmado_em: new Date().toISOString() });
}

export function errosDoArquivoAssinado({ arquivo_url, data_assinatura }: { arquivo_url: string; data_assinatura: string }, hoje: string = hojeISO()): Record<string, string> {
  const erros: Record<string, string> = {};
  if (!arquivo_url.trim()) erros.arquivo_url = 'Cole o link do arquivo assinado.';
  else if (!linkDoDriveValido(arquivo_url)) erros.arquivo_url = MENSAGEM_LINK_DRIVE;
  if (!data_assinatura) erros.data_assinatura = 'Informe a data de assinatura.';
  else if (data_assinatura > hoje) erros.data_assinatura = 'Use hoje ou uma data passada.';
  return erros;
}

export async function registrarArquivoAssinado(versaoId: string, dados: { arquivo_url: string; data_assinatura: string }, hoje: string = hojeISO()): Promise<void> {
  const erro = Object.values(errosDoArquivoAssinado(dados, hoje))[0];
  if (erro) throw new ErroDeRegra(erro);
  const versao = await obterVersao(versaoId);
  if (versao.situacao !== 'aguardando_assinaturas') throw new ErroDeRegra('O arquivo assinado é registrado enquanto a versão aguarda assinaturas.');
  await repositorios.acordo_versao.atualizar(versaoId, { arquivo_url: dados.arquivo_url.trim(), data_assinatura: dados.data_assinatura });
}

/** RN-06.03: a anterior fica Substituída, sem apagar. Só uma vigente por acordo. */
export async function tornarVigente(versaoId: string, hoje: string = hojeISO()): Promise<void> {
  const versao = await obterVersao(versaoId);
  if (versao.situacao !== 'aguardando_assinaturas') throw new ErroDeRegra('Só uma versão aguardando assinaturas pode ficar vigente.');
  const acordo = await repositorios.acordo_societario.obter(versao.acordo_id);
  if (!acordo) throw new ErroDeRegra('Este acordo não existe mais.');
  const [assinaturas, socias, pessoas, versoes] = await Promise.all([repositorios.acordo_assinatura.listar({ onde: { versao_id: versaoId } }), repositorios.socia.listar(), repositorios.pessoa.listar({ incluirArquivados: true }), repositorios.acordo_versao.listar({ onde: { acordo_id: versao.acordo_id } })]);
  const pendencia = pendenciasDaVigencia({ acordo, versao, assinaturas, socias, pessoas, hoje })[0];
  if (pendencia) throw new ErroDeRegra(pendencia);
  await emTransacao(async () => {
    for (const anterior of versoes.filter((item) => item.situacao === 'vigente')) await repositorios.acordo_versao.atualizar(anterior.id, { situacao: 'substituida' }, { motivo: `Substituída pela V${versao.numero}.` });
    await repositorios.acordo_versao.atualizar(versaoId, { situacao: 'vigente' });
    await repositorios.acordo_societario.atualizar(acordo.id, { versao_vigente_id: versaoId });
  });
  await sincronizarAlertasDosAcordos(hoje);
}

/** Vigente e substituída não se cancelam: uma é trocada por outra versão, e a outra já é passado. */
export async function cancelarVersao(versaoId: string, motivo: string): Promise<void> {
  if (!motivo.trim()) throw new ErroDeRegra('Informe o motivo.');
  const versao = await obterVersao(versaoId);
  if (!versaoEmAndamento(versao)) throw new ErroDeRegra('Só uma versão em andamento pode ser cancelada.');
  await repositorios.acordo_versao.atualizar(versaoId, { situacao: 'cancelada', cancelada_motivo: motivo.trim() }, { motivo: motivo.trim() });
}

/** Parte do conteúdo da mais recente. Só uma versão em andamento por vez, para não haver duas redações disputando. */
export async function novaVersao(acordoId: string): Promise<AcordoVersao> {
  const versoes = versoesDoAcordo(acordoId, await repositorios.acordo_versao.listar({ onde: { acordo_id: acordoId } }));
  const emAndamento = versoes.find(versaoEmAndamento);
  if (emAndamento) throw new ErroDeRegra(`A V${emAndamento.numero} ainda está em andamento. Conclua ou cancele antes de criar outra.`);
  const base = versoes.find((versao) => versao.situacao !== 'cancelada') ?? versoes[0];
  if (!base) throw new ErroDeRegra('Este acordo não tem versões.');
  return repositorios.acordo_versao.criar({ acordo_id: acordoId, numero: (versoes[0]?.numero ?? 0) + 1, situacao: 'rascunho', resumo: base.resumo, titularidade_numa: base.titularidade_numa, revisao_prevista: base.revisao_prevista, ...VAZIO });
}

// ---------- Diferenças entre versões (T06.03) ----------

export type DiferencaDoResumo = { campo: string; antes: string; depois: string };

type Nomes = { pessoas: readonly Pick<Pessoa, 'id' | 'nome_completo'>[]; entidades: readonly Pick<Entidade, 'id' | 'nome'>[] };

export const NAO_DEFINIDO_NO_ACORDO = 'Não definido';

/** Cada campo do resumo como aparece na ficha: é assim que a diferença também se lê. */
export function camposDoResumo(versao: Pick<AcordoVersao, 'resumo' | 'titularidade_numa' | 'revisao_prevista'>, { pessoas, entidades }: Nomes): { campo: string; rotulo: string; valor: string }[] {
  const { resumo } = versao;
  const nome = (id: string) => nomeDaPessoa(pessoas, id);
  const lista = (linhas: readonly string[]) => (linhas.length ? linhas.join(' · ') : NAO_DEFINIDO_NO_ACORDO);
  const entidade = entidades.find((item) => item.id === resumo.parte_entidade_id);
  const aportes = [resumo.aportes, ...resumo.aportes_valores.map((linha) => `${nome(linha.pessoa_id)}: ${formatarDinheiro(linha.valor, 'BRL')}`)].filter(Boolean) as string[];
  return [
    { campo: 'partes', rotulo: 'Partes', valor: lista([...resumo.partes.map(nome), ...(entidade ? [entidade.nome] : [])]) },
    { campo: 'participacao', rotulo: 'Participação', valor: lista(resumo.participacao.map((linha) => `${nome(linha.pessoa_id)}: ${textoDaParticipacao(linha.percentual)}`)) },
    { campo: 'aportes', rotulo: 'Aportes previstos', valor: lista(aportes) },
    { campo: 'dedicacao', rotulo: 'Dedicação', valor: lista(resumo.dedicacao.map((linha) => `${nome(linha.pessoa_id)}: ${linha.texto}`)) },
    { campo: 'decisao', rotulo: 'Regras de decisão', valor: resumo.decisao ?? NAO_DEFINIDO_NO_ACORDO },
    { campo: 'titularidade', rotulo: 'Titularidade de ativos e PI pertence à Numa', valor: versao.titularidade_numa ? 'Sim, prevista nesta versão' : 'Não prevista nesta versão' },
    { campo: 'destino_produtos', rotulo: 'Destino dos produtos em caso de saída', valor: resumo.destino_produtos ?? NAO_DEFINIDO_NO_ACORDO },
    { campo: 'saida', rotulo: 'Saída, não concorrência e confidencialidade', valor: resumo.saida ?? NAO_DEFINIDO_NO_ACORDO },
    { campo: 'revisao', rotulo: 'Vigência e revisão prevista', valor: versao.revisao_prevista ? formatarDiaISO(versao.revisao_prevista) : NAO_DEFINIDO_NO_ACORDO },
    { campo: 'observacoes', rotulo: 'Observações', valor: resumo.observacoes ?? NAO_DEFINIDO_NO_ACORDO },
  ];
}

export function diferencasEntreVersoes(anterior: Pick<AcordoVersao, 'resumo' | 'titularidade_numa' | 'revisao_prevista'>, atual: Pick<AcordoVersao, 'resumo' | 'titularidade_numa' | 'revisao_prevista'>, nomes: Nomes): DiferencaDoResumo[] {
  const antes = camposDoResumo(anterior, nomes);
  return camposDoResumo(atual, nomes).flatMap(({ campo, rotulo, valor }) => {
    const velho = antes.find((item) => item.campo === campo)?.valor ?? NAO_DEFINIDO_NO_ACORDO;
    return velho === valor ? [] : [{ campo: rotulo, antes: velho, depois: valor }];
  });
}
