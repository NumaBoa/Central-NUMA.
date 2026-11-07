// Gera src/dados/referencia/mod-saas-lic.ts a partir de Contrato-Licenca-SaaS-Modelo-Padrao.md (Parte 2).
// O texto é a fonte: rode de novo se o arquivo mudar, e registre a data no relatório da frente.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const fonte = readFileSync(path.join(aqui, '../../Contrato-Licenca-SaaS-Modelo-Padrao.md'), 'utf8').replaceAll('\r\n', '\n');
const inicio = fonte.indexOf('# CONTRATO DE LICENÇA DE USO');
if (inicio < 0) throw new Error('Não achei o início da casca do contrato.');
const casca = fonte.slice(inicio).trim();

// Cada "## " abre um bloco; o que vem antes é o título. As condições que envolvem um título ([SE] antes de "## 21.")
// continuam no texto: os blocos são só organização, e o documento é montado na ordem.
const partes = casca.split(/\n(?=\[SE [^\]]*\]\n## )|(?<!\[SE [^\]]*\])\n(?=## )/);
const blocos = partes.map((conteudo, indice) => {
  const titulo = conteudo.match(/^## (.+)$/m)?.[1] ?? 'Título do contrato';
  return { titulo: indice === 0 ? 'Título do contrato' : titulo, conteudo: conteudo.trim() };
});

const saida = `// GERADO por scripts/gerar-modelo-saas.mjs a partir de Contrato-Licenca-SaaS-Modelo-Padrao.md. Não edite à mão.
/** Código, versão e estado do texto-fonte: rascunho para validação jurídica, nunca validado na carga. */
export const MOD_SAAS_LIC = { codigo: 'MOD-SAAS-LIC', versao: '2.0' } as const;

export const BLOCOS_MOD_SAAS_LIC: readonly { titulo: string; conteudo: string }[] = ${JSON.stringify(blocos, null, 2)};
`;
writeFileSync(path.join(aqui, '../src/dados/referencia/mod-saas-lic.ts'), saida);
console.log(`${blocos.length} blocos`);
for (const b of blocos) console.log(' -', b.titulo);
