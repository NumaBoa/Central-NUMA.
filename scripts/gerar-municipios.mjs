/**
 * Gera src/dados/referencia/municipios-ibge.json a partir do arquivo oficial do IBGE (API de
 * Localidades). Nada aqui é digitado à mão: para atualizar a lista, rode de novo e registre a data
 * no Mapa.
 *
 *   node scripts/gerar-municipios.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ENDERECO = 'https://servicodados.ibge.gov.br/api/v1/localidades/municipios?view=nivelado';
const DESTINO = fileURLToPath(new URL('../src/dados/referencia/municipios-ibge.json', import.meta.url));
const TOTAL_DE_UFS = 27;

const resposta = await fetch(ENDERECO);
if (!resposta.ok) throw new Error(`O IBGE respondeu ${resposta.status}. Nada foi alterado.`);
const linhas = await resposta.json();
if (!Array.isArray(linhas)) throw new Error('O IBGE não devolveu uma lista. Nada foi alterado.');

const porUf = new Map();
for (const linha of linhas) {
  const sigla = linha['UF-sigla'];
  const nome = linha['UF-nome'];
  const municipio = linha['municipio-nome'];
  if (typeof sigla !== 'string' || !/^[A-Z]{2}$/.test(sigla) || typeof nome !== 'string' || !nome || typeof municipio !== 'string' || !municipio) {
    throw new Error(`Linha inesperada do IBGE: ${JSON.stringify(linha).slice(0, 200)}. Nada foi alterado.`);
  }
  if (!porUf.has(sigla)) porUf.set(sigla, { sigla, nome, municipios: [] });
  porUf.get(sigla).municipios.push(municipio);
}
if (porUf.size !== TOTAL_DE_UFS) throw new Error(`Eram esperadas ${TOTAL_DE_UFS} UFs, vieram ${porUf.size}. Nada foi alterado.`);

const emOrdem = (a, b) => a.localeCompare(b, 'pt-BR');
const ufs = [...porUf.values()]
  .sort((a, b) => emOrdem(a.nome, b.nome))
  .map((uf) => ({ ...uf, municipios: uf.municipios.sort(emOrdem) }));

const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const cabecalho = { fonte: 'IBGE, API de Localidades', endereco: ENDERECO, consultado_em: hoje, total: linhas.length };

// Uma UF por linha: quando a lista mudar, a diferença aparece só na UF que mudou.
const texto = `{\n${Object.entries(cabecalho)
  .map(([chave, valor]) => `  ${JSON.stringify(chave)}: ${JSON.stringify(valor)},`)
  .join('\n')}\n  "ufs": [\n${ufs.map((uf) => `    ${JSON.stringify(uf)}`).join(',\n')}\n  ]\n}\n`;

mkdirSync(dirname(DESTINO), { recursive: true });
writeFileSync(DESTINO, texto);
console.log(`${linhas.length} municípios em ${ufs.length} UFs, consultados em ${hoje}.`);
