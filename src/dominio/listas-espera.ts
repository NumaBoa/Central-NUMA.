/**
 * Regras de T08.07 (10-M08): listas de espera, consentimento versionado e inscritos. A Central organiza,
 * não envia mensagem nenhuma. Situação é o que está em `inscrito.situacao`; "Pendente de consentimento" é
 * elegibilidade calculada, nunca um estado gravado.
 */
import { z } from 'zod';
import { ErroDeRegra } from '@/dados/erros';
import { registrarEvento } from '@/dados/historico';
import { repositorios } from '@/dados/repositorios';
import { idDaPessoaAtual } from '@/dados/sessao';
import { emTransacao } from '@/dados/transacao';
import type { TratamentoDados } from '@/dados/tipos/legal';
import type { Marca, Produto } from '@/dados/tipos/marca';
import { ORIGENS_DE_INSCRITO, type Campanha, type ConsentimentoTexto, type Inscrito, type ListaEspera, type SituacaoDoInscrito } from '@/dados/tipos/marketing';
import { gerarCsv } from '@/lib/csv';
import { hojeISO } from '@/lib/datas';
import { formatarDiaISO } from '@/lib/formatacao';
import { lerCsv } from '@/lib/ler-csv';
import { podeExportarInscritos } from './classes';
import { normalizarTexto } from './duplicidade';
import { somarDias } from './repeticao';

export const ROTULOS_SITUACAO_INSCRITO: Readonly<Record<SituacaoDoInscrito, string>> = { ativo: 'Ativo', descadastrado: 'Descadastrado', convidado: 'Convidado', convertido: 'Convertido' };
export const ROTULOS_ORIGEM_INSCRITO: Readonly<Record<(typeof ORIGENS_DE_INSCRITO)[number], string>> = { site: 'Site', rede_social: 'Rede social', evento: 'Evento', indicacao: 'Indicação', outro: 'Outro' };

export type Elegibilidade = 'apto' | 'pendente_consentimento' | 'descadastrado';
export const ROTULOS_ELEGIBILIDADE: Readonly<Record<Elegibilidade, string>> = { apto: 'Apto para marketing', pendente_consentimento: 'Pendente de consentimento', descadastrado: 'Não recebe: descadastrado' };

/** RN-08.09: sem consentimento registrado, não recebe marketing. Descadastro vale para sempre naquela lista. */
export function elegibilidadeDoInscrito(inscrito: Pick<Inscrito, 'situacao' | 'consentimento_versao_id' | 'consentido_em'>): Elegibilidade {
  if (inscrito.situacao === 'descadastrado') return 'descadastrado';
  return inscrito.consentimento_versao_id && inscrito.consentido_em ? 'apto' : 'pendente_consentimento';
}

export const normalizarEmail = (email: string) => email.trim().toLowerCase();

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const emailValido = (email: string) => EMAIL_VALIDO.test(email.trim());

export type ContadoresDaLista = { total: number; ativos: number; convidados: number; convertidos: number; descadastrados: number; aptos: number; pendentes: number };

/**
 * Cada inscrito conta em uma só situação: ativos + convidados + convertidos + descadastrados = total.
 * Aptos e pendentes são outra leitura dos mesmos inscritos, e nunca se somam às situações.
 */
export function contadoresDaLista(inscritos: readonly Pick<Inscrito, 'situacao' | 'consentimento_versao_id' | 'consentido_em' | 'arquivado_em'>[]): ContadoresDaLista {
  const usados = inscritos.filter((inscrito) => !inscrito.arquivado_em);
  const conta = (situacao: SituacaoDoInscrito) => usados.filter((inscrito) => inscrito.situacao === situacao).length;
  return {
    total: usados.length,
    ativos: conta('ativo'),
    convidados: conta('convidado'),
    convertidos: conta('convertido'),
    descadastrados: conta('descadastrado'),
    aptos: usados.filter((inscrito) => elegibilidadeDoInscrito(inscrito) === 'apto').length,
    pendentes: usados.filter((inscrito) => elegibilidadeDoInscrito(inscrito) === 'pendente_consentimento').length,
  };
}

const contar = (quantos: number, singular: string, plural: string) => `${quantos} ${quantos === 1 ? singular : plural}`;

/** Situações primeiro, porque somam o total; a elegibilidade é outra leitura das mesmas pessoas. */
export function textoDaContagem({ total, ativos, convidados, convertidos, descadastrados, aptos, pendentes }: ContadoresDaLista): string {
  return `${contar(total, 'pessoa', 'pessoas')}: ${contar(ativos, 'ativa', 'ativas')}, ${contar(convidados, 'convidada', 'convidadas')}, ${contar(convertidos, 'convertida', 'convertidas')} e ${contar(descadastrados, 'descadastrada', 'descadastradas')}. Para marketing: ${contar(aptos, 'apta', 'aptas')} e ${contar(pendentes, 'pendente', 'pendentes')} de consentimento.`;
}

// ---------- Listas e textos de consentimento ----------

const curto = z.string().trim();

export const esquemaFormularioLista = z.object({
  produto_id: z.string().min(1, 'Escolha o produto.'),
  nome: curto.min(1, 'Dê um nome à lista.'),
  texto: curto.min(1, 'Sem o texto de consentimento, ninguém pode consentir.'),
  vigente_desde: z.string().min(1, 'Informe desde quando o texto vale.'),
});
export type FormularioLista = z.infer<typeof esquemaFormularioLista>;

export const esquemaNovoTexto = z.object({ texto: curto.min(1, 'Escreva o novo texto.'), vigente_desde: z.string().min(1, 'Informe desde quando o texto vale.') });
export type FormularioNovoTexto = z.infer<typeof esquemaNovoTexto>;

export async function criarLista(formulario: FormularioLista): Promise<ListaEspera> {
  const dados = esquemaFormularioLista.parse(formulario);
  const existentes = await repositorios.lista_espera.listar({ onde: { produto_id: dados.produto_id }, incluirArquivados: true });
  if (existentes.some((lista) => normalizarTexto(lista.nome) === normalizarTexto(dados.nome))) throw new ErroDeRegra('Já existe uma lista com esse nome neste produto.');
  return emTransacao(async () => {
    const lista = await repositorios.lista_espera.criar({ produto_id: dados.produto_id, nome: dados.nome, situacao: 'ativa' });
    await repositorios.consentimento_texto.criar({ lista_id: lista.id, versao: 1, texto: dados.texto, vigente_desde: dados.vigente_desde });
    return lista;
  });
}

export async function renomearLista(id: string, nome: string): Promise<void> {
  const limpo = nome.trim();
  if (!limpo) throw new ErroDeRegra('Dê um nome à lista.');
  const lista = await repositorios.lista_espera.obter(id);
  const existentes = await repositorios.lista_espera.listar({ onde: { produto_id: lista?.produto_id ?? '' }, incluirArquivados: true });
  if (existentes.some((item) => item.id !== id && normalizarTexto(item.nome) === normalizarTexto(limpo))) throw new ErroDeRegra('Já existe uma lista com esse nome neste produto.');
  await repositorios.lista_espera.atualizar(id, { nome: limpo });
}

export async function mudarSituacaoDaLista(id: string, situacao: ListaEspera['situacao']): Promise<void> {
  await repositorios.lista_espera.atualizar(id, { situacao });
}

/** Um texto aceito não muda: mudar é publicar outra versão, e quem aceitou a anterior continua com ela. */
export async function publicarNovoTexto(listaId: string, formulario: FormularioNovoTexto): Promise<ConsentimentoTexto> {
  const dados = esquemaNovoTexto.parse(formulario);
  const textos = await repositorios.consentimento_texto.listar({ onde: { lista_id: listaId }, incluirArquivados: true });
  const atual = textoVigente(textos, '9999-12-31');
  if (atual && dados.vigente_desde < atual.vigente_desde) throw new ErroDeRegra(`A nova versão não pode valer antes da versão ${atual.versao} (${formatarDiaISO(atual.vigente_desde)}).`);
  const numero = Math.max(0, ...textos.map((texto) => texto.versao)) + 1;
  return repositorios.consentimento_texto.criar({ lista_id: listaId, versao: numero, texto: dados.texto, vigente_desde: dados.vigente_desde });
}

/** A maior versão que já vale naquela data. */
export function textoVigente<T extends Pick<ConsentimentoTexto, 'versao' | 'vigente_desde'>>(textos: readonly T[], dia: string): T | null {
  return textos.filter((texto) => texto.vigente_desde <= dia).sort((a, b) => b.versao - a.versao)[0] ?? null;
}

// ---------- Inscritos ----------

export const esquemaFormularioInscrito = z
  .object({
    nome: curto,
    email: curto,
    origem: z.string(),
    campanha_id: z.string(),
    consentimento_versao_id: z.string(),
    consentido_em: z.string(),
  })
  .superRefine((dados, contexto) => {
    const falha = (campo: string, message: string) => contexto.addIssue({ code: 'custom', path: [campo], message });
    if (!emailValido(dados.email)) falha('email', 'Informe um e-mail válido.');
    if (dados.consentimento_versao_id && !dados.consentido_em) falha('consentido_em', 'Informe quando a pessoa consentiu.');
    if (!dados.consentimento_versao_id && dados.consentido_em) falha('consentimento_versao_id', 'Diga qual versão do texto a pessoa aceitou.');
    if (dados.consentido_em && dados.consentido_em > hojeISO()) falha('consentido_em', 'O consentimento não pode estar no futuro.');
  });
export type FormularioInscrito = z.infer<typeof esquemaFormularioInscrito>;

export const FORMULARIO_INSCRITO_VAZIO: FormularioInscrito = { nome: '', email: '', origem: '', campanha_id: '', consentimento_versao_id: '', consentido_em: '' };

const MENSAGEM_DESCADASTRADO = 'Esse e-mail se descadastrou desta lista e não pode voltar (RN-08.09).';

function novoInscrito(listaId: string, dados: { nome: string | null; email: string; origem: Inscrito['origem']; campanha_id: string | null; consentimento_versao_id: string | null; consentido_em: string | null }) {
  return { lista_id: listaId, ...dados, email: dados.email.trim(), email_normalizado: normalizarEmail(dados.email), situacao: 'ativo' as const, descadastrado_em: null, convidado_em: null, convertido_em: null };
}

function conferirVersao(textos: readonly ConsentimentoTexto[], versaoId: string, data: string) {
  const texto = textos.find((item) => item.id === versaoId);
  if (!texto) throw new ErroDeRegra('Essa versão do texto não é desta lista.');
  if (data < texto.vigente_desde) throw new ErroDeRegra(`A versão ${texto.versao} só vale desde ${formatarDiaISO(texto.vigente_desde)}.`);
}

/** Inclusão manual: sem consentimento, entra e fica sem elegibilidade até ele ser registrado. */
export async function adicionarInscrito(listaId: string, formulario: FormularioInscrito): Promise<Inscrito> {
  const dados = esquemaFormularioInscrito.parse(formulario);
  const [existentes, textos, lista] = await Promise.all([repositorios.inscrito.listar({ onde: { lista_id: listaId }, incluirArquivados: true }), repositorios.consentimento_texto.listar({ onde: { lista_id: listaId } }), repositorios.lista_espera.obter(listaId)]);
  if (lista?.situacao === 'encerrada') throw new ErroDeRegra('Esta lista está encerrada. Reabra para incluir pessoas.');
  const igual = existentes.find((inscrito) => inscrito.email_normalizado === normalizarEmail(dados.email));
  if (igual?.situacao === 'descadastrado') throw new ErroDeRegra(MENSAGEM_DESCADASTRADO);
  if (igual) throw new ErroDeRegra('Esse e-mail já está nesta lista.');
  if (dados.consentimento_versao_id) conferirVersao(textos, dados.consentimento_versao_id, dados.consentido_em);
  return repositorios.inscrito.criar(novoInscrito(listaId, { nome: dados.nome || null, email: dados.email, origem: dados.origem ? (dados.origem as Inscrito['origem']) : null, campanha_id: dados.campanha_id || null, consentimento_versao_id: dados.consentimento_versao_id || null, consentido_em: dados.consentido_em || null }));
}

/** Para quem entrou sem consentimento. Quem já consentiu fica com o registro original. */
export async function registrarConsentimento(inscritoId: string, versaoId: string, data: string): Promise<void> {
  const inscrito = await repositorios.inscrito.obter(inscritoId);
  if (!inscrito) throw new ErroDeRegra('Essa pessoa não está mais na lista.');
  if (inscrito.situacao === 'descadastrado') throw new ErroDeRegra(MENSAGEM_DESCADASTRADO);
  if (!versaoId || !data) throw new ErroDeRegra('Informe a versão do texto e a data.');
  if (data > hojeISO()) throw new ErroDeRegra('O consentimento não pode estar no futuro.');
  conferirVersao(await repositorios.consentimento_texto.listar({ onde: { lista_id: inscrito.lista_id } }), versaoId, data);
  await repositorios.inscrito.atualizar(inscritoId, { consentimento_versao_id: versaoId, consentido_em: data });
}

/** Em lote. Convite é comunicação de marketing: só quem é ativo e tem consentimento. */
export async function marcarConvidados(ids: readonly string[], hoje: string = hojeISO()): Promise<{ marcados: number; ignorados: number }> {
  return emTransacao(async () => {
    let marcados = 0;
    for (const id of ids) {
      const inscrito = await repositorios.inscrito.obter(id);
      if (!inscrito || inscrito.situacao !== 'ativo' || elegibilidadeDoInscrito(inscrito) !== 'apto') continue;
      await repositorios.inscrito.atualizar(id, { situacao: 'convidado', convidado_em: hoje });
      marcados += 1;
    }
    return { marcados, ignorados: ids.length - marcados };
  });
}

export async function marcarConvertido(id: string, hoje: string = hojeISO()): Promise<void> {
  const inscrito = await repositorios.inscrito.obter(id);
  if (!inscrito) throw new ErroDeRegra('Essa pessoa não está mais na lista.');
  if (inscrito.situacao === 'descadastrado') throw new ErroDeRegra(MENSAGEM_DESCADASTRADO);
  await repositorios.inscrito.atualizar(id, { situacao: 'convertido', convertido_em: hoje });
}

/** Permanente para aquela lista: não existe ação de voltar (RN-08.09). */
export async function descadastrar(id: string, hoje: string = hojeISO()): Promise<void> {
  await repositorios.inscrito.atualizar(id, { situacao: 'descadastrado', descadastrado_em: hoje });
}

// ---------- Importação (RT-24, CA-08.03, CA-08.04) ----------

const COLUNAS_ACEITAS: Readonly<Record<string, readonly string[]>> = {
  email: ['email', 'e-mail'],
  nome: ['nome'],
  origem: ['origem'],
  versao: ['consentimento_versao', 'versao', 'versao do consentimento', 'versao do texto'],
  data: ['consentido_em', 'data do consentimento', 'data_consentimento', 'consentimento_data'],
  campanha: ['campanha', 'campanha_codigo'],
};

function colunaDe(cabecalho: readonly string[], nome: keyof typeof COLUNAS_ACEITAS & string): number {
  const nomes = cabecalho.map((coluna) => normalizarTexto(coluna).trim());
  return nomes.findIndex((coluna) => COLUNAS_ACEITAS[nome]?.includes(coluna));
}

function lerData(texto: string): string | null {
  const limpo = texto.trim();
  const brasileira = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(limpo);
  const iso = brasileira ? `${brasileira[3]}-${brasileira[2]}-${brasileira[1]}` : limpo;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const data = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === iso ? iso : null;
}

function lerOrigem(texto: string): Inscrito['origem'] {
  const limpo = normalizarTexto(texto).trim();
  if (!limpo) return null;
  const achada = ORIGENS_DE_INSCRITO.find((origem) => origem === limpo.replace(/\s+/g, '_') || normalizarTexto(ROTULOS_ORIGEM_INSCRITO[origem]) === limpo);
  return achada ?? 'outro';
}

export type ResultadoDaLinha = 'novo' | 'consentimento' | 'ja_inscrito' | 'descadastrado' | 'erro';
export const ROTULOS_RESULTADO_DA_LINHA: Readonly<Record<ResultadoDaLinha, string>> = { novo: 'Entra na lista', consentimento: 'Registra o consentimento', ja_inscrito: 'Já está na lista', descadastrado: 'Descadastrado: não volta', erro: 'Erro' };

export type LinhaDaImportacao = { numero: number; email: string; nome: string | null; origem: Inscrito['origem']; campanhaId: string | null; versaoId: string | null; consentidoEm: string | null; resultado: ResultadoDaLinha; mensagem: string | null; inscritoId: string | null };
export type PreviaDaImportacao = { erroGeral: string | null; linhas: LinhaDaImportacao[]; resumo: Record<ResultadoDaLinha, number> };

const RESUMO_VAZIO: Record<ResultadoDaLinha, number> = { novo: 0, consentimento: 0, ja_inscrito: 0, descadastrado: 0, erro: 0 };

/** Só lê e confere: nada é gravado antes de confirmar. */
export function previaDaImportacao(csv: string, textos: readonly ConsentimentoTexto[], existentes: readonly Inscrito[], campanhas: readonly Pick<Campanha, 'id' | 'codigo' | 'nome'>[], hoje: string = hojeISO()): PreviaDaImportacao {
  const { cabecalho, linhas } = lerCsv(csv);
  const email = colunaDe(cabecalho, 'email');
  const versao = colunaDe(cabecalho, 'versao');
  const data = colunaDe(cabecalho, 'data');
  const faltam = [email < 0 ? 'e-mail' : null, versao < 0 ? 'versão do consentimento' : null, data < 0 ? 'data do consentimento' : null].filter(Boolean);
  if (faltam.length) return { erroGeral: `Importação bloqueada: faltam as colunas ${faltam.join(', ')}. Sem elas, não há como provar o consentimento.`, linhas: [], resumo: { ...RESUMO_VAZIO } };
  if (!linhas.length) return { erroGeral: 'O arquivo não tem nenhuma linha depois do cabeçalho.', linhas: [], resumo: { ...RESUMO_VAZIO } };

  const nome = colunaDe(cabecalho, 'nome');
  const origem = colunaDe(cabecalho, 'origem');
  const campanha = colunaDe(cabecalho, 'campanha');
  const vistos = new Map<string, number>();
  const celula = (celulas: readonly string[], indice: number) => (indice >= 0 ? (celulas[indice] ?? '').trim() : '');

  const resultado = linhas.map(({ numero, celulas }): LinhaDaImportacao => {
    const emailDaLinha = celula(celulas, email);
    const normalizado = normalizarEmail(emailDaLinha);
    const textoVersao = celula(celulas, versao).replace(/^v/i, '');
    const textoData = celula(celulas, data);
    const textoCampanha = celula(celulas, campanha);
    const consentidoEm = lerData(textoData);
    const texto = textos.find((item) => String(item.versao) === textoVersao);
    const achadaCampanha = campanhas.find((item) => normalizarTexto(item.codigo) === normalizarTexto(textoCampanha) || normalizarTexto(item.nome) === normalizarTexto(textoCampanha));
    const base = { numero, email: emailDaLinha, nome: celula(celulas, nome) || null, origem: lerOrigem(celula(celulas, origem)), campanhaId: achadaCampanha?.id ?? null, versaoId: texto?.id ?? null, consentidoEm, inscritoId: null };
    const erro = (mensagem: string): LinhaDaImportacao => ({ ...base, resultado: 'erro', mensagem });
    if (!emailValido(emailDaLinha)) return erro('E-mail inválido.');
    const repetido = vistos.get(normalizado);
    if (repetido) return erro(`Repete o e-mail da linha ${repetido}.`);
    vistos.set(normalizado, numero);
    const igual = existentes.find((inscrito) => inscrito.email_normalizado === normalizado);
    // CA-08.04: vem antes de qualquer outra conferência: o descadastro nunca é revertido.
    if (igual?.situacao === 'descadastrado') return { ...base, inscritoId: igual.id, resultado: 'descadastrado', mensagem: 'Continua descadastrado.' };
    if (!textoVersao || !textoData) return erro('Sem versão ou data do consentimento.');
    if (!consentidoEm) return erro('Data do consentimento inválida. Use dd/mm/aaaa.');
    if (consentidoEm > hoje) return erro('A data do consentimento está no futuro.');
    if (!texto) return erro(`Esta lista não tem a versão ${textoVersao} do texto.`);
    if (consentidoEm < texto.vigente_desde) return erro(`A versão ${texto.versao} só vale desde ${formatarDiaISO(texto.vigente_desde)}.`);
    if (textoCampanha && !achadaCampanha) return erro(`Não há campanha "${textoCampanha}".`);
    if (igual?.consentimento_versao_id) return { ...base, inscritoId: igual.id, resultado: 'ja_inscrito', mensagem: 'Fica como está.' };
    if (igual) return { ...base, inscritoId: igual.id, resultado: 'consentimento', mensagem: null };
    return { ...base, resultado: 'novo', mensagem: null };
  });
  const resumo = { ...RESUMO_VAZIO };
  for (const linha of resultado) resumo[linha.resultado] += 1;
  return { erroGeral: null, linhas: resultado, resumo };
}

/** Grava o que a prévia aprovou, conferindo o descadastro de novo. A auditoria guarda quantos, não quem. */
export async function confirmarImportacao(listaId: string, previa: PreviaDaImportacao): Promise<{ novos: number; consentimentos: number }> {
  if (previa.erroGeral) throw new ErroDeRegra(previa.erroGeral);
  const resultado = await emTransacao(async () => {
    const existentes = await repositorios.inscrito.listar({ onde: { lista_id: listaId }, incluirArquivados: true });
    let novos = 0;
    let consentimentos = 0;
    for (const linha of previa.linhas) {
      if (linha.resultado !== 'novo' && linha.resultado !== 'consentimento') continue;
      const igual = existentes.find((inscrito) => inscrito.email_normalizado === normalizarEmail(linha.email));
      if (igual?.situacao === 'descadastrado') continue;
      if (igual) {
        if (!igual.consentimento_versao_id) {
          await repositorios.inscrito.atualizar(igual.id, { consentimento_versao_id: linha.versaoId, consentido_em: linha.consentidoEm });
          consentimentos += 1;
        }
        continue;
      }
      await repositorios.inscrito.criar(novoInscrito(listaId, { nome: linha.nome, email: linha.email, origem: linha.origem, campanha_id: linha.campanhaId, consentimento_versao_id: linha.versaoId, consentido_em: linha.consentidoEm }));
      novos += 1;
    }
    return { novos, consentimentos };
  });
  registrarEvento({ usuarioId: idDaPessoaAtual(), acao: 'executou_acao', tabela: 'lista_espera', registroId: listaId, depois: { funcao: 'importar_inscritos', novos: resultado.novos, consentimentos: resultado.consentimentos, descadastrados_mantidos: previa.resumo.descadastrado, erros: previa.resumo.erro } });
  return resultado;
}

// ---------- Exportação (RN-08.10) ----------

export const MODELO_DE_IMPORTACAO = 'nome;email;origem;consentimento_versao;consentido_em;campanha\n';

/** Devolve o CSV e registra quem exportou, quantos e de qual lista: nunca os e-mails. */
export function exportarInscritos(lista: Pick<ListaEspera, 'id' | 'nome'>, inscritos: readonly Inscrito[], textos: readonly ConsentimentoTexto[], campanhas: readonly Pick<Campanha, 'id' | 'nome'>[]): string {
  if (!podeExportarInscritos()) throw new ErroDeRegra('Você não tem permissão para exportar inscritos.');
  const linhas = inscritos.map((inscrito) => [
    inscrito.nome ?? '',
    inscrito.email,
    inscrito.origem ? ROTULOS_ORIGEM_INSCRITO[inscrito.origem] : '',
    campanhas.find((campanha) => campanha.id === inscrito.campanha_id)?.nome ?? '',
    inscrito.consentido_em ? formatarDiaISO(inscrito.consentido_em) : '',
    textos.find((texto) => texto.id === inscrito.consentimento_versao_id)?.versao.toString() ?? '',
    ROTULOS_SITUACAO_INSCRITO[inscrito.situacao],
    ROTULOS_ELEGIBILIDADE[elegibilidadeDoInscrito(inscrito)],
  ]);
  const csv = gerarCsv(['Nome', 'E-mail', 'Origem', 'Campanha', 'Consentiu em', 'Versão do texto', 'Situação', 'Elegibilidade'], linhas);
  registrarEvento({ usuarioId: idDaPessoaAtual(), acao: 'exportou', tabela: 'lista_espera', registroId: lista.id, depois: { funcao: 'exportar_inscritos', lista: lista.nome, quantidade: inscritos.length } });
  return csv;
}

// ---------- Carga, filtros e indicadores ----------

export type DadosDasListas = {
  listas: ListaEspera[];
  textos: ConsentimentoTexto[];
  inscritos: Inscrito[];
  produtos: Produto[];
  marcas: Marca[];
  campanhas: Campanha[];
  tratamentos: TratamentoDados[];
};

export async function carregarListas(): Promise<DadosDasListas> {
  const [listas, textos, inscritos, produtos, marcas, campanhas, tratamentos] = await Promise.all([
    repositorios.lista_espera.listar({ incluirArquivados: true }),
    repositorios.consentimento_texto.listar(),
    repositorios.inscrito.listar(),
    repositorios.produto.listar({ incluirArquivados: true }),
    repositorios.marca.listar({ incluirArquivados: true }),
    repositorios.campanha.listar({ incluirArquivados: true }),
    repositorios.tratamento_dados.listar(),
  ]);
  return { listas, textos, inscritos, produtos, marcas, campanhas, tratamentos };
}

/** RN-08.10: inscritos entram no inventário de dados do M09. É lá que se cadastra; aqui só se confere. */
export function tratamentosDaLista(lista: Pick<ListaEspera, 'produto_id'>, tratamentos: readonly Pick<TratamentoDados, 'id' | 'nome' | 'produto_id' | 'titulares' | 'arquivado_em'>[]) {
  return tratamentos.filter((tratamento) => !tratamento.arquivado_em && tratamento.titulares.includes('inscritos_lista') && (tratamento.produto_id === lista.produto_id || tratamento.produto_id === null));
}

export const inscritosDaLista = (listaId: string, inscritos: readonly Inscrito[]) => inscritos.filter((inscrito) => inscrito.lista_id === listaId);

export type FiltrosInscritos = { busca: string; situacao: string; origem: string; elegibilidade: string; campanha: string };
export const FILTROS_INSCRITOS_INICIAIS: FiltrosInscritos = { busca: '', situacao: '', origem: '', elegibilidade: '', campanha: '' };

export function filtrarInscritos(inscritos: readonly Inscrito[], filtros: FiltrosInscritos): Inscrito[] {
  const texto = normalizarTexto(filtros.busca);
  return inscritos
    .filter((inscrito) => {
      if (texto && !normalizarTexto(`${inscrito.nome ?? ''} ${inscrito.email}`).includes(texto)) return false;
      if (filtros.situacao && inscrito.situacao !== filtros.situacao) return false;
      if (filtros.origem && inscrito.origem !== filtros.origem) return false;
      if (filtros.elegibilidade && elegibilidadeDoInscrito(inscrito) !== filtros.elegibilidade) return false;
      if (filtros.campanha && inscrito.campanha_id !== filtros.campanha) return false;
      return true;
    })
    .sort((a, b) => b.criado_em.localeCompare(a.criado_em) || a.email.localeCompare(b.email));
}

/** Por origem, da maior para a menor. Quem não informou aparece como "Não informada", nunca some da conta. */
export function inscritosPorOrigem(inscritos: readonly Pick<Inscrito, 'origem' | 'arquivado_em'>[]): { origem: string; quantidade: number }[] {
  const contagem = new Map<string, number>();
  for (const inscrito of inscritos) {
    if (inscrito.arquivado_em) continue;
    const rotulo = inscrito.origem ? ROTULOS_ORIGEM_INSCRITO[inscrito.origem] : 'Não informada';
    contagem.set(rotulo, (contagem.get(rotulo) ?? 0) + 1);
  }
  return [...contagem].map(([origem, quantidade]) => ({ origem, quantidade })).sort((a, b) => b.quantidade - a.quantidade || a.origem.localeCompare(b.origem, 'pt-BR'));
}

const inicioDaSemana = (dia: string) => {
  const semana = new Date(`${dia}T00:00:00Z`).getUTCDay();
  return somarDias(dia, -((semana + 6) % 7));
};

/** Pela data do consentimento; sem ela, pela data do cadastro. Semanas de segunda a domingo, as mais recentes primeiro. */
export function inscritosPorSemana(inscritos: readonly Pick<Inscrito, 'consentido_em' | 'criado_em' | 'arquivado_em'>[], limite = 6): { semana: string; quantidade: number }[] {
  const contagem = new Map<string, number>();
  for (const inscrito of inscritos) {
    if (inscrito.arquivado_em) continue;
    const semana = inicioDaSemana(inscrito.consentido_em ?? inscrito.criado_em.slice(0, 10));
    contagem.set(semana, (contagem.get(semana) ?? 0) + 1);
  }
  return [...contagem].map(([semana, quantidade]) => ({ semana, quantidade })).sort((a, b) => b.semana.localeCompare(a.semana)).slice(0, limite);
}

/** As listas de espera de um produto, com a contagem, para os Indicadores da ficha do produto (M07). */
export async function listasDoProduto(produtoId: string): Promise<{ id: string; nome: string; situacao: ListaEspera['situacao']; contagem: string }[]> {
  const [listas, inscritos] = await Promise.all([repositorios.lista_espera.listar({ onde: { produto_id: produtoId } }), repositorios.inscrito.listar()]);
  return listas.map((lista) => ({ id: lista.id, nome: lista.nome, situacao: lista.situacao, contagem: textoDaContagem(contadoresDaLista(inscritos.filter((inscrito) => inscrito.lista_id === lista.id))) }));
}
