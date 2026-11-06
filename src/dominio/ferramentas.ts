/** Regras de T04.01 a T04.03 (06-M04): ferramentas, assinaturas e custos. A gestão de acessos fica para a F2 (D14). */
import { z } from 'zod';
import { ErroDeRegra } from '@/dados/erros';
import type { AnexoLink } from '@/dados/tipos/apoio';
import { repositorios } from '@/dados/repositorios';
import { emTransacao } from '@/dados/transacao';
import type { Area } from '@/dados/tipos/area';
import type { CambioReferencia } from '@/dados/tipos/cambio-referencia';
import type { Contraparte } from '@/dados/tipos/contraparte';
import { TIPOS_DE_DADOS, type AssinaturaFerramenta, type AssinaturaValorHistorico, type CategoriaFerramenta, type Ferramenta, type FerramentaContexto } from '@/dados/tipos/ferramenta';
import type { CategoriaFinanceira, ContaFinanceira } from '@/dados/tipos/financeiro';
import type { Marca, Produto } from '@/dados/tipos/marca';
import type { Pessoa } from '@/dados/tipos/pessoa';
import type { Titulo } from '@/dados/tipos/titulo';
import { hojeISO } from '@/lib/datas';
import { AREAS_INICIAIS } from '@/dados/exemplos/base';
import { sincronizarAlertasDasFerramentas, sincronizarAlertasDosTitulos } from './alertas';
import { quantasAtividadesAbertasVinculadas } from './atividades';
import { ativosDaFerramenta } from './ativos';
import { cobrancasPrevistas, MESES_DA_PERIODICIDADE, somarMeses } from './cobrancas';
import { ID_CONSOLIDADA, ID_INSTITUCIONAL } from './contextos';
import { lerValor, valorParaCampo } from './dinheiro';
import { nomesParecidos, normalizarTexto } from './duplicidade';
import { linkDoDriveValido, MENSAGEM_LINK_DRIVE } from './link-drive';
import { AVISO_CREDENCIAL, pareceCredencial } from './segredos';
import { aplicarReajuste, cancelarPrevistosDaAssinatura, cancelarTitulosFuturos, sincronizarTitulosDaAssinatura } from './titulos';

// ---------- Rótulos ----------

export const ROTULOS_SITUACAO_FERRAMENTA = { avaliacao: 'Em avaliação', teste: 'Teste', teste_expirado: 'Teste expirado', ativa: 'Ativa', cancelada: 'Cancelada' } as const;
export const ROTULOS_MODALIDADE = { gratuita: 'Gratuita', paga: 'Paga', teste: 'Teste' } as const;
export const ROTULOS_PERIODICIDADE = { mensal: 'Mensal', trimestral: 'Trimestral', semestral: 'Semestral', anual: 'Anual', unica: 'Única', por_uso: 'Por uso' } as const;
export const ROTULOS_RENOVACAO = { automatica: 'Automática', manual: 'Manual' } as const;
export { ROTULOS_TITULAR } from './titularidade';
export const ROTULOS_MFA = { sim: 'Sim', nao: 'Não', desconhecido: 'Desconhecido' } as const;
export const ROTULOS_ACORDO_DADOS = { nao_avaliado: 'Não avaliado', termos_padrao: 'Termos padrão aceitos', dpa_assinado: 'DPA assinado', nao_aplicavel: 'Não aplicável' } as const;
export const ROTULOS_TIPOS_DADOS: Readonly<Record<(typeof TIPOS_DE_DADOS)[number], string>> = { identificacao: 'Identificação', contato: 'Contato', localizacao: 'Localização', financeiro: 'Financeiro', saude: 'Saúde', terceiros: 'Dados de terceiros (pets/clientes)', uso: 'Uso/navegação', outros: 'Outros' };

const ID_TECNOLOGIA = AREAS_INICIAIS.find((area) => area.nome === 'Tecnologia')?.id ?? '';
const ID_FINANCEIRO = AREAS_INICIAIS.find((area) => area.nome === 'Financeiro')?.id ?? '';

// ---------- Custos (RN-04.07 e RN-04.08) ----------

/** O câmbio de referência mais recente de cada moeda (T02.01). */
export function ultimoCambio(moeda: string, cambios: readonly Pick<CambioReferencia, 'moeda' | 'valor_brl' | 'data_referencia'>[]): number | null {
  const daMoeda = cambios.filter((cambio) => cambio.moeda === moeda).sort((a, b) => b.data_referencia.localeCompare(a.data_referencia));
  return daMoeda[0]?.valor_brl ?? null;
}

/** Sempre estimativa. `null` quando não dá para saber: sem valor, por uso, ou moeda sem câmbio informado. */
export function equivalenteMensalBrl(assinatura: Pick<AssinaturaFerramenta, 'modalidade' | 'valor' | 'moeda' | 'periodicidade'>, cambios: readonly Pick<CambioReferencia, 'moeda' | 'valor_brl' | 'data_referencia'>[]): number | null {
  if (assinatura.modalidade !== 'paga' || assinatura.valor === null || !assinatura.periodicidade) return null;
  const meses = MESES_DA_PERIODICIDADE[assinatura.periodicidade];
  if (!meses) return null;
  const mensal = assinatura.valor / meses;
  if (assinatura.moeda === 'BRL') return mensal;
  const cambio = ultimoCambio(assinatura.moeda, cambios);
  return cambio === null ? null : mensal * cambio;
}

export { cobrancasPrevistas };

// ---------- Formulário de T04.03 ----------

export const ETAPAS_DA_FERRAMENTA = ['O que é', 'Conta e titularidade', 'Custo'] as const;

const textoCurto = z.string().trim();

export const esquemaBaseFerramenta = z.object({
  nome: z.string().trim().min(1, 'Informe o nome.'),
  categoria_id: z.string().min(1, 'Escolha a categoria.'),
  fornecedor_id: z.string(),
  finalidade: z.string().trim().min(1, 'Diga para que usamos.'),
  contextos: z.array(z.string()).min(1, 'Escolha ao menos um: a Numa ou um produto.'),
  critica: z.boolean(),
  situacao: z.enum(['avaliacao', 'teste', 'teste_expirado', 'ativa', 'cancelada']),
  url_acesso: textoCurto,
  url_admin: textoCurto,
  email_login_conta: textoCurto,
  ambiente: textoCurto,
  titular_atual_tipo: z.enum(['numa', 'pessoa_fisica', 'terceiro']),
  titular_atual_pessoa_id: z.string(),
  titular_atual_texto: textoCurto,
  titular_desejado: textoCurto,
  referencia_cofre: textoCurto,
  mfa_conta: z.enum(['sim', 'nao', 'desconhecido']),
  responsavel_tecnico_id: z.string().min(1, 'Escolha a responsável técnica.'),
  responsavel_financeiro_id: z.string(),
  caminho_recuperacao: textoCurto,
  observacoes: textoCurto,
  /** Vazio é "a definir": a etapa de custo pode ficar para depois. */
  modalidade: z.enum(['', 'gratuita', 'paga', 'teste']),
  plano: textoCurto,
  valor: textoCurto,
  moeda: z.string(),
  periodicidade: z.string(),
  data_contratacao: z.string(),
  proxima_cobranca: z.string(),
  renovacao: z.string(),
  aviso_cancelamento_dias: textoCurto,
  fim_teste: z.string(),
  valor_apos_teste: textoCurto,
  conta_financeira_id: z.string(),
  categoria_financeira_id: z.string(),
  gerar_titulos: z.boolean(),
  licencas: textoCurto,
});

export type FormularioFerramenta = z.infer<typeof esquemaBaseFerramenta>;

export const CAMPOS_DA_ETAPA: readonly (readonly (keyof FormularioFerramenta)[])[] = [
  ['nome', 'categoria_id', 'fornecedor_id', 'finalidade', 'contextos', 'critica', 'situacao', 'url_acesso', 'url_admin'],
  ['email_login_conta', 'ambiente', 'titular_atual_tipo', 'titular_atual_pessoa_id', 'titular_atual_texto', 'titular_desejado', 'referencia_cofre', 'mfa_conta', 'responsavel_tecnico_id', 'responsavel_financeiro_id', 'caminho_recuperacao', 'observacoes'],
  ['modalidade', 'plano', 'valor', 'moeda', 'periodicidade', 'data_contratacao', 'proxima_cobranca', 'renovacao', 'aviso_cancelamento_dias', 'fim_teste', 'valor_apos_teste', 'conta_financeira_id', 'categoria_financeira_id', 'gerar_titulos', 'licencas'],
];

const urlValida = (texto: string) => {
  try {
    return ['http:', 'https:'].includes(new URL(texto).protocol);
  } catch {
    return false;
  }
};

const inteiroValido = (texto: string) => !texto || /^\d+$/.test(texto);

export const esquemaFormularioFerramenta = esquemaBaseFerramenta.superRefine((dados, contexto) => {
  const falha = (campo: keyof FormularioFerramenta, message: string) => contexto.addIssue({ code: 'custom', path: [campo], message });
  if (dados.url_acesso && !urlValida(dados.url_acesso)) falha('url_acesso', 'Use um endereço completo, com https://.');
  if (dados.url_admin && !urlValida(dados.url_admin)) falha('url_admin', 'Use um endereço completo, com https://.');
  if (dados.titular_atual_tipo === 'pessoa_fisica' && !dados.titular_atual_pessoa_id) falha('titular_atual_pessoa_id', 'Diga de qual sócia é a conta.');
  if (dados.titular_atual_tipo === 'terceiro' && !dados.titular_atual_texto) falha('titular_atual_texto', 'Diga de quem é a conta.');
  if (!dados.titular_desejado) falha('titular_desejado', 'Diga em nome de quem a conta deveria estar.');
  // RN-04.09: quem está em teste precisa dizer até quando.
  if (dados.situacao === 'teste' && dados.modalidade !== 'teste') falha('modalidade', 'Em teste, a modalidade é Teste, com a data de fim.');
  if (dados.modalidade === 'teste' && dados.situacao !== 'teste' && dados.situacao !== 'teste_expirado') falha('situacao', 'Esta assinatura está em teste. Para mudar a situação, mude a modalidade em Custo.');
  if (dados.modalidade === 'teste' && !dados.fim_teste) falha('fim_teste', 'Informe quando o teste acaba.');
  if ((dados.modalidade === 'paga' || dados.modalidade === 'teste') && !dados.plano) falha('plano', 'Informe o plano.');
  if (dados.modalidade === 'paga') {
    // Por uso não tem data nem renovação para prever.
    const porUso = dados.periodicidade === 'por_uso';
    if (!dados.periodicidade) falha('periodicidade', 'Escolha a periodicidade.');
    if (!dados.responsavel_financeiro_id) falha('responsavel_financeiro_id', 'Paga precisa de responsável financeira.');
    if (dados.valor && lerValor(dados.valor) === null) falha('valor', 'Use só números, como 0,00.');
    if (!porUso && !dados.proxima_cobranca) falha('proxima_cobranca', 'Informe a próxima cobrança.');
    if (!porUso && !dados.renovacao) falha('renovacao', 'Escolha a renovação.');
    if (!dados.conta_financeira_id) falha('conta_financeira_id', 'Escolha a conta de pagamento.');
    if (!dados.categoria_financeira_id) falha('categoria_financeira_id', 'Escolha a categoria financeira.');
  }
  if (dados.valor_apos_teste && lerValor(dados.valor_apos_teste) === null) falha('valor_apos_teste', 'Use só números, como 0,00.');
  if (!inteiroValido(dados.aviso_cancelamento_dias)) falha('aviso_cancelamento_dias', 'Use um número inteiro de dias.');
  if (!inteiroValido(dados.licencas)) falha('licencas', 'Use um número inteiro.');
});

export function formularioFerramentaVazio(pessoaId: string, contextoGlobalId: string, responsaveis: { tecnica: string; financeira: string }): FormularioFerramenta {
  return {
    nome: '',
    categoria_id: '',
    fornecedor_id: '',
    finalidade: '',
    contextos: contextoGlobalId === ID_CONSOLIDADA ? [] : [contextoGlobalId],
    critica: false,
    situacao: 'ativa',
    url_acesso: '',
    url_admin: '',
    email_login_conta: '',
    ambiente: '',
    // Sem PJ aberta, o mais provável é a conta estar em nome de quem cadastra: fica como pendência de transferência (RN-04.14).
    titular_atual_tipo: 'pessoa_fisica',
    titular_atual_pessoa_id: pessoaId,
    titular_atual_texto: '',
    titular_desejado: 'Numa',
    referencia_cofre: '',
    mfa_conta: 'desconhecido',
    responsavel_tecnico_id: responsaveis.tecnica,
    responsavel_financeiro_id: responsaveis.financeira,
    caminho_recuperacao: '',
    observacoes: '',
    modalidade: '',
    plano: '',
    valor: '',
    moeda: 'BRL',
    periodicidade: '',
    data_contratacao: '',
    proxima_cobranca: '',
    renovacao: '',
    aviso_cancelamento_dias: '',
    fim_teste: '',
    valor_apos_teste: '',
    conta_financeira_id: '',
    categoria_financeira_id: '',
    gerar_titulos: true,
    licencas: '',
  };
}

/** Padrões de T04.03: técnica de Tecnologia, financeira de Financeiro, quando estiverem disponíveis. */
export function responsaveisPadrao(areas: readonly Pick<Area, 'id' | 'responsavel_padrao_id'>[], pessoas: readonly Pick<Pessoa, 'id' | 'situacao' | 'tipo' | 'arquivado_em'>[]): { tecnica: string; financeira: string } {
  const disponivel = (id: string | null | undefined) => (id && pessoas.some((pessoa) => pessoa.id === id && pessoa.tipo === 'interna' && pessoa.situacao === 'ativa' && !pessoa.arquivado_em) ? id : '');
  return { tecnica: disponivel(areas.find((area) => area.id === ID_TECNOLOGIA)?.responsavel_padrao_id), financeira: disponivel(areas.find((area) => area.id === ID_FINANCEIRO)?.responsavel_padrao_id) };
}

function contextosDoFormulario(ligacoes: readonly Pick<FerramentaContexto, 'produto_id'>[]): string[] {
  return ligacoes.map((ligacao) => ligacao.produto_id ?? ID_INSTITUCIONAL);
}

export function formularioDaFerramenta(ferramenta: Ferramenta, contextos: readonly FerramentaContexto[], assinatura: AssinaturaFerramenta | null): FormularioFerramenta {
  return {
    nome: ferramenta.nome,
    categoria_id: ferramenta.categoria_id,
    fornecedor_id: ferramenta.fornecedor_id ?? '',
    finalidade: ferramenta.finalidade,
    contextos: contextosDoFormulario(contextos),
    critica: ferramenta.critica,
    situacao: ferramenta.situacao,
    url_acesso: ferramenta.url_acesso ?? '',
    url_admin: ferramenta.url_admin ?? '',
    email_login_conta: ferramenta.email_login_conta ?? '',
    ambiente: ferramenta.ambiente ?? '',
    titular_atual_tipo: ferramenta.titular_atual_tipo,
    titular_atual_pessoa_id: ferramenta.titular_atual_pessoa_id ?? '',
    titular_atual_texto: ferramenta.titular_atual_texto ?? '',
    titular_desejado: ferramenta.titular_desejado,
    referencia_cofre: ferramenta.referencia_cofre ?? '',
    mfa_conta: ferramenta.mfa_conta,
    responsavel_tecnico_id: ferramenta.responsavel_tecnico_id,
    responsavel_financeiro_id: ferramenta.responsavel_financeiro_id ?? '',
    caminho_recuperacao: ferramenta.caminho_recuperacao ?? '',
    observacoes: ferramenta.observacoes ?? '',
    modalidade: assinatura?.modalidade ?? '',
    plano: assinatura?.plano ?? '',
    valor: assinatura?.valor != null ? valorParaCampo(assinatura.valor) : '',
    moeda: assinatura?.moeda ?? 'BRL',
    periodicidade: assinatura?.periodicidade ?? '',
    data_contratacao: assinatura?.data_contratacao ?? '',
    proxima_cobranca: assinatura?.proxima_cobranca ?? '',
    renovacao: assinatura?.renovacao ?? '',
    aviso_cancelamento_dias: assinatura?.aviso_cancelamento_dias != null ? String(assinatura.aviso_cancelamento_dias) : '',
    fim_teste: assinatura?.fim_teste ?? '',
    valor_apos_teste: assinatura?.valor_apos_teste != null ? valorParaCampo(assinatura.valor_apos_teste) : '',
    conta_financeira_id: assinatura?.conta_financeira_id ?? '',
    categoria_financeira_id: assinatura?.categoria_financeira_id ?? '',
    gerar_titulos: assinatura?.gerar_titulos ?? true,
    licencas: assinatura?.licencas != null ? String(assinatura.licencas) : '',
  };
}

function nulo(texto: string): string | null {
  return texto.trim() || null;
}

const inteiroOuNulo = (texto: string) => (texto ? Number(texto) : null);

function dadosDaFerramenta(formulario: FormularioFerramenta) {
  const pf = formulario.titular_atual_tipo === 'pessoa_fisica';
  const terceiro = formulario.titular_atual_tipo === 'terceiro';
  return {
    nome: formulario.nome,
    categoria_id: formulario.categoria_id,
    fornecedor_id: nulo(formulario.fornecedor_id),
    finalidade: formulario.finalidade,
    critica: formulario.critica,
    situacao: formulario.situacao,
    url_acesso: nulo(formulario.url_acesso),
    url_admin: nulo(formulario.url_admin),
    email_login_conta: nulo(formulario.email_login_conta),
    ambiente: nulo(formulario.ambiente),
    titular_atual_tipo: formulario.titular_atual_tipo,
    titular_atual_pessoa_id: pf ? nulo(formulario.titular_atual_pessoa_id) : null,
    titular_atual_texto: terceiro ? nulo(formulario.titular_atual_texto) : null,
    titular_desejado: formulario.titular_desejado,
    referencia_cofre: nulo(formulario.referencia_cofre),
    mfa_conta: formulario.mfa_conta,
    responsavel_tecnico_id: formulario.responsavel_tecnico_id,
    responsavel_financeiro_id: nulo(formulario.responsavel_financeiro_id),
    caminho_recuperacao: nulo(formulario.caminho_recuperacao),
    observacoes: nulo(formulario.observacoes),
  };
}

/** Só o que a modalidade usa: gratuita não guarda valor nem cobrança, e não gera títulos (RN-04.02). */
function dadosDaAssinatura(formulario: FormularioFerramenta) {
  const modalidade = formulario.modalidade as AssinaturaFerramenta['modalidade'];
  const paga = modalidade === 'paga';
  const teste = modalidade === 'teste';
  const proxima = paga ? nulo(formulario.proxima_cobranca) : null;
  return {
    plano: modalidade === 'gratuita' ? null : nulo(formulario.plano),
    modalidade,
    valor: paga ? lerValor(formulario.valor) : null,
    moeda: formulario.moeda || 'BRL',
    periodicidade: paga ? ((formulario.periodicidade || null) as AssinaturaFerramenta['periodicidade']) : null,
    dia_cobranca: proxima ? Number(proxima.slice(8, 10)) : null,
    proxima_cobranca: proxima,
    renovacao: paga ? ((formulario.renovacao || null) as AssinaturaFerramenta['renovacao']) : null,
    aviso_cancelamento_dias: paga ? inteiroOuNulo(formulario.aviso_cancelamento_dias) : null,
    fim_teste: teste ? nulo(formulario.fim_teste) : null,
    valor_apos_teste: teste ? lerValor(formulario.valor_apos_teste) : null,
    conta_financeira_id: paga ? nulo(formulario.conta_financeira_id) : null,
    categoria_financeira_id: paga ? nulo(formulario.categoria_financeira_id) : null,
    gerar_titulos: paga && formulario.gerar_titulos,
    licencas: modalidade === 'gratuita' ? null : inteiroOuNulo(formulario.licencas),
    data_contratacao: nulo(formulario.data_contratacao),
  };
}

export type ConferenciaFerramenta = {
  /** Nome igual ao de outra ativa: não deixa salvar (T04.03). */
  nomeRepetido: boolean;
  avisos: string[];
};

/** O que barra e o que só avisa, antes de gravar. */
export function conferirFerramenta(formulario: FormularioFerramenta, existentes: readonly Pick<Ferramenta, 'id' | 'nome' | 'arquivado_em' | 'situacao'>[], idAtual?: string): ConferenciaFerramenta {
  const outras = existentes.filter((ferramenta) => ferramenta.id !== idAtual && !ferramenta.arquivado_em && ferramenta.situacao !== 'cancelada');
  const nomeRepetido = outras.some((ferramenta) => normalizarTexto(ferramenta.nome) === normalizarTexto(formulario.nome));
  const parecida = nomeRepetido ? undefined : outras.find((ferramenta) => nomesParecidos(ferramenta.nome, formulario.nome));
  const avisos: string[] = [];
  if (parecida) avisos.push(`Já existe uma ferramenta com nome parecido: ${parecida.nome}.`);
  if (formulario.critica && formulario.mfa_conta === 'nao') avisos.push('Esta ferramenta é crítica, e a conta está sem segunda etapa.');
  if (formulario.modalidade === 'paga' && !formulario.valor) avisos.push('Sem valor, ela fica de fora do custo mensal, como “a confirmar”.');
  if ([formulario.finalidade, formulario.observacoes, formulario.referencia_cofre, formulario.caminho_recuperacao, formulario.email_login_conta, formulario.plano].some(pareceCredencial)) avisos.push(AVISO_CREDENCIAL);
  return { nomeRepetido, avisos };
}

// ---------- Gravar ----------

function assinaturaAtiva(assinaturas: readonly AssinaturaFerramenta[]): AssinaturaFerramenta | null {
  return assinaturas.find((assinatura) => assinatura.situacao === 'ativa') ?? null;
}

async function sincronizarContextos(ferramentaId: string, escolhidos: readonly string[], hoje: string): Promise<void> {
  const atuais = await repositorios.ferramenta_contexto.listar({ onde: { ferramenta_id: ferramentaId } });
  const querem = new Set(escolhidos.map((id) => (id === ID_INSTITUCIONAL ? null : id)));
  const mudou = atuais.length !== querem.size || atuais.some((ligacao) => !querem.has(ligacao.produto_id));
  for (const ligacao of atuais) {
    if (!querem.delete(ligacao.produto_id)) await repositorios.ferramenta_contexto.arquivar(ligacao.id);
  }
  for (const produto_id of querem) await repositorios.ferramenta_contexto.criar({ ferramenta_id: ferramentaId, produto_id, percentual_rateio: null, vigente_desde: hoje });
  // Quem entra ou sai desfaz a soma de 100%: o rateio volta a ser definido (RN-04.05).
  if (mudou) {
    for (const ligacao of await repositorios.ferramenta_contexto.listar({ onde: { ferramenta_id: ferramentaId } })) {
      if (ligacao.percentual_rateio !== null) await repositorios.ferramenta_contexto.atualizar(ligacao.id, { percentual_rateio: null });
    }
  }
}

/** RN-03.12: o que muda na ferramenta chega aos alertas dela e aos dos lançamentos dela, sem esperar a rotina do dia. */
async function avisarAlertas(ids: readonly string[], hoje?: string): Promise<void> {
  if (!ids.length) return;
  await sincronizarAlertasDasFerramentas(ids, hoje);
  const titulos = (await repositorios.titulo.listar({ incluirArquivados: true })).filter((titulo) => titulo.ferramenta_id && ids.includes(titulo.ferramenta_id));
  if (titulos.length) await sincronizarAlertasDosTitulos(titulos.map((titulo) => titulo.id), hoje);
}

export async function criarFerramenta(formulario: FormularioFerramenta, hoje: string = hojeISO()): Promise<Ferramenta> {
  const ferramenta = await gravarNovaFerramenta(formulario, hoje);
  await avisarAlertas([ferramenta.id], hoje);
  return ferramenta;
}

async function gravarNovaFerramenta(formulario: FormularioFerramenta, hoje: string): Promise<Ferramenta> {
  return emTransacao(async () => {
    const ferramenta = await repositorios.ferramenta.criar({ ...dadosDaFerramenta(formulario), recuperacao_verificada_em: null, trata_dados_pessoais: false, tipos_dados: [], regiao_dados: null, acordo_dados_situacao: null, acordo_dados_url: null, dados_revisado_em: null, cancelada_em: null, cancelamento_motivo: null });
    await sincronizarContextos(ferramenta.id, formulario.contextos, hoje);
    if (formulario.modalidade) await sincronizarTitulosDaAssinatura(ferramenta, await repositorios.assinatura_ferramenta.criar({ ...dadosDaAssinatura(formulario), ferramenta_id: ferramenta.id, inicio: hoje, fim: null, situacao: 'ativa' }), hoje);
    return ferramenta;
  });
}

/**
 * Reajuste de uma assinatura em uso exige motivo (RN-04.17). Tirar o valor não é reajuste: não há
 * valor novo para guardar, e a mudança fica no histórico da ferramenta.
 */
export function valorMudou(formulario: Pick<FormularioFerramenta, 'modalidade' | 'valor'>, assinatura: AssinaturaFerramenta | null): boolean {
  if (!assinatura || assinatura.modalidade !== 'paga' || formulario.modalidade !== 'paga' || assinatura.valor === null) return false;
  const novo = lerValor(formulario.valor);
  return novo !== null && novo !== assinatura.valor;
}

/** A situação acompanha a modalidade: quem decidiu o teste deixa de estar em teste (RN-04.09). */
export function situacaoParaModalidade(situacao: Ferramenta['situacao'], modalidade: FormularioFerramenta['modalidade']): Ferramenta['situacao'] {
  if (modalidade === 'teste') return situacao === 'teste_expirado' ? situacao : 'teste';
  if (modalidade && (situacao === 'teste' || situacao === 'teste_expirado')) return 'ativa';
  return situacao;
}

/** Estender o teste de quem já tinha expirado volta para "Teste". */
function situacaoAoSalvar({ situacao, modalidade, fim_teste }: Pick<FormularioFerramenta, 'situacao' | 'modalidade' | 'fim_teste'>, hoje: string): Ferramenta['situacao'] {
  const acompanhada = situacaoParaModalidade(situacao, modalidade);
  return acompanhada === 'teste_expirado' && modalidade === 'teste' && fim_teste >= hoje ? 'teste' : acompanhada;
}

export async function salvarFerramenta(id: string, formulario: FormularioFerramenta, opcoes: { motivoDoValor?: string; trocarPlano?: boolean; hoje?: string } = {}): Promise<Ferramenta> {
  const ferramenta = await gravarFerramenta(id, formulario, opcoes);
  await avisarAlertas([id], opcoes.hoje);
  return ferramenta;
}

async function gravarFerramenta(id: string, formulario: FormularioFerramenta, { motivoDoValor = '', trocarPlano = false, hoje = hojeISO() }: { motivoDoValor?: string; trocarPlano?: boolean; hoje?: string }): Promise<Ferramenta> {
  if (trocarPlano && !formulario.modalidade) throw new ErroDeRegra('Escolha a modalidade do novo plano.');
  return emTransacao(async () => {
    const ferramenta = await repositorios.ferramenta.atualizar(id, { ...dadosDaFerramenta(formulario), situacao: situacaoAoSalvar(formulario, hoje) });
    await sincronizarContextos(id, formulario.contextos, hoje);
    const assinaturas = await repositorios.assinatura_ferramenta.listar({ onde: { ferramenta_id: id } });
    const atual = assinaturaAtiva(assinaturas);
    if (!formulario.modalidade) return ferramenta;
    const novos = dadosDaAssinatura(formulario);
    if (!atual) {
      await sincronizarTitulosDaAssinatura(ferramenta, await repositorios.assinatura_ferramenta.criar({ ...novos, ferramenta_id: id, inicio: hoje, fim: null, situacao: 'ativa' }), hoje);
      return ferramenta;
    }
    // "Só uma ativa por vez" (M04 §2): outro plano, ou outra modalidade, encerra a atual e guarda o que havia.
    if (trocarPlano || atual.modalidade !== novos.modalidade) {
      await repositorios.assinatura_ferramenta.atualizar(atual.id, { situacao: 'encerrada', fim: hoje });
      await cancelarPrevistosDaAssinatura(atual.id, hoje, 'O plano mudou.');
      await sincronizarTitulosDaAssinatura(ferramenta, await repositorios.assinatura_ferramenta.criar({ ...novos, ferramenta_id: id, inicio: hoje, fim: null, situacao: 'ativa' }), hoje);
      return ferramenta;
    }
    // O histórico de valores guarda uma moeda só: trocar de moeda é trocar de plano.
    if (atual.valor !== null && novos.moeda !== atual.moeda) throw new ErroDeRegra('Para trocar a moeda, use Trocar plano.');
    if (valorMudou(formulario, atual) && novos.valor !== null) {
      if (!motivoDoValor.trim()) throw new ErroDeRegra('Informe o motivo da mudança de valor.');
      await repositorios.assinatura_valor_historico.criar({ assinatura_id: atual.id, valor_anterior: atual.valor, valor_novo: novos.valor, moeda: novos.moeda, efeito_em: hoje, motivo: motivoDoValor.trim() });
      await aplicarReajuste(atual.id, novos.valor, motivoDoValor.trim(), hoje);
    }
    await sincronizarTitulosDaAssinatura(ferramenta, await repositorios.assinatura_ferramenta.atualizar(atual.id, novos), hoje);
    return ferramenta;
  });
}

// ---------- Ações da ficha ----------

/** RN-04.10: exige data efetiva e motivo, e cancela os títulos futuros não pagos. Os acessos entram na F2. */
export async function cancelarFerramenta(id: string, { data, motivo }: { data: string; motivo: string }): Promise<void> {
  const limpo = motivo.trim();
  if (!data) throw new ErroDeRegra('Informe a data efetiva do cancelamento.');
  if (!limpo) throw new ErroDeRegra('Informe o motivo do cancelamento.');
  await emTransacao(async () => {
    await repositorios.ferramenta.atualizar(id, { situacao: 'cancelada', cancelada_em: data, cancelamento_motivo: limpo }, { motivo: limpo });
    for (const assinatura of await repositorios.assinatura_ferramenta.listar({ onde: { ferramenta_id: id, situacao: 'ativa' } })) await repositorios.assinatura_ferramenta.atualizar(assinatura.id, { situacao: 'encerrada', fim: data });
    await cancelarTitulosFuturos(id, data, `Ferramenta cancelada: ${limpo}`);
  });
  await avisarAlertas([id]);
}

/** Cada módulo novo que apontar para a ferramenta bloqueia aqui. */
export async function vinculosDaFerramenta(id: string): Promise<string[]> {
  const [abertas, ativos, titulos] = await Promise.all([quantasAtividadesAbertasVinculadas('ferramenta', id), ativosDaFerramenta(id), repositorios.titulo.listar({ onde: { ferramenta_id: id } })]);
  const lancamentos = titulos.filter((titulo) => titulo.situacao !== 'cancelado').length;
  return [
    ...(abertas ? [abertas === 1 ? '1 atividade aberta' : `${abertas} atividades abertas`] : []),
    ...(ativos.length ? [ativos.length === 1 ? '1 ativo hospedado' : `${ativos.length} ativos hospedados`] : []),
    ...(lancamentos ? [lancamentos === 1 ? '1 lançamento' : `${lancamentos} lançamentos`] : []),
  ];
}

export async function arquivarFerramenta(id: string): Promise<void> {
  const vinculos = await vinculosDaFerramenta(id);
  if (vinculos.length) throw new ErroDeRegra(`Esta ferramenta tem ${vinculos.join(' e ')}. Conclua ou tire o vínculo antes.`);
  await repositorios.ferramenta.arquivar(id);
  await avisarAlertas([id]);
}

export async function restaurarFerramenta(id: string): Promise<void> {
  const [ferramenta, ativas] = await Promise.all([repositorios.ferramenta.obter(id), repositorios.ferramenta.listar()]);
  if (ferramenta && ativas.some((outra) => outra.situacao !== 'cancelada' && normalizarTexto(outra.nome) === normalizarTexto(ferramenta.nome))) throw new ErroDeRegra('Já existe uma ferramenta ativa com esse nome. Mude o nome dela antes de restaurar esta.');
  await repositorios.ferramenta.restaurar(id);
  await avisarAlertas([id]);
}

// ---------- Arquivos (links do Drive, até o M08) ----------

const TIPO_DO_REGISTRO = 'ferramenta';

export async function linksDaFerramenta(id: string): Promise<AnexoLink[]> {
  return repositorios.anexo_link.listar({ onde: { registro_id: id, registro_tipo: TIPO_DO_REGISTRO } });
}

export async function adicionarLinkDaFerramenta(id: string, url: string): Promise<void> {
  const limpo = url.trim();
  if (!linkDoDriveValido(limpo)) throw new ErroDeRegra(MENSAGEM_LINK_DRIVE);
  await repositorios.anexo_link.criar({ registro_tipo: TIPO_DO_REGISTRO, registro_id: id, titulo: 'Arquivo do Drive', url: limpo });
}

export async function removerLinkDaFerramenta(id: string): Promise<void> {
  await repositorios.anexo_link.arquivar(id);
}

// ---------- Rateio (RN-04.05) ----------

export type LinhaDoRateio = { ligacaoId: string; percentual: string };

/** Soma 100%, ou tudo vazio: sem rateio, o custo vai inteiro para o contexto principal. */
export function erroDoRateio(linhas: readonly Pick<LinhaDoRateio, 'percentual'>[]): string | null {
  const preenchidas = linhas.filter((linha) => linha.percentual.trim());
  if (!preenchidas.length) return null;
  if (preenchidas.length !== linhas.length) return 'Preencha todos os percentuais, ou deixe todos vazios.';
  const valores = linhas.map((linha) => lerValor(linha.percentual));
  if (valores.some((valor) => valor === null || valor > 100)) return 'Use percentuais de 0 a 100.';
  const soma = valores.reduce<number>((total, valor) => total + (valor ?? 0), 0);
  return Math.abs(soma - 100) < 0.0001 ? null : `A soma precisa dar 100%. Está em ${String(Math.round(soma * 100) / 100).replace('.', ',')}%.`;
}

export async function definirRateio(linhas: readonly LinhaDoRateio[], vigenteDesde: string): Promise<void> {
  const erro = erroDoRateio(linhas);
  if (erro) throw new ErroDeRegra(erro);
  if (!vigenteDesde) throw new ErroDeRegra('Informe a partir de quando vale.');
  await emTransacao(async () => {
    for (const { ligacaoId, percentual } of linhas) await repositorios.ferramenta_contexto.atualizar(ligacaoId, { percentual_rateio: percentual.trim() ? lerValor(percentual) : null, vigente_desde: vigenteDesde });
  });
}

// ---------- Dados pessoais (RN-04.15) ----------

export const esquemaDadosPessoais = z
  .object({
    trata_dados_pessoais: z.boolean(),
    tipos_dados: z.array(z.enum(TIPOS_DE_DADOS)),
    regiao_dados: textoCurto,
    acordo_dados_situacao: z.string(),
    acordo_dados_url: textoCurto,
    dados_revisado_em: z.string(),
  })
  .superRefine((dados, contexto) => {
    if (!dados.trata_dados_pessoais) return;
    if (!dados.tipos_dados.length) contexto.addIssue({ code: 'custom', path: ['tipos_dados'], message: 'Escolha ao menos um tipo de dado.' });
    if (!dados.acordo_dados_situacao) contexto.addIssue({ code: 'custom', path: ['acordo_dados_situacao'], message: 'Diga a situação do acordo.' });
    if (dados.acordo_dados_url && !urlValida(dados.acordo_dados_url)) contexto.addIssue({ code: 'custom', path: ['acordo_dados_url'], message: 'Use um endereço completo, com https://.' });
  });

export type FormularioDadosPessoais = z.infer<typeof esquemaDadosPessoais>;

export function formularioDosDadosPessoais(ferramenta: Ferramenta): FormularioDadosPessoais {
  return { trata_dados_pessoais: ferramenta.trata_dados_pessoais, tipos_dados: ferramenta.tipos_dados, regiao_dados: ferramenta.regiao_dados ?? '', acordo_dados_situacao: ferramenta.acordo_dados_situacao ?? '', acordo_dados_url: ferramenta.acordo_dados_url ?? '', dados_revisado_em: ferramenta.dados_revisado_em ?? '' };
}

/** Os apps afetados são os produtos da ferramenta: sem nenhum, não há de quem os dados seriam. */
export async function salvarDadosPessoais(id: string, formulario: FormularioDadosPessoais): Promise<void> {
  const contextos = await repositorios.ferramenta_contexto.listar({ onde: { ferramenta_id: id } });
  if (formulario.trata_dados_pessoais && !contextos.some((ligacao) => ligacao.produto_id)) throw new ErroDeRegra('Para tratar dados de usuários, vincule a ferramenta a pelo menos um produto, em Produtos e rateio.');
  const trata = formulario.trata_dados_pessoais;
  await repositorios.ferramenta.atualizar(id, {
    trata_dados_pessoais: trata,
    tipos_dados: trata ? formulario.tipos_dados : [],
    regiao_dados: trata ? nulo(formulario.regiao_dados) : null,
    acordo_dados_situacao: trata ? (formulario.acordo_dados_situacao as Ferramenta['acordo_dados_situacao']) : null,
    acordo_dados_url: trata ? nulo(formulario.acordo_dados_url) : null,
    dados_revisado_em: trata ? nulo(formulario.dados_revisado_em) : null,
  });
}

// ---------- Ações em lote (T04.01) ----------

export async function vincularFerramentasAProduto(ids: readonly string[], contextoId: string, hoje: string = hojeISO()): Promise<void> {
  const produto_id = contextoId === ID_INSTITUCIONAL ? null : contextoId;
  await emTransacao(async () => {
    for (const ferramenta_id of ids) {
      const ligacoes = await repositorios.ferramenta_contexto.listar({ onde: { ferramenta_id } });
      if (ligacoes.some((ligacao) => ligacao.produto_id === produto_id)) continue;
      await repositorios.ferramenta_contexto.criar({ ferramenta_id, produto_id, percentual_rateio: null, vigente_desde: hoje });
      for (const ligacao of ligacoes) if (ligacao.percentual_rateio !== null) await repositorios.ferramenta_contexto.atualizar(ligacao.id, { percentual_rateio: null });
    }
  });
}

export async function mudarResponsavelTecnica(ids: readonly string[], pessoaId: string): Promise<void> {
  await emTransacao(async () => {
    for (const id of ids) await repositorios.ferramenta.atualizar(id, { responsavel_tecnico_id: pessoaId });
  });
}

// ---------- Rotina do dia (RN-04.09) ----------

/** Fim do teste sem decisão vira "Teste expirado"; cobrança automática que passou anda para a próxima. Devolve quantas mudaram. */
export async function atualizarSituacoesDasFerramentas(hoje: string = hojeISO()): Promise<number> {
  const [ferramentas, assinaturas] = await Promise.all([repositorios.ferramenta.listar(), repositorios.assinatura_ferramenta.listar({ onde: { situacao: 'ativa' } })]);
  let mudancas = 0;
  const mudadas = new Set<string>();
  await emTransacao(async () => {
    for (const assinatura of assinaturas) {
      const ferramenta = ferramentas.find((item) => item.id === assinatura.ferramenta_id);
      if (ferramenta?.situacao === 'teste' && assinatura.modalidade === 'teste' && assinatura.fim_teste && assinatura.fim_teste < hoje) {
        await repositorios.ferramenta.atualizar(ferramenta.id, { situacao: 'teste_expirado' });
        mudancas += 1;
      }
      const meses = assinatura.periodicidade ? MESES_DA_PERIODICIDADE[assinatura.periodicidade] : undefined;
      if (assinatura.modalidade === 'paga' && assinatura.renovacao === 'automatica' && assinatura.proxima_cobranca && assinatura.proxima_cobranca < hoje && meses) {
        let proxima = assinatura.proxima_cobranca;
        for (let voltas = 1; proxima < hoje && voltas < 240; voltas += 1) proxima = somarMeses(assinatura.proxima_cobranca, meses * voltas, assinatura.dia_cobranca);
        await repositorios.assinatura_ferramenta.atualizar(assinatura.id, { proxima_cobranca: proxima });
        mudancas += 1;
        mudadas.add(assinatura.ferramenta_id);
      }
    }
  });
  // A renovação passou e a data andou: o alerta dela se resolve hoje, e não amanhã.
  await avisarAlertas([...mudadas], hoje);
  return mudancas;
}

// ---------- Carga ----------

export type LinhaDaFerramenta = Ferramenta & {
  contextos: FerramentaContexto[];
  assinatura: AssinaturaFerramenta | null;
  equivalenteMensal: number | null;
};

export type DadosDasFerramentas = {
  ferramentas: LinhaDaFerramenta[];
  categorias: CategoriaFerramenta[];
  pessoas: Pessoa[];
  produtos: Produto[];
  marcas: Marca[];
  areas: Area[];
  contrapartes: Contraparte[];
  contas: ContaFinanceira[];
  categoriasFinanceiras: CategoriaFinanceira[];
  cambios: CambioReferencia[];
};

export async function carregarFerramentas(): Promise<DadosDasFerramentas> {
  const [ferramentas, contextos, assinaturas, categorias, pessoas, produtos, marcas, areas, contrapartes, contas, categoriasFinanceiras, cambios] = await Promise.all([
    repositorios.ferramenta.listar({ incluirArquivados: true }),
    repositorios.ferramenta_contexto.listar(),
    repositorios.assinatura_ferramenta.listar(),
    repositorios.categoria_ferramenta.listar(),
    repositorios.pessoa.listar({ incluirArquivados: true }),
    repositorios.produto.listar({ incluirArquivados: true }),
    repositorios.marca.listar({ incluirArquivados: true }),
    repositorios.area.listar(),
    repositorios.contraparte.listar({ incluirArquivados: true }),
    repositorios.conta_financeira.listar(),
    repositorios.categoria_financeira.listar(),
    repositorios.cambio_referencia.listar(),
  ]);
  return {
    ferramentas: ferramentas.map((ferramenta) => {
      const assinatura = assinaturaAtiva(assinaturas.filter((item) => item.ferramenta_id === ferramenta.id));
      return { ...ferramenta, contextos: contextos.filter((ligacao) => ligacao.ferramenta_id === ferramenta.id), assinatura, equivalenteMensal: assinatura ? equivalenteMensalBrl(assinatura, cambios) : null };
    }),
    categorias: categorias.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    pessoas,
    produtos,
    marcas,
    areas,
    contrapartes,
    contas,
    categoriasFinanceiras,
    cambios,
  };
}

export type FichaDaFerramenta = { assinaturas: AssinaturaFerramenta[]; valores: AssinaturaValorHistorico[]; vinculos: string[]; titulos: Titulo[] };

export async function carregarFichaDaFerramenta(id: string): Promise<FichaDaFerramenta> {
  const [assinaturas, valores, vinculos, titulos] = await Promise.all([repositorios.assinatura_ferramenta.listar({ onde: { ferramenta_id: id } }), repositorios.assinatura_valor_historico.listar(), vinculosDaFerramenta(id), repositorios.titulo.listar({ onde: { ferramenta_id: id } })]);
  const ids = new Set(assinaturas.map((assinatura) => assinatura.id));
  return { assinaturas: assinaturas.sort((a, b) => b.inicio.localeCompare(a.inicio)), valores: valores.filter((valor) => ids.has(valor.assinatura_id)).sort((a, b) => b.efeito_em.localeCompare(a.efeito_em) || b.criado_em.localeCompare(a.criado_em)), vinculos, titulos: titulos.sort((a, b) => b.vencimento.localeCompare(a.vencimento)) };
}

// ---------- Lista (T04.01) ----------

export type FiltrosFerramentas = {
  busca: string;
  categoria: string;
  contexto: string;
  situacao: string;
  modalidade: string;
  critica: '' | 'sim' | 'nao';
  titular: string;
  dados: '' | 'sim' | 'nao';
  venceEm: '' | '7' | '30' | '60' | '90';
  arquivadas: boolean;
};

export const FILTROS_FERRAMENTAS_INICIAIS: FiltrosFerramentas = { busca: '', categoria: '', contexto: '', situacao: '', modalidade: '', critica: '', titular: '', dados: '', venceEm: '', arquivadas: false };

function somarDias(dia: string, dias: number): string {
  const data = new Date(`${dia}T00:00:00Z`);
  data.setUTCDate(data.getUTCDate() + dias);
  return data.toISOString().slice(0, 10);
}

/** O contexto da tela prevalece sobre o seletor global; sem ele, vale o seletor. */
export function filtrarFerramentas(ferramentas: readonly LinhaDaFerramenta[], filtros: FiltrosFerramentas, { contextoGlobalId, hoje, nomeDaCategoria }: { contextoGlobalId: string; hoje: string; nomeDaCategoria: (id: string) => string }): LinhaDaFerramenta[] {
  const texto = normalizarTexto(filtros.busca);
  const contexto = filtros.contexto || (contextoGlobalId === ID_CONSOLIDADA ? '' : contextoGlobalId);
  return ferramentas
    .filter((ferramenta) => Boolean(ferramenta.arquivado_em) === filtros.arquivadas)
    .filter((ferramenta) => !texto || normalizarTexto(`${ferramenta.codigo} ${ferramenta.nome} ${ferramenta.finalidade} ${nomeDaCategoria(ferramenta.categoria_id)}`).includes(texto))
    .filter((ferramenta) => !filtros.categoria || ferramenta.categoria_id === filtros.categoria)
    .filter((ferramenta) => !contexto || ferramenta.contextos.some((ligacao) => (ligacao.produto_id ?? ID_INSTITUCIONAL) === contexto))
    .filter((ferramenta) => !filtros.situacao || ferramenta.situacao === filtros.situacao)
    .filter((ferramenta) => !filtros.modalidade || (filtros.modalidade === 'a_definir' ? !ferramenta.assinatura : ferramenta.assinatura?.modalidade === filtros.modalidade))
    .filter((ferramenta) => !filtros.critica || ferramenta.critica === (filtros.critica === 'sim'))
    .filter((ferramenta) => !filtros.titular || ferramenta.titular_atual_tipo === filtros.titular)
    .filter((ferramenta) => !filtros.dados || ferramenta.trata_dados_pessoais === (filtros.dados === 'sim'))
    .filter((ferramenta) => {
      if (!filtros.venceEm) return true;
      const proxima = ferramenta.assinatura?.proxima_cobranca;
      return Boolean(proxima) && (proxima as string) >= hoje && (proxima as string) <= somarDias(hoje, Number(filtros.venceEm));
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export type IndicadoresDeFerramentas = {
  ativas: number;
  pagas: number;
  emTeste: number;
  /** Soma estimada em BRL; `naoIncluidas` diz quem ficou de fora (CA-04.02). */
  custoMensal: number;
  naoIncluidas: number;
  renovacoes30: number;
};

const emUso = (ferramenta: LinhaDaFerramenta) => !ferramenta.arquivado_em && ferramenta.situacao !== 'cancelada';

/**
 * Quanto do custo cabe a um contexto (RN-04.05): o percentual do rateio; sem rateio, tudo para o
 * contexto principal, que é o primeiro. Sem contexto escolhido, a Numa inteira vê o custo inteiro.
 */
export function parteDoContexto(ferramenta: Pick<LinhaDaFerramenta, 'contextos'>, contextoId: string = ID_CONSOLIDADA): number {
  if (contextoId === ID_CONSOLIDADA) return 1;
  const ligacao = ferramenta.contextos.find((item) => (item.produto_id ?? ID_INSTITUCIONAL) === contextoId);
  if (!ligacao) return 0;
  if (ligacao.percentual_rateio !== null) return ligacao.percentual_rateio / 100;
  return ferramenta.contextos[0] === ligacao ? 1 : 0;
}

/** Indicadores do topo de T04.01. "Sem duas chaves" entra na F2 (D14). */
export function indicadoresDeFerramentas(ferramentas: readonly LinhaDaFerramenta[], hoje: string, contextoId: string = ID_CONSOLIDADA): IndicadoresDeFerramentas {
  const usadas = ferramentas.filter(emUso);
  const pagas = usadas.filter((ferramenta) => ferramenta.assinatura?.modalidade === 'paga');
  return {
    ativas: usadas.filter((ferramenta) => ferramenta.situacao === 'ativa').length,
    pagas: pagas.length,
    emTeste: usadas.filter((ferramenta) => ferramenta.situacao === 'teste' || ferramenta.situacao === 'teste_expirado').length,
    custoMensal: pagas.reduce((total, ferramenta) => total + (ferramenta.equivalenteMensal ?? 0) * parteDoContexto(ferramenta, contextoId), 0),
    naoIncluidas: pagas.filter((ferramenta) => ferramenta.equivalenteMensal === null).length,
    renovacoes30: usadas.filter((ferramenta) => {
      const proxima = ferramenta.assinatura?.proxima_cobranca;
      return Boolean(proxima) && (proxima as string) >= hoje && (proxima as string) <= somarDias(hoje, 30);
    }).length,
  };
}

// ---------- Nas fichas dos outros cadastros ----------

/** CA-04.01: na ficha do produto, a ferramenta aparece uma vez. */
export async function ferramentasDoProduto(id: string): Promise<Ferramenta[]> {
  const [ligacoes, ferramentas] = await Promise.all([repositorios.ferramenta_contexto.listar({ onde: { produto_id: id } }), repositorios.ferramenta.listar()]);
  const ids = new Set(ligacoes.map((ligacao) => ligacao.ferramenta_id));
  return ferramentas.filter((ferramenta) => ids.has(ferramenta.id)).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export async function ferramentasDaContraparte(id: string): Promise<Ferramenta[]> {
  return (await repositorios.ferramenta.listar({ onde: { fornecedor_id: id } })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

const emUsoSimples = (ferramenta: Pick<Ferramenta, 'situacao'>) => ferramenta.situacao !== 'cancelada';

export async function vinculosDeFerramentaDaContraparte(id: string): Promise<string[]> {
  return (await ferramentasDaContraparte(id)).filter(emUsoSimples).map((ferramenta) => `Fornecedor de ${ferramenta.nome}`);
}

export async function vinculosDeFerramentaDaPessoa(id: string): Promise<string[]> {
  const ferramentas = (await repositorios.ferramenta.listar()).filter(emUsoSimples);
  return ferramentas.flatMap((ferramenta) => [...(ferramenta.responsavel_tecnico_id === id ? [`Responsável técnica de ${ferramenta.nome}`] : []), ...(ferramenta.responsavel_financeiro_id === id ? [`Responsável financeira de ${ferramenta.nome}`] : [])]);
}

export async function quantasFerramentasDoProduto(id: string): Promise<number> {
  return (await ferramentasDoProduto(id)).filter(emUsoSimples).length;
}

export async function vinculosDeFerramentaDaConta(id: string): Promise<string[]> {
  const [assinaturas, ferramentas] = await Promise.all([repositorios.assinatura_ferramenta.listar({ onde: { conta_financeira_id: id, situacao: 'ativa' } }), repositorios.ferramenta.listar()]);
  return assinaturas.flatMap((assinatura) => {
    const ferramenta = ferramentas.find((item) => item.id === assinatura.ferramenta_id);
    return ferramenta ? [`Conta de pagamento de ${ferramenta.nome}`] : [];
  });
}

/** A sugestão da categoria de ferramenta não conta: é só sugestão, e deixa de ser oferecida se a categoria sair. */
export async function vinculosDeFerramentaDaCategoria(id: string): Promise<string[]> {
  const [assinaturas, ferramentas] = await Promise.all([repositorios.assinatura_ferramenta.listar({ onde: { categoria_financeira_id: id, situacao: 'ativa' } }), repositorios.ferramenta.listar()]);
  return assinaturas.flatMap((assinatura) => {
    const ferramenta = ferramentas.find((item) => item.id === assinatura.ferramenta_id);
    return ferramenta ? [`Assinatura de ${ferramenta.nome}`] : [];
  });
}
