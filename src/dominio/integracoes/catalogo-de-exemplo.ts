/**
 * IMPLEMENTAÇÃO DE EXEMPLO do catálogo: só para testes e para a verificação em desenvolvimento
 * (`NEXT_PUBLIC_CATALOGO_EXEMPLO=1`). Nunca é a fonte real, e toda tela que a usa mostra o aviso.
 * Os valores vêm da proposta de 19 §9 e dos critérios de aceite, e não foram aprovados por ninguém.
 */
import { ID_PRODUTO_KIPI } from '@/dados/exemplos/base';
import type { CanalDoCatalogo, CatalogoComercial, ConfiguracaoContratual, OfertaDoCatalogo, PrecoDoCatalogo, RecursoDaOferta } from './catalogo-comercial';

export const ID_OFERTA_REVENDA = 'ex-oferta-revenda';
export const ID_OFERTA_ATELIE = 'ex-oferta-atelie';
export const ID_OFERTA_ESTUDO = 'ex-oferta-estudo';
export const ID_OFERTA_PACOTE = 'ex-oferta-pacote';
export const ID_OFERTA_SEM_LIMITE = 'ex-oferta-sem-limite';
export const ID_CANAL_DIRETO = 'ex-canal-direto';
export const ID_CANAL_PLAY = 'ex-canal-play';

const recurso = (id: string, nome: string, limite: RecursoDaOferta['limite'], incluido = true, ordem = 0): RecursoDaOferta => ({ id, nome, incluido, limite, planejado: false, disponivel_previsto_em: null, ordem });

const baseOferta = { produto_id: ID_PRODUTO_KIPI, publico: 'b2b', formalizacao: 'ambos', situacao: 'aprovada', tipo: 'assinatura', exclusoes: 'Fluxo de caixa, relatórios avançados e histórico de alterações', regras_uso: 'Regras do plano, ainda a confirmar pelas sócias.', suporte: { canal: 'WhatsApp com prioridade', horario: 'em horário comercial', prazo_critico: '1 dia útil', prazo_normal: '2 dias úteis' }, disponibilidade_meta: null, disponibilidade_compensacao: null, teste_dias: 14, adicionais_ids: [], recursos: [] } as const;

const OFERTAS: readonly OfertaDoCatalogo[] = [
  { ...baseOferta, id: ID_OFERTA_REVENDA, nome: 'Revenda', descricao: 'Para quem vende com revendedoras.', adicionais_ids: [ID_OFERTA_PACOTE], recursos: [recurso('r1', 'Revendedoras ativas', { tipo: 'limitado', valor: 15, unidade: null }), recurso('r2', 'Pedidos', { tipo: 'ilimitado' }, true, 1), recurso('r3', 'Fluxo de caixa', { tipo: 'nao_se_aplica' }, false, 2)] },
  { ...baseOferta, id: ID_OFERTA_ATELIE, nome: 'Ateliê', descricao: 'Para ateliês.', recursos: [recurso('a1', 'Pedidos', { tipo: 'limitado', valor: 200, unidade: 'por mês' })] },
  { ...baseOferta, id: ID_OFERTA_PACOTE, nome: 'Pacote de 10 revendedoras', descricao: 'Adicional do Revenda.', recursos: [] },
  { ...baseOferta, id: ID_OFERTA_SEM_LIMITE, nome: 'Plano com limite não informado', descricao: 'Para testar a pendência do limite.', recursos: [recurso('s1', 'Pedidos', { tipo: 'nao_informado' })] },
  { ...baseOferta, id: ID_OFERTA_ESTUDO, nome: 'Plano em estudo', descricao: null, situacao: 'em_estudo' },
];

const CANAIS: readonly CanalDoCatalogo[] = [
  { id: ID_CANAL_DIRETO, nome: 'Venda direta (exemplo)', tipo: 'direto', situacao: 'ativa', cobranca: 'Direto', gateway_nome: null },
  { id: ID_CANAL_PLAY, nome: 'Google Play (exemplo)', tipo: 'loja_android', situacao: 'ativa', cobranca: 'Google Play', gateway_nome: null },
];

const preco = (id: string, oferta_id: string, valor: number | null, periodicidade: PrecoDoCatalogo['periodicidade'], extra: Partial<PrecoDoCatalogo> = {}): PrecoDoCatalogo => ({ id, oferta_id, canal_id: ID_CANAL_DIRETO, versao: 1, valor, moeda: 'BRL', periodicidade, valido_de: '2026-01-01', valido_ate: null, situacao: 'aprovada', ...extra });

const PRECOS: readonly PrecoDoCatalogo[] = [
  preco('p-rev-anual', ID_OFERTA_REVENDA, 599, 'anual'),
  preco('p-rev-mensal', ID_OFERTA_REVENDA, 59.9, 'mensal'),
  preco('p-rev-velho', ID_OFERTA_REVENDA, 499, 'anual', { versao: 0, situacao: 'substituida', valido_ate: '2025-12-31' }),
  preco('p-atelie', ID_OFERTA_ATELIE, 39.9, 'mensal'),
  preco('p-pacote', ID_OFERTA_PACOTE, 19.9, 'mensal'),
  preco('p-sem-limite', ID_OFERTA_SEM_LIMITE, 10, 'mensal'),
  preco('p-sem-valor', ID_OFERTA_ESTUDO, null, 'mensal', { situacao: 'rascunho' }),
];

export const CONFIGURACAO_DE_EXEMPLO: ConfiguracaoContratual = {
  id: 'ex-config-kipi',
  produto_id: ID_PRODUTO_KIPI,
  versao: 1,
  situacao: 'validada',
  nome_maiusculo: 'KIPI',
  descricao_contratual: 'um sistema de apoio à gestão de quem produz alimentos de forma artesanal',
  funcoes_de_apoio: 'precificação, fichas técnicas, pedidos e controle de vendas',
  modalidades: ['Navegador', 'Android'],
  diferencas_modalidades: null,
  plano_apos_teste: 'Grátis',
  url_termos: 'https://exemplo.invalid/termos',
  url_privacidade: 'https://exemplo.invalid/privacidade',
  url_ajuda: 'https://exemplo.invalid/ajuda',
  email_contato: 'contato@exemplo.invalid',
  prazo_reembolso_dias: 10,
  aviso_alteracao_dias: 30,
  aviso_renovacao_anual_dias: 15,
  aviso_manutencao_horas: 24,
  aviso_suboperador_dias: 15,
  prazo_encaminhar_titular_dias: 2,
  prazo_aviso_incidente_horas: 48,
  prazo_reativacao_horas: 4,
  aviso_resilicao_dias: 60,
  prazo_cura_dias: 15,
  aviso_cessao_dias: 30,
  prazo_exportacao_dias: 30,
  prazo_exclusao_dias: 30,
  prazo_expurgo_backup_dias: 90,
  formatos_exportacao: ['CSV', 'PDF'],
  categorias_dados_operador: 'Clientes e revendedoras (exemplo)',
  categorias_titulares: 'Clientes finais (exemplo)',
  categorias_dados_controlador: 'Cadastro da conta (exemplo)',
  provedor_infraestrutura: 'Provedor de exemplo',
  local_armazenamento: 'Local de exemplo',
  transferencia_internacional_texto: 'Não (exemplo)',
  suboperadores: [{ nome: 'Suboperador de exemplo', finalidade: 'Hospedagem', pais: 'Brasil' }],
  medidas_seguranca: 'Medidas de exemplo',
  backup_frequencia: 'diária (exemplo)',
  backup_retencao_dias: 30,
  procedimento_recuperacao: 'Procedimento de exemplo',
  canal_privacidade: 'privacidade@exemplo.invalid',
  canal_incidentes: 'incidentes@exemplo.invalid',
};

/** `configuracoes` troca a configuração por produto, para testar a pendência (CA-11.15) e a nova versão (CA-11.17). */
export function criarCatalogoDeExemplo({ configuracoes = { [ID_PRODUTO_KIPI]: CONFIGURACAO_DE_EXEMPLO } }: { configuracoes?: Record<string, ConfiguracaoContratual | null> } = {}): CatalogoComercial {
  return {
    estado: 'exemplo',
    ofertasDoProduto: async (produtoId) => OFERTAS.filter((oferta) => oferta.produto_id === produtoId),
    oferta: async (id) => OFERTAS.find((oferta) => oferta.id === id) ?? null,
    canais: async () => CANAIS,
    precosDaOferta: async (id) => PRECOS.filter((item) => item.oferta_id === id),
    configuracaoValidada: async (produtoId) => {
      const configuracao = configuracoes[produtoId] ?? null;
      return configuracao?.situacao === 'validada' ? configuracao : null;
    },
    configuracaoMaisRecente: async (produtoId) => configuracoes[produtoId] ?? null,
  };
}
