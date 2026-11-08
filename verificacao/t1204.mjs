// T12.04 Regras de SLA num Chrome de verdade: regras por oferta, a promessa da oferta (M07) só lida e a
// divergência, validação, exceção por contrato e os três tamanhos. Uso: node t1204.mjs <pasta> <url>
import { iniciar } from './apoio.mjs';
import { ID_CONTRATO, ID_OFERTA, scriptDoContrato } from './semear-m12.mjs';

const h = await iniciar({ nome: 't1204', porta: 9463 });
const { c, ok, passo, ir, texto, preencher, escolher, esperarAviso, pularAbertura, tabela, conferirTela, painelAberto, painelFechado, clicarNoDialogo, dialogoAberto } = h;
const js = (v) => JSON.stringify(v);

await ir('/meu-dia');
const hoje = await c.avaliar(`new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(new Date())`);
await pularAbertura();
await c.avaliar(scriptDoContrato(hoje));

const cartao = `document.querySelector('main [data-oferta=${js(ID_OFERTA)}]')`;
const clicarPorRotulo = (rotulo) => c.avaliar(`document.querySelector('main button[aria-label=${js(rotulo)}]').click()`);
const regras = async (linhas) => {
  for (const [prioridade, [resposta, resolucao]] of Object.entries(linhas)) {
    await preencher(`sla-${prioridade}-resposta`, resposta);
    await preencher(`sla-${prioridade}-resolucao`, resolucao);
  }
};

for (const largura of [1440, 768, 360]) {
  await passo(`tela em ${largura}px`, async () => {
    await c.tamanho(largura, largura === 360 ? 780 : 900);
    await ir('/operacao/sla');
    await c.ate(`document.querySelector('main h1')?.textContent==='Regras de SLA'`);
    await c.ate(`${cartao}`);
    await c.espera(250);
    await conferirTela('/operacao/sla', largura);
    await c.foto(`sla-${largura}`);
  });
}
await c.tamanho(1440, 900);

await passo('a oferta começa sem regras, e a promessa vem do M07', async () => {
  const corpo = await texto(`main [data-oferta=${js(ID_OFERTA)}]`);
  ok('sem regras: Sem SLA', corpo.includes('Sem regras'));
  ok('a promessa da oferta, só leitura', corpo.includes('até 4 horas úteis') && corpo.includes('99,5%') && corpo.includes('10% da mensalidade do mês') && corpo.includes('Editar na oferta'), corpo.slice(0, 300));
  ok('o link leva à oferta no M07', await c.avaliar(`[...${cartao}.querySelectorAll('a')].some(a=>a.getAttribute('href').includes('/ofertas/'+${js(ID_OFERTA)}))`));
});

await passo('definir regras: padrão 9h–18h em horas úteis', async () => {
  await clicarPorRotulo('Definir as regras de Kipi Equipe');
  await painelAberto();
  ok('o horário vem 9h–18h (D25)', (await h.valor('sla-inicio')) === '09:00' && (await h.valor('sla-fim')) === '18:00');
  await regras({ critica: ['8', '16'], normal: ['16', '40'] });
  await clicarNoDialogo('Salvar regras');
  await esperarAviso('Regras salvas.');
  await painelFechado();
  const linhas = await tabela('sla_regra');
  ok('duas linhas, da oferta, com o horário', linhas.length === 2 && linhas.every((linha) => linha.oferta_id === ID_OFERTA && !linha.contrato_id && linha.horario_inicio === '09:00' && linha.contagem === 'horas_uteis'), JSON.stringify(linhas.map((l) => l.prioridade)));
  await c.ate(`${cartao}.textContent.includes('8 h')`);
  ok('a regra que promete menos que a oferta é apontada', (await texto(`main [data-oferta=${js(ID_OFERTA)}]`)).includes('A oferta promete primeira resposta em até 4 horas úteis no caso crítico; a regra dá 8 h.'));
  ok('prioridade em branco: Sem SLA', (await texto(`main [data-oferta=${js(ID_OFERTA)}] table`)).includes('Sem SLA'));
});

await passo('editar até concordar com a oferta', async () => {
  await clicarPorRotulo('Editar as regras de Kipi Equipe');
  await painelAberto();
  await regras({ critica: ['4', '16'] });
  await clicarNoDialogo('Salvar regras');
  await esperarAviso('Regras salvas.');
  await painelFechado();
  await c.ate(`!${cartao}.textContent.includes('a regra dá 8 h')`);
  ok('a divergência some', true);
});

await passo('validação: só a resposta, sem a resolução', async () => {
  await clicarPorRotulo('Editar as regras de Kipi Equipe');
  await painelAberto();
  await regras({ alta: ['2', ''] });
  await clicarNoDialogo('Salvar regras');
  await esperarAviso('Alta: informe a primeira resposta e a resolução');
  ok('nada muda', (await tabela('sla_regra')).filter((linha) => !linha.arquivado_em).length === 2);
  await c.tecla('Escape');
  await c.ate(`document.querySelector('.dialogo, .janela')`);
  if (await c.avaliar(`Boolean([...document.querySelectorAll('.dialogo button')].find(b=>b.textContent.trim()==='Descartar alterações'))`)) await clicarNoDialogo('Descartar alterações');
  await painelFechado();
});

await passo('exceção de contrato: horas corridas, disponibilidade e créditos', async () => {
  await c.avaliar(`[...document.querySelectorAll('main button')].find(b=>b.textContent.trim()==='Exceção de contrato').click()`);
  await painelAberto();
  await escolher('sla-contrato', ID_CONTRATO);
  await c.ate(`document.getElementById('sla-disponibilidade')`);
  await c.avaliar(`[...document.querySelectorAll('.janela label')].find(l=>l.textContent.trim()==='Horas corridas').click()`);
  await c.ate(`!document.getElementById('sla-inicio')`);
  await regras({ critica: ['1', '4'] });
  await preencher('sla-disponibilidade', '99,9');
  await preencher('sla-creditos', '5% por hora de indisponibilidade');
  await clicarNoDialogo('Salvar regras');
  await esperarAviso('Regras salvas.');
  await painelFechado();
  const excecao = (await tabela('sla_regra')).find((linha) => linha.contrato_id === ID_CONTRATO);
  ok('grava a exceção sem horário', excecao?.contagem === 'horas_corridas' && excecao.horario_inicio === null && excecao.disponibilidade_minima === 99.9, JSON.stringify(excecao ?? {}));
  await c.ate(`document.querySelector('main section[aria-label="Exceções por contrato"]').textContent.includes('99,9%')`);
  ok('a exceção aparece com o contrato', (await texto('main section[aria-label="Exceções por contrato"]')).includes('CTR-2026-0901'));
});

await passo('remover as regras da exceção', async () => {
  await c.avaliar(`[...document.querySelectorAll('main section[aria-label="Exceções por contrato"] button')].find(b=>b.textContent.trim()==='Remover regras').click()`);
  await dialogoAberto();
  await clicarNoDialogo('Remover regras');
  await esperarAviso('Regras removidas.');
  await c.ate(`document.querySelector('main section[aria-label="Exceções por contrato"]').textContent.includes('Nenhuma exceção')`);
  ok('a exceção vai para o histórico', (await tabela('sla_regra')).filter((linha) => linha.contrato_id === ID_CONTRATO && linha.arquivado_em).length === 1);
});

await passo('360px: a janela das regras cabe no celular', async () => {
  await c.tamanho(360, 780);
  await ir('/operacao/sla');
  await c.ate(`${cartao}`);
  await clicarPorRotulo('Editar as regras de Kipi Equipe');
  await painelAberto();
  await c.espera(300);
  await conferirTela('janela das regras', 360);
  await c.foto('janela-360');
  await c.tamanho(1440, 900);
});

await h.terminar();
