import { MODULO_CONFIGURACOES, MODULOS_EMPRESA, MODULOS_TOPO, type IconeModulo } from '@/dominio/navegacao';
import { MANUAL_ACESSO } from './manuais/acesso';
import { MANUAL_CADASTROS } from './manuais/cadastros';
import { MANUAL_COMERCIAL } from './manuais/comercial';
import { MANUAL_CONTRATOS } from './manuais/contratos';
import { MANUAL_EMPRESA } from './manuais/empresa';
import { MANUAL_FERRAMENTAS } from './manuais/ferramentas';
import { MANUAL_FINANCEIRO } from './manuais/financeiro';
import { MANUAL_LEGAL } from './manuais/legal';
import { MANUAL_MARKETING } from './manuais/marketing';
import { MANUAL_MEU_DIA } from './manuais/meu-dia';
import { MANUAL_OPERACAO } from './manuais/operacao';
import { MANUAL_PRODUTOS } from './manuais/produtos';
import { MANUAL_RELATORIOS } from './manuais/relatorios';
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
  { codigo: 'M01', nome: 'Acesso e auditoria', slug: 'acesso', menu: 'configuracoes', manual: MANUAL_ACESSO },
  { codigo: 'M02', nome: 'Cadastros e configurações', slug: 'cadastros', menu: 'configuracoes', manual: MANUAL_CADASTROS },
  { codigo: 'M03', nome: 'Meu dia', slug: 'meu-dia', menu: 'meu-dia', manual: MANUAL_MEU_DIA },
  { codigo: 'M04', nome: 'Ferramentas e ativos', slug: 'ferramentas', menu: 'ferramentas', manual: MANUAL_FERRAMENTAS },
  { codigo: 'M05', nome: 'Financeiro', slug: 'financeiro', menu: 'financeiro', manual: MANUAL_FINANCEIRO },
  { codigo: 'M06', nome: 'Sociedade e empresa', slug: 'empresa', menu: 'empresa', manual: MANUAL_EMPRESA },
  { codigo: 'M07', nome: 'Produtos e precificação', slug: 'produtos', menu: 'produtos', manual: MANUAL_PRODUTOS },
  { codigo: 'M08', nome: 'Biblioteca e marketing', slug: 'marketing', menu: 'marca', manual: MANUAL_MARKETING },
  { codigo: 'M09', nome: 'Legal e privacidade', slug: 'legal', menu: 'legal', manual: MANUAL_LEGAL },
  { codigo: 'M10', nome: 'Comercial', slug: 'comercial', menu: 'comercial', manual: MANUAL_COMERCIAL },
  { codigo: 'M11', nome: 'Contratos', slug: 'contratos', menu: 'contratos', manual: MANUAL_CONTRATOS },
  { codigo: 'M12', nome: 'Operação', slug: 'operacao', menu: 'operacao', manual: MANUAL_OPERACAO },
  { codigo: 'M13', nome: 'Visão geral e relatórios', slug: 'relatorios', menu: null, manual: MANUAL_RELATORIOS },
];

const TODOS_DO_MENU = [...MODULOS_TOPO, ...MODULOS_EMPRESA, MODULO_CONFIGURACOES];

/** O caminho do módulo no menu, ou `null` quando ele ainda não tem tela (fica "Em breve" no menu). */
export function telaDoModulo(modulo: Pick<ModuloDoManual, 'menu'>): string | null {
  return TODOS_DO_MENU.find((item) => item.id === modulo.menu)?.href ?? null;
}

export const manuaisPublicados = (): Manual[] => MODULOS_DOS_MANUAIS.flatMap((modulo) => (modulo.manual ? [modulo.manual] : []));

export const moduloDoManual = (slug: string) => MODULOS_DOS_MANUAIS.find((modulo) => modulo.slug === slug) ?? null;

export const manualPorSlug = (slug: string): Manual | null => moduloDoManual(slug)?.manual ?? null;
