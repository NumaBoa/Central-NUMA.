/**
 * O armazenamento da Central quando ela roda com o Supabase. Para o resto do sistema, continua
 * sendo o mesmo `Driver` do localStorage (02 §0.3): as tabelas ficam em memória, carregadas do
 * banco ao entrar, e cada gravação vira um lote para o banco, só com as linhas que mudaram.
 *
 * Tudo o que `gravarTabelas` grava de uma vez sai num lote só, e o banco grava o lote inteiro ou
 * nada (AR-02). Não depende do Supabase: quem envia é a função `enviar`, o que permite testar.
 */
import { CHAVE_META, PREFIXO_CHAVES, chaveDaTabela, type Driver } from '../armazenamento';

/** Uma linha no banco: `registro (tabela, id, dados)`. */
export type LinhaNuvem = { tabela: string; id: string; dados: unknown };
export type Remocao = { tabela: string; id: string };
export type Lote = { upserts: LinhaNuvem[]; remocoes: Remocao[] };

/** O que vale para a Numa inteira; o resto do `meta` é deste navegador. */
export const TABELA_META = '_meta';
export const ID_META = 'central';
export const CAMPOS_META_COMPARTILHADOS = ['versao_dados', 'ultima_rotina_em', 'contadores'] as const;

/**
 * Marca que a tabela existe, mesmo vazia: a carga inicial só preenche tabela que nunca existiu
 * (`getItem(...) === null`), e uma tabela vazia não pode ser preenchida de novo a cada entrada.
 */
export const TABELA_MARCAS = '_tabela';

export type MudancaRemota = { tipo: 'upsert'; linha: LinhaNuvem } | { tipo: 'remocao'; tabela: string; id: string };

type OpcoesDriverNuvem = {
  enviar: (lote: Lote) => void;
  /** O localStorage: guarda as preferências deste navegador e uma cópia das configurações. */
  pessoal: Driver;
};

function idDaLinha(tabela: string, linha: unknown): string {
  const id = (linha as { id?: unknown } | null)?.id;
  if (typeof id !== 'string' || !id) throw new Error(`Linha sem id na tabela ${tabela}.`);
  return id;
}

function separarMeta(meta: Record<string, unknown>) {
  const compartilhado: Record<string, unknown> = {};
  const pessoal: Record<string, unknown> = {};
  for (const [campo, valor] of Object.entries(meta)) {
    if ((CAMPOS_META_COMPARTILHADOS as readonly string[]).includes(campo)) compartilhado[campo] = valor;
    else pessoal[campo] = valor;
  }
  return { compartilhado, pessoal };
}

function lerJson(texto: string | null): unknown {
  if (!texto) return null;
  try {
    return JSON.parse(texto);
  } catch {
    return null;
  }
}

export class DriverNuvem implements Driver {
  /** Tabela → id → JSON da linha, na ordem em que as linhas aparecem. */
  private tabelas = new Map<string, Map<string, string>>();
  private metaCompartilhada: Record<string, unknown> = {};
  private pendente: Lote | null = null;

  constructor(
    linhas: readonly LinhaNuvem[],
    private readonly opcoes: OpcoesDriverNuvem,
  ) {
    this.substituir(linhas);
  }

  /** Troca tudo o que está em memória pelo que veio do banco. */
  substituir(linhas: readonly LinhaNuvem[]) {
    this.tabelas = new Map();
    this.metaCompartilhada = {};
    for (const linha of linhas) this.aplicar(linha);
    this.copiarConfiguracao();
  }

  // ---------- Driver ----------

  get length() {
    return this.chaves().length;
  }

  key(indice: number) {
    return this.chaves()[indice] ?? null;
  }

  getItem(chave: string): string | null {
    if (chave === CHAVE_META) {
      const pessoal = lerJson(this.opcoes.pessoal.getItem(CHAVE_META));
      return JSON.stringify({ ...(pessoal && typeof pessoal === 'object' ? pessoal : {}), ...this.metaCompartilhada });
    }
    const tabela = this.tabelaDaChave(chave);
    if (tabela === null) return this.opcoes.pessoal.getItem(chave);
    const linhas = this.tabelas.get(tabela);
    return linhas ? `[${[...linhas.values()].join(',')}]` : null;
  }

  setItem(chave: string, valor: string) {
    if (chave === CHAVE_META) return this.gravarMeta(valor);
    const tabela = this.tabelaDaChave(chave);
    if (tabela === null) return this.opcoes.pessoal.setItem(chave, valor);

    const novas: unknown = JSON.parse(valor);
    if (!Array.isArray(novas)) throw new Error(`A tabela ${tabela} precisa ser uma lista.`);
    const antes = this.tabelas.get(tabela);
    const depois = new Map<string, string>();
    for (const linha of novas) {
      const id = idDaLinha(tabela, linha);
      const texto = JSON.stringify(linha);
      depois.set(id, texto);
      if (antes?.get(id) !== texto) this.lote().upserts.push({ tabela, id, dados: linha });
    }
    for (const id of antes?.keys() ?? []) if (!depois.has(id)) this.lote().remocoes.push({ tabela, id });
    if (!antes) this.lote().upserts.push({ tabela: TABELA_MARCAS, id: tabela, dados: true });
    this.tabelas.set(tabela, depois);
    if (tabela === 'configuracao') this.copiarConfiguracao();
  }

  removeItem(chave: string) {
    const tabela = this.tabelaDaChave(chave);
    if (tabela === null) return this.opcoes.pessoal.removeItem(chave);
    const linhas = this.tabelas.get(tabela);
    if (!linhas) return;
    for (const id of linhas.keys()) this.lote().remocoes.push({ tabela, id });
    this.lote().remocoes.push({ tabela: TABELA_MARCAS, id: tabela });
    this.tabelas.delete(tabela);
  }

  // ---------- Tempo real ----------

  /** O que outra pessoa (ou outra aba) gravou. Diz se mudaram dados, o meta, ou nada. */
  aplicarRemota(mudanca: MudancaRemota): 'dados' | 'meta' | null {
    if (mudanca.tipo === 'upsert') {
      const tipo = this.aplicar(mudanca.linha);
      if (mudanca.linha.tabela === 'configuracao') this.copiarConfiguracao();
      return tipo;
    }
    const { tabela, id } = mudanca;
    if (tabela === TABELA_META) return null;
    if (tabela === TABELA_MARCAS) {
      if (!this.tabelas.has(id)) return null;
      this.tabelas.delete(id);
      return 'dados';
    }
    const linhas = this.tabelas.get(tabela);
    if (!linhas?.delete(id)) return null;
    return 'dados';
  }

  // ---------- Interno ----------

  private aplicar({ tabela, id, dados }: LinhaNuvem): 'dados' | 'meta' | null {
    if (tabela === TABELA_META) {
      if (id !== ID_META || !dados || typeof dados !== 'object') return null;
      this.metaCompartilhada = separarMeta(dados as Record<string, unknown>).compartilhado;
      return 'meta';
    }
    if (tabela === TABELA_MARCAS) {
      if (this.tabelas.has(id)) return null;
      this.tabelas.set(id, new Map());
      return 'dados';
    }
    let linhas = this.tabelas.get(tabela);
    if (!linhas) {
      linhas = new Map();
      this.tabelas.set(tabela, linhas);
    }
    const texto = JSON.stringify(dados);
    if (linhas.get(id) === texto) return null;
    linhas.set(id, texto);
    return 'dados';
  }

  private gravarMeta(valor: string) {
    const lido = lerJson(valor);
    const { compartilhado, pessoal } = separarMeta(lido && typeof lido === 'object' ? (lido as Record<string, unknown>) : {});
    this.opcoes.pessoal.setItem(CHAVE_META, JSON.stringify(pessoal));
    const combinado = { ...this.metaCompartilhada, ...compartilhado };
    if (JSON.stringify(combinado) === JSON.stringify(this.metaCompartilhada)) return;
    this.metaCompartilhada = combinado;
    this.lote().upserts.push({ tabela: TABELA_META, id: ID_META, dados: combinado });
  }

  /** O script que roda antes da primeira pintura lê o fuso do localStorage (app/layout.tsx). */
  private copiarConfiguracao() {
    const texto = this.getItem(chaveDaTabela('configuracao'));
    try {
      if (texto !== null) this.opcoes.pessoal.setItem(chaveDaTabela('configuracao'), texto);
    } catch {
      // só uma cópia para a primeira pintura; sem ela vale o fuso padrão
    }
  }

  private tabelaDaChave(chave: string): string | null {
    return chave.startsWith(PREFIXO_CHAVES) ? chave.slice(PREFIXO_CHAVES.length) : null;
  }

  private chaves(): string[] {
    return [CHAVE_META, ...[...this.tabelas.keys()].map(chaveDaTabela)];
  }

  /** Junta tudo o que for gravado neste mesmo instante e envia de uma vez. */
  private lote(): Lote {
    if (!this.pendente) {
      const lote: Lote = { upserts: [], remocoes: [] };
      this.pendente = lote;
      queueMicrotask(() => {
        this.pendente = null;
        if (lote.upserts.length || lote.remocoes.length) this.opcoes.enviar(lote);
      });
    }
    return this.pendente;
  }
}
