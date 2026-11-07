import { chaveDaTabela, driver, lerTabela } from './armazenamento';
import { ID_MARCA_NUMA } from './exemplos/base';
import { controle } from './exemplos/controle';
import { marketingDeExemplo } from './exemplos/marketing';
import { NOMES_TABELAS_M08 } from './tabelas-m08';
import type { MarcaIdentidade } from './tipos/marketing';

export const ID_IDENTIDADE_NUMA = '9a8b7c6d-f001-4e5f-8a9b-0c1d2e3f0001';

/**
 * T08.04: "A marca Numa vem pré-preenchida com os tokens e a essência da apresentação". Os tokens são os de
 * 18 §2 e §11, que prevalecem sobre os de 02 §3. Não é exemplo: "Limpar exemplos" não mexe nela.
 */
export function identidadeNumaInicial(agora: string): MarcaIdentidade[] {
  return [
    {
      ...controle(ID_IDENTIDADE_NUMA, false, agora),
      marca_id: ID_MARCA_NUMA,
      proposta: 'Tecnologia que simplifica a vida.',
      publico: null,
      personalidade: 'Valores: simplicidade, confiança e tempo.',
      tom_faca: [],
      tom_nao_faca: [],
      frases: ['Tecnologia que simplifica a vida'],
      paleta: [
        { nome: 'Linho', hex: '#F8F6F2', uso: 'Fundo da aplicação' },
        { nome: 'Papel', hex: '#FFFDFA', uso: 'Superfícies: cartões, tabelas, painéis e campos em foco' },
        { nome: 'Névoa', hex: '#EFEAE3', uso: 'Áreas secundárias: menu lateral, colunas do quadro, cabeçalho de tabela' },
        { nome: 'Aveia', hex: '#E5DFD7', uso: 'Destaques suaves, faixas e trilho de barras de progresso' },
        { nome: 'Espresso', hex: '#2B2421', uso: 'Texto principal e fundo de elementos selecionados' },
        { nome: 'Cinza', hex: '#6B615A', uso: 'Texto secundário, rótulos e ícones neutros' },
        { nome: 'Índigo', hex: '#6366F1', uso: 'Cor de marca: ponto, foco, seleção e gráficos' },
        { nome: 'Índigo escuro', hex: '#4F52D9', uso: 'Fundo do botão primário, links e texto índigo' },
      ],
      tipografia: [
        { fonte: 'Bricolage Grotesque', pesos: '600, 650 e 700', uso: 'Logotipo, títulos de página, saudação, números de indicadores, títulos de cartões e diálogos' },
        { fonte: 'Instrument Sans', pesos: '400, 500, 600 e 700', uso: 'Todo o resto: texto, tabelas, campos, botões e menus' },
      ],
      manual_url: null,
    },
  ];
}

export const VALORES_INICIAIS_M08 = { marca_identidade: identidadeNumaInicial } as const;

/** Linhas iniciais das tabelas do M08: a identidade da Numa e os exemplos. */
export function tabelasIniciaisM08(agora: string) {
  return { ...marketingDeExemplo(agora), marca_identidade: identidadeNumaInicial(agora) };
}

function aindaHaExemplos(): boolean {
  try {
    return lerTabela<{ exemplo: boolean }>('pessoa').some((pessoa) => pessoa.exemplo);
  } catch {
    return false;
  }
}

/**
 * Só acrescenta tabelas que faltam: quem já usa a Central não perde nada, seja qual for o número da
 * versão. Quem já limpou os exemplos não recebe exemplos novos.
 */
export function acrescentarTabelasM08(alteracoes: Record<string, readonly unknown[]>, agora: string) {
  const exemplos = aindaHaExemplos() ? marketingDeExemplo(agora) : null;
  for (const tabela of NOMES_TABELAS_M08) {
    if (driver().getItem(chaveDaTabela(tabela)) !== null) continue;
    if (tabela === 'marca_identidade') alteracoes[tabela] = identidadeNumaInicial(agora);
    else alteracoes[tabela] = exemplos?.[tabela] ?? [];
  }
}
