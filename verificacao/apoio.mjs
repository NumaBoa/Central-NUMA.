// Apoio comum às suítes de navegador das telas.
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { abrirChrome } from './cdp.mjs';

const js = (v) => JSON.stringify(v);

export const ID_KIMBERLY = '0b7f1c52-3f6e-4a1b-9d2c-5e8a7c4f1a01';
export const ID_CAMILA = '1c8e2d63-4a7f-4b2c-8e3d-6f9b8d5a2b02';
export const ID_BRUNA = '2d9f3e74-5b8a-4c3d-9f4e-7a0c9e6b3c03';
export const ID_RAFAEL = '3ea04f85-6c9b-4d4e-8a5f-8b1d0f7c4d04';

export const MEDIR = `(()=>{const cs=e=>getComputedStyle(e);const vis=e=>{const b=e.getBoundingClientRect();return b.width>1&&b.height>1&&cs(e).visibility!=='hidden'};const r={larguraJanela:innerWidth,rolagemLateral:document.documentElement.scrollWidth>innerWidth};
const menor=[];document.querySelectorAll('body *').forEach(e=>{if(vis(e)&&[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())){const s=parseFloat(cs(e).fontSize);if(s<12)menor.push(s+':'+e.textContent.trim().slice(0,24))}});r.textoAbaixo12=menor;
const alvos=[];document.querySelectorAll('a,button:not(:disabled),select:not(:disabled),input:not(:disabled):not([type=file]),[role=tab]').forEach(e=>{if(e.classList.contains('sr-only'))return;if(e.matches('input[type=checkbox]')){const q=e.closest('label')?.getBoundingClientRect();if(q&&q.height>=44&&q.width>=44)return}if(vis(e)&&e.getAttribute('href')!=='#conteudo'){const b=e.getBoundingClientRect();if(b.height<44||b.width<44)alvos.push((e.textContent.trim().slice(0,20)||e.getAttribute('aria-label')||e.id)+' '+Math.round(b.width)+'x'+Math.round(b.height))}});r.alvosAbaixo44=alvos;
const c16=[];document.querySelectorAll('input:not([type=file]):not([type=radio]):not([type=checkbox]),select,textarea').forEach(e=>{if(vis(e)&&parseFloat(cs(e).fontSize)<16)c16.push((e.id||e.getAttribute('aria-label'))+':'+cs(e).fontSize)});r.camposAbaixo16=c16;return r})()`;

export async function iniciar({ nome, porta, rotinas = false }) {
  const scratch = process.argv[2];
  const BASE = process.argv[3] || 'http://localhost:3000';
  const fotos = path.join(scratch, nome);
  mkdirSync(fotos, { recursive: true });
  const c = await abrirChrome({ scratch, porta, pastaFotos: fotos });
  // Sem isto, depois de navegar, a janela sem foco não dispara os eventos de foco e de saída dos campos.
  await c.enviar('Emulation.setFocusEmulationEnabled', { enabled: true });
  // Sem as rotinas do dia, os números não dependem do dia da semana. Só a suíte delas liga.
  if (!rotinas) await c.enviar('Page.addScriptToEvaluateOnNewDocument', { source: `(()=>{try{const k='numa-central:v1:meta';const m=JSON.parse(localStorage.getItem(k)||'{}');if(!m.ultima_rotina_em){m.ultima_rotina_em=new Date().toISOString();localStorage.setItem(k,JSON.stringify(m))}}catch{}})()` });

  const resultados = [];
  const inicio = Date.now();
  const ok = (rotulo, passou, extra) => resultados.push(`${passou ? 'OK   ' : 'FALHA'} ${rotulo}${extra !== undefined ? ` [${extra}]` : ''}`);

  async function passo(rotulo, fn) {
    console.log(`--- ${rotulo} (${Math.round((Date.now() - inicio) / 1000)}s)`);
    const antes = resultados.length;
    const errosAntes = c.erros.length;
    try {
      await fn();
    } catch (e) {
      resultados.push(`ERRO  ${rotulo}: ${e.message}`);
      try {
        const d = await c.avaliar(`JSON.stringify({caminho:location.pathname+location.search,avisos:[...document.querySelectorAll('[data-sonner-toast]')].map(t=>t.textContent),dialogo:document.querySelector('.dialogo,.painel-lateral')?.textContent.slice(0,200)??null,abertura:Boolean(document.querySelector('.abertura'))})`);
        console.log('    estado:', d);
        await c.foto(`erro-${rotulo.replaceAll(/[^a-z0-9]+/gi, '-')}`);
      } catch {}
    }
    for (const r of resultados.slice(antes)) if (r.startsWith('FALHA') || r.startsWith('ERRO')) console.log(r);
    if (c.erros.length > errosAntes) console.log(`ERRO NO CONSOLE em "${rotulo}": ${c.erros.slice(errosAntes).join(' || ').slice(0, 7000)}`);
  }

  const h = {
    c,
    BASE,
    ok,
    passo,
    ir: (caminho) => c.ir(BASE + caminho),
    texto: (seletor = 'main') => c.avaliar(`document.querySelector(${js(seletor)})?.textContent ?? ''`),
    valor: (id) => c.avaliar(`document.getElementById(${js(id)})?.value`),
    ultimoAviso: () => c.avaliar(`[...document.querySelectorAll('[data-sonner-toast]')].map(t=>t.textContent).join(' | ')`),
    esperarAviso: (parte) => c.ate(`[...document.querySelectorAll('[data-sonner-toast]')].some(t=>t.textContent.includes(${js(parte)}))`),
    preencher: (id, novo) =>
      c.avaliar(`(()=>{const e=document.getElementById(${js(id)});e.focus();const p=e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(e,${js(novo)});e.dispatchEvent(new Event('input',{bubbles:true}))})()`),
    sair: (id) => c.avaliar(`document.getElementById(${js(id)}).blur()`),
    escolher: (id, novo) => c.avaliar(`(()=>{const s=document.getElementById(${js(id)});Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,${js(novo)});s.dispatchEvent(new Event('change',{bubbles:true}))})()`),
    opcoes: (id) => c.avaliar(`[...document.getElementById(${js(id)}).options].map(o=>o.textContent)`),
    erroDe: (id) => c.avaliar(`document.getElementById(${js(id + '-erro')})?.textContent ?? ''`),
    /** O id do campo pelo rótulo, dentro de um painel ou diálogo: os ids gerados não são fixos. */
    idPorRotulo: (rotulo) => c.avaliar(`[...document.querySelectorAll('.dialogo label,.painel-lateral label')].find(l=>l.textContent.startsWith(${js(rotulo)}))?.htmlFor`),
    /** Pílula de escolha pelo texto, dentro de um grupo com aquele título. */
    marcarPilula: (grupo, opcao) =>
      c.avaliar(`(()=>{const f=[...document.querySelectorAll('fieldset')].find(x=>x.querySelector('legend')?.textContent.startsWith(${js(grupo)}));[...f.querySelectorAll('label')].find(l=>l.textContent===${js(opcao)}).querySelector('input').click()})()`),
    pilulaMarcada: (grupo, opcao) =>
      c.avaliar(`(()=>{const f=[...document.querySelectorAll('fieldset')].find(x=>x.querySelector('legend')?.textContent.startsWith(${js(grupo)}));return [...f.querySelectorAll('label')].find(l=>l.textContent===${js(opcao)})?.querySelector('input').checked})()`),
    existeGrupo: (grupo) => c.avaliar(`[...document.querySelectorAll('fieldset')].some(x=>x.querySelector('legend')?.textContent.startsWith(${js(grupo)}))`),
    clicarNoDialogo: (rotulo) => c.avaliar(`[...document.querySelectorAll('.dialogo button,.painel-lateral button')].reverse().find(b=>b.textContent.trim()===${js(rotulo)}).click()`),
    dialogoAberto: () => c.ate(`document.querySelector('.dialogo')`),
    dialogoFechado: () => c.ate(`!document.querySelector('.dialogo')`),
    painelAberto: () => c.ate(`document.querySelector('.painel-lateral')`),
    painelFechado: () => c.ate(`!document.querySelector('.painel-lateral')`),
    /** Pula a abertura do dia: a tecla só funciona depois que ela está na tela. */
    pularAbertura: async () => {
      await c.ate(`document.querySelector('.abertura')`);
      await c.tecla('a');
      await c.ate(`!document.querySelector('.abertura')`);
    },
    /** Lê uma tabela diretamente, só para conferir o que foi gravado. */
    tabela: (nomeTabela) => c.avaliar(`JSON.parse(localStorage.getItem('numa-central:v1:${nomeTabela}')||'[]')`),
    medir: () => c.avaliar(MEDIR),
    conferirTela: async (rotulo, largura) => {
      await c.ate(`document.getAnimations().every((a)=>a.playState!=='running'||a.effect?.getTiming().iterations===Infinity)`, 3000).catch(() => {});
      const m = await c.avaliar(MEDIR);
      ok(`${rotulo}: sem rolagem lateral em ${largura}px`, !m.rolagemLateral && m.larguraJanela === largura, m.larguraJanela);
      ok(`${rotulo}: nada abaixo de 12px em ${largura}px`, m.textoAbaixo12.length === 0, m.textoAbaixo12.join(','));
      if (largura < 768) {
        ok(`${rotulo}: alvos de 44px em ${largura}px`, m.alvosAbaixo44.length === 0, m.alvosAbaixo44.join(' | '));
        ok(`${rotulo}: campos de 16px em ${largura}px`, m.camposAbaixo16.length === 0, m.camposAbaixo16.join(','));
      }
    },
    terminar: async () => {
      const falhas = resultados.filter((r) => !r.startsWith('OK') && !r.startsWith('  '));
      console.log(resultados.filter((r) => r.startsWith('OK')).length ? '' : '(nenhuma verificação passou)');
      console.log(`=== ${resultados.filter((r) => r.startsWith('OK')).length} OK, ${falhas.length} com problema`);
      console.log('=== console:', c.erros.length ? '\n' + [...new Set(c.erros)].join('\n') : 'sem erros nem avisos');
      await c.fechar();
      process.exit(0);
    },
  };
  return h;
}
