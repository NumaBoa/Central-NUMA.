// Revisão do M03 (T03.01 a T03.06): protótipos aprovados e as orientações de Kimberly de 06/11/2026.
// Meu dia em 1440, 1024, 768 e 360; as outras telas em 1440 e 360.
import { ID_KIMBERLY, iniciar } from './apoio.mjs';

const h = await iniciar({ nome: 'm03', porta: 9368 });
const { c, ok, passo, ir, texto, tabela, painelAberto, painelFechado, pularAbertura, conferirTela, esperarAviso, marcarPilula, pilulaMarcada, terminar } = h;

const js = (v) => JSON.stringify(v);

const LARGURAS = [1440, 1024, 768, 360];
const cartao = (titulo) => `[...document.querySelectorAll('main article')].find(a=>a.querySelector('h3')?.textContent===${js(titulo)})`;
const noResumo = (rotulo) => `[...document.querySelectorAll('[aria-label="Resumo do dia"] button')].find(b=>b.textContent.startsWith(${js(rotulo)}))`;
const numeroDoCartao = (rotulo) => c.avaliar(`Number(${noResumo(rotulo)}.textContent.replace(/\\D/g,''))`);
const clicarCartao = (rotulo) => c.avaliar(`${noResumo(rotulo)}.click()`);
const titulosNoQuadro = () => c.avaliar(`[...document.querySelectorAll('main article h3')].map(h=>h.textContent)`);
const etiquetasDeFiltro = () => c.avaliar(`[...document.querySelectorAll('main button[aria-label^="Remover filtro"]')].map(b=>b.textContent.trim())`);
const botaoNaLinha = (rotulo) => `document.querySelector(${js(`main button[aria-label^="${rotulo}:"]`)})`;
const botaoFiltros = () => c.avaliar(`[...document.querySelectorAll('main button')].find(b=>/^Filtros/.test(b.textContent.trim()))?.textContent.trim()`);
const abrirMenu = async (expressao) => {
  await c.avaliar(`${expressao}.click()`);
  await c.ate(`document.querySelector('.menu-suspenso,.dialogo')`);
  await c.espera(280);
};
const fecharMenu = async () => {
  await c.tecla('Escape');
  await c.ate(`!document.querySelector('.menu-suspenso,.dialogo')`);
  await c.espera(280);
};
const abrirFiltros = () => abrirMenu(`[...document.querySelectorAll('main button')].find(b=>/^Filtros/.test(b.textContent.trim()))`);
/** Uma linha só: nada da barra de filtros numa altura diferente. */
const barraEmUmaLinha = () =>
  c.avaliar(`(()=>{const busca=document.querySelector('main input[type=search]');const linha=busca.closest('.flex.items-center.gap-2').parentElement.firstElementChild;const itens=[...linha.children].map(e=>e.getBoundingClientRect());const a=itens.map(b=>Math.round(b.top+b.height/2));return {emUma:Math.max(...a)-Math.min(...a)<=2,rola:linha.scrollWidth>linha.clientWidth,itens:[...linha.children].map(e=>e.textContent.trim()||e.querySelector('input')?.placeholder)}})()`);

await c.tamanho(1440, 900);
await ir('/meu-dia');
await pularAbertura();
await c.ate(`document.querySelector('main article')`);

await passo('T03.01: a linha de filtros, em cada largura', async () => {
  for (const largura of LARGURAS) {
    await c.tamanho(largura, largura < 768 ? 800 : 900);
    await c.espera(350);
    await c.foto(`meu-dia-quadro-${largura}`, { inteira: largura === 360 });
    await conferirTela('Meu dia, quadro', largura);
    const barra = await barraEmUmaLinha();
    ok(`barra em uma linha em ${largura}px, sem cortar nada`, barra.emUma && !barra.rola, js(barra));
    const temPessoa = await c.avaliar(`Boolean(${botaoNaLinha('Pessoa')})`);
    const temPeriodo = await c.avaliar(`Boolean(${botaoNaLinha('Período')})`);
    if (largura === 1440) ok('em 1440: busca → pessoa → período → Filtros → Quadro | Lista', temPessoa && temPeriodo && /Filtros/.test(barra.itens.join(' ')) && /QuadroLista/.test(barra.itens.join(' ')), js(barra.itens));
    if (largura === 1024 || largura === 768) ok(`em ${largura}: o período, menos usado, passou para Filtros`, temPessoa && !temPeriodo, js(barra.itens));
    if (largura === 360) ok('em 360: só a busca e Filtros', !temPessoa && !temPeriodo && !/Quadro/.test(barra.itens.join(' ')), js(barra.itens));
  }
  await c.tamanho(1440, 900);
  await c.espera(300);
});

await passo('T03.01: os contadores aplicam um filtro visível, e seguem o recorte', async () => {
  const atrasadas = await numeroDoCartao('Atrasadas');
  const paraHoje = await numeroDoCartao('Para hoje');
  await clicarCartao('Atrasadas');
  await c.ate(`${noResumo('Atrasadas')}.getAttribute('aria-pressed')==='true'`);
  ok('o cartão virou etiqueta removível', js(await etiquetasDeFiltro()) === js(['Período: Atrasadas']), js(await etiquetasDeFiltro()));
  ok('o seletor de período mostra a mesma escolha, sem repetir', await c.avaliar(`${botaoNaLinha('Período')}.textContent.trim()==='Atrasadas'`));
  ok('o número do cartão é o que aparece', (await titulosNoQuadro()).length === atrasadas, `${atrasadas}`);
  ok('marcar um não zera o outro', (await numeroDoCartao('Para hoje')) === paraHoje);
  await clicarCartao('Para hoje');
  await c.ate(`${noResumo('Para hoje')}.getAttribute('aria-pressed')==='true'`);
  ok('trocar de cartão troca a seleção, e não acumula', js(await etiquetasDeFiltro()) === js(['Período: Hoje']), js(await etiquetasDeFiltro()));
  await c.avaliar(`document.querySelector('main button[aria-label="Remover filtro: Período: Hoje"]').click()`);
  await c.ate(`${noResumo('Para hoje')}.getAttribute('aria-pressed')==='false'`);
  ok('tirar a etiqueta limpa o cartão', (await etiquetasDeFiltro()).length === 0);
  await clicarCartao('Em andamento');
  await c.ate(`${noResumo('Em andamento')}.getAttribute('aria-pressed')==='true'`);
  ok('a situação vira etiqueta', js(await etiquetasDeFiltro()) === js(['Em andamento']));
  ok('o quadro fica só com ela', (await titulosNoQuadro()).length === (await numeroDoCartao('Em andamento')));
  await c.avaliar(`[...document.querySelectorAll('main button')].find(b=>b.textContent.trim()==='Limpar filtros').click()`);
  await c.ate(`${noResumo('Em andamento')}.getAttribute('aria-pressed')==='false'`);
});

await passo('T03.01: pessoa, num seletor só', async () => {
  await abrirMenu(botaoNaLinha('Pessoa'));
  await c.foto('filtro-pessoa-1440');
  await marcarPilula('Pessoa', 'Minhas');
  await c.ate(`${botaoNaLinha('Pessoa')}.textContent.trim()==='Minhas'`);
  ok('Considerar aparece: responsável × participante', await pilulaMarcada('Considerar', 'Responsável ou participante'));
  const comParticipante = (await titulosNoQuadro()).length;
  await marcarPilula('Considerar', 'Só responsável');
  await c.espera(200);
  const soResponsavel = (await titulosNoQuadro()).length;
  ok('só responsável reduz', soResponsavel <= comParticipante, `${comParticipante} → ${soResponsavel}`);
  await fecharMenu();
  ok('a etiqueta diz as duas coisas', (await etiquetasDeFiltro()).includes('Pessoa: Minhas (só responsável)'), js(await etiquetasDeFiltro()));
  ok('os contadores seguem o recorte e dizem qual', /Contagem com filtro: Minhas/.test(await texto('main')));
  await c.avaliar(`document.querySelector('main button[aria-label^="Remover filtro: Pessoa"]').click()`);
  await c.ate(`${botaoNaLinha('Pessoa')}.textContent.trim()==='Todas'`);
});

await passo('T03.01: filtros avançados, com a contagem no botão', async () => {
  await abrirFiltros();
  await c.foto('filtros-avancados-1440');
  const campos = await c.avaliar(`[...document.querySelectorAll('.menu-suspenso label[for], .menu-suspenso legend')].map(l=>l.textContent.trim())`);
  ok('área, tipo, prioridade, origem e etiqueta', js(campos) === js(['Área', 'Tipo', 'Prioridade', 'Origem do alerta', 'Etiqueta']), js(campos));
  await marcarPilula('Prioridade', 'Alta');
  await c.espera(150);
  await c.avaliar(`(()=>{const s=document.getElementById('filtro-tipo');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,'tarefa');s.dispatchEvent(new Event('change',{bubbles:true}))})()`);
  await c.espera(150);
  await fecharMenu();
  ok('o botão mostra quantos', (await botaoFiltros()) === 'Filtros (2)', await botaoFiltros());
  ok('viram etiquetas', js(await etiquetasDeFiltro()) === js(['Tipo: Tarefa', 'Prioridade: Alta']), js(await etiquetasDeFiltro()));
  await c.avaliar(`[...document.querySelectorAll('main button')].find(b=>b.textContent.trim()==='Limpar filtros').click()`);
  await c.ate(`[...document.querySelectorAll('main button')].some(b=>b.textContent.trim()==='Filtros')`);
  ok('"Limpar filtros" tira tudo', (await etiquetasDeFiltro()).length === 0);
});

await passo('T03.01: o contexto vem do seletor global', async () => {
  const antes = await numeroDoCartao('Para hoje');
  const ids = await c.avaliar(`JSON.parse(localStorage.getItem('numa-central:v1:produto')).find(p=>p.nome==='Kipi').id`);
  await c.avaliar(`(()=>{const k='numa-central:v1:meta';const m=JSON.parse(localStorage.getItem(k));m.contexto_id=${js(ids)};localStorage.setItem(k,JSON.stringify(m))})()`);
  await c.recarregar();
  await c.ate(`document.querySelector('main article')`);
  ok('nenhum filtro de contexto repetido na tela', !(await c.avaliar(`[...document.querySelectorAll('main legend, main label')].some(l=>l.textContent.startsWith('Contexto'))`)));
  ok('os contadores mostram o recorte', /Contagem com filtro: Kipi/.test(await texto('main')));
  const todas = (await tabela('atividade_produto')).filter((ligacao) => ligacao.produto_id === ids).map((ligacao) => ligacao.atividade_id);
  const noQuadro = await c.avaliar(`[...document.querySelectorAll('main article')].map(a=>a.dataset.atividade)`);
  ok('o quadro só tem o Kipi', noQuadro.length > 0 && noQuadro.every((id) => todas.includes(id)), `${noQuadro.length} de ${antes}`);
  await c.avaliar(`(()=>{const k='numa-central:v1:meta';const m=JSON.parse(localStorage.getItem(k));m.contexto_id='consolidada';localStorage.setItem(k,JSON.stringify(m))})()`);
  await c.recarregar();
  await c.ate(`document.querySelector('main article')`);
});

await passo('T03.01: concluir e adiar direto, no quadro', async () => {
  const alvo = 'Definir o preço da oferta anual';
  await c.ate(cartao(alvo));
  await c.avaliar(`${cartao(alvo)}.querySelector('[role=checkbox]').click()`);
  await esperarAviso('Atividade concluída.');
  ok('concluir não pede confirmação', !(await c.avaliar(`Boolean(document.querySelector('.dialogo'))`)));
  await c.avaliar(`[...document.querySelectorAll('[data-sonner-toast] button')].find(b=>b.textContent==='Desfazer').click()`);
  await c.ate(`${cartao(alvo)}&&!${cartao(alvo)}.textContent.includes('Concluída às')`);
  ok('o "Desfazer" volta como estava', (await tabela('atividade')).find((a) => a.titulo === alvo).situacao !== 'concluida');
  const antes = (await tabela('atividade')).find((a) => a.titulo === alvo);
  await abrirMenu(`${cartao(alvo)}.querySelector('button[aria-label^="Adiar"]')`);
  await c.foto('adiar-1440');
  await c.avaliar(`[...document.querySelectorAll('.menu-suspenso button')].find(b=>b.textContent.trim()==='+1 dia').click()`);
  await esperarAviso('Adiada para');
  ok('adiar não pede confirmação', !(await c.avaliar(`Boolean(document.querySelector('.dialogo'))`)));
  const depois = (await tabela('atividade')).find((a) => a.titulo === alvo);
  ok('o prazo andou', depois.prazo !== antes.prazo, `${antes.prazo} → ${depois.prazo}`);
  await c.avaliar(`[...document.querySelectorAll('[data-sonner-toast] button')].find(b=>b.textContent==='Desfazer').click()`);
  await c.ate(`JSON.parse(localStorage.getItem('numa-central:v1:atividade')).find(a=>a.titulo===${js(alvo)}).prazo===${js(antes.prazo)}`);
});

await passo('T03.01: concluir um alerta não faz a ação de origem', async () => {
  const alerta = (await tabela('atividade')).find((a) => a.tipo === 'alerta' && a.situacao === 'a_fazer');
  ok('há um alerta no quadro', Boolean(alerta), alerta?.titulo);
  await abrirMenu(`document.querySelector('[data-atividade=${js(alerta.id)}] button[aria-label^="Ações de"]')`);
  ok('o menu avisa', /Não paga nem renova/.test(await texto('.menu-suspenso')));
  await c.foto('menu-alerta-1440');
  await fecharMenu();
  await c.avaliar(`document.querySelector('[data-atividade=${js(alerta.id)}] [role=checkbox]').click()`);
  await esperarAviso('Alerta concluído. A ação de origem não foi feita.');
  await c.avaliar(`[...document.querySelectorAll('[data-sonner-toast]')].find(t=>t.textContent.includes('Alerta concluído')).querySelector('button').click()`);
  await c.ate(`JSON.parse(localStorage.getItem('numa-central:v1:atividade')).find(a=>a.id===${js(alerta.id)}).situacao==='a_fazer'`);
});

await passo('T03.01: a lista', async () => {
  await c.avaliar(`[...document.querySelectorAll('main button')].find(b=>b.textContent.trim()==='Lista').click()`);
  await c.ate(`document.querySelector('main table')`);
  ok('"Agrupar por" só na lista', await c.avaliar(`Boolean(${botaoNaLinha('Agrupar por')})`));
  const colunas = await c.avaliar(`[...document.querySelectorAll('main thead th')].filter(t=>getComputedStyle(t).display!=='none').map(t=>t.textContent.trim())`);
  ok('as colunas do protótipo', js(colunas.filter(Boolean)) === js(['Atividade', 'Responsável', 'Contexto', 'Prazo', 'Prioridade', 'Situação', 'Ações']), js(colunas));
  ok('conclui na linha', await c.avaliar(`Boolean(document.querySelector('main tbody tr [role=checkbox]'))`));
  ok('adia na linha', await c.avaliar(`Boolean(document.querySelector('main tbody tr button[aria-label^="Adiar"]'))`));
  await c.foto('lista-1440-topo');
  const rodape = await texto('main tfoot');
  ok('o rodapé conta o recorte', /\d+ atividades · \d+ abertas · \d+ concluídas? hoje/.test(rodape), rodape);
  for (const largura of LARGURAS) {
    await c.tamanho(largura, largura < 768 ? 800 : 900);
    await c.espera(350);
    await c.foto(`meu-dia-lista-${largura}`, { inteira: largura === 360 });
    await conferirTela('Meu dia, lista', largura);
    if (largura >= 768) {
      const rola = await c.avaliar(`(()=>{const t=document.querySelector('main table').parentElement;return t.scrollWidth-t.clientWidth})()`);
      ok(`a tabela cabe em ${largura}px`, rola <= 1, rola);
      ok(`concluir e adiar à vista em ${largura}px`, await c.avaliar(`(()=>{const l=document.querySelector('main tbody tr');const t=document.querySelector('main table').parentElement.getBoundingClientRect();const a=l.querySelector('button[aria-label^="Adiar"]').getBoundingClientRect();const k=l.querySelector('[role=checkbox]').getBoundingClientRect();return a.right<=t.right&&k.left>=t.left})()`));
      ok(`o prazo aparece em ${largura}px`, await c.avaliar(`/Atrasada|Hoje|Sem prazo|Amanhã/.test(document.querySelector('main tbody').innerText)`));
    }
  }
  await c.tamanho(1440, 900);
  await c.espera(300);
  const alvoId = (await tabela('atividade')).find((a) => a.titulo === 'Definir o preço da oferta anual').id;
  const linhaAberta = `[...document.querySelectorAll('main tbody tr')].find(l=>l.textContent.includes('Definir o preço da oferta anual'))`;
  await c.avaliar(`${linhaAberta}.querySelector('[role=checkbox]').click()`);
  await esperarAviso('Atividade concluída.');
  ok('marcar na linha não abre a janela', !(await c.avaliar(`Boolean(document.querySelector('.janela'))`)));
  await c.avaliar(`[...document.querySelectorAll('[data-sonner-toast] button')].find(b=>b.textContent==='Desfazer').click()`);
  await c.ate(`JSON.parse(localStorage.getItem('numa-central:v1:atividade')).find(a=>a.id===${js(alvoId)}).situacao!=='concluida'`);
  await abrirMenu(botaoNaLinha('Agrupar por'));
  await marcarPilula('Agrupar por', 'Prazo');
  await c.ate(`!document.querySelector('.menu-suspenso')`);
  await c.espera(250);
  ok('agrupa', await c.avaliar(`[...document.querySelectorAll('main section h2')].some(t=>t.textContent.startsWith('Atrasadas'))`));
  await abrirMenu(botaoNaLinha('Agrupar por'));
  await marcarPilula('Agrupar por', 'Nenhum');
  await c.ate(`!document.querySelector('.menu-suspenso')`);
  await c.espera(250);
  await c.avaliar(`[...document.querySelectorAll('main button')].find(b=>b.textContent.trim()==='Quadro').click()`);
  await c.ate(`document.querySelector('main article')`);
  ok('no quadro, "Agrupar por" some', !(await c.avaliar(`Boolean(${botaoNaLinha('Agrupar por')})`)));
});

await passo('T03.01: celular, busca e Filtros, com o resto na folha', async () => {
  await c.tamanho(360, 800);
  await c.espera(350);
  await c.ate(`[...document.querySelectorAll('main button')].some(b=>/^Filtros/.test(b.textContent.trim()))`);
  await abrirFiltros();
  await c.foto('filtros-folha-360', { inteira: false });
  await conferirTela('Folha de filtros', 360);
  const grupos = await c.avaliar(`[...document.querySelectorAll('.dialogo legend, .dialogo label[for]')].map(l=>l.textContent.trim())`);
  ok('a folha traz o resto', ['Visão', 'Pessoa', 'Período', 'Área', 'Tipo', 'Prioridade', 'Origem do alerta', 'Etiqueta'].every((nome) => grupos.includes(nome)), js(grupos));
  ok('Aplicar e Limpar', await c.avaliar(`['Aplicar','Limpar'].every(r=>[...document.querySelectorAll('.dialogo button')].some(b=>b.textContent.trim()===r))`));
  const antes = (await titulosNoQuadro()).length;
  await marcarPilula('Período', 'Atrasadas');
  await c.espera(200);
  ok('sem Aplicar, a tela não muda', (await titulosNoQuadro()).length === antes);
  await c.avaliar(`[...document.querySelectorAll('.dialogo button')].find(b=>b.textContent.trim()==='Aplicar').click()`);
  await c.ate(`!document.querySelector('.dialogo')`);
  await c.espera(280);
  ok('aplicou', (await botaoFiltros()) === 'Filtros (1)', await botaoFiltros());
  ok('virou etiqueta', js(await etiquetasDeFiltro()) === js(['Período: Atrasadas']));
  await abrirFiltros();
  await c.avaliar(`[...document.querySelectorAll('.dialogo button')].find(b=>b.textContent.trim()==='Limpar').click()`);
  await c.ate(`!document.querySelector('.dialogo')`);
  await c.espera(280);
  ok('limpou', (await botaoFiltros()) === 'Filtros');
  await c.tamanho(1440, 900);
  await c.espera(300);
});

// ---------- T03.02: a janela da atividade ----------

const corpoDaJanela = `document.querySelector('.janela [role=tabpanel]:not([hidden])').parentElement`;
const abaDaJanela = (rotulo) => `[...document.querySelectorAll('.janela [role=tab]')].find(a=>a.textContent.startsWith(${js(rotulo)}))`;
const irParaAba = async (rotulo) => {
  await c.avaliar(`(()=>{const a=${abaDaJanela(rotulo)};a.focus();a.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}))})()`);
  await c.ate(`${abaDaJanela(rotulo)}.getAttribute('data-state')==='active'`);
};
const abrirAtividade = async (titulo) => {
  const alvo = (await tabela('atividade')).find((a) => a.titulo === titulo);
  await ir(`/meu-dia?atividade=${alvo.id}`);
  await painelAberto();
  await c.ate(`document.querySelector('.janela [role=tab]')`);
  await c.espera(450);
  return alvo;
};
const botaoDaJanela = (rotulo) => `[...document.querySelectorAll('.janela button')].find(b=>b.textContent.trim()===${js(rotulo)})`;
const preencherCampo = (id, valor) => h.preencher(id, valor);

await passo('T03.02: janela central, com o essencial sem rolar', async () => {
  await abrirAtividade('Definir o preço da oferta anual');
  const m = await c.avaliar(`(()=>{const b=document.querySelector('.janela').getBoundingClientRect();return {x:Math.round(b.left),d:Math.round(innerWidth-b.right),t:Math.round(b.top),u:Math.round(innerHeight-b.bottom),l:Math.round(b.width)}})()`);
  ok('no centro', Math.abs(m.x - m.d) <= 1 && Math.abs(m.t - m.u) <= 1, js(m));
  const abas = await c.avaliar(`[...document.querySelectorAll('.janela [role=tab]')].map(a=>a.textContent.replace(/\\d+/g,'').trim())`);
  ok('as seis abas do protótipo', js(abas) === js(['Geral', 'Checklist', 'Agendamento', 'Vínculos e arquivos', 'Comentários', 'Histórico']), js(abas));
  const rola = await c.avaliar(`(()=>{const e=${corpoDaJanela};return e.scrollHeight-e.clientHeight})()`);
  ok('Geral sem rolar', rola <= 0, rola);
  await c.foto('janela-geral-1440');
  ok('sem mudar nada, salvar fica desligado', await c.avaliar(`${botaoDaJanela('Salvar alterações')}.disabled`));
  ok('o título tem o lápis', await c.avaliar(`Boolean(document.querySelector('.janela button[aria-label="Editar o título"]'))`));
  for (const aba of ['Checklist', 'Agendamento', 'Vínculos e arquivos', 'Comentários', 'Histórico']) {
    await irParaAba(aba);
    await c.espera(150);
    await c.foto(`janela-${aba.split(' ')[0].toLowerCase()}-1440`);
    await conferirTela(`Janela, ${aba}`, 1440);
  }
  await conferirTela('Janela', 1440);
});

await passo('T03.02: salvar alterações, com o prazo anterior no histórico (CA-03.05)', async () => {
  const alvo = await abrirAtividade('Definir o preço da oferta anual');
  await preencherCampo('painel-prazo', '2026-12-20');
  await c.ate(`document.querySelector('.janela [role=status]').textContent==='Alterações não salvas'`);
  ok('avisa e liga o botão', !(await c.avaliar(`${botaoDaJanela('Salvar alterações')}.disabled`)));
  ok('ainda não gravou', (await tabela('atividade')).find((a) => a.id === alvo.id).prazo === alvo.prazo);
  await c.avaliar(`document.querySelector('.janela button[aria-label="Editar o título"]').click()`);
  await c.ate(`document.getElementById('painel-titulo')`);
  await preencherCampo('painel-titulo', 'Definir o preço anual');
  await c.avaliar(`document.getElementById('painel-titulo').blur()`);
  await c.espera(100);
  await c.avaliar(`${botaoDaJanela('Salvar alterações')}.click()`);
  await esperarAviso('Alterações salvas.');
  await painelFechado();
  const depois = (await tabela('atividade')).find((a) => a.id === alvo.id);
  ok('gravou tudo de uma vez', depois.prazo === '2026-12-20' && depois.titulo === 'Definir o preço anual', `${depois.prazo} ${depois.titulo}`);
  ok('passar para depois conta como adiamento', depois.adiamentos === alvo.adiamentos + 1);
  await c.ate(cartao('Definir o preço anual'));
  ok('o cartão muda sem recarregar', /20\/12/.test(await c.avaliar(`${cartao('Definir o preço anual')}.textContent`)));
  await c.avaliar(`[...document.querySelectorAll('main article h3 button')].find(b=>b.textContent==='Definir o preço anual').click()`);
  await painelAberto();
  await c.ate(`document.querySelector('.janela [role=tab]')`);
  await irParaAba('Histórico');
  await c.ate(`/Prazo: de /.test(document.querySelector('.janela').textContent)`);
  ok('o histórico guarda a data anterior', /para 20\/12\/2026/.test(await texto('.janela')));
  await c.avaliar(`document.querySelector('.janela button[aria-label="Fechar"]').click()`);
  await painelFechado();
});

await passo('T03.02: fechar com alteração pendente pergunta; desfazer a edição não', async () => {
  const alvo = await abrirAtividade('Definir o preço anual');
  await preencherCampo('painel-descricao', 'Um texto novo');
  await c.ate(`document.querySelector('.janela [role=status]').textContent==='Alterações não salvas'`);
  await c.avaliar(`${botaoDaJanela('Cancelar')}.click()`);
  await c.ate(`document.querySelector('.dialogo')?.textContent.includes('Descartar as alterações?')`);
  ok('pergunta antes de descartar', true);
  await c.avaliar(`[...document.querySelectorAll('.dialogo button')].find(b=>b.textContent.trim()==='Descartar alterações').click()`);
  await painelFechado();
  ok('não gravou', (await tabela('atividade')).find((a) => a.id === alvo.id).descricao !== 'Um texto novo');
  await abrirAtividade('Definir o preço anual');
  await c.avaliar(`document.querySelector('.janela button[aria-label="Fechar"]').click()`);
  await painelFechado();
  ok('sem alteração, fecha direto', true);
});

await passo('T03.02: erro leva até o campo e à aba dele', async () => {
  const alvo = await abrirAtividade('Definir o preço anual');
  await irParaAba('Agendamento');
  await preencherCampo('painel-inicio', '2027-05-01');
  await irParaAba('Geral');
  await c.avaliar(`${botaoDaJanela('Salvar alterações')}.click()`);
  await c.ate(`${abaDaJanela('Agendamento')}.getAttribute('data-state')==='active'`);
  ok('o erro aparece no campo', (await h.erroDe('painel-inicio')).includes('O início precisa ser antes do prazo.'));
  ok('o foco vai para ele', await c.ate(`document.activeElement?.id==='painel-inicio'`).then(() => true));
  ok('não gravou', (await tabela('atividade')).find((a) => a.id === alvo.id).inicio === alvo.inicio);
  await c.avaliar(`document.querySelector('.janela button[aria-label="Fechar"]').click()`);
  await c.ate(`document.querySelector('.dialogo')`);
  await c.espera(280);
  await c.avaliar(`[...document.querySelectorAll('.dialogo button')].find(b=>b.textContent.trim()==='Descartar alterações').click()`);
  await painelFechado();
});

await passo('T03.02: comentário por enviar sobrevive à troca de aba e pergunta ao fechar', async () => {
  await abrirAtividade('Definir o preço anual');
  await irParaAba('Comentários');
  await preencherCampo('painel-comentario', 'Um comentário por enviar');
  await irParaAba('Geral');
  await irParaAba('Comentários');
  ok('o texto continua lá', (await h.valor('painel-comentario')) === 'Um comentário por enviar');
  await c.avaliar(`document.querySelector('.janela button[aria-label="Fechar"]').click()`);
  await c.ate(`document.querySelector('.dialogo')?.textContent.includes('Descartar o comentário?')`);
  ok('pergunta antes de perder o comentário', true);
  await c.avaliar(`[...document.querySelectorAll('.dialogo button')].find(b=>b.textContent.trim()==='Descartar comentário').click()`);
  await painelFechado();
});

await passo('T03.02: rotina pergunta ao salvar, e a data vale só para a ocorrência (RN-03.17)', async () => {
  await ir('/configuracoes/dados');
  await c.ate(`[...document.querySelectorAll('main button')].some(b=>b.textContent.trim()==='Rodar rotinas agora')`);
  await c.espera(800);
  await c.avaliar(`[...document.querySelectorAll('main button')].find(b=>b.textContent.trim()==='Rodar rotinas agora').click()`);
  await c.ate(`JSON.parse(localStorage.getItem('numa-central:v1:atividade')).some(a=>a.recorrencia_id&&a.situacao==='a_fazer')`);
  const ocorrencia = (await tabela('atividade')).find((a) => a.recorrencia_id && a.situacao === 'a_fazer');
  await ir(`/meu-dia?atividade=${ocorrencia.id}`);
  await painelAberto();
  await c.ate(`document.querySelector('.janela [role=tab]')`);
  await c.espera(450);
  await preencherCampo('painel-prazo', '2027-02-10');
  await c.ate(`!${botaoDaJanela('Salvar alterações')}.disabled`);
  await c.avaliar(`${botaoDaJanela('Salvar alterações')}.click()`);
  await esperarAviso('Alterações salvas.');
  await painelFechado();
  const depois = (await tabela('atividade')).find((a) => a.id === ocorrencia.id);
  ok('a data não pergunta, e fica só nesta', depois.prazo === '2027-02-10' && depois.editada_individualmente === true);
  await ir(`/meu-dia?atividade=${ocorrencia.id}`);
  await painelAberto();
  await c.ate(`document.querySelector('.janela [role=tab]')`);
  await c.espera(450);
  await preencherCampo('painel-descricao', 'Só nesta ocorrência');
  await c.ate(`!${botaoDaJanela('Salvar alterações')}.disabled`);
  await c.avaliar(`${botaoDaJanela('Salvar alterações')}.click()`);
  await c.ate(`document.querySelector('.dialogo')?.textContent.includes('Esta atividade faz parte de uma rotina')`);
  await c.foto('janela-escopo-1440');
  ok('o campo da rotina pergunta', true);
  await c.avaliar(`[...document.querySelectorAll('.dialogo button')].find(b=>b.textContent.trim()==='Somente esta').click()`);
  await esperarAviso('Alterações salvas.');
  await painelFechado();
  ok('gravou só nela', (await tabela('atividade')).find((a) => a.id === ocorrencia.id).descricao === 'Só nesta ocorrência');
});

await passo('T03.02: alerta, com o efeito de cada ação à vista', async () => {
  const alerta = (await tabela('atividade')).find((a) => a.tipo === 'alerta' && a.situacao === 'a_fazer');
  await ir(`/meu-dia?atividade=${alerta.id}`);
  await painelAberto();
  await c.ate(`document.querySelector('.janela [data-alerta]')`);
  await c.espera(450);
  const textoDoAlerta = await texto('.janela [data-alerta]');
  ok('avisa o que concluir e dispensar não fazem', /Concluir aqui não executa a ação de origem/.test(textoDoAlerta) && /Dispensar pede um motivo/.test(textoDoAlerta), textoDoAlerta);
  ok('o botão da ação', await c.avaliar(`Boolean([...document.querySelectorAll('.janela [data-alerta] a')].length)`));
  ok('concluir diz que é o alerta', await c.avaliar(`Boolean(${botaoDaJanela('Concluir alerta')})`));
  ok('sem Agendamento', !(await c.avaliar(`Boolean(${abaDaJanela('Agendamento')})`)));
  ok('título sem lápis', !(await c.avaliar(`Boolean(document.querySelector('.janela button[aria-label="Editar o título"]'))`)));
  await c.foto('janela-alerta-1440');
  await c.avaliar(`document.querySelector('.janela button[aria-label="Fechar"]').click()`);
  await painelFechado();
});

await passo('T03.02: no celular, tela inteira', async () => {
  await c.tamanho(360, 800);
  await abrirAtividade('Definir o preço anual');
  const m = await c.avaliar(`(()=>{const b=document.querySelector('.janela').getBoundingClientRect();return {l:Math.round(b.width),a:Math.round(b.height)}})()`);
  ok('tela inteira', m.l === 360 && m.a === 800, js(m));
  ok('Voltar no topo', await c.avaliar(`Boolean(document.querySelector('.janela button[aria-label="Voltar"]'))`));
  ok('concluir embaixo', await c.avaliar(`Boolean(${botaoDaJanela('Concluir atividade')})`));
  await conferirTela('Janela', 360);
  await c.foto('janela-geral-360');
  await preencherCampo('painel-descricao', 'Teste no celular');
  await c.ate(`${botaoDaJanela('Salvar alterações')}&&!${botaoDaJanela('Salvar alterações')}.disabled`);
  ok('com alteração, salvar e cancelar embaixo', await c.avaliar(`Boolean(${botaoDaJanela('Cancelar')})`));
  await c.foto('janela-editando-360');
  await irParaAba('Comentários');
  await c.espera(150);
  await conferirTela('Janela, comentários', 360);
  await c.avaliar(`document.querySelector('.janela button[aria-label="Voltar"]').click()`);
  await c.ate(`document.querySelector('.dialogo')`);
  await c.espera(280);
  await c.avaliar(`[...document.querySelectorAll('.dialogo button')].find(b=>b.textContent.trim()==='Descartar alterações').click()`);
  await painelFechado();
  await c.tamanho(1440, 900);
  await c.espera(300);
});

// ---------- T03.03: Nova atividade ----------

const abrirAdicionar = async (tipo) => {
  await c.avaliar(`[...document.querySelectorAll('main button')].find(b=>b.textContent.trim()==='Adicionar').click()`);
  await c.ate(`document.querySelector('.menu-suspenso,.dialogo')`);
  await c.espera(280);
  await c.avaliar(`[...document.querySelectorAll('.menu-suspenso button,.dialogo button')].find(b=>b.textContent.trim()===${js(tipo)}).click()`);
  await painelAberto();
  await c.espera(450);
};
const fechaSemSalvar = async () => {
  await c.avaliar(`document.querySelector('.janela button[aria-label="Fechar"],.janela button[aria-label="Voltar"]').click()`);
  await c.espera(150);
  const perguntou = await c.avaliar(`Boolean(document.querySelector('.dialogo'))`);
  if (perguntou) await c.avaliar(`[...document.querySelectorAll('.dialogo button')].find(b=>b.textContent.trim()==='Descartar alterações').click()`);
  await painelFechado();
};
const obrigatoriosNaJanela = () => c.avaliar(`[...document.querySelectorAll('.janela label,.janela legend')].filter(l=>l.textContent.trim().endsWith('*')&&!l.classList.contains('sr-only')).map(l=>l.textContent.replace('*','').trim())`);
const rolaNoCorpo = () => c.avaliar(`(()=>{const e=[...document.querySelectorAll('.janela form > div')].find(d=>getComputedStyle(d).overflowY==='auto');return e.scrollHeight-e.clientHeight})()`);

await passo('T03.03: as três variantes, sem rolar', async () => {
  await ir('/meu-dia');
  await c.ate(`document.querySelector('main article')`);
  await c.espera(900);
  await abrirAdicionar('Tarefa');
  ok('título do protótipo', /Nova atividade/.test(await texto('.janela')) && /Registre o próximo passo/.test(await texto('.janela')));
  ok('tarefa: título e responsável', js(await obrigatoriosNaJanela()) === js(['Título', 'Responsável']), js(await obrigatoriosNaJanela()));
  ok('tarefa: sem rolar', (await rolaNoCorpo()) <= 0, await rolaNoCorpo());
  ok('o foco no título', await c.avaliar(`document.activeElement?.id==='atividade-titulo'`));
  ok('o responsável sugerido é a pessoa atual', (await h.valor('atividade-responsavel')) === ID_KIMBERLY);
  await conferirTela('Nova tarefa', 1440);
  await c.foto('adicionar-tarefa-1440');
  await marcarPilula('Tipo', 'Demanda');
  await c.ate(`document.getElementById('atividade-solicitante')`);
  await c.espera(150);
  ok('demanda: + solicitante', js(await obrigatoriosNaJanela()) === js(['Título', 'Solicitante', 'Responsável']), js(await obrigatoriosNaJanela()));
  ok('demanda: resultado esperado, opcional, à vista', /Resultado esperado/.test(await texto('.janela')));
  ok('demanda: sem rolar', (await rolaNoCorpo()) <= 0, await rolaNoCorpo());
  await conferirTela('Nova demanda', 1440);
  await c.foto('adicionar-demanda-1440');
  await marcarPilula('Tipo', 'Lembrete');
  await c.ate(`document.getElementById('atividade-aviso-dia')`);
  await c.espera(150);
  ok('lembrete: data e hora do aviso', js(await obrigatoriosNaJanela()) === js(['Título', 'Responsável', 'Data do aviso', 'Hora do aviso']), js(await obrigatoriosNaJanela()));
  ok('lembrete: sem prazo separado', !(await c.avaliar(`Boolean(document.getElementById('atividade-prazo'))`)));
  ok('lembrete: sem rolar', (await rolaNoCorpo()) <= 0, await rolaNoCorpo());
  ok('lembrete: o botão diz o que salva', await c.avaliar(`[...document.querySelectorAll('.janela button')].some(b=>b.textContent.trim()==='Salvar lembrete')`));
  await conferirTela('Novo lembrete', 1440);
  await c.foto('adicionar-lembrete-1440');
  await c.avaliar(`[...document.querySelectorAll('.janela button')].find(b=>b.textContent.trim()==='Salvar lembrete').click()`);
  await c.ate(`document.getElementById('atividade-aviso-dia-erro')`);
  ok('lembrete sem data é barrado no campo (CA-03.06)', (await h.erroDe('atividade-aviso-dia')).includes('Informe a data do aviso.'));
  await fechaSemSalvar();
});

await passo('T03.03: "Mais opções", o prazo e a sugestão pela área', async () => {
  await abrirAdicionar('Tarefa');
  await c.avaliar(`[...document.querySelectorAll('.janela button[role=group] button,.janela [role=group] button')].find(b=>b.textContent.trim()==='Amanhã').click()`);
  await c.espera(100);
  ok('o atalho preenche o prazo', Boolean(await h.valor('atividade-prazo')));
  ok('e fica marcado', await c.avaliar(`[...document.querySelectorAll('.janela [role=group] button')].find(b=>b.textContent.trim()==='Amanhã').getAttribute('aria-pressed')==='true'`));
  await c.avaliar(`[...document.querySelectorAll('.janela [role=group] button')].find(b=>b.textContent.trim()==='Amanhã').click()`);
  await c.espera(100);
  ok('clicar de novo tira: sem data, fica sem prazo', (await h.valor('atividade-prazo')) === '');
  await c.avaliar(`[...document.querySelectorAll('.janela button')].find(b=>b.textContent.startsWith('Mais opções')).click()`);
  await c.ate(`document.getElementById('atividade-area')`);
  await c.espera(150);
  await c.foto('adicionar-mais-opcoes-1440');
  const area = (await tabela('area')).find((item) => !item.compartilhada && item.responsavel_padrao_id && item.responsavel_padrao_id !== (0, 0));
  const compartilhada = (await tabela('area')).find((item) => item.compartilhada);
  h.escolher('atividade-area', area.id);
  await c.espera(150);
  ok('a área sugere a responsável (RN-03.02)', (await h.valor('atividade-responsavel')) === area.responsavel_padrao_id, area.nome);
  h.escolher('atividade-responsavel', (await tabela('pessoa')).find((pessoa) => pessoa.nome_completo === 'Camila Lima').id);
  await c.espera(150);
  ok('e a sugestão é editável', (await h.valor('atividade-responsavel')) === (await tabela('pessoa')).find((pessoa) => pessoa.nome_completo === 'Camila Lima').id);
  h.escolher('atividade-area', compartilhada.id);
  await c.espera(150);
  ok('área compartilhada pede a escolha', (await h.valor('atividade-responsavel')) === '' && /Esta área é compartilhada/.test(await texto('.janela')));
  await fechaSemSalvar();
});

await passo('T03.03: "Salvar e adicionar outro" mantém tipo, contexto e responsável (CA-03.07)', async () => {
  await abrirAdicionar('Demanda');
  const camila = (await tabela('pessoa')).find((pessoa) => pessoa.nome_completo === 'Camila Lima').id;
  await h.preencher('atividade-titulo', 'Primeira demanda da revisão');
  h.escolher('atividade-responsavel', camila);
  await c.avaliar(`document.getElementById('atividade-contexto').click()`);
  await c.ate(`[...document.querySelectorAll('.menu-suspenso label')].some(l=>l.textContent.includes('Kipi'))`);
  await c.espera(250);
  await c.avaliar(`[...document.querySelectorAll('.menu-suspenso label')].find(l=>l.textContent.includes('Kipi')).querySelector('input').click()`);
  await c.espera(100);
  await c.tecla('Escape');
  await c.ate(`!document.querySelector('.menu-suspenso')`);
  await c.espera(200);
  await c.avaliar(`[...document.querySelectorAll('.janela button')].find(b=>b.textContent.trim()==='Salvar e adicionar outro').click()`);
  await esperarAviso('Demanda criada.');
  await c.ate(`document.getElementById('atividade-titulo').value===''`);
  ok('continua demanda', await pilulaMarcada('Tipo', 'Demanda'));
  ok('continua com a responsável', (await h.valor('atividade-responsavel')) === camila);
  ok('continua com o contexto', /Kipi/.test(await texto('.janela')));
  ok('limpou o título, com o foco nele', await c.ate(`document.activeElement?.id==='atividade-titulo'`).then(() => true));
  await fechaSemSalvar();
});

await passo('T03.03: no celular, tela inteira, sem folha', async () => {
  await c.tamanho(360, 800);
  await c.espera(300);
  await abrirAdicionar('Lembrete');
  const m = await c.avaliar(`(()=>{const b=document.querySelector('.janela').getBoundingClientRect();return {l:Math.round(b.width),a:Math.round(b.height)}})()`);
  ok('tela inteira', m.l === 360 && m.a === 800, js(m));
  await conferirTela('Novo lembrete', 360);
  await c.foto('adicionar-lembrete-360');
  await marcarPilula('Tipo', 'Demanda');
  await c.espera(200);
  await conferirTela('Nova demanda', 360);
  await c.foto('adicionar-demanda-360');
  await fechaSemSalvar();
  await c.tamanho(1440, 900);
  await c.espera(300);
});

await terminar();
