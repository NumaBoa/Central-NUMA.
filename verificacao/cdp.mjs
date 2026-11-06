// Controla um Chrome de verdade pelo DevTools Protocol: cliques e teclas reais, tamanhos exatos.
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

export async function abrirChrome({ scratch, porta = 9333, pastaFotos }) {
  const dialogosNativos = [];
  const perfil = path.join(scratch, `perfil-cdp-${porta}`);
  rmSync(perfil, { recursive: true, force: true });
  mkdirSync(pastaFotos, { recursive: true });
  const processo = spawn(CHROME, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${porta}`, `--user-data-dir=${perfil}`, '--no-first-run', '--safebrowsing-disable-download-protection', '--disable-component-update', '--window-size=1500,1000', 'about:blank'], { stdio: 'ignore' });

  let alvo;
  for (let i = 0; i < 60 && !alvo; i++) {
    await espera(250);
    try {
      const lista = await (await fetch(`http://127.0.0.1:${porta}/json/list`)).json();
      alvo = lista.find((t) => t.type === 'page');
    } catch {}
  }
  if (!alvo) throw new Error('Chrome não respondeu');

  const ws = new WebSocket(alvo.webSocketDebuggerUrl);
  await new Promise((ok, erro) => { ws.onopen = ok; ws.onerror = erro; });
  let seq = 0;
  const pendentes = new Map();
  const ouvintes = new Map();
  const erros = [];
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id) {
      const p = pendentes.get(d.id);
      pendentes.delete(d.id);
      d.error ? p.erro(new Error(`${p.metodo}: ${d.error.message}`)) : p.ok(d.result);
      return;
    }
    (ouvintes.get(d.method) || []).forEach((f) => f(d.params));
    if (d.method === 'Page.javascriptDialogOpening') {
      dialogosNativos.push(d.params.type);
      enviar('Page.handleJavaScriptDialog', { accept: true }).catch(() => {});
    }
    if (d.method === 'Runtime.exceptionThrown') erros.push('EXCEÇÃO: ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text).slice(0, 6000));
    if (d.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(d.params.type)) erros.push(d.params.type.toUpperCase() + ': ' + d.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 400));
    if (d.method === 'Log.entryAdded' && ['error', 'warning'].includes(d.params.entry.level)) erros.push('LOG: ' + d.params.entry.text.slice(0, 300) + ' ' + (d.params.entry.url || ''));
  };
  const enviar = (metodo, params = {}) => new Promise((ok, erro) => {
    const id = ++seq;
    pendentes.set(id, { ok, erro, metodo });
    ws.send(JSON.stringify({ id, method: metodo, params }));
  });
  const uma = (evento) => new Promise((ok) => {
    const f = (p) => { ouvintes.set(evento, (ouvintes.get(evento) || []).filter((x) => x !== f)); ok(p); };
    ouvintes.set(evento, [...(ouvintes.get(evento) || []), f]);
  });
  await enviar('Page.enable');
  await enviar('Runtime.enable');
  await enviar('Log.enable');

  const avaliar = async (expressao) => {
    // (o aviso nativo é respondido no recebimento das mensagens)
    const r = await enviar('Runtime.evaluate', { expression: expressao, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('avaliar: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    return r.result.value;
  };
  let tamanhoAtual = { largura: 1440, altura: 900, celular: false };
  const rolagemParada = async () => {
    let anterior;
    for (let i = 0; i < 80; i++) {
      const atual = await avaliar(`scrollY`);
      if (atual === anterior) return;
      anterior = atual;
      await espera(50);
    }
  };

  const api = {
    espera,
    erros,
    dialogosNativos,
    avaliar,
    enviar,
    async tamanho(largura, altura, celular = largura < 768) {
      tamanhoAtual = { largura, altura, celular };
      await enviar('Emulation.setDeviceMetricsOverride', { width: largura, height: altura, deviceScaleFactor: 1, mobile: celular });
      await enviar('Emulation.setTouchEmulationEnabled', { enabled: celular });
    },
    async reduzirMovimento(ligar) {
      await enviar('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: ligar ? 'reduce' : '' }] });
    },
    async ir(url) {
      const carregou = uma('Page.loadEventFired');
      await enviar('Page.navigate', { url });
      await carregou;
    },
    async recarregar() {
      const carregou = uma('Page.loadEventFired');
      await enviar('Page.reload');
      await carregou;
    },
    /** Espera a condição virar verdadeira e devolve quanto levou, em ms. */
    async ate(expressao, limite = 15000) {
      const t0 = Date.now();
      while (Date.now() - t0 < limite) {
        if (await avaliar(`Boolean(${expressao})`)) return Date.now() - t0;
        await espera(15);
      }
      throw new Error(`não aconteceu em ${limite}ms: ${expressao}`);
    },
    /** Clique real no centro do elemento visível. Aceita seletor CSS ou o texto do elemento. */
    async clicar(alvoClique) {
      const achar = alvoClique.startsWith('texto=')
        ? `[...document.querySelectorAll('button,a,label,[role=link],[role=tab]')].filter(e=>e.offsetParent!==null||getComputedStyle(e).position==='fixed').find(e=>e.textContent.trim().startsWith(${JSON.stringify(alvoClique.slice(6))}))`
        : `[...document.querySelectorAll(${JSON.stringify(alvoClique)})].find(e=>{const c=e.getBoundingClientRect();return c.width>0&&c.height>0})`;
      // A rolagem suave pode estar em curso (um focus() a dispara): só mede com a página parada.
      await rolagemParada();
      await avaliar(`(()=>{const e=${achar};if(e)e.scrollIntoView({block:'center',behavior:'instant'})})()`);
      await rolagemParada();
      const caixa = await avaliar(`(()=>{const e=${achar};if(!e)return null;const c=e.getBoundingClientRect();return {x:c.left+c.width/2,y:c.top+c.height/2}})()`);
      if (!caixa) throw new Error('não achei para clicar: ' + alvoClique);
      if (tamanhoAtual.celular) {
        await enviar('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [caixa] });
        await enviar('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      } else {
        await enviar('Input.dispatchMouseEvent', { type: 'mouseMoved', ...caixa });
        await enviar('Input.dispatchMouseEvent', { type: 'mousePressed', ...caixa, button: 'left', clickCount: 1 });
        await enviar('Input.dispatchMouseEvent', { type: 'mouseReleased', ...caixa, button: 'left', clickCount: 1 });
      }
      await espera(40);
    },
    /** Clique num ponto da tela, sem depender de elemento. */
    async clicarPonto(x, y) {
      await enviar('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
      await enviar('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
      await enviar('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
      await espera(40);
    },
    async tecla(key, { ctrl = false, shift = false } = {}) {
      const codigos = { Escape: 27, Enter: 13, Tab: 9, ArrowDown: 40, ArrowUp: 38, ArrowRight: 39, ArrowLeft: 37, ' ': 32 };
      const vk = codigos[key] ?? key.toUpperCase().charCodeAt(0);
      const modifiers = (ctrl ? 2 : 0) + (shift ? 8 : 0);
      const code = key === ' ' ? 'Space' : key.length === 1 ? `Key${key.toUpperCase()}` : key;
      await enviar('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: vk, modifiers, ...(key === 'Enter' ? { text: '\r' } : key.length === 1 && !ctrl ? { text: key } : {}) });
      await enviar('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: vk, modifiers });
      await espera(40);
    },
    async digitar(texto) {
      await enviar('Input.insertText', { text: texto });
      await espera(40);
    },
    async enviarArquivo(seletor, caminho) {
      const { root } = await enviar('DOM.getDocument');
      const { nodeId } = await enviar('DOM.querySelector', { nodeId: root.nodeId, selector: seletor });
      await enviar('DOM.setFileInputFiles', { files: [caminho], nodeId });
      await espera(60);
    },
    async foto(nome, { inteira = false } = {}) {
      const r = await enviar('Page.captureScreenshot', { format: 'png', captureBeyondViewport: inteira });
      writeFileSync(path.join(pastaFotos, nome + '.png'), Buffer.from(r.data, 'base64'));
    },
    async fechar() {
      try { await enviar('Browser.close'); } catch {}
      processo.kill();
    },
  };
  return api;
}
