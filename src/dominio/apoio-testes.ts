/** Só para os testes: o que os dados iniciais trazem. Mude aqui quando uma tela acrescentar carga inicial. */
import { AREAS_INICIAIS, MARCAS_INICIAIS, PRODUTOS_INICIAIS } from '@/dados/exemplos/base';

const PESSOAS_INICIAIS = 4;
const CONTRAPARTES_INICIAIS = 3;
const ENTIDADES_INICIAIS = 1;

/** Bruna, Rafael e as 3 contrapartes fictícias. */
export const EXEMPLOS_INICIAIS = 5;

export const REGISTROS_INICIAIS = PESSOAS_INICIAIS + AREAS_INICIAIS.length + MARCAS_INICIAIS.length + PRODUTOS_INICIAIS.length + CONTRAPARTES_INICIAIS + ENTIDADES_INICIAIS;
