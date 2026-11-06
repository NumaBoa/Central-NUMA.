import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarArmazenamentoEmMemoria, usarDriverDeTeste, type Driver } from '@/dados/armazenamento';
import { AREAS_INICIAIS, ID_CAMILA, ID_KIMBERLY } from '@/dados/exemplos/base';
import { listarHistorico } from '@/dados/historico';
import { esquecerMetaEmMemoria, gravarMeta } from '@/dados/meta';
import { repositorios } from '@/dados/repositorios';
import type { Pessoa } from '@/dados/tipos/pessoa';
import { limparExemplos } from './dados';
import { historicoDaPessoa } from './historico';
import { pessoasDoSeletor, resolverPessoaAtual } from './pessoa-atual';
import {
  areasDaPessoa,
  arquivarPessoa,
  carregarPessoas,
  conferirPessoa,
  dadosDoFormulario,
  esquemaFormularioPessoa,
  filtrarPessoas,
  FILTROS_PESSOAS_INICIAIS,
  formatarCpf,
  formatarTelefone,
  formularioDaPessoa,
  FORMULARIO_PESSOA_VAZIO,
  inativarPessoa,
  nomeDeExibicaoPadrao,
  reativarPessoa,
  restaurarPessoa,
  salvarPessoa,
  vinculosDaPessoa,
  type FormularioPessoa,
} from './pessoas';

const ID_BRUNA = '2d9f3e74-5b8a-4c3d-9f4e-7a0c9e6b3c03';
const ID_RAFAEL = '3ea04f85-6c9b-4d4e-8a5f-8b1d0f7c4d04';
const CPF = '529.982.247-25';
const OUTRO_CPF = '111.444.777-35';
const [TECNOLOGIA, FINANCEIRO] = AREAS_INICIAIS;

function novaPessoa(alteracoes: Partial<FormularioPessoa> = {}): FormularioPessoa {
  return { ...FORMULARIO_PESSOA_VAZIO, nome_completo: 'Dora Nunes', ...alteracoes };
}

function mensagens(alteracoes: Partial<FormularioPessoa>): string[] {
  const resultado = esquemaFormularioPessoa.safeParse(novaPessoa(alteracoes));
  return resultado.success ? [] : resultado.error.issues.map((falha) => falha.message);
}

async function pessoa(id: string): Promise<Pessoa> {
  const encontrada = await repositorios.pessoa.obter(id);
  if (!encontrada) throw new Error('não achou');
  return encontrada;
}

describe('T02.02 Pessoas', () => {
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

  describe('validação', () => {
    it('só o nome é obrigatório', () => {
      expect(mensagens({})).toEqual([]);
      expect(mensagens({ nome_completo: '  ' })).toEqual(['Informe o nome completo.']);
    });

    it('e-mail, telefone e CPF são opcionais, mas precisam ser válidos', () => {
      expect(mensagens({ email: 'dora' })).toEqual(['Informe um e-mail válido.']);
      expect(mensagens({ telefone: '12345' })).toEqual(['Use o formato (00) 00000-0000.']);
      expect(mensagens({ cpf: '529.982.247-24' })).toEqual(['Este CPF não é válido. Confira os números.']);
      expect(mensagens({ email: 'dora@numa.com.br', telefone: '(21) 99999-0000', cpf: CPF })).toEqual([]);
    });
  });

  describe('máscaras', () => {
    it('telefone enquanto se digita, celular e fixo', () => {
      expect(formatarTelefone('2')).toBe('(2');
      expect(formatarTelefone('219')).toBe('(21) 9');
      expect(formatarTelefone('2133330000')).toBe('(21) 3333-0000');
      expect(formatarTelefone('21999990000')).toBe('(21) 99999-0000');
      expect(formatarTelefone('219999900001234')).toBe('(21) 99999-0000');
      expect(formatarTelefone('')).toBe('');
    });

    it('CPF enquanto se digita', () => {
      expect(formatarCpf('529')).toBe('529');
      expect(formatarCpf('5299')).toBe('529.9');
      expect(formatarCpf('5299822')).toBe('529.982.2');
      expect(formatarCpf('52998224725')).toBe(CPF);
      expect(formatarCpf('529982247259999')).toBe(CPF);
    });
  });

  describe('conversão', () => {
    it('nome de exibição: primeiro nome + sobrenome (T02.02)', () => {
      expect(nomeDeExibicaoPadrao('Maria Clara de Souza')).toBe('Maria Souza');
      expect(nomeDeExibicaoPadrao('Dora')).toBe('Dora');
      expect(dadosDoFormulario(novaPessoa({ nome_completo: 'Maria Clara de Souza' })).nome_exibicao).toBe('Maria Souza');
      expect(dadosDoFormulario(novaPessoa({ nome_exibicao: 'Mari' })).nome_exibicao).toBe('Mari');
    });

    it('vazio é vazio; telefone e CPF ficam só com os dígitos', () => {
      expect(dadosDoFormulario(novaPessoa())).toMatchObject({ email: null, telefone: null, cpf: null, funcao: null, observacoes: null });
      expect(dadosDoFormulario(novaPessoa({ telefone: '(21) 99999-0000', cpf: CPF }))).toMatchObject({ telefone: '21999990000', cpf: '52998224725' });
    });

    it('o que só vale para um tipo some ao mudar de tipo', () => {
      expect(dadosDoFormulario(novaPessoa({ tipo: 'externa', eh_socia: true }))).toMatchObject({ eh_socia: false });
      expect(dadosDoFormulario(novaPessoa({ tipo: 'interna', papeis_contato: ['financeiro'] }))).toMatchObject({ papeis_contato: [] });
    });

    it('o formulário mostra o que está salvo, com as máscaras', async () => {
      const salva = await salvarPessoa(novaPessoa({ telefone: '(21) 99999-0000', cpf: CPF, areas: [TECNOLOGIA.id] }));
      expect(formularioDaPessoa(salva, [TECNOLOGIA.id])).toMatchObject({ telefone: '(21) 99999-0000', cpf: CPF, areas: [TECNOLOGIA.id] });
    });
  });

  describe('salvar', () => {
    it('cadastra, com o histórico dizendo quem fez', async () => {
      gravarMeta({ pessoa_atual_id: ID_CAMILA });
      const salva = await salvarPessoa(novaPessoa());
      expect(salva).toMatchObject({ nome_completo: 'Dora Nunes', nome_exibicao: 'Dora Nunes', criado_por: ID_CAMILA, situacao: 'ativa', exemplo: false, contraparte_id: null });
      expect((await historicoDaPessoa(salva.id))[0]?.texto).toBe('Camila Lima cadastrou Dora Nunes');
    });

    it('pessoa interna nova aparece em "Você é"', async () => {
      const salva = await salvarPessoa(novaPessoa());
      expect(pessoasDoSeletor(await repositorios.pessoa.listar()).map((item) => item.id)).toContain(salva.id);
    });

    it('pessoa externa não aparece em "Você é"', async () => {
      const salva = await salvarPessoa(novaPessoa({ tipo: 'externa' }));
      expect(pessoasDoSeletor(await repositorios.pessoa.listar()).map((item) => item.id)).not.toContain(salva.id);
    });

    it('grava as áreas junto, e dá para trocar depois', async () => {
      const salva = await salvarPessoa(novaPessoa({ areas: [TECNOLOGIA.id, FINANCEIRO.id] }));
      expect(areasDaPessoa(salva.id, await carregarPessoas()).map((area) => area.nome)).toEqual(['Tecnologia', 'Financeiro']);
      await salvarPessoa(novaPessoa({ areas: [FINANCEIRO.id] }), salva.id);
      expect(areasDaPessoa(salva.id, await carregarPessoas()).map((area) => area.nome)).toEqual(['Financeiro']);
    });

    it('o histórico da ficha conta as áreas em que entrou e de que saiu', async () => {
      const salva = await salvarPessoa(novaPessoa({ areas: [TECNOLOGIA.id] }));
      await salvarPessoa(novaPessoa({ areas: [FINANCEIRO.id] }), salva.id);
      const textos = (await historicoDaPessoa(salva.id)).map((linha) => linha.texto);
      expect(textos).toContain('Kimberly Grebe colocou Dora Nunes na área Tecnologia');
      expect(textos).toContain('Kimberly Grebe tirou Dora Nunes da área Tecnologia');
      expect(textos).toContain('Kimberly Grebe colocou Dora Nunes na área Financeiro');
    });

    it('virar externa tira das áreas', async () => {
      const salva = await salvarPessoa(novaPessoa({ areas: [TECNOLOGIA.id] }));
      await salvarPessoa(novaPessoa({ tipo: 'externa', areas: [TECNOLOGIA.id] }), salva.id);
      expect(areasDaPessoa(salva.id, await carregarPessoas())).toEqual([]);
    });

    it('o histórico diz o que mudou, de quanto para quanto', async () => {
      const salva = await salvarPessoa(novaPessoa({ funcao: 'Designer' }));
      await salvarPessoa(novaPessoa({ funcao: 'Diretora', telefone: '(21) 99999-0000' }), salva.id);
      expect((await historicoDaPessoa(salva.id))[0]?.texto).toBe('Kimberly Grebe alterou Dora Nunes: Função: de Designer para Diretora; Telefone: de não informado para (21) 99999-0000');
    });

    it('no CPF e nas observações, o histórico diz só que mudou, sem mostrar o conteúdo', async () => {
      const salva = await salvarPessoa(novaPessoa());
      await salvarPessoa(novaPessoa({ cpf: CPF, observacoes: 'Texto reservado' }), salva.id);
      const [linha] = await historicoDaPessoa(salva.id);
      expect(linha?.texto).toBe('Kimberly Grebe alterou Dora Nunes: CPF; Observações');
      expect(linha?.texto).not.toContain('529');
    });

    it('sem espaço no navegador, nem a pessoa nem as áreas ficam pela metade', async () => {
      const antes = (await repositorios.pessoa.listar()).length;
      const setItem = armazenamento.setItem.bind(armazenamento);
      armazenamento.setItem = (chave: string, valor: string) => {
        if (chave.endsWith(':auditoria')) throw new DOMException('cheio', 'QuotaExceededError');
        setItem(chave, valor);
      };
      await expect(salvarPessoa(novaPessoa({ areas: [TECNOLOGIA.id] }))).rejects.toMatchObject({ tipo: 'armazenamento' });
      armazenamento.setItem = setItem;
      expect(await repositorios.pessoa.listar()).toHaveLength(antes);
    });
  });

  describe('duplicidade (RN-02.02 e CA-02.01)', () => {
    it('duas pessoas com o mesmo CPF não podem ser salvas', async () => {
      const dora = await salvarPessoa(novaPessoa({ cpf: CPF }));
      const conferencia = await conferirPessoa(novaPessoa({ nome_completo: 'Outra Pessoa', cpf: CPF }));
      expect(conferencia.cpfRepetido?.id).toBe(dora.id);
      await expect(salvarPessoa(novaPessoa({ nome_completo: 'Outra Pessoa', cpf: CPF }))).rejects.toThrow('Já existe: Dora Nunes.');
    });

    it('o CPF da própria pessoa não conta como repetido', async () => {
      const dora = await salvarPessoa(novaPessoa({ cpf: CPF }));
      expect((await conferirPessoa(novaPessoa({ cpf: CPF }), dora.id)).cpfRepetido).toBeNull();
      await expect(salvarPessoa(novaPessoa({ cpf: CPF, funcao: 'Nova' }), dora.id)).resolves.toMatchObject({ funcao: 'Nova' });
    });

    it('CPF de pessoa arquivada também bloqueia: ela pode voltar', async () => {
      const dora = await salvarPessoa(novaPessoa({ cpf: CPF }));
      await arquivarPessoa(dora.id);
      expect((await conferirPessoa(novaPessoa({ nome_completo: 'Outra', cpf: CPF }))).cpfRepetido?.id).toBe(dora.id);
    });

    it('CPF diferente passa', async () => {
      await salvarPessoa(novaPessoa({ cpf: CPF }));
      await expect(salvarPessoa(novaPessoa({ nome_completo: 'Outra', cpf: OUTRO_CPF }))).resolves.toBeTruthy();
    });

    it('e-mail ou telefone iguais só avisam', async () => {
      await salvarPessoa(novaPessoa({ email: 'financeiro@numa.com.br', telefone: '(21) 99999-0000' }));
      const { cpfRepetido, avisos } = await conferirPessoa(novaPessoa({ nome_completo: 'Outra Pessoa', email: 'FINANCEIRO@numa.com.br', telefone: '(21) 99999-0000' }));
      expect(cpfRepetido).toBeNull();
      expect(avisos).toEqual(['E-mail igual ao de Dora Nunes.', 'Telefone igual ao de Dora Nunes.']);
      await expect(salvarPessoa(novaPessoa({ nome_completo: 'Outra Pessoa', email: 'financeiro@numa.com.br' }))).resolves.toBeTruthy();
    });

    it('nome parecido só avisa, mesmo com acento ou letra diferente', async () => {
      expect((await conferirPessoa(novaPessoa({ nome_completo: 'Camilla Lima' }))).avisos).toEqual(['Nome parecido com Camila Lima.']);
      expect((await conferirPessoa(novaPessoa({ nome_completo: 'CAMILA LIMA' }))).avisos).toEqual(['Nome parecido com Camila Lima.']);
    });

    it('ao editar, a própria pessoa não entra nos avisos', async () => {
      const { avisos } = await conferirPessoa(novaPessoa({ nome_completo: 'Camila Lima' }), ID_CAMILA);
      expect(avisos).toEqual([]);
    });

    it('observações que parecem segredo pedem confirmação (RT-14)', async () => {
      expect((await conferirPessoa(novaPessoa({ observacoes: 'senha: 123456' }))).avisos.join(' ')).toContain('senha ou um token');
      expect((await conferirPessoa(novaPessoa({ observacoes: 'Prefere contato por e-mail.' }))).avisos).toEqual([]);
    });
  });

  describe('situação (RN-02.04 e CA-02.02)', () => {
    it('inativa não aparece nos seletores de novos registros, mas continua existindo', async () => {
      await inativarPessoa(ID_BRUNA);
      const todas = await repositorios.pessoa.listar();
      expect(pessoasDoSeletor(todas).map((item) => item.id)).not.toContain(ID_BRUNA);
      expect(todas.map((item) => item.id)).toContain(ID_BRUNA);
      expect((await historicoDaPessoa(ID_BRUNA))[0]?.texto).toBe('Kimberly Grebe inativou Bruna Alves');
    });

    it('reativar traz de volta', async () => {
      await inativarPessoa(ID_BRUNA);
      await reativarPessoa(ID_BRUNA);
      expect(pessoasDoSeletor(await repositorios.pessoa.listar()).map((item) => item.id)).toContain(ID_BRUNA);
      expect((await historicoDaPessoa(ID_BRUNA))[0]?.texto).toBe('Kimberly Grebe reativou Bruna Alves');
    });

    it('quem era a pessoa atual passa para a primeira da lista', async () => {
      gravarMeta({ pessoa_atual_id: ID_CAMILA });
      await inativarPessoa(ID_CAMILA);
      const todas = await repositorios.pessoa.listar();
      expect(resolverPessoaAtual(todas, ID_CAMILA)?.id).toBe(ID_KIMBERLY);
    });

    it('não deixa ficar sem nenhuma pessoa interna ativa', async () => {
      await inativarPessoa(ID_BRUNA);
      await inativarPessoa(ID_CAMILA);
      await expect(inativarPessoa(ID_KIMBERLY)).rejects.toThrow('única pessoa interna ativa');
      expect((await pessoa(ID_KIMBERLY)).situacao).toBe('ativa');
    });

    it('nem pelo formulário: mudar a situação ou o tipo da última também é barrado', async () => {
      await inativarPessoa(ID_BRUNA);
      await inativarPessoa(ID_CAMILA);
      const kimberly = formularioDaPessoa(await pessoa(ID_KIMBERLY), []);
      await expect(salvarPessoa({ ...kimberly, situacao: 'inativa' }, ID_KIMBERLY)).rejects.toThrow('única pessoa interna ativa');
      await expect(salvarPessoa({ ...kimberly, tipo: 'externa' }, ID_KIMBERLY)).rejects.toThrow('única pessoa interna ativa');
    });
  });

  describe('vínculos e arquivo', () => {
    it('conta o que depende da pessoa', async () => {
      const deCamila = await vinculosDaPessoa(ID_CAMILA);
      expect(deCamila).toContain('Responsável padrão de Tecnologia');
      expect(deCamila).toContain('Atua em Tecnologia');
      expect(deCamila).toContain('Atua em Comercial');
      expect(deCamila).toContain('Responsável pelo backup semanal');
      expect(await vinculosDaPessoa(ID_RAFAEL)).toEqual([]);
    });

    it('sem vínculos, pode arquivar e restaurar', async () => {
      await arquivarPessoa(ID_RAFAEL);
      expect((await repositorios.pessoa.listar()).map((item) => item.id)).not.toContain(ID_RAFAEL);
      expect((await historicoDaPessoa(ID_RAFAEL))[0]?.texto).toBe('Kimberly Grebe arquivou Rafael Souza');
      await restaurarPessoa(ID_RAFAEL);
      expect((await repositorios.pessoa.listar()).map((item) => item.id)).toContain(ID_RAFAEL);
      expect((await historicoDaPessoa(ID_RAFAEL))[0]?.texto).toBe('Kimberly Grebe restaurou Rafael Souza');
    });

    it('com vínculos, não arquiva: só inativa', async () => {
      await expect(arquivarPessoa(ID_CAMILA)).rejects.toThrow('tem vínculos');
      expect((await pessoa(ID_CAMILA)).arquivado_em).toBeNull();
      await expect(inativarPessoa(ID_CAMILA)).resolves.toBeUndefined();
    });

    it('não deixa arquivar a última pessoa interna ativa, mesmo sem vínculos', async () => {
      const dora = await salvarPessoa(novaPessoa());
      for (const id of [ID_KIMBERLY, ID_CAMILA, ID_BRUNA]) await repositorios.pessoa.atualizar(id, { situacao: 'inativa' });
      await expect(arquivarPessoa(dora.id)).rejects.toThrow('única pessoa interna ativa');
    });

    it('arquivada sai dos seletores', async () => {
      const dora = await salvarPessoa(novaPessoa());
      await arquivarPessoa(dora.id);
      const todas = await repositorios.pessoa.listar({ incluirArquivados: true });
      expect(pessoasDoSeletor(todas).map((item) => item.id)).not.toContain(dora.id);
    });

    it('limpar exemplos tira a pessoa das áreas, mesmo que a ligação seja real', async () => {
      const bruna = formularioDaPessoa(await pessoa(ID_BRUNA), []);
      await salvarPessoa({ ...bruna, areas: [TECNOLOGIA.id] }, ID_BRUNA);
      await limparExemplos();
      const { ligacoes } = await carregarPessoas();
      expect(ligacoes.map((ligacao) => ligacao.pessoa_id)).not.toContain(ID_BRUNA);
      expect(ligacoes.map((ligacao) => ligacao.pessoa_id)).toContain(ID_CAMILA);
    });
  });

  describe('lista', () => {
    const filtros = (alteracoes: Partial<typeof FILTROS_PESSOAS_INICIAIS>) => ({ ...FILTROS_PESSOAS_INICIAIS, ...alteracoes });
    const nomes = (lista: readonly Pessoa[]) => lista.map((item) => item.nome_completo);

    it('vem em ordem alfabética', async () => {
      expect(nomes(filtrarPessoas(await repositorios.pessoa.listar(), filtros({})))).toEqual(['Bruna Alves', 'Camila Lima', 'Kimberly Grebe', 'Rafael Souza']);
    });

    it('filtra por tipo e por situação', async () => {
      await inativarPessoa(ID_BRUNA);
      const todas = await repositorios.pessoa.listar();
      expect(nomes(filtrarPessoas(todas, filtros({ tipo: 'externa' })))).toEqual(['Rafael Souza']);
      expect(nomes(filtrarPessoas(todas, filtros({ situacao: 'inativa' })))).toEqual(['Bruna Alves']);
      expect(nomes(filtrarPessoas(todas, filtros({ tipo: 'interna', situacao: 'ativa' })))).toEqual(['Camila Lima', 'Kimberly Grebe']);
    });

    it('busca por nome e e-mail, sem considerar acentos nem maiúsculas', async () => {
      const todas = await repositorios.pessoa.listar();
      expect(nomes(filtrarPessoas(todas, filtros({ busca: 'CAMÍLA' })))).toEqual(['Camila Lima']);
      expect(nomes(filtrarPessoas(todas, filtros({ busca: 'rafael@exemplo' })))).toEqual(['Rafael Souza']);
      expect(nomes(filtrarPessoas(todas, filtros({ busca: 'ninguém' })))).toEqual([]);
    });

    it('busca por telefone, com ou sem pontuação', async () => {
      await salvarPessoa(novaPessoa({ telefone: '(21) 99999-0000' }));
      const todas = await repositorios.pessoa.listar();
      expect(nomes(filtrarPessoas(todas, filtros({ busca: '(21) 99999' })))).toEqual(['Dora Nunes']);
      expect(nomes(filtrarPessoas(todas, filtros({ busca: '219999' })))).toEqual(['Dora Nunes']);
    });

    it('arquivadas ficam numa visão à parte', async () => {
      await arquivarPessoa(ID_RAFAEL);
      const todas = await repositorios.pessoa.listar({ incluirArquivados: true });
      expect(nomes(filtrarPessoas(todas, filtros({})))).not.toContain('Rafael Souza');
      expect(nomes(filtrarPessoas(todas, filtros({ arquivadas: true })))).toEqual(['Rafael Souza']);
    });
  });
});
