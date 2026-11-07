/**
 * Regras de T09.02, T09.03 e T09.04 (11-M09), com a validação dentro do próprio registro (decisão vigente 2):
 * pessoa, data, observações e motivo na devolução. Sem login, a ação fica disponível a todas e registra quem
 * fez (03 §0); `podeValidar` é o único lugar a mudar quando `legal.validar` existir.
 */
import { z } from 'zod';
import { ErroDeRegra } from '@/dados/erros';
import { repositorios } from '@/dados/repositorios';
import { idDaPessoaAtual } from '@/dados/sessao';
import { emTransacao } from '@/dados/transacao';
import { BASES_LEGAIS, CATEGORIAS_DADOS, CATEGORIAS_TITULARES, TIPOS_DOCUMENTO_LEGAL, TIPOS_SOLICITACAO_TITULAR, type ClausulaVersao, type DocumentoLegal, type DocumentoLegalVersao, type ModeloVersao, type SolicitacaoTitular, type TratamentoDados, type Validacao } from '@/dados/tipos/legal';
import type { Ferramenta } from '@/dados/tipos/ferramenta';
import type { Produto } from '@/dados/tipos/marca';
import type { Pessoa } from '@/dados/tipos/pessoa';
import { hojeISO } from '@/lib/datas';
import { linkDoDriveValido, MENSAGEM_LINK_DRIVE } from './link-drive';
import { pendenciasParaValidarModelo } from './modelos';
import { somarDias } from './repeticao';

export const ROTULOS_TIPO_DOCUMENTO_LEGAL: Readonly<Record<DocumentoLegal['tipo'], string>> = { termos_uso: 'Termos de Uso', privacidade: 'Política de Privacidade', cookies: 'Política de Cookies', termos_assinatura: 'Termos de Assinatura', termos_parceiro: 'Termos de Parceiro', outro: 'Outro' };
export const ROTULOS_SITUACAO_DOCUMENTO_LEGAL: Readonly<Record<DocumentoLegalVersao['situacao'], string>> = { rascunho: 'Rascunho', em_validacao: 'Em validação', validado: 'Validado', publicado: 'Publicado', substituido: 'Substituído', devolvido: 'Devolvido', cancelado: 'Cancelado' };
export const ROTULOS_TITULARES: Readonly<Record<TratamentoDados['titulares'][number], string>> = { usuarios_app: 'Usuários do app', clientes_b2b: 'Clientes B2B', contatos_comerciais: 'Contatos comerciais', inscritos_lista: 'Inscritos em lista', parceiros: 'Parceiros', colaboradores: 'Colaboradores' };
export const ROTULOS_CATEGORIA_DADOS: Readonly<Record<TratamentoDados['categorias_dados'][number], string>> = { identificacao: 'Identificação', contato: 'Contato', localizacao: 'Localização', financeiro: 'Financeiro', uso: 'Dados de uso', conteudo_gerado: 'Conteúdo gerado', dados_terceiros: 'Dados de terceiros', sensiveis: 'Dados pessoais sensíveis', criancas_adolescentes: 'Crianças e adolescentes' };
export const ROTULOS_BASE_LEGAL: Readonly<Record<TratamentoDados['base_legal'], string>> = { consentimento: 'Consentimento', execucao_contrato: 'Execução de contrato', obrigacao_legal: 'Obrigação legal', legitimo_interesse: 'Legítimo interesse', exercicio_direitos: 'Exercício de direitos', protecao_credito: 'Proteção do crédito', protecao_vida: 'Proteção da vida', tutela_saude: 'Tutela da saúde', politicas_publicas: 'Políticas públicas', pesquisa: 'Pesquisa' };
export const ROTULOS_TRANSFERENCIA = { sim: 'Sim', nao: 'Não', desconhecido: 'Desconhecido' } as const;
export const ROTULOS_TIPO_SOLICITACAO: Readonly<Record<SolicitacaoTitular['tipo'], string>> = { confirmacao: 'Confirmação de tratamento', acesso: 'Acesso', correcao: 'Correção', anonimizacao_exclusao: 'Anonimização ou exclusão', portabilidade: 'Portabilidade', informacao_compartilhamento: 'Informação sobre compartilhamento', revogacao_consentimento: 'Revogação de consentimento', oposicao: 'Oposição' };
export const ROTULOS_SITUACAO_SOLICITACAO: Readonly<Record<SolicitacaoTitular['situacao'], string>> = { recebida: 'Recebida', em_analise: 'Em análise', respondida: 'Respondida', encerrada: 'Encerrada' };

export const ORIGEM_ALERTA_DOCUMENTO_LEGAL = 'documento_legal';
export const ORIGEM_ALERTA_SOLICITACAO = 'solicitacao_titular';

/** RN-09.07: próxima revisão, 12 meses depois da validação. */
const MESES_ATE_REVISAO = 12;

function somarMeses(dia: string, meses: number): string {
  const [ano = 0, mes = 1, data = 1] = dia.split('-').map(Number);
  const alvo = new Date(Date.UTC(ano, mes - 1 + meses, 1));
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(data, ultimo));
  return alvo.toISOString().slice(0, 10);
}
export { somarMeses };

// ---------- Validação no próprio registro ----------

export type TipoValidavel = Validacao['registro_tipo'];

/** Etapa local: toda usuária pode (D27). Na etapa com servidor, `legal.validar` entra aqui (RN-09.03, CA-09.07). */
export function podeValidar(): boolean {
  return true;
}

async function criarPedido(tipo: TipoValidavel, registroId: string): Promise<Validacao> {
  return repositorios.validacao.criar({ registro_tipo: tipo, registro_id: registroId, solicitado_por: idDaPessoaAtual(), solicitado_em: new Date().toISOString(), situacao: 'pendente', decidido_por: null, decidido_em: null, observacoes: null, motivo_devolucao: null });
}

export async function enviarParaValidacao(tipo: TipoValidavel, registroId: string): Promise<void> {
  await emTransacao(async () => {
    if (tipo === 'documento_legal_versao') {
      const versao = await exigirVersaoDocumento(registroId);
      if (versao.situacao !== 'rascunho') throw new ErroDeRegra('Só o rascunho vai para validação.');
      if (!versao.texto?.trim()) throw new ErroDeRegra('Escreva o texto do documento: ele fica sempre no sistema (D23).');
      const pedido = await criarPedido(tipo, registroId);
      await repositorios.documento_legal_versao.atualizar(registroId, { situacao: 'em_validacao', validacao_id: pedido.id });
      return;
    }
    if (tipo === 'clausula_versao') {
      const versao = await repositorios.clausula_versao.obter(registroId);
      if (!versao || versao.situacao !== 'rascunho') throw new ErroDeRegra('Só o rascunho vai para validação.');
      if (!versao.texto.trim()) throw new ErroDeRegra('Escreva o texto da cláusula.');
      const pedido = await criarPedido(tipo, registroId);
      await repositorios.clausula_versao.atualizar(registroId, { validacao_id: pedido.id });
      return;
    }
    const versao = await repositorios.modelo_versao.obter(registroId);
    if (!versao || versao.situacao !== 'rascunho') throw new ErroDeRegra('Só o rascunho vai para validação.');
    const pendencias = pendenciasParaValidarModelo(versao, await repositorios.clausula_versao.listar());
    if (pendencias.length) throw new ErroDeRegra(pendencias[0] as string);
    const pedido = await criarPedido(tipo, registroId);
    await repositorios.modelo_versao.atualizar(registroId, { validacao_id: pedido.id });
  });
}

/** Validar: quem decide e quando ficam na validação. Devolver exige motivo e volta a Rascunho (RN-09.01). */
export async function decidirValidacao(validacaoId: string, decisao: 'validar' | 'devolver', { observacoes = '', motivo = '' }: { observacoes?: string; motivo?: string }, hoje: string = hojeISO()): Promise<void> {
  if (!podeValidar()) throw new ErroDeRegra('Você não tem permissão para validar.');
  if (decisao === 'devolver' && !motivo.trim()) throw new ErroDeRegra('Devolver exige motivo.');
  await emTransacao(async () => {
    const pedido = await repositorios.validacao.obter(validacaoId);
    if (!pedido || pedido.situacao !== 'pendente') throw new ErroDeRegra('Esta validação já foi decidida.');
    await repositorios.validacao.atualizar(validacaoId, { situacao: decisao === 'validar' ? 'validado' : 'devolvido', decidido_por: idDaPessoaAtual(), decidido_em: new Date().toISOString(), observacoes: observacoes.trim() || null, motivo_devolucao: decisao === 'devolver' ? motivo.trim() : null }, decisao === 'devolver' ? { motivo: motivo.trim() } : {});
    if (pedido.registro_tipo === 'documento_legal_versao') {
      const versao = await exigirVersaoDocumento(pedido.registro_id);
      await repositorios.documento_legal_versao.atualizar(versao.id, { situacao: decisao === 'validar' ? 'validado' : 'rascunho' });
      if (decisao === 'validar') await repositorios.documento_legal.atualizar(versao.documento_id, { proxima_revisao: somarMeses(hoje, MESES_ATE_REVISAO) });
      return;
    }
    if (decisao === 'devolver') return;
    if (pedido.registro_tipo === 'clausula_versao') {
      const versao = (await repositorios.clausula_versao.obter(pedido.registro_id)) as ClausulaVersao;
      await marcarAnterioresObsoletas(versao);
      await repositorios.clausula_versao.atualizar(versao.id, { situacao: 'validada' });
      return;
    }
    const versao = (await repositorios.modelo_versao.obter(pedido.registro_id)) as ModeloVersao;
    const pendencias = pendenciasParaValidarModelo(versao, await repositorios.clausula_versao.listar());
    if (pendencias.length) throw new ErroDeRegra(pendencias[0] as string);
    for (const anterior of await repositorios.modelo_versao.listar({ onde: { modelo_id: versao.modelo_id, situacao: 'validada' } })) await repositorios.modelo_versao.atualizar(anterior.id, { situacao: 'obsoleta' });
    await repositorios.modelo_versao.atualizar(versao.id, { situacao: 'validada', aviso: null });
  });
}

async function marcarAnterioresObsoletas(versao: ClausulaVersao) {
  for (const anterior of await repositorios.clausula_versao.listar({ onde: { clausula_id: versao.clausula_id, situacao: 'validada' } })) await repositorios.clausula_versao.atualizar(anterior.id, { situacao: 'obsoleta' });
}

// ---------- Documentos legais (T09.02) ----------

async function exigirVersaoDocumento(id: string): Promise<DocumentoLegalVersao> {
  const versao = await repositorios.documento_legal_versao.obter(id);
  if (!versao) throw new ErroDeRegra('Esta versão não existe mais.');
  return versao;
}

export const esquemaNovoDocumento = z.object({
  produto_id: z.string(),
  tipo: z.enum(TIPOS_DOCUMENTO_LEGAL, { error: 'Escolha o tipo.' }),
  responsavel_id: z.string().min(1, 'Escolha a responsável.'),
});
export type FormularioNovoDocumento = z.infer<typeof esquemaNovoDocumento>;

/** Um documento por produto e tipo (16 §4.9). */
export async function criarDocumentoLegal(formulario: FormularioNovoDocumento, extra: { texto?: string; modelo_versao_id?: string } = {}): Promise<DocumentoLegal> {
  const produto_id = formulario.produto_id || null;
  const existentes = await repositorios.documento_legal.listar({ incluirArquivados: true });
  const repetido = existentes.find((documento) => documento.produto_id === produto_id && documento.tipo === formulario.tipo);
  if (repetido) throw new ErroDeRegra(`Já existe ${ROTULOS_TIPO_DOCUMENTO_LEGAL[formulario.tipo]} deste contexto: ${repetido.codigo}.`);
  return emTransacao(async () => {
    const documento = await repositorios.documento_legal.criar({ produto_id, tipo: formulario.tipo, responsavel_id: formulario.responsavel_id, versao_vigente_id: null, revisao_necessaria: false, revisao_motivo: null, proxima_revisao: null });
    await repositorios.documento_legal_versao.criar({ documento_id: documento.id, numero: 1, situacao: 'rascunho', texto: extra.texto ?? null, arquivo_url: null, url_publica: null, publicado_em: null, substituido_em: null, resumo_mudancas: null, validacao_id: null, modelo_versao_id: extra.modelo_versao_id ?? null, revisado_sem_alteracoes_em: null });
    return documento;
  });
}

export const esquemaRascunhoDocumento = z.object({
  texto: z.string(),
  resumo_mudancas: z.string().trim(),
  arquivo_url: z.string().trim().refine((valor) => !valor || linkDoDriveValido(valor), MENSAGEM_LINK_DRIVE),
  url_publica: z.string().trim().refine((valor) => !valor || /^https?:\/\//i.test(valor), 'Use um endereço que comece com https://.'),
});
export type FormularioRascunhoDocumento = z.infer<typeof esquemaRascunhoDocumento>;

export async function salvarRascunhoDoDocumento(versaoId: string, formulario: FormularioRascunhoDocumento): Promise<void> {
  const versao = await exigirVersaoDocumento(versaoId);
  if (versao.situacao !== 'rascunho' && versao.situacao !== 'validado') throw new ErroDeRegra('Esta versão não pode mais ser editada.');
  // Depois de validado, o texto fica como foi validado: só o que a publicação precisa.
  if (versao.situacao === 'validado' && (versao.texto ?? '') !== formulario.texto) throw new ErroDeRegra('O texto validado não muda. Devolva ou crie uma nova versão.');
  await repositorios.documento_legal_versao.atualizar(versaoId, { texto: formulario.texto || null, resumo_mudancas: formulario.resumo_mudancas || null, arquivo_url: formulario.arquivo_url || null, url_publica: formulario.url_publica || null });
}

export async function novaVersaoDoDocumento(documentoId: string): Promise<DocumentoLegalVersao> {
  const versoes = await repositorios.documento_legal_versao.listar({ onde: { documento_id: documentoId } });
  if (versoes.some((versao) => versao.situacao === 'rascunho' || versao.situacao === 'em_validacao' || versao.situacao === 'validado')) throw new ErroDeRegra('Já existe uma versão em andamento. Conclua ou cancele antes.');
  const atual = [...versoes].sort((a, b) => b.numero - a.numero)[0];
  return repositorios.documento_legal_versao.criar({ documento_id: documentoId, numero: (atual?.numero ?? 0) + 1, situacao: 'rascunho', texto: atual?.texto ?? null, arquivo_url: null, url_publica: atual?.url_publica ?? null, publicado_em: null, substituido_em: null, resumo_mudancas: null, validacao_id: null, modelo_versao_id: null, revisado_sem_alteracoes_em: null });
}

export async function cancelarVersaoDoDocumento(versaoId: string, motivo: string): Promise<void> {
  if (!motivo.trim()) throw new ErroDeRegra('Cancelar exige motivo.');
  const versao = await exigirVersaoDocumento(versaoId);
  if (versao.situacao === 'publicado' || versao.situacao === 'substituido') throw new ErroDeRegra('Versão publicada não é cancelada: publique outra para substituí-la.');
  await repositorios.documento_legal_versao.atualizar(versaoId, { situacao: 'cancelado' }, { motivo: motivo.trim() });
}

export type PendenciaDeLink = { mensagem: string; href: string };

/** RN-09.04: o que falta para publicar, com o caminho para corrigir. */
export async function pendenciasParaPublicar(versao: DocumentoLegalVersao, documento: Pick<DocumentoLegal, 'tipo'>, dataPublicacao: string): Promise<PendenciaDeLink[]> {
  const pendencias: PendenciaDeLink[] = [];
  if (versao.situacao !== 'validado') pendencias.push({ mensagem: 'A versão precisa estar validada.', href: '#versao' });
  if (!versao.url_publica) pendencias.push({ mensagem: 'Informe a URL pública.', href: '#versao' });
  if (!dataPublicacao) pendencias.push({ mensagem: 'Informe a data de publicação.', href: '#versao' });
  if (documento.tipo === 'privacidade') {
    const configuracao = await repositorios.configuracao.ler();
    if (!configuracao.encarregado_pessoa_id) pendencias.push({ mensagem: 'Configure o encarregado de dados (DPO).', href: '/configuracoes#legal' });
    if (!configuracao.canal_titular_email) pendencias.push({ mensagem: 'Configure o canal do titular.', href: '/configuracoes#legal' });
  }
  return pendencias;
}

/** RN-09.05 e CA-09.03: publicar a nova torna a anterior Substituída na data da nova. */
export async function publicarVersao(versaoId: string, dataPublicacao: string): Promise<void> {
  const versao = await exigirVersaoDocumento(versaoId);
  const documento = await repositorios.documento_legal.obter(versao.documento_id);
  if (!documento) throw new ErroDeRegra('Este documento não existe mais.');
  const pendencias = await pendenciasParaPublicar(versao, documento, dataPublicacao);
  if (pendencias.length) throw new ErroDeRegra(pendencias[0]?.mensagem as string);
  await emTransacao(async () => {
    for (const anterior of await repositorios.documento_legal_versao.listar({ onde: { documento_id: documento.id, situacao: 'publicado' } })) await repositorios.documento_legal_versao.atualizar(anterior.id, { situacao: 'substituido', substituido_em: dataPublicacao });
    await repositorios.documento_legal_versao.atualizar(versaoId, { situacao: 'publicado', publicado_em: dataPublicacao });
    await repositorios.documento_legal.atualizar(documento.id, { versao_vigente_id: versaoId, revisao_necessaria: false, revisao_motivo: null });
  });
  await sincronizarAlertasLegaisSeguro();
}

/** RN-09.07: nova data de validação, mesma versão de texto. */
export async function registrarRevisaoSemAlteracoes(documentoId: string, hoje: string = hojeISO()): Promise<void> {
  const documento = await repositorios.documento_legal.obter(documentoId);
  if (!documento?.versao_vigente_id) throw new ErroDeRegra('Só documento publicado recebe esta revisão.');
  await emTransacao(async () => {
    await repositorios.documento_legal_versao.atualizar(documento.versao_vigente_id as string, { revisado_sem_alteracoes_em: hoje });
    await repositorios.documento_legal.atualizar(documentoId, { proxima_revisao: somarMeses(hoje, MESES_ATE_REVISAO), revisao_necessaria: false, revisao_motivo: null });
  });
  await sincronizarAlertasLegaisSeguro();
}

/** Import tardio: os alertas dependem daqui, e este módulo é usado por eles. */
async function sincronizarAlertasLegaisSeguro(): Promise<void> {
  const { sincronizarAlertasLegais } = await import('./alertas-f1');
  await sincronizarAlertasLegais();
}

export type LinhaDocumentoLegal = DocumentoLegal & { versoes: DocumentoLegalVersao[]; vigente: DocumentoLegalVersao | null; atual: DocumentoLegalVersao };

export type FiltrosDocumentos = { busca: string; produto: string; tipo: string; situacao: string };
export const FILTROS_DOCUMENTOS_INICIAIS: FiltrosDocumentos = { busca: '', produto: '', tipo: '', situacao: '' };
export const ID_NUMA_INSTITUCIONAL = 'numa';

export type DadosDocumentos = { documentos: LinhaDocumentoLegal[]; produtos: Produto[]; pessoas: Pessoa[]; validacoes: Validacao[] };

export async function carregarDocumentosLegais(): Promise<DadosDocumentos> {
  const [documentos, versoes, produtos, pessoas, validacoes] = await Promise.all([repositorios.documento_legal.listar(), repositorios.documento_legal_versao.listar(), repositorios.produto.listar({ incluirArquivados: true }), repositorios.pessoa.listar({ incluirArquivados: true }), repositorios.validacao.listar({ onde: { registro_tipo: 'documento_legal_versao' } })]);
  return {
    documentos: documentos.flatMap((documento) => {
      const proprias = versoes.filter((versao) => versao.documento_id === documento.id).sort((a, b) => b.numero - a.numero);
      const atual = proprias[0];
      return atual ? [{ ...documento, versoes: proprias, atual, vigente: proprias.find((versao) => versao.id === documento.versao_vigente_id) ?? null }] : [];
    }),
    produtos,
    pessoas,
    validacoes,
  };
}

export function filtrarDocumentos(documentos: readonly LinhaDocumentoLegal[], { busca, produto, tipo, situacao }: FiltrosDocumentos, nomeDoProduto: (id: string | null) => string): LinhaDocumentoLegal[] {
  const termo = busca.trim().toLowerCase();
  return documentos.filter((documento) => {
    if (produto && (produto === ID_NUMA_INSTITUCIONAL ? documento.produto_id !== null : documento.produto_id !== produto)) return false;
    if (tipo && documento.tipo !== tipo) return false;
    if (situacao === 'revisao' && !documento.revisao_necessaria) return false;
    if (situacao && situacao !== 'revisao' && documento.atual.situacao !== situacao) return false;
    if (!termo) return true;
    return `${documento.codigo} ${ROTULOS_TIPO_DOCUMENTO_LEGAL[documento.tipo]} ${nomeDoProduto(documento.produto_id)}`.toLowerCase().includes(termo);
  });
}

/** RN-09.02: produto com usuários reais precisa de Termos de Uso e Política de Privacidade publicados. */
export function documentosFaltandoNoProduto(produto: Pick<Produto, 'id' | 'tem_usuarios_reais'>, documentos: readonly Pick<LinhaDocumentoLegal, 'produto_id' | 'tipo' | 'vigente'>[]): DocumentoLegal['tipo'][] {
  const publicado = (tipo: DocumentoLegal['tipo']) => documentos.some((documento) => documento.produto_id === produto.id && documento.tipo === tipo && documento.vigente?.situacao === 'publicado');
  return (['termos_uso', 'privacidade'] as const).filter((tipo) => !publicado(tipo));
}

export function produtosComPendenciaLegal(produtos: readonly Produto[], documentos: readonly LinhaDocumentoLegal[]): { produto: Produto; faltando: DocumentoLegal['tipo'][] }[] {
  return produtos.filter((produto) => !produto.arquivado_em && produto.tem_usuarios_reais).flatMap((produto) => {
    const faltando = documentosFaltandoNoProduto(produto, documentos);
    return faltando.length ? [{ produto, faltando }] : [];
  });
}

/** Comparação de texto entre versões, linha a linha (T09.02). */
export type LinhaDaComparacao = { tipo: 'igual' | 'entrou' | 'saiu'; texto: string };

export function compararTextos(antes: string, depois: string): LinhaDaComparacao[] {
  const a = antes.split('\n');
  const b = depois.split('\n');
  const tabela = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      (tabela[i] as number[])[j] = a[i] === b[j] ? ((tabela[i + 1] as number[])[j + 1] as number) + 1 : Math.max((tabela[i + 1] as number[])[j] as number, (tabela[i] as number[])[j + 1] as number);
    }
  }
  const linhas: LinhaDaComparacao[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      linhas.push({ tipo: 'igual', texto: a[i] as string });
      i += 1;
      j += 1;
    } else if (((tabela[i + 1] as number[])[j] as number) >= ((tabela[i] as number[])[j + 1] as number)) linhas.push({ tipo: 'saiu', texto: a[i++] as string });
    else linhas.push({ tipo: 'entrou', texto: b[j++] as string });
  }
  while (i < a.length) linhas.push({ tipo: 'saiu', texto: a[i++] as string });
  while (j < b.length) linhas.push({ tipo: 'entrou', texto: b[j++] as string });
  return linhas;
}

// ---------- Inventário (T09.03) ----------

export const esquemaFormularioTratamento = z
  .object({
    produto_id: z.string(),
    nome: z.string().trim().min(1, 'Informe o nome da operação.'),
    finalidade: z.string().trim().min(1, 'Informe a finalidade.'),
    titulares: z.array(z.enum(CATEGORIAS_TITULARES)).min(1, 'Escolha pelo menos uma categoria de titulares.'),
    categorias_dados: z.array(z.enum(CATEGORIAS_DADOS)).min(1, 'Escolha pelo menos uma categoria de dados.'),
    justificativa_sensiveis: z.string().trim(),
    base_legal: z.enum(BASES_LEGAIS, { error: 'Escolha a base legal.' }),
    ferramentas: z.array(z.string()).min(1, 'Escolha pelo menos uma ferramenta.'),
    retencao: z.string().trim().min(1, 'Informe o prazo e o critério de eliminação.'),
    transferencia_internacional: z.enum(['sim', 'nao', 'desconhecido'], { error: 'Informe se há transferência internacional.' }),
    medidas: z.string().trim(),
    compartilhamentos: z.array(z.object({ contraparte_id: z.string().min(1, 'Escolha a contraparte.'), finalidade: z.string().trim().min(1, 'Informe a finalidade.') })),
  })
  .superRefine((dados, contexto) => {
    if (dados.categorias_dados.includes('sensiveis') && !dados.justificativa_sensiveis) contexto.addIssue({ code: 'custom', path: ['justificativa_sensiveis'], message: 'Dados sensíveis exigem justificativa.' });
  });
export type FormularioTratamento = z.infer<typeof esquemaFormularioTratamento>;

export const FORMULARIO_TRATAMENTO_VAZIO = { produto_id: '', nome: '', finalidade: '', titulares: [], categorias_dados: [], justificativa_sensiveis: '', ferramentas: [], retencao: '', medidas: '', compartilhamentos: [] } as const;

/** Novo dado, nova finalidade ou nova ferramenta, descritos para o motivo da revisão (RN-09.06). */
export function mudancasRelevantes(antes: { categorias_dados: readonly string[]; finalidade: string; ferramentas: readonly string[] } | null, depois: { nome: string; categorias_dados: readonly string[]; finalidade: string; ferramentas: readonly string[] }): string[] {
  if (!antes) return [`Nova operação no inventário: ${depois.nome}.`];
  const mudancas: string[] = [];
  const novasCategorias = depois.categorias_dados.filter((categoria) => !antes.categorias_dados.includes(categoria));
  if (novasCategorias.length) mudancas.push(`Novo dado em ${depois.nome}: ${novasCategorias.map((categoria) => ROTULOS_CATEGORIA_DADOS[categoria as keyof typeof ROTULOS_CATEGORIA_DADOS] ?? categoria).join(', ')}.`);
  if (antes.finalidade !== depois.finalidade) mudancas.push(`Nova finalidade em ${depois.nome}.`);
  if (depois.ferramentas.some((ferramenta) => !antes.ferramentas.includes(ferramenta))) mudancas.push(`Nova ferramenta em ${depois.nome}.`);
  return mudancas;
}

/** RN-09.06 e CA-09.04: mudou o que importa, a política vigente fica "Revisão necessária", com o motivo. */
async function marcarRevisaoNecessaria(produtoId: string | null, motivos: readonly string[]): Promise<void> {
  if (!motivos.length) return;
  const documentos = await repositorios.documento_legal.listar({ onde: { tipo: 'privacidade' } });
  const politica = documentos.find((documento) => documento.produto_id === produtoId && documento.versao_vigente_id);
  if (politica) await repositorios.documento_legal.atualizar(politica.id, { revisao_necessaria: true, revisao_motivo: motivos.join(' ') });
}

export async function salvarTratamento(formulario: FormularioTratamento, id?: string, hoje: string = hojeISO()): Promise<TratamentoDados> {
  const produto_id = formulario.produto_id || null;
  const antes = id ? await repositorios.tratamento_dados.obter(id) : null;
  const ferramentasAntes = id ? (await repositorios.tratamento_ferramenta.listar({ onde: { tratamento_id: id } })).map((ligacao) => ligacao.ferramenta_id) : [];
  const motivos = mudancasRelevantes(antes ? { categorias_dados: antes.categorias_dados, finalidade: antes.finalidade, ferramentas: ferramentasAntes } : null, { nome: formulario.nome, categorias_dados: formulario.categorias_dados, finalidade: formulario.finalidade, ferramentas: formulario.ferramentas });
  const dados = { produto_id, nome: formulario.nome, finalidade: formulario.finalidade, titulares: formulario.titulares, categorias_dados: formulario.categorias_dados, justificativa_sensiveis: formulario.justificativa_sensiveis || null, base_legal: formulario.base_legal, retencao: formulario.retencao, transferencia_internacional: formulario.transferencia_internacional, medidas: formulario.medidas || null, compartilhamentos: formulario.compartilhamentos, revisado_em: hoje, revisado_por: idDaPessoaAtual() };
  const salvo = await emTransacao(async () => {
    const registro = id ? await repositorios.tratamento_dados.atualizar(id, dados) : await repositorios.tratamento_dados.criar(dados);
    const desejadas = new Set(formulario.ferramentas);
    for (const ligacao of await repositorios.tratamento_ferramenta.listar({ onde: { tratamento_id: registro.id } })) {
      if (!desejadas.has(ligacao.ferramenta_id)) await repositorios.tratamento_ferramenta.arquivar(ligacao.id);
      desejadas.delete(ligacao.ferramenta_id);
    }
    for (const ferramenta_id of desejadas) await repositorios.tratamento_ferramenta.criar({ tratamento_id: registro.id, ferramenta_id });
    await marcarRevisaoNecessaria(produto_id, motivos);
    return registro;
  });
  await sincronizarAlertasLegaisSeguro();
  return salvo;
}

export type LinhaTratamento = TratamentoDados & { ferramentas: string[] };
export type DadosInventario = { tratamentos: LinhaTratamento[]; produtos: Produto[]; ferramentas: Ferramenta[]; semOperacao: Ferramenta[]; contrapartes: Awaited<ReturnType<typeof repositorios.contraparte.listar>> };

/** RN-09.09: ferramenta marcada "trata dados pessoais" sem operação no inventário é pendência. */
export function ferramentasSemOperacao(ferramentas: readonly Ferramenta[], ligacoes: readonly { ferramenta_id: string }[]): Ferramenta[] {
  return ferramentas.filter((ferramenta) => !ferramenta.arquivado_em && ferramenta.situacao !== 'cancelada' && ferramenta.trata_dados_pessoais && !ligacoes.some((ligacao) => ligacao.ferramenta_id === ferramenta.id));
}

export async function carregarInventario(): Promise<DadosInventario> {
  const [tratamentos, ligacoes, produtos, ferramentas, contrapartes] = await Promise.all([repositorios.tratamento_dados.listar({ incluirArquivados: true }), repositorios.tratamento_ferramenta.listar(), repositorios.produto.listar({ incluirArquivados: true }), repositorios.ferramenta.listar(), repositorios.contraparte.listar({ incluirArquivados: true })]);
  return {
    tratamentos: tratamentos.map((tratamento) => ({ ...tratamento, ferramentas: ligacoes.filter((ligacao) => ligacao.tratamento_id === tratamento.id).map((ligacao) => ligacao.ferramenta_id) })),
    produtos,
    ferramentas,
    semOperacao: ferramentasSemOperacao(ferramentas, ligacoes),
    contrapartes,
  };
}

/**
 * Sugestão para o Anexo II (T07.10): só sugere. Precisa ser conferida na configuração contratual do produto
 * (decisão vigente 8), e nada daqui entra no contrato sem passar por lá.
 */
export async function sugestaoDoAnexoII(produtoId: string): Promise<{ categorias_dados: string[]; titulares: string[]; suboperadores: { nome: string; finalidade: string }[] }> {
  const { tratamentos, ferramentas } = await carregarInventario();
  const doProduto = tratamentos.filter((tratamento) => tratamento.produto_id === produtoId && !tratamento.arquivado_em);
  return {
    categorias_dados: [...new Set(doProduto.flatMap((tratamento) => tratamento.categorias_dados.map((categoria) => ROTULOS_CATEGORIA_DADOS[categoria])))],
    titulares: [...new Set(doProduto.flatMap((tratamento) => tratamento.titulares.map((titular) => ROTULOS_TITULARES[titular])))],
    suboperadores: [...new Set(doProduto.flatMap((tratamento) => tratamento.ferramentas))].flatMap((id) => {
      const ferramenta = ferramentas.find((item) => item.id === id);
      return ferramenta ? [{ nome: ferramenta.nome, finalidade: ferramenta.finalidade }] : [];
    }),
  };
}

// ---------- Solicitações de titulares (T09.04) ----------

export const esquemaFormularioSolicitacao = z
  .object({
    produto_id: z.string(),
    titular_nome: z.string().trim().min(1, 'Informe o nome do titular.'),
    titular_contato: z.string().trim().min(1, 'Informe um contato do titular.'),
    canal: z.string().trim(),
    tipo: z.enum(TIPOS_SOLICITACAO_TITULAR, { error: 'Escolha o tipo.' }),
    recebida_em: z.string().min(1, 'Informe quando foi recebida.'),
    prazo: z.string(),
    prazo_criterio: z.string().trim(),
    responsavel_id: z.string().min(1, 'Escolha a responsável.'),
    resposta: z.string().trim(),
    evidencia_url: z.string().trim().refine((valor) => !valor || linkDoDriveValido(valor), MENSAGEM_LINK_DRIVE),
    acoes_tomadas: z.string().trim(),
  })
  .superRefine((dados, contexto) => {
    if (dados.prazo && dados.prazo < dados.recebida_em) contexto.addIssue({ code: 'custom', path: ['prazo'], message: 'O prazo não pode ser antes do recebimento.' });
    if (dados.prazo && !dados.prazo_criterio) contexto.addIssue({ code: 'custom', path: ['prazo_criterio'], message: 'Diga de onde veio esse prazo: a regra aplicável ou o combinado.' });
  });
export type FormularioSolicitacao = z.infer<typeof esquemaFormularioSolicitacao>;

/** Decisão vigente 11: sem prazo universal. Com o prazo configurado, sugere; sem ele, fica pendente. */
export function prazoSugerido(recebidaEm: string, diasConfigurados: number | null): { prazo: string; criterio: string } {
  if (!recebidaEm || diasConfigurados === null) return { prazo: '', criterio: '' };
  return { prazo: somarDias(recebidaEm, diasConfigurados), criterio: `Prazo configurado: ${diasConfigurados} dias (T02.01)` };
}

function dadosDaSolicitacao(formulario: FormularioSolicitacao) {
  return { produto_id: formulario.produto_id || null, titular_nome: formulario.titular_nome, titular_contato: formulario.titular_contato, canal: formulario.canal || null, tipo: formulario.tipo, recebida_em: formulario.recebida_em, prazo: formulario.prazo || null, prazo_criterio: formulario.prazo_criterio || null, responsavel_id: formulario.responsavel_id, resposta: formulario.resposta || null, evidencia_url: formulario.evidencia_url || null, acoes_tomadas: formulario.acoes_tomadas || null };
}

export async function salvarSolicitacao(formulario: FormularioSolicitacao, id?: string): Promise<SolicitacaoTitular> {
  const dados = dadosDaSolicitacao(formulario);
  const salvo = id ? await repositorios.solicitacao_titular.atualizar(id, dados) : await repositorios.solicitacao_titular.criar({ ...dados, situacao: 'recebida', respondida_em: null, encerrada_em: null });
  await sincronizarAlertasLegaisSeguro();
  return salvo;
}

export async function iniciarAnaliseDaSolicitacao(id: string): Promise<void> {
  await repositorios.solicitacao_titular.atualizar(id, { situacao: 'em_analise' });
}

/** RN-09.10: responder exige o texto e a evidência da resposta. */
export async function responderSolicitacao(id: string, { resposta, evidencia_url, respondida_em }: { resposta: string; evidencia_url: string; respondida_em: string }, hoje: string = hojeISO()): Promise<void> {
  if (!resposta.trim()) throw new ErroDeRegra('Escreva a resposta dada ao titular.');
  if (!evidencia_url.trim()) throw new ErroDeRegra('Cole o link da evidência da resposta.');
  if (!linkDoDriveValido(evidencia_url.trim())) throw new ErroDeRegra(MENSAGEM_LINK_DRIVE);
  if (!respondida_em) throw new ErroDeRegra('Informe a data da resposta.');
  if (respondida_em > hoje) throw new ErroDeRegra('A data da resposta não pode ser futura.');
  await repositorios.solicitacao_titular.atualizar(id, { situacao: 'respondida', resposta: resposta.trim(), evidencia_url: evidencia_url.trim(), respondida_em });
  await sincronizarAlertasLegaisSeguro();
}

export async function encerrarSolicitacao(id: string, hoje: string = hojeISO()): Promise<void> {
  const solicitacao = await repositorios.solicitacao_titular.obter(id);
  if (solicitacao?.situacao !== 'respondida') throw new ErroDeRegra('Responda antes de encerrar.');
  await repositorios.solicitacao_titular.atualizar(id, { situacao: 'encerrada', encerrada_em: hoje });
}

export type SituacaoDoPrazo = { texto: string; tipo: 'pendente' | 'atrasado' | 'proximo' | 'normal' | 'encerrado' };

export function situacaoDoPrazo(solicitacao: Pick<SolicitacaoTitular, 'prazo' | 'situacao'>, hoje: string): SituacaoDoPrazo {
  if (solicitacao.situacao === 'respondida' || solicitacao.situacao === 'encerrada') return { texto: 'Respondida', tipo: 'encerrado' };
  if (!solicitacao.prazo) return { texto: 'Prazo a definir', tipo: 'pendente' };
  if (solicitacao.prazo < hoje) return { texto: 'Prazo vencido', tipo: 'atrasado' };
  return somarDias(solicitacao.prazo, -3) <= hoje ? { texto: 'Prazo próximo', tipo: 'proximo' } : { texto: 'No prazo', tipo: 'normal' };
}
