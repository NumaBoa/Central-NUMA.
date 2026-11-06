import { chaveDaTabela, driver } from './armazenamento';

export const FUSO_PADRAO = 'America/Sao_Paulo';

/** As quatro zonas oficiais do Brasil. */
export const ROTULOS_FUSO = {
  'America/Sao_Paulo': 'Brasília · São Paulo (UTC−3)',
  'America/Manaus': 'Manaus (UTC−4)',
  'America/Rio_Branco': 'Rio Branco (UTC−5)',
  'America/Noronha': 'Fernando de Noronha (UTC−2)',
} as const;

export type Fuso = keyof typeof ROTULOS_FUSO;

export const FUSOS = Object.keys(ROTULOS_FUSO) as [Fuso, ...Fuso[]];

function fusoValido(valor: unknown): valor is Fuso {
  return typeof valor === 'string' && Object.hasOwn(ROTULOS_FUSO, valor);
}

let ultimaLeitura: { texto: string | null; fuso: string } | null = null;

/**
 * O fuso de T02.01, de que depende o "hoje" do sistema (RT-06). A leitura é síncrona porque datas
 * são calculadas o tempo todo; só relê a tabela quando ela muda. Sem dados, ou com dados
 * danificados, vale o padrão.
 */
export function fusoConfigurado(): string {
  try {
    const texto = driver().getItem(chaveDaTabela('configuracao'));
    if (ultimaLeitura?.texto === texto) return ultimaLeitura.fuso;
    const linhas: unknown = texto ? JSON.parse(texto) : [];
    const linha = Array.isArray(linhas) ? (linhas as { chave?: unknown; valor?: unknown }[]).find((item) => item?.chave === 'fuso') : undefined;
    const fuso = fusoValido(linha?.valor) ? linha.valor : FUSO_PADRAO;
    ultimaLeitura = { texto, fuso };
    return fuso;
  } catch {
    return FUSO_PADRAO;
  }
}
