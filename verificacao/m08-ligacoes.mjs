// Verificação das ligações do M08 com os outros módulos (08/11/2026): arquivos da biblioteca nas fichas do produto,
// da ferramenta e do ativo; campanha de origem no formulário da oportunidade. Em 1440 e 360.
import { iniciar } from './apoio.mjs';

const h = await iniciar({ nome: 'm08-ligacoes', porta: 9386 });
const { c, ok, passo, ir, texto, pularAbertura, tabela, conferirTela, terminar } = h;

const KIPI = 'c4e2a3f6-9d51-4c32-8e23-2b3c4d5e6f03';
const abrirAba = async (rotulo) => {
  const achar = `[...document.querySelectorAll('main [role=tab]')].find(a=>a.textContent.trim()===${JSON.stringify(rotulo)})`;
  const abrir = (alvo) => c.avaliar(`(()=>{const a=${alvo};a.focus();a.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}))})()`);
  await c.ate(`document.querySelectorAll('main [role=tab]').length>0`);
  // Na ficha da ferramenta, as áreas complementares ficam em "Mais áreas".
  if (!(await c.avaliar(`Boolean(${achar})`))) {
    await abrir(`[...document.querySelectorAll('main [role=tab]')].find(a=>a.textContent.trim()==='Mais áreas')`);
    await c.ate(`Boolean(${achar})`);
  }
  await abrir(achar);
  await c.espera(160);
};

await c.tamanho(1440, 900);
await ir(`/produtos/${KIPI}?aba=marca`);
await pularAbertura();
await c.ate(`document.querySelector('[data-arquivos-da-biblioteca]')`);

await passo('produto: os arquivos da biblioteca', async () => {
  await c.ate(`document.querySelector('[data-arquivos-da-biblioteca] li')`);
  const bloco = await texto('[data-arquivos-da-biblioteca]');
  ok('o logo de exemplo ligado ao Kipi aparece', bloco.includes('Logo Kipi'), bloco);
  ok('não diz mais que a biblioteca não existe', !(await texto('main')).includes('A biblioteca (M08) ainda não foi construída'));
  ok('o arquivo abre a ficha dele', await c.avaliar(`document.querySelector('[data-arquivos-da-biblioteca] li a').getAttribute('href').startsWith('/marketing/arquivos/')`));
  await conferirTela('m08-ligacoes-produto', 1440);
});

await passo('ferramenta e ativo: biblioteca e links do Drive juntos', async () => {
  const [ferramenta] = await tabela('ferramenta');
  await ir(`/ferramentas/${ferramenta.id}`);
  await abrirAba('Arquivos');
  await c.ate(`document.querySelector('[data-arquivos-da-biblioteca]')`);
  ok('na ferramenta: a biblioteca e os links do Drive', (await texto('main')).includes('Arquivos da biblioteca') && (await texto('main')).includes('Links do Drive'));
  const [ativo] = await tabela('ativo_digital');
  await ir(`/ferramentas/ativos/${ativo.id}`);
  await abrirAba('Arquivos');
  await c.ate(`document.querySelector('[data-arquivos-da-biblioteca]')`);
  ok('no ativo também', (await texto('[data-arquivos-da-biblioteca]')).includes('Arquivos da biblioteca'));
});

await passo('oportunidade: campanha de origem', async () => {
  await ir('/comercial');
  await c.ate(`[...document.querySelectorAll('main button, main a')].some(b=>b.textContent.trim()==='Nova oportunidade'&&!b.disabled)`);
  await c.avaliar(`[...document.querySelectorAll('main button, main a')].find(b=>b.textContent.trim()==='Nova oportunidade').click()`);
  await c.ate(`document.getElementById('op-campanha')`);
  const opcoes = await c.avaliar(`[...document.getElementById('op-campanha').options].map(o=>o.textContent)`);
  ok('o campo existe, começa em "Nenhuma" e lista as campanhas', opcoes[0] === 'Nenhuma' && opcoes.length >= 2, opcoes.join('|'));
  ok('diz que é informada à mão', (await texto('.janela, .dialogo')).includes('Informada à mão'));
  await conferirTela('m08-ligacoes-oportunidade', 1440);
});

await passo('360px', async () => {
  await c.tamanho(360, 800);
  await ir(`/produtos/${KIPI}?aba=marca`);
  await c.ate(`document.querySelector('[data-arquivos-da-biblioteca] li')`);
  await c.espera(300);
  await conferirTela('m08-ligacoes-360', 360);
});

await terminar();
