// T12.07 Notas de liberação num Chrome de verdade: criar (única por versão), puxar uma solicitação resolvida,
// itens por categoria, editar sem mudar a origem, prévia para clientes sem referências internas, publicar
// (exige item e data), publicada imutável, comunicação e os três tamanhos. Uso: node t1207.mjs <pasta> <url>
import { iniciar } from './apoio.mjs';
import { ID_KIPI } from './semear-m12.mjs';

const h = await iniciar({ nome: 't1207', porta: 9466 });
const { c, ok, passo, ir, texto, preencher, escolher, esperarAviso, pularAbertura, tabela, conferirTela, painelAberto, painelFechado, clicarNoDialogo, dialogoAberto } = h;
const js = (v) => JSON.stringify(v);
const ID_SOLICITACAO = '7e000000-0000-4000-8000-000000000021';

await ir('/meu-dia');
const hoje = await c.avaliar(`new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(new Date())`);
await pularAbertura();
// Dado de teste: uma falha do Kipi já resolvida, para puxar.
await c.avaliar(`(()=>{const agora=new Date().toISOString();const k='numa-central:v1:solicitacao_suporte';const l=JSON.parse(localStorage.getItem(k)||'[]');if(!l.some(x=>x.id===${js(ID_SOLICITACAO)}))l.push({id:${js(ID_SOLICITACAO)},criado_em:agora,criado_por:null,atualizado_em:agora,atualizado_por:null,arquivado_em:null,arquivado_por:null,versao_registro:1,exemplo:false,codigo:'SUP-2026-0901',contraparte_id:null,solicitante_texto:'Maria',contato_pessoa_id:null,produto_id:${js(ID_KIPI)},contrato_id:null,tipo:'falha',prioridade:'normal',canal:null,titulo:'Login falhava no Android',descricao:null,situacao:'resolvida',responsavel_id:'1c8e2d63-4a7f-4b2c-8e3d-6f9b8d5a2b02',aberta_em:agora,sla:null,prazo_resposta_em:null,prazo_resolucao_em:null,primeira_resposta_em:agora,resolvida_em:agora,fechada_em:null,pausas:[],solucao:'Corrigido.',oportunidade_id:null,incidente_id:null,nota_id:null,cancelada_motivo:null});localStorage.setItem(k,JSON.stringify(l))})()`);

const clicarBotao = async (rotulo, dentro = 'main') => {
  await c.ate(`[...document.querySelectorAll(${js(dentro + ' button')})].some(b=>b.textContent.trim()===${js(rotulo)}&&!b.disabled&&b.getBoundingClientRect().width>0)`);
  await c.avaliar(`[...document.querySelectorAll(${js(dentro + ' button')})].find(b=>b.textContent.trim()===${js(rotulo)}&&!b.disabled&&b.getBoundingClientRect().width>0).click()`);
};
const acaoDoMenu = async (rotulo) => {
  await c.avaliar(`[...document.querySelectorAll('main button')].find(b=>b.textContent.trim()==='Mais ações'&&b.getBoundingClientRect().width>0).click()`);
  await c.ate(`[...document.querySelectorAll('.menu-suspenso button, .dialogo button')].some(b=>b.textContent.trim()===${js(rotulo)})`);
  await c.avaliar(`[...document.querySelectorAll('.menu-suspenso button, .dialogo button')].find(b=>b.textContent.trim()===${js(rotulo)}).click()`);
};
const aba = async (rotulo) => {
  const alvo = `[...document.querySelectorAll('main [role=tab]')].find(a=>a.textContent.trim()===${js(rotulo)})`;
  await c.avaliar(`(()=>{const a=${alvo};a.focus();a.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}))})()`);
  await c.ate(`${alvo}.getAttribute('data-state')==='active'`);
};
const novaNota = async (versao) => {
  await ir('/operacao/notas');
  await c.ate(`document.querySelector('main h1')?.textContent==='Notas de liberação'`);
  await clicarBotao('Nova nota');
  await painelAberto();
  await escolher('nota-produto', ID_KIPI);
  await preencher('nota-versao', versao);
  await escolher('nota-publico', 'clientes');
  await clicarNoDialogo('Criar nota');
};

for (const largura of [1440, 768, 360]) {
  await passo(`lista vazia em ${largura}px`, async () => {
    await c.tamanho(largura, largura === 360 ? 780 : 900);
    await ir('/operacao/notas');
    await c.ate(`document.querySelector('main').textContent.includes('Nenhuma nota de liberação ainda.')`);
    await c.espera(250);
    await conferirTela('/operacao/notas vazia', largura);
  });
}
await c.tamanho(1440, 900);

await passo('criar em rascunho; a mesma versão não se repete', async () => {
  await novaNota('1.4.0');
  await esperarAviso('em rascunho');
  await c.ate(`document.querySelector('main h1')?.textContent==='Kipi 1.4.0'`);
  ok('Rascunho, para clientes', (await texto()).includes('Rascunho') && (await texto()).includes('Clientes'));
  await novaNota('v1.4.0');
  await esperarAviso('Já existe uma nota desta versão');
  ok('continua uma nota', (await tabela('nota_liberacao')).length === 1);
});

const [nota] = await tabela('nota_liberacao');
await passo('puxar a solicitação resolvida: vira correção, com o texto como sugestão', async () => {
  await ir(`/operacao/notas/${nota.id}`);
  await c.ate(`document.querySelector('main h1')`);
  await clicarBotao('Puxar da operação');
  await painelAberto();
  await c.ate(`document.querySelector('.janela ul[aria-label="O que dá para puxar"]')`);
  ok('a falha resolvida aparece, como correção', (await texto('.janela')).includes('Login falhava no Android') && (await texto('.janela')).includes('vira correção'));
  await clicarNoDialogo('Puxar itens');
  await esperarAviso('1 item puxado');
  await painelFechado();
  await c.ate(`document.querySelector('main ul[aria-label="Correções"]')`);
  ok('em Correções, com a origem', (await texto('main ul[aria-label="Correções"]')).includes('De SUP-2026-0901'));
  await clicarBotao('Puxar da operação');
  await painelAberto();
  await c.ate(`document.querySelector('.janela').textContent.includes('Nada novo para puxar')`);
  ok('puxar de novo não repete', true);
  await clicarNoDialogo('Fechar');
  await painelFechado();
});

await passo('novo item, editar o puxado sem mudar a origem, ordem', async () => {
  await clicarBotao('Novo item');
  await painelAberto();
  await escolher('item-categoria', 'novidade');
  await preencher('item-texto', 'Agenda compartilhada com a equipe');
  await clicarNoDialogo('Incluir item');
  await esperarAviso('Item incluído.');
  await painelFechado();
  await c.avaliar(`document.querySelector('main button[aria-label="Editar Login falhava no Android"]').click()`);
  await painelAberto();
  ok('a janela diz que a origem não muda', (await texto('.janela')).includes('não muda a solicitação'));
  await preencher('item-texto', 'O login no Android voltou a funcionar');
  await clicarNoDialogo('Salvar item');
  await esperarAviso('Item atualizado.');
  await painelFechado();
  const solicitacao = (await tabela('solicitacao_suporte')).find((linha) => linha.id === ID_SOLICITACAO);
  ok('a solicitação continua com o título dela', solicitacao.titulo === 'Login falhava no Android');
  await c.avaliar(`document.querySelector('main button[aria-label="Subir Agenda compartilhada com a equipe"]').click()`);
  await c.ate(`(()=>{const l=JSON.parse(localStorage.getItem('numa-central:v1:nota_liberacao_item'));return l.find(i=>i.texto.startsWith('Agenda')).ordem===0})()`);
  ok('a novidade sobe para o primeiro lugar', true);
});

await passo('prévia para clientes: agrupada, com a marca, sem referências internas', async () => {
  await aba('Prévia');
  const previa = await texto('main section[aria-label="Prévia da comunicação"]');
  ok('título, grupos e a marca', previa.includes('Kipi 1.4.0') && previa.includes('Novidades') && previa.includes('Correções') && previa.includes('Novidades da versão'), previa.slice(0, 300));
  ok('sem o código da solicitação', !previa.includes('SUP-2026-0901') && previa.includes('sem códigos internos'));
  await aba('Itens');
});

await passo('publicar exige a data; publicada não muda', async () => {
  await clicarBotao('Publicar');
  await dialogoAberto();
  ok('a confirmação avisa a data que falta', (await texto('.dialogo')).includes('Falta a data da versão.'));
  await clicarNoDialogo('Publicar');
  await esperarAviso('Publicar exige a data da versão.');
  await acaoDoMenu('Editar versão e público');
  await painelAberto();
  await preencher('nota-data', hoje);
  await clicarNoDialogo('Salvar alterações');
  await esperarAviso('Nota atualizada.');
  await painelFechado();
  await clicarBotao('Publicar');
  await dialogoAberto();
  await clicarNoDialogo('Publicar');
  await esperarAviso('Nota publicada.');
  await c.ate(`[...document.querySelectorAll('main button')].some(b=>b.textContent.trim()==='Registrar comunicação')`);
  const publicada = (await tabela('nota_liberacao'))[0];
  ok('Publicada, com quem e quando', publicada.situacao === 'publicada' && Boolean(publicada.publicada_em) && publicada.data === hoje);
  ok('a solicitação de origem aponta para a nota', (await tabela('solicitacao_suporte')).find((linha) => linha.id === ID_SOLICITACAO).nota_id === nota.id);
  ok('sem editar nem incluir itens', !(await c.avaliar(`[...document.querySelectorAll('main button')].some(b=>b.textContent.trim()==='Novo item')`)) && (await texto()).includes('Publicada: a nota não muda.'));
});

await passo('registrar onde foi comunicada', async () => {
  await clicarBotao('Registrar comunicação');
  await painelAberto();
  await c.avaliar(`[...document.querySelectorAll('.janela label')].find(l=>l.textContent.trim()==='Loja de apps').click()`);
  await c.avaliar(`[...document.querySelectorAll('.janela label')].find(l=>l.textContent.trim()==='E-mail').click()`);
  await preencher('nota-observacao', 'Texto da loja e e-mail para os clientes do Kipi.');
  await clicarNoDialogo('Salvar comunicação');
  await esperarAviso('Comunicação registrada.');
  await painelFechado();
  ok('canais gravados', JSON.stringify((await tabela('nota_liberacao'))[0].canais) === JSON.stringify(['loja', 'email']));
  await ir('/operacao/notas');
  await c.ate(`document.querySelector('main table')`);
  ok('a lista mostra a publicada e onde foi comunicada', (await texto('main table')).includes('Publicada') && (await texto('main table')).includes('Loja de apps, E-mail'));
});

for (const largura of [768, 360]) {
  await passo(`editor e prévia em ${largura}px`, async () => {
    await c.tamanho(largura, largura === 360 ? 780 : 900);
    await ir(`/operacao/notas/${nota.id}`);
    await c.ate(`document.querySelector('main h1')`);
    await c.espera(250);
    await conferirTela('/operacao/notas/[id]', largura);
    await aba('Prévia');
    await conferirTela('prévia', largura);
    await c.foto(`previa-${largura}`);
  });
}
await c.tamanho(1440, 900);

await h.terminar();
