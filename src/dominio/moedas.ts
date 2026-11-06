export type OpcaoMoeda = { codigo: string; nome: string };
export type ListaDeMoedas = { maisUsadas: readonly OpcaoMoeda[]; demais: readonly OpcaoMoeda[] };

export const MOEDA_REAL = 'BRL';
const MAIS_USADAS = [MOEDA_REAL, 'USD', 'EUR'];

/** Códigos reservados pela ISO 4217 que não são dinheiro: "moeda desconhecida" e "teste". */
const NAO_SAO_MOEDA = new Set(['XXX', 'XTS']);

const nomes = new Intl.DisplayNames(['pt-BR'], { type: 'currency' });

export function nomeDaMoeda(codigo: string): string {
  try {
    return nomes.of(codigo) ?? codigo;
  } catch {
    return codigo;
  }
}

/** Decisão de 05/11/2026: a lista vem do próprio navegador. Sem esse recurso, ficam as mais usadas. */
function codigosDoNavegador(): readonly string[] {
  return typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('currency') : [];
}

type OpcoesDaLista = {
  /** O valor já salvo continua na lista, mesmo que este navegador não o conheça. */
  atual?: string;
  /** No câmbio de referência, a cotação é sempre em reais: o real não entra. */
  semReal?: boolean;
};

/** Moedas ISO 4217 com nome em português: BRL, USD e EUR no topo, as demais em ordem alfabética. */
export function listarMoedas({ atual, semReal = false }: OpcoesDaLista = {}): ListaDeMoedas {
  const paraOpcao = (codigo: string): OpcaoMoeda => ({ codigo, nome: nomeDaMoeda(codigo) });
  const entra = (codigo: string) => !semReal || codigo !== MOEDA_REAL;
  const temNomeEmPortugues = (codigo: string) => nomeDaMoeda(codigo) !== codigo;

  const demais = new Set(codigosDoNavegador().filter((codigo) => !MAIS_USADAS.includes(codigo) && !NAO_SAO_MOEDA.has(codigo) && temNomeEmPortugues(codigo)));
  if (atual && !MAIS_USADAS.includes(atual)) demais.add(atual);

  return {
    maisUsadas: MAIS_USADAS.filter(entra).map(paraOpcao),
    demais: [...demais]
      .filter(entra)
      .map(paraOpcao)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
  };
}
