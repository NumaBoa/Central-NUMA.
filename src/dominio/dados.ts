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
import { TABELAS_F1_FORA_DA_CONTAGEM } from '@/dados/tabelas-f1';
import { TABELAS_M08_FORA_DA_CONTAGEM } from '@/dados/tabelas-m08';
import type { PessoaArea } from '@/dados/tipos/area';
import type { Entidade, EntidadeRepresentante } from '@/dados/tipos/contraparte';
import type { EventoAuditoria } from '@/dados/tipos/auditoria';
import type { BackupRegistro } from '@/dados/tipos/backup-registro';
import type { Controle } from '@/dados/tipos/controle';
import type { AnexoLink, ChecklistItem, Comentario, Vinculo } from '@/dados/tipos/apoio';
import type { Atividade, AtividadeParticipante } from '@/dados/tipos/atividade';
import type { EtiquetaVinculo } from '@/dados/tipos/etiqueta';
import type { ContaFinanceira } from '@/dados/tipos/financeiro';
import type { AtivoDigital } from '@/dados/tipos/ativo';
import type { Baixa, MovimentoSocietario, Titulo, TituloRateio } from '@/dados/tipos/titulo';
import type { ConferenciaSaldo, Transferencia } from '@/dados/tipos/transferencia';
import type { AssinaturaFerramenta, AssinaturaValorHistorico, Ferramenta, FerramentaContexto } from '@/dados/tipos/ferramenta';
import type { Notificacao } from '@/dados/tipos/notificacao';
import type { Pessoa } from '@/dados/tipos/pessoa';
import type { ModeloDaRecorrencia, Recorrencia } from '@/dados/tipos/recorrencia';
import { hojeISO } from '@/lib/datas';
import { gerarUuid } from '@/lib/ids';
import { sincronizarAlertasDeBackup } from './alertas';
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
const FORA_DA_CONTAGEM: readonly Tabela[] = ['conferencia_saldo', 'backup_registro', 'configuracao', 'pessoa_area', 'entidade_representante', 'etiqueta_vinculo', 'atividade_produto', 'atividade_participante', 'checklist_item', 'comentario', 'vinculo', 'anexo_link', 'notificacao', 'ferramenta_contexto', 'assinatura_ferramenta', 'assinatura_valor_historico', 'titulo_rateio', 'baixa', ...TABELAS_F1_FORA_DA_CONTAGEM, ...TABELAS_M08_FORA_DA_CONTAGEM];
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
  // RN-03.12: fazer a ação no módulo de origem conclui o alerta, já dentro da cópia.
  await sincronizarAlertasDeBackup();
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
  // As rotinas do dia voltam a olhar os dados novos na próxima abertura.
  gravarMeta({ versao_dados: VERSAO_DADOS, contadores: juntarContadores(lerMeta().contadores, arquivo.contadores), ultima_rotina_em: null });
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
  gravarMeta({ versao_dados: VERSAO_DADOS, contadores: {}, ultima_rotina_em: null });
}

/** Remove só o que tem `exemplo: true` (02 §0.3). O histórico continua. */
export async function limparExemplos(): Promise<number> {
  garantirCarga();
  const autor = idDaPessoaAtual();
  let removidos = 0;
  const idsRemovidos = new Set<string>();
  const novasLinhas = Object.fromEntries(
    TABELAS_DE_REGISTROS.map((tabela) => {
      const linhas = lerTabela<Controle>(tabela);
      const mantidas = linhas.filter((linha) => !linha.exemplo);
      // As ligações fazem parte do registro: contam como ele, na tela e nesta conta.
      if (TABELAS_DE_CADASTRO.includes(tabela)) removidos += linhas.length - mantidas.length;
      for (const linha of linhas) if (linha.exemplo) idsRemovidos.add(linha.id);
      return [tabela, mantidas];
    }),
  );
  if (!removidos) return 0;
  // Pessoa que saiu não continua nas áreas, mesmo que a ligação tenha sido feita por alguém de verdade.
  const pessoasQueFicam = new Set((novasLinhas.pessoa as Controle[]).map((pessoa) => pessoa.id));
  novasLinhas.pessoa_area = (novasLinhas.pessoa_area as PessoaArea[]).filter((ligacao) => pessoasQueFicam.has(ligacao.pessoa_id));
  novasLinhas.entidade_representante = (novasLinhas.entidade_representante as EntidadeRepresentante[]).filter((ligacao) => pessoasQueFicam.has(ligacao.pessoa_id));
  // Atividade de verdade continua: quem saiu deixa de participar, e o nome fica escrito onde ele servia de referência.
  const nomeDe = (id: string) => (lerTabela<Pessoa>('pessoa').find((pessoa) => pessoa.id === id)?.nome_completo ?? 'Pessoa removida');
  novasLinhas.atividade_participante = (novasLinhas.atividade_participante as AtividadeParticipante[]).filter((ligacao) => pessoasQueFicam.has(ligacao.pessoa_id));
  // Quem saiu respondia por alguma coisa de verdade: passa para uma pessoa que fica (RN-03.02).
  const substituta = autor && pessoasQueFicam.has(autor) ? autor : ([...pessoasQueFicam][0] ?? null);
  const quemResponde = (id: string) => (pessoasQueFicam.has(id) || !substituta ? id : substituta);
  novasLinhas.atividade = (novasLinhas.atividade as Atividade[]).map((atividade) => {
    const saiuAguardando = atividade.aguardando_de_pessoa_id && !pessoasQueFicam.has(atividade.aguardando_de_pessoa_id);
    const saiuSolicitante = atividade.solicitante_pessoa_id && !pessoasQueFicam.has(atividade.solicitante_pessoa_id);
    return {
      ...atividade,
      responsavel_id: quemResponde(atividade.responsavel_id),
      ...(saiuAguardando ? { aguardando_de_pessoa_id: null, aguardando_de_texto: nomeDe(atividade.aguardando_de_pessoa_id as string) } : {}),
      ...(saiuSolicitante ? { solicitante_pessoa_id: null, solicitante_texto: nomeDe(atividade.solicitante_pessoa_id as string) } : {}),
    };
  });
  novasLinhas.recorrencia = (novasLinhas.recorrencia as Recorrencia[]).map((rotina) => {
    const { modelo } = rotina;
    const saiuSolicitante = modelo.solicitante_pessoa_id && !pessoasQueFicam.has(modelo.solicitante_pessoa_id);
    const novoModelo: ModeloDaRecorrencia = {
      ...modelo,
      participantes: modelo.participantes.filter((id) => pessoasQueFicam.has(id)),
      vinculos: modelo.vinculos.filter((destino) => !idsRemovidos.has(destino.id)),
      ...(saiuSolicitante ? { solicitante_pessoa_id: null, solicitante_texto: nomeDe(modelo.solicitante_pessoa_id as string) } : {}),
    };
    return { ...rotina, responsavel_id: quemResponde(rotina.responsavel_id), modelo: novoModelo };
  });
  // O que era de um registro fictício sai com ele, mesmo que tenha sido feito por alguém de verdade.
  novasLinhas.checklist_item = (novasLinhas.checklist_item as ChecklistItem[]).filter((item) => !idsRemovidos.has(item.registro_id)).map((item) => (item.responsavel_id && !pessoasQueFicam.has(item.responsavel_id) ? { ...item, responsavel_id: null } : item));
  novasLinhas.comentario = (novasLinhas.comentario as Comentario[]).filter((comentario) => !idsRemovidos.has(comentario.registro_id));
  novasLinhas.anexo_link = (novasLinhas.anexo_link as AnexoLink[]).filter((anexo) => !idsRemovidos.has(anexo.registro_id));
  novasLinhas.vinculo = (novasLinhas.vinculo as Vinculo[]).filter((vinculo) => !idsRemovidos.has(vinculo.origem_id) && !idsRemovidos.has(vinculo.destino_id));
  // Conta de exemplo com movimento de verdade fica, e deixa de ser exemplo: baixa, transferência e aporte não existem sem a conta.
  const contasComBaixaReal = new Set<string | null>([
    ...(novasLinhas.baixa as Baixa[]).map((baixa) => baixa.conta_financeira_id),
    ...(novasLinhas.transferencia as Transferencia[]).flatMap((transferencia) => [transferencia.conta_origem_id, transferencia.conta_destino_id]),
    ...(novasLinhas.movimento_societario as MovimentoSocietario[]).map((movimento) => movimento.conta_financeira_id),
  ]);
  novasLinhas.conta_financeira = [...(novasLinhas.conta_financeira as ContaFinanceira[]), ...lerTabela<ContaFinanceira>('conta_financeira').filter((conta) => conta.exemplo && contasComBaixaReal.has(conta.id)).map((conta) => ({ ...conta, exemplo: false }))];
  // Ferramenta de verdade continua: o que era fictício sai dela (fornecedor, conta), e quem saiu passa a responsabilidade.
  const contrapartesDasFerramentas = new Set((novasLinhas.contraparte as Controle[]).map((contraparte) => contraparte.id));
  const contasQueFicam = new Set((novasLinhas.conta_financeira as Controle[]).map((conta) => conta.id));
  novasLinhas.conferencia_saldo = (novasLinhas.conferencia_saldo as ConferenciaSaldo[]).filter((conferencia) => contasQueFicam.has(conferencia.conta_id));
  novasLinhas.ferramenta = (novasLinhas.ferramenta as Ferramenta[]).map((ferramenta) => {
    const saiuTitular = ferramenta.titular_atual_pessoa_id && !pessoasQueFicam.has(ferramenta.titular_atual_pessoa_id);
    return {
      ...ferramenta,
      fornecedor_id: ferramenta.fornecedor_id && contrapartesDasFerramentas.has(ferramenta.fornecedor_id) ? ferramenta.fornecedor_id : null,
      responsavel_tecnico_id: quemResponde(ferramenta.responsavel_tecnico_id),
      responsavel_financeiro_id: ferramenta.responsavel_financeiro_id ? quemResponde(ferramenta.responsavel_financeiro_id) : null,
      ...(saiuTitular ? { titular_atual_tipo: 'terceiro' as const, titular_atual_pessoa_id: null, titular_atual_texto: nomeDe(ferramenta.titular_atual_pessoa_id as string) } : {}),
    };
  });
  novasLinhas.ferramenta_contexto = (novasLinhas.ferramenta_contexto as FerramentaContexto[]).filter((ligacao) => !idsRemovidos.has(ligacao.ferramenta_id));
  novasLinhas.assinatura_ferramenta = (novasLinhas.assinatura_ferramenta as AssinaturaFerramenta[]).filter((assinatura) => !idsRemovidos.has(assinatura.ferramenta_id)).map((assinatura) => (assinatura.conta_financeira_id && !contasQueFicam.has(assinatura.conta_financeira_id) ? { ...assinatura, conta_financeira_id: null } : assinatura));
  novasLinhas.assinatura_valor_historico = (novasLinhas.assinatura_valor_historico as AssinaturaValorHistorico[]).filter((valor) => !idsRemovidos.has(valor.assinatura_id));
  // Ativo de verdade continua: perde o que era fictício (ferramenta, assinatura), e quem saiu passa a responsabilidade.
  const ferramentasQueFicam = new Set((novasLinhas.ferramenta as Controle[]).map((ferramenta) => ferramenta.id));
  const assinaturasQueFicam = new Set((novasLinhas.assinatura_ferramenta as Controle[]).map((assinatura) => assinatura.id));
  novasLinhas.ativo_digital = (novasLinhas.ativo_digital as AtivoDigital[]).map((ativo) => {
    const saiuTitular = ativo.titular_atual_pessoa_id && !pessoasQueFicam.has(ativo.titular_atual_pessoa_id);
    return {
      ...ativo,
      ferramenta_id: ativo.ferramenta_id && ferramentasQueFicam.has(ativo.ferramenta_id) ? ativo.ferramenta_id : null,
      assinatura_id: ativo.assinatura_id && assinaturasQueFicam.has(ativo.assinatura_id) ? ativo.assinatura_id : null,
      responsavel_id: quemResponde(ativo.responsavel_id),
      ...(saiuTitular ? { titular_atual_tipo: 'terceiro' as const, titular_atual_pessoa_id: null, titular_atual_texto: nomeDe(ativo.titular_atual_pessoa_id as string) } : {}),
    };
  });
  // Lançamento de verdade continua: perde o que era fictício, e quem saiu passa a responsabilidade.
  novasLinhas.titulo = (novasLinhas.titulo as Titulo[]).map((titulo) => ({
    ...titulo,
    contraparte_id: titulo.contraparte_id && contrapartesDasFerramentas.has(titulo.contraparte_id) ? titulo.contraparte_id : null,
    ferramenta_id: titulo.ferramenta_id && ferramentasQueFicam.has(titulo.ferramenta_id) ? titulo.ferramenta_id : null,
    assinatura_id: titulo.assinatura_id && assinaturasQueFicam.has(titulo.assinatura_id) ? titulo.assinatura_id : null,
    responsavel_id: quemResponde(titulo.responsavel_id),
  }));
  novasLinhas.titulo_rateio = (novasLinhas.titulo_rateio as TituloRateio[]).filter((linha) => !idsRemovidos.has(linha.titulo_id));
  novasLinhas.baixa = (novasLinhas.baixa as Baixa[]).filter((baixa) => !idsRemovidos.has(baixa.titulo_id));
  // Notificação é de uma pessoa, sobre um registro: sai junto com qualquer um dos dois.
  novasLinhas.notificacao = (novasLinhas.notificacao as Notificacao[]).filter((notificacao) => pessoasQueFicam.has(notificacao.usuario_id) && !idsRemovidos.has(notificacao.registro_id ?? ''));
  // Etiqueta é de quem a usa: o registro fictício sai, e a etiqueta fica sem esse vínculo.
  novasLinhas.etiqueta_vinculo = (novasLinhas.etiqueta_vinculo as EtiquetaVinculo[]).filter((vinculo) => !idsRemovidos.has(vinculo.registro_id));
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
