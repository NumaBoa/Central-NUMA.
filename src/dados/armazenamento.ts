/**
 * Único ponto que toca o localStorage (02 §0.3): um array JSON por tabela em
 * `numa-central:v1:<tabela>`. Na etapa com servidor, esta camada sai e as telas continuam iguais.
 */
import { ErroDeDados } from './erros';

export const PREFIXO_CHAVES = 'numa-central:v1:';
export const CHAVE_META = `${PREFIXO_CHAVES}meta`;

export type Driver = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;

/** Usado se o navegador bloquear o armazenamento: os dados valem até fechar a página. */
class ArmazenamentoEmMemoria implements Driver {
  private dados = new Map<string, string>();
  get length() {
    return this.dados.size;
  }
  getItem(chave: string) {
    return this.dados.get(chave) ?? null;
  }
  setItem(chave: string, valor: string) {
    this.dados.set(chave, valor);
  }
  removeItem(chave: string) {
    this.dados.delete(chave);
  }
  key(indice: number) {
    return [...this.dados.keys()][indice] ?? null;
  }
}

const memoria = new ArmazenamentoEmMemoria();
let driverDeTeste: Driver | null = null;

export function driver(): Driver {
  if (driverDeTeste) return driverDeTeste;
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  } catch {
    // navegador com o armazenamento bloqueado
  }
  return memoria;
}

/** Só para os testes: troca o armazenamento por um novo, vazio ou com falhas simuladas. */
export function usarDriverDeTeste(novo: Driver | null) {
  driverDeTeste = novo;
}
export function criarArmazenamentoEmMemoria(): Driver {
  return new ArmazenamentoEmMemoria();
}

export function chaveDaTabela(tabela: string): string {
  return `${PREFIXO_CHAVES}${tabela}`;
}

const ouvintes = new Set<() => void>();
function avisarMudanca() {
  ouvintes.forEach((avisar) => avisar());
}

/** Avisa quando qualquer tabela muda, nesta aba ou em outra aba do mesmo navegador. */
export function assinarDados(avisar: () => void): () => void {
  const aoMudarEmOutraAba = (evento: StorageEvent) => {
    if (evento.key?.startsWith(PREFIXO_CHAVES) && evento.key !== CHAVE_META) avisar();
  };
  ouvintes.add(avisar);
  if (typeof window !== 'undefined') window.addEventListener('storage', aoMudarEmOutraAba);
  return () => {
    ouvintes.delete(avisar);
    if (typeof window !== 'undefined') window.removeEventListener('storage', aoMudarEmOutraAba);
  };
}

// ---------- Transação: quem usa é `emTransacao`, em dados/transacao.ts ----------

let escritasDaTransacao: Map<string, readonly unknown[]> | null = null;

/** Falso se já houver uma aberta: quem chegou depois faz parte dela. */
export function abrirTransacao(): boolean {
  if (escritasDaTransacao) return false;
  escritasDaTransacao = new Map();
  return true;
}

export function descartarTransacao() {
  escritasDaTransacao = null;
}

export function gravarTransacao() {
  const escritas = escritasDaTransacao;
  escritasDaTransacao = null;
  if (escritas?.size) gravarTabelas(Object.fromEntries(escritas));
}

export function lerTabela<T>(tabela: string): T[] {
  const naTransacao = escritasDaTransacao?.get(tabela);
  if (naTransacao) return naTransacao as T[];
  const texto = driver().getItem(chaveDaTabela(tabela));
  if (!texto) return [];
  try {
    const linhas: unknown = JSON.parse(texto);
    if (!Array.isArray(linhas)) throw new Error('não é uma lista');
    return linhas as T[];
  } catch (causa) {
    throw new ErroDeDados('leitura', { detalhes: [tabela], cause: causa });
  }
}

/** Grava várias tabelas de uma vez: se uma falhar, todas voltam ao que eram (AR-02). */
export function gravarTabelas(alteracoes: Readonly<Record<string, readonly unknown[]>>) {
  if (escritasDaTransacao) {
    for (const [tabela, linhas] of Object.entries(alteracoes)) escritasDaTransacao.set(tabela, linhas);
    return;
  }
  const armazenamento = driver();
  const anteriores = new Map<string, string | null>();
  try {
    for (const [tabela, linhas] of Object.entries(alteracoes)) {
      const chave = chaveDaTabela(tabela);
      anteriores.set(chave, armazenamento.getItem(chave));
      armazenamento.setItem(chave, JSON.stringify(linhas));
    }
  } catch (causa) {
    anteriores.forEach((valor, chave) => {
      try {
        if (valor === null) armazenamento.removeItem(chave);
        else armazenamento.setItem(chave, valor);
      } catch {
        // devolver o valor anterior ocupa no máximo o mesmo espaço; nada mais a fazer aqui
      }
    });
    throw new ErroDeDados('armazenamento', { cause: causa });
  }
  avisarMudanca();
}

/** Uso aproximado, em caracteres de texto: é o que conta para o limite do navegador. */
export function usoDoArmazenamento(): number {
  const armazenamento = driver();
  let total = 0;
  for (let i = 0; i < armazenamento.length; i++) {
    const chave = armazenamento.key(i);
    if (chave?.startsWith(PREFIXO_CHAVES)) total += chave.length + (armazenamento.getItem(chave)?.length ?? 0);
  }
  return total;
}
