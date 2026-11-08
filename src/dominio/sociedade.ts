/** Regras de T06.02 (08-M06): sócias, participação e saída. Investimento continua no Financeiro (T05.05). */
import { ErroDeRegra } from '@/dados/erros';
import { repositorios } from '@/dados/repositorios';
import { emTransacao } from '@/dados/transacao';
import type { Area, PessoaArea } from '@/dados/tipos/area';
import type { Decisao } from '@/dados/tipos/decisao';
import type { Pessoa } from '@/dados/tipos/pessoa';
import type { Acordo, AcordoVersao, ParticipacaoHistorico, Socia } from '@/dados/tipos/sociedade';
import { hojeISO } from '@/lib/datas';
import { errosDaDecisao, novaDecisaoVazia, resolverDecisao, type EntradaDecisao, type RegrasDaDecisao } from './decisoes';
import { proporcoesFecham } from './entidades';

export const MENSAGEM_SOMA_100 = 'As participações devem somar 100%.';

/** Decisão de participação é da Numa, não de um produto. */
export const REGRAS_DA_DECISAO_DE_PARTICIPACAO: RegrasDaDecisao = { produto_id: null, assunto: 'geral', qualquerProduto: true };

/** Quem conta para a soma (RN-06.01) e para as confirmações (RN-06.04). Saída no futuro ainda é sócia ativa. */
export function sociaEstaAtiva(socia: Pick<Socia, 'saida_em' | 'arquivado_em'>, hoje: string = hojeISO()): boolean {
  return !socia.arquivado_em && (!socia.saida_em || socia.saida_em > hoje);
}

export function sociasAtivas<T extends Pick<Socia, 'saida_em' | 'arquivado_em'>>(socias: readonly T[], hoje: string = hojeISO()): T[] {
  return socias.filter((socia) => sociaEstaAtiva(socia, hoje));
}

/** Até 4 casas, como `numeric(7,4)` (16 §4.6). Vazio ou inválido volta como `null`. */
export function lerParticipacao(texto: string): number | null {
  const limpo = texto.trim().replace('%', '').replace(',', '.').trim();
  if (!limpo) return null;
  const valor = Number(limpo);
  if (!Number.isFinite(valor) || valor < 0 || valor > 100) return null;
  return Math.round(valor * 10000) / 10000;
}

export function textoDaParticipacao(valor: number): string {
  return `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 4 })}%`;
}

export function somaDasParticipacoes(valores: readonly (number | null)[]): number {
  return Math.round(valores.reduce<number>((total, valor) => total + (valor ?? 0), 0) * 10000) / 10000;
}

// ---------- Dados ----------

export type DadosDaSociedade = {
  socias: Socia[];
  pessoas: Pessoa[];
  historico: ParticipacaoHistorico[];
  acordos: Acordo[];
  versoes: AcordoVersao[];
  decisoes: Decisao[];
  areas: Area[];
  ligacoes: PessoaArea[];
};

export async function carregarSociedade(): Promise<DadosDaSociedade> {
  const [socias, pessoas, historico, acordos, versoes, decisoes, areas, ligacoes] = await Promise.all([repositorios.socia.listar(), repositorios.pessoa.listar({ incluirArquivados: true }), repositorios.socia_participacao_historico.listar(), repositorios.acordo_societario.listar(), repositorios.acordo_versao.listar(), repositorios.decisao.listar(), repositorios.area.listar(), repositorios.pessoa_area.listar()]);
  return { socias, pessoas, historico, acordos, versoes, decisoes, areas, ligacoes };
}

export const nomeDaPessoa = (pessoas: readonly Pick<Pessoa, 'id' | 'nome_completo'>[], id: string | null | undefined) => pessoas.find((pessoa) => pessoa.id === id)?.nome_completo ?? 'Pessoa removida';

export type Fundamento = { texto: string; vigente: boolean; href: string | null };

/** O fundamento de uma participação, por extenso. Versão que não está vigente diz isso (T06.02). */
export function textoDoFundamento(alvo: Pick<Socia, 'acordo_versao_id' | 'decisao_id'>, { acordos, versoes, decisoes }: Pick<DadosDaSociedade, 'acordos' | 'versoes' | 'decisoes'>): Fundamento {
  const partes: string[] = [];
  let vigente = false;
  let href: string | null = null;
  const versao = versoes.find((item) => item.id === alvo.acordo_versao_id);
  if (versao) {
    const acordo = acordos.find((item) => item.id === versao.acordo_id);
    vigente = versao.situacao === 'vigente' || versao.situacao === 'substituida';
    href = `/empresa/acordos/${versao.acordo_id}`;
    partes.push(`${acordo?.titulo ?? 'Acordo removido'} V${versao.numero}${vigente ? '' : ' (ainda não vigente)'}`);
  }
  const decisao = decisoes.find((item) => item.id === alvo.decisao_id);
  if (decisao) {
    vigente = true;
    href ??= `/empresa/decisoes/${decisao.id}`;
    partes.push(`${decisao.codigo} · ${decisao.titulo}`);
  }
  return { texto: partes.join(' e ') || 'Não informado', vigente, href };
}

/** Só uma versão vigente fundamenta uma mudança (RN-06.02). */
export function versoesParaFundamento(versoes: readonly AcordoVersao[]): AcordoVersao[] {
  return versoes.filter((versao) => versao.situacao === 'vigente');
}

export function dedicacaoDaSocia(socia: Pick<Socia, 'pessoa_id' | 'acordo_versao_id' | 'dedicacao'>, versoes: readonly AcordoVersao[]): string | null {
  const doAcordo = versoes.find((versao) => versao.id === socia.acordo_versao_id)?.resumo.dedicacao.find((linha) => linha.pessoa_id === socia.pessoa_id)?.texto;
  return doAcordo?.trim() || socia.dedicacao || null;
}

export const TIPOS_QUE_DEFINEM_PARTICIPACAO: readonly Acordo['tipo'][] = ['memorando', 'acordo_socias', 'alteracao_contratual', 'ata'];

/** RN-06.02: o acordo vigente define a participação. O sistema avisa a diferença, e quem decide aplicar é a sócia. */
export function divergenciaDoAcordo({ socias, acordos, versoes }: Pick<DadosDaSociedade, 'socias' | 'acordos' | 'versoes'>, hoje: string = hojeISO()): { versao: AcordoVersao; acordo: Acordo } | null {
  const ativas = sociasAtivas(socias, hoje);
  const candidatas = versoes
    .filter((versao) => versao.situacao === 'vigente' && versao.resumo.participacao.length > 0)
    .flatMap((versao) => {
      const acordo = acordos.find((item) => item.id === versao.acordo_id);
      return acordo && TIPOS_QUE_DEFINEM_PARTICIPACAO.includes(acordo.tipo) ? [{ versao, acordo }] : [];
    })
    .sort((a, b) => (b.versao.data_assinatura ?? '').localeCompare(a.versao.data_assinatura ?? ''));
  const maisRecente = candidatas[0];
  if (!maisRecente) return null;
  const iguais = ativas.length === maisRecente.versao.resumo.participacao.length && ativas.every((socia) => maisRecente.versao.resumo.participacao.some((linha) => linha.pessoa_id === socia.pessoa_id && Math.abs(linha.percentual - socia.participacao) < 0.0001));
  return iguais ? null : maisRecente;
}

// ---------- Editar participação (CA-06.02) ----------

export type LinhaDeParticipacao = { pessoa_id: string; percentual: string };

export type FormularioParticipacao = {
  linhas: LinhaDeParticipacao[];
  fundamento_tipo: 'acordo' | 'decisao';
  acordo_versao_id: string;
  decisao: EntradaDecisao;
  vigente_desde: string;
};

/** As ativas e quem foi marcada como sócia em T02.02 e ainda não tem participação: vem vazia, para preencher. */
export function pessoasDaParticipacao({ socias, pessoas }: Pick<DadosDaSociedade, 'socias' | 'pessoas'>, hoje: string = hojeISO()): { pessoa_id: string; nome: string; atual: number | null }[] {
  const ativas = sociasAtivas(socias, hoje).map((socia) => ({ pessoa_id: socia.pessoa_id, nome: nomeDaPessoa(pessoas, socia.pessoa_id), atual: socia.participacao }));
  const novas = pessoas.filter((pessoa) => pessoa.eh_socia && pessoa.situacao === 'ativa' && !pessoa.arquivado_em && !socias.some((socia) => socia.pessoa_id === pessoa.id)).map((pessoa) => ({ pessoa_id: pessoa.id, nome: pessoa.nome_completo, atual: null }));
  return [...ativas, ...novas];
}

export function formularioDaParticipacao(dados: Pick<DadosDaSociedade, 'socias' | 'pessoas'>, pessoaAtualId: string, hoje: string = hojeISO()): FormularioParticipacao {
  return {
    linhas: pessoasDaParticipacao(dados, hoje).map(({ pessoa_id, atual }) => ({ pessoa_id, percentual: atual === null ? '' : String(atual).replace('.', ',') })),
    fundamento_tipo: 'acordo',
    acordo_versao_id: '',
    decisao: novaDecisaoVazia(hoje, [pessoaAtualId]),
    vigente_desde: hoje,
  };
}

type Conferencia = { hoje: string; ultimaVigencia: string | null };

export function ultimaVigencia(historico: readonly Pick<ParticipacaoHistorico, 'vigente_desde'>[]): string | null {
  return historico.reduce<string | null>((maior, linha) => (!maior || linha.vigente_desde > maior ? linha.vigente_desde : maior), null);
}

function errosDoFundamento(formulario: Pick<FormularioParticipacao, 'fundamento_tipo' | 'acordo_versao_id' | 'decisao'>, hoje: string): Record<string, string> {
  const erros: Record<string, string> = {};
  if (formulario.fundamento_tipo === 'acordo') {
    if (!formulario.acordo_versao_id) erros.acordo_versao_id = 'Escolha o acordo vigente que fundamenta a mudança.';
  } else {
    for (const [campo, mensagem] of Object.entries(errosDaDecisao(formulario.decisao, hoje))) erros[`decisao_${campo}`] = mensagem;
  }
  return erros;
}

function errosDaData(data: string, { hoje, ultimaVigencia: ultima }: Conferencia, campo: string, rotulo: string): Record<string, string> {
  if (!data) return { [campo]: `Informe a ${rotulo}.` };
  if (data > hoje) return { [campo]: 'Use hoje ou uma data passada.' };
  if (ultima && data < ultima) return { [campo]: 'Já existe mudança de participação depois dessa data.' };
  return {};
}

/** Por campo, para aparecer junto dele. CA-06.02: somar 90% não salva. */
export function errosDaParticipacao(formulario: FormularioParticipacao, conferencia: Conferencia): Record<string, string> {
  const erros: Record<string, string> = { ...errosDoFundamento(formulario, conferencia.hoje), ...errosDaData(formulario.vigente_desde, conferencia, 'vigente_desde', 'data de vigência') };
  const valores = formulario.linhas.map((linha) => lerParticipacao(linha.percentual));
  formulario.linhas.forEach((linha, indice) => {
    const valor = valores[indice] ?? null;
    if (valor === null) erros[`participacao_${linha.pessoa_id}`] = 'Informe um percentual de 0 a 100.';
    else if (valor === 0) erros[`participacao_${linha.pessoa_id}`] = 'Para tirar uma sócia, use Registrar saída.';
  });
  if (!proporcoesFecham(valores)) erros.total = MENSAGEM_SOMA_100;
  return erros;
}

async function resolverFundamento(formulario: Pick<FormularioParticipacao, 'fundamento_tipo' | 'acordo_versao_id' | 'decisao'>, hoje: string): Promise<{ acordo_versao_id: string | null; decisao_id: string | null }> {
  if (formulario.fundamento_tipo === 'decisao') return { acordo_versao_id: null, decisao_id: (await resolverDecisao(formulario.decisao, REGRAS_DA_DECISAO_DE_PARTICIPACAO, hoje)).id };
  const versao = await repositorios.acordo_versao.obter(formulario.acordo_versao_id);
  if (versao?.situacao !== 'vigente') throw new ErroDeRegra('Esse acordo não está vigente. Escolha outro ou registre uma decisão.');
  return { acordo_versao_id: versao.id, decisao_id: null };
}

const primeiroErro = (erros: Readonly<Record<string, string>>) => Object.values(erros)[0];

/** RN-06.01 e RN-06.02: grava as novas participações e uma linha de histórico por sócia, de uma vez. */
export async function alterarParticipacao(formulario: FormularioParticipacao, hoje: string = hojeISO()): Promise<void> {
  const historico = await repositorios.socia_participacao_historico.listar();
  const erro = primeiroErro(errosDaParticipacao(formulario, { hoje, ultimaVigencia: ultimaVigencia(historico) }));
  if (erro) throw new ErroDeRegra(erro);
  const socias = await repositorios.socia.listar();
  const mudou = formulario.linhas.some((linha) => socias.find((socia) => socia.pessoa_id === linha.pessoa_id && sociaEstaAtiva(socia, hoje))?.participacao !== lerParticipacao(linha.percentual));
  if (!mudou) throw new ErroDeRegra('As participações são as mesmas de hoje: não há o que registrar.');
  await emTransacao(async () => {
    const fundamento = await resolverFundamento(formulario, hoje);
    const motivo = 'Participação alterada com fundamento vinculado.';
    for (const linha of formulario.linhas) {
      const participacao = lerParticipacao(linha.percentual) as number;
      const atual = socias.find((socia) => socia.pessoa_id === linha.pessoa_id);
      if (atual) await repositorios.socia.atualizar(atual.id, { participacao, ...fundamento }, { motivo });
      else await repositorios.socia.criar({ pessoa_id: linha.pessoa_id, participacao, entrada_em: formulario.vigente_desde, saida_em: null, dedicacao: null, ...fundamento });
      await repositorios.socia_participacao_historico.criar({ pessoa_id: linha.pessoa_id, participacao, vigente_desde: formulario.vigente_desde, ...fundamento });
    }
  });
}

// ---------- Registrar saída ----------

export type FormularioSaida = Omit<FormularioParticipacao, 'vigente_desde'> & { pessoa_id: string; data: string; motivo: string };

export function formularioDaSaida(dados: Pick<DadosDaSociedade, 'socias' | 'pessoas'>, pessoaId: string, pessoaAtualId: string, hoje: string = hojeISO()): FormularioSaida {
  const { vigente_desde: _data, ...base } = formularioDaParticipacao(dados, pessoaAtualId, hoje);
  return { ...base, linhas: base.linhas.filter((linha) => linha.pessoa_id !== pessoaId), pessoa_id: pessoaId, data: hoje, motivo: '' };
}

export function errosDaSaida(formulario: FormularioSaida, conferencia: Conferencia): Record<string, string> {
  const erros: Record<string, string> = { ...errosDoFundamento(formulario, conferencia.hoje), ...errosDaData(formulario.data, conferencia, 'data', 'data de saída') };
  if (!formulario.motivo.trim()) erros.motivo = 'Informe o motivo da saída.';
  if (!formulario.linhas.length) {
    erros.total = 'A Numa precisa de pelo menos uma sócia ativa.';
    return erros;
  }
  const valores = formulario.linhas.map((linha) => lerParticipacao(linha.percentual));
  formulario.linhas.forEach((linha, indice) => {
    const valor = valores[indice] ?? null;
    if (valor === null || valor === 0) erros[`participacao_${linha.pessoa_id}`] = 'Informe um percentual maior que zero.';
  });
  if (!proporcoesFecham(valores)) erros.total = 'As participações de quem fica devem somar 100%.';
  return erros;
}

/** A saída não apaga nada: a pessoa continua no cadastro e no Financeiro, e a participação dela fica no histórico. */
export async function registrarSaida(formulario: FormularioSaida, hoje: string = hojeISO()): Promise<void> {
  const historico = await repositorios.socia_participacao_historico.listar();
  const erro = primeiroErro(errosDaSaida(formulario, { hoje, ultimaVigencia: ultimaVigencia(historico) }));
  if (erro) throw new ErroDeRegra(erro);
  const socias = await repositorios.socia.listar();
  const quemSai = socias.find((socia) => socia.pessoa_id === formulario.pessoa_id && sociaEstaAtiva(socia, hoje));
  if (!quemSai) throw new ErroDeRegra('Esta sócia já não está ativa.');
  await emTransacao(async () => {
    const fundamento = await resolverFundamento(formulario, hoje);
    await repositorios.socia.atualizar(quemSai.id, { saida_em: formulario.data, participacao: 0, ...fundamento }, { motivo: formulario.motivo.trim() });
    await repositorios.socia_participacao_historico.criar({ pessoa_id: quemSai.pessoa_id, participacao: 0, vigente_desde: formulario.data, ...fundamento });
    for (const linha of formulario.linhas) {
      const participacao = lerParticipacao(linha.percentual) as number;
      const atual = socias.find((socia) => socia.pessoa_id === linha.pessoa_id);
      if (atual) await repositorios.socia.atualizar(atual.id, { participacao, ...fundamento }, { motivo: `Saída de sócia: ${formulario.motivo.trim()}` });
      else await repositorios.socia.criar({ pessoa_id: linha.pessoa_id, participacao, entrada_em: formulario.data, saida_em: null, dedicacao: null, ...fundamento });
      await repositorios.socia_participacao_historico.criar({ pessoa_id: linha.pessoa_id, participacao, vigente_desde: formulario.data, ...fundamento });
    }
  });
}

/** A data de entrada vem vazia na carga: só Kimberly sabe (RT-08). */
export async function salvarEntradaDaSocia(id: string, entrada: string, hoje: string = hojeISO()): Promise<void> {
  if (!entrada) throw new ErroDeRegra('Informe a data de entrada.');
  if (entrada > hoje) throw new ErroDeRegra('Use hoje ou uma data passada.');
  await repositorios.socia.atualizar(id, { entrada_em: entrada });
}

export type MudancaDeParticipacao = { id: string; vigente_desde: string; linhas: { pessoa_id: string; nome: string; participacao: number }[]; fundamento: Fundamento };

/** A linha do tempo de T06.02: as linhas da mesma mudança ficam juntas, a mais recente primeiro. */
export function linhaDoTempoDaParticipacao({ historico, pessoas, acordos, versoes, decisoes }: Pick<DadosDaSociedade, 'historico' | 'pessoas' | 'acordos' | 'versoes' | 'decisoes'>): MudancaDeParticipacao[] {
  const grupos = new Map<string, ParticipacaoHistorico[]>();
  for (const linha of historico) {
    const chave = `${linha.vigente_desde}|${linha.acordo_versao_id ?? ''}|${linha.decisao_id ?? ''}|${linha.criado_em.slice(0, 19)}`;
    grupos.set(chave, [...(grupos.get(chave) ?? []), linha]);
  }
  return [...grupos.entries()]
    .map(([chave, linhas]) => {
      const primeira = linhas[0] as ParticipacaoHistorico;
      return { id: chave, vigente_desde: primeira.vigente_desde, criado_em: primeira.criado_em, linhas: linhas.map((linha) => ({ pessoa_id: linha.pessoa_id, nome: nomeDaPessoa(pessoas, linha.pessoa_id), participacao: linha.participacao })), fundamento: textoDoFundamento(primeira, { acordos, versoes, decisoes }) };
    })
    .sort((a, b) => b.vigente_desde.localeCompare(a.vigente_desde) || b.criado_em.localeCompare(a.criado_em))
    .map(({ criado_em: _criado, ...mudanca }) => mudanca);
}
