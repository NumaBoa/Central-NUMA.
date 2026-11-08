// Gera o PDF de cada manual a partir da página de impressão (/manual/<módulo>), num Chrome local: nada externo.
// O conteúdo é o mesmo da tela de ajuda e da busca (src/ajuda). As fontes da Numa vão embutidas no arquivo.
//
// Uso, com a Central de pé (npm run dev ou npm start):
//   node scripts/gerar-manuais.mjs [endereço] [módulos...]
//   node scripts/gerar-manuais.mjs http://localhost:3000 meu-dia
// Sem módulos, gera todos os de src/ajuda/manuais (o nome do arquivo é o do endereço).
//
// Duas passadas: a primeira descobre em que página começa cada artigo (pelos links do sumário no próprio PDF);
// a segunda escreve esses números no sumário e gera o arquivo final, em public/manuais.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { abrirChrome } from '../verificacao/cdp.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SAIDA = path.join(RAIZ, 'public', 'manuais');
const [endereco = 'http://localhost:3000', ...pedidos] = process.argv.slice(2);
const modulos = pedidos.length
  ? pedidos
  : readdirSync(path.join(RAIZ, 'src', 'ajuda', 'manuais'))
      .filter((nome) => nome.endsWith('.ts') && !nome.endsWith('.test.ts'))
      .map((nome) => nome.replace(/\.ts$/, ''));

/** Os objetos do PDF que não são fluxos de conteúdo, por número. O Chrome não usa fluxos de objetos. */
function objetosDoPdf(bytes) {
  const texto = bytes.toString('latin1');
  const objetos = new Map();
  const padrao = /(\d+) 0 obj\s*([\s\S]*?)endobj/g;
  for (let m; (m = padrao.exec(texto)); ) objetos.set(Number(m[1]), m[2]);
  // Se algum dia vierem fluxos de objetos, eles também são lidos.
  for (const [, corpo] of objetos) {
    if (!/\/Type\s*\/ObjStm/.test(corpo)) continue;
    const inicio = corpo.indexOf('stream') + 'stream'.length;
    const bruto = Buffer.from(corpo.slice(inicio, corpo.lastIndexOf('endstream')).replace(/^\r?\n/, ''), 'latin1');
    const conteudo = inflateSync(bruto).toString('latin1');
    const n = Number(/\/N\s+(\d+)/.exec(corpo)[1]);
    const primeiro = Number(/\/First\s+(\d+)/.exec(corpo)[1]);
    const pares = conteudo.slice(0, primeiro).trim().split(/\s+/).map(Number);
    for (let i = 0; i < n; i++) objetos.set(pares[2 * i], conteudo.slice(primeiro + pares[2 * i + 1], i + 1 < n ? primeiro + pares[2 * i + 3] : undefined));
  }
  return objetos;
}

/** Em que página (1, 2…) começa cada artigo, lendo os destinos dos links internos do PDF. */
function paginasDosArtigos(bytes) {
  const objetos = objetosDoPdf(bytes);
  const raiz = Number(/\/Root\s+(\d+) 0 R/.exec(bytes.toString('latin1'))[1]);
  const arvore = Number(/\/Pages\s+(\d+) 0 R/.exec(objetos.get(raiz))[1]);
  const paginas = [];
  const percorrer = (numero) => {
    const corpo = objetos.get(numero);
    if (/\/Type\s*\/Page\b(?!s)/.test(corpo)) return paginas.push(numero);
    const filhos = /\/Kids\s*\[([^\]]*)\]/.exec(corpo)[1].match(/\d+ 0 R/g) ?? [];
    filhos.forEach((ref) => percorrer(Number(ref.split(' ')[0])));
  };
  percorrer(arvore);
  const numeroDaPagina = new Map(paginas.map((obj, i) => [obj, i + 1]));

  // Destinos com nome: no catálogo (/Dests) ou numa árvore de nomes (/Names /Dests).
  const destinos = new Map();
  const lerDestinos = (corpo) => {
    for (const m of corpo.matchAll(/\/([^\s/[\]<>()]+)\s*\[\s*(\d+) 0 R\s*\/XYZ/g)) destinos.set(decodeURIComponent(m[1].replace(/#([0-9a-f]{2})/gi, '%$1')), numeroDaPagina.get(Number(m[2])));
    for (const m of corpo.matchAll(/\(([^)]*)\)\s*\[\s*(\d+) 0 R\s*\/XYZ/g)) destinos.set(m[1], numeroDaPagina.get(Number(m[2])));
  };
  objetos.forEach((corpo) => {
    if (/\/XYZ/.test(corpo)) lerDestinos(corpo);
  });
  const resultado = {};
  destinos.forEach((pagina, nome) => {
    if (nome.startsWith('artigo-')) resultado[nome.slice('artigo-'.length)] = pagina;
  });
  return { resultado, totalDePaginas: paginas.length };
}

const scratch = path.join(process.env.VERIFICACAO_PASTA ?? path.join(tmpdir(), 'central-numa-verificacao'), 'manuais');
mkdirSync(SAIDA, { recursive: true });
const c = await abrirChrome({ scratch, porta: 9390, pastaFotos: scratch });
const opcoes = { printBackground: true, preferCSSPageSize: true, generateTaggedPDF: true, generateDocumentOutline: true, transferMode: 'ReturnAsBase64' };
const manifesto = {};
try {
  for (const modulo of modulos) {
    await c.ir(`${endereco}/manual/${modulo}`);
    await c.ate(`document.querySelector('.manual-impressao')`);
    await c.avaliar('document.fonts.ready.then(() => true)');
    const dados = await c.avaliar(`(() => { const m = document.querySelector('.manual-impressao'); return { assinatura: m.dataset.assinatura, versao: m.dataset.versao, arquivo: m.dataset.arquivo, artigos: [...document.querySelectorAll('[data-pagina-de]')].map((e) => e.dataset.paginaDe) }; })()`);

    const primeira = Buffer.from((await c.enviar('Page.printToPDF', opcoes)).data, 'base64');
    const { resultado: paginas } = paginasDosArtigos(primeira);
    const faltando = dados.artigos.filter((id) => !paginas[id]);
    if (faltando.length) throw new Error(`${modulo}: sem página para ${faltando.join(', ')}`);
    await c.avaliar(`(() => { const p = ${JSON.stringify(paginas)}; document.querySelectorAll('[data-pagina-de]').forEach((e) => { e.textContent = String(p[e.dataset.paginaDe]); }); return true; })()`);

    const final = Buffer.from((await c.enviar('Page.printToPDF', opcoes)).data, 'base64');
    const conferencia = paginasDosArtigos(final);
    const mudou = dados.artigos.filter((id) => conferencia.resultado[id] !== paginas[id]);
    if (mudou.length) throw new Error(`${modulo}: as páginas mudaram entre as passadas (${mudou.join(', ')})`);

    writeFileSync(path.join(SAIDA, `${dados.arquivo}.pdf`), final);
    manifesto[modulo] = { arquivo: `${dados.arquivo}.pdf`, assinatura: dados.assinatura, paginas: conferencia.totalDePaginas };
    console.log(`${dados.arquivo}.pdf: ${conferencia.totalDePaginas} páginas, ${dados.artigos.length} artigos (${Math.round(final.length / 1024)} KB)`);
  }
} finally {
  await c.fechar();
}

const caminhoDoManifesto = path.join(SAIDA, 'manuais.json');
let anterior = {};
try {
  anterior = JSON.parse(readFileSync(caminhoDoManifesto, 'utf8'));
} catch {}
writeFileSync(caminhoDoManifesto, JSON.stringify({ ...anterior, ...manifesto }, null, 2) + '\n');
