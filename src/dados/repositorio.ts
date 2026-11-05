import type { Colecoes, Controle, Tabela } from './tipos';
export type Novo<T> = Omit<T, keyof Controle> & { exemplo?: boolean };
export interface Repositorio<T> { listar(filtro?: (registro: T) => boolean): T[]; obter(id: string): T | undefined; criar(dados: Novo<T>): T; atualizar(id: string, dados: Partial<Omit<T, keyof Controle>>): T; arquivar(id: string, motivo: string): T; restaurar(id: string): T }
export type Repositorios = { [K in Exclude<Tabela, 'auditoria'>]: Repositorio<Colecoes[K]> };
