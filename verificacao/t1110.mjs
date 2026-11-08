// Verificação da T11.10 (Reajuste) no sistema real, em 1440 e 360. A regra (prévia, aplicar só nos títulos futuros
// não pagos, programação com o novo valor) é coberta de ponta a ponta no Vitest, com um contrato assinado de verdade.
import { iniciar } from './apoio.mjs';

const h = await iniciar({ nome: 't1110', porta: 9382 });
const { c, ok, passo, ir, texto, pularAbertura, tabela, conferirTela, terminar } = h;

await c.tamanho(1440, 900);
await ir('/contratos/reajustes');
await pularAbertura();
await c.ate(`document.querySelector('main h1')?.textContent==='Reajuste'`);

await passo('T11.10: a aba e o estado vazio', async () => {
  ok('a aba Reajuste aparece em Contratos, marcada', await c.avaliar(`Boolean(document.querySelector('nav[aria-label="Áreas de Contratos"] a[href="/contratos/reajustes"][aria-current]'))`));
  const m = (await texto('main')).replace(/\s+/g, ' ');
  ok('diz a regra padrão e o horizonte', m.includes('próximos 60 dias') && m.includes('IPCA, anual'));
  ok('sem contrato vigente com recorrente, o vazio explica', m.includes('Nenhuma data-base nos próximos 60 dias.'));
  ok('a carta por modelo fica anunciada, sem fingir que existe', m.includes('A carta de reajuste por modelo entra quando houver'));
  ok('a tabela começa vazia', (await tabela('reajuste_aplicado')).length === 0);
  await conferirTela('t1110', 1440);
});

await passo('360px', async () => {
  await c.tamanho(360, 800);
  await ir('/contratos/reajustes');
  await c.ate(`document.querySelector('main h1')?.textContent==='Reajuste'`);
  await c.espera(300);
  ok('a aba ativa fica visível no celular', await c.avaliar(`(()=>{const a=document.querySelector('nav[aria-label="Áreas de Contratos"] a[aria-current]').getBoundingClientRect();return a.left>=0&&a.right<=innerWidth+1})()`));
  await conferirTela('t1110-360', 360);
});

await terminar();
