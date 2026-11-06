import { listarHistorico } from '@/dados/historico';
import { repositorios } from '@/dados/repositorios';
import { TABELAS, type Tabela } from '@/dados/tabelas';
import type { EventoAuditoria } from '@/dados/tipos/auditoria';

function plural(quantidade: number, singular: string, varios: string): string {
  return `${quantidade} ${quantidade === 1 ? singular : varios}`;
}

function fraseDaAcaoExecutada(depois: EventoAuditoria['depois']): string {
  const registros = Number(depois?.registros ?? 0);
  switch (depois?.funcao) {
    case 'carga_inicial':
      return 'carregou os dados de exemplo';
    case 'importar_dados':
      return `importou ${plural(registros, 'registro', 'registros')} de um arquivo${depois?.copia_antes ? ', com cópia do que havia antes' : ''}`;
    case 'restaurar_exemplos':
      return 'restaurou os dados de exemplo';
    case 'limpar_exemplos':
      return `limpou ${plural(registros, 'registro', 'registros')} de exemplo`;
    case 'rodar_rotinas':
      return 'rodou as rotinas do dia';
    default:
      return 'executou uma ação';
  }
}

function nomeDaTabela(tabela: string | null): string {
  return (tabela && TABELAS[tabela as Tabela]?.rotulo) || tabela || 'registros';
}

/** Histórico legível (02 §6): quem fez o quê. */
export function descreverEvento(evento: EventoAuditoria, nomes: ReadonlyMap<string, string>): string {
  const quem = evento.usuario_id === null ? 'Sistema' : (nomes.get(evento.usuario_id) ?? 'Pessoa removida');
  const onde = nomeDaTabela(evento.tabela);
  const registro = evento.registro_codigo ? ` ${evento.registro_codigo}` : '';
  switch (evento.acao) {
    case 'exportou':
      return `${quem} exportou todos os dados`;
    case 'executou_acao':
      return `${quem} ${fraseDaAcaoExecutada(evento.depois)}`;
    case 'inseriu':
      return `${quem} criou um registro em ${onde}${registro}`;
    case 'alterou':
      return `${quem} alterou um registro em ${onde}${registro}`;
    case 'arquivou':
      return `${quem} arquivou um registro em ${onde}${registro}${evento.motivo ? `. Motivo: ${evento.motivo}` : ''}`;
    case 'restaurou':
      return `${quem} restaurou um registro em ${onde}${registro}`;
    default:
      return `${quem} fez uma alteração`;
  }
}

export type LinhaHistorico = { id: string; texto: string; em: string };

export async function historicoRecente(limite: number): Promise<LinhaHistorico[]> {
  const [eventos, pessoas] = await Promise.all([listarHistorico({ limite }), repositorios.pessoa.listar({ incluirArquivados: true })]);
  const nomes = new Map(pessoas.map((pessoa) => [pessoa.id, pessoa.nome_completo]));
  return eventos.map((evento) => ({ id: evento.id, texto: descreverEvento(evento, nomes), em: evento.ocorrido_em }));
}
