// Verificação da T05.09 (Custos e resultado por produto) no sistema real, em 1440 e 360.
import { iniciar } from './apoio.mjs';

const h = await iniciar({ nome: 't0509', porta: 9380 });
const { c, ok, passo, ir, texto, escolher, pularAbertura, conferirTela, terminar } = h;

const js = (v) => JSON.stringify(v);
const visao = async (rotulo) => {
  await c.avaliar(`[...document.querySelectorAll('main [aria-label="Visões"] button')].find(b=>b.textContent.trim()===${js(rotulo)}).click()`);
  await c.espera(150);
};
const linhas = () => c.avaliar(`[...document.querySelectorAll('main table tbody th[scope=row]')].map(t=>t.textContent.trim())`);

await c.tamanho(1440, 900);
await ir('/financeiro/custos');
await pularAbertura();
await c.ate(`document.querySelector('main table')`);

await passo('T05.09: por produto', async () => {
  ok('a aba Custos por produto aparece no Financeiro', await c.avaliar(`Boolean(document.querySelector('nav[aria-label="Seções do financeiro"] a[href="/financeiro/custos"][aria-current]'))`));
  const nomes = await linhas();
  ok('uma linha por produto e a Numa institucional por último', nomes.at(-1) === 'Numa institucional' && nomes.length >= 2, js(nomes));
  const cabecalho = await texto('main table thead');
  ok('diretos, compartilhados, total e custo médio', ['Diretos', 'Compartilhados (rateados)', 'Custo total', 'Custo médio mensal'].every((t) => cabecalho.includes(t)), cabecalho);
  const m = await texto('main');
  ok('as notas obrigatórias', m.includes('Rateios não são saídas adicionais de caixa') && m.includes('são estimados pelo câmbio de referência'));
  ok('a base diz período, contexto e investimento', (await texto('[data-base-dos-custos]')).includes('Numa consolidada') && (await texto('[data-base-dos-custos]')).includes('com investimento'));
  ok('falta de câmbio aparece escrita, nunca como zero', !m.includes('NaN') && (m.includes('Falta câmbio') || !m.includes('US$')));
});

await passo('T05.09: as outras visões e os filtros', async () => {
  await visao('Por categoria');
  ok('por categoria: matriz com os meses e o total', (await texto('main table thead')).includes('Total') && (await c.avaliar(`document.querySelectorAll('main table thead th').length`)) >= 4);
  await visao('Ferramentas');
  ok('ferramentas: tabela ou estado vazio explicado', (await texto('main')).includes('Por contexto') || (await texto('main')).includes('Nenhuma cobrança de ferramenta'));
  await visao('Numa institucional');
  ok('Numa institucional: só os custos sem produto', (await texto('main')).includes('Categoria') || (await texto('main')).includes('Nenhum custo no período'));
  await visao('Por produto');
  await c.avaliar(`document.querySelector('main [aria-label="Filtros dos custos"] input[type=checkbox]').click()`);
  await c.espera(200);
  ok('tirar investimento muda a base', (await texto('[data-base-dos-custos]')).includes('sem investimento'));
  await escolher('custos-natureza', 'investimento');
  await c.espera(200);
  ok('natureza "investimento" sem incluir investimento: nada entra', (await texto('[data-base-dos-custos]')).replace(/\s/g, ' ').includes('R$ 0,00'));
  await conferirTela('t0509', 1440);
});

await passo('360px', async () => {
  await c.tamanho(360, 800);
  await ir('/financeiro/custos');
  await c.ate(`document.querySelector('main table')`);
  await c.espera(300);
  await conferirTela('t0509-360', 360);
});

await terminar();
