// Verificação da T05.10 (Fechamento mensal) e da T05.11 (Pacote do contador) no sistema real, em 1440 e 360.
// A trava da competência fechada (CA-05.04) é coberta no Vitest; aqui, o caminho de quem fecha o mês.
import { iniciar } from './apoio.mjs';

const h = await iniciar({ nome: 't0510', porta: 9383 });
const { c, ok, passo, ir, texto, preencher, clicarNoDialogo, painelAberto, painelFechado, pularAbertura, tabela, esperarAviso, conferirTela, terminar } = h;

const js = (v) => JSON.stringify(v);
const hoje = new Date();
const mesPassado = new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth() - 1, 1)).toISOString().slice(0, 7);
const clicarBotao = (rotulo) => c.avaliar(`(()=>{const b=[...document.querySelectorAll('main button')].find(b=>b.textContent.trim()===${js(rotulo)});if(!b)throw new Error('sem botão: '+${js(rotulo)});b.click()})()`);
const item = (id) => c.avaliar(`(()=>{const l=document.querySelector('[data-item="${id}"]');return l&&{ok:l.dataset.ok==='true',texto:l.textContent.replace(/\\s+/g,' ')}})()`);

await c.tamanho(1440, 900);
await ir('/financeiro/fechamento');
await pularAbertura();
await c.ate(`document.querySelector('main h1')?.textContent==='Fechamento mensal'`);

await passo('T05.10: checklist do mês anterior', async () => {
  ok('a aba Fechamento aparece no Financeiro, marcada', await c.avaliar(`Boolean(document.querySelector('nav[aria-label="Seções do financeiro"] a[href="/financeiro/fechamento"][aria-current]'))`));
  ok('começa no mês anterior', (await c.avaliar(`document.getElementById('fechamento-mes').value`)) === mesPassado);
  ok('os 8 itens, na ordem da especificação', (await c.avaliar(`[...document.querySelectorAll('[data-item]')].map(l=>l.dataset.item).join()`)) === 'despesas,comprovantes,saldos,rateios,receitas,reembolsos,kpis,contador');
  ok('o resumo do mês', (await texto('[data-resumo-do-mes]')).includes('Entradas (recebido)') && (await texto('[data-resumo-do-mes]')).includes('Resultado gerencial'));
  ok('o item 8 aponta para o contador', !(await item('contador')).ok && (await item('contador')).texto.includes('Financeiro › Contador'));
  await c.avaliar(`document.querySelector('[data-item="rateios"] input[type=checkbox]').click()`);
  await c.ate(`document.querySelector('[data-item="rateios"]').dataset.ok==='true'`);
  ok('marcar à mão grava quem marcou', (await item('rateios')).texto.includes('marcado por'));
  await conferirTela('t0510', 1440);
});

await passo('T05.11: pacote do contador e o envio', async () => {
  await ir('/financeiro/contador');
  await c.ate(`document.querySelector('main h1')?.textContent==='Pacote do contador'`);
  ok('três arquivos para baixar', (await c.avaliar(`document.querySelectorAll('ul[aria-label="Arquivos do pacote"] li').length`)) === 3);
  await clicarBotao('Registrar envio');
  await painelAberto();
  await c.espera(320);
  await preencher('envio-para', 'Souza Contabilidade');
  await preencher('envio-como', 'E-mail');
  await clicarNoDialogo('Registrar envio');
  await esperarAviso('Envio registrado.');
  await painelFechado();
  ok('o envio aparece na lista', (await texto('[data-envios]')).includes('Souza Contabilidade'));
  await conferirTela('t0510-contador', 1440);
  await ir('/financeiro/fechamento');
  await c.ate(`document.querySelector('[data-item="contador"]')`);
  ok('e marca o item 8 do fechamento', (await item('contador')).ok);
});

await passo('T05.10: fechar com pendência pede motivo; reabrir também', async () => {
  await clicarBotao('Fechar competência');
  await c.ate(`document.querySelector('.dialogo textarea')`);
  await c.espera(420);
  ok('com pendência, a confirmação pede o motivo', (await texto('.dialogo')).includes('Diga por que fechar assim mesmo'));
  await c.avaliar(`document.querySelector('.dialogo textarea').focus()`);
  await c.digitar('Contador pediu o fechamento');
  await clicarNoDialogo('Fechar competência');
  await esperarAviso('Competência fechada.');
  await c.ate(`!document.querySelector('.dialogo')`);
  const [registro] = await tabela('competencia_fechamento');
  ok('fechada, com o motivo das pendências', registro.situacao === 'fechada' && registro.fechada_com_pendencias === 'Contador pediu o fechamento', js(registro));
  await c.ate(`document.querySelector('[data-situacao-da-competencia]').textContent.includes('Fechada em')`);
  ok('fechada, os itens à mão não mudam mais', !(await c.avaliar(`Boolean(document.querySelector('[data-item="rateios"] input[type=checkbox]'))`)));
  await clicarBotao('Reabrir competência');
  await c.ate(`document.querySelector('.dialogo textarea')`);
  await c.espera(420);
  await c.avaliar(`document.querySelector('.dialogo textarea').focus()`);
  await c.digitar('Faltou uma nota fiscal');
  await clicarNoDialogo('Reabrir competência');
  await esperarAviso('Competência reaberta.');
  ok('reaberta, com o motivo', (await tabela('competencia_fechamento'))[0].reaberta_motivo === 'Faltou uma nota fiscal');
});

await passo('360px', async () => {
  await c.tamanho(360, 800);
  await ir('/financeiro/fechamento');
  await c.ate(`document.querySelector('[data-item]')`);
  await c.espera(300);
  await conferirTela('t0510-360', 360);
  await ir('/financeiro/contador');
  await c.ate(`document.querySelector('ul[aria-label="Arquivos do pacote"]')`);
  await c.espera(300);
  await conferirTela('t0510-contador-360', 360);
});

await terminar();
