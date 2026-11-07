// Revisão do M03 (T03.01 a T03.06): protótipos aprovados e as orientações de Kimberly de 06/11/2026.
// Meu dia em 1440, 1024, 768 e 360; as outras telas em 1440 e 360.
import { iniciar } from './apoio.mjs';

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

await terminar();
