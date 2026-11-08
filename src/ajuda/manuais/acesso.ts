import type { Manual } from '../tipos';

/**
 * Manual do M01 — Acesso e auditoria. Nesta etapa local não há login nem permissões (D26–D29): o manual explica o
 * que existe ("Você é", históricos e o cuidado com senhas) e identifica o resto como planejado, sem oferecer ação.
 */
export const MANUAL_ACESSO: Manual = {
  slug: 'acesso',
  nome: 'Acesso e auditoria',
  doModulo: 'de Acesso e auditoria',
  aoModulo: 'às Configurações',
  arquivo: 'Manual-Acesso-e-Auditoria-Numa',
  versao: '1.0',
  atualizadoEm: '2026-11-08',
  telaDoModulo: '/configuracoes',
  introducao:
    'Quem está usando a Central e o que cada pessoa fez. Nesta etapa, a Central roda neste computador, sem login e sem permissões: quem usa escolhe o próprio nome em "Você é", e cada mudança fica no histórico. Login, convites e permissões ficaram fora do que será construído agora (decisão de 07/11/2026) e seguem na especificação.',
  assuntos: [
    { id: 'quem', titulo: 'Quem está usando' },
    { id: 'historico', titulo: 'Histórico e auditoria' },
    { id: 'cuidados', titulo: 'Cuidados e segurança' },
    { id: 'duvidas', titulo: 'Dúvidas e limites' },
  ],
  artigos: [
    {
      id: 'voce-e',
      assunto: 'quem',
      titulo: '"Você é": escolher quem está usando',
      resumo: 'O seletor que diz quem está usando a Central, para autoria, histórico e o filtro "Minhas".',
      palavrasChave: ['você é', 'trocar de pessoa', 'usuário', 'quem sou eu', 'entrar', 'login', 'perfil'],
      disponibilidade: { tipo: 'disponivel' },
      blocos: [
        { tipo: 'paragrafo', texto: 'A Central ainda não pede senha. Quem está usando escolhe o próprio nome no seletor **Você é**.' },
        {
          tipo: 'procedimento',
          objetivo: 'Dizer à Central quem está usando agora.',
          antes: ['A pessoa precisa estar cadastrada em **Configurações** › **Pessoas**, com o tipo **Interna** e ativa.'],
          caminho: 'No computador, rodapé do menu lateral › **Você é**. No celular, **Mais** › **Você é**.',
          passos: ['Abra o seletor **Você é**.', 'Escolha o seu nome.'],
          resultado: 'A saudação do Meu dia muda, o filtro **Minhas** passa a mostrar as suas atividades, e o que você fizer entra no histórico com o seu nome.',
          cuidados: ['A escolha vale para este navegador.', 'Só pessoas internas e ativas aparecem no seletor.'],
        },
        {
          tipo: 'termos',
          titulo: 'O que depende de "Você é"',
          itens: [
            { termo: 'Autoria', significado: 'Quem criou, alterou, concluiu ou comentou cada registro.' },
            { termo: 'Histórico', significado: 'O nome que aparece em cada linha do histórico.' },
            { termo: 'Filtro Minhas', significado: 'No Meu dia, mostra o que é seu.' },
            { termo: 'Sino', significado: 'As notificações da pessoa escolhida.' },
          ],
        },
        { tipo: 'atencao', texto: '**Você é** não é proteção: qualquer pessoa com acesso a este computador pode trocar o nome. O login com senha está previsto para a etapa com servidor.' },
      ],
    },
    {
      id: 'historico-registro',
      assunto: 'historico',
      titulo: 'Ver o histórico de um registro',
      resumo: 'Cada ficha guarda o que mudou, por quem e quando, por extenso.',
      palavrasChave: ['histórico', 'quem alterou', 'auditoria', 'alterações', 'log', 'rastrear', 'quem mudou'],
      disponibilidade: { tipo: 'disponivel' },
      blocos: [
        { tipo: 'paragrafo', texto: 'Fichas de pessoas, atividades, ferramentas, ativos, títulos, contratos, documentos e outros registros têm a aba **Histórico**. Cada linha diz o que mudou, quem mudou e quando.' },
        {
          tipo: 'procedimento',
          objetivo: 'Descobrir quem mudou um registro e quando.',
          antes: [],
          caminho: 'Abra a ficha do registro › aba **Histórico**.',
          passos: ['Abra a aba **Histórico**.', 'Se quiser, filtre por campo (**Todos os campos**) ou por pessoa (**Todas as pessoas**).'],
          resultado: 'A lista mostra as mudanças, da mais recente para a mais antiga.',
          cuidados: ['Os filtros só aparecem quando há mais de um campo ou mais de uma pessoa para escolher.'],
        },
        { tipo: 'exemplo', texto: 'Um registro fictício "Assinatura do editor de imagens" mostra no histórico: "Kimberly Grebe alterou o vencimento de 10/11 para 15/11", com a data e a hora.' },
      ],
    },
    {
      id: 'historico-geral',
      assunto: 'historico',
      titulo: 'As últimas ações da Central',
      resumo: 'Em Configurações › Dados, a seção Histórico mostra as últimas ações de todos os módulos.',
      palavrasChave: ['últimas ações', 'histórico geral', 'auditoria geral', 'o que aconteceu', 'atividade recente'],
      disponibilidade: { tipo: 'disponivel' },
      acao: { rotulo: 'Abrir Dados', href: '/configuracoes/dados' },
      blocos: [
        { tipo: 'paragrafo', texto: 'A seção **Histórico**, em **Configurações** › **Dados**, reúne as últimas ações: quem fez o quê, e quando, em qualquer módulo.' },
        { tipo: 'atencao', texto: 'Nesta etapa local, **Restaurar exemplos** apaga também o histórico. Na etapa com servidor, ninguém altera nem exclui a auditoria.' },
      ],
    },
    {
      id: 'senhas',
      assunto: 'cuidados',
      titulo: 'Senhas e segredos não ficam na Central',
      resumo: 'Se um texto parecer senha ou token, a Central pergunta antes de salvar.',
      palavrasChave: ['senha', 'token', 'segredo', 'credencial', 'chave de acesso', 'login de ferramenta', 'cofre'],
      disponibilidade: { tipo: 'disponivel' },
      blocos: [
        { tipo: 'paragrafo', texto: 'A Central não guarda segredos. Em títulos, descrições, observações e outros textos livres, ela confere se o texto parece uma senha, um token ou uma chave de acesso. Se parecer, avisa e pergunta antes de salvar.' },
        { tipo: 'atencao', texto: 'Guarde senhas num gerenciador de senhas. Na Central, registre só onde o acesso está guardado, nunca a senha.' },
      ],
    },
    {
      id: 'onde-ficam-os-dados',
      assunto: 'cuidados',
      titulo: 'Onde ficam os dados nesta etapa',
      resumo: 'Neste navegador, neste computador. Quem usa o computador vê tudo.',
      palavrasChave: ['segurança', 'privacidade', 'quem vê', 'navegador', 'dados locais', 'perder dados'],
      disponibilidade: { tipo: 'disponivel' },
      acao: { rotulo: 'Abrir Dados', href: '/configuracoes/dados' },
      blocos: [
        {
          tipo: 'lista',
          itens: ['Os dados ficam só neste navegador. Celular e computador têm dados separados.', 'Quem usa este computador vê tudo o que está na Central.', 'Limpar os dados do navegador apaga a Central: exporte um backup toda semana.'],
        },
        { tipo: 'paragrafo', texto: 'O artigo "Fazer o backup: exportar tudo", no manual de Cadastros e configurações, explica como guardar a cópia.' },
      ],
    },
    {
      id: 'perguntas-frequentes',
      assunto: 'duvidas',
      titulo: 'Perguntas frequentes',
      resumo: 'Respostas curtas sobre acesso, autoria e histórico.',
      palavrasChave: ['dúvidas', 'faq', 'perguntas'],
      disponibilidade: { tipo: 'disponivel' },
      blocos: [
        {
          tipo: 'perguntas',
          itens: [
            { pergunta: 'Esqueci a senha. Como recupero?', resposta: 'Ainda não há senha. Basta escolher o seu nome em **Você é**.' },
            { pergunta: 'Fiz uma mudança com o nome errado em "Você é". Dá para corrigir o autor?', resposta: 'Não. O histórico não é editado. Troque o nome em **Você é** e, se precisar, registre um comentário explicando.' },
            { pergunta: 'Como convido uma nova pessoa?', resposta: 'Ainda não há convites. Cadastre a pessoa em **Configurações** › **Pessoas**, com o tipo **Interna**: ela passa a aparecer em **Você é**.' },
          ],
        },
      ],
    },
    {
      id: 'limitacoes',
      assunto: 'duvidas',
      titulo: 'O que ainda não está disponível',
      resumo: 'Login, verificação em duas etapas, convites, recuperação de senha, papéis e permissões e a auditoria completa.',
      palavrasChave: ['login', 'senha', 'permissões', 'papéis', 'convite', 'duas etapas', '2fa', 'minha conta', 'usuários', 'auditoria'],
      disponibilidade: { tipo: 'futuro', quando: 'etapa com servidor, sem data (por decisão de 07/11/2026, fica fora do que será construído agora)' },
      blocos: [
        {
          tipo: 'termos',
          itens: [
            { termo: 'Entrar com e-mail e senha', significado: 'Hoje, só o seletor **Você é**.' },
            { termo: 'Verificação em duas etapas', significado: 'Prevista junto com o login.' },
            { termo: 'Convites e recuperação de senha', significado: 'Previstos junto com o login.' },
            { termo: 'Minha conta', significado: 'Dados pessoais e preferências de acesso de cada usuária.' },
            { termo: 'Usuários, papéis e permissões', significado: 'Hoje todas veem e fazem tudo.' },
            { termo: 'Tela de auditoria completa', significado: 'Hoje há o histórico de cada registro e as últimas ações, em **Configurações** › **Dados**.' },
          ],
        },
      ],
    },
  ],
};
