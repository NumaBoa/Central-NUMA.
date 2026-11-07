/**
 * Motor dos modelos (T09.07, RN-09.14 e 19): variáveis `{{a.b}}`, `[SE ...]` e `[PARA CADA ...]`, sem
 * executar código. As condições só aceitam as formas abaixo, os caminhos só leem propriedades próprias e
 * o resultado é uma estrutura de nós, nunca HTML: a tela mostra tudo como texto, e nada digitado vira script.
 */

const TOKEN = /\{\{\s*([^{}]*?)\s*\}\}|\[SE ([^\]]*)\]|\[FIM SE\]|\[PARA CADA ([^\]]*)\]|\[FIM PARA\]/g;
const CAMINHO = /^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*$/;
const CONDICAO = /^([A-Za-z_][A-Za-z0-9_.]*)\s*(=|≠|>=|<=|>|<|contém)\s*(?:"([^"]*)"|(-?\d+(?:[.,]\d+)?))$/;
const CLAUSULA_NO_INICIO = /^(?:\*\*)?(\d+\.\d+)\./gm;
const NAO_APLICAVEL = '(não aplicável)';
const MAXIMO_REPETICOES = 500;

// Marcas internas: variável vazia e caracteres de valor que não podem virar formatação.
const INICIO_VAZIA = '';
const FIM_VAZIA = '';
const PROTEGIDOS: Readonly<Record<string, string>> = { '|': '', '*': '', '#': '', _: '', '-': '' };
const DESPROTEGER = new Map(Object.entries(PROTEGIDOS).map(([original, marca]) => [marca, original]));

type No = { t: 'texto'; v: string } | { t: 'var'; nome: string } | { t: 'se'; condicao: string; corpo: No[]; fonte: string } | { t: 'para'; lista: string; corpo: No[] };

export type AnaliseDoTexto = { nos: No[]; erros: string[]; variaveis: string[]; listas: string[]; condicoes: string[] };

/** Só estrutura: serve para o editor apontar erros antes de salvar. */
export function analisarTexto(fonte: string): AnaliseDoTexto {
  const erros: string[] = [];
  const raiz: No[] = [];
  const pilha: { no: Extract<No, { t: 'se' | 'para' }>; inicio: number }[] = [];
  const variaveis = new Set<string>();
  const listas = new Set<string>();
  const condicoes = new Set<string>();
  const destino = () => pilha[pilha.length - 1]?.no.corpo ?? raiz;
  let ultimo = 0;
  for (const achado of fonte.matchAll(TOKEN)) {
    const indice = achado.index;
    if (indice > ultimo) destino().push({ t: 'texto', v: fonte.slice(ultimo, indice) });
    ultimo = indice + achado[0].length;
    if (achado[0].startsWith('{{')) {
      const nome = achado[1] ?? '';
      if (!CAMINHO.test(nome)) {
        erros.push(`Variável inválida: ${achado[0]}.`);
        continue;
      }
      variaveis.add(nome);
      destino().push({ t: 'var', nome });
    } else if (achado[0].startsWith('[SE ')) {
      const condicao = (achado[2] ?? '').trim();
      if (!condicaoValida(condicao)) erros.push(`Condição não reconhecida: [SE ${condicao}].`);
      condicoes.add(condicao);
      const no: Extract<No, { t: 'se' }> = { t: 'se', condicao, corpo: [], fonte: '' };
      destino().push(no);
      pilha.push({ no, inicio: ultimo });
    } else if (achado[0].startsWith('[PARA CADA ')) {
      const lista = (achado[3] ?? '').trim();
      if (!CAMINHO.test(lista)) erros.push(`Lista inválida: [PARA CADA ${lista}].`);
      listas.add(lista);
      const no: Extract<No, { t: 'para' }> = { t: 'para', lista, corpo: [] };
      destino().push(no);
      pilha.push({ no, inicio: ultimo });
    } else {
      const esperado = achado[0] === '[FIM SE]' ? 'se' : 'para';
      const aberto = pilha[pilha.length - 1];
      if (!aberto || aberto.no.t !== esperado) {
        erros.push(`${achado[0]} sem o início correspondente.`);
        continue;
      }
      pilha.pop();
      if (aberto.no.t === 'se') aberto.no.fonte = fonte.slice(aberto.inicio, indice);
    }
  }
  if (ultimo < fonte.length) destino().push({ t: 'texto', v: fonte.slice(ultimo) });
  for (const { no } of pilha) erros.push(no.t === 'se' ? `[SE ${no.condicao}] sem [FIM SE].` : `[PARA CADA ${no.lista}] sem [FIM PARA].`);
  return { nos: raiz, erros, variaveis: [...variaveis], listas: [...listas], condicoes: [...condicoes] };
}

function condicaoValida(condicao: string): boolean {
  return CAMINHO.test(condicao) || CONDICAO.test(condicao);
}

type Escopo = { dados: unknown; item?: unknown };

/** Só propriedades próprias: `constructor`, `__proto__` e afins não existem aqui. */
function ler(caminho: string, { dados, item }: Escopo): unknown {
  const partes = caminho.split('.');
  let atual: unknown = partes[0] === 'item' && item !== undefined ? item : dados;
  for (const parte of partes[0] === 'item' && item !== undefined ? partes.slice(1) : partes) {
    if (atual === null || typeof atual !== 'object' || !Object.hasOwn(atual, parte)) return undefined;
    atual = (atual as Record<string, unknown>)[parte];
  }
  return atual;
}

function preenchido(valor: unknown): boolean {
  if (valor === null || valor === undefined || valor === false) return false;
  if (typeof valor === 'string') return valor.trim().length > 0;
  if (typeof valor === 'number') return valor !== 0;
  if (Array.isArray(valor)) return valor.length > 0;
  return true;
}

function comoNumero(valor: unknown): number | null {
  if (typeof valor === 'number') return valor;
  if (typeof valor === 'string' && valor.trim() !== '') {
    const lido = Number(valor.replace(',', '.'));
    return Number.isFinite(lido) ? lido : null;
  }
  return null;
}

export function avaliarCondicao(condicao: string, escopo: Escopo): boolean {
  const comparacao = CONDICAO.exec(condicao);
  if (!comparacao) return CAMINHO.test(condicao) && preenchido(ler(condicao, escopo));
  const [, caminho = '', operador, palavra, numero] = comparacao;
  const valor = ler(caminho, escopo);
  const alvo = palavra ?? numero ?? '';
  switch (operador) {
    case '=':
      return String(valor ?? '') === alvo;
    case '≠':
      return String(valor ?? '') !== alvo;
    case 'contém':
      return Array.isArray(valor) ? valor.map(String).includes(alvo) : String(valor ?? '').includes(alvo);
    default: {
      const esquerda = comoNumero(valor);
      const direita = comoNumero(alvo);
      if (esquerda === null || direita === null) return false;
      if (operador === '>') return esquerda > direita;
      if (operador === '<') return esquerda < direita;
      return operador === '>=' ? esquerda >= direita : esquerda <= direita;
    }
  }
}

function paraTexto(valor: unknown): string {
  if (typeof valor === 'number') return valor.toLocaleString('pt-BR', { maximumFractionDigits: 4 });
  if (typeof valor === 'boolean') return valor ? 'Sim' : 'Não';
  return String(valor);
}

/** O valor entra como texto puro: quebras viram espaço, e o que formataria o documento fica protegido. */
function protegerValor(valor: string): string {
  return valor.replace(/\s*\n\s*/g, ' ').replace(/[|*#_-]/g, (letra) => PROTEGIDOS[letra] ?? letra);
}

type Expansao = { vazias: Set<string>; usadas: Set<string> };

function expandir(nos: readonly No[], escopo: Escopo, saida: Expansao, listaAtual: string | null): string {
  let texto = '';
  for (const no of nos) {
    if (no.t === 'texto') texto += no.v;
    else if (no.t === 'var') {
      const rotulo = no.nome.startsWith('item.') && listaAtual ? `${listaAtual}[].${no.nome.slice(5)}` : no.nome;
      saida.usadas.add(rotulo);
      const valor = ler(no.nome, escopo);
      if (valor === null || valor === undefined || (typeof valor === 'string' && !valor.trim()) || (typeof valor === 'object' && !Array.isArray(valor)) || Array.isArray(valor)) {
        saida.vazias.add(rotulo);
        texto += `${INICIO_VAZIA}${rotulo}${FIM_VAZIA}`;
      } else texto += protegerValor(paraTexto(valor));
    } else if (no.t === 'se') {
      if (avaliarCondicao(no.condicao, escopo)) texto += expandir(no.corpo, escopo, saida, listaAtual);
      else texto += clausulasNaoAplicaveis(no);
    } else {
      const lista = ler(no.lista, escopo);
      const itens = (Array.isArray(lista) ? lista : []).slice(0, MAXIMO_REPETICOES);
      const repetidos = itens.map((item) => expandir(no.corpo, { dados: escopo.dados, item }, saida, no.lista));
      // Dentro de uma tabela, cada item é uma linha dela.
      const ehLinhaDeTabela = no.corpo.some((filho) => filho.t === 'texto' && filho.v.includes('|'));
      texto += repetidos.join(ehLinhaDeTabela ? ' |\n| ' : '');
    }
  }
  return texto;
}

/** Bloco ausente não renumera: no lugar das cláusulas dele, sai "(não aplicável)". Seção inteira alternativa não deixa rastro. */
function clausulasNaoAplicaveis(no: Extract<No, { t: 'se' }>): string {
  if (/^\s*##\s/.test(no.fonte)) return '';
  const numeros = [...no.fonte.matchAll(CLAUSULA_NO_INICIO)].map((achado) => achado[1]);
  return [...new Set(numeros)].map((numero) => `\n${numero}. ${NAO_APLICAVEL}\n`).join('');
}

/** Se a mesma cláusula saiu de verdade em outro bloco, o aviso de ausência sai de cena. */
function limparNaoAplicaveis(texto: string): string {
  const linhas = texto.split('\n');
  const reais = new Set<string>();
  const avisadas = new Set<string>();
  const padrao = new RegExp(`^(\\d+\\.\\d+)\\. \\${NAO_APLICAVEL.slice(0, -1)}\\)$`);
  for (const linha of linhas) {
    if (padrao.test(linha.trim())) continue;
    const real = /^(?:\*\*)?(\d+\.\d+)\./.exec(linha.trim());
    if (real?.[1]) reais.add(real[1]);
  }
  return linhas
    .filter((linha) => {
      const aviso = padrao.exec(linha.trim());
      if (!aviso?.[1]) return true;
      if (reais.has(aviso[1]) || avisadas.has(aviso[1])) return false;
      avisadas.add(aviso[1]);
      return true;
    })
    .join('\n');
}

// ---------- Do texto expandido para os nós do documento ----------

export type Trecho = { texto: string; negrito?: boolean; italico?: boolean; variavelVazia?: string };
export type NoDocumento =
  | { tipo: 'titulo'; nivel: 1 | 2; trechos: Trecho[] }
  | { tipo: 'paragrafo'; trechos: Trecho[]; destaque: boolean; naoAplicavel?: boolean }
  | { tipo: 'item'; trechos: Trecho[] }
  | { tipo: 'tabela'; linhas: Trecho[][][]; comCabecalho: boolean }
  | { tipo: 'regra' };

const desproteger = (texto: string) => texto.replace(/[-]/g, (marca) => DESPROTEGER.get(marca) ?? marca);

function trechosDe(linha: string): Trecho[] {
  const trechos: Trecho[] = [];
  const empurrar = (texto: string, negrito: boolean, italico: boolean) => {
    if (!texto) return;
    const pedacos = texto.split(new RegExp(`(${INICIO_VAZIA}[^${FIM_VAZIA}]*${FIM_VAZIA})`));
    for (const pedaco of pedacos) {
      if (!pedaco) continue;
      if (pedaco.startsWith(INICIO_VAZIA)) trechos.push({ texto: pedaco.slice(1, -1), variavelVazia: pedaco.slice(1, -1), negrito });
      else trechos.push({ texto: desproteger(pedaco), ...(negrito ? { negrito } : {}), ...(italico ? { italico } : {}) });
    }
  };
  for (const parte of linha.split(/(\*\*[^*]+\*\*)/)) {
    if (parte.startsWith('**') && parte.endsWith('**') && parte.length > 4) empurrar(parte.slice(2, -2), true, false);
    else if (/^\*[^*]+\*$/.test(parte.trim())) empurrar(parte.trim().slice(1, -1), false, true);
    else empurrar(parte, false, false);
  }
  return trechos;
}

const celulasDe = (linha: string) => linha.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((celula) => celula.trim());
const celulaVazia = (celula: string) => !celula.replace(/\*/g, '').trim();

function paraNos(texto: string): NoDocumento[] {
  const nos: NoDocumento[] = [];
  const linhas = texto.split('\n');
  for (let i = 0; i < linhas.length; i++) {
    const linha = (linhas[i] ?? '').trim();
    if (!linha) continue;
    if (/^-{3,}$/.test(linha)) {
      nos.push({ tipo: 'regra' });
      continue;
    }
    if (linha.startsWith('|')) {
      const bloco: string[] = [];
      while (i < linhas.length && (linhas[i] ?? '').trim().startsWith('|')) bloco.push((linhas[i++] ?? '').trim());
      i -= 1;
      const separador = bloco.findIndex((item) => /^\|[\s:|-]+\|$/.test(item) && item.includes('-'));
      const semSeparador = bloco.filter((_, indice) => indice !== separador);
      const cabecalhoVazio = separador === 1 && celulasDe(bloco[0] ?? '').every(celulaVazia);
      const uteis = (cabecalhoVazio ? semSeparador.slice(1) : semSeparador).map(celulasDe).filter((celulas) => !celulas.every(celulaVazia));
      if (uteis.length) nos.push({ tipo: 'tabela', comCabecalho: separador === 1 && !cabecalhoVazio, linhas: uteis.map((celulas) => celulas.map(trechosDe)) });
      continue;
    }
    const titulo = /^(#{1,2})\s+(.*)$/.exec(linha);
    if (titulo) {
      nos.push({ tipo: 'titulo', nivel: titulo[1]?.length === 1 ? 1 : 2, trechos: trechosDe(titulo[2] ?? '') });
      continue;
    }
    if (linha.startsWith('- ')) {
      nos.push({ tipo: 'item', trechos: trechosDe(linha.slice(2)) });
      continue;
    }
    // RN-11.40: o trecho limitativo sai todo em negrito (CDC, art. 54, §4º). A marca não aparece no documento.
    if (linha.includes('[DESTAQUE]')) {
      const limpa = linha.replace(/\*\*\[DESTAQUE\]\*\*\s*/, '').replace(/\[DESTAQUE\]\s*/, '');
      nos.push({ tipo: 'paragrafo', destaque: true, trechos: trechosDe(limpa).map((trecho) => ({ ...trecho, negrito: true })) });
      continue;
    }
    nos.push({ tipo: 'paragrafo', destaque: false, trechos: trechosDe(linha), ...(linha.endsWith(NAO_APLICAVEL) ? { naoAplicavel: true } : {}) });
  }
  return nos;
}

export type DocumentoRenderizado = {
  nos: NoDocumento[];
  /** Variáveis vazias nos trechos que entraram: as obrigatórias bloqueiam a emissão final (RN-09.14). */
  vazias: string[];
  usadas: string[];
  erros: string[];
};

/** Sem erro de estrutura, sempre devolve um documento: as variáveis vazias vão realçadas, nunca inventadas. */
export function renderizarTexto(fonte: string, dados: unknown): DocumentoRenderizado {
  const analise = analisarTexto(fonte);
  const saida: Expansao = { vazias: new Set(), usadas: new Set() };
  const expandido = limparNaoAplicaveis(expandir(analise.nos, { dados }, saida, null));
  return { nos: paraNos(expandido), vazias: [...saida.vazias], usadas: [...saida.usadas], erros: analise.erros };
}

/** O texto corrido do documento, para comparar e buscar. */
export function textoDoDocumento(nos: readonly NoDocumento[]): string {
  const deTrechos = (trechos: readonly Trecho[]) => trechos.map((trecho) => (trecho.variavelVazia ? `[${trecho.variavelVazia}]` : trecho.texto)).join('');
  return nos
    .map((no) => {
      if (no.tipo === 'regra') return '---';
      if (no.tipo === 'tabela') return no.linhas.map((linha) => linha.map(deTrechos).join(' | ')).join('\n');
      return deTrechos(no.trechos);
    })
    .join('\n');
}
