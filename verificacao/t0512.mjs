// Verificação da T05.12 (Receita por canal) no sistema real, em 1440 e 360: canal com taxa, lançamento do mês,
// título a receber aberto (RN-05.20), um lançamento por produto × canal × competência e a soma mensal em reais.
import { iniciar } from './apoio.mjs';

const h = await iniciar({ nome: 't0512', porta: 9381 });
const { c, ok, passo, ir, texto, preencher, escolher, clicarNoDialogo, painelAberto, painelFechado, pularAbertura, tabela, esperarAviso, conferirTela, terminar } = h;

const js = (v) => JSON.stringify(v);
const KIPI = 'c4e2a3f6-9d51-4c32-8e23-2b3c4d5e6f03';
const hoje = new Date();
const diaISO = (dias = 0) => new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + dias)).toISOString().slice(0, 10);
const mesPassado = new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth() - 1, 1)).toISOString().slice(0, 7);
const pagina = () => c.avaliar(`document.querySelector('main').textContent`).then((t) => t.replace(/\s+/g, ' '));
const janela = () => c.avaliar(`document.querySelector('.janela')?.textContent??''`).then((t) => t.replace(/\s+/g, ' '));
const clicarBotao = (rotulo) => c.avaliar(`(()=>{const b=[...document.querySelectorAll('main button')].find(b=>b.textContent.trim()===${js(rotulo)});if(!b)throw new Error('sem botão: '+${js(rotulo)});b.click()})()`);

await c.tamanho(1440, 900);
await ir('/produtos/canais');
await pularAbertura();
await c.ate(`document.querySelector('main h1')?.textContent==='Canais de venda'`);

await passo('preparo: um canal com taxa de 15% e repasse em 15 dias', async () => {
  await clicarBotao('Novo canal');
  await painelAberto();
  await c.espera(320);
  await preencher('canal-nome', 'Loja de teste');
  await preencher('canal-percentual', '15');
  await preencher('canal-prazo', '15');
  await preencher('canal-verificado', diaISO(-5));
  await preencher('canal-fonte', 'https://exemplo.com.br/taxas');
  await clicarNoDialogo('Criar canal');
  await esperarAviso('Canal criado.');
  await painelFechado();
  ok('canal criado', (await tabela('canal_venda')).length === 1);
});

await passo('T05.12: lista vazia e aba no Financeiro', async () => {
  await ir('/financeiro/receitas');
  await c.ate(`document.querySelector('main h1')?.textContent==='Receita por canal'`);
  ok('a aba Receita por canal aparece marcada', await c.avaliar(`Boolean(document.querySelector('nav[aria-label="Seções do financeiro"] a[href="/financeiro/receitas"][aria-current]'))`));
  ok('vazio, com a próxima ação', (await pagina()).includes('Nenhuma receita por canal ainda'));
});

await passo('T05.12: lançar o mês gera o título a receber, aberto', async () => {
  await clicarBotao('Lançar receita');
  await painelAberto();
  await c.espera(320);
  await escolher('receita-produto', KIPI);
  const canalId = (await tabela('canal_venda'))[0].id;
  await escolher('receita-canal', canalId);
  await preencher('receita-competencia', mesPassado);
  await preencher('receita-bruta', '1.000,00');
  await c.espera(150);
  ok('sugere a taxa pelo percentual do canal', (await janela()).includes('Sugestão pelo canal (15%): R$ 150,00'));
  await c.avaliar(`[...document.querySelectorAll('.janela button')].find(b=>b.textContent.trim()==='Usar').click()`);
  await c.espera(150);
  ok('o líquido aparece calculado', (await texto('[data-receita-liquida]')).replace(/\s+/g, ' ').includes('R$ 850,00'));
  await preencher('receita-ativos', '42');
  await clicarNoDialogo('Lançar receita');
  await esperarAviso('Receita lançada');
  await painelFechado();
  const [receita] = await tabela('receita_canal');
  ok('gravada com bruto, taxas, líquido e assinantes', receita.receita_bruta === 1000 && receita.taxas === 150 && receita.receita_liquida === 850 && receita.assinantes_ativos === 42, js(receita));
  const titulo = (await tabela('titulo')).find((t) => t.id === receita.titulo_id);
  ok('título a receber do canal, aberto, nunca recebido sozinho', titulo && titulo.natureza === 'receber' && titulo.situacao === 'aberto' && titulo.origem === 'canal' && titulo.valor === 850, js(titulo));
  ok('sem baixa', !(await tabela('baixa')).some((b) => b.titulo_id === receita.titulo_id));
  const m = await pagina();
  ok('a lista mostra a linha e o título a receber', m.includes('Kipi · Loja de teste') && m.includes('A receber') && m.includes('42 ativos'));
  ok('a soma do mês em reais', m.includes('Receita líquida por mês (R$)'));
});

await passo('T05.12: um lançamento por produto × canal × competência', async () => {
  await clicarBotao('Lançar receita');
  await painelAberto();
  await c.espera(320);
  await escolher('receita-produto', KIPI);
  await escolher('receita-canal', (await tabela('canal_venda'))[0].id);
  await preencher('receita-competencia', mesPassado);
  await preencher('receita-bruta', '500,00');
  await clicarNoDialogo('Lançar receita');
  await esperarAviso('Já há receita');
  ok('não duplica', (await tabela('receita_canal')).length === 1);
  await conferirTela('t0512-janela', 1440);
  await c.avaliar(`[...document.querySelectorAll('.janela button')].find(b=>b.textContent.trim()==='Cancelar').click()`);
  await c.espera(300);
  if (await c.avaliar(`Boolean(document.querySelector('.dialogo'))`)) await clicarNoDialogo('Descartar alterações');
  await painelFechado();
  await conferirTela('t0512', 1440);
});

await passo('360px', async () => {
  await c.tamanho(360, 800);
  await ir('/financeiro/receitas');
  await c.ate(`document.querySelector('main table')`);
  await c.espera(300);
  await conferirTela('t0512-360', 360);
});

await terminar();
