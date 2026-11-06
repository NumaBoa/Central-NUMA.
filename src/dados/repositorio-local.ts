import type { z } from 'zod';
import { hojeISO } from '@/lib/datas';
import { gerarUuid, montarCodigo } from '@/lib/ids';
import { gravarTabelas, lerTabela } from './armazenamento';
import { garantirCarga } from './carga';
import { ErroDeDados } from './erros';
import { novoEvento } from './evento';
import { gravarMeta, lerMeta } from './meta';
import type { Alteracao, FiltrosListagem, Novo, Repositorio } from './repositorio';
import { idDaPessoaAtual } from './sessao';
import type { EventoAuditoria } from './tipos/auditoria';
import type { Controle } from './tipos/controle';

type OpcoesRepositorio<T extends Controle> = {
  tabela: string;
  esquema: z.ZodType<T>;
  /** Tabelas acionáveis têm código legível: `ATV-2026-0001` (RT-01). */
  prefixoCodigo?: string;
};

/** Códigos nunca são reutilizados (RT-01): o contador só anda para a frente. */
function proximoCodigo(prefixo: string): string {
  const ano = hojeISO().slice(0, 4);
  const chave = `${prefixo}-${ano}`;
  const numero = (lerMeta().contadores[chave] ?? 0) + 1;
  gravarMeta({ contadores: { ...lerMeta().contadores, [chave]: numero } });
  return montarCodigo(prefixo, ano, numero);
}

function validar<T>(esquema: z.ZodType<T>, dados: unknown): T {
  const resultado = esquema.safeParse(dados);
  if (resultado.success) return resultado.data;
  throw new ErroDeDados('validacao', { detalhes: resultado.error.issues.map((falha) => `${falha.path.join('.')}: ${falha.message}`), cause: resultado.error });
}

/** Só o que mudou, para o histórico mostrar "de → para" (RT-04). */
function diferencas(antes: Record<string, unknown>, depois: Record<string, unknown>) {
  const campos = Object.keys(depois).filter((campo) => JSON.stringify(antes[campo]) !== JSON.stringify(depois[campo]));
  return {
    campos,
    antes: Object.fromEntries(campos.map((campo) => [campo, antes[campo]])),
    depois: Object.fromEntries(campos.map((campo) => [campo, depois[campo]])),
  };
}

const CAMPOS_DE_CONTROLE = new Set(['atualizado_em', 'atualizado_por', 'versao_registro', 'arquivado_em', 'arquivado_por']);

/** Implementação sobre o localStorage (02 §0.3): preenche controles e grava o histórico. */
export function criarRepositorioLocal<T extends Controle>({ tabela, esquema, prefixoCodigo }: OpcoesRepositorio<T>): Repositorio<T> {
  function linhas(): T[] {
    garantirCarga();
    return lerTabela<T>(tabela);
  }

  function exigir(lista: readonly T[], id: string): T {
    const registro = lista.find((linha) => linha.id === id);
    if (!registro) throw new ErroDeDados('nao_encontrado');
    return registro;
  }

  /** O registro e o evento são gravados juntos: ou os dois, ou nenhum. */
  function gravar(novasLinhas: readonly T[], evento: EventoAuditoria) {
    gravarTabelas({ [tabela]: novasLinhas, auditoria: [...lerTabela<EventoAuditoria>('auditoria'), evento] });
  }

  function codigoDe(registro: T): string | null {
    const { codigo } = registro as T & { codigo?: string };
    return codigo ?? null;
  }

  return {
    async listar({ onde, incluirArquivados = false }: FiltrosListagem<T> = {}) {
      const filtros = Object.entries(onde ?? {});
      return linhas().filter((linha) => (incluirArquivados || !linha.arquivado_em) && filtros.every(([campo, valor]) => linha[campo as keyof T] === valor));
    },

    async obter(id) {
      return linhas().find((linha) => linha.id === id) ?? null;
    },

    async criar(dados: Novo<T>) {
      const lista = linhas();
      const agora = new Date().toISOString();
      const autor = idDaPessoaAtual();
      const registro = validar(esquema, {
        ...dados,
        id: dados.id ?? gerarUuid(),
        exemplo: dados.exemplo ?? false,
        ...(prefixoCodigo ? { codigo: proximoCodigo(prefixoCodigo) } : {}),
        criado_em: agora,
        criado_por: autor,
        atualizado_em: agora,
        atualizado_por: autor,
        arquivado_em: null,
        arquivado_por: null,
        versao_registro: 1,
      });
      gravar([...lista, registro], novoEvento({ usuarioId: autor, acao: 'inseriu', tabela, registroId: registro.id, registroCodigo: codigoDe(registro), depois: registro as Record<string, unknown> }));
      return registro;
    },

    async atualizar(id, dados: Alteracao<T>) {
      const lista = linhas();
      const atual = exigir(lista, id);
      const combinado = { ...atual, ...dados };
      const mudancas = diferencas(atual as Record<string, unknown>, combinado as Record<string, unknown>);
      if (!mudancas.campos.length) return atual;

      const autor = idDaPessoaAtual();
      const registro = validar(esquema, {
        ...combinado,
        atualizado_em: new Date().toISOString(),
        atualizado_por: autor,
        versao_registro: atual.versao_registro + 1,
      });
      gravar(
        lista.map((linha) => (linha.id === id ? registro : linha)),
        novoEvento({ usuarioId: autor, acao: 'alterou', tabela, registroId: id, registroCodigo: codigoDe(registro), antes: mudancas.antes, depois: mudancas.depois, camposAlterados: mudancas.campos.filter((campo) => !CAMPOS_DE_CONTROLE.has(campo)) }),
      );
      return registro;
    },

    async arquivar(id, motivo) {
      const lista = linhas();
      const atual = exigir(lista, id);
      const autor = idDaPessoaAtual();
      const agora = new Date().toISOString();
      const registro = { ...atual, arquivado_em: agora, arquivado_por: autor, atualizado_em: agora, atualizado_por: autor, versao_registro: atual.versao_registro + 1 };
      gravar(
        lista.map((linha) => (linha.id === id ? registro : linha)),
        novoEvento({ usuarioId: autor, acao: 'arquivou', tabela, registroId: id, registroCodigo: codigoDe(atual), antes: atual as Record<string, unknown>, motivo: motivo ?? null }),
      );
      return registro;
    },

    async restaurar(id) {
      const lista = linhas();
      const atual = exigir(lista, id);
      const autor = idDaPessoaAtual();
      const registro = { ...atual, arquivado_em: null, arquivado_por: null, atualizado_em: new Date().toISOString(), atualizado_por: autor, versao_registro: atual.versao_registro + 1 };
      gravar(
        lista.map((linha) => (linha.id === id ? registro : linha)),
        novoEvento({ usuarioId: autor, acao: 'restaurou', tabela, registroId: id, registroCodigo: codigoDe(atual) }),
      );
      return registro;
    },
  };
}
