import { FASES, type Fase } from './navegacao';

export type InfoFase = {
  /** Como a fase é chamada na tela: "0a", "1". */
  codigo: string;
  nome: string;
  /** A pergunta que a fase responde (01 §3). */
  pergunta: string;
  telas: readonly string[];
};

/** Fases da Numa (01 §3), com o resumo de telas aprovado na T02.01. */
export const INFO_FASES: Record<Fase, InfoFase> = {
  f0a: {
    codigo: '0a',
    nome: 'Uso imediato',
    pergunta: 'O que temos, quanto custa e o que precisamos fazer?',
    telas: ['Meu dia, cadastros base, busca e alertas', 'Ferramentas e ativos digitais', 'Financeiro: lançamentos, baixas, sócias, contas e saldos'],
  },
  f0b: {
    codigo: '0b',
    nome: 'Casa em ordem',
    pergunta: 'Somos sócias de quê, nossos apps estão regulares, quanto vamos cobrar?',
    telas: [
      'Empresa: painel, sócias, acordos, ativos a transferir, marcas, constituição, reuniões e decisões',
      'Produtos: portfólio, ofertas, canais, simulador e KPIs',
      'Financeiro: orçamento e custos por produto',
      'Marca: biblioteca, identidade e apresentações',
      'Legal: documentos, inventário de dados e fila de validação',
    ],
  },
  f1: {
    codigo: '1',
    nome: 'Empresa e primeira venda',
    pergunta: 'Como vendemos, contratamos, cobramos e fechamos o mês?',
    telas: [
      'Comercial: funil, oportunidades e propostas',
      'Contratos e adesão padrão',
      'Financeiro: receber, fechamento, contador e receita por canal',
      'Legal: cláusulas, modelos, solicitações e incidentes',
      'Visão geral, relatórios e obrigações corporativas',
      'Horas, calendário editorial e listas de espera',
    ],
  },
  f2: {
    codigo: '2',
    nome: 'Ecossistema e produtividade',
    pergunta: 'Como operamos clientes, parceiros e equipe?',
    telas: ['Operação: implantações, suporte, incidentes e notas de liberação', 'Repasses, reajustes e aditivos com comparação', 'Campanhas e apresentações geradas', 'Gestão de acessos às ferramentas'],
  },
  f3: {
    codigo: '3',
    nome: 'Integrações',
    pergunta: 'O que pode ser automatizado?',
    telas: ['Assinatura eletrônica e NFS-e', 'Importação de lojas e gateways, conciliação bancária', 'Google Drive e indicadores enviados pelos apps'],
  },
};

export function rotuloDaFase(fase: Fase): string {
  return `Fase ${INFO_FASES[fase].codigo}`;
}

export function proximaFase(fase: Fase): Fase | null {
  return FASES[FASES.indexOf(fase) + 1] ?? null;
}

export function faseAnterior(fase: Fase): Fase | null {
  return FASES[FASES.indexOf(fase) - 1] ?? null;
}

export function avancouDeFase(de: Fase, para: Fase): boolean {
  return FASES.indexOf(para) > FASES.indexOf(de);
}
