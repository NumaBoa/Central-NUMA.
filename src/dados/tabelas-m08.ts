import type { z } from 'zod';
import { esquemaArquivo, esquemaArquivoContexto, esquemaArquivoVersao, esquemaArquivoVinculo, esquemaCampanha, esquemaConsentimentoTexto, esquemaInscrito, esquemaListaEspera, esquemaMarcaIdentidade, esquemaPecaConteudo } from './tipos/marketing';

/** Tabelas do M08, à parte para não disputar linhas com as frentes paralelas em `tabelas.ts`. */
export const TABELAS_M08 = {
  arquivo: { rotulo: 'Biblioteca', esquema: esquemaArquivo },
  arquivo_contexto: { rotulo: 'Contextos dos arquivos', esquema: esquemaArquivoContexto },
  arquivo_versao: { rotulo: 'Versões dos arquivos', esquema: esquemaArquivoVersao },
  arquivo_vinculo: { rotulo: 'Vínculos dos arquivos', esquema: esquemaArquivoVinculo },
  marca_identidade: { rotulo: 'Identidade das marcas', esquema: esquemaMarcaIdentidade },
  campanha: { rotulo: 'Campanhas', esquema: esquemaCampanha },
  peca_conteudo: { rotulo: 'Peças de conteúdo', esquema: esquemaPecaConteudo },
  lista_espera: { rotulo: 'Listas de espera', esquema: esquemaListaEspera },
  consentimento_texto: { rotulo: 'Textos de consentimento', esquema: esquemaConsentimentoTexto },
  inscrito: { rotulo: 'Inscritos', esquema: esquemaInscrito },
} as const satisfies Record<string, { rotulo: string; esquema: z.ZodType }>;

export const NOMES_TABELAS_M08 = Object.keys(TABELAS_M08) as (keyof typeof TABELAS_M08)[];

/** Fora da contagem de cadastros (`dominio/dados.ts`): partes de outro registro, ou a identidade, que é da marca. */
export const TABELAS_M08_FORA_DA_CONTAGEM = ['arquivo_contexto', 'arquivo_versao', 'arquivo_vinculo', 'marca_identidade', 'consentimento_texto'] as const;
