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
  atualizar(id: string, dados: Alteracao<T>): Promise<T>;
  arquivar(id: string, motivo: string): Promise<T>;
  restaurar(id: string): Promise<T>;
}
