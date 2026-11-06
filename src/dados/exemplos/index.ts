import type { Contraparte } from '../tipos/contraparte';
import type { ContaFinanceira } from '../tipos/financeiro';
import type { Pessoa } from '../tipos/pessoa';
import { atividadesDeExemplo } from './atividades';
import { ID_BRUNA, ID_CAMILA, ID_CONTA_CAMILA, ID_CONTA_KIMBERLY, ID_CONTRAPARTE_CONTABILIDADE, ID_KIMBERLY } from './base';
import { controle } from './controle';
import { categoriasDeFerramentaIniciais, ferramentasDeExemplo } from './ferramentas';
import { rotinaDeExemplo, rotinasIniciais } from './rotinas';

export { atividadesDeExemplo, categoriasDeFerramentaIniciais, controle, ferramentasDeExemplo, rotinaDeExemplo, rotinasIniciais };

/*
 * Dados de exemplo (02 §0.3 e 17 §6). As sócias são reais; os demais registros são fictícios e
 * levam `exemplo: true`. Cada tela acrescenta aqui os exemplos das suas tabelas.
 */

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

function contraparte(id: string, agora: string, dados: Pick<Contraparte, 'tipo_pessoa' | 'nome' | 'papeis' | 'responsavel_id' | 'pais'> & Partial<Contraparte>): Contraparte {
  return {
    ...controle(id, true, agora),
    nome_fantasia: null,
    documento: null,
    documento_normalizado: null,
    site: null,
    email: null,
    telefone: null,
    endereco: null,
    origem: null,
    classe: 'int',
    observacoes: null,
    situacao: 'ativa',
    ...dados,
  };
}

/** Fornecedores fictícios (17 §6): um de cada tipo que a F0a usa, nenhum com documento inventado. */
export function contrapartesDeExemplo(agora: string): Contraparte[] {
  return [
    contraparte(ID_CONTRAPARTE_CONTABILIDADE, agora, { tipo_pessoa: 'pj', nome: 'Souza Contabilidade Ltda', nome_fantasia: 'Souza Contabilidade', papeis: ['fornecedor'], responsavel_id: ID_KIMBERLY, pais: 'BR', email: 'contato@exemplo.com.br', endereco: { cep: null, logradouro: null, numero: null, complemento: null, bairro: null, cidade: 'Rio de Janeiro', uf: 'RJ' } }),
    contraparte('e6a4c5b8-bf73-4e54-8a45-4d5e6f7a8b02', agora, { tipo_pessoa: 'pj', nome: 'Estúdio Verde Hospedagem Ltda', papeis: ['fornecedor', 'parceiro'], responsavel_id: ID_CAMILA, pais: 'BR', site: 'https://exemplo.com.br' }),
    contraparte('e6a4c5b8-bf73-4e54-8a45-4d5e6f7a8b03', agora, { tipo_pessoa: 'estrangeira', nome: 'Nuvem Clara Inc.', papeis: ['fornecedor'], responsavel_id: ID_CAMILA, pais: 'US' }),
  ];
}

function contaPessoal(id: string, agora: string, nome: string, socia: string): ContaFinanceira {
  return {
    ...controle(id, true, agora),
    nome,
    tipo: 'pessoal_socia',
    titular_entidade_id: null,
    titular_pessoa_id: socia,
    instituicao: null,
    final_numero: null,
    moeda: 'BRL',
    saldo_inicial: null,
    data_saldo_inicial: null,
    situacao: 'ativa',
  };
}

/** Uma conta pessoal de cada sócia (T02.08). Os nomes são os de `17 §6`, e os reais vêm com o uso. */
export function contasDeExemplo(agora: string): ContaFinanceira[] {
  return [contaPessoal(ID_CONTA_KIMBERLY, agora, 'Cartão pessoal — Kimberly', ID_KIMBERLY), contaPessoal(ID_CONTA_CAMILA, agora, 'Cartão pessoal — Camila', ID_CAMILA)];
}

export type DadosDeExemplo = { pessoa: Pessoa[]; contraparte: Contraparte[]; conta_financeira: ContaFinanceira[] } & ReturnType<typeof atividadesDeExemplo> & ReturnType<typeof ferramentasDeExemplo>;

export function gerarExemplos(agora: string): DadosDeExemplo {
  return {
    pessoa: [
      pessoa(ID_KIMBERLY, false, agora, { nome_completo: 'Kimberly Grebe', tipo: 'interna', eh_socia: true, funcao: 'Sócia' }),
      pessoa(ID_CAMILA, false, agora, { nome_completo: 'Camila Lima', tipo: 'interna', eh_socia: true, funcao: 'Sócia' }),
      pessoa(ID_BRUNA, true, agora, { nome_completo: 'Bruna Alves', tipo: 'interna', eh_socia: false, funcao: 'Freelancer de design', email: 'bruna@exemplo.com.br' }),
      pessoa('3ea04f85-6c9b-4d4e-8a5f-8b1d0f7c4d04', true, agora, { nome_completo: 'Rafael Souza', tipo: 'externa', eh_socia: false, funcao: 'Contador', email: 'rafael@exemplo.com.br', contraparte_id: ID_CONTRAPARTE_CONTABILIDADE, papeis_contato: ['principal', 'financeiro'] }),
    ],
    contraparte: contrapartesDeExemplo(agora),
    conta_financeira: contasDeExemplo(agora),
    ...atividadesDeExemplo(agora),
    ...ferramentasDeExemplo(agora),
  };
}
