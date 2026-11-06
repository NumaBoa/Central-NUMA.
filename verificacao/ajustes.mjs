// Verificação dos ajustes da F0a pedidos por Kimberly em 06/11/2026: etiquetas em Atividades e Ferramentas,
// e os atalhos do campo de data.
import { iniciar } from './apoio.mjs';

const h = await iniciar({ nome: 'ajustes', porta: 9366 });
const { c, ok, passo, ir, texto, valor, marcarPilula, pilulaMarcada, painelAberto, pularAbertura, tabela, conferirTela, terminar } = h;

const js = (v) => JSON.stringify(v);
const agora = new Date().toISOString();
const ETIQUETAS = [
  { id: 'e1000000-0000-4000-8000-0000000000a1', nome: 'Lançamento', cor: '#4F52D9', modulos: [] },
  { id: 'e1000000-0000-4000-8000-0000000000a2', nome: 'Revisar no trimestre', cor: '#D9962B', modulos: ['ferramentas'] },
  { id: 'e1000000-0000-4000-8000-0000000000a3', nome: 'Só do financeiro', cor: '#4E9A72', modulos: ['financeiro'] },
];
const linha = (etiqueta) => ({ criado_em: agora, criado_por: null, atualizado_em: agora, atualizado_por: null, arquivado_em: null, arquivado_por: null, versao_registro: 1, exemplo: false, ...etiqueta });
const cartao = (titulo) => `[...document.querySelectorAll('main article')].find(a=>a.querySelector('h3')?.textContent===${js(titulo)})`;
const titulosNoQuadro = () => c.avaliar(`[...document.querySelectorAll('main article h3')].map(h=>h.textContent)`);
const abrirFiltros = async () => {
  await c.avaliar(`[...document.querySelectorAll('main button')].find(b=>/^Filtros/.test(b.textContent.trim())).click()`);
  await c.ate(`document.querySelector('.menu-suspenso')`);
  await c.espera(150);
};
const fecharMenu = async () => {
  await c.tecla('Escape');
  await c.ate(`!document.querySelector('.menu-suspenso')`);
  await c.espera(150);
};
const escolherNoSelect = (id, novo) => c.avaliar(`(()=>{const s=document.getElementById(${js(id)});Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,${js(novo)});s.dispatchEvent(new Event('change',{bubbles:true}))})()`);
const vinculos = async (tipo, id) => (await tabela('etiqueta_vinculo')).filter((v) => v.registro_tipo === tipo && v.registro_id === id && !v.arquivado_em).map((v) => v.etiqueta_id);

await c.tamanho(1440, 900);

await passo('sem etiquetas cadastradas, o campo diz o caminho', async () => {
  await ir('/meu-dia');
  await pularAbertura();
  await c.ate(`document.querySelector('main article')`);
  const atividade = (await tabela('atividade')).find((a) => a.titulo === 'Definir o preço da oferta anual');
  await ir(`/meu-dia?atividade=${atividade.id}`);
  await painelAberto();
  await c.ate(`document.querySelector('.painel-lateral')?.textContent.includes('Ainda não há etiquetas para este módulo.')`);
  ok('o painel explica e leva ao cadastro', await c.avaliar(`Boolean(document.querySelector('.painel-lateral a[href="/configuracoes/cadastros/etiquetas"]'))`));
});

await passo('cadastra as etiquetas', async () => {
  await c.avaliar(`localStorage.setItem('numa-central:v1:etiqueta',JSON.stringify(${js(ETIQUETAS.map(linha))}))`);
  ok('três etiquetas, uma só do financeiro', (await tabela('etiqueta')).length === 3);
});

await passo('atividade: o campo no painel', async () => {
  const atividade = (await tabela('atividade')).find((a) => a.titulo === 'Definir o preço da oferta anual');
  await ir(`/meu-dia?atividade=${atividade.id}`);
  await painelAberto();
  await c.ate(`[...document.querySelectorAll('.painel-lateral legend')].some(l=>l.textContent.startsWith('Etiquetas'))`);
  await c.espera(200);
  const opcoes = await c.avaliar(`[...[...document.querySelectorAll('.painel-lateral fieldset')].find(f=>f.querySelector('legend').textContent.startsWith('Etiquetas')).querySelectorAll('label')].map(l=>l.textContent)`);
  ok('só as do módulo: a do financeiro e a das ferramentas ficam de fora', js(opcoes) === js(['Lançamento']), js(opcoes));
  await marcarPilula('Etiquetas', 'Lançamento');
  await c.ate(`JSON.parse(localStorage.getItem('numa-central:v1:etiqueta_vinculo')).some(v=>v.registro_id===${js(atividade.id)}&&!v.arquivado_em)`);
  ok('marcar salva na hora, como o resto do painel', js(await vinculos('atividade', atividade.id)) === js([ETIQUETAS[0].id]));
  await c.espera(200);
  ok('a pílula fica marcada', await pilulaMarcada('Etiquetas', 'Lançamento'));
  await c.foto('a-painel-etiquetas');
  await c.tecla('Escape');
  await c.espera(300);
});

await passo('atividade: no cartão e no filtro do Meu dia', async () => {
  await ir('/meu-dia');
  await c.ate(`document.querySelector('main article')`);
  await c.espera(300);
  ok('o cartão mostra a etiqueta', (await c.avaliar(`(${cartao('Definir o preço da oferta anual')})?.textContent ?? ''`)).includes('Lançamento'));
  const antes = (await titulosNoQuadro()).length;
  await abrirFiltros();
  await escolherNoSelect('filtro-etiqueta', ETIQUETAS[0].id);
  await fecharMenu();
  const depois = await titulosNoQuadro();
  ok('filtrar por etiqueta deixa só a atividade marcada', js(depois) === js(['Definir o preço da oferta anual']) && antes > 1, `${antes} → ${js(depois)}`);
  ok('o filtro aparece entre os ativos, para tirar', (await texto('main')).includes('Etiqueta: Lançamento'));
  await c.foto('b-meu-dia-filtro');
  await c.avaliar(`[...document.querySelectorAll('main button')].find(b=>b.textContent.trim()==='Limpar filtros')?.click()`);
  await c.espera(300);
  ok('limpar volta tudo', (await titulosNoQuadro()).length === antes);
});

await passo('ferramenta: o campo na ficha', async () => {
  const traco = (await tabela('ferramenta')).find((f) => f.nome === 'Traço Editor');
  await ir(`/ferramentas/${traco.id}`);
  await c.ate(`document.querySelector('main h1')?.textContent.includes('Traço Editor')`);
  await c.ate(`[...document.querySelectorAll('main legend')].some(l=>l.textContent.startsWith('Etiquetas'))`);
  await c.espera(200);
  const opcoes = await c.avaliar(`[...[...document.querySelectorAll('main fieldset')].find(f=>f.querySelector('legend').textContent.startsWith('Etiquetas')).querySelectorAll('label')].map(l=>l.textContent)`);
  ok('as de todos os módulos e as das ferramentas', js(opcoes) === js(['Lançamento', 'Revisar no trimestre']), js(opcoes));
  await marcarPilula('Etiquetas', 'Revisar no trimestre');
  await c.ate(`JSON.parse(localStorage.getItem('numa-central:v1:etiqueta_vinculo')).some(v=>v.registro_id===${js(traco.id)}&&!v.arquivado_em)`);
  ok('marcar salva na hora', js(await vinculos('ferramenta', traco.id)) === js([ETIQUETAS[1].id]));
  await c.foto('c-ficha-etiquetas');
  const quadro = (await tabela('ferramenta')).find((f) => f.situacao === 'avaliacao');
  await ir(`/ferramentas/${quadro.id}`);
  await c.ate(`[...document.querySelectorAll('main legend')].some(l=>l.textContent.startsWith('Etiquetas'))`);
  await c.espera(200);
  await marcarPilula('Etiquetas', 'Lançamento');
  await c.ate(`JSON.parse(localStorage.getItem('numa-central:v1:etiqueta_vinculo')).some(v=>v.registro_id===${js(quadro.id)}&&!v.arquivado_em)`);
  await marcarPilula('Etiquetas', 'Lançamento');
  await c.ate(`!JSON.parse(localStorage.getItem('numa-central:v1:etiqueta_vinculo')).some(v=>v.registro_id===${js(quadro.id)}&&!v.arquivado_em)`);
  ok('desmarcar tira', (await vinculos('ferramenta', quadro.id)).length === 0);
});

await passo('ferramenta: filtro e coluna na lista', async () => {
  await ir('/ferramentas');
  await c.ate(`document.querySelector('main table tbody tr')`);
  await c.espera(200);
  const nomes = () => c.avaliar(`[...document.querySelectorAll('main table tbody tr')].map(tr=>tr.querySelector('td:not(:has(input))')?.textContent ?? tr.textContent)`);
  const antes = (await nomes()).length;
  await abrirFiltros();
  await escolherNoSelect('filtro-etiqueta', ETIQUETAS[1].id);
  await fecharMenu();
  const depois = await nomes();
  ok('filtrar por etiqueta deixa só a ferramenta marcada', depois.length === 1 && depois[0].includes('Traço Editor') && antes > 1, `${antes} → ${js(depois)}`);
  ok('o filtro aparece entre os ativos', (await texto('main')).includes('Etiqueta: Revisar no trimestre'));
  await c.avaliar(`[...document.querySelectorAll('main button')].find(b=>b.textContent.trim()==='Limpar filtros')?.click()`);
  await c.espera(300);
  await c.avaliar(`[...document.querySelectorAll('main button')].find(b=>b.textContent.trim().startsWith('Colunas')).click()`);
  await c.ate(`document.querySelector('.menu-suspenso')`);
  await c.espera(150);
  ok('a coluna Etiquetas pode ser ligada', (await texto('.menu-suspenso')).includes('Etiquetas'));
  await fecharMenu();
});

await passo('responsivo', async () => {
  await c.tamanho(360, 780);
  const atividade = (await tabela('atividade')).find((a) => a.titulo === 'Definir o preço da oferta anual');
  await ir(`/meu-dia?atividade=${atividade.id}`);
  await painelAberto();
  await c.ate(`[...document.querySelectorAll('.painel-lateral legend')].some(l=>l.textContent.startsWith('Etiquetas'))`);
  await c.espera(300);
  await conferirTela('Painel com etiquetas', 360);
  const traco = (await tabela('ferramenta')).find((f) => f.nome === 'Traço Editor');
  await ir(`/ferramentas/${traco.id}`);
  await c.ate(`[...document.querySelectorAll('main legend')].some(l=>l.textContent.startsWith('Etiquetas'))`);
  await c.espera(300);
  await conferirTela('Ficha com etiquetas', 360);
  await c.foto('d-ficha-360', { inteira: true });
  await c.tamanho(1440, 900);
});

await terminar();
