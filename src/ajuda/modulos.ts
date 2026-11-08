import { MODULO_CONFIGURACOES, MODULOS_EMPRESA, MODULOS_TOPO, type IconeModulo } from '@/dominio/navegacao';
import { MANUAL_MEU_DIA } from './manuais/meu-dia';
import type { Manual } from './tipos';

/**
 * Um manual por módulo (pedido de Kimberly em 08/11/2026). A disponibilidade do módulo vem do menu
 * (`navegacao.ts`): é a mesma fonte do menu e da busca, para nunca haver duas listas contraditórias.
 * `manual` vazio quer dizer "em preparação": o módulo ainda não tem artigos escritos.
 */
export type ModuloDoManual = {
  codigo: string;
  nome: string;
  slug: string;
  /** O item do menu que diz se o módulo existe. Sem item, o módulo ainda não tem tela própria. */
  menu: IconeModulo | null;
  manual: Manual | null;
};

export const MODULOS_DOS_MANUAIS: readonly ModuloDoManual[] = [
  { codigo: 'M01', nome: 'Acesso e auditoria', slug: 'acesso', menu: 'configuracoes', manual: null },
  { codigo: 'M02', nome: 'Cadastros e configurações', slug: 'cadastros', menu: 'configuracoes', manual: null },
  { codigo: 'M03', nome: 'Meu dia', slug: 'meu-dia', menu: 'meu-dia', manual: MANUAL_MEU_DIA },
  { codigo: 'M04', nome: 'Ferramentas e ativos', slug: 'ferramentas', menu: 'ferramentas', manual: null },
  { codigo: 'M05', nome: 'Financeiro', slug: 'financeiro', menu: 'financeiro', manual: null },
  { codigo: 'M06', nome: 'Sociedade e empresa', slug: 'empresa', menu: 'empresa', manual: null },
  { codigo: 'M07', nome: 'Produtos e precificação', slug: 'produtos', menu: 'produtos', manual: null },
  { codigo: 'M08', nome: 'Biblioteca e marketing', slug: 'marketing', menu: 'marca', manual: null },
  { codigo: 'M09', nome: 'Legal e privacidade', slug: 'legal', menu: 'legal', manual: null },
  { codigo: 'M10', nome: 'Comercial', slug: 'comercial', menu: 'comercial', manual: null },
  { codigo: 'M11', nome: 'Contratos', slug: 'contratos', menu: 'contratos', manual: null },
  { codigo: 'M12', nome: 'Operação', slug: 'operacao', menu: 'operacao', manual: null },
  { codigo: 'M13', nome: 'Visão geral e relatórios', slug: 'relatorios', menu: null, manual: null },
];

const TODOS_DO_MENU = [...MODULOS_TOPO, ...MODULOS_EMPRESA, MODULO_CONFIGURACOES];

/** O caminho do módulo no menu, ou `null` quando ele ainda não tem tela (fica "Em breve" no menu). */
export function telaDoModulo(modulo: Pick<ModuloDoManual, 'menu'>): string | null {
  return TODOS_DO_MENU.find((item) => item.id === modulo.menu)?.href ?? null;
}

export const manuaisPublicados = (): Manual[] => MODULOS_DOS_MANUAIS.flatMap((modulo) => (modulo.manual ? [modulo.manual] : []));

export const moduloDoManual = (slug: string) => MODULOS_DOS_MANUAIS.find((modulo) => modulo.slug === slug) ?? null;

export const manualPorSlug = (slug: string): Manual | null => moduloDoManual(slug)?.manual ?? null;
