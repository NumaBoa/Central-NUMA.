/**
 * Contrato de integração com M07 (ofertas, recursos, canais, preços e T07.10). Proprietário: frente do M07.
 * M10 e M11 só falam com esta interface; nada aqui é cadastro. Enquanto a frente do M07 não conectar a
 * implementação real em `conexoes.ts`, vale `catalogoAusente`: as telas explicam a pendência e bloqueiam só
 * o que depende dela. Detalhes de campos e de conexão: `frente-m09-m11/INTEGRACAO.md`.
 */

/** Limite vazio não significa ilimitado (decisão vigente 4): cada caso é explícito. */
export type LimiteDoRecurso = { tipo: 'limitado'; valor: number; unidade: string | null } | { tipo: 'ilimitado' } | { tipo: 'nao_se_aplica' } | { tipo: 'nao_informado' };

export type RecursoDaOferta = {
  id: string;
  nome: string;
  incluido: boolean;
  limite: LimiteDoRecurso;
  /** RN-10.07: recurso que ainda não existe só entra com prazo e o texto "previsto para". */
  planejado: boolean;
  disponivel_previsto_em: string | null;
  ordem: number;
};

export type SuporteDaOferta = { canal: string | null; horario: string | null; prazo_critico: string | null; prazo_normal: string | null };

export type OfertaDoCatalogo = {
  id: string;
  produto_id: string;
  nome: string;
  tipo: 'assinatura' | 'implantacao' | 'servico_pontual' | 'sob_medida' | 'consumo' | 'comissao' | 'gratuidade';
  publico: 'b2c' | 'b2b' | 'parceiro';
  formalizacao: 'adesao_padrao' | 'contrato_negociado' | 'ambos';
  situacao: 'em_estudo' | 'aprovada' | 'inativa';
  descricao: string | null;
  exclusoes: string | null;
  // Campos novos de T07.04 (19 §8).
  regras_uso: string | null;
  suporte: SuporteDaOferta | null;
  disponibilidade_meta: number | null;
  disponibilidade_compensacao: string | null;
  teste_dias: number | null;
  /** Ofertas de adicional vinculadas a este plano. */
  adicionais_ids: readonly string[];
  recursos: readonly RecursoDaOferta[];
};

export type CanalDoCatalogo = {
  id: string;
  nome: string;
  tipo: 'loja_ios' | 'loja_android' | 'web_gateway' | 'direto' | 'patrocinio' | 'outro';
  situacao: 'ativa' | 'inativa';
  /** `contrato.canal_cobranca`, em T11.14. */
  cobranca: 'Direto' | 'Gateway' | 'Google Play' | null;
  gateway_nome: string | null;
};

export type PrecoDoCatalogo = {
  id: string;
  oferta_id: string;
  /** Sem canal: vale para todos. */
  canal_id: string | null;
  versao: number;
  /** Vazio é "Não definido", nunca zero (RN-07.02). */
  valor: number | null;
  moeda: string;
  periodicidade: 'mensal' | 'trimestral' | 'semestral' | 'anual' | 'unica' | 'por_uso';
  valido_de: string | null;
  valido_ate: string | null;
  situacao: 'rascunho' | 'aprovada' | 'substituida';
};

/** Os campos de T07.10 (19 §4). Texto vazio é pendência (RN-11.35 g), nunca preenchido com padrão. */
export type ConfiguracaoContratual = {
  id: string;
  produto_id: string;
  versao: number;
  situacao: 'rascunho' | 'em_validacao' | 'validada' | 'substituida';
  nome_maiusculo: string | null;
  descricao_contratual: string | null;
  funcoes_de_apoio: string | null;
  modalidades: readonly ('Navegador' | 'Android' | 'iOS')[];
  diferencas_modalidades: string | null;
  plano_apos_teste: string | null;
  url_termos: string | null;
  url_privacidade: string | null;
  url_ajuda: string | null;
  email_contato: string | null;
  prazo_reembolso_dias: number | null;
  aviso_alteracao_dias: number | null;
  aviso_renovacao_anual_dias: number | null;
  aviso_manutencao_horas: number | null;
  aviso_suboperador_dias: number | null;
  prazo_encaminhar_titular_dias: number | null;
  prazo_aviso_incidente_horas: number | null;
  prazo_reativacao_horas: number | null;
  aviso_resilicao_dias: number | null;
  prazo_cura_dias: number | null;
  aviso_cessao_dias: number | null;
  prazo_exportacao_dias: number | null;
  prazo_exclusao_dias: number | null;
  prazo_expurgo_backup_dias: number | null;
  formatos_exportacao: readonly string[];
  categorias_dados_operador: string | null;
  categorias_titulares: string | null;
  categorias_dados_controlador: string | null;
  provedor_infraestrutura: string | null;
  local_armazenamento: string | null;
  transferencia_internacional_texto: string | null;
  suboperadores: readonly { nome: string; finalidade: string; pais: string }[];
  medidas_seguranca: string | null;
  backup_frequencia: string | null;
  backup_retencao_dias: number | null;
  procedimento_recuperacao: string | null;
  canal_privacidade: string | null;
  canal_incidentes: string | null;
};

export type EstadoDoCatalogo = 'conectado' | 'ausente' | 'exemplo';

export interface CatalogoComercial {
  /** `exemplo` só em desenvolvimento e testes, e a tela avisa. */
  readonly estado: EstadoDoCatalogo;
  ofertasDoProduto(produtoId: string): Promise<readonly OfertaDoCatalogo[]>;
  oferta(ofertaId: string): Promise<OfertaDoCatalogo | null>;
  canais(): Promise<readonly CanalDoCatalogo[]>;
  /** Todos os preços da oferta, em qualquer situação. */
  precosDaOferta(ofertaId: string): Promise<readonly PrecoDoCatalogo[]>;
  /** A versão Validada vigente. Nenhuma: `null`. */
  configuracaoValidada(produtoId: string): Promise<ConfiguracaoContratual | null>;
  /** A mais recente, em qualquer situação: serve para explicar a pendência. */
  configuracaoMaisRecente(produtoId: string): Promise<ConfiguracaoContratual | null>;
}

/** Sem M07: nada existe, e ninguém finge que existe. */
export const catalogoAusente: CatalogoComercial = {
  estado: 'ausente',
  ofertasDoProduto: async () => [],
  oferta: async () => null,
  canais: async () => [],
  precosDaOferta: async () => [],
  configuracaoValidada: async () => null,
  configuracaoMaisRecente: async () => null,
};

export const MENSAGEM_CATALOGO_AUSENTE = 'O catálogo de ofertas e preços (M07) ainda não está conectado. Dá para salvar o rascunho; a emissão final espera a oferta aprovada e o preço.';

/** RN-07.05 e RN-11.31: Aprovada, para a oferta, o canal (ou todos) e a periodicidade, vigente na data. */
export function precoVigente(precos: readonly PrecoDoCatalogo[], { canalId, periodicidade, naData }: { canalId: string | null; periodicidade: string | null; naData: string }): PrecoDoCatalogo | null {
  const validos = precos.filter((preco) => preco.situacao === 'aprovada' && (!periodicidade || preco.periodicidade === periodicidade) && (!preco.valido_de || preco.valido_de <= naData) && (!preco.valido_ate || preco.valido_ate >= naData));
  // O preço do canal vale antes do preço de "todos os canais".
  const doCanal = validos.filter((preco) => preco.canal_id !== null && preco.canal_id === canalId);
  const paraTodos = validos.filter((preco) => preco.canal_id === null);
  const candidatos = doCanal.length ? doCanal : paraTodos;
  return [...candidatos].sort((a, b) => b.versao - a.versao)[0] ?? null;
}

/** Decisão vigente 4: "Não informado" é pendência, e nunca sai como "Ilimitado". */
export function textoDoLimite(limite: LimiteDoRecurso): string {
  if (limite.tipo === 'limitado') return `${limite.valor.toLocaleString('pt-BR')}${limite.unidade ? ` ${limite.unidade}` : ''}`;
  if (limite.tipo === 'ilimitado') return 'Ilimitado';
  return limite.tipo === 'nao_se_aplica' ? 'Não se aplica' : '';
}

const OBRIGATORIOS_DA_CONFIGURACAO: readonly [keyof ConfiguracaoContratual, string][] = [
  ['nome_maiusculo', 'Nome em maiúsculas'],
  ['descricao_contratual', 'Descrição contratual'],
  ['funcoes_de_apoio', 'Funções de apoio'],
  ['url_termos', 'URL dos Termos de Uso'],
  ['url_privacidade', 'URL da Política de Privacidade'],
  ['url_ajuda', 'URL da ajuda'],
  ['email_contato', 'E-mail de contato contratual'],
  ['prazo_reembolso_dias', 'Prazo de reembolso'],
  ['aviso_alteracao_dias', 'Aviso de alteração'],
  ['aviso_manutencao_horas', 'Aviso de manutenção'],
  ['aviso_suboperador_dias', 'Aviso de suboperador'],
  ['prazo_encaminhar_titular_dias', 'Encaminhamento ao titular'],
  ['prazo_aviso_incidente_horas', 'Aviso de incidente'],
  ['prazo_reativacao_horas', 'Prazo de reativação'],
  ['aviso_resilicao_dias', 'Aviso de encerramento'],
  ['prazo_cura_dias', 'Correção de descumprimento'],
  ['aviso_cessao_dias', 'Aviso de cessão'],
  ['prazo_exportacao_dias', 'Prazo de exportação'],
  ['prazo_exclusao_dias', 'Prazo de exclusão'],
  ['prazo_expurgo_backup_dias', 'Expurgo das cópias de segurança'],
  ['categorias_dados_operador', 'Anexo II: dados como operadora'],
  ['categorias_titulares', 'Anexo II: titulares'],
  ['categorias_dados_controlador', 'Anexo II: dados como controladora'],
  ['provedor_infraestrutura', 'Anexo II: provedor de infraestrutura'],
  ['local_armazenamento', 'Anexo II: local de armazenamento'],
  ['transferencia_internacional_texto', 'Anexo II: transferência internacional'],
  ['medidas_seguranca', 'Anexo II: medidas de segurança'],
  ['backup_frequencia', 'Anexo II: frequência das cópias'],
  ['backup_retencao_dias', 'Anexo II: retenção das cópias'],
  ['procedimento_recuperacao', 'Anexo II: procedimento de recuperação'],
  ['canal_privacidade', 'Anexo II: canal de privacidade'],
  ['canal_incidentes', 'Anexo II: canal de incidentes'],
];

/** RN-11.35 g: o que falta na configuração validada. Só controles e fornecedores que existem de fato. */
export function camposVaziosDaConfiguracao(configuracao: ConfiguracaoContratual): string[] {
  const vazios = OBRIGATORIOS_DA_CONFIGURACAO.filter(([campo]) => {
    const valor = configuracao[campo];
    return valor === null || valor === undefined || (typeof valor === 'string' && !valor.trim());
  }).map(([, rotulo]) => rotulo);
  if (!configuracao.modalidades.length) vazios.push('Modalidades de acesso');
  if (!configuracao.formatos_exportacao.length) vazios.push('Formatos de exportação');
  if (!configuracao.suboperadores.length) vazios.push('Anexo II: suboperadores');
  return vazios;
}
