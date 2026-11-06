import type { Controle } from '../tipos/controle';
import type { Pessoa } from '../tipos/pessoa';
import { ID_CAMILA, ID_KIMBERLY } from './base';

/**
 * Dados de exemplo (02 §0.3 e 17 §6). As sócias são reais; os demais registros são fictícios e
 * levam `exemplo: true`. Cada tela acrescenta aqui os exemplos das suas tabelas.
 */
function controle(id: string, exemplo: boolean, agora: string): Controle {
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

function pessoa(id: string, exemplo: boolean, agora: string, dados: Pick<Pessoa, 'nome_completo' | 'tipo' | 'eh_socia'> & Partial<Pessoa>): Pessoa {
  return {
    ...controle(id, exemplo, agora),
    nome_exibicao: null,
    contraparte_id: null,
    papeis_contato: [],
    funcao: null,
    email: null,
    telefone: null,
    cpf: null,
    observacoes: null,
    situacao: 'ativa',
    ...dados,
  };
}

export type DadosDeExemplo = { pessoa: Pessoa[] };

export function gerarExemplos(agora: string): DadosDeExemplo {
  return {
    pessoa: [
      pessoa(ID_KIMBERLY, false, agora, { nome_completo: 'Kimberly Grebe', tipo: 'interna', eh_socia: true, funcao: 'Sócia' }),
      pessoa(ID_CAMILA, false, agora, { nome_completo: 'Camila Lima', tipo: 'interna', eh_socia: true, funcao: 'Sócia' }),
      pessoa('2d9f3e74-5b8a-4c3d-9f4e-7a0c9e6b3c03', true, agora, { nome_completo: 'Bruna Alves', tipo: 'interna', eh_socia: false, funcao: 'Freelancer de design', email: 'bruna@exemplo.com.br' }),
      pessoa('3ea04f85-6c9b-4d4e-8a5f-8b1d0f7c4d04', true, agora, { nome_completo: 'Rafael Souza', tipo: 'externa', eh_socia: false, funcao: 'Contador', email: 'rafael@exemplo.com.br' }),
    ],
  };
}
