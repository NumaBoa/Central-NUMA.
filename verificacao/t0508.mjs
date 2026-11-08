// Verificação da T05.08 (Orçamento por contexto, RN-05.17) no sistema real, em 1440 e 360.
import { iniciar } from './apoio.mjs';

const h = await iniciar({ nome: 't0508', porta: 9379 });
const { c, ok, passo, ir, texto, preencher, pularAbertura, tabela, esperarAviso, conferirTela, terminar } = h;

const js = (v) => JSON.stringify(v);
const hoje = new Date();
const mes = (desloc = 0) => {
  const d = new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth() + desloc, 1));
  return d.toISOString().slice(0, 10);
};
const ATUAL = mes(0);
const ANTERIOR = mes(-1);
const botao = (rotulo, onde = 'main') => `[...document.querySelectorAll(${js(onde + ' button')})].find(b=>b.textContent.trim()===${js(rotulo)})`;
const clicarBotao = (rotulo, onde) => c.avaliar(`(()=>{const b=${botao(rotulo, onde)};if(!b)throw new Error('sem botão: '+${js(rotulo)});b.click()})()`);
const linhas = () => c.avaliar(`[...document.querySelectorAll('main table tbody th[scope=row]')].map(t=>t.querySelector('span')?.textContent??t.textContent.trim())`);
const editarLinha = async (indice) => {
  await c.avaliar(`document.querySelectorAll('main table tbody th[scope=row] button')[${indice}].click()`);
  await c.ate(`document.getElementById(${js('orcamento-' + ATUAL)})`);
};

await c.tamanho(1440, 900);
await ir('/financeiro/orcamento');
await pularAbertura();
await c.ate(`document.querySelector('main table')`);

await passo('T05.08: a tela, as abas e os contextos', async () => {
  ok('a aba Orçamento aparece no Financeiro', await c.avaliar(`Boolean(document.querySelector('nav[aria-label="Seções do financeiro"] a[href="/financeiro/orcamento"][aria-current]'))`));
  const nomes = await linhas();
  ok('uma linha por produto, a Numa institucional e o total', nomes.includes('Numa institucional') && nomes.at(-1) === 'Total' && nomes.length >= 3, js(nomes));
  ok('12 meses', (await c.avaliar(`document.querySelectorAll('main table thead th').length`)) === 13);
  ok('sem orçamento é dito, nunca R$ 0,00 orçado', (await texto('main table')).includes('Sem orçamento'));
  ok('as notas de rateio e câmbio estão na tela', (await texto('main')).includes('Rateios não são saídas adicionais de caixa'));
});

await passo('T05.08: editar, alerta e vazio', async () => {
  await editarLinha(0);
  await preencher('orcamento-' + ATUAL, '1,00');
  await preencher('orcamento-' + ANTERIOR, '50,00');
  await preencher(`orcamento-${mes(1)}`, 'abc');
  await clicarBotao('Salvar orçamento', '.janela');
  await esperarAviso('Valor inválido');
  ok('valor inválido é recusado e diz o mês', (await tabela('orcamento')).length === 0);
  await preencher(`orcamento-${mes(1)}`, '');
  await clicarBotao('Salvar orçamento', '.janela');
  await esperarAviso('Orçamento salvo');
  await c.ate(`!document.querySelector('.janela')`);
  const gravados = (await tabela('orcamento')).map((item) => `${item.competencia}:${item.valor_brl}`).sort();
  ok('grava só os meses preenchidos', js(gravados) === js([`${ANTERIOR}:50`, `${ATUAL}:1`].sort()), js(gravados));
  const nivel = await c.avaliar(`document.querySelectorAll('main table tbody tr')[0].querySelectorAll('td')[${Number(ATUAL.slice(5, 7)) - 1}].querySelector('[data-nivel]').dataset.nivel`);
  const realizadoPositivo = Number(await c.avaliar(`document.querySelectorAll('main table tbody tr')[0].querySelectorAll('td')[${Number(ATUAL.slice(5, 7)) - 1}].querySelector('[data-nivel]').dataset.realizado`)) > 0;
  ok('com R$ 1,00 orçado, o mês fica estourado se houve despesa, e a faixa avisa', realizadoPositivo ? nivel === 'estourado' && (await texto('main')).includes('Alerta a partir de 80%') : nivel === 'ok', `${nivel} ${realizadoPositivo}`);
});

await passo('T05.08: copiar do mês anterior só preenche quem está sem orçamento', async () => {
  await clicarBotao('Copiar do mês anterior');
  await esperarAviso('já têm orçamento neste mês');
  const doMes = (await tabela('orcamento')).filter((item) => item.competencia === ATUAL && !item.arquivado_em);
  ok('o contexto que já tinha orçamento não muda', doMes.length === 1 && doMes[0].valor_brl === 1, js(doMes));
  await conferirTela('t0508', 1440);
});

await passo('360px: um mês por vez, em cartões', async () => {
  await c.tamanho(360, 800);
  await ir('/financeiro/orcamento');
  await c.ate(`document.getElementById('orcamento-mes-celular')`);
  await c.espera(300);
  ok('cartões por contexto', (await c.avaliar(`document.querySelectorAll('main ul > li').length`)) >= 2);
  await conferirTela('t0508-360', 360);
});

await terminar();
