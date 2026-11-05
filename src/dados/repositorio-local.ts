import { criarEstadoInicial } from './exemplos';
import { dadosSchema, metaSchema, type Auditoria, type Colecoes, type Estado, type Tabela } from './tipos';
import type { Novo, Repositorio } from './repositorio';

export interface Armazenamento { getItem(chave: string): string | null; setItem(chave: string, valor: string): void; removeItem(chave: string): void }
export const PREFIXO = 'numa-central:v1:';
const tabelas: Tabela[] = ['pessoa', 'produto', 'configuracao', 'cambio_referencia', 'auditoria'];
export class BancoLocal {
  private estado: Estado;
  constructor(private armazenamento: Armazenamento) {
    const meta = armazenamento.getItem(PREFIXO + 'meta');
    if (!meta) {
      if (tabelas.some((t) => armazenamento.getItem(PREFIXO + t) !== null)) throw new Error('Os dados locais estão incompletos. Importe um backup ou restaure os exemplos.');
      this.estado = criarEstadoInicial(); this.gravar(this.estado);
    } else {
      try { this.estado = { meta: metaSchema.parse(JSON.parse(meta)), dados: dadosSchema.parse(Object.fromEntries(tabelas.map((t) => [t, JSON.parse(armazenamento.getItem(PREFIXO + t) ?? 'null')])))}; }
      catch { throw new Error('Não foi possível ler os dados deste navegador. Seus dados foram preservados. Importe um backup ou restaure os exemplos.'); }
    }
  }
  ler(): Estado { return structuredClone(this.estado); }
  private gravar(estado: Estado) {
    const pares = [...tabelas.map((t) => [PREFIXO + t, JSON.stringify(estado.dados[t])] as const), [PREFIXO + 'meta', JSON.stringify(estado.meta)] as const];
    const anteriores = pares.map(([chave]) => [chave, this.armazenamento.getItem(chave)] as const);
    try { for (const [chave, valor] of pares) this.armazenamento.setItem(chave, valor); }
    catch { for (const [chave, valor] of anteriores) { try { if (valor === null) this.armazenamento.removeItem(chave); else this.armazenamento.setItem(chave, valor); } catch { /* A leitura anterior é mantida em memória. */ } } throw new Error('Não deu para salvar no navegador. Verifique o espaço disponível e tente de novo.'); }
  }
  transacao<T>(operacao: (estado: Estado) => T): T { const proximo = this.ler(); const resultado = operacao(proximo); dadosSchema.parse(proximo.dados); metaSchema.parse(proximo.meta); this.gravar(proximo); this.estado = proximo; return resultado; }
  registrar(estado: Estado, evento: Omit<Auditoria, 'id' | 'ocorrido_em' | 'usuario_id' | 'autor_nome'>) { const pessoa = estado.dados.pessoa.find((p) => p.id === estado.meta.pessoa_atual); estado.dados.auditoria.push({ ...evento, id: crypto.randomUUID(), ocorrido_em: new Date().toISOString(), usuario_id: pessoa?.id ?? null, autor_nome: pessoa?.nome_completo ?? 'Sistema' }); }
  meta(dados: Partial<Estado['meta']>) { this.transacao((estado) => { Object.assign(estado.meta, dados); }); }
  repositorio<K extends Exclude<Tabela, 'auditoria'>>(tabela: K): Repositorio<Colecoes[K]> {
    const alterar = (id: string, dados: Partial<Colecoes[K]>, acao: Auditoria['acao'], motivo: string | null = null) => this.transacao((estado) => {
      const lista = estado.dados[tabela] as Colecoes[K][];
      const registro = lista.find((r) => r.id === id); if (!registro) throw new Error('Registro não encontrado. Atualize a página.');
      const antes = structuredClone(registro);
      Object.assign(registro, dados, { atualizado_em: new Date().toISOString(), atualizado_por: estado.meta.pessoa_atual, versao_registro: registro.versao_registro + 1, exemplo: false });
      this.registrar(estado, { acao, tabela, registro_id: id, resumo: `${acao === 'arquivou' ? 'Registro arquivado' : acao === 'restaurou' ? 'Registro restaurado' : 'Registro atualizado'}.`, antes, depois: structuredClone(registro), motivo });
      return structuredClone(registro);
    });
    return {
      listar: (filtro) => (this.ler().dados[tabela] as Colecoes[K][]).filter(filtro ?? (() => true)),
      obter: (id) => (this.ler().dados[tabela] as Colecoes[K][]).find((r) => r.id === id),
      criar: (dados: Novo<Colecoes[K]>) => this.transacao((estado) => { const agora = new Date().toISOString(); const registro = { ...dados, id: crypto.randomUUID(), criado_em: agora, criado_por: estado.meta.pessoa_atual, atualizado_em: agora, atualizado_por: estado.meta.pessoa_atual, arquivado_em: null, arquivado_por: null, versao_registro: 1, exemplo: dados.exemplo ?? false } as Colecoes[K]; (estado.dados[tabela] as Colecoes[K][]).push(registro); this.registrar(estado, { acao: 'inseriu', tabela, registro_id: registro.id, resumo: 'Registro criado.', antes: null, depois: structuredClone(registro), motivo: null }); return structuredClone(registro); }),
      atualizar: (id, dados) => alterar(id, dados as Partial<Colecoes[K]>, 'alterou'),
      arquivar: (id, motivo) => { if (!motivo.trim()) throw new Error('Informe o motivo do arquivamento.'); return alterar(id, { arquivado_em: new Date().toISOString(), arquivado_por: this.estado.meta.pessoa_atual } as Partial<Colecoes[K]>, 'arquivou', motivo); },
      restaurar: (id) => alterar(id, { arquivado_em: null, arquivado_por: null } as Partial<Colecoes[K]>, 'restaurou'),
    };
  }
  tamanho(): number { return new Blob([JSON.stringify(this.estado)]).size; }
}
export function abrirBancoLocal(): BancoLocal { return new BancoLocal(window.localStorage); }
export function recuperarExemplos(): BancoLocal {
  const banco = Object.create(BancoLocal.prototype) as BancoLocal;
  // A recuperação é explícita: nunca sobrescrever dados ilegíveis na abertura.
  Object.assign(banco, { armazenamento: window.localStorage, estado: criarEstadoInicial() });
  banco.transacao((estado) => { banco.registrar(estado, { acao: 'restaurou', tabela: 'dados', registro_id: 'central', resumo: 'Dados de exemplo restaurados após erro de leitura.', antes: null, depois: null, motivo: 'Recuperação confirmada pela usuária.' }); }); return banco;
}
