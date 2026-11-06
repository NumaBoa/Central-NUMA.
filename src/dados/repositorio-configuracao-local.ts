import { gerarUuid } from '@/lib/ids';
import { gravarTabelas, lerTabela } from './armazenamento';
import { garantirCarga } from './carga';
import { ErroDeDados } from './erros';
import { novoEvento } from './evento';
import type { RepositorioConfiguracao } from './repositorio';
import { idDaPessoaAtual } from './sessao';
import type { EventoAuditoria } from './tipos/auditoria';
import {
  CATALOGO_CONFIGURACAO,
  chaveConhecida,
  ESQUEMAS_DAS_CHAVES,
  esquemaValoresConfiguracao,
  VALORES_PADRAO,
  type ChaveConfiguracao,
  type Configuracao,
  type ValoresConfiguracao,
} from './tipos/configuracao';

/** O que faltar ou estiver inválido fica com o padrão: a tela sempre tem o que mostrar. */
function valoresDasLinhas(linhas: readonly Configuracao[]): ValoresConfiguracao {
  const valores: Record<string, unknown> = { ...VALORES_PADRAO };
  for (const linha of linhas) {
    if (linha.arquivado_em || !chaveConhecida(linha.chave)) continue;
    const lido = ESQUEMAS_DAS_CHAVES[linha.chave].safeParse(linha.valor);
    if (lido.success) valores[linha.chave] = lido.data;
  }
  return valores as ValoresConfiguracao;
}

/** Implementação sobre o localStorage. Na etapa com servidor, vira uma transação no banco. */
export function criarRepositorioConfiguracaoLocal(): RepositorioConfiguracao {
  function linhas(): Configuracao[] {
    garantirCarga();
    return lerTabela<Configuracao>('configuracao');
  }

  return {
    async ler() {
      return valoresDasLinhas(linhas());
    },

    async salvar(alteracoes, { motivo } = {}) {
      const existentes = linhas();
      const atuais = valoresDasLinhas(existentes);
      const conferido = esquemaValoresConfiguracao.safeParse({ ...atuais, ...alteracoes });
      if (!conferido.success) {
        throw new ErroDeDados('validacao', { detalhes: conferido.error.issues.map((falha) => `${falha.path.join('.')}: ${falha.message}`), cause: conferido.error });
      }
      const proximos = conferido.data;
      const chaves = (Object.keys(alteracoes) as ChaveConfiguracao[]).filter((chave) => JSON.stringify(atuais[chave]) !== JSON.stringify(proximos[chave]));
      if (!chaves.length) return [];

      const agora = new Date().toISOString();
      const autor = idDaPessoaAtual();
      const novasLinhas = [...existentes];
      const eventos: EventoAuditoria[] = chaves.map((chave) => {
        const valor = proximos[chave];
        const indice = novasLinhas.findIndex((linha) => linha.chave === chave);
        const existente = indice === -1 ? undefined : novasLinhas[indice];
        const registro: Configuracao = existente
          ? { ...existente, valor, atualizado_em: agora, atualizado_por: autor, versao_registro: existente.versao_registro + 1 }
          : {
              id: gerarUuid(),
              criado_em: agora,
              criado_por: autor,
              atualizado_em: agora,
              atualizado_por: autor,
              arquivado_em: null,
              arquivado_por: null,
              versao_registro: 1,
              exemplo: false,
              chave,
              valor,
              descricao: CATALOGO_CONFIGURACAO[chave].descricao,
            };
        if (indice === -1) novasLinhas.push(registro);
        else novasLinhas[indice] = registro;
        return novoEvento({
          usuarioId: autor,
          acao: 'alterou',
          tabela: 'configuracao',
          registroId: registro.id,
          antes: { chave, valor: atuais[chave] },
          depois: { chave, valor },
          camposAlterados: ['valor'],
          motivo: motivo ?? null,
        });
      });

      // Tudo de uma vez: ou todas as chaves e os eventos, ou nada (AR-02).
      gravarTabelas({ configuracao: novasLinhas, auditoria: [...lerTabela<EventoAuditoria>('auditoria'), ...eventos] });
      return chaves;
    },
  };
}
