import type { Manual } from '../tipos';

/**
 * Manual do M13 — Visão geral e relatórios. O módulo não tem tela no menu: por decisão de Kimberly em 07/11/2026,
 * os indicadores e os relatórios ficam nos módulos. Aqui estão a busca, o sino e onde achar cada relatório.
 */
export const MANUAL_RELATORIOS: Manual = {
  slug: 'relatorios',
  nome: 'Visão geral e relatórios',
  doModulo: 'de Visão geral e relatórios',
  aoModulo: 'ao Meu dia',
  arquivo: 'Manual-Visao-Geral-e-Relatorios-Numa',
  versao: '1.0',
  atualizadoEm: '2026-11-08',
  telaDoModulo: '/meu-dia',
  introducao:
    'Este manual reúne o que vale para a Central inteira: a busca, o sino de notificações, os manuais e onde achar cada relatório. Não há uma tela própria de visão geral: os indicadores ficam no módulo em que cada assunto é tratado. Cada assunto abaixo é um artigo curto.',
  assuntos: [
    { id: 'comecar', titulo: 'Primeiros passos' },
    { id: 'buscar', titulo: 'Busca e ajuda' },
    { id: 'avisos', titulo: 'Notificações' },
    { id: 'relatorios', titulo: 'Relatórios' },
    { id: 'duvidas', titulo: 'Dúvidas e limites' },
  ],
  artigos: [
    {
      id: 'para-que-serve',
      assunto: 'comecar',
      titulo: 'Onde ficam a visão geral e os indicadores',
      resumo: 'Cada indicador fica no módulo do assunto. A busca, o sino e "+ Novo" estão em todas as telas.',
      palavrasChave: ['visão geral', 'painel', 'dashboard', 'indicadores', 'kpi', 'onde fica', 'barra superior'],
      disponibilidade: { tipo: 'disponivel' },
      acao: { rotulo: 'Abrir o Meu dia', href: '/meu-dia' },
      blocos: [
        { tipo: 'paragrafo', texto: 'Por decisão de 07/11/2026, não há uma página única de visão geral. Os números ficam onde cada assunto é tratado: o dia no **Meu dia**, o dinheiro no **Financeiro**, a empresa no painel de **Empresa**, as vendas no **Comercial**, e assim por diante.' },
        {
          tipo: 'termos',
          titulo: 'Na barra superior, em todas as telas',
          itens: [
            { termo: 'Seletor de contexto', significado: 'Recorta as telas por produto, pela Numa institucional ou pela Numa consolidada.' },
            { termo: 'Buscar (Ctrl K)', significado: 'Registros e artigos de ajuda.' },
            { termo: '+ Novo', significado: 'Cria um registro de qualquer tela.' },
            { termo: 'Sino', significado: 'As notificações da pessoa escolhida em "Você é".' },
          ],
        },
      ],
    },
    {
      id: 'busca-global',
      assunto: 'buscar',
      titulo: 'Usar a busca: Registros e Como fazer',
      resumo: 'Ctrl+K busca registros por código, título ou nome, e artigos de ajuda pelo que você quer fazer.',
      palavrasChave: ['busca', 'buscar', 'procurar', 'ctrl k', 'achar registro', 'código', 'como fazer', 'pesquisar'],
      disponibilidade: { tipo: 'disponivel' },
      blocos: [
        {
          tipo: 'procedimento',
          objetivo: 'Achar um registro ou aprender a fazer algo.',
          antes: [],
          caminho: 'Barra superior › **Buscar…** (ou Ctrl+K). No celular, o ícone da lupa.',
          passos: ['Escreva ao menos 2 letras: um código, um nome, ou o que quer fazer ("adiar", "pagar conta").', 'Em **Registros**, os resultados por tipo; em **Como fazer**, os artigos dos manuais.', 'Use ↑ e ↓ para escolher e Enter para abrir. Esc fecha.'],
          resultado: 'O registro abre na tela dele; o artigo abre no manual do módulo.',
          cuidados: ['Código exato vem primeiro: Enter vai direto.', 'Até 5 registros por tipo e 6 artigos, dizendo quantos há.', '**Ir para essa ação** só abre a tela: nada é feito nem alterado.', 'A busca entende termos equivalentes: "dar baixa", "registrar pagamento" e "pagar conta" acham o mesmo artigo.'],
        },
      ],
    },
    {
      id: 'manuais',
      assunto: 'buscar',
      titulo: 'Os manuais e o "Como usar"',
      resumo: 'Um manual por módulo, com artigos curtos, aberto pelo botão "Como usar" e disponível em PDF.',
      palavrasChave: ['manual', 'ajuda', 'como usar', 'pdf', 'baixar manual', 'tutorial', 'documentação'],
      disponibilidade: { tipo: 'disponivel' },
      acao: { rotulo: 'Abrir os manuais', href: '/ajuda' },
      blocos: [
        {
          tipo: 'lista',
          itens: [
            'O botão **Como usar**, no cabeçalho das telas, abre o artigo do assunto da tela.',
            'Cada artigo diz se o recurso está **Disponível para usar**, **Disponível mediante condição** (e qual) ou **Ainda não implementado**.',
            'No manual, **Baixar manual em PDF** baixa o manual do módulo, com sumário e páginas numeradas.',
            'Os exemplos dos manuais são ilustrativos, com dados fictícios.',
          ],
        },
      ],
    },
    {
      id: 'sino',
      assunto: 'avisos',
      titulo: 'O sino de notificações',
      resumo: 'Alertas, menções, lembretes e avisos da rotina do dia, por pessoa.',
      palavrasChave: ['sino', 'notificação', 'aviso', 'menção', 'lembrete', 'marcar como lida', 'não lidas'],
      disponibilidade: { tipo: 'disponivel' },
      blocos: [
        {
          tipo: 'termos',
          itens: [
            { termo: 'Alerta', significado: 'Um alerta do Meu dia em que você é a responsável.' },
            { termo: 'Menção', significado: 'Alguém mencionou você num comentário.' },
            { termo: 'Lembrete', significado: 'Chegou o horário de um lembrete seu.' },
            { termo: 'Rotina do dia', significado: 'Uma rotina do dia não terminou.' },
          ],
        },
        {
          tipo: 'procedimento',
          objetivo: 'Ver e limpar as notificações.',
          antes: [],
          caminho: 'Barra superior › sino.',
          passos: ['Abra o sino: o número mostra as não lidas.', 'Clique numa notificação para abrir o registro, ou marque como lida.', 'Para limpar tudo, use **Marcar todas**.'],
          resultado: 'As notificações lidas deixam de contar no número do sino.',
          cuidados: ['As notificações são da pessoa escolhida em **Você é**.', 'Só chegam com a Central aberta neste navegador.'],
        },
      ],
    },
    {
      id: 'onde-esta-cada-relatorio',
      assunto: 'relatorios',
      titulo: 'Onde está cada relatório',
      resumo: 'Fluxo de caixa, custos, resultado, receitas, funil, contratos, SLA e horas: cada um no módulo do assunto.',
      palavrasChave: ['relatório', 'relatórios', 'exportar', 'csv', 'dre', 'fluxo de caixa', 'resultado', 'onde vejo'],
      disponibilidade: { tipo: 'disponivel' },
      acao: { rotulo: 'Abrir Fluxo de caixa', href: '/financeiro/fluxo' },
      blocos: [
        {
          tipo: 'termos',
          itens: [
            { termo: 'Fluxo de caixa', significado: '**Financeiro** › **Fluxo de caixa**: realizado e projetado, mês a mês, com CSV.' },
            { termo: 'Custos e resultado por produto, custos de ferramentas', significado: '**Financeiro** › **Resultado por produto**.' },
            { termo: 'Investimento das sócias', significado: '**Financeiro** › **Sócias**.' },
            { termo: 'Receita recorrente e assinantes', significado: '**Financeiro** › **Receita por canal**.' },
            { termo: 'Orçado × realizado', significado: '**Financeiro** › **Orçamento**.' },
            { termo: 'Funil', significado: '**Comercial**, com o relatório do funil.' },
            { termo: 'Contratos, renovações e reajustes', significado: '**Contratos**, **Renovação** e **Reajuste**.' },
            { termo: 'SLA, suporte, horas e estimado × realizado', significado: '**Operação**.' },
            { termo: 'Indicadores dos produtos', significado: 'Na ficha de cada produto, em Indicadores.' },
          ],
        },
        { tipo: 'paragrafo', texto: 'As listas longas têm **Exportar** (CSV pronto para o Excel), com as colunas visíveis e as linhas filtradas.' },
      ],
    },
    {
      id: 'perguntas-frequentes',
      assunto: 'duvidas',
      titulo: 'Perguntas frequentes',
      resumo: 'Respostas curtas sobre busca, sino e relatórios.',
      palavrasChave: ['dúvidas', 'faq', 'perguntas'],
      disponibilidade: { tipo: 'disponivel' },
      blocos: [
        {
          tipo: 'perguntas',
          itens: [
            { pergunta: 'A busca não achou um registro. Por quê?', resposta: 'Ela procura em código, título, nome e alguns campos de cada tipo. Registros arquivados não aparecem.' },
            { pergunta: 'O sino de outra pessoa aparece para mim?', resposta: 'Não. O sino mostra as notificações de quem está em **Você é**.' },
            { pergunta: 'A ajuda usa inteligência artificial?', resposta: 'Não. Os artigos são escritos e revisados; a busca só procura neles.' },
          ],
        },
      ],
    },
    {
      id: 'limitacoes',
      assunto: 'duvidas',
      titulo: 'O que ainda não está disponível',
      resumo: 'Alguns indicadores ainda sem registro próprio, e notificações com a Central fechada.',
      palavrasChave: ['limitações', 'não tem', 'futuro', 'taxa de cancelamento', 'tempo por etapa'],
      disponibilidade: { tipo: 'futuro', quando: 'Fases seguintes e etapa com servidor' },
      blocos: [
        {
          tipo: 'termos',
          itens: [
            { termo: 'Taxa de cancelamento e receita média por assinante', significado: 'Ainda sem relatório próprio.' },
            { termo: 'Tempo por etapa do funil', significado: 'Ainda sem relatório próprio.' },
            { termo: 'Relatório único de vencimentos de contratos e obrigações', significado: 'Hoje cada um fica no próprio módulo.' },
            { termo: 'Notificações com a Central fechada', significado: 'Chegam com o servidor.' },
          ],
        },
      ],
    },
  ],
};
