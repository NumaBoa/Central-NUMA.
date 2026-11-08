// Verificação da T13.02 Fluxo de caixa (Financeiro › Fluxo de caixa) no sistema real, em 1440 e 360.
// As contas (realizado, projetado, saldo, rateio por contexto, falta de câmbio) são cobertas no Vitest.
import { iniciar } from './apoio.mjs';

const h = await iniciar({ nome: 't1302', porta: 9385 });
const { c, ok, passo, ir, texto, pularAbertura, conferirTela, terminar } = h;

const KIPI = 'c4e2a3f6-9d51-4c32-8e23-2b3c4d5e6f03';
const hoje = new Date();
const mesAtual = hoje.toISOString().slice(0, 7);

await c.tamanho(1440, 900);
await ir('/financeiro/fluxo');
await pularAbertura();
await c.ate(`document.querySelector('main h1')?.textContent==='Fluxo de caixa'`);
await c.ate(`document.querySelector('[data-fluxo-de-caixa]')`);

await passo('T13.02: o fluxo do consolidado', async () => {
  ok('a aba Fluxo de caixa aparece no Financeiro, marcada', await c.avaliar(`Boolean(document.querySelector('nav[aria-label="Seções do financeiro"] a[href="/financeiro/fluxo"][aria-current]'))`));
  const tipos = await c.avaliar(`[...document.querySelectorAll('[data-fluxo-de-caixa] tbody tr')].map(l=>l.dataset.tipo)`);
  ok('9 meses: 5 realizados, o atual e 3 projetados', tipos.join() === 'realizado,realizado,realizado,realizado,realizado,atual,projetado,projetado,projetado', tipos.join());
  ok('o mês atual é o de hoje', await c.avaliar(`document.querySelector('[data-tipo="atual"]').dataset.mes===${JSON.stringify(mesAtual)}`));
  const cabecalho = await texto('[data-fluxo-de-caixa] thead');
  ok('no consolidado: aportes, retiradas, entre contas e saldo', ['Entradas', 'Saídas', 'A receber', 'A pagar', 'Aportes', 'Retiradas', 'Entre contas', 'Saldo final'].every((t) => cabecalho.includes(t)), cabecalho);
  ok('baixar CSV ligado', await c.avaliar(`![...document.querySelectorAll('main button')].find(b=>b.textContent.trim()==='Baixar CSV').disabled`));
  await conferirTela('t1302', 1440);
});

await passo('T13.02: período invertido e contexto de produto', async () => {
  await c.avaliar(`(()=>{const i=document.getElementById('fluxo-de');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'2030-01');i.dispatchEvent(new Event('input',{bubbles:true}))})()`);
  await c.ate(`(document.querySelector('main')?.textContent??'').includes('O início vem antes do fim.')`);
  ok('período invertido avisa e não monta tabela', !(await c.avaliar(`Boolean(document.querySelector('[data-fluxo-de-caixa]'))`)));
  await c.avaliar(`(()=>{const m=JSON.parse(localStorage.getItem('numa-central:v1:meta'));m.contexto_id=${JSON.stringify(KIPI)};localStorage.setItem('numa-central:v1:meta',JSON.stringify(m))})()`);
  await ir('/financeiro/fluxo');
  await c.ate(`document.querySelector('[data-fluxo-de-caixa]')`);
  const cabecalho = await texto('[data-fluxo-de-caixa] thead');
  ok('num produto: sem aportes, transferências e saldo', !cabecalho.includes('Aportes') && !cabecalho.includes('Saldo final'), cabecalho);
  ok('diz o recorte', (await texto('[data-recorte-do-fluxo]')).includes('rateada para este contexto'));
  ok('sem a escolha de conta', !(await c.avaliar(`Boolean(document.getElementById('fluxo-conta'))`)));
  await c.avaliar(`(()=>{const m=JSON.parse(localStorage.getItem('numa-central:v1:meta'));m.contexto_id='consolidada';localStorage.setItem('numa-central:v1:meta',JSON.stringify(m))})()`);
});

await passo('360px', async () => {
  await c.tamanho(360, 800);
  await ir('/financeiro/fluxo');
  await c.ate(`document.querySelector('[data-fluxo-de-caixa]')`);
  await c.espera(300);
  ok('a aba ativa fica visível no celular', await c.avaliar(`(()=>{const a=document.querySelector('nav[aria-label="Seções do financeiro"] a[aria-current]').getBoundingClientRect();return a.left>=0&&a.right<=innerWidth+1})()`));
  await conferirTela('t1302-360', 360);
});

await terminar();
