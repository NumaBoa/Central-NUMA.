import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chaveDaTabela, criarArmazenamentoEmMemoria, usarDriverDeTeste, type Driver } from '@/dados/armazenamento';
import { ID_CAMILA, ID_CONTRAPARTE_CONTABILIDADE, ID_ENTIDADE_PLANEJADA, ID_KIMBERLY, ID_MARCA_KIPI, ID_PRODUTO_KIPI } from '@/dados/exemplos/base';
import { esquecerMetaEmMemoria, gravarMeta, lerMeta } from '@/dados/meta';
import { repositorios } from '@/dados/repositorios';
import { VERSAO_DADOS } from '@/dados/tabelas';
import { REGISTROS_INICIAIS } from './apoio-testes';
import {
  arquivarContraparte,
  carregarContrapartes,
  cidadesDasContrapartes,
  conferirContraparte,
  dadosDaContraparte,
  documentoValido,
  esquemaFormularioContraparte,
  filtrarContrapartes,
  FILTROS_CONTRAPARTES_INICIAIS,
  formatarDocumento,
  formularioContraparteVazio,
  formularioDaContraparte,
  inativarContraparte,
  nomeDaContraparte,
  normalizarDocumento,
  reativarContraparte,
  restaurarContraparte,
  salvarContraparte,
  vinculosDaContraparte,
  type FormularioContraparte,
} from './contrapartes';
import { aplicarImportacao, exportarTudo, limparExemplos, restaurarExemplos, resumoDosDados, type ArquivoDeDados } from './dados';
import { camposDoEndereco, CAMPOS_ENDERECO_VAZIOS, cepValido, enderecoCompleto, enderecoDosCampos, enderecoEmLinha, formatarCep } from './endereco';
import {
  arquivarEntidade,
  carregarEntidades,
  entidadesParaEmissao,
  entidadesParaVincular,
  esquemaFormularioEntidade,
  FORMULARIO_ENTIDADE_VAZIO,
  representantesDaEntidade,
  restaurarEntidade,
  salvarEntidade,
  vinculosDaEntidade,
  type FormularioEntidade,
} from './entidades';
import { historicoDoRegistro, historicoRecente } from './historico';
import { listarPaises, nomeDoPais } from './paises';
import { carregarPessoas, dadosDoFormulario, filtrarPessoas, FILTROS_PESSOAS_INICIAIS, FORMULARIO_PESSOA_VAZIO, salvarPessoa, vinculosDaPessoa } from './pessoas';
import { esquemaFormularioProduto, formularioProdutoVazio, salvarProduto } from './produtos';

const CNPJ = '11.222.333/0001-81';
const CPF = '529.982.247-25';
const ID_RAFAEL = '3ea04f85-6c9b-4d4e-8a5f-8b1d0f7c4d04';

function nova(alteracoes: Partial<FormularioContraparte> = {}): FormularioContraparte {
  return { ...formularioContraparteVazio(ID_KIMBERLY), nome: 'Fornecedora Teste Ltda', ...alteracoes };
}

function mensagens(alteracoes: Partial<FormularioContraparte>): string[] {
  const resultado = esquemaFormularioContraparte.safeParse(nova(alteracoes));
  return resultado.success ? [] : resultado.error.issues.map((falha) => falha.message);
}

function novaEntidade(alteracoes: Partial<FormularioEntidade> = {}): FormularioEntidade {
  return { ...FORMULARIO_ENTIDADE_VAZIO, nome: 'Numa Tecnologia Ltda', ...alteracoes };
}

function mensagensEntidade(alteracoes: Partial<FormularioEntidade>): string[] {
  const resultado = esquemaFormularioEntidade.safeParse(novaEntidade(alteracoes));
  return resultado.success ? [] : resultado.error.issues.map((falha) => falha.message);
}

const ENDERECO_COMPLETO = { cep: '20000-000', logradouro: 'Rua Teste', numero: '10', complemento: '', bairro: 'Centro', cidade: 'Rio de Janeiro', uf: 'RJ' };

describe('T02.05 e T02.06', () => {
  let armazenamento: Driver;

  beforeEach(() => {
    armazenamento = criarArmazenamentoEmMemoria();
    usarDriverDeTeste(armazenamento);
    esquecerMetaEmMemoria();
    vi.useFakeTimers({ now: new Date('2026-11-06T15:00:00.000Z'), toFake: ['Date'] });
  });
  afterEach(() => {
    usarDriverDeTeste(null);
    esquecerMetaEmMemoria();
    vi.useRealTimers();
  });

  describe('endereço e países', () => {
    it('máscara e validação do CEP', () => {
      expect(formatarCep('20000000')).toBe('20000-000');
      expect(formatarCep('2000')).toBe('2000');
      expect(cepValido('20000-000')).toBe(true);
      expect(cepValido('2000')).toBe(false);
    });

    it('sem nada preenchido, não há endereço (RT-08)', () => {
      expect(enderecoDosCampos(CAMPOS_ENDERECO_VAZIOS)).toBeNull();
      expect(enderecoDosCampos({ ...CAMPOS_ENDERECO_VAZIOS, cidade: 'Niterói' })).toMatchObject({ cidade: 'Niterói', cep: null });
    });

    it('vai e volta do formulário', () => {
      expect(camposDoEndereco(enderecoDosCampos(ENDERECO_COMPLETO))).toEqual(ENDERECO_COMPLETO);
      expect(camposDoEndereco(null)).toEqual(CAMPOS_ENDERECO_VAZIOS);
    });

    it('endereço completo dispensa só o complemento', () => {
      expect(enderecoCompleto(ENDERECO_COMPLETO)).toBe(true);
      expect(enderecoCompleto({ ...ENDERECO_COMPLETO, numero: '' })).toBe(false);
    });

    it('em uma linha, sem buracos', () => {
      expect(enderecoEmLinha(enderecoDosCampos(ENDERECO_COMPLETO))).toBe('Rua Teste, 10 · Centro, Rio de Janeiro, RJ · 20000-000');
      expect(enderecoEmLinha(null)).toBeNull();
    });

    it('países vêm em português, com o Brasil no topo', () => {
      const paises = listarPaises();
      expect(paises[0]).toEqual({ codigo: 'BR', nome: 'Brasil' });
      expect(paises.length).toBeGreaterThan(190);
      expect(paises.find((pais) => pais.codigo === 'US')?.nome).toBe('Estados Unidos');
      expect(paises.map((pais) => pais.codigo)).not.toContain('EU');
      expect(paises.map((pais) => pais.codigo)).not.toContain('ZZ');
      expect(nomeDoPais('PT')).toBe('Portugal');
    });
  });

  describe('T02.06: carga de exemplos', () => {
    it('três fornecedores fictícios, de tipos diferentes, sem documento inventado', async () => {
      const { contrapartes } = await carregarContrapartes();
      expect(contrapartes.map((contraparte) => contraparte.tipo_pessoa)).toEqual(['pj', 'pj', 'estrangeira']);
      expect(contrapartes.every((contraparte) => contraparte.exemplo && contraparte.documento === null)).toBe(true);
    });

    it('o contador de exemplo é contato da contabilidade', async () => {
      const rafael = await repositorios.pessoa.obter(ID_RAFAEL);
      expect(rafael?.contraparte_id).toBe(ID_CONTRAPARTE_CONTABILIDADE);
    });

    it('contam como registros', async () => {
      expect((await resumoDosDados()).registros).toBe(REGISTROS_INICIAIS);
    });
  });

  describe('T02.06: validação', () => {
    it('os obrigatórios', () => {
      expect(mensagens({})).toEqual([]);
      expect(mensagens({ nome: ' ' })).toEqual(['Informe o nome ou a razão social.']);
      expect(mensagens({ papeis: [] })).toEqual(['Escolha pelo menos um papel.']);
      expect(mensagens({ responsavel_id: '' })).toEqual(['Escolha a pessoa responsável.']);
    });

    it('documento confere com o tipo de pessoa (RN-02.03)', () => {
      expect(mensagens({ tipo_pessoa: 'pj', documento: CNPJ })).toEqual([]);
      expect(mensagens({ tipo_pessoa: 'pj', documento: '11.222.333/0001-82' })).toEqual(['Este CNPJ não é válido. Confira os números.']);
      expect(mensagens({ tipo_pessoa: 'pf', documento: CPF })).toEqual([]);
      expect(mensagens({ tipo_pessoa: 'pf', documento: CNPJ })).toEqual(['Este CPF não é válido. Confira os números.']);
    });

    it('estrangeira dispensa CPF e CNPJ, e aceita o ID do país', () => {
      expect(mensagens({ tipo_pessoa: 'estrangeira', documento: '' })).toEqual([]);
      expect(mensagens({ tipo_pessoa: 'estrangeira', documento: 'EIN 12-3456789', pais: 'US' })).toEqual([]);
      expect(documentoValido('estrangeira', 'qualquer')).toBe(true);
    });

    it('site precisa ser o endereço completo', () => {
      expect(mensagens({ site: 'https://exemplo.com.br' })).toEqual([]);
      expect(mensagens({ site: 'exemplo.com.br' })).toEqual(['Use o endereço completo, como https://exemplo.com.br.']);
      expect(mensagens({ site: 'javascript:alert(1)' })).toEqual(['Use o endereço completo, como https://exemplo.com.br.']);
    });

    it('telefone e CEP só seguem o padrão brasileiro no Brasil', () => {
      expect(mensagens({ telefone: '+1 415 555 0100' })).toEqual(['Use o formato (00) 00000-0000.']);
      expect(mensagens({ telefone: '+1 415 555 0100', pais: 'US' })).toEqual([]);
      expect(mensagens({ endereco: { ...CAMPOS_ENDERECO_VAZIOS, cep: '94105' } })).toEqual(['Use o formato 00000-000.']);
      expect(mensagens({ endereco: { ...CAMPOS_ENDERECO_VAZIOS, cep: '94105' }, pais: 'US' })).toEqual([]);
    });
  });

  describe('T02.06: conversão', () => {
    it('vazio é vazio, e a classe fica no padrão', () => {
      expect(dadosDaContraparte(nova())).toMatchObject({ nome_fantasia: null, documento: null, documento_normalizado: null, site: null, email: null, telefone: null, endereco: null, origem: null, observacoes: null, classe: 'int' });
    });

    it('documento só com dígitos no CPF, e sem pontuação no CNPJ', () => {
      expect(normalizarDocumento('pf', CPF)).toBe('52998224725');
      expect(normalizarDocumento('pj', '12.abc.345/01de-35')).toBe('12ABC34501DE35');
      expect(normalizarDocumento('estrangeira', 'ein 12-345')).toBe('EIN12345');
    });

    it('mostra o documento com a máscara do tipo', () => {
      expect(formatarDocumento('pj', '11222333000181')).toBe(CNPJ);
      expect(formatarDocumento('pf', '52998224725')).toBe(CPF);
      expect(formatarDocumento('estrangeira', 'EIN12345')).toBe('EIN12345');
    });

    it('telefone só com dígitos no Brasil; fora, como veio', () => {
      expect(dadosDaContraparte(nova({ telefone: '(21) 99999-0000' })).telefone).toBe('21999990000');
      expect(dadosDaContraparte(nova({ telefone: '+1 415', pais: 'US' })).telefone).toBe('+1 415');
    });

    it('nome fantasia aparece nas listas quando existir', () => {
      expect(nomeDaContraparte({ nome: 'Razão Ltda', nome_fantasia: 'Fantasia' })).toBe('Fantasia');
      expect(nomeDaContraparte({ nome: 'Razão Ltda', nome_fantasia: null })).toBe('Razão Ltda');
    });
  });

  describe('T02.06: duplicidade (RN-02.02 e CA-02.05)', () => {
    it('CNPJ já existente bloqueia e diz qual é', async () => {
      const primeira = await salvarContraparte(nova({ documento: CNPJ }));
      const { documentoRepetido } = await conferirContraparte(nova({ nome: 'Outra', documento: '11222333000181' }));
      expect(documentoRepetido?.id).toBe(primeira.id);
      await expect(salvarContraparte(nova({ nome: 'Outra', documento: CNPJ }))).rejects.toThrow('Já existe: Fornecedora Teste Ltda.');
    });

    it('a própria contraparte não conta como repetida', async () => {
      const primeira = await salvarContraparte(nova({ documento: CNPJ }));
      await expect(salvarContraparte(nova({ documento: CNPJ, site: 'https://novo.com.br' }), primeira.id)).resolves.toMatchObject({ site: 'https://novo.com.br' });
    });

    it('e-mail, telefone e nome parecido só avisam', async () => {
      await salvarContraparte(nova({ email: 'contato@teste.com.br', telefone: '(21) 99999-0000' }));
      const { documentoRepetido, avisos } = await conferirContraparte(nova({ nome: 'Fornecedora Teste Limitada', email: 'CONTATO@teste.com.br', telefone: '(21) 99999-0000' }));
      expect(documentoRepetido).toBeNull();
      expect(avisos).toEqual(['E-mail igual ao de Fornecedora Teste Ltda.', 'Telefone igual ao de Fornecedora Teste Ltda.', 'Nome parecido com Fornecedora Teste Ltda.']);
    });

    it('observações que parecem segredo pedem confirmação (RT-14)', async () => {
      expect((await conferirContraparte(nova({ observacoes: 'senha: 123456' }))).avisos.join(' ')).toContain('senha ou um token');
    });
  });

  describe('T02.06: salvar, vínculos e arquivo', () => {
    it('grava e registra por extenso', async () => {
      gravarMeta({ pessoa_atual_id: ID_CAMILA });
      const salva = await salvarContraparte(nova({ responsavel_id: ID_CAMILA }));
      expect(salva).toMatchObject({ criado_por: ID_CAMILA, situacao: 'ativa', exemplo: false, pais: 'BR' });
      expect((await historicoDoRegistro('contraparte', salva.id))[0]?.texto).toBe('Camila Lima criou a contraparte Fornecedora Teste Ltda');
    });

    it('editar registra o que mudou, sem mostrar o documento', async () => {
      const salva = await salvarContraparte(nova());
      await salvarContraparte(nova({ documento: CNPJ, papeis: ['fornecedor', 'cliente'] }), salva.id);
      const texto = (await historicoDoRegistro('contraparte', salva.id))[0]?.texto ?? '';
      expect(texto).toBe('Kimberly Grebe alterou a contraparte Fornecedora Teste Ltda: Documento; Papéis: de Fornecedor para Fornecedor, Cliente');
      expect(texto).not.toContain('11222');
    });

    it('uma contraparte pode ter dois papéis e aparece nas duas visões (CA-02.06)', async () => {
      await salvarContraparte(nova({ papeis: ['fornecedor', 'cliente'] }));
      const { contrapartes } = await carregarContrapartes();
      const filtrar = (papel: 'fornecedor' | 'cliente') => filtrarContrapartes(contrapartes, { ...FILTROS_CONTRAPARTES_INICIAIS, papel }).map((contraparte) => contraparte.nome);
      expect(filtrar('fornecedor')).toContain('Fornecedora Teste Ltda');
      expect(filtrar('cliente')).toEqual(['Fornecedora Teste Ltda']);
      expect(contrapartes.filter((contraparte) => contraparte.nome === 'Fornecedora Teste Ltda')).toHaveLength(1);
    });

    it('com contatos, não arquiva: só inativa', async () => {
      await expect(vinculosDaContraparte(ID_CONTRAPARTE_CONTABILIDADE)).resolves.toEqual(['Contato: Rafael Souza']);
      await expect(arquivarContraparte(ID_CONTRAPARTE_CONTABILIDADE)).rejects.toThrow('tem vínculos');
      await inativarContraparte(ID_CONTRAPARTE_CONTABILIDADE);
      expect((await repositorios.contraparte.obter(ID_CONTRAPARTE_CONTABILIDADE))?.situacao).toBe('inativa');
      await reativarContraparte(ID_CONTRAPARTE_CONTABILIDADE);
      expect((await repositorios.contraparte.obter(ID_CONTRAPARTE_CONTABILIDADE))?.situacao).toBe('ativa');
    });

    it('sem vínculos, arquiva e restaura', async () => {
      const salva = await salvarContraparte(nova());
      await arquivarContraparte(salva.id);
      expect((await repositorios.contraparte.listar()).map((contraparte) => contraparte.id)).not.toContain(salva.id);
      expect((await historicoDoRegistro('contraparte', salva.id))[0]?.texto).toBe('Kimberly Grebe arquivou a contraparte Fornecedora Teste Ltda');
      await restaurarContraparte(salva.id);
      expect((await repositorios.contraparte.listar()).map((contraparte) => contraparte.id)).toContain(salva.id);
    });

    it('quem é responsável por uma contraparte tem vínculo', async () => {
      await salvarContraparte(nova({ nome_fantasia: 'Fantasia Teste', responsavel_id: ID_KIMBERLY }));
      expect(await vinculosDaPessoa(ID_KIMBERLY)).toContain('Responsável por Fantasia Teste');
    });

    it('responsável fora da lista: o formulário pede outra', async () => {
      const salva = await salvarContraparte(nova({ responsavel_id: ID_CAMILA }));
      await repositorios.pessoa.atualizar(ID_CAMILA, { situacao: 'inativa' });
      const { pessoas } = await carregarContrapartes();
      expect(formularioDaContraparte(salva, pessoas).responsavel_id).toBe('');
    });
  });

  describe('T02.06: lista', () => {
    const filtros = (alteracoes: Partial<typeof FILTROS_CONTRAPARTES_INICIAIS>) => ({ ...FILTROS_CONTRAPARTES_INICIAIS, ...alteracoes });
    const nomes = (lista: readonly { nome: string }[]) => lista.map((item) => item.nome);

    it('em ordem pelo nome que aparece', async () => {
      const { contrapartes } = await carregarContrapartes();
      expect(filtrarContrapartes(contrapartes, filtros({})).map(nomeDaContraparte)).toEqual(['Estúdio Verde Hospedagem Ltda', 'Nuvem Clara Inc.', 'Souza Contabilidade']);
    });

    it('busca por nome, fantasia, e-mail e documento', async () => {
      await salvarContraparte(nova({ documento: CNPJ }));
      const { contrapartes } = await carregarContrapartes();
      expect(nomes(filtrarContrapartes(contrapartes, filtros({ busca: 'estudio' })))).toEqual(['Estúdio Verde Hospedagem Ltda']);
      expect(nomes(filtrarContrapartes(contrapartes, filtros({ busca: 'souza contabilidade' })))).toEqual(['Souza Contabilidade Ltda']);
      expect(nomes(filtrarContrapartes(contrapartes, filtros({ busca: 'contato@exemplo' })))).toEqual(['Souza Contabilidade Ltda']);
      expect(nomes(filtrarContrapartes(contrapartes, filtros({ busca: '11.222.333' })))).toEqual(['Fornecedora Teste Ltda']);
    });

    it('filtra por papel, responsável, estado, origem e situação', async () => {
      await salvarContraparte(nova({ origem: 'evento', situacao: 'inativa' }));
      const { contrapartes } = await carregarContrapartes();
      expect(nomes(filtrarContrapartes(contrapartes, filtros({ papel: 'parceiro' })))).toEqual(['Estúdio Verde Hospedagem Ltda']);
      expect(nomes(filtrarContrapartes(contrapartes, filtros({ uf: 'RJ' })))).toEqual(['Souza Contabilidade Ltda']);
      expect(nomes(filtrarContrapartes(contrapartes, filtros({ origem: 'evento' })))).toEqual(['Fornecedora Teste Ltda']);
      expect(nomes(filtrarContrapartes(contrapartes, filtros({ situacao: 'inativa' })))).toEqual(['Fornecedora Teste Ltda']);
      expect(nomes(filtrarContrapartes(contrapartes, filtros({ responsavel: ID_CAMILA }))).sort()).toEqual(['Estúdio Verde Hospedagem Ltda', 'Nuvem Clara Inc.']);
    });

    it('filtra por cidade, sem repetir por acento ou maiúscula', async () => {
      const uma = await salvarContraparte(nova({ nome: 'Fornecedora de Niterói', endereco: { ...CAMPOS_ENDERECO_VAZIOS, cidade: 'Niterói' } }));
      await salvarContraparte(nova({ nome: 'Outra de Niterói', endereco: { ...CAMPOS_ENDERECO_VAZIOS, cidade: 'NITEROI' } }));
      const { contrapartes } = await carregarContrapartes();
      expect(cidadesDasContrapartes(contrapartes)).toEqual(['Niterói', 'Rio de Janeiro']);
      const achadas = filtrarContrapartes(contrapartes, { ...FILTROS_CONTRAPARTES_INICIAIS, cidade: 'Niterói' }).map((contraparte) => contraparte.nome);
      expect(achadas).toEqual(['Fornecedora de Niterói', 'Outra de Niterói']);
      expect(achadas).toContain(uma.nome);
    });

    it('arquivadas numa visão à parte', async () => {
      const salva = await salvarContraparte(nova());
      await arquivarContraparte(salva.id);
      const { contrapartes } = await carregarContrapartes();
      expect(nomes(filtrarContrapartes(contrapartes, filtros({})))).not.toContain('Fornecedora Teste Ltda');
      expect(nomes(filtrarContrapartes(contrapartes, filtros({ arquivadas: true })))).toEqual(['Fornecedora Teste Ltda']);
    });
  });

  describe('vínculo em Pessoas', () => {
    it('externa pode ter contraparte; interna, não', () => {
      expect(dadosDoFormulario({ ...FORMULARIO_PESSOA_VAZIO, nome_completo: 'Ana', tipo: 'externa', contraparte_id: ID_CONTRAPARTE_CONTABILIDADE }).contraparte_id).toBe(ID_CONTRAPARTE_CONTABILIDADE);
      expect(dadosDoFormulario({ ...FORMULARIO_PESSOA_VAZIO, nome_completo: 'Ana', tipo: 'externa', contraparte_id: '' }).contraparte_id).toBeNull();
      expect(dadosDoFormulario({ ...FORMULARIO_PESSOA_VAZIO, nome_completo: 'Ana', tipo: 'interna', contraparte_id: ID_CONTRAPARTE_CONTABILIDADE }).contraparte_id).toBeNull();
    });

    it('o filtro de pessoas por contraparte', async () => {
      const { pessoas } = await carregarPessoas();
      expect(filtrarPessoas(pessoas, { ...FILTROS_PESSOAS_INICIAIS, contraparte: ID_CONTRAPARTE_CONTABILIDADE }).map((pessoa) => pessoa.nome_completo)).toEqual(['Rafael Souza']);
    });

    it('o histórico da pessoa diz a contraparte por extenso', async () => {
      const ana = await salvarPessoa({ ...FORMULARIO_PESSOA_VAZIO, nome_completo: 'Ana Dias', tipo: 'externa' });
      await salvarPessoa({ ...FORMULARIO_PESSOA_VAZIO, nome_completo: 'Ana Dias', tipo: 'externa', contraparte_id: ID_CONTRAPARTE_CONTABILIDADE }, ana.id);
      expect((await historicoRecente(1))[0]?.texto).toBe('Kimberly Grebe alterou Ana Dias: Contraparte: de não informado para Souza Contabilidade Ltda');
    });
  });

  describe('T02.05: carga inicial', () => {
    it('a entidade planejada da Numa, para permitir rascunhos', async () => {
      const { entidades } = await carregarEntidades();
      expect(entidades).toMatchObject([{ id: ID_ENTIDADE_PLANEJADA, nome: 'Planejada — Numa', situacao: 'planejada', entidade_padrao: true, exemplo: false, documento: null }]);
    });
  });

  describe('T02.05: validação', () => {
    it('nome é obrigatório; o resto, não, enquanto não for ativa', () => {
      expect(mensagensEntidade({})).toEqual([]);
      expect(mensagensEntidade({ nome: '' })).toEqual(['Informe o nome ou a razão social.']);
    });

    it('documento confere com o tipo, mesmo em planejada', () => {
      expect(mensagensEntidade({ tipo_pessoa: 'pj', documento: '11.222.333/0001-82' })).toEqual(['Este CNPJ não é válido. Confira os números.']);
      expect(mensagensEntidade({ tipo_pessoa: 'pf', documento: CPF })).toEqual([]);
    });

    it('passar para Ativa exige documento, endereço, representante e data de abertura', () => {
      expect(mensagensEntidade({ situacao: 'ativa' })).toEqual(['Para ativar, informe o CNPJ.', 'Para ativar, preencha o endereço: CEP, logradouro, número, bairro, cidade e estado.', 'Para ativar, escolha pelo menos um representante legal.', 'Para ativar, informe a data de abertura.']);
      expect(mensagensEntidade({ situacao: 'ativa', documento: CNPJ, endereco: ENDERECO_COMPLETO, representantes: [ID_KIMBERLY], data_abertura: '2026-11-06' })).toEqual([]);
    });

    it('CNPJ inválido não ativa', () => {
      expect(mensagensEntidade({ situacao: 'ativa', documento: '11.222.333/0001-82', endereco: ENDERECO_COMPLETO, representantes: [ID_KIMBERLY], data_abertura: '2026-11-06' })).toEqual(['Este CNPJ não é válido. Confira os números.']);
    });
  });

  describe('T02.05: regras', () => {
    const ativa = () => novaEntidade({ situacao: 'ativa', documento: CNPJ, endereco: ENDERECO_COMPLETO, representantes: [ID_KIMBERLY], data_abertura: '2026-11-06' });

    it('grava com os representantes', async () => {
      const entidade = await salvarEntidade(ativa());
      const { representantes } = await carregarEntidades();
      expect(entidade).toMatchObject({ situacao: 'ativa', documento: '11222333000181', entidade_padrao: false });
      expect(representantesDaEntidade(entidade.id, representantes)).toEqual([ID_KIMBERLY]);
      expect(await vinculosDaPessoa(ID_KIMBERLY)).toContain('Representante de Numa Tecnologia Ltda');
    });

    it('trocar representantes registra quem entrou e quem saiu', async () => {
      const entidade = await salvarEntidade(ativa());
      await salvarEntidade({ ...ativa(), representantes: [ID_CAMILA] }, entidade.id);
      const textos = (await historicoRecente(5)).map((linha) => linha.texto);
      expect(textos).toContain('Kimberly Grebe tirou Kimberly Grebe como representante de Numa Tecnologia Ltda');
      expect(textos).toContain('Kimberly Grebe colocou Camila Lima como representante de Numa Tecnologia Ltda');
    });

    it('entidade padrão: só uma', async () => {
      const nova1 = await salvarEntidade(novaEntidade({ entidade_padrao: true }));
      const { entidades } = await carregarEntidades();
      expect(entidades.filter((entidade) => entidade.entidade_padrao).map((entidade) => entidade.id)).toEqual([nova1.id]);
    });

    it('Planejada pode ser vinculada, mas não aparece para emissão final (CA-02.04)', async () => {
      const entidade = await salvarEntidade(ativa());
      const { entidades } = await carregarEntidades();
      expect(entidadesParaEmissao(entidades).map((item) => item.id)).toEqual([entidade.id]);
      expect(entidadesParaVincular(entidades).map((item) => item.id)).toContain(ID_ENTIDADE_PLANEJADA);
    });

    it('encerrada não é mais oferecida', async () => {
      const entidade = await salvarEntidade(novaEntidade({ situacao: 'encerrada' }));
      const { entidades } = await carregarEntidades();
      expect(entidadesParaVincular(entidades).map((item) => item.id)).not.toContain(entidade.id);
    });

    it('produto com entidade: a entidade fica bloqueada e diz por quem', async () => {
      const formulario = esquemaFormularioProduto.parse({ ...formularioProdutoVazio(ID_MARCA_KIPI), nome: 'Kipi', codigo_curto: 'KIPI', estagio: 'em_uso', responsavel_id: ID_KIMBERLY, entidade_id: ID_ENTIDADE_PLANEJADA });
      await salvarProduto(formulario, ID_PRODUTO_KIPI);
      expect(await vinculosDaEntidade(ID_ENTIDADE_PLANEJADA)).toEqual(['Produto Kipi']);
      await expect(arquivarEntidade(ID_ENTIDADE_PLANEJADA)).rejects.toThrow('Esta entidade está em uso: Produto Kipi.');
    });

    it('uma entidade encerrada não pode ser a padrão', () => {
      expect(mensagensEntidade({ situacao: 'encerrada', entidade_padrao: true })).toEqual(['Uma entidade encerrada não pode ser a padrão.']);
      expect(mensagensEntidade({ situacao: 'encerrada', entidade_padrao: false })).toEqual([]);
    });

    it('arquivar a padrão: deixa de ser, e não volta a ser ao restaurar', async () => {
      const antiga = await salvarEntidade(novaEntidade({ entidade_padrao: true }));
      await arquivarEntidade(antiga.id);
      expect((await repositorios.entidade.obter(antiga.id))?.entidade_padrao).toBe(false);
      const atual = await salvarEntidade(novaEntidade({ nome: 'Outra Ltda', entidade_padrao: true }));
      await restaurarEntidade(antiga.id);
      const { entidades } = await carregarEntidades();
      expect(entidades.filter((entidade) => entidade.entidade_padrao).map((entidade) => entidade.id)).toEqual([atual.id]);
    });

    it('sem uso, arquiva', async () => {
      const entidade = await salvarEntidade(novaEntidade());
      await arquivarEntidade(entidade.id);
      expect((await repositorios.entidade.listar()).map((item) => item.id)).not.toContain(entidade.id);
    });

    it('o esquema recusa ativa sem os dados, mesmo sem passar pelo formulário', async () => {
      await expect(repositorios.entidade.atualizar(ID_ENTIDADE_PLANEJADA, { situacao: 'ativa' })).rejects.toMatchObject({ tipo: 'validacao' });
    });

    it('sem espaço no navegador, nem a entidade nem os representantes ficam pela metade', async () => {
      const antes = (await repositorios.entidade.listar()).length;
      const setItem = armazenamento.setItem.bind(armazenamento);
      armazenamento.setItem = (chave: string, valor: string) => {
        if (chave.endsWith(':auditoria')) throw new DOMException('cheio', 'QuotaExceededError');
        setItem(chave, valor);
      };
      await expect(salvarEntidade(ativa())).rejects.toMatchObject({ tipo: 'armazenamento' });
      armazenamento.setItem = setItem;
      expect(await repositorios.entidade.listar()).toHaveLength(antes);
    });
  });

  describe('com os outros dados', () => {
    it('limpar exemplos tira o contador fictício sem deixar nada pendurado', async () => {
      const real = await salvarPessoa({ ...FORMULARIO_PESSOA_VAZIO, nome_completo: 'Contato Real', tipo: 'externa', contraparte_id: ID_CONTRAPARTE_CONTABILIDADE });
      const entidade = await salvarEntidade(novaEntidade({ contador_id: ID_CONTRAPARTE_CONTABILIDADE }));
      await limparExemplos();
      expect((await repositorios.contraparte.listar())).toEqual([]);
      expect((await repositorios.pessoa.obter(real.id))?.contraparte_id).toBeNull();
      expect((await repositorios.entidade.obter(entidade.id))?.contador_id).toBeNull();
    });

    it('restaurar exemplos volta à carga inicial', async () => {
      await salvarContraparte(nova());
      await salvarEntidade(novaEntidade());
      await restaurarExemplos();
      expect((await carregarContrapartes()).contrapartes).toHaveLength(3);
      expect((await carregarEntidades()).entidades).toHaveLength(1);
    });

    it('exportar e importar levam tudo', async () => {
      await salvarContraparte(nova({ documento: CNPJ }));
      const arquivo = JSON.parse((await exportarTudo()).conteudo) as ArquivoDeDados;
      await restaurarExemplos();
      await aplicarImportacao(arquivo);
      expect((await carregarContrapartes()).contrapartes.map((contraparte) => contraparte.nome)).toContain('Fornecedora Teste Ltda');
    });

    it('backup anterior: entidade volta à inicial; contrapartes ficam vazias', async () => {
      const arquivo = JSON.parse((await exportarTudo()).conteudo) as ArquivoDeDados;
      delete arquivo.tabelas.entidade;
      delete arquivo.tabelas.entidade_representante;
      delete arquivo.tabelas.contraparte;
      arquivo.versao_dados = 4;
      await aplicarImportacao(arquivo);
      expect((await carregarEntidades()).entidades).toHaveLength(1);
      expect((await carregarContrapartes()).contrapartes).toEqual([]);
    });
  });

  describe('dados da versão anterior', () => {
    function voltarParaVersao4() {
      for (const tabela of ['contraparte', 'entidade', 'entidade_representante']) armazenamento.removeItem(chaveDaTabela(tabela));
      gravarMeta({ versao_dados: 4 });
      esquecerMetaEmMemoria();
    }

    it('acrescenta sem tocar no que existia', async () => {
      await repositorios.configuracao.salvar({ organizacao_nome: 'Numa Planejada' });
      voltarParaVersao4();
      expect((await carregarEntidades()).entidades).toHaveLength(1);
      expect((await carregarContrapartes()).contrapartes).toHaveLength(3);
      expect((await repositorios.configuracao.ler()).organizacao_nome).toBe('Numa Planejada');
      expect(lerMeta().versao_dados).toBe(VERSAO_DADOS);
    });

    it('quem já limpou os exemplos não recebe exemplos novos', async () => {
      await limparExemplos();
      voltarParaVersao4();
      expect((await carregarContrapartes()).contrapartes).toEqual([]);
    });
  });
});
