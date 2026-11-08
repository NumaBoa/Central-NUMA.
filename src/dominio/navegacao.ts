/**
 * Menu da Central (01 §4 e 18 §10.2). Decisão de 05/11/2026: a estrutura final fica sempre visível,
 * e o que ainda não está disponível aparece esmaecido como "Em breve", sem link.
 * Decisão de Kimberly em 07/11/2026: tudo o que já foi construído fica liberado no menu, em qualquer fase.
 * A fase da Numa saiu do sistema em 08/11/2026: `fase` aqui é só a da especificação (01 §4).
 */
export const FASES = ['f0a', 'f0b', 'f1', 'f2', 'f3'] as const;
export type Fase = (typeof FASES)[number];

export type IconeModulo =
  | 'meu-dia'
  | 'empresa'
  | 'produtos'
  | 'comercial'
  | 'contratos'
  | 'financeiro'
  | 'operacao'
  | 'ferramentas'
  | 'legal'
  | 'marca'
  | 'configuracoes';

export type Modulo = {
  id: IconeModulo;
  nome: string;
  /** Nome curto para a barra do celular. */
  curto?: string;
  /** Fase em que o módulo começa (01 §4). */
  fase: Fase;
  /** Só existe depois que a tela é construída. */
  href?: string;
};

export const MODULOS_TOPO: readonly Modulo[] = [
  { id: 'meu-dia', nome: 'Meu dia', fase: 'f0a', href: '/meu-dia' },
];

export const MODULOS_EMPRESA: readonly Modulo[] = [
  { id: 'empresa', nome: 'Empresa', fase: 'f0b', href: '/empresa' },
  { id: 'produtos', nome: 'Produtos', fase: 'f0b', href: '/produtos' },
  { id: 'comercial', nome: 'Comercial', fase: 'f1', href: '/comercial' },
  { id: 'contratos', nome: 'Contratos', fase: 'f1', href: '/contratos' },
  { id: 'financeiro', nome: 'Financeiro', fase: 'f0a', href: '/financeiro' },
  { id: 'operacao', nome: 'Operação', fase: 'f2', href: '/operacao' },
  { id: 'ferramentas', nome: 'Ferramentas e ativos', curto: 'Ferramentas', fase: 'f0a', href: '/ferramentas' },
  { id: 'legal', nome: 'Legal e privacidade', fase: 'f0b', href: '/legal' },
  { id: 'marca', nome: 'Marca e marketing', fase: 'f0b' },
];

export const MODULO_CONFIGURACOES: Modulo = {
  id: 'configuracoes',
  nome: 'Configurações',
  fase: 'f0a',
  href: '/configuracoes',
};

/** Barra inferior do celular (18 §10.5): os demais módulos ficam no "Mais". */
export const IDS_BARRA_CELULAR: readonly IconeModulo[] = ['meu-dia', 'financeiro', 'ferramentas'];

/** O Meu dia é a tela inicial do sistema (05-M03 §1). */
export const TELA_INICIAL = '/meu-dia';

/** Tela construída aparece no menu em qualquer fase; só o que não existe fica "Em breve" (decisão de 07/11/2026). */
export function moduloDisponivel(modulo: Modulo): boolean {
  return Boolean(modulo.href);
}

export function moduloAtivo(modulo: Modulo, caminho: string): boolean {
  if (!modulo.href) return false;
  return caminho === modulo.href || caminho.startsWith(`${modulo.href}/`);
}
