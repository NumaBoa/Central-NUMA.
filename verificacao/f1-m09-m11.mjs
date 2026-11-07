// Verificação da frente M09, M10 e M11 num Chrome de verdade: rotas nos três tamanhos e os fluxos principais.
// Sem o catálogo do M07 (o build de produção nunca liga o de exemplo): as pendências precisam explicar isso.
import { iniciar, ID_KIMBERLY } from './apoio.mjs';

const h = await iniciar({ nome: 'f1-m09-m11', porta: 9391 });
const { c, ok, passo, ir, texto, preencher, escolher, esperarAviso, pularAbertura, tabela, conferirTela, painelAberto } = h;
const js = (v) => JSON.stringify(v);
const ID_KIPI = 'c4e2a3f6-9d51-4c32-8e23-2b3c4d5e6f03';
const ID_MODELO_SAAS = 'a1c2e3f4-5b6d-4e7f-8a9b-0c1d2e3f4a01';
const tituloDaPagina = () => c.avaliar(`document.querySelector('main h1')?.textContent ?? ''`);
const esperarTitulo = (titulo) => c.ate(`document.querySelector('main h1')?.textContent.includes(${js(titulo)})`);
const clicarBotao = async (rotulo) => {
  await c.ate(`[...document.querySelectorAll('main button, .janela button, main a')].some(b=>b.textContent.trim()===${js(rotulo)}&&!b.disabled&&b.getBoundingClientRect().width>0)`);
  await c.avaliar(`[...document.querySelectorAll('.janela button, main button, main a')].reverse().find(b=>b.textContent.trim()===${js(rotulo)}&&!b.disabled&&b.getBoundingClientRect().width>0).click()`);
};
const etapa = async (rotulo) => { await c.avaliar(`[...document.querySelectorAll('nav button')].find(b=>b.textContent.replace(/^\\d+/,'').startsWith(${js(rotulo)})).click()`); await c.espera(200); };
const clicarRotulo = (rotulo) => c.avaliar(`[...document.querySelectorAll('.janela label, main label')].find(l=>l.textContent.trim()===${js(rotulo)}).click()`);

const ROTAS = [
  ['/legal', 'Documentos legais'],
  ['/legal/privacidade', 'Inventário de tratamento'],
  ['/legal/privacidade/solicitacoes', 'Solicitações de titulares'],
  ['/legal/modelos', 'Modelos de documentos'],
  ['/legal/modelos/clausulas', 'Biblioteca de cláusulas'],
  [`/legal/modelos/${ID_MODELO_SAAS}`, 'Contrato de licença SaaS'],
  ['/comercial', 'Funil comercial'],
  ['/comercial/propostas', 'Propostas'],
  ['/comercial/contrapartes', 'Contrapartes'],
  ['/contratos', 'Contratos'],
  ['/contratos/novo', 'Novo contrato'],
  ['/contratos/assinatura/novo', 'Novo contrato de assinatura'],
  ['/contratos/renovacao', 'Renovação'],
  ['/contratos/adesoes', 'Adesão padrão'],
];

await c.tamanho(1440, 900);
await ir('/meu-dia');
await pularAbertura();

for (const largura of [1440, 768, 360]) {
  await passo(`rotas em ${largura}px`, async () => {
    await c.tamanho(largura, largura === 360 ? 780 : 900);
    for (const [rota, titulo] of ROTAS) {
      await ir(rota);
      await esperarTitulo(titulo);
      await c.espera(250);
      await conferirTela(rota, largura);
    }
    await c.foto(`rotas-${largura}`);
  });
}

await c.tamanho(1440, 900);

await passo('M09: pendência do produto com usuários reais (CA-09.01)', async () => {
  await ir('/legal');
  await esperarTitulo('Documentos legais');
  await c.ate(`document.querySelector('main').textContent.includes('Nenhum documento legal ainda.')`);
  const corpo = await texto();
  ok('Kipi aparece sem Termos e Política publicados', corpo.includes('Kipi tem usuários reais e está sem Termos de Uso e Política de Privacidade publicados'), corpo.slice(0, 400));
  ok('estado vazio distingue ausência de registros', corpo.includes('Nenhum documento legal ainda.'));
  ok('as três áreas do módulo', corpo.includes('Documentos legais') && corpo.includes('Privacidade') && corpo.includes('Modelos e cláusulas'));
});

await passo('M09: rascunho → validação no registro → publicação bloqueada sem encarregado (CA-09.02)', async () => {
  await clicarBotao('Novo documento');
  await painelAberto();
  await escolher('documento-produto', ID_KIPI);
  await escolher('documento-tipo', 'privacidade');
  await clicarBotao('Criar rascunho');
  await c.ate(`location.pathname.startsWith('/legal/documentos/')`);
  await esperarTitulo('Política de Privacidade');
  await preencher('documento-texto', 'Texto da política, a validar.');
  await preencher('documento-url', 'https://kipi.exemplo/privacidade');
  await clicarBotao('Salvar versão');
  await esperarAviso('Versão salva.');
  await clicarBotao('Enviar para validação');
  await esperarAviso('Enviado para validação.');
  ok('aguarda validação, com quem pediu', (await texto()).includes('Aguardando validação') && (await texto()).includes('Pedido por Kimberly Grebe'));
  await clicarBotao('Devolver');
  await c.ate(`document.querySelector('.dialogo')`);
  await c.avaliar(`[...document.querySelectorAll('.dialogo button')].find(b=>b.textContent.trim()==='Devolver').click()`);
  await c.espera(150);
  ok('devolver sem motivo não passa', (await texto('.dialogo')).includes('Informe o motivo.'));
  await c.tecla('Escape');
  await c.espera(200);
  await clicarBotao('Validar');
  await esperarAviso('Validado.');
  await c.ate(`document.querySelector('main').textContent.includes('Configure o encarregado')`);
  const corpo = await texto();
  ok('CA-09.02: sem encarregado, a publicação fica bloqueada com o caminho', corpo.includes('Configure o encarregado de dados (DPO).') && (await c.avaliar(`Boolean(document.querySelector('main a[href="/configuracoes#legal"]'))`)));
  ok('Publicar desativado', await c.avaliar(`[...document.querySelectorAll('main button')].find(b=>b.textContent.trim()==='Publicar')?.disabled === true`));
  const [validacao] = await tabela('validacao');
  ok('a validação guarda quem decidiu e quando', validacao?.decidido_por === ID_KIMBERLY && Boolean(validacao?.decidido_em), js(validacao));
  await c.foto('m09-publicar');
});

await passo('M09: MOD-SAAS-LIC é rascunho para validação jurídica (decisão 6)', async () => {
  await ir(`/legal/modelos/${ID_MODELO_SAAS}`);
  await esperarTitulo('Contrato de licença SaaS');
  const corpo = await texto();
  ok('em rascunho, com a ressalva', corpo.includes('Rascunho') && corpo.includes('Rascunho para validação jurídica'));
  await c.clicar('texto=Prévia');
  await c.ate(`document.querySelector('main article')?.textContent.includes('CONTRATO DE LICENÇA DE USO')`);
  ok('a prévia mostra o texto do arquivo, com marca d’água', await c.avaliar(`document.querySelector('main article').textContent.includes('RASCUNHO')`));
  ok('nenhum script no documento', await c.avaliar(`!document.querySelector('main article script')`));
});

await passo('M10: oportunidade com próxima ação no Meu dia (RN-10.02)', async () => {
  await ir('/comercial');
  await esperarTitulo('Funil comercial');
  await c.ate(`document.querySelector('main').textContent.includes('Nenhuma oportunidade ainda.')`);
  ok('vazio do funil', true);
  await clicarBotao('Nova oportunidade');
  await painelAberto();
  await c.avaliar(`document.getElementById('op-contraparte').focus()`);
  await preencher('op-contraparte', 'Souza');
  await c.ate(`document.querySelector('.janela [role=option]')`);
  await c.avaliar(`document.querySelector('.janela [role=option] button').click()`);
  await preencher('op-titulo', 'Kipi para a Souza');
  await clicarRotulo('Kipi');
  await clicarBotao('Salvar');
  await c.ate(`location.pathname.startsWith('/comercial/oportunidades/')`);
  await esperarTitulo('Kipi para a Souza');
  ok('sem próxima ação, avisa', (await texto()).includes('Esta oportunidade está sem próxima ação'));
  await clicarBotao('Próxima ação');
  await painelAberto();
  await preencher('acao-titulo', 'Ligar para a Souza');
  await preencher('acao-prazo', '2026-11-20');
  await clicarBotao('Registrar');
  await esperarAviso('Próxima ação registrada no Meu dia.');
  const atividades = await tabela('atividade');
  const acao = atividades.find((linha) => linha.titulo === 'Ligar para a Souza');
  const vinculos = await tabela('vinculo');
  ok('é uma tarefa do Meu dia, vinculada à oportunidade', acao?.tipo === 'tarefa' && vinculos.some((linha) => [linha.origem_id, linha.destino_id].includes(acao.id) && [linha.origem_tipo, linha.destino_tipo].includes('oportunidade')));
  const contraparte = (await tabela('contraparte')).find((linha) => linha.nome.startsWith('Souza'));
  ok('a contraparte vira prospect, sem perder o papel anterior', contraparte?.papeis.includes('prospect') && contraparte?.papeis.includes('fornecedor'), js(contraparte?.papeis));
});

await passo('M10: proposta sem catálogo: item sob medida, totais separados, pendências explicadas', async () => {
  await clicarBotao('Nova proposta');
  await c.ate(`location.pathname.startsWith('/comercial/propostas/')`);
  await esperarTitulo('Proposta para');
  await etapa('Itens');
  await clicarBotao('Adicionar oferta');
  await painelAberto();
  ok('sem M07, a oferta explica a pendência', (await texto('.janela')).includes('ainda não está conectado'));
  await c.tecla('Escape');
  await c.espera(250);
  await clicarBotao('Item sob medida');
  await painelAberto();
  await preencher('item-descricao', 'Implantação assistida');
  await preencher('item-valor', '2.000,00');
  await preencher('item-justificativa', 'Escopo combinado');
  await clicarBotao('Salvar');
  await esperarAviso('Item adicionado.');
  await c.ate(`document.querySelector('main').textContent.includes('Único: R$')`);
  ok('CA-10.02: o único aparece com rótulo', (await texto()).replace(/ /g, ' ').includes('Único: R$ 2.000,00'));
  await etapa('Revisão');
  await c.espera(200);
  const corpo = await texto();
  ok('pendências navegáveis: modelo e entidade', corpo.includes('Escolha o modelo de proposta') && corpo.includes('ainda não está Ativa'));
  ok('Emitir final desativado', await c.avaliar(`[...document.querySelectorAll('main button')].find(b=>b.textContent.trim()==='Emitir final')?.disabled === true`));
  await c.foto('m10-revisao');
});

await passo('M11: assistente e T11.14 com catálogo ausente', async () => {
  await ir('/contratos/novo');
  await esperarTitulo('Novo contrato');
  await preencher('novo-titulo', 'Contabilidade mensal');
  await escolher('novo-familia', 'fornecedor');
  await c.avaliar(`document.getElementById('novo-contraparte').focus()`);
  await preencher('novo-contraparte', 'Souza');
  await c.ate(`document.querySelector('main [role=option]')`);
  await c.avaliar(`document.querySelector('main [role=option] button').click()`);
  await clicarBotao('Criar rascunho');
  await c.ate(`location.pathname.endsWith('/editar')`);
  await esperarTitulo('Contabilidade mensal');
  await etapa('Revisão');
  await c.espera(250);
  ok('CA-11.03: Planejada salva, e o final explica o bloqueio', (await texto()).includes('ainda não está Ativa'));
  ok('Enviar para revisão bloqueado sem itens e vigência', await c.avaliar(`[...document.querySelectorAll('main button')].find(b=>b.textContent.trim()==='Enviar para revisão')?.disabled === true`));

  await ir('/contratos/assinatura/novo');
  await esperarTitulo('Novo contrato de assinatura');
  await preencher('saas-titulo', 'Kipi Revenda');
  await c.avaliar(`document.getElementById('saas-contraparte').focus()`);
  await preencher('saas-contraparte', 'Souza');
  await c.ate(`document.querySelector('main [role=option]')`);
  await c.avaliar(`document.querySelector('main [role=option] button').click()`);
  await clicarBotao('Criar rascunho');
  await c.ate(`location.pathname.endsWith('/editar')`);
  await esperarTitulo('Kipi Revenda');
  await c.ate(`document.querySelector('section[aria-label="Prévia do documento"] article')?.textContent.includes('CONTRATO DE LICENÇA')`);
  ok('prévia ao vivo do modelo, com variáveis vazias realçadas', await c.avaliar(`document.querySelectorAll('section[aria-label="Prévia do documento"] article button').length > 10`));
  await etapa('Condições');
  await preencher('saas-multa', '5');
  await c.espera(150);
  ok('CA-11.16: multa de 5% recusada com a mensagem do CDC', (await texto()).includes('Máximo de 2% (CDC, art. 52, §1º)'));
  await etapa('Revisão e emissão');
  await c.ate(`document.querySelector('main').textContent.includes('catálogo de ofertas e preços (M07)')`);
  ok('sem M07, a pendência diz por que o final espera', true);
  await etapa('Condições');
  await preencher('saas-multa', '2');
  await c.foto('m11-saas');
});

await passo('Meu dia continua lendo a próxima ação', async () => {
  await ir('/meu-dia');
  await c.ate(`document.querySelector('main article')`);
  ok('a tarefa da oportunidade está no Meu dia', (await texto()).includes('Ligar para a Souza'));
});

await h.terminar();
