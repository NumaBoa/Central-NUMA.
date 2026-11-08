// Verificação do M07 (T07.01 a T07.09) no sistema real: portfólio, fila, canais, ficha, ofertas, simulador,
// aprovação, estágio e indicadores, em 1440 e 360. O caso de referência é o de 09-M07 §4 e do LEIA-ME do M07.
import { ID_KIMBERLY, iniciar } from './apoio.mjs';

const h = await iniciar({ nome: 'm07', porta: 9377 });
const { c, ok, passo, ir, texto, preencher, escolher, erroDe, marcarPilula, clicarNoDialogo, painelAberto, painelFechado, pularAbertura, tabela, esperarAviso, conferirTela, terminar } = h;

const js = (v) => JSON.stringify(v);
const KIPI = 'c4e2a3f6-9d51-4c32-8e23-2b3c4d5e6f03';
const ZUPI = 'c4e2a3f6-9d51-4c32-8e23-2b3c4d5e6f04';
const ZARPA = 'c4e2a3f6-9d51-4c32-8e23-2b3c4d5e6f05';
const hoje = new Date();
const diaISO = (dias = 0) => new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + dias)).toISOString().slice(0, 10);
/** O texto da página com espaços comuns: o Intl usa espaço inseparável em "R$ 13,56". */
const pagina = () => c.avaliar(`document.querySelector('main').textContent.replace(/\\s+/g,' ')`);
const janela = () => c.avaliar(`(document.querySelector('.janela')?.textContent??'').replace(/\\s+/g,' ')`);
const botao = (rotulo, onde = 'main') => `[...document.querySelectorAll(${js(onde + ' button')})].find(b=>b.textContent.trim()===${js(rotulo)}||b.getAttribute('aria-label')===${js(rotulo)})`;
const clicarBotao = (rotulo, onde) => c.avaliar(`(()=>{const b=${botao(rotulo, onde)};if(!b)throw new Error('sem botão: '+${js(rotulo)});b.click()})()`);
const marcarCaixa = (rotulo, onde = 'main') => c.avaliar(`(()=>{const l=[...document.querySelectorAll(${js(onde + ' label')})].find(l=>l.textContent.trim().startsWith(${js(rotulo)}));if(!l)throw new Error('sem caixa: '+${js(rotulo)});l.querySelector('input').click()})()`);
const visao = async (rotulo) => {
  await c.avaliar(`[...document.querySelectorAll('main fieldset label')].find(l=>l.textContent.trim()===${js(rotulo)}).querySelector('input').click()`);
  await c.espera(150);
};
const contagem = () => c.avaliar(`document.querySelector('main [role=status]')?.textContent.trim()`);

await c.tamanho(1440, 900);
await ir('/produtos');
await pularAbertura();
await c.ate(`document.querySelector('main article')`);

await passo('T07.01: portfólio em cartões, com o que falta dito como falta', async () => {
  const cartoes = await c.avaliar(`[...document.querySelectorAll('main article h2')].map(h=>h.textContent)`);
  ok('5 produtos da carga, em cartões', js(cartoes) === js(['Sobrevivência Urbana', 'Kipi', 'Zupi', 'Zarpa', 'Mimo']), js(cartoes));
  const p = await pagina();
  ok('fila 1/2/3 e nome provisório', p.includes('Ideia · fila 1') && p.includes('Ideia · fila 3') && p.includes('Nome provisório'));
  ok('sem preço e sem dado não viram zero', p.includes('Nenhuma oferta') && p.includes('Definição pendente') && !p.includes('R$ 0,00'), p.slice(0, 200));
  ok('orçamento aponta para o Financeiro (T05.08) e legal segue indisponível', p.includes('Em Financeiro › Orçamento') && p.includes('chega com o M09'));
  ok('sem aviso de fase: tela construída fica liberada em qualquer fase (decisão de 07/11/2026)', !p.includes('ainda não está ativa'));
  ok('o menu leva a Produtos', await c.avaliar(`Boolean(document.querySelector('aside a[href="/produtos"]'))||document.querySelector('aside').textContent.includes('Produtos')`));
  await conferirTela('portfólio', 1440);
  await c.foto('a-portfolio-1440');
});

await passo('T07.01: filtros ficam ao trocar de visão; a fila diz a restrição', async () => {
  await escolher('filtro-estagio', 'em_uso');
  await c.espera(120);
  ok('filtro por estágio', (await contagem()) === '2 produtos', await contagem());
  ok('o filtro vira etiqueta, com Limpar filtros', (await pagina()).includes('Estágio: Em uso') && (await pagina()).includes('Limpar filtros'));
  await visao('Tabela');
  ok('na tabela, o mesmo filtro', (await c.avaliar(`document.querySelectorAll('main table tbody tr').length`)) === 2 && (await contagem()) === '2 produtos');
  await visao('Cartões');
  ok('de volta aos cartões, o mesmo filtro', (await c.avaliar(`document.querySelectorAll('main article h2').length`)) === 2);
  await c.clicar('texto=Limpar filtros');
  await c.espera(120);
  await visao('Fila');
  const p = await pagina();
  ok('a fila só tem Ideia e Validação, e diz isso', p.includes('A fila mostra só produtos em Ideia e Validação') && (await contagem()) === '3 produtos');
  ok('Subir e Descer em cada item, sem depender de arrastar', (await c.avaliar(`document.querySelectorAll('main button[aria-label^="Subir "],main button[aria-label^="Descer "]').length`)) === 6);
  ok('o primeiro não sobe; o último não desce', await c.avaliar(`document.querySelector('main button[aria-label="Subir Zupi"]').disabled&&document.querySelector('main button[aria-label="Descer Mimo"]').disabled`));
});

await passo('T07.01: reordenar a fila exige decisão', async () => {
  await clicarBotao('Descer Zupi');
  await c.ate(`document.querySelector('main').textContent.includes('Ainda não salvo')`);
  ok('a nova ordem fica pendente', (await c.avaliar(`[...document.querySelectorAll('main ol[aria-label="Fila de produtos"] li a')].map(a=>a.textContent)`)).join() === 'Zarpa,Zupi,Mimo');
  await clicarBotao('Salvar ordem e decisão');
  await c.ate(`document.getElementById('fila-decisao-titulo-erro')`);
  ok('sem decisão, não salva', (await erroDe('fila-decisao-titulo')).includes('título') && (await tabela('produto')).find((p) => p.id === ZUPI).ordem_fila === 1);
  await preencher('fila-decisao-titulo', 'Prioridades de novembro');
  await preencher('fila-decisao-descricao', 'Validar Zarpa antes do Zupi');
  await clicarBotao('Salvar ordem e decisão');
  await esperarAviso('Fila salva');
  const produtos = await tabela('produto');
  ok('a ordem foi gravada', produtos.find((p) => p.id === ZARPA).ordem_fila === 1 && produtos.find((p) => p.id === ZUPI).ordem_fila === 2);
  const decisoes = await tabela('decisao');
  ok('com a decisão, ligada a cada produto pelo id', decisoes.length === 1 && decisoes[0].assunto === 'fila' && (await tabela('vinculo')).filter((v) => v.origem_id === decisoes[0].id || v.destino_id === decisoes[0].id).length === 3);
});

await passo('T07.05: canal exige fonte e data quando há taxa', async () => {
  await ir('/produtos/canais');
  await c.ate(`document.querySelector('main h1')?.textContent==='Canais de venda'`);
  ok('vazio, com a próxima ação', (await pagina()).includes('Nenhum canal ainda'));
  await clicarBotao('Novo canal');
  await painelAberto();
  await c.espera(320);
  await preencher('canal-nome', 'Canal de teste');
  await preencher('canal-percentual', '15');
  await preencher('canal-fixa', '0,00');
  await clicarNoDialogo('Criar canal');
  await c.ate(`document.getElementById('canal-fonte-erro')`);
  ok('sem fonte e sem data, não salva', (await erroDe('canal-verificado')).includes('conferida') && (await erroDe('canal-fonte')).includes('veio'));
  await preencher('canal-verificado', diaISO(-10));
  await preencher('canal-fonte', 'https://exemplo.com.br/taxas');
  await clicarNoDialogo('Criar canal');
  await esperarAviso('Canal criado.');
  await painelFechado();
  const [canal] = await tabela('canal_venda');
  ok('taxa informada, com fonte e data', canal.taxa_percentual === 15 && canal.taxa_fixa === 0 && canal.fonte_url && canal.verificado_em === diaISO(-10));
  ok('aparece na lista', (await pagina()).includes('15% + R$ 0,00 por transação'));
});

let ofertaId;
await passo('T07.02 e T07.04: ficha, Mais áreas e nova oferta', async () => {
  await ir(`/produtos/${KIPI}`);
  await c.ate(`document.querySelector('main h1')?.textContent==='Kipi'`);
  const abas = await c.avaliar(`[...document.querySelectorAll('main [role=tab]')].map(a=>a.textContent)`);
  ok('cinco abas principais', js(abas) === js(['Visão geral', 'Estágio e decisões', 'Ofertas e preços', 'Simulações', 'Indicadores']), js(abas));
  ok('Clientes e Assinantes não aparecem na F0b', !(await pagina()).includes('Assinantes') && !(await pagina()).includes('Clientes'));
  ok('responsável a definir e preço não definido', (await pagina()).includes('Responsável:A definir') && (await pagina()).includes('Não definido'));
  await c.clicar('texto=Mais áreas');
  await c.ate(`document.querySelector('.menu-suspenso,.dialogo')`);
  await c.espera(250);
  await c.clicar('texto=Custos');
  await c.ate(`location.search.includes('aba=custos')`);
  ok('Custos vem do financeiro, e o orçamento leva ao Financeiro (T05.08)', (await pagina()).includes('Custo médio mensal') && (await pagina()).includes('Financeiro › Orçamento'));
  await c.clicar('texto=Mais ações');
  await c.ate(`document.querySelector('.menu-suspenso,.dialogo')`);
  await c.espera(250);
  await c.clicar('texto=Nova oferta');
  await painelAberto();
  await c.espera(320);
  await preencher('oferta-nome', 'Essencial');
  await clicarNoDialogo('Criar oferta');
  await esperarAviso('Em estudo e sem preço');
  await c.ate(`location.pathname.includes('/ofertas/')`);
  await c.ate(`document.querySelector('main h1')?.textContent==='Essencial'`);
  ofertaId = (await tabela('oferta'))[0].id;
  const p = await pagina();
  ok('a oferta nasce Em estudo e sem preço', p.includes('Em estudo') && p.includes('Sem preço definido') && p.includes('Não definido'));
  ok('o produto continua à vista', p.includes('Kipi · Ofertas'));
});

await passo('T07.06: caso de referência, faltas e bloqueio', async () => {
  await ir(`/produtos/simulador?produto=${KIPI}&oferta=${ofertaId}`);
  await c.ate(`document.getElementById('sim-cv')`);
  ok('horas vêm marcadas, sem valor-hora', await c.avaliar(`[...document.querySelectorAll('main label')].find(l=>l.textContent.includes('Incluir horas')).querySelector('input').checked`) && (await c.avaliar(`document.getElementById('sim-valor_hora').value`)) === '');
  ok('tudo o que falta, listado', (await pagina()).includes('Falta: custo variável, tributos, margem desejada, horas das fundadoras, valor-hora, canal de venda, preço de teste'), (await pagina()).match(/Falta:[^.]*/)?.[0]);
  await c.avaliar(`${botao('Alterar')}?.click()`);
  await c.ate(`document.getElementById('sim-cf')`);
  await preencher('sim-cf', '300');
  await preencher('sim-cf_justificativa', 'Caso de referência da especificação');
  await preencher('sim-cv', '2');
  await preencher('sim-tributos', '6');
  await preencher('sim-margem', '20');
  await preencher('sim-horas', '0');
  await preencher('sim-preco_teste', '15');
  await marcarCaixa('Canal de teste');
  await c.espera(150);
  ok('sem valor-hora, nada depende sai', (await pagina()).includes('Falta: valor-hora') && !(await pagina()).includes('13,56'));
  await preencher('sim-valor_hora', '50');
  await c.espera(150);
  const p = await pagina();
  ok('preço sugerido R$ 13,56', p.includes('Preço sugeridoR$ 13,56'));
  ok('piso R$ 10,13', p.includes('Piso (margem 0)R$ 10,13'));
  ok('contribuição R$ 9,85', p.includes('Contribuição por clienteR$ 9,85'));
  ok('equilíbrio em 31 clientes', p.includes('Ponto de equilíbrio31 clientes'));
  ok('resultado de R$ 192,50 com 50 clientes', p.includes('Resultado mensalR$ 192,50'));
  ok('acréscimo sobre custo separado da margem', p.includes('Acréscimo sobre o custo87,5%'));
  ok('os três volumes', p.includes('R$ 54,24') && p.includes('R$ 5,93') && p.includes('-R$ 201,50') && p.includes('R$ 1.670,00'));
  ok('premissas e aviso de estimativa junto do resultado', p.includes('Cenário: 50 clientes em Canal de teste') && p.includes('Estimativa — não é garantia de resultado'));
  ok('o gráfico é desenhado dos dados, com a linha zero', await c.avaliar(`Boolean(document.querySelector('main svg[role=img] polyline'))&&[...document.querySelectorAll('main svg[role=img] line')].some(l=>l.getAttribute('stroke-dasharray')==='4 3')`));
  await preencher('sim-margem', '80');
  await c.espera(150);
  ok('CA-07.03: 15% + 6% + 80% bloqueia', (await pagina()).includes('Taxas, tributos e margem somam 100% ou mais') && (await c.avaliar(`Boolean(document.querySelector('main [role=alert]'))`)));
  await preencher('sim-margem', '20');
  await c.espera(120);
  await conferirTela('simulador', 1440);
  await c.foto('b-simulador-1440');
});

await passo('T07.07 e T07.09: salvar não aprova; usar como base cria rascunho; aprovar pede tudo', async () => {
  ok('antes de salvar, não dá para usar como base', await c.avaliar(`${botao('Usar como base de preço')}.disabled`));
  await clicarBotao('Salvar simulação');
  await painelAberto();
  await c.espera(320);
  await clicarNoDialogo('Salvar simulação');
  await esperarAviso('Isso não aprova preço');
  await painelFechado();
  const [simulacao] = await tabela('simulacao');
  ok('o snapshot guarda premissas e resultados', simulacao.premissas.cf === 300 && simulacao.premissas.canais[0].taxa_percentual === 15 && simulacao.resultados.linhas.length === 3);
  ok('salvar não criou preço', (await tabela('preco_versao')).length === 0);
  const atividadesAntes = (await tabela('atividade')).length;
  await clicarBotao('Usar como base de preço');
  await c.ate(`location.pathname.includes('/ofertas/')&&document.querySelector('.janela')`);
  await c.espera(400);
  const [rascunho] = await tabela('preco_versao');
  ok('rascunho com o preço de teste', rascunho.situacao === 'rascunho' && rascunho.valor === 15 && rascunho.simulacao_id === simulacao.id);
  ok('a aprovação mostra o piso e quem aprova', (await janela()).includes('R$ 10,13') && (await janela()).includes('Acima do piso') && (await janela()).includes('Kimberly Grebe'));
  ok('avisa que não há autorização segura nesta etapa', (await janela()).includes('não é uma autorização segura'));
  await clicarNoDialogo('Aprovar preço');
  await c.ate(`document.querySelector('.janela [role=alert]')`);
  ok('sem início, decisão e conferência, não aprova', (await janela()).includes('Informe o início da validade') && (await janela()).includes('Informe o título da decisão') && (await tabela('preco_versao'))[0].situacao === 'rascunho');
  await preencher('aprovar-inicio', diaISO(0));
  await preencher('aprovar-decisao-titulo', 'Preço de lançamento');
  await preencher('aprovar-decisao-descricao', 'R$ 15 no canal de teste');
  await marcarCaixa('Conferi as premissas', '.janela');
  await c.espera(100);
  await clicarNoDialogo('Aprovar preço');
  await esperarAviso('Preço aprovado');
  await painelFechado();
  const [aprovada] = await tabela('preco_versao');
  ok('aprovada, com decisão, autora e snapshot', aprovada.situacao === 'aprovada' && aprovada.aprovado_por === ID_KIMBERLY && aprovada.decisao_id && aprovada.snapshot?.simulacao?.id === simulacao.id);
  ok('a oferta passa a Aprovada', (await tabela('oferta'))[0].situacao === 'aprovada' && (await pagina()).includes('Aprovada · vigente'));
  ok('aprovar não criou atividade no Meu dia', (await tabela('atividade')).length === atividadesAntes, `${atividadesAntes} → ${(await tabela('atividade')).length}`);
});

await passo('T07.09: abaixo do piso exige justificativa e decisão de exceção', async () => {
  await clicarBotao('Nova versão de preço');
  await painelAberto();
  await c.espera(320);
  await preencher('versao-valor', '9,00');
  await escolher(await c.avaliar(`[...document.querySelectorAll('.janela label')].find(l=>l.textContent.startsWith('Simulação')).htmlFor`), (await tabela('simulacao'))[0].id);
  await escolher(await c.avaliar(`[...document.querySelectorAll('.janela label')].find(l=>l.textContent.startsWith('Canal')).htmlFor`), (await tabela('canal_venda'))[0].id);
  await clicarNoDialogo('Criar rascunho');
  await esperarAviso('Rascunho criado');
  await painelFechado();
  await c.ate(`[...document.querySelectorAll('main button')].some(b=>b.textContent.trim()==='Aprovar')`);
  await clicarBotao('Aprovar');
  await painelAberto();
  await c.espera(400);
  ok('mostra que está abaixo do piso', (await janela()).includes('Abaixo do piso') && (await janela()).includes('Decisão de exceção'));
  await preencher('aprovar-inicio', diaISO(20));
  await preencher('aprovar-decisao-titulo', 'Exceção');
  await preencher('aprovar-decisao-descricao', 'Teste abaixo do piso');
  await marcarCaixa('Conferi as premissas', '.janela');
  await clicarNoDialogo('Aprovar preço');
  await c.ate(`document.getElementById('aprovar-justificativa-erro')`);
  ok('sem justificativa, não aprova', (await erroDe('aprovar-justificativa')).includes('justificativa'));
  await preencher('aprovar-justificativa', 'Preço de entrada por três meses');
  await clicarNoDialogo('Aprovar preço');
  await esperarAviso('A oferta passa a Aprovada em');
  await painelFechado();
  const precos = (await tabela('preco_versao')).sort((a, b) => a.versao - b.versao);
  const excecao = (await tabela('decisao')).find((d) => d.id === precos[1].decisao_id);
  ok('decisão específica de exceção', excecao?.assunto === 'excecao_preco' && precos[1].justificativa_excecao);
  ok('a anterior termina no dia anterior e continua vigente até lá', precos[0].situacao === 'substituida' && precos[0].valido_ate === diaISO(19) && (await pagina()).includes('Vigente até'));
  await conferirTela('oferta', 1440);
});

await passo('T07.03: descontinuar exige plano, que vira atividade real no Meu dia', async () => {
  await ir(`/produtos/${ZUPI}`);
  await c.ate(`document.querySelector('main h1')?.textContent==='Zupi'`);
  const antes = (await tabela('atividade')).length;
  await clicarBotao('Mudar estágio');
  await painelAberto();
  await c.espera(320);
  await escolher('estagio-novo', 'descontinuado');
  await c.espera(150);
  await preencher('estagio-criterio', 'Prioridade mudou');
  await clicarNoDialogo('Descontinuar produto');
  await c.ate(`document.querySelector('.janela [role=alert]')`);
  const j = await janela();
  ok('pede decisão, prazo do plano e a revisão', j.includes('Informe o título da decisão') && j.includes('Informe o prazo') && j.includes('Falta conferir'), j.slice(0, 300));
  ok('nada foi criado ainda', (await tabela('atividade')).length === antes && (await tabela('produto')).find((p) => p.id === ZUPI).estagio === 'ideia');
  await preencher('estagio-decisao-titulo', 'Pausar Zupi');
  await preencher('estagio-decisao-descricao', 'Encerrar a ideia');
  await preencher('estagio-plano-prazo', diaISO(30));
  for (const item of ['Ferramentas vinculadas', 'Ativos transferidos', 'Documentos legais', 'Comunicação aos usuários']) await c.avaliar(`[...document.querySelectorAll('.janela fieldset label')].find(l=>l.textContent.startsWith(${js(item)})).querySelector('input').click()`);
  await clicarNoDialogo('Descontinuar produto');
  await esperarAviso('descontinuado');
  await painelFechado();
  const [historico] = await tabela('produto_estagio_historico');
  const plano = (await tabela('atividade')).find((a) => a.id === historico.atividade_encerramento_id);
  ok('o plano é uma atividade do Meu dia, ligada ao produto', (await tabela('atividade')).length === antes + 1 && plano && (await tabela('atividade_produto')).some((l) => l.atividade_id === plano.id && l.produto_id === ZUPI));
  ok('o produto ficou descontinuado, fora da fila', (await tabela('produto')).find((p) => p.id === ZUPI).situacao === 'descontinuado' && (await tabela('produto')).find((p) => p.id === ZUPI).ordem_fila === null);
  await ir(`/produtos/${ZUPI}?aba=estagio`);
  await c.ate(`document.querySelector('main').textContent.includes('Plano de encerramento')`);
  ok('a linha do tempo mostra critério, decisão e plano', (await pagina()).includes('Ideia → Descontinuado') && (await pagina()).includes('Critério: Prioridade mudou'));
});

await passo('T07.08: um registro por mês', async () => {
  await ir(`/produtos/${KIPI}?aba=indicadores`);
  await c.ate(`document.querySelector('main').textContent.includes('Nenhum indicador registrado')`);
  for (const vez of [1, 2]) {
    await clicarBotao('Registrar indicadores');
    await painelAberto();
    await c.espera(350);
    await preencher('kpi-usuarios_ativos', vez === 1 ? '0' : '120');
    await clicarNoDialogo(vez === 1 ? 'Salvar' : 'Salvar alterações');
    await esperarAviso(vez === 1 ? 'registrados' : 'atualizados');
    await painelFechado();
    await c.espera(200);
  }
  const kpis = await tabela('kpi_mensal');
  ok('salvar o mesmo mês de novo altera, sem duplicar', kpis.length === 1 && kpis[0].valores.usuarios_ativos === 120);
  ok('gráfico e tabela a partir dos registros', await c.avaliar(`Boolean(document.querySelector('main svg[role=img]'))`) && (await pagina()).includes('Registros por mês'));
});

await passo('360px: sem rolagem lateral, tabelas em cartões', async () => {
  await c.tamanho(360, 780);
  for (const [rotulo, caminho, pronto] of [
    ['portfólio', '/produtos', `document.querySelector('main article')`],
    ['canais', '/produtos/canais', `document.querySelector('main ul li')`],
    ['ficha', `/produtos/${KIPI}`, `document.querySelector('main h1')`],
    ['oferta', `/produtos/${KIPI}/ofertas/${ofertaId}`, `document.querySelector('main h1')`],
    ['simulador', `/produtos/simulador?produto=${KIPI}`, `document.getElementById('sim-cv')`],
  ]) {
    await ir(caminho);
    await c.ate(pronto);
    await c.espera(300);
    await conferirTela(rotulo, 360);
    await c.foto(`c-${rotulo}-360`);
  }
  ok('simulador no celular: premissas e resultados um de cada vez', await c.avaliar(`[...document.querySelectorAll('main section')].some(s=>s.getAttribute('aria-label')==='Resultados da simulação'&&s.classList.contains('hidden'))`));
  await ir('/produtos?visao=fila');
  await c.ate(`document.querySelector('main ol')`);
  await conferirTela('fila', 360);
});

await terminar();
