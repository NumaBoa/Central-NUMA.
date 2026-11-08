// Decisão de Kimberly em 06/11/2026: formulários e detalhes em janela central, com o essencial sem rolagem;
// no celular, tela inteira. Passa por todos os formulários do sistema, em 1440 e em 360.
import { iniciar } from './apoio.mjs';

const h = await iniciar({ nome: 'janela', porta: 9367 });
const { c, ok, passo, ir, pularAbertura, tabela, conferirTela, terminar } = h;

const js = (v) => JSON.stringify(v);
const SELETOR = '.janela,.dialogo';
const clicarBotao = (rotulo) => c.avaliar(`[...document.querySelectorAll('main button, main a')].find(b=>b.textContent.trim()===${js(rotulo)}).click()`);
const medir = () =>
  c.avaliar(`(()=>{const j=document.querySelector(${js(SELETOR)});const b=j.getBoundingClientRect();return {x:Math.round(b.left),direita:Math.round(innerWidth-b.right),topo:Math.round(b.top),baixo:Math.round(innerHeight-b.bottom),largura:Math.round(b.width),altura:Math.round(b.height)}})()`);
/** O essencial sem rolar: todo campo obrigatório visível, dentro da área do corpo. */
const obrigatoriosForaDaVista = () =>
  c.avaliar(`(()=>{const j=document.querySelector(${js(SELETOR)});const rodape=j.querySelector('footer,.acoes-dialogo');const limite=rodape?rodape.getBoundingClientRect().top:j.getBoundingClientRect().bottom;return [...j.querySelectorAll('label,legend')].filter(l=>l.textContent.trim().endsWith('*')&&l.getBoundingClientRect().height>0&&l.getBoundingClientRect().bottom>limite).map(l=>l.textContent.trim())})()`);

/** O caminho até cada formulário. */
const FORMULARIOS = [
  { nome: 'Nova pessoa', caminho: '/configuracoes/cadastros/pessoas', botao: 'Nova pessoa' },
  { nome: 'Nova área', caminho: '/configuracoes/cadastros/areas', botao: 'Nova área' },
  { nome: 'Nova marca', caminho: '/produtos/marcas', botao: 'Nova marca' },
  { nome: 'Novo produto', caminho: '/produtos/marcas', botao: 'Novo produto' },
  { nome: 'Nova entidade', caminho: '/configuracoes/cadastros/entidades', botao: 'Nova entidade' },
  // País e situação já vêm preenchidos e ficam no fim: o que falta preencher está à vista.
  { nome: 'Nova contraparte', caminho: '/comercial/contrapartes', botao: 'Nova contraparte', preenchidosNoFim: ['País *', 'Situação *'] },
  { nome: 'Nova categoria', caminho: '/financeiro/categorias', botao: 'Nova categoria' },
  { nome: 'Nova conta', caminho: '/financeiro/contas/cadastro', botao: 'Nova conta' },
  { nome: 'Novo feriado', caminho: '/configuracoes/cadastros/calendario', botao: 'Novo feriado' },
  { nome: 'Nova etiqueta', caminho: '/configuracoes/cadastros/etiquetas', botao: 'Nova etiqueta' },
  { nome: 'Nova ferramenta', caminho: '/ferramentas', botao: 'Nova ferramenta' },
  // A sócia titular já vem preenchida com quem cadastra (RN-04.14).
  { nome: 'Novo ativo', caminho: '/ferramentas/ativos', botao: 'Novo ativo', preenchidosNoFim: ['Sócia titular *'] },
  { nome: 'Nova despesa', caminho: '/financeiro', botao: 'Nova despesa' },
  { nome: 'Novo aporte', caminho: '/financeiro/socias', botao: 'Novo aporte em dinheiro', dialogo: true },
  { nome: 'Nova transferência', caminho: '/financeiro/transferencias', botao: 'Nova transferência', dialogo: true },
  { nome: 'Adicionar câmbio', caminho: '/financeiro/contas#cambio', botao: 'Adicionar', dialogo: true },
];

async function abrir(formulario) {
  await ir(formulario.caminho);
  await c.ate(`[...document.querySelectorAll('main button, main a')].some(b=>b.textContent.trim()===${js(formulario.botao)}&&!b.disabled)`);
  await c.espera(900); // o botão vem do servidor: o clique só vale depois de hidratar
  await clicarBotao(formulario.botao);
  await c.ate(`document.querySelector(${js(SELETOR)})`);
  await c.espera(450);
}

await c.tamanho(1440, 900);
await ir('/meu-dia');
await pularAbertura();

for (const formulario of FORMULARIOS) {
  await passo(`${formulario.nome}, no computador`, async () => {
    await abrir(formulario);
    const m = await medir();
    ok(`${formulario.nome}: centralizada`, Math.abs(m.x - m.direita) <= 1 && Math.abs(m.topo - m.baixo) <= 1, js(m));
    const fora = (await obrigatoriosForaDaVista()).filter((campo) => !formulario.preenchidosNoFim?.includes(campo));
    ok(`${formulario.nome}: os obrigatórios à vista, sem rolar`, fora.length === 0, js(fora));
    await conferirTela(formulario.nome, 1440);
    await c.foto(`1440-${formulario.nome.replaceAll(' ', '-')}`);
  });
}

await passo('Registrar baixa, no computador', async () => {
  const titulo = (await tabela('titulo')).find((item) => item.situacao === 'aberto');
  await ir(`/financeiro/${titulo.id}?acao=baixa`);
  await c.ate(`document.querySelector('.dialogo')`);
  await c.espera(450);
  const m = await medir();
  ok('Baixa: centralizada', Math.abs(m.x - m.direita) <= 1 && Math.abs(m.topo - m.baixo) <= 1, js(m));
  const fora = await obrigatoriosForaDaVista();
  ok('Baixa: os obrigatórios à vista, sem rolar', fora.length === 0, js(fora));
  await c.foto('1440-Baixa');
});

await c.tamanho(360, 800);
for (const formulario of FORMULARIOS) {
  await passo(`${formulario.nome}, no celular`, async () => {
    await abrir(formulario);
    const m = await medir();
    ok(`${formulario.nome}: tela inteira`, m.largura === 360 && m.altura === 800, js(m));
    await conferirTela(formulario.nome, 360);
    await c.foto(`360-${formulario.nome.replaceAll(' ', '-')}`);
  });
}

await passo('Registrar baixa, no celular', async () => {
  const titulo = (await tabela('titulo')).find((item) => item.situacao === 'aberto');
  await ir(`/financeiro/${titulo.id}?acao=baixa`);
  await c.ate(`document.querySelector('.dialogo')`);
  await c.espera(450);
  const m = await medir();
  ok('Baixa: tela inteira', m.largura === 360 && m.altura === 800, js(m));
  await conferirTela('Baixa', 360);
  await c.foto('360-Baixa');
});

await terminar();
