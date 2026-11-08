// T12.05 Incidentes de disponibilidade num Chrome de verdade: registrar com comunicação e a pergunta de dados
// pessoais, em andamento e encerrar, disponibilidade do mês com o critério e a meta da oferta (créditos
// possíveis), vínculo com solicitação e os três tamanhos. Uso: node t1205.mjs <pasta> <url>
import { iniciar } from './apoio.mjs';
import { ID_KIPI, scriptDoContrato, somarDias } from './semear-m12.mjs';

const h = await iniciar({ nome: 't1205', porta: 9465 });
const { c, ok, passo, ir, texto, preencher, escolher, esperarAviso, pularAbertura, tabela, conferirTela, painelAberto, painelFechado, clicarNoDialogo } = h;
const js = (v) => JSON.stringify(v);

await ir('/meu-dia');
const hoje = await c.avaliar(`new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(new Date())`);
await pularAbertura();
await c.avaliar(scriptDoContrato(hoje));
const diaDaQueda = hoje.endsWith('-01') ? hoje : somarDias(hoje, -1);
const diasNoMes = new Date(Date.UTC(Number(hoje.slice(0, 4)), Number(hoje.slice(5, 7)), 0)).getUTCDate();
const esperada = `${((1 - 300 / (diasNoMes * 1440)) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 3 })}%`;

const clicarBotao = async (rotulo, dentro = 'main') => {
  await c.ate(`[...document.querySelectorAll(${js(dentro + ' button')})].some(b=>b.textContent.trim()===${js(rotulo)}&&!b.disabled&&b.getBoundingClientRect().width>0)`);
  await c.avaliar(`[...document.querySelectorAll(${js(dentro + ' button')})].find(b=>b.textContent.trim()===${js(rotulo)}&&!b.disabled&&b.getBoundingClientRect().width>0).click()`);
};
const pilula = (grupo, rotulo) => c.avaliar(`(()=>{const f=[...document.querySelectorAll('.janela fieldset')].find(x=>x.querySelector('legend')?.textContent.startsWith(${js(grupo)}));[...f.querySelectorAll('label')].find(l=>l.textContent.trim()===${js(rotulo)}).click()})()`);
const aba = async (rotulo) => {
  const alvo = `[...document.querySelectorAll('main [role=tab]')].find(a=>a.textContent.trim()===${js(rotulo)})`;
  await c.avaliar(`(()=>{const a=${alvo};a.focus();a.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}))})()`);
  await c.ate(`${alvo}.getAttribute('data-state')==='active'`);
};

for (const largura of [1440, 768, 360]) {
  await passo(`tela em ${largura}px`, async () => {
    await c.tamanho(largura, largura === 360 ? 780 : 900);
    await ir('/operacao/incidentes');
    await c.ate(`document.querySelector('main').textContent.includes('Nenhum incidente registrado.')`);
    await c.ate(`document.querySelector('main [data-disponibilidade]')`);
    await c.espera(250);
    await conferirTela('/operacao/incidentes', largura);
  });
}
await c.tamanho(1440, 900);

await passo('sem incidente: 100%, dentro da meta da oferta, com o critério à vista', async () => {
  const painel = await texto('main section[aria-label="Disponibilidade do mês"]');
  ok('o critério da conta', painel.includes('1 − (minutos de quedas totais + 50% dos minutos de quedas parciais)'));
  ok('Kipi a 100%, meta da oferta lida do M07', painel.includes('100,00%') && painel.includes('Oferta Kipi Equipe: meta 99,5%. Dentro da meta.'), painel.slice(0, 400));
});

await passo('registrar: comunicação exige canal; dados pessoais avisa a pendência do M09', async () => {
  await clicarBotao('Novo incidente');
  await painelAberto();
  await escolher('inc-produto', ID_KIPI);
  await preencher('inc-titulo', 'Login fora do ar');
  await preencher('inc-inicio-dia', diaDaQueda);
  await preencher('inc-inicio-hora', '00:00');
  await preencher('inc-fim-dia', diaDaQueda);
  await preencher('inc-fim-hora', '05:00');
  await c.avaliar(`[...document.querySelectorAll('.janela label')].find(l=>l.textContent.includes('Os clientes foram comunicados')).querySelector('input').click()`);
  await c.ate(`document.getElementById('inc-canal')`);
  await pilula('Envolve dados pessoais?', 'Sim');
  await c.ate(`document.querySelector('.janela').textContent.includes('precisa também de um registro de incidente de segurança')`);
  ok('a pendência do M09 aparece, sem vínculo inventado', (await texto('.janela')).includes('o vínculo não é criado'));
  await clicarNoDialogo('Registrar incidente');
  await c.ate(`document.getElementById('inc-canal-erro')`);
  ok('pede o canal e quando', (await h.erroDe('inc-canal')).includes('por qual canal') && (await h.erroDe('inc-comunicado-dia')).includes('quando'));
  await preencher('inc-comunicado-dia', diaDaQueda);
  await preencher('inc-comunicado-hora', '00:20');
  await preencher('inc-canal', 'E-mail aos clientes');
  await clicarNoDialogo('Registrar incidente');
  await esperarAviso('Incidente INC-2026-0001 registrado.');
  await c.ate(`location.pathname.startsWith('/operacao/incidentes/')&&document.querySelector('main h1')`);
  const [incidente] = await tabela('incidente_disponibilidade');
  ok('gravado: total, comunicado, dados pessoais, sem incidente de segurança', incidente?.impacto === 'total' && incidente.comunicado && incidente.canal === 'E-mail aos clientes' && incidente.envolve_dados_pessoais === true && incidente.incidente_seguranca_id === null, JSON.stringify(incidente ?? {}));
  const corpo = await texto();
  ok('a ficha mostra a duração e a pendência', corpo.includes('5 h') && corpo.includes('Encerrado') && corpo.includes('precisa também de um registro de incidente de segurança'));
});

await passo('disponibilidade do mês cai e aponta créditos possíveis (RN-12.11)', async () => {
  await ir('/operacao/incidentes');
  await c.ate(`document.querySelector('main [data-disponibilidade]')?.textContent.includes(${js(esperada)})`, 8000);
  const cartao = await texto(`main [data-disponibilidade=${js(ID_KIPI)}]`);
  ok('a conta do mês', cartao.includes(esperada) && cartao.includes('300 min de queda total'), cartao);
  ok('abaixo da meta: créditos possíveis, decisão manual, com a compensação da oferta', cartao.includes('Abaixo da meta: créditos possíveis, decisão manual (10% da mensalidade do mês)'));
});

await passo('incidente em andamento e encerrar', async () => {
  await clicarBotao('Novo incidente');
  await painelAberto();
  await escolher('inc-produto', ID_KIPI);
  await preencher('inc-titulo', 'Lentidão na agenda');
  await preencher('inc-inicio-dia', diaDaQueda);
  await preencher('inc-inicio-hora', '01:00');
  await pilula('Impacto', 'Degradado');
  await pilula('Envolve dados pessoais?', 'Não');
  await clicarNoDialogo('Registrar incidente');
  await esperarAviso('em andamento');
  await c.ate(`document.querySelector('main h1')?.textContent==='Lentidão na agenda'`);
  ok('em andamento', (await texto()).includes('Em andamento'));
  await clicarBotao('Encerrar incidente');
  await painelAberto();
  await clicarNoDialogo('Encerrar');
  await esperarAviso('Incidente encerrado.');
  await painelFechado();
  ok('encerrado', Boolean((await tabela('incidente_disponibilidade')).find((linha) => linha.titulo === 'Lentidão na agenda')?.fim));
});

await passo('vincular uma solicitação ao incidente', async () => {
  await ir('/operacao/suporte');
  await c.ate(`document.querySelector('main h1')`);
  await clicarBotao('Nova solicitação');
  await painelAberto();
  await preencher('sup-solicitante', 'Maria, maria@exemplo.com');
  await escolher('sup-produto', ID_KIPI);
  await preencher('sup-titulo', 'Não consigo entrar');
  await clicarNoDialogo('Abrir solicitação');
  await esperarAviso('SUP-2026-0001 aberta');
  const [incidente] = (await tabela('incidente_disponibilidade')).filter((linha) => linha.titulo === 'Login fora do ar');
  await ir(`/operacao/incidentes/${incidente.id}`);
  await c.ate(`document.querySelector('main h1')`);
  await aba('Solicitações');
  await clicarBotao('Vincular solicitação');
  await painelAberto();
  const [solicitacao] = await tabela('solicitacao_suporte');
  await escolher('inc-solicitacao', solicitacao.id);
  await clicarNoDialogo('Vincular');
  await esperarAviso('Solicitação vinculada.');
  await painelFechado();
  await c.ate(`document.querySelector('main ul[aria-label="Solicitações vinculadas"]')`);
  ok('a solicitação aponta para o incidente', (await tabela('solicitacao_suporte'))[0].incidente_id === incidente.id);
  await ir(`/operacao/suporte/${solicitacao.id}`);
  await c.ate(`document.querySelector('main h1')`);
  await aba('Vínculos');
  ok('e a ficha da solicitação leva ao incidente', (await texto()).includes('INC-2026-0001 · Login fora do ar'));
});

for (const largura of [768, 360]) {
  await passo(`ficha e janela em ${largura}px`, async () => {
    await c.tamanho(largura, largura === 360 ? 780 : 900);
    const [incidente] = await tabela('incidente_disponibilidade');
    await ir(`/operacao/incidentes/${incidente.id}`);
    await c.ate(`document.querySelector('main h1')`);
    await c.espera(250);
    await conferirTela('/operacao/incidentes/[id]', largura);
    await ir('/operacao/incidentes');
    await c.ate(`document.querySelector('main').textContent.includes('INC-2026-0001')`);
    await conferirTela('/operacao/incidentes com dados', largura);
    await clicarBotao('Novo incidente');
    await painelAberto();
    await c.espera(300);
    await conferirTela('novo incidente', largura);
    await c.foto(`novo-${largura}`);
  });
}
await c.tamanho(1440, 900);

await h.terminar();
