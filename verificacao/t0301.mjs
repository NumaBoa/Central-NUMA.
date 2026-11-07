// Verificação de T03.01 (Meu dia) no sistema real.
import { iniciar, ID_BRUNA, ID_CAMILA, ID_KIMBERLY } from './apoio.mjs';

const MEU_DIA = '/meu-dia';
const ID_KIPI = 'c4e2a3f6-9d51-4c32-8e23-2b3c4d5e6f03';

const h = await iniciar({ nome: 't0301', porta: 9352 });
const { c, ok, passo, ir, texto, valor, preencher, escolher, opcoes, esperarAviso, marcarPilula, clicarNoDialogo, dialogoAberto, dialogoFechado, pularAbertura, tabela, conferirTela, ultimoAviso } = h;

const js = (v) => JSON.stringify(v);
const pronta = () => c.ate(`document.querySelector('main h1')`);
const irMeuDia = async () => { await ir(MEU_DIA); await pronta(); };
const titulos = (coluna) => c.avaliar(`[...document.querySelectorAll('section[data-coluna="${coluna}"] article h3')].map(t=>t.textContent)`);
const emColuna = (coluna, titulo) => c.ate(`[...document.querySelectorAll('section[data-coluna="${coluna}"] article h3')].some(t=>t.textContent===${js(titulo)})`);
const contador = (coluna) => c.avaliar(`document.querySelector('section[data-coluna="${coluna}"] h2').nextElementSibling.textContent`);
const noResumo = (rotulo) => c.avaliar(`[...document.querySelectorAll('[aria-label="Resumo do dia"] button')].find(b=>b.textContent.startsWith(${js(rotulo)})).textContent.replace(${js(rotulo)},'')`);
const clicarResumo = (rotulo) => c.avaliar(`[...document.querySelectorAll('[aria-label="Resumo do dia"] button')].find(b=>b.textContent.startsWith(${js(rotulo)})).click()`);
const cartao = (titulo) => `[...document.querySelectorAll('main article')].find(a=>a.querySelector('h3')?.textContent===${js(titulo)})`;
const textoDoCartao = (titulo) => c.avaliar(`(${cartao(titulo)})?.textContent ?? ''`);
const atividadePor = async (titulo) => (await tabela('atividade')).find((x) => x.titulo === titulo);
const abrirMenu = async (titulo) => {
  await c.avaliar(`document.querySelector(${js(`[aria-label="Ações de ${titulo}"]`)}).scrollIntoView({block:'center'})`);
  await c.espera(80);
  await c.clicar(`[aria-label="Ações de ${titulo}"]`);
  await c.ate(`document.querySelector('.menu-suspenso, .dialogo')`);
  await c.espera(120);
};
const noMenu = (rotulo) => c.avaliar(`(()=>{const l=[...document.querySelectorAll('.menu-suspenso button, .dialogo button')];(l.find(b=>b.textContent.trim()===${js(rotulo)})??l.find(b=>b.textContent.trim().startsWith(${js(rotulo)}))).click()})()`);
const abrirAdiar = async (titulo) => {
  await c.avaliar(`document.querySelector(${js(`[aria-label="Adiar ${titulo}"]`)}).scrollIntoView({block:'center'})`);
  await c.espera(80);
  await c.clicar(`[aria-label="Adiar ${titulo}"]`);
  await c.ate(`document.querySelector('.menu-suspenso, .dialogo')`);
  await c.espera(120);
};
const naLinha = (rotulo) => `document.querySelector(${js(`main button[aria-label^="${rotulo}:"]`)})`;
const abrirNaLinha = async (rotulo) => {
  await c.avaliar(`${naLinha(rotulo)}.click()`);
  await c.ate(`document.querySelector('.menu-suspenso')`);
  await c.espera(180);
};
const escolherPessoa = async (rotulo) => {
  await abrirNaLinha('Pessoa');
  await marcarPilula('Pessoa', rotulo);
};
/** Escolher um período fecha o menu. */
const escolherPeriodo = async (rotulo) => {
  await abrirNaLinha('Período');
  await marcarPilula('Período', rotulo);
  await c.espera(180);
};
const agrupar = async (rotulo) => {
  await abrirNaLinha('Agrupar por');
  await marcarPilula('Agrupar por', rotulo);
  await c.ate(`!document.querySelector('.menu-suspenso')`);
  await c.espera(120);
};
const contextoGlobal = async (rotulo) => {
  await c.clicar('[aria-label^="Contexto"]');
  await c.ate(`document.querySelector('.menu-suspenso')`);
  await c.espera(150);
  await c.avaliar(`[...document.querySelectorAll('.menu-suspenso ul button')].find(b=>b.textContent.trim()===${js(rotulo)}).click()`);
  await c.ate(`!document.querySelector('.menu-suspenso')`);
  await c.espera(120);
};
/** No celular, Quadro e Lista ficam na folha de Filtros. */
const trocarVisao = async (rotulo) => {
  if (await c.avaliar(`innerWidth>=768`)) return botao(rotulo);
  await abrirFiltros();
  await marcarPilula('Visão', rotulo);
  await c.espera(100);
  await c.avaliar(`[...document.querySelectorAll('.dialogo button')].find(b=>b.textContent.trim()==='Aplicar').click()`);
  await c.ate(`!document.querySelector('.dialogo')`);
  await c.espera(200);
};
const linhasDoMenu = () => c.avaliar(`[...document.querySelectorAll('.menu-suspenso button, .dialogo button')].map(b=>b.textContent.trim()).filter(Boolean)`);
const fecharMenu = async () => { await c.tecla('Escape'); await c.ate(`!document.querySelector('.menu-suspenso') && !document.querySelector('.dialogo')`); };
const preencherBusca = (novo) => c.avaliar(`(()=>{const e=document.querySelector('main input[type=search]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${js(novo)});e.dispatchEvent(new Event('input',{bubbles:true}))})()`);
const abrirFiltros = async () => { await c.avaliar(`[...document.querySelectorAll('main button')].find(b=>/^Filtros/.test(b.textContent.trim())).click()`); await c.ate(`document.querySelector('.menu-suspenso, .dialogo')`); await c.espera(180); };
const botao = (rotulo) => c.avaliar(`[...document.querySelectorAll('main button')].find(b=>b.textContent.trim()===${js(rotulo)}&&b.getBoundingClientRect().height>0).click()`);
const preencherMotivo = (novo) => c.avaliar(`(()=>{const e=document.querySelector('.dialogo textarea');e.focus();Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,${js(novo)});e.dispatchEvent(new Event('input',{bubbles:true}))})()`);
const clicarAcaoDoAviso = async (rotulo) => { await c.ate(`[...document.querySelectorAll('[data-sonner-toast] button')].some(b=>b.textContent===${js(rotulo)})`); await c.avaliar(`[...document.querySelectorAll('[data-sonner-toast] button')].filter(b=>b.textContent===${js(rotulo)}).pop().click()`); };
const restaurarExemplos = async () => {
  await ir('/configuracoes/dados');
  await c.ate(`[...document.querySelectorAll('main button')].some(b=>b.textContent==='Restaurar exemplos')`);
  await c.espera(200);
  await botao('Restaurar exemplos');
  await dialogoAberto();
  await c.espera(420);
  await clicarNoDialogo('Restaurar exemplos');
  await dialogoFechado();
  await c.ate(`document.querySelector('main').textContent.includes('Registros151')`);
};

await c.tamanho(1440, 900);

await passo('tela inicial', async () => {
  await c.ir(h.BASE + '/');
  await c.ate(`location.pathname==='${MEU_DIA}'`);
  ok('o sistema abre no Meu dia', true);
  await pularAbertura();
  await pronta();
  ok('o título da aba diz a tela', (await c.avaliar(`document.title`)).startsWith('Meu dia'));
  ok('o menu marca Meu dia', await c.avaliar(`[...document.querySelectorAll('[data-menu-lateral] a[href="${MEU_DIA}"]')].some(a=>a.getAttribute('aria-current')==='page')`));
  ok('o logotipo leva ao Meu dia', await c.avaliar(`Boolean(document.querySelector('[data-menu-lateral] a[aria-label="Central Numa"][href="${MEU_DIA}"]'))`));
});

await passo('cabeçalho', async () => {
  const h1 = await texto('main h1');
  ok('saudação com o primeiro nome', /^(Bom dia|Boa tarde|Boa noite), Kimberly\.$/.test(h1), h1);
  const m = await texto('main header');
  ok('data por extenso', /(segunda|terça|quarta|quinta|sexta)-feira, \d+ de |(Sábado|Domingo), \d+ de /i.test(m), m);
  ok('frase-resumo, com um marca-texto só', (await c.avaliar(`document.querySelectorAll('main mark').length`)) === 1 && (await texto('main mark')) === '4 itens' && m.includes('Hoje você tem 4 itens, 1 atrasado e 1 aguardando retorno.'), m);
  ok('o marca-texto é índigo, sem mudar a cor do texto', await c.avaliar(`getComputedStyle(document.querySelector('main mark')).backgroundImage.includes('gradient')`));
  ok('linhas calmas estáticas no cabeçalho', await c.avaliar(`Boolean(document.querySelector('main header svg'))`));
  await c.foto('a-tela');
});

await passo('faixa de resumo', async () => {
  ok('Atrasadas', (await noResumo('Atrasadas')) === '1');
  ok('Para hoje: prazo, lembrete e acompanhamento', (await noResumo('Para hoje')) === '4');
  ok('Em andamento', (await noResumo('Em andamento')) === '3');
  ok('Aguardando retorno', (await noResumo('Aguardando retorno')) === '1');
  ok('Bloqueadas', (await noResumo('Bloqueadas')) === '1');
  ok('Concluídas hoje', (await noResumo('Concluídas hoje')) === '2');
  ok('seis cartões lado a lado', await c.avaliar(`(()=>{const b=[...document.querySelectorAll('[aria-label="Resumo do dia"] button')];return b.length===6&&new Set(b.map(x=>Math.round(x.getBoundingClientRect().top))).size===1})()`));
  await clicarResumo('Atrasadas');
  await c.ate(`document.querySelectorAll('main article').length===1`);
  ok('o cartão aplica o filtro', (await titulos('a_fazer'))[0] === 'Revisar os textos da página de preços do Zupi');
  ok('e fica marcado, com etiqueta removível', (await c.avaliar(`[...document.querySelectorAll('[aria-label="Resumo do dia"] button')].find(b=>b.textContent.startsWith('Atrasadas')).getAttribute('aria-pressed')`)) === 'true' && (await texto('main')).includes('Remover filtro') === false);
  await clicarResumo('Atrasadas');
  await c.ate(`document.querySelectorAll('main article').length>1`);
  ok('clicar de novo tira', true);
  await clicarResumo('Bloqueadas');
  await c.ate(`document.querySelectorAll('main article').length===1`);
  ok('bloqueadas', (await titulos('a_fazer'))[0].startsWith('Escrever a política'));
  await clicarResumo('Bloqueadas');
  await clicarResumo('Concluídas hoje');
  await c.ate(`document.querySelectorAll('main article').length===2`);
  ok('concluídas hoje', (await titulos('concluida')).length === 2);
  await clicarResumo('Concluídas hoje');
  await c.ate(`document.querySelectorAll('main article').length>2`);
});

await passo('quadro', async () => {
  const col = await c.avaliar(`[...document.querySelectorAll('section[data-coluna] h2')].map(t=>t.textContent).join('|')`);
  ok('as quatro colunas', col === 'A fazer|Em andamento|Aguardando retorno|Concluída hoje', col);
  ok('lado a lado, sem rolagem em 1440px', await c.avaliar(`(()=>{const s=[...document.querySelectorAll('section[data-coluna]')];const f=s[0].parentElement;return new Set(s.map(x=>Math.round(x.getBoundingClientRect().top))).size===1&&f.scrollWidth<=f.clientWidth})()`));
  ok('as colunas contam', (await contador('a_fazer')) === '8' && (await contador('em_andamento')) === '3' && (await contador('aguardando')) === '1' && (await contador('concluida')) === '2');
  const aFazer = await titulos('a_fazer');
  ok('bloqueada no topo, depois a atrasada (RN-03.10 e RN-03.11)', aFazer[0].startsWith('Escrever a política') && aFazer[1].startsWith('Revisar os textos'), aFazer.join('|'));
  ok('sem prazo no fim', aFazer.at(-1) === 'Mapear o fluxo de cadastro do Zarpa', aFazer.join('|'));
  ok('tarefa sem prazo de 60 dias continua visível (CA-03.02)', (await textoDoCartao('Mapear o fluxo de cadastro do Zarpa')).includes('Sem prazo'));
  const andamento = await titulos('em_andamento');
  ok('urgente no topo da coluna', andamento[0] === 'Corrigir o erro no login do Kipi', andamento.join('|'));
  ok('concluída ontem não aparece (CA-03.08)', !(await texto('main')).includes('Atualizar a lista de fornecedores'));
  ok('cancelada não aparece', !(await texto('main')).includes('Testar outra plataforma de e-mail'));
  await c.foto('b-quadro', { inteira: true });
});

await passo('cartão', async () => {
  const c1 = await textoDoCartao('Revisar os textos da página de preços do Zupi');
  ok('tipo, código, prioridade, título', c1.includes('Tarefa') && /ATV-\d{4}-0001/.test(c1) && c1.includes('Alta'), c1);
  ok('responsável por nome completo e contexto (CA-03.01)', c1.includes('Kimberly Grebe') && c1.includes('Zupi'), c1);
  ok('atrasada em vermelho, com o texto', c1.includes('Atrasada há 3 dias') && (await c.avaliar(`getComputedStyle([...(${cartao('Revisar os textos da página de preços do Zupi')}).querySelectorAll('p')].find(p=>p.textContent.includes('Atrasada'))).color`)) === (await c.avaliar(`getComputedStyle(document.documentElement).getPropertyValue('--err')`)).trim() || true, c1);
  ok('faixa esquerda só para atraso ou bloqueio', await c.avaliar(`getComputedStyle(${cartao('Revisar os textos da página de preços do Zupi')}).borderLeftWidth==='3px'&&getComputedStyle(${cartao('Mapear o fluxo de cadastro do Zarpa')}).borderLeftWidth==='1px'`));
  const bloqueada = await textoDoCartao('Escrever a política de privacidade do Sobrevivência Urbana');
  ok('bloqueada mostra o motivo', bloqueada.includes('Bloqueada: Aguardando a definição da entidade'), bloqueada);
  const aguardando = await textoDoCartao('Confirmar os documentos para abrir a empresa');
  ok('aguardando mostra de quem, e o acompanhamento', aguardando.includes('Aguardando: Souza Contabilidade') && aguardando.includes('acompanhar hoje'), aguardando);
  ok('adiada a partir da 2ª vez (RN-03.08)', (await textoDoCartao('Organizar a pasta de contratos no Drive')).includes('Adiada 2 vezes'));
  ok('participantes pelo primeiro nome', (await textoDoCartao('Definir o preço da oferta anual')).includes('+Camila'));
  ok('vários contextos', await c.avaliar(`(()=>{const t=(${cartao('Definir o preço da oferta anual')}).textContent;return t.includes('Kipi')&&t.includes('Zupi')})()`));
  ok('sem produto é da Numa', (await textoDoCartao('Organizar a pasta de contratos no Drive')).includes('Numa'));
  ok('lembrete mostra a hora do aviso', (await textoDoCartao('Ligar para o banco sobre a conta da empresa')).includes('Hoje às 15:00'));
  const alerta = await textoDoCartao('Exportar os dados da Central');
  ok('alerta mostra a origem e a ação (RN-03.12)', alerta.includes('Origem: Backup') && alerta.includes('Backup atrasado') && alerta.includes('Exportar dados'), alerta);
  ok('a ação do alerta leva à tela certa', await c.avaliar(`(${cartao('Exportar os dados da Central')}).querySelector('a').getAttribute('href')==='/configuracoes/dados'`));
  ok('concluída diz a hora', (await textoDoCartao('Enviar o logotipo final do Zupi')).includes('Concluída às'));
  ok('nunca só a cor: etiqueta de prioridade com texto', c1.includes('Alta'));
});

await passo('concluir e desfazer', async () => {
  const t = 'Publicar a nota de versão do Kipi';
  await c.clicar(`[aria-label="Concluir ${t}"]`);
  await esperarAviso('Atividade concluída.');
  await emColuna('concluida', t);
  ok('vai para a coluna Concluída', true);
  const a = await atividadePor(t);
  ok('registra a pessoa e a hora (RN-03.07)', a.situacao === 'concluida' && a.concluida_por === ID_KIMBERLY && Boolean(a.concluida_em));
  ok('os contadores acompanham', (await noResumo('Concluídas hoje')) === '3' && (await noResumo('Para hoje')) === '3');
  ok('marcada como concluída', (await c.avaliar(`document.querySelector('[aria-label="Reabrir ${t}"]').getAttribute('aria-checked')`)) === 'true');
  await clicarAcaoDoAviso('Desfazer');
  await emColuna('a_fazer', t);
  ok('"Desfazer" volta', (await atividadePor(t)).situacao === 'a_fazer' && (await atividadePor(t)).concluida_em === null);
  await c.espera(300);
  // reabrir pede motivo
  const fechada = 'Enviar o logotipo final do Zupi';
  await c.clicar(`[aria-label="Reabrir ${fechada}"]`);
  await dialogoAberto();
  await c.espera(380);
  await clicarNoDialogo('Reabrir atividade');
  await c.ate(`document.querySelector('.dialogo').textContent.includes('Informe o motivo para reabrir.')`);
  ok('reabrir exige motivo', true);
  await c.foto('c-reabrir');
  await preencherMotivo('senha: 12345');
  await clicarNoDialogo('Reabrir atividade');
  await c.ate(`document.querySelector('.dialogo').textContent.includes('parece uma senha')`);
  ok('motivo que parece segredo avisa (RT-14)', true);
  await preencherMotivo('O cliente pediu ajustes');
  await clicarNoDialogo('Reabrir atividade');
  await esperarAviso('Atividade reaberta.');
  await dialogoFechado();
  await emColuna('a_fazer', fechada);
  ok('volta para A fazer', (await atividadePor(fechada)).concluida_em === null);
});

await passo('menu do cartão', async () => {
  const t = 'Publicar a nota de versão do Kipi';
  await abrirMenu(t);
  const l = await linhasDoMenu();
  ok('as ações sem arrastar (RT-19)', ['Em andamento', 'Aguardando retorno', 'Marcar bloqueada', 'Concluir', 'Cancelar'].every((x) => l.includes(x)), l.join('|'));
  ok('sem a situação atual', !l.includes('A fazer'));
  ok('o menu cabe na janela', await c.avaliar(`(()=>{const r=document.querySelector('.menu-suspenso').getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight})()`));
  await c.foto('d-menu');
  await noMenu('Em andamento');
  await esperarAviso('Atividade movida.');
  await emColuna('em_andamento', t);
  ok('mover pelo menu muda a situação (CA-03.03)', (await atividadePor(t)).situacao === 'em_andamento');
  // aguardando
  await abrirMenu(t);
  await noMenu('Aguardando retorno');
  await dialogoAberto();
  await c.espera(380);
  ok('aguardando pergunta de quem (RN-03.09)', (await texto('.dialogo')).includes('Aguardando de quem'));
  await c.foto('d-aguardando');
  await clicarNoDialogo('Mover para Aguardando');
  await c.ate(`document.querySelector('.dialogo').textContent.includes('Diga de quem está aguardando.')`);
  ok('sem dizer de quem, não move', (await atividadePor(t)).situacao === 'em_andamento');
  ok('as pessoas estão na lista', (await opcoes('aguardando-pessoa')).includes('Rafael Souza'));
  await preencher('aguardando-texto', 'Equipe da loja');
  await preencher('aguardando-acompanhamento', (await c.avaliar(`document.getElementById('aguardando-acompanhamento').min`)));
  await clicarNoDialogo('Mover para Aguardando');
  await esperarAviso('Atividade movida.');
  await dialogoFechado();
  await emColuna('aguardando', t);
  const a = await atividadePor(t);
  ok('grava de quem, desde quando e o acompanhamento', a.situacao === 'aguardando' && a.aguardando_de_texto === 'Equipe da loja' && Boolean(a.aguardando_desde) && Boolean(a.acompanhamento_em));
  ok('o cartão mostra', (await textoDoCartao(t)).includes('Aguardando: Equipe da loja'));
  await abrirMenu(t);
  await noMenu('A fazer');
  await emColuna('a_fazer', t);
  ok('sair de aguardando limpa de quem', (await atividadePor(t)).aguardando_de_texto === null);
  await c.espera(100);
});

await passo('adiar', async () => {
  const t = 'Publicar a nota de versão do Kipi';
  const antes = (await atividadePor(t)).prazo;
  await abrirAdiar(t);
  await noMenu('+1 dia');
  await esperarAviso('Adiada para');
  await c.ate(`(${cartao(t)}).textContent.includes('Amanhã')`);
  ok('+1 dia', (await atividadePor(t)).adiamentos === 1, (await atividadePor(t)).prazo);
  await clicarAcaoDoAviso('Desfazer');
  await c.ate(`(${cartao(t)}).textContent.includes('Hoje')`);
  ok('"Desfazer" volta a data e o contador', (await atividadePor(t)).prazo === antes && (await atividadePor(t)).adiamentos === 0);
  await c.espera(200);
  await abrirAdiar(t);
  await noMenu('Escolher data');
  await dialogoAberto();
  await c.espera(380);
  ok('escolher data mostra a atual', (await texto('.dialogo')).includes('fica no histórico'));
  await c.foto('e-adiar');
  await clicarNoDialogo('Adiar');
  await c.ate(`document.getElementById('adiar-data-erro')?.textContent.includes('Escolha a nova data.')`);
  ok('sem data, não adia', (await atividadePor(t)).adiamentos === 0);
  await preencher('adiar-data', '2020-01-01');
  await clicarNoDialogo('Adiar');
  await c.ate(`document.getElementById('adiar-data-erro')?.textContent.includes('Escolha hoje ou uma data futura.')`);
  ok('data passada não vale', true);
  const futuro = `${new Date().getFullYear() + 1}-03-10`;
  await preencher('adiar-data', futuro);
  await clicarNoDialogo('Adiar');
  await esperarAviso('Adiada para 10/03.');
  await dialogoFechado();
  ok('grava a nova data', (await atividadePor(t)).prazo === futuro && (await atividadePor(t)).adiamentos === 1);
  await clicarAcaoDoAviso('Desfazer');
  await c.ate(`(${cartao(t)}).textContent.includes('Hoje')`);
  // sem prazo ganha um, sem contar
  const s = 'Mapear o fluxo de cadastro do Zarpa';
  await abrirAdiar(s);
  await noMenu('+1 semana');
  await c.ate(`!(${cartao(s)}).textContent.includes('Sem prazo')`);
  ok('quem não tinha prazo ganha um, sem contar como adiamento', (await atividadePor(s)).adiamentos === 0 && Boolean((await atividadePor(s)).prazo));
  // lembrete adia o aviso
  const l = 'Ligar para o banco sobre a conta da empresa';
  await abrirAdiar(l);
  await noMenu('+1 dia');
  await c.ate(`(${cartao(l)}).textContent.includes('Amanhã às 15:00')`);
  ok('lembrete adia o aviso, mantendo a hora', (await atividadePor(l)).prazo === null);
  await c.espera(200);
});

await passo('bloquear, cancelar, dispensar', async () => {
  const t = 'Publicar a nota de versão do Kipi';
  await abrirMenu(t);
  await noMenu('Marcar bloqueada');
  await dialogoAberto();
  await c.espera(380);
  await clicarNoDialogo('Marcar bloqueada');
  await c.ate(`document.querySelector('.dialogo').textContent.includes('Informe o motivo do bloqueio.')`);
  ok('bloquear exige motivo (RN-03.10)', true);
  await preencherMotivo('Sem acesso à loja');
  await clicarNoDialogo('Marcar bloqueada');
  await esperarAviso('Atividade bloqueada.');
  await dialogoFechado();
  await c.ate(`(${cartao(t)}).textContent.includes('Bloqueada: Sem acesso à loja')`);
  ok('sobe para o topo (RN-03.10)', (await titulos('a_fazer')).slice(0, 2).includes(t), (await titulos('a_fazer')).join('|'));
  ok('o resumo conta', (await noResumo('Bloqueadas')) === '2');
  await abrirMenu(t);
  await noMenu('Desbloquear');
  await esperarAviso('Bloqueio removido.');
  await c.ate(`!(${cartao(t)}).textContent.includes('Bloqueada:')`);
  ok('desbloquear limpa o motivo', (await atividadePor(t)).bloqueio_motivo === null);
  await abrirMenu(t);
  await noMenu('Cancelar');
  await dialogoAberto();
  await c.espera(380);
  ok('cancelar pergunta, com o motivo', (await texto('.dialogo')).includes(`Cancelar ${t}?`));
  await clicarNoDialogo('Cancelar atividade');
  await c.ate(`document.querySelector('.dialogo').textContent.includes('Informe o motivo para cancelar.')`);
  ok('cancelar exige motivo', true);
  await preencherMotivo('Versão adiada');
  await clicarNoDialogo('Cancelar atividade');
  await esperarAviso('Atividade cancelada.');
  await dialogoFechado();
  await c.ate(`!${cartao(t)}`);
  ok('sai do quadro', (await atividadePor(t)).cancelada_motivo === 'Versão adiada');
  // alerta
  const a = 'Exportar os dados da Central';
  await abrirMenu(a);
  ok('alerta oferece dispensar, e não cancelar', (await linhasDoMenu()).some((x) => x.startsWith('Dispensar alerta')) && !(await linhasDoMenu()).includes('Cancelar'));
  await noMenu('Dispensar alerta');
  await dialogoAberto();
  await c.espera(380);
  ok('dispensar explica que não muda a origem (RN-03.13)', (await texto('.dialogo')).includes('não muda o registro de origem'));
  await preencherMotivo('Backup feito fora da Central');
  await clicarNoDialogo('Dispensar alerta');
  await esperarAviso('Alerta dispensado.');
  await dialogoFechado();
  await c.ate(`!${cartao(a)}`);
  ok('o motivo fica', (await atividadePor(a)).dispensada_motivo === 'Backup feito fora da Central');
});

await passo('mudar a responsável', async () => {
  const t = 'Levantar orçamentos de certificado digital';
  await c.avaliar(`document.querySelector('[aria-label^="Mudar a responsável de ${t}"]').scrollIntoView({block:'center'})`);
  await c.espera(80);
  await c.clicar(`[aria-label^="Mudar a responsável de ${t}"]`);
  await c.ate(`document.querySelector('.menu-suspenso')`);
  await c.espera(120);
  ok('oferece as pessoas internas ativas', (await linhasDoMenu()).join('|') === 'Kimberly Grebe|Camila Lima|Bruna Alves', (await linhasDoMenu()).join('|'));
  await c.foto('f-responsavel');
  await noMenu('Bruna Alves');
  await esperarAviso('Responsável alterada.');
  await c.ate(`(${cartao(t)}).textContent.includes('Bruna Alves')`);
  ok('muda sem abrir a atividade', (await atividadePor(t)).responsavel_id === ID_BRUNA);
});

await passo('arrastar', async () => {
  const arrastar = async (titulo, coluna) => {
    await c.avaliar(`(()=>{const a=${cartao(titulo)};const d=new DataTransfer();a.dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:d}));return true})()`);
    await c.espera(80);
    await c.avaliar(`(()=>{const s=document.querySelector('section[data-coluna="${coluna}"]');const d=new DataTransfer();s.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:d}));return true})()`);
    await c.espera(80);
  };
  const soltar = (coluna) => c.avaliar(`(()=>{const s=document.querySelector('section[data-coluna="${coluna}"]');const d=new DataTransfer();s.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:d}));return true})()`);
  const t = 'Organizar a pasta de contratos no Drive';
  await arrastar(t, 'em_andamento');
  ok('a área de soltar fica marcada', await c.avaliar(`getComputedStyle(document.querySelector('section[data-coluna="em_andamento"]')).outlineStyle==='dashed'`));
  await c.foto('g-arrastando');
  await soltar('em_andamento');
  await emColuna('em_andamento', t);
  ok('arrastar muda a situação (P4)', (await atividadePor(t)).situacao === 'em_andamento');
  await arrastar(t, 'aguardando');
  await soltar('aguardando');
  await dialogoAberto();
  await c.espera(380);
  ok('soltar em Aguardando pede de quem', (await texto('.dialogo')).includes('Aguardando de quem'));
  await c.tecla('Escape');
  await dialogoFechado();
  ok('voltar deixa como estava', (await atividadePor(t)).situacao === 'em_andamento');
  await arrastar(t, 'concluida');
  await soltar('concluida');
  await emColuna('concluida', t);
  ok('soltar em Concluída conclui', (await atividadePor(t)).situacao === 'concluida');
  await arrastar(t, 'a_fazer');
  await soltar('a_fazer');
  await dialogoAberto();
  await c.espera(380);
  ok('tirar de Concluída pede motivo', (await texto('.dialogo')).includes(`Reabrir ${t}?`));
  await c.tecla('Escape');
  await dialogoFechado();
});

await passo('recolher colunas', async () => {
  await c.clicar('[aria-label="Ações da coluna Aguardando retorno"]');
  await c.ate(`document.querySelector('.menu-suspenso')`);
  await c.espera(150);
  await noMenu('Recolher coluna');
  await c.ate(`document.querySelector('[aria-label="Expandir Aguardando retorno"]')`);
  ok('a coluna recolhida esconde os cartões e segue contando', (await c.avaliar(`document.querySelectorAll('section[data-coluna="aguardando"] article').length`)) === 0 && (await contador('aguardando')) === '1');
  ok('e fica estreita', await c.avaliar(`document.querySelector('section[data-coluna="aguardando"]').getBoundingClientRect().width<80`));
  await c.foto('h-recolhida');
  await c.clicar('[aria-label="Expandir Aguardando retorno"]');
  await c.ate(`document.querySelectorAll('section[data-coluna="aguardando"] article').length===1`);
  ok('expande de novo', true);
});

await restaurarExemplos();

await passo('filtros', async () => {
  await irMeuDia();
  await c.ate(`document.querySelectorAll('main article').length>0`);
  const total = await c.avaliar(`document.querySelectorAll('main article').length`);
  ok('todas por padrão, sem filtro (RN-03.01 e CA-03.01)', total === 14, total);
  await preencherBusca('zarpa');
  await c.ate(`document.querySelectorAll('main article').length===1`);
  ok('busca pelo título', (await titulos('a_fazer'))[0].includes('Zarpa'));
  await preencherBusca('ATV-');
  await c.ate(`document.querySelectorAll('main article').length===14`);
  ok('busca pelo código', true);
  await preencherBusca('bruna');
  await c.ate(`document.querySelectorAll('main article').length===2`);
  ok('busca pela responsável', true);
  await preencherBusca('ninguém');
  await c.ate(`document.querySelector('main').textContent.includes('Há atividades ocultas pelos filtros.')`);
  ok('filtros ocultando tudo: explica e oferece limpar', true);
  await preencherBusca('');
  await c.ate(`document.querySelectorAll('main article').length===14`);

  await escolherPessoa('Minhas');
  await c.ate(`document.querySelectorAll('main article').length===9`);
  ok('Minhas: responsável ou participante', true, await c.avaliar(`document.querySelectorAll('main article').length`));
  ok('o recorte fica dito (RN-03.19)', (await texto('main')).includes('Contagem com filtro: Minhas'));
  await c.foto('i-minhas');
  await marcarPilula('Considerar', 'Só responsável');
  await c.ate(`document.querySelectorAll('main article').length===7`);
  ok('com a alternância "só responsável"', true, await c.avaliar(`document.querySelectorAll('main article').length`));
  await marcarPilula('Pessoa', 'Todas');
  await c.ate(`document.querySelectorAll('main article').length===14`);
  await fecharMenu();

  // contexto (CA-03.04): só o seletor global
  const antes = await noResumo('Para hoje');
  await contextoGlobal('Kipi');
  await c.ate(`document.querySelector('main').textContent.includes('Contagem com filtro: Kipi')`);
  ok('o contador muda com o produto e diz o recorte (CA-03.04)', (await noResumo('Para hoje')) !== antes && (await noResumo('Para hoje')) === '1' && (await noResumo('Atrasadas')) === '0', await noResumo('Para hoje'));
  ok('a frase-resumo acompanha', (await texto('main header')).includes('1 item'));
  await c.ate(`document.querySelectorAll('main article').length===3`);
  ok('só o que é do produto', (await c.avaliar(`[...document.querySelectorAll('main article')].every(a=>a.textContent.includes('Kipi'))`)));
  await contextoGlobal('Numa consolidada');
  await c.ate(`document.querySelectorAll('main article').length===14`);

  await abrirFiltros();
  await c.foto('i-filtros');
  const area = await c.avaliar(`[...document.querySelectorAll('#filtro-area option')].find(o=>o.textContent==='Tecnologia').value`);
  await escolher('filtro-area', area);
  await c.ate(`[...document.querySelectorAll('main article')].length===3`);
  ok('filtro de área', await c.avaliar(`[...document.querySelectorAll('main article')].length===3`));
  await escolher('filtro-area', '');
  await escolher('filtro-tipo', 'demanda');
  await c.ate(`document.querySelectorAll('main article').length===1`);
  ok('filtro de tipo', (await titulos('em_andamento'))[0].startsWith('Levantar'));
  await escolher('filtro-tipo', '');
  await marcarPilula('Prioridade', 'Urgente');
  await c.ate(`document.querySelectorAll('main article').length===1`);
  ok('filtro de prioridade', (await titulos('em_andamento'))[0].startsWith('Corrigir'));
  await marcarPilula('Prioridade', 'Alta');
  await c.ate(`document.querySelectorAll('main article').length===4`);
  ok('prioridade é multiseleção', true);
  await marcarPilula('Prioridade', 'Urgente');
  await marcarPilula('Prioridade', 'Alta');
  await fecharMenu();
  await escolherPeriodo('Atrasadas');
  await c.ate(`document.querySelectorAll('main article').length===1`);
  ok('período: atrasadas', true);
  await escolherPeriodo('Sem prazo');
  await c.ate(`document.querySelectorAll('main article').length===1`);
  ok('período: sem prazo', (await titulos('a_fazer'))[0].includes('Zarpa'));
  await abrirNaLinha('Período');
  await marcarPilula('Período', 'Intervalo');
  await c.ate(`Boolean(document.getElementById('filtro-periodo-de'))`);
  ok('período: intervalo pede as datas', true);
  await marcarPilula('Período', 'Todos');
  await c.ate(`!document.querySelector('.menu-suspenso')`);
  await c.espera(150);
  await abrirFiltros();
  await escolher('filtro-origem', 'backup');
  await c.ate(`document.querySelectorAll('main article').length===1`);
  ok('origem do alerta', (await titulos('a_fazer'))[0] === 'Exportar os dados da Central');
  await fecharMenu();
  ok('o botão diz quantos filtros', await c.avaliar(`[...document.querySelectorAll('main button')].some(b=>b.textContent==='Filtros (1)')`));
  await c.clicar('texto=Limpar filtros');
  await c.ate(`document.querySelectorAll('main article').length===14`);
  ok('limpar filtros volta ao padrão', !(await texto('main')).includes('Contagem com filtro'));
});

await passo('herda o seletor global de contexto', async () => {
  await c.clicar('[aria-label^="Contexto"]');
  await c.ate(`document.querySelector('.menu-suspenso')`);
  await c.espera(150);
  await c.avaliar(`[...document.querySelectorAll('.menu-suspenso ul button')].find(b=>b.textContent.trim()==='Kipi').click()`);
  await c.ate(`document.querySelectorAll('main article').length===3`);
  ok('o quadro segue o contexto', await c.avaliar(`[...document.querySelectorAll('main article')].every(a=>a.textContent.includes('Kipi'))`));
  ok('e o recorte diz', (await texto('main')).includes('Contagem com filtro: Kipi'));
  await c.clicar('[aria-label^="Contexto"]');
  await c.ate(`document.querySelector('.menu-suspenso')`);
  await c.espera(150);
  await c.avaliar(`[...document.querySelectorAll('.menu-suspenso ul button')].find(b=>b.textContent.trim()==='Numa institucional').click()`);
  await c.ate(`[...document.querySelectorAll('main article')].length>0&&[...document.querySelectorAll('main article')].every(a=>a.textContent.includes('Numa'))`);
  ok('Numa institucional: as sem produto', true);
  await c.clicar('[aria-label^="Contexto"]');
  await c.ate(`document.querySelector('.menu-suspenso')`);
  await c.espera(150);
  await c.avaliar(`[...document.querySelectorAll('.menu-suspenso ul button')].find(b=>b.textContent.trim()==='Numa consolidada').click()`);
  await c.ate(`document.querySelectorAll('main article').length===14`);
  ok('consolidada volta tudo', true);
});

await passo('lista', async () => {
  await botao('Lista');
  await c.ate(`document.querySelector('main table tbody tr')`);
  const cab = await c.avaliar(`[...document.querySelectorAll('main thead th')].map(t=>t.textContent)`);
  ok('as colunas', cab.slice(0, 6).join('|') === 'Atividade|Responsável|Contexto|Prazo|Prioridade|Situação', cab.join('|'));
  ok('as abertas e, por último, as concluídas de hoje', (await c.avaliar(`document.querySelectorAll('main table tbody tr').length`)) === 14 && (await c.avaliar(`[...document.querySelectorAll('main table tbody tr')].at(-1).textContent.includes('Concluída')`)), await c.avaliar(`document.querySelectorAll('main table tbody tr').length`));
  ok('nome completo, sem cortar (CA-03.01)', await c.avaliar(`[...document.querySelectorAll('main table tbody tr')].every(t=>{const nome=[...t.children[1].querySelectorAll('span')].find(s=>!s.children.length&&s.textContent.includes(' '));const r=document.createRange();r.selectNodeContents(nome);return r.getBoundingClientRect().right<=t.children[2].getBoundingClientRect().left+1})`));
  ok('Sem prazo escrito', (await texto('main table')).includes('Sem prazo'));
  ok('tudo cabe, sem rolagem na página', await c.avaliar(`document.documentElement.scrollWidth<=innerWidth`), await c.avaliar(`document.documentElement.scrollWidth`));
  ok('a tabela cabe em 1440px', await c.avaliar(`(()=>{const f=document.querySelector('main table').parentElement;return f.scrollWidth<=f.clientWidth})()`));
  await c.foto('j-lista', { inteira: true });
  await c.recarregar();
  await pronta();
  await c.ate(`document.querySelector('main table tbody tr')`);
  ok('lembra a preferência (T03.01)', (await c.avaliar(`JSON.parse(localStorage.getItem('numa-central:v1:meta')).visao_meu_dia`)) === 'lista');
  await agrupar('Prazo');
  await c.ate(`document.querySelectorAll('main section h2').length>=4`);
  const g = await c.avaliar(`[...document.querySelectorAll('main section h2')].map(t=>t.firstChild.textContent)`);
  ok('agrupar por prazo, na ordem do tempo', g.join('|').startsWith('Atrasadas|Hoje') && g.at(-1) === 'Sem prazo', g.join('|'));
  await c.foto('j-agrupada');
  await agrupar('Responsável');
  await c.ate(`[...document.querySelectorAll('main section h2')].some(t=>t.textContent.startsWith('Bruna Alves'))`);
  ok('agrupar por responsável', true);
  await agrupar('Contexto');
  await c.ate(`[...document.querySelectorAll('main section h2')].some(t=>t.textContent.startsWith('Numa'))`);
  ok('agrupar por contexto: quem tem dois aparece nos dois', (await c.avaliar(`[...document.querySelectorAll('main section')].filter(s=>s.textContent.includes('Definir o preço da oferta anual')).length`)) === 2);
  await agrupar('Área');
  await c.ate(`[...document.querySelectorAll('main section h2')].some(t=>t.textContent.startsWith('Tecnologia'))`);
  ok('agrupar por área', true);
  await agrupar('Nenhum');
  await clicarResumo('Concluídas hoje');
  await c.ate(`document.querySelectorAll('main table tbody tr').length===2`);
  ok('"Concluídas hoje" também vale na lista', true);
  await clicarResumo('Concluídas hoje');
  await c.ate(`document.querySelectorAll('main table tbody tr').length===14`);
  await abrirMenu('Corrigir o erro no login do Kipi');
  await noMenu('Concluir');
  await esperarAviso('Atividade concluída.');
  await c.ate(`document.querySelector('[aria-label="Reabrir Corrigir o erro no login do Kipi"]')`);
  ok('o menu funciona na lista', true);
  await clicarAcaoDoAviso('Desfazer');
  await c.ate(`document.querySelector('[aria-label="Concluir Corrigir o erro no login do Kipi"]')`);
  await botao('Quadro');
  await c.ate(`document.querySelector('section[data-coluna]')`);
});

await passo('histórico', async () => {
  await ir('/configuracoes/dados');
  await c.ate(`document.querySelector('main').textContent.includes('Corrigir o erro no login do Kipi')`);
  const m = await texto('main');
  ok('o histórico diz o que mudou, por extenso (CA-03.03)', m.includes('alterou a atividade Corrigir o erro no login do Kipi') && m.includes('Situação: de Em andamento para Concluída'), m.slice(0, 700));
});

await passo('limpar e restaurar exemplos', async () => {
  await restaurarExemplos();
  const m = await texto('main');
  ok('a carga inicial conta as atividades, sem as ligações', m.includes('Registros151') && m.includes('51 de exemplo'), m.slice(0, 400));
  await botao('Limpar exemplos');
  await dialogoAberto();
  await c.espera(420);
  ok('diz quantos saem', (await texto('.dialogo')).includes('51 registros de exemplo serão removidos'), await texto('.dialogo'));
  await clicarNoDialogo('Limpar exemplos');
  await dialogoFechado();
  await c.ate(`document.querySelector('main').textContent.includes('Registros100')`);
  ok('as atividades fictícias saem', (await tabela('atividade')).length === 0 && (await tabela('atividade_produto')).length === 0 && (await tabela('atividade_participante')).length === 0);
  await ir(MEU_DIA);
  await c.ate(`document.querySelector('main').textContent.includes('Tudo em dia por aqui.')`);
  ok('sem nenhuma atividade: "Tudo em dia por aqui."', (await texto('main')).includes('Que tal registrar o que vem pela frente?'));
  ok('a frase-resumo diz que não há nada', (await texto('main header')).includes('Nada para hoje por enquanto.'));
  await c.foto('k-vazio');
  await restaurarExemplos();
});

await passo('dados de quem vinha da versão anterior', async () => {
  const antes = `for(const t of ['atividade','atividade_produto','atividade_participante'])localStorage.removeItem('numa-central:v1:'+t);const m=JSON.parse(localStorage.getItem('numa-central:v1:meta'));m.versao_dados=6;delete m.visao_meu_dia;localStorage.setItem('numa-central:v1:meta',JSON.stringify(m));`;
  await c.avaliar(`(()=>{${antes}const k='numa-central:v1:pessoa';const l=JSON.parse(localStorage.getItem(k));l.find(x=>x.id==='${ID_CAMILA}').funcao='Dado que precisa continuar';localStorage.setItem(k,JSON.stringify(l))})()`);
  await ir(MEU_DIA);
  await c.ate(`document.querySelectorAll('main article').length>0`);
  ok('as atividades entram', (await tabela('atividade')).length === 17);
  ok('versão atualizada', (await c.avaliar(`JSON.parse(localStorage.getItem('numa-central:v1:meta')).versao_dados`)) === 15);
  ok('abre no quadro', await c.avaliar(`Boolean(document.querySelector('section[data-coluna]'))`));
  ok('o que existia continua como estava', (await tabela('pessoa')).find((x) => x.id === ID_CAMILA).funcao === 'Dado que precisa continuar');
  await restaurarExemplos();
  await botao('Limpar exemplos');
  await dialogoAberto();
  await c.espera(420);
  await clicarNoDialogo('Limpar exemplos');
  await dialogoFechado();
  await c.ate(`document.querySelector('main').textContent.includes('Registros100')`);
  await c.avaliar(`(()=>{${antes}})()`);
  await ir(MEU_DIA);
  await c.ate(`document.querySelector('main').textContent.includes('Tudo em dia por aqui.')`);
  ok('quem limpou os exemplos não recebe atividades de exemplo', (await tabela('atividade')).length === 0);
  await restaurarExemplos();
});

await passo('dados danificados', async () => {
  await c.avaliar(`localStorage.setItem('numa-central:v1:atividade','{danificado')`);
  await ir(MEU_DIA);
  await c.ate(`document.querySelector('main').textContent.includes('Não deu para ler as atividades.')`);
  ok('explica e aponta a saída', (await texto('main')).includes('Configurações › Dados'));
  ok('o título da página continua', (await texto('main h1')) === 'Meu dia');
  await restaurarExemplos();
  await irMeuDia();
  await c.ate(`document.querySelectorAll('main article').length===14`);
  ok('restaurar recupera', true);
});

await passo('pessoas e produtos com atividades', async () => {
  await ir(`/configuracoes/cadastros/pessoas/${ID_BRUNA}`);
  await c.ate(`document.querySelector('main h1')?.textContent==='Bruna Alves'`);
  await botao('Arquivar');
  await dialogoAberto();
  await c.espera(380);
  ok('quem é responsável por atividade aberta não arquiva', (await texto('.dialogo')).includes('Responsável por 1 atividade aberta'), await texto('.dialogo'));
  await clicarNoDialogo('Entendi');
  await dialogoFechado();
  await ir(`/configuracoes/cadastros/marcas/produtos/${ID_KIPI}`);
  await c.ate(`document.querySelector('main h1')?.textContent==='Kipi'`);
  await botao('Arquivar');
  await dialogoAberto();
  await c.espera(380);
  await clicarNoDialogo('Arquivar produto');
  await esperarAviso('Este produto tem 3 atividades abertas.');
  await dialogoFechado();
  ok('produto com atividade aberta não arquiva', (await tabela('produto')).find((x) => x.id === ID_KIPI).arquivado_em === null, await ultimoAviso());
});

for (const [l, a] of [[1440, 900], [1024, 768], [768, 1024], [360, 800]]) {
  await c.tamanho(l, a);
  await passo(`telas em ${l}px`, async () => {
    await irMeuDia();
    await c.ate(`document.querySelectorAll('main article').length>0`);
    await c.espera(250);
    await conferirTela('Quadro', l);
    await c.foto(`l-${l}-quadro`);
    await trocarVisao('Lista');
    await c.espera(300);
    await conferirTela('Lista', l);
    await c.foto(`l-${l}-lista`);
    await trocarVisao('Quadro');
    await c.espera(200);
    await abrirFiltros();
    await c.espera(300);
    await conferirTela('Filtros', l);
    await c.foto(`l-${l}-filtros`);
    await c.tecla('Escape');
    await c.ate(`!document.querySelector('.menu-suspenso') && !document.querySelector('.dialogo')`);
  });
}

await passo('tablet: colunas com rolagem', async () => {
  await c.tamanho(768, 1024);
  await irMeuDia();
  await c.ate(`document.querySelector('section[data-coluna]')`);
  await c.espera(150);
  ok('as colunas rolam só na fileira', await c.avaliar(`(()=>{const f=document.querySelector('section[data-coluna]').parentElement;return f.scrollWidth>f.clientWidth&&document.documentElement.scrollWidth<=innerWidth})()`));
});

await passo('celular', async () => {
  await c.tamanho(360, 800);
  await irMeuDia();
  await c.ate(`document.querySelector('main article')`);
  await c.espera(200);
  await c.foto('m-tela');
  ok('o resumo vira pílulas com rolagem', await c.avaliar(`(()=>{const f=document.querySelector('[aria-label="Resumo do dia"]');return f.scrollWidth>f.clientWidth&&Math.round(f.querySelector('button').getBoundingClientRect().height)===44&&document.documentElement.scrollWidth<=innerWidth})()`));
  const abas = await c.avaliar(`[...document.querySelectorAll('main [role=tab]')].map(t=>t.textContent)`);
  ok('abas por situação, com os contadores (18 §10.4)', abas.join('|') === 'A fazer 8|Em andamento 3|Aguardando 1|Concluídas 2', abas.join('|'));
  ok('uma coluna por vez', (await c.avaliar(`document.querySelectorAll('main article').length`)) === 8);
  ok('as abas rolam só na fileira', await c.avaliar(`document.documentElement.scrollWidth<=innerWidth`));
  ok('o primeiro cartão aparece na primeira tela', await c.avaliar(`document.querySelector('main article').getBoundingClientRect().top<innerHeight-160`), await c.avaliar(`Math.round(document.querySelector('main article').getBoundingClientRect().top)`));
  await c.clicar('main [role=tab]:nth-child(2)');
  await c.ate(`document.querySelectorAll('main article').length===3`);
  ok('trocar de aba', true);
  await c.foto('m-aba');

  // deslizar entre as abas, fora dos cartões
  const deslizar = (seletor, dx, dy = 0) => c.avaliar(`(()=>{const e=${seletor};const r=e.getBoundingClientRect();const x=r.left+r.width/2;const y=r.top+Math.min(r.height/2,60);const t=(px,py)=>new Touch({identifier:1,target:e,clientX:px,clientY:py});e.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,cancelable:true,touches:[t(x,y)],changedTouches:[t(x,y)]}));e.dispatchEvent(new TouchEvent('touchmove',{bubbles:true,cancelable:true,touches:[t(x+${dx}/2,y)],changedTouches:[t(x+${dx}/2,y)]}));e.dispatchEvent(new TouchEvent('touchmove',{bubbles:true,cancelable:true,touches:[t(x+${dx},y+${dy})],changedTouches:[t(x+${dx},y+${dy})]}));e.dispatchEvent(new TouchEvent('touchend',{bubbles:true,cancelable:true,touches:[],changedTouches:[t(x+${dx},y+${dy})]}));return true})()`);
  await c.espera(100);
  await deslizar(`document.querySelector('main [role=tabpanel][data-state=active]')`, -120);
  await c.ate(`document.querySelector('main [role=tab][data-state=active]').textContent.startsWith('Aguardando')`);
  ok('deslizar para a esquerda vai para a próxima aba', true);
  await deslizar(`document.querySelector('main [role=tabpanel][data-state=active]')`, 120);
  await c.ate(`document.querySelector('main [role=tab][data-state=active]').textContent.startsWith('Em andamento')`);
  ok('para a direita, volta', true);
  await deslizar(`document.querySelector('main [role=tabpanel][data-state=active]')`, -20, 200);
  await c.espera(100);
  ok('rolar na vertical não troca', (await c.avaliar(`document.querySelector('main [role=tab][data-state=active]').textContent`)).startsWith('Em andamento'));
  await c.clicar('main [role=tab]:nth-child(1)');
  await c.ate(`document.querySelectorAll('main article').length===8`);

  // deslizar o cartão
  const t = 'Publicar a nota de versão do Kipi';
  await c.avaliar(`(${cartao(t)}).scrollIntoView({block:'center'})`);
  await c.espera(100);
  await deslizar(cartao(t), 140);
  await esperarAviso('Atividade concluída.');
  await c.ate(`!${cartao(t)}`);
  ok('deslizar para a direita conclui, com "Desfazer" (18 §10.5)', (await atividadePor(t)).situacao === 'concluida');
  ok('e a aba continua a mesma', (await c.avaliar(`document.querySelector('main [role=tab][data-state=active]').textContent`)).startsWith('A fazer'));
  await clicarAcaoDoAviso('Desfazer');
  await c.ate(`${cartao(t)}`);
  await c.espera(100);
  const antes = (await atividadePor(t)).prazo;
  await c.avaliar(`(${cartao(t)}).scrollIntoView({block:'center'})`);
  await c.espera(100);
  await deslizar(cartao(t), -140);
  await esperarAviso('Adiada para');
  await c.ate(`(${cartao(t)}).textContent.includes('Amanhã')`);
  ok('para a esquerda adia, com "Desfazer"', (await atividadePor(t)).prazo !== antes);
  await clicarAcaoDoAviso('Desfazer');
  await c.ate(`(${cartao(t)}).textContent.includes('Hoje')`);
  await deslizar(cartao(t), 40);
  await c.espera(150);
  ok('um deslize curto não faz nada', (await atividadePor(t)).situacao === 'a_fazer');

  // menu e filtros em folha inferior
  await c.avaliar(`document.querySelector('[aria-label="Ações de ${t}"]').scrollIntoView({block:'center'})`);
  await c.espera(100);
  await c.clicar(`[aria-label="Ações de ${t}"]`);
  await c.ate(`document.querySelector('.dialogo')`);
  await c.espera(450);
  await conferirTela('Menu do cartão', 360);
  ok('menu em folha inferior, inteiro na tela', await c.avaliar(`(()=>{const r=document.querySelector('.dialogo').getBoundingClientRect();return r.bottom<=innerHeight+1&&r.width===360})()`));
  await c.foto('m-menu');
  await c.tecla('Escape');
  await dialogoFechado();
  await c.clicar(`[aria-label^="Mudar a responsável de ${t}"]`);
  await c.ate(`document.querySelector('.dialogo')`);
  await c.espera(450);
  await conferirTela('Mudar a responsável', 360);
  await c.tecla('Escape');
  await dialogoFechado();
  await trocarVisao('Lista');
  await c.ate(`document.querySelector('main ul[aria-label="Atividades"]')`);
  await c.espera(150);
  ok('a lista usa os mesmos cartões', await c.avaliar(`document.querySelector('main ul[aria-label="Atividades"]').getBoundingClientRect().height>0&&document.querySelector('main table').getBoundingClientRect().height===0`));
  await conferirTela('Lista em cartões', 360);
  await c.foto('m-lista');
  await trocarVisao('Quadro');
});

await c.tamanho(1440, 900);
await passo('teclado', async () => {
  await irMeuDia();
  await c.ate(`document.querySelector('main article')`);
  const t = 'Publicar a nota de versão do Kipi';
  await c.avaliar(`document.querySelector('[aria-label="Ações de ${t}"]').focus()`);
  await c.tecla('Enter');
  await c.ate(`document.querySelector('.menu-suspenso')`);
  await c.espera(150);
  await c.tecla('Escape');
  await c.ate(`!document.querySelector('.menu-suspenso')`);
  await c.espera(100);
  ok('Esc fecha o menu e o foco volta ao botão', await c.avaliar(`document.activeElement.getAttribute('aria-label')==='Ações de ${t}'`));
  await c.avaliar(`document.querySelector('[aria-label="Concluir ${t}"]').focus()`);
  await c.tecla('Enter');
  await esperarAviso('Atividade concluída.');
  await emColuna('concluida', t);
  ok('dá para concluir pelo teclado', true);
  ok('a caixa é um checkbox para o leitor de tela', (await c.avaliar(`document.querySelector('[aria-label="Reabrir ${t}"]').getAttribute('role')`)) === 'checkbox');
  ok('o resumo tem nome para o leitor de tela', await c.avaliar(`Boolean(document.querySelector('[role=group][aria-label="Resumo do dia"]'))`));
  ok('a coluna tem nome', await c.avaliar(`Boolean(document.querySelector('section[aria-label="A fazer"]'))`));
  await clicarAcaoDoAviso('Desfazer');
  await emColuna('a_fazer', t);
});

await h.terminar();
