import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { criarArmazenamentoEmMemoria, lerTabela, usarDriverDeTeste, type Driver } from './armazenamento';
import { ErroDeDados } from './erros';
import { ID_CAMILA, ID_KIMBERLY } from './exemplos/base';
import { listarHistorico } from './historico';
import { esquecerMetaEmMemoria, gravarMeta, lerMeta } from './meta';
import { criarRepositorioLocal } from './repositorio-local';
import { repositorios } from './repositorios';
import { esquemaControle } from './tipos/controle';
import type { Pessoa } from './tipos/pessoa';

const esquemaComCodigo = esquemaControle.extend({ codigo: z.string(), titulo: z.string().min(1) });

function dadosDePessoa(nome: string) {
  return {
    nome_completo: nome,
    nome_exibicao: null,
    tipo: 'externa' as const,
    eh_socia: false,
    contraparte_id: null,
    papeis_contato: [],
    funcao: null,
    email: null,
    telefone: null,
    cpf: null,
    observacoes: null,
    situacao: 'ativa' as const,
  };
}

describe('repositório local', () => {
  beforeEach(() => {
    usarDriverDeTeste(criarArmazenamentoEmMemoria());
    esquecerMetaEmMemoria();
    vi.useFakeTimers({ now: new Date('2026-11-05T15:00:00.000Z'), toFake: ['Date'] });
  });
  afterEach(() => {
    usarDriverDeTeste(null);
    esquecerMetaEmMemoria();
    vi.useRealTimers();
  });

  it('carrega os exemplos no primeiro acesso, uma vez só (02 §0.3)', async () => {
    expect((await repositorios.pessoa.listar()).map((p) => p.nome_completo)).toEqual(['Kimberly Grebe', 'Camila Lima', 'Bruna Alves', 'Rafael Souza']);
    await repositorios.pessoa.arquivar(ID_CAMILA, 'teste');
    expect(await repositorios.pessoa.listar()).toHaveLength(3);
  });

  it('preenche os campos de controle com a pessoa de "Você é" (RT-02)', async () => {
    gravarMeta({ pessoa_atual_id: ID_CAMILA });
    const nova = await repositorios.pessoa.criar(dadosDePessoa('Nova Pessoa'));
    expect(z.uuid().safeParse(nova.id).success).toBe(true);
    expect(nova).toMatchObject({ criado_por: ID_CAMILA, atualizado_por: ID_CAMILA, criado_em: '2026-11-05T15:00:00.000Z', versao_registro: 1, exemplo: false, arquivado_em: null });
  });

  it('grava a criação no histórico (RT-04)', async () => {
    const nova = await repositorios.pessoa.criar(dadosDePessoa('Nova Pessoa'));
    const [evento] = await listarHistorico({ tabela: 'pessoa', registroId: nova.id });
    expect(evento).toMatchObject({ acao: 'inseriu', usuario_id: ID_KIMBERLY, registro_id: nova.id });
    expect(evento?.depois).toMatchObject({ nome_completo: 'Nova Pessoa' });
  });

  it('ao alterar, sobe a versão e guarda só o que mudou, de → para', async () => {
    const nova = await repositorios.pessoa.criar(dadosDePessoa('Nome Antigo'));
    const alterada = await repositorios.pessoa.atualizar(nova.id, { nome_completo: 'Nome Novo', funcao: 'Advogada' });
    expect(alterada.versao_registro).toBe(2);
    const [evento] = await listarHistorico({ tabela: 'pessoa', registroId: nova.id });
    expect(evento).toMatchObject({
      acao: 'alterou',
      campos_alterados: ['nome_completo', 'funcao'],
      antes: { nome_completo: 'Nome Antigo', funcao: null },
      depois: { nome_completo: 'Nome Novo', funcao: 'Advogada' },
    });
  });

  it('alterar sem mudar nada não sobe a versão nem suja o histórico', async () => {
    const nova = await repositorios.pessoa.criar(dadosDePessoa('Sem Mudança'));
    const antes = (await listarHistorico()).length;
    const igual = await repositorios.pessoa.atualizar(nova.id, { nome_completo: 'Sem Mudança' });
    expect(igual.versao_registro).toBe(1);
    expect(await listarHistorico()).toHaveLength(antes);
  });

  it('arquivar esconde da lista sem apagar, e restaurar devolve (RT-03)', async () => {
    const nova = await repositorios.pessoa.criar(dadosDePessoa('Vai e Volta'));
    const arquivada = await repositorios.pessoa.arquivar(nova.id, 'Saiu da equipe');
    expect(arquivada.arquivado_por).toBe(ID_KIMBERLY);
    expect((await repositorios.pessoa.listar()).some((p) => p.id === nova.id)).toBe(false);
    expect((await repositorios.pessoa.listar({ incluirArquivados: true })).some((p) => p.id === nova.id)).toBe(true);
    expect(await repositorios.pessoa.obter(nova.id)).not.toBeNull();

    const [evento] = await listarHistorico({ registroId: nova.id });
    expect(evento).toMatchObject({ acao: 'arquivou', motivo: 'Saiu da equipe' });

    const restaurada = await repositorios.pessoa.restaurar(nova.id);
    expect(restaurada).toMatchObject({ arquivado_em: null, arquivado_por: null, versao_registro: 3 });
    expect((await repositorios.pessoa.listar()).some((p) => p.id === nova.id)).toBe(true);
  });

  it('filtra por igualdade de campos', async () => {
    const internas = await repositorios.pessoa.listar({ onde: { tipo: 'interna' } });
    expect(internas.map((p) => p.nome_completo)).toEqual(['Kimberly Grebe', 'Camila Lima', 'Bruna Alves']);
    expect(await repositorios.pessoa.listar({ onde: { tipo: 'interna', eh_socia: false } })).toHaveLength(1);
  });

  it('recusa dados inválidos sem gravar nada', async () => {
    const antes = await repositorios.pessoa.listar();
    await expect(repositorios.pessoa.criar(dadosDePessoa('   '))).rejects.toMatchObject({ tipo: 'validacao' });
    await expect(repositorios.pessoa.atualizar(ID_KIMBERLY, { email: 'isso não é e-mail' })).rejects.toBeInstanceOf(ErroDeDados);
    expect(await repositorios.pessoa.listar()).toEqual(antes);
  });

  it('avisa quando o registro não existe', async () => {
    await expect(repositorios.pessoa.atualizar('naoexiste', {})).rejects.toMatchObject({ tipo: 'nao_encontrado' });
    expect(await repositorios.pessoa.obter('naoexiste')).toBeNull();
  });

  describe('códigos legíveis (RT-01)', () => {
    const repositorio = () => criarRepositorioLocal({ tabela: 'atividade_teste', esquema: esquemaComCodigo, prefixoCodigo: 'ATV' });

    it('são sequenciais por prefixo e ano', async () => {
      const repo = repositorio();
      expect((await repo.criar({ titulo: 'Um' })).codigo).toBe('ATV-2026-0001');
      expect((await repo.criar({ titulo: 'Dois' })).codigo).toBe('ATV-2026-0002');
      vi.setSystemTime(new Date('2027-01-02T12:00:00.000Z'));
      expect((await repo.criar({ titulo: 'Ano novo' })).codigo).toBe('ATV-2027-0001');
    });

    it('nunca são reutilizados, mesmo arquivando', async () => {
      const repo = repositorio();
      const primeiro = await repo.criar({ titulo: 'Um' });
      await repo.arquivar(primeiro.id, 'teste');
      expect((await repo.criar({ titulo: 'Dois' })).codigo).toBe('ATV-2026-0002');
      expect(lerMeta().contadores).toEqual({ 'ATV-2026': 2 });
    });

    it('entram no histórico', async () => {
      const repo = repositorio();
      const criado = await repo.criar({ titulo: 'Um' });
      const [evento] = await listarHistorico({ registroId: criado.id });
      expect(evento?.registro_codigo).toBe('ATV-2026-0001');
    });
  });

  describe('falhas do armazenamento', () => {
    function driverQueEnche(): Driver & { encher: boolean } {
      const base = criarArmazenamentoEmMemoria();
      const falso = {
        encher: false,
        get length() {
          return base.length;
        },
        key: (i: number) => base.key(i),
        getItem: (chave: string) => base.getItem(chave),
        removeItem: (chave: string) => base.removeItem(chave),
        setItem(chave: string, valor: string) {
          // a tabela grava, mas o histórico não cabe: é o caso que exige desfazer
          if (falso.encher && chave.endsWith(':auditoria')) throw new DOMException('cheio', 'QuotaExceededError');
          base.setItem(chave, valor);
        },
      };
      return falso;
    }

    it('com o armazenamento cheio, registro e histórico ficam como estavam (AR-02)', async () => {
      const falso = driverQueEnche();
      usarDriverDeTeste(falso);
      esquecerMetaEmMemoria();
      const antes = await repositorios.pessoa.listar();
      const historicoAntes = await listarHistorico();

      falso.encher = true;
      await expect(repositorios.pessoa.criar(dadosDePessoa('Não Cabe'))).rejects.toMatchObject({ tipo: 'armazenamento' });

      expect(await repositorios.pessoa.listar()).toEqual(antes);
      expect(await listarHistorico()).toEqual(historicoAntes);
    });

    it('conteúdo danificado vira erro claro, sem apagar o que existe', async () => {
      const armazenamento = criarArmazenamentoEmMemoria();
      usarDriverDeTeste(armazenamento);
      esquecerMetaEmMemoria();
      await repositorios.pessoa.listar();
      armazenamento.setItem('numa-central:v1:pessoa', '{danificado');

      await expect(repositorios.pessoa.listar()).rejects.toMatchObject({ tipo: 'leitura' });
      expect(armazenamento.getItem('numa-central:v1:pessoa')).toBe('{danificado');
      expect(() => lerTabela<Pessoa>('pessoa')).toThrow(ErroDeDados);
    });
  });
});
