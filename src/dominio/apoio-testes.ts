/** Só para os testes: o que os dados iniciais trazem. Mude aqui quando uma tela acrescentar carga inicial. */
import { AREAS_INICIAIS, CATEGORIAS_INICIAIS, MARCAS_INICIAIS, PRODUTOS_INICIAIS } from '@/dados/exemplos/base';

const PESSOAS_INICIAIS = 4;
const CONTRAPARTES_INICIAIS = 3;
const ENTIDADES_INICIAIS = 1;
const CONTAS_INICIAIS = 2;
/** 9 nacionais de data fixa, 4 que vêm da Páscoa, São Jorge e São Sebastião. */
export const FERIADOS_INICIAIS = 15;
export const ATIVIDADES_INICIAIS = 17;
/** As 6 da especificação e uma de exemplo. */
export const ROTINAS_INICIAIS = 7;

/** Bruna, Rafael, as 3 contrapartes fictícias, as 2 contas pessoais, as atividades e a rotina de exemplo. */
export const EXEMPLOS_INICIAIS = 7 + ATIVIDADES_INICIAIS + 1;

export const REGISTROS_INICIAIS = PESSOAS_INICIAIS + AREAS_INICIAIS.length + MARCAS_INICIAIS.length + PRODUTOS_INICIAIS.length + CONTRAPARTES_INICIAIS + ENTIDADES_INICIAIS + CATEGORIAS_INICIAIS.length + CONTAS_INICIAIS + FERIADOS_INICIAIS + ATIVIDADES_INICIAIS + ROTINAS_INICIAIS;
