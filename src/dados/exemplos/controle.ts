import type { Controle } from '../tipos/controle';

/** Os campos de controle de um registro da carga inicial (RT-02 e 16 §0). */
export function controle(id: string, exemplo: boolean, agora: string): Controle {
  return {
    id,
    criado_em: agora,
    criado_por: null,
    atualizado_em: agora,
    atualizado_por: null,
    arquivado_em: null,
    arquivado_por: null,
    versao_registro: 1,
    exemplo,
  };
}
