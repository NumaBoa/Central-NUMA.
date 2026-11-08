import { ErroDeRegra } from './erros';
import type { Repositorio } from './repositorio';
import type { Decisao } from './tipos/decisao';

export const MENSAGEM_DECISAO_IMUTAVEL = 'Decisão registrada não muda: substitua por uma nova decisão (RN-06.13).';

/**
 * O gatilho de 16 §4.6 nesta etapa: decisão registrada é imutável, exceto a situação (só de Registrada para
 * Substituída) e `substituida_por_id`. Arquivar também não vale: a decisão fica no histórico como foi tomada.
 * Fica na camada de dados para nenhuma tela, de nenhum módulo, contornar a regra.
 */
export function protegerDecisoes(repositorio: Repositorio<Decisao>): Repositorio<Decisao> {
  return {
    ...repositorio,
    async atualizar(id, dados, opcoes) {
      const campos = Object.keys(dados);
      if (campos.some((campo) => campo !== 'situacao' && campo !== 'substituida_por_id')) throw new ErroDeRegra(MENSAGEM_DECISAO_IMUTAVEL);
      if (dados.situacao === 'registrada') throw new ErroDeRegra('Decisão substituída não volta a valer: registre uma nova decisão.');
      return repositorio.atualizar(id, dados, opcoes);
    },
    async arquivar() {
      throw new ErroDeRegra(MENSAGEM_DECISAO_IMUTAVEL);
    },
  };
}
