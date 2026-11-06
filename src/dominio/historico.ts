import { ROTULOS_FUSO } from '@/dados/fuso';
import { listarHistorico } from '@/dados/historico';
import { repositorios } from '@/dados/repositorios';
import { TABELAS, type Tabela } from '@/dados/tabelas';
import type { EventoAuditoria } from '@/dados/tipos/auditoria';
import { CATALOGO_CONFIGURACAO, chaveConhecida } from '@/dados/tipos/configuracao';
import { formatarDiaISO } from '@/lib/formatacao';
import { avancouDeFase, rotuloDaFase } from './fases';
import { FASES, type Fase } from './navegacao';
import { formatarTelefone, ROTULOS_PAPEL, ROTULOS_SITUACAO, ROTULOS_TIPO, type PapelContato } from './pessoas';

type Nomes = ReadonlyMap<string, string>;

function plural(quantidade: number, singular: string, varios: string): string {
  return `${quantidade} ${quantidade === 1 ? singular : varios}`;
}

function fraseDaAcaoExecutada(depois: EventoAuditoria['depois']): string {
  const registros = Number(depois?.registros ?? 0);
  switch (depois?.funcao) {
    case 'carga_inicial':
      return 'carregou os dados de exemplo';
    case 'migrar_dados':
      return 'atualizou os dados para a nova versão da Central';
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

function ehFase(valor: unknown): valor is Fase {
  return FASES.includes(valor as Fase);
}

const NAO_INFORMADO = 'não informado';

function vazio(valor: unknown): boolean {
  return valor === null || valor === undefined || valor === '' || (Array.isArray(valor) && valor.length === 0);
}

function valorLegivel(chave: string, valor: unknown, nomes: Nomes): string {
  if (vazio(valor)) return NAO_INFORMADO;
  if (chave === 'fuso') return ROTULOS_FUSO[valor as keyof typeof ROTULOS_FUSO] ?? String(valor);
  if (chave === 'responsavel_backup_id') return nomes.get(String(valor)) ?? 'pessoa removida';
  if (chave.endsWith('_dias')) return plural(Number(valor), 'dia', 'dias');
  return String(valor);
}

/** "alterou Moeda padrão: de BRL para USD"; a fase tem verbo próprio e, ao voltar, o motivo. */
function fraseDaConfiguracao(evento: EventoAuditoria, nomes: Nomes): string {
  const chave = String(evento.depois?.chave ?? '');
  const antes = evento.antes?.valor;
  const depois = evento.depois?.valor;
  if (chave === 'fase_ativa' && ehFase(antes) && ehFase(depois)) {
    const verbo = avancouDeFase(antes, depois) ? 'avançou' : 'voltou';
    return `${verbo} para a ${rotuloDaFase(depois)}${evento.motivo ? `. Motivo: ${evento.motivo}` : ''}`;
  }
  const rotulo = chaveConhecida(chave) ? CATALOGO_CONFIGURACAO[chave].rotulo : 'uma configuração';
  return `alterou ${rotulo}: de ${valorLegivel(chave, antes, nomes)} para ${valorLegivel(chave, depois, nomes)}`;
}

function oCambio(dados: EventoAuditoria['depois']): string {
  const moeda = dados?.moeda;
  const data = dados?.data_referencia;
  return typeof moeda === 'string' && typeof data === 'string' ? `o câmbio de ${moeda} de ${formatarDiaISO(data)}` : 'um câmbio';
}

// ---------- Campos de cada tabela, por extenso ----------

type CampoLegivel = {
  rotulo: string;
  valor?: (valor: unknown, nomes: Nomes) => string;
  /** O histórico diz que mudou, sem mostrar o conteúdo: dado sensível ou texto longo. */
  semValores?: boolean;
};

const simNao = (valor: unknown) => (valor ? 'sim' : 'não');

const CAMPOS_LEGIVEIS: Readonly<Record<string, Readonly<Record<string, CampoLegivel>>>> = {
  pessoa: {
    nome_completo: { rotulo: 'Nome completo' },
    nome_exibicao: { rotulo: 'Nome de exibição' },
    tipo: { rotulo: 'Tipo', valor: (valor) => ROTULOS_TIPO[valor as keyof typeof ROTULOS_TIPO] },
    eh_socia: { rotulo: 'É sócia', valor: simNao },
    papeis_contato: { rotulo: 'Papel do contato', valor: (valor) => (valor as PapelContato[]).map((papel) => ROTULOS_PAPEL[papel]).join(', ') },
    funcao: { rotulo: 'Função' },
    email: { rotulo: 'E-mail' },
    telefone: { rotulo: 'Telefone', valor: (valor) => formatarTelefone(String(valor)) },
    cpf: { rotulo: 'CPF', semValores: true },
    observacoes: { rotulo: 'Observações', semValores: true },
    situacao: { rotulo: 'Situação', valor: (valor) => ROTULOS_SITUACAO[valor as keyof typeof ROTULOS_SITUACAO] },
  },
  area: {
    nome: { rotulo: 'Nome' },
    responsavel_padrao_id: { rotulo: 'Responsável padrão', valor: (valor, nomes) => nomes.get(String(valor)) ?? 'pessoa removida' },
    compartilhada: { rotulo: 'Compartilhada', valor: simNao },
  },
};

/** "Função: de Sócia para Diretora; CPF" (P2: o histórico diz o que mudou, de quanto para quanto). */
function mudancasLegiveis(evento: EventoAuditoria, nomes: Nomes): string {
  const campos = CAMPOS_LEGIVEIS[evento.tabela ?? ''] ?? {};
  return evento.campos_alterados
    .flatMap((nome) => {
      const campo = campos[nome];
      if (!campo) return [];
      if (campo.semValores) return [campo.rotulo];
      const legivel = (valor: unknown) => (vazio(valor) ? NAO_INFORMADO : campo.valor ? campo.valor(valor, nomes) : String(valor));
      return [`${campo.rotulo}: de ${legivel(evento.antes?.[nome])} para ${legivel(evento.depois?.[nome])}`];
    })
    .join('; ');
}

function textoDe(valor: unknown): string | undefined {
  return typeof valor === 'string' && valor ? valor : undefined;
}

/** Como chamar o registro na frase. `undefined` quando o evento não diz: fica a frase genérica. */
function registroPorExtenso(evento: EventoAuditoria, nomes: Nomes): string | undefined {
  const id = evento.registro_id ?? '';
  if (evento.tabela === 'pessoa') return textoDe(evento.depois?.nome_completo) ?? textoDe(evento.antes?.nome_completo) ?? nomes.get(id);
  if (evento.tabela === 'area') {
    const nome = textoDe(evento.depois?.nome) ?? textoDe(evento.antes?.nome) ?? nomes.get(id);
    return nome && `a área ${nome}`;
  }
  return undefined;
}

function pessoaEArea(dados: EventoAuditoria['depois'], nomes: Nomes): { pessoa: string; area: string } {
  return { pessoa: nomes.get(String(dados?.pessoa_id)) ?? 'Pessoa removida', area: nomes.get(String(dados?.area_id)) ?? 'área removida' };
}

/** Histórico legível (02 §6): quem fez o quê. */
export function descreverEvento(evento: EventoAuditoria, nomes: Nomes): string {
  const quem = evento.usuario_id === null ? 'Sistema' : (nomes.get(evento.usuario_id) ?? 'Pessoa removida');
  const onde = nomeDaTabela(evento.tabela);
  const registro = evento.registro_codigo ? ` ${evento.registro_codigo}` : '';
  const ehCambio = evento.tabela === 'cambio_referencia';
  const ehLigacao = evento.tabela === 'pessoa_area';
  const porExtenso = registroPorExtenso(evento, nomes);
  const motivo = evento.motivo ? `. Motivo: ${evento.motivo}` : '';
  switch (evento.acao) {
    case 'exportou':
      return `${quem} exportou todos os dados`;
    case 'executou_acao':
      return `${quem} ${fraseDaAcaoExecutada(evento.depois)}`;
    case 'inseriu':
      if (ehCambio) return `${quem} adicionou ${oCambio(evento.depois)}`;
      if (ehLigacao) {
        const { pessoa, area } = pessoaEArea(evento.depois, nomes);
        return `${quem} colocou ${pessoa} na área ${area}`;
      }
      if (evento.tabela === 'pessoa' && porExtenso) return `${quem} cadastrou ${porExtenso}`;
      if (evento.tabela === 'area' && porExtenso) return `${quem} criou ${porExtenso}`;
      return `${quem} criou um registro em ${onde}${registro}`;
    case 'alterou': {
      if (evento.tabela === 'configuracao') return `${quem} ${fraseDaConfiguracao(evento, nomes)}`;
      if (evento.tabela === 'pessoa' && evento.campos_alterados.length === 1 && evento.campos_alterados[0] === 'situacao' && porExtenso) {
        return `${quem} ${evento.depois?.situacao === 'inativa' ? 'inativou' : 'reativou'} ${porExtenso}`;
      }
      const mudancas = mudancasLegiveis(evento, nomes);
      if (porExtenso && mudancas) return `${quem} alterou ${porExtenso}: ${mudancas}`;
      return `${quem} alterou um registro em ${onde}${registro}`;
    }
    case 'arquivou':
      if (ehCambio) return `${quem} removeu ${oCambio(evento.antes)}`;
      if (ehLigacao) {
        const { pessoa, area } = pessoaEArea(evento.antes, nomes);
        return `${quem} tirou ${pessoa} da área ${area}`;
      }
      if (porExtenso) return `${quem} arquivou ${porExtenso}${motivo}`;
      return `${quem} arquivou um registro em ${onde}${registro}${motivo}`;
    case 'restaurou':
      if (porExtenso) return `${quem} restaurou ${porExtenso}`;
      return `${quem} restaurou um registro em ${onde}${registro}`;
    default:
      return `${quem} fez uma alteração`;
  }
}

export type LinhaHistorico = { id: string; texto: string; em: string };

/** Os nomes usados nas frases, inclusive de quem já foi arquivado. */
async function nomesDosRegistros(): Promise<Map<string, string>> {
  const [pessoas, areas] = await Promise.all([repositorios.pessoa.listar({ incluirArquivados: true }), repositorios.area.listar({ incluirArquivados: true })]);
  return new Map([...pessoas.map((pessoa): [string, string] => [pessoa.id, pessoa.nome_completo]), ...areas.map((area): [string, string] => [area.id, area.nome])]);
}

function paraLinha(evento: EventoAuditoria, nomes: Nomes): LinhaHistorico {
  return { id: evento.id, texto: descreverEvento(evento, nomes), em: evento.ocorrido_em };
}

export async function historicoRecente(limite: number): Promise<LinhaHistorico[]> {
  const [eventos, nomes] = await Promise.all([listarHistorico({ limite }), nomesDosRegistros()]);
  return eventos.map((evento) => paraLinha(evento, nomes));
}

/** A última mudança de fase, mostrada na própria seção; `null` se a fase nunca mudou. */
export async function ultimaMudancaDeFase(): Promise<LinhaHistorico | null> {
  const [eventos, nomes] = await Promise.all([listarHistorico({ tabela: 'configuracao' }), nomesDosRegistros()]);
  const evento = eventos.find((item) => item.depois?.chave === 'fase_ativa');
  return evento ? paraLinha(evento, nomes) : null;
}

/** Aba Histórico da ficha da pessoa (P2): o cadastro dela e as áreas em que entrou ou de que saiu. */
export async function historicoDaPessoa(id: string): Promise<LinhaHistorico[]> {
  const [eventos, nomes] = await Promise.all([listarHistorico(), nomesDosRegistros()]);
  const dela = eventos.filter((evento) => (evento.tabela === 'pessoa' && evento.registro_id === id) || (evento.tabela === 'pessoa_area' && (evento.depois?.pessoa_id === id || evento.antes?.pessoa_id === id)));
  return dela.map((evento) => paraLinha(evento, nomes));
}
