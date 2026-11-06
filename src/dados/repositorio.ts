import type { ChaveConfiguracao, ValoresConfiguracao } from './tipos/configuracao';
import type { Controle } from './tipos/controle';

/** O que quem chama informa ao criar: os campos de controle quem preenche é o repositório (RT-02). */
export type Novo<T extends Controle> = Omit<T, keyof Controle | 'codigo'> & { id?: string; exemplo?: boolean };
export type Alteracao<T extends Controle> = Partial<Omit<T, keyof Controle | 'codigo'>>;

export type FiltrosListagem<T> = {
  /** Igualdade campo a campo: é o que qualquer banco resolve na consulta. */
  onde?: Partial<T>;
  /** Registros arquivados ficam de fora, salvo quando pedidos (RT-03). */
  incluirArquivados?: boolean;
};

/**
 * Contrato de acesso aos dados (02 §0.3). As telas só falam com ele. Os métodos são assíncronos
 * mesmo no navegador: é o que permite trocar a implementação por um banco sem refazer as telas.
 */
export interface Repositorio<T extends Controle> {
  listar(filtros?: FiltrosListagem<T>): Promise<T[]>;
  obter(id: string): Promise<T | null>;
  criar(dados: Novo<T>): Promise<T>;
  /** O motivo vai para o histórico, quando a regra exigir um (RT-16). */
  atualizar(id: string, dados: Alteracao<T>, opcoes?: { motivo?: string }): Promise<T>;
  /** O motivo só é obrigatório quando a regra exigir (RT-16); quem exige é o domínio. */
  arquivar(id: string, motivo?: string): Promise<T>;
  restaurar(id: string): Promise<T>;
}

/** Configurações gerais (T02.01): uma tabela de chaves que se lê e se grava como um conjunto. */
export interface RepositorioConfiguracao {
  /** Todas as chaves: o que não estiver salvo vem com o padrão. */
  ler(): Promise<ValoresConfiguracao>;
  /** Grava de uma vez, ou nada, e registra cada chave que mudou. Devolve as chaves alteradas. */
  salvar(alteracoes: Partial<ValoresConfiguracao>, opcoes?: { motivo?: string }): Promise<readonly ChaveConfiguracao[]>;
}
