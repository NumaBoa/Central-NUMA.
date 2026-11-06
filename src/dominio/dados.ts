/**
 * Operações de Configurações › Dados (02 §0.3): exportar, importar, restaurar e limpar exemplos.
 * Nesta etapa, o JSON substitui o ZIP/CSV de T02.11.
 */
import { z } from 'zod';
import { gravarTabelas, lerTabela, usoDoArmazenamento } from '@/dados/armazenamento';
import { garantirCarga, tabelasIniciais, TABELAS_COM_VALORES_INICIAIS, valoresIniciais } from '@/dados/carga';
import { novoEvento } from '@/dados/historico';
import { gravarMeta, lerMeta } from '@/dados/meta';
import { idDaPessoaAtual, pessoaAtual } from '@/dados/sessao';
import { NOMES_TABELAS, TABELAS, VERSAO_DADOS, type Tabela } from '@/dados/tabelas';
import type { PessoaArea } from '@/dados/tipos/area';
import type { Entidade, EntidadeRepresentante } from '@/dados/tipos/contraparte';
import type { EventoAuditoria } from '@/dados/tipos/auditoria';
import type { BackupRegistro } from '@/dados/tipos/backup-registro';
import type { Controle } from '@/dados/tipos/controle';
import type { Pessoa } from '@/dados/tipos/pessoa';
import { hojeISO } from '@/lib/datas';
import { gerarUuid } from '@/lib/ids';
import { nomeDaCopiaAntesDeImportar, nomeDoArquivoDeBackup } from './backup';

export const FORMATO_ARQUIVO = 'central-numa';
const LIMITE_ERROS_LISTADOS = 8;
const LIMITE_CAMPOS_NA_MENSAGEM = 4;

/** Importar e restaurar são a saída quando os dados estão danificados: o autor não pode impedir. */
function autorMesmoComDadosDanificados(): string | null {
  try {
    return idDaPessoaAtual();
  } catch {
    return null;
  }
}

/** Tabelas com registros de domínio; o histórico (`auditoria`) é só de inserção. */
const TABELAS_DE_REGISTROS = NOMES_TABELAS.filter((tabela) => tabela !== 'auditoria');

/**
 * O que conta como cadastro para quem usa: exportar não pode aumentar o número de registros, as
 * configurações são sempre as mesmas chaves, e as ligações entre pessoa e área fazem parte da pessoa.
 */
const FORA_DA_CONTAGEM: readonly Tabela[] = ['backup_registro', 'configuracao', 'pessoa_area', 'entidade_representante'];
const TABELAS_DE_CADASTRO = TABELAS_DE_REGISTROS.filter((tabela) => !FORA_DA_CONTAGEM.includes(tabela));

const esquemaArquivo = z.object({
  formato: z.literal(FORMATO_ARQUIVO),
  versao_dados: z.number().int().positive(),
  exportado_em: z.iso.datetime(),
  exportado_por: z.object({ id: z.uuid(), nome: z.string() }).nullable(),
  contadores: z.record(z.string(), z.number().int().nonnegative()),
  tabelas: z.record(z.string(), z.array(z.unknown())),
});

export type ArquivoDeDados = z.infer<typeof esquemaArquivo>;

// ---------- Resumo ----------

export type ResumoDosDados = {
  /** Cadastros ativos, sem contar o histórico nem os registros de backup: o que se vê nas telas. */
  registros: number;
  exemplos: number;
  usoEmCaracteres: number;
  ultimoBackup: { em: string; por: string | null } | null;
};

export async function resumoDosDados(): Promise<ResumoDosDados> {
  garantirCarga();
  const linhas = TABELAS_DE_CADASTRO.flatMap((tabela) => lerTabela<Controle>(tabela)).filter((linha) => !linha.arquivado_em);
  const pessoas = lerTabela<Pessoa>('pessoa');
  const backups = lerTabela<BackupRegistro>('backup_registro');
  const ultimo = backups.reduce<BackupRegistro | null>((maior, atual) => (!maior || atual.gerado_em > maior.gerado_em ? atual : maior), null);
  return {
    registros: linhas.length,
    exemplos: linhas.filter((linha) => linha.exemplo).length,
    usoEmCaracteres: usoDoArmazenamento(),
    ultimoBackup: ultimo && { em: ultimo.gerado_em, por: pessoas.find((pessoa) => pessoa.id === ultimo.gerado_por)?.nome_completo ?? null },
  };
}

export async function existemDadosDeExemplo(): Promise<boolean> {
  garantirCarga();
  return TABELAS_DE_REGISTROS.some((tabela) => lerTabela<Controle>(tabela).some((linha) => linha.exemplo));
}

// ---------- Exportar ----------

function montarArquivo(agora: string): ArquivoDeDados {
  const autor = pessoaAtual();
  return {
    formato: FORMATO_ARQUIVO,
    versao_dados: VERSAO_DADOS,
    exportado_em: agora,
    exportado_por: autor && { id: autor.id, nome: autor.nome_completo },
    contadores: { ...lerMeta().contadores },
    tabelas: Object.fromEntries(NOMES_TABELAS.map((tabela) => [tabela, lerTabela(tabela)])),
  };
}

/** Registra o backup antes de montar o arquivo, para a própria cópia já levar esse registro. */
export async function exportarTudo(): Promise<{ nome: string; conteudo: string }> {
  garantirCarga();
  const agora = new Date().toISOString();
  const autor = idDaPessoaAtual();
  const registro: BackupRegistro = {
    id: gerarUuid(),
    criado_em: agora,
    criado_por: autor,
    atualizado_em: agora,
    atualizado_por: autor,
    arquivado_em: null,
    arquivado_por: null,
    versao_registro: 1,
    exemplo: false,
    gerado_em: agora,
    gerado_por: autor,
    tabelas: NOMES_TABELAS.length,
    observacao: null,
  };
  gravarTabelas({
    backup_registro: [...lerTabela<BackupRegistro>('backup_registro'), registro],
    auditoria: [...lerTabela<EventoAuditoria>('auditoria'), novoEvento({ usuarioId: autor, acao: 'exportou', depois: { tabelas: NOMES_TABELAS.length } })],
  });
  return { nome: nomeDoArquivoDeBackup(hojeISO()), conteudo: JSON.stringify(montarArquivo(agora), null, 2) };
}

// ---------- Importar ----------

export type LinhaDaPrevia = { tabela: Tabela; rotulo: string; neste: number | null; noArquivo: number };

export type AnaliseDoArquivo =
  | { ok: false; erros: string[] }
  | { ok: true; arquivo: ArquivoDeDados; previa: LinhaDaPrevia[]; avisos: string[]; copiaPossivel: boolean };

/** Quantos registros há hoje em cada tabela; `null` quando a tabela está danificada. */
export function contagensAtuais(): Record<Tabela, number | null> {
  garantirCarga();
  return Object.fromEntries(
    NOMES_TABELAS.map((tabela) => {
      try {
        return [tabela, lerTabela(tabela).length];
      } catch {
        return [tabela, null];
      }
    }),
  ) as Record<Tabela, number | null>;
}

function descreverCampos(campos: readonly string[]): string {
  if (campos.length === 1) return `o campo ${campos[0]} está inválido`;
  if (campos.length > LIMITE_CAMPOS_NA_MENSAGEM) return `${campos.length} campos estão inválidos`;
  return `os campos ${campos.join(', ')} estão inválidos`;
}

function errosDasLinhas(tabela: Tabela, linhas: readonly unknown[]): string[] {
  const { rotulo, esquema } = TABELAS[tabela];
  const erros: string[] = [];
  const ids = new Set<string>();
  linhas.forEach((linha, indice) => {
    const resultado = esquema.safeParse(linha);
    if (!resultado.success) {
      const campos = [...new Set(resultado.error.issues.map((falha) => falha.path.join('.') || 'registro'))];
      erros.push(`${rotulo}, linha ${indice + 1}: ${descreverCampos(campos)}.`);
      return;
    }
    if (ids.has(resultado.data.id)) erros.push(`${rotulo}, linha ${indice + 1}: registro repetido.`);
    ids.add(resultado.data.id);
  });
  return erros;
}

/** Confere o arquivo inteiro, sem gravar nada. Com qualquer erro, o arquivo não é aceito (P6). */
export function analisarArquivo(texto: string, atuais: Readonly<Record<Tabela, number | null>>): AnaliseDoArquivo {
  let bruto: unknown;
  try {
    bruto = JSON.parse(texto);
  } catch {
    return { ok: false, erros: ['Este arquivo não é um JSON válido.'] };
  }

  const leitura = esquemaArquivo.safeParse(bruto);
  if (!leitura.success) return { ok: false, erros: ['Este arquivo não é uma exportação da Central Numa.'] };
  const arquivo = leitura.data;

  if (arquivo.versao_dados > VERSAO_DADOS) {
    return { ok: false, erros: ['Este arquivo veio de uma versão mais nova da Central. Atualize o sistema antes de importar.'] };
  }

  const erros = NOMES_TABELAS.flatMap((tabela) => errosDasLinhas(tabela, arquivo.tabelas[tabela] ?? []));
  if (erros.length) {
    const excedente = erros.length - LIMITE_ERROS_LISTADOS;
    return { ok: false, erros: excedente > 0 ? [...erros.slice(0, LIMITE_ERROS_LISTADOS), `E mais ${excedente}.`] : erros };
  }

  const avisos: string[] = [];
  const faltando = NOMES_TABELAS.filter((tabela) => !arquivo.tabelas[tabela]);
  const voltamAoInicio = (tabela: Tabela) => (TABELAS_COM_VALORES_INICIAIS as readonly Tabela[]).includes(tabela);
  const ficamVazias = faltando.filter((tabela) => !voltamAoInicio(tabela)).map((tabela) => TABELAS[tabela].rotulo);
  if (ficamVazias.length) avisos.push(`O arquivo não traz: ${ficamVazias.join(', ')}. Essas partes ficarão vazias.`);
  const comValorInicial = faltando.filter(voltamAoInicio).map((tabela) => TABELAS[tabela].rotulo);
  if (comValorInicial.length) avisos.push(`O arquivo não traz: ${comValorInicial.join(', ')}. Essas partes voltam aos valores iniciais.`);
  const desconhecidas = Object.keys(arquivo.tabelas).filter((tabela) => !NOMES_TABELAS.includes(tabela as Tabela));
  if (desconhecidas.length) avisos.push(`Partes do arquivo que esta versão não conhece serão ignoradas: ${desconhecidas.join(', ')}.`);

  const copiaPossivel = NOMES_TABELAS.every((tabela) => atuais[tabela] !== null);
  if (!copiaPossivel) avisos.push('Os dados de hoje estão danificados, então não dá para baixar uma cópia deles antes de substituir.');

  return {
    ok: true,
    arquivo,
    avisos,
    copiaPossivel,
    previa: NOMES_TABELAS.map((tabela) => ({ tabela, rotulo: TABELAS[tabela].rotulo, neste: atuais[tabela], noArquivo: arquivo.tabelas[tabela]?.length ?? 0 })),
  };
}

/** Os contadores só andam para a frente: nenhum código volta a ser usado (RT-01). */
function juntarContadores(a: Readonly<Record<string, number>>, b: Readonly<Record<string, number>>): Record<string, number> {
  const juntos: Record<string, number> = { ...a };
  for (const [chave, valor] of Object.entries(b)) juntos[chave] = Math.max(juntos[chave] ?? 0, valor);
  return juntos;
}

export type ArquivoParaBaixar = { nome: string; conteudo: string };

/** O estado atual, sem gravar nada: dá para importar de volta. `null` se os dados estiverem danificados. */
export function copiaDoEstadoAtual(): ArquivoParaBaixar | null {
  try {
    garantirCarga();
    return { nome: nomeDaCopiaAntesDeImportar(hojeISO()), conteudo: JSON.stringify(montarArquivo(new Date().toISOString()), null, 2) };
  } catch {
    return null;
  }
}

/** Baixa a cópia antes de mexer em qualquer coisa: se a importação falhar, nada se perdeu. */
export async function importarComCopia(arquivo: ArquivoDeDados, baixar: (copia: ArquivoParaBaixar) => void): Promise<{ registros: number; comCopia: boolean }> {
  const copia = copiaDoEstadoAtual();
  if (copia) baixar(copia);
  const registros = await aplicarImportacao(arquivo, Boolean(copia));
  return { registros, comCopia: Boolean(copia) };
}

/** Substitui tudo o que há neste navegador pelo conteúdo do arquivo já conferido. */
export async function aplicarImportacao(arquivo: ArquivoDeDados, comCopia = false): Promise<number> {
  const registros = TABELAS_DE_CADASTRO.flatMap((tabela) => (arquivo.tabelas[tabela] ?? []) as Controle[]).filter((linha) => !linha.arquivado_em).length;
  const evento = novoEvento({ usuarioId: autorMesmoComDadosDanificados(), acao: 'executou_acao', depois: { funcao: 'importar_dados', registros, copia_antes: comCopia } });
  const historicoDoArquivo = (arquivo.tabelas.auditoria ?? []) as EventoAuditoria[];
  gravarTabelas({
    ...Object.fromEntries(TABELAS_DE_REGISTROS.map((tabela) => [tabela, arquivo.tabelas[tabela] ?? []])),
    // Um backup antigo não pode deixar as telas sem os valores da especificação.
    ...Object.fromEntries(TABELAS_COM_VALORES_INICIAIS.filter((tabela) => !arquivo.tabelas[tabela]).map((tabela) => [tabela, valoresIniciais(tabela, new Date().toISOString())])),
    auditoria: [...historicoDoArquivo, evento],
  });
  gravarMeta({ versao_dados: VERSAO_DADOS, contadores: juntarContadores(lerMeta().contadores, arquivo.contadores) });
  return registros;
}

// ---------- Exemplos ----------

/**
 * "Isso apaga tudo o que foi cadastrado neste navegador" (02 §0.3), inclusive o histórico, e a
 * restauração fica como primeiro item. Vale só nesta etapa local: com servidor, vale a RT-04.
 */
export async function restaurarExemplos(): Promise<void> {
  const autor = autorMesmoComDadosDanificados();
  gravarTabelas({
    ...tabelasIniciais(new Date().toISOString()),
    auditoria: [novoEvento({ usuarioId: autor, acao: 'executou_acao', depois: { funcao: 'restaurar_exemplos' } })],
  });
  gravarMeta({ versao_dados: VERSAO_DADOS, contadores: {} });
}

/** Remove só o que tem `exemplo: true` (02 §0.3). O histórico continua. */
export async function limparExemplos(): Promise<number> {
  garantirCarga();
  const autor = idDaPessoaAtual();
  let removidos = 0;
  const novasLinhas = Object.fromEntries(
    TABELAS_DE_REGISTROS.map((tabela) => {
      const linhas = lerTabela<Controle>(tabela);
      const mantidas = linhas.filter((linha) => !linha.exemplo);
      removidos += linhas.length - mantidas.length;
      return [tabela, mantidas];
    }),
  );
  if (!removidos) return 0;
  // Pessoa que saiu não continua nas áreas, mesmo que a ligação tenha sido feita por alguém de verdade.
  const pessoasQueFicam = new Set((novasLinhas.pessoa as Controle[]).map((pessoa) => pessoa.id));
  novasLinhas.pessoa_area = (novasLinhas.pessoa_area as PessoaArea[]).filter((ligacao) => pessoasQueFicam.has(ligacao.pessoa_id));
  novasLinhas.entidade_representante = (novasLinhas.entidade_representante as EntidadeRepresentante[]).filter((ligacao) => pessoasQueFicam.has(ligacao.pessoa_id));
  // Contraparte fictícia que saiu não fica pendurada em registro de verdade.
  const contrapartesQueFicam = new Set((novasLinhas.contraparte as Controle[]).map((contraparte) => contraparte.id));
  novasLinhas.pessoa = (novasLinhas.pessoa as Pessoa[]).map((pessoa) => (pessoa.contraparte_id && !contrapartesQueFicam.has(pessoa.contraparte_id) ? { ...pessoa, contraparte_id: null } : pessoa));
  novasLinhas.entidade = (novasLinhas.entidade as Entidade[]).map((entidade) => (entidade.contador_id && !contrapartesQueFicam.has(entidade.contador_id) ? { ...entidade, contador_id: null } : entidade));
  gravarTabelas({
    ...novasLinhas,
    auditoria: [...lerTabela<EventoAuditoria>('auditoria'), novoEvento({ usuarioId: autor, acao: 'executou_acao', depois: { funcao: 'limpar_exemplos', registros: removidos } })],
  });
  return removidos;
}
