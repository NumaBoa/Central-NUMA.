/**
 * Regras de T09.06 e T09.07 (11-M09): cláusulas e modelos, com versões fixas. Editar uma validada cria nova
 * versão; modelo e documento emitido seguem no que já tinham (RN-09.12, CA-09.05).
 */
import { z } from 'zod';
import { ErroDeRegra } from '@/dados/erros';
import type { Novo } from '@/dados/repositorio';
import { repositorios } from '@/dados/repositorios';
import { emTransacao } from '@/dados/transacao';
import { CATEGORIAS_CLAUSULA, FAMILIAS_CONTRATO, TIPOS_DOCUMENTO, type BlocoModelo, type Clausula, type ClausulaVersao, type ModeloDocumento, type ModeloVersao, type Validacao, type VariavelModelo } from '@/dados/tipos/legal';
import { gerarUuid } from '@/lib/ids';
import { analisarTexto, renderizarTexto, type DocumentoRenderizado } from './modelo-texto';
import { AVISO_CREDENCIAL, pareceCredencial } from './segredos';
import { DICIONARIO_VARIAVEIS, variavelConhecida } from './modelo-variaveis';

export const ROTULOS_CATEGORIA_CLAUSULA: Readonly<Record<Clausula['categoria'], string>> = { objeto: 'Objeto', escopo: 'Escopo e exclusões', preco_pagamento: 'Preço e pagamento', reajuste: 'Reajuste', multa_juros: 'Multa e juros', vigencia_renovacao: 'Vigência e renovação', rescisao: 'Rescisão', sla_suporte: 'SLA e suporte', propriedade_intelectual: 'Propriedade intelectual', confidencialidade: 'Confidencialidade', protecao_dados: 'Proteção de dados (LGPD)', limitacao_responsabilidade: 'Limitação de responsabilidade', repasse_comissao: 'Repasse/comissão (parceiros)', licenca_conteudo: 'Licença de conteúdo', foro: 'Foro e lei aplicável', disposicoes_gerais: 'Disposições gerais', outra: 'Outras' };
export const ROTULOS_TIPO_DOCUMENTO: Readonly<Record<ModeloDocumento['tipo_documento'], string>> = { contrato: 'Contrato', proposta: 'Proposta', aditivo: 'Aditivo', termo: 'Termo', memorando: 'Memorando', carta_reajuste: 'Carta de reajuste', notificacao: 'Notificação' };
export const ROTULOS_FAMILIA: Readonly<Record<NonNullable<ModeloDocumento['familia']>, string>> = { cliente_negociado: 'Cliente negociado', adesao_condicao_especial: 'Adesão com condição especial', parceiro: 'Parceiro do ecossistema', fornecedor: 'Fornecedor/terceiro', institucional: 'Institucional' };
export const ROTULOS_SITUACAO_VALIDAVEL = { rascunho: 'Rascunho', validada: 'Validada', obsoleta: 'Obsoleta' } as const;
export const ROTULOS_SITUACAO_MODELO = { rascunho: 'Rascunho', validada: 'Validado', obsoleta: 'Obsoleto' } as const;
export const ROTULOS_TIPO_BLOCO: Readonly<Record<BlocoModelo['tipo'], string>> = { clausula: 'Cláusula', texto: 'Texto', tabela_itens: 'Tabela de itens', condicional: 'Condicional', assinaturas: 'Assinaturas' };

// ---------- Cláusulas ----------

export const esquemaFormularioClausula = z.object({
  codigo: z.string().trim().toUpperCase().regex(/^CL-[A-Z0-9]+-\d{2,}$/, 'Use o formato CL-REAJ-01.'),
  titulo: z.string().trim().min(1, 'Informe o título.'),
  categoria: z.enum(CATEGORIAS_CLAUSULA, { error: 'Escolha a categoria.' }),
  alternativa_de_id: z.string(),
  quando_usar: z.string().trim(),
  texto: z.string().min(1, 'Escreva o texto da cláusula.'),
});
export type FormularioClausula = z.infer<typeof esquemaFormularioClausula>;

export type ClausulaComVersoes = Clausula & { versoes: ClausulaVersao[]; atual: ClausulaVersao | null; usadaEm: number };

const maisRecente = <T extends { numero: number }>(versoes: readonly T[]): T | null => [...versoes].sort((a, b) => b.numero - a.numero)[0] ?? null;

/** Cada modelo conta uma vez, em qualquer versão que ainda não esteja obsoleta (T09.06: "usada em"). */
function modelosQueUsam(clausulaVersaoIds: ReadonlySet<string>, versoes: readonly ModeloVersao[]): number {
  const percorre = (blocos: readonly BlocoModelo[]): boolean => blocos.some((bloco) => (bloco.clausula_versao_id && clausulaVersaoIds.has(bloco.clausula_versao_id)) || percorre(bloco.blocos));
  return new Set(versoes.filter((versao) => versao.situacao !== 'obsoleta' && percorre(versao.estrutura)).map((versao) => versao.modelo_id)).size;
}

export async function carregarClausulas(): Promise<ClausulaComVersoes[]> {
  const [clausulas, versoes, versoesModelo] = await Promise.all([repositorios.clausula.listar({ incluirArquivados: true }), repositorios.clausula_versao.listar(), repositorios.modelo_versao.listar()]);
  return clausulas
    .map((clausula) => {
      const proprias = versoes.filter((versao) => versao.clausula_id === clausula.id);
      return { ...clausula, versoes: [...proprias].sort((a, b) => b.numero - a.numero), atual: maisRecente(proprias), usadaEm: modelosQueUsam(new Set(proprias.map((versao) => versao.id)), versoesModelo) };
    })
    .sort((a, b) => a.codigo.localeCompare(b.codigo));
}

function conferirTexto(texto: string): void {
  const { erros } = analisarTexto(texto);
  if (erros.length) throw new ErroDeRegra(erros[0] as string);
}

export function avisosDoTexto(texto: string): string[] {
  return pareceCredencial(texto) ? [AVISO_CREDENCIAL] : [];
}

export async function criarClausula(formulario: FormularioClausula): Promise<Clausula> {
  conferirTexto(formulario.texto);
  const existentes = await repositorios.clausula.listar({ incluirArquivados: true });
  if (existentes.some((clausula) => clausula.codigo === formulario.codigo)) throw new ErroDeRegra(`Já existe a cláusula ${formulario.codigo}.`);
  return emTransacao(async () => {
    const clausula = await repositorios.clausula.criar({ codigo: formulario.codigo, titulo: formulario.titulo, categoria: formulario.categoria, alternativa_de_id: formulario.alternativa_de_id || null } as Novo<Clausula>);
    await repositorios.clausula_versao.criar({ clausula_id: clausula.id, numero: 1, texto: formulario.texto, quando_usar: formulario.quando_usar || null, variaveis: analisarTexto(formulario.texto).variaveis, situacao: 'rascunho', validacao_id: null });
    return clausula;
  });
}

/** Rascunho se edita; enquanto aguarda decisão, não. Validada nunca se edita: RN-09.12. */
export async function salvarRascunhoDaClausula(versaoId: string, dados: { titulo: string; categoria: Clausula['categoria']; quando_usar: string; texto: string; alternativa_de_id: string }): Promise<void> {
  conferirTexto(dados.texto);
  const versao = await repositorios.clausula_versao.obter(versaoId);
  if (!versao) throw new ErroDeRegra('Esta versão não existe mais.');
  if (versao.situacao !== 'rascunho') throw new ErroDeRegra('Só o rascunho pode ser editado. Crie uma nova versão.');
  if (await validacaoPendente(versao.validacao_id)) throw new ErroDeRegra('Esta versão está aguardando a validação. Decida antes de editar.');
  await emTransacao(async () => {
    await repositorios.clausula.atualizar(versao.clausula_id, { titulo: dados.titulo, categoria: dados.categoria, alternativa_de_id: dados.alternativa_de_id || null });
    await repositorios.clausula_versao.atualizar(versaoId, { texto: dados.texto, quando_usar: dados.quando_usar || null, variaveis: analisarTexto(dados.texto).variaveis });
  });
}

export async function novaVersaoDaClausula(clausulaId: string): Promise<ClausulaVersao> {
  const versoes = await repositorios.clausula_versao.listar({ onde: { clausula_id: clausulaId } });
  const atual = maisRecente(versoes);
  if (!atual) throw new ErroDeRegra('Esta cláusula não tem versão.');
  if (atual.situacao === 'rascunho') throw new ErroDeRegra('Já existe um rascunho desta cláusula.');
  return repositorios.clausula_versao.criar({ clausula_id: clausulaId, numero: atual.numero + 1, texto: atual.texto, quando_usar: atual.quando_usar, variaveis: atual.variaveis, situacao: 'rascunho', validacao_id: null });
}

async function validacaoPendente(id: string | null): Promise<boolean> {
  if (!id) return false;
  return (await repositorios.validacao.obter(id))?.situacao === 'pendente';
}

// ---------- Modelos ----------

export const esquemaFormularioModelo = z.object({
  nome: z.string().trim().min(1, 'Informe o nome do modelo.'),
  tipo_documento: z.enum(TIPOS_DOCUMENTO, { error: 'Escolha o tipo.' }),
  familia: z.union([z.literal(''), z.enum(FAMILIAS_CONTRATO)]),
});
export type FormularioModelo = z.infer<typeof esquemaFormularioModelo>;

export type ModeloComVersoes = ModeloDocumento & { versoes: ModeloVersao[]; atual: ModeloVersao | null; obrigatorias: number };

export async function carregarModelos(): Promise<ModeloComVersoes[]> {
  const [modelos, versoes] = await Promise.all([repositorios.modelo_documento.listar({ incluirArquivados: true }), repositorios.modelo_versao.listar()]);
  return modelos
    .map((modelo) => {
      const proprias = versoes.filter((versao) => versao.modelo_id === modelo.id).sort((a, b) => b.numero - a.numero);
      const atual = proprias[0] ?? null;
      return { ...modelo, versoes: proprias, atual, obrigatorias: atual ? variaveisDaEstrutura(atual.estrutura).length : 0 };
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export function novoBloco(tipo: BlocoModelo['tipo'], extra: Partial<BlocoModelo> = {}): BlocoModelo {
  return { id: gerarUuid(), tipo, titulo: null, clausula_versao_id: null, conteudo: null, condicao: null, blocos: [], ...extra };
}

export async function criarModelo(formulario: FormularioModelo): Promise<ModeloDocumento> {
  return emTransacao(async () => {
    const modelo = await repositorios.modelo_documento.criar({ nome: formulario.nome, tipo_documento: formulario.tipo_documento, familia: formulario.familia || null, marca_id: null });
    await repositorios.modelo_versao.criar({ modelo_id: modelo.id, numero: 1, rotulo_versao: '1', estrutura: [], variaveis: [], cabecalho: null, situacao: 'rascunho', validacao_id: null, aviso: null, observacoes: null });
    return modelo;
  });
}

export async function salvarEstruturaDoModelo(versaoId: string, dados: { estrutura: readonly BlocoModelo[]; cabecalho: string; observacoes: string; opcionais: readonly string[] }): Promise<void> {
  const versao = await repositorios.modelo_versao.obter(versaoId);
  if (!versao) throw new ErroDeRegra('Esta versão não existe mais.');
  if (versao.situacao !== 'rascunho') throw new ErroDeRegra('Só o rascunho pode ser editado. Crie uma nova versão.');
  if (await validacaoPendente(versao.validacao_id)) throw new ErroDeRegra('Esta versão está aguardando a validação. Decida antes de editar.');
  const clausulas = await repositorios.clausula_versao.listar();
  const erros = errosDaEstrutura(dados.estrutura, clausulas);
  if (erros.length) throw new ErroDeRegra(erros[0] as string);
  await repositorios.modelo_versao.atualizar(versaoId, {
    estrutura: [...dados.estrutura],
    cabecalho: dados.cabecalho || null,
    observacoes: dados.observacoes || null,
    variaveis: variaveisComOrigem(variaveisDaEstrutura(dados.estrutura, clausulas), dados.opcionais),
  });
}

export async function novaVersaoDoModelo(modeloId: string): Promise<ModeloVersao> {
  const versoes = await repositorios.modelo_versao.listar({ onde: { modelo_id: modeloId } });
  const atual = maisRecente(versoes);
  if (!atual) throw new ErroDeRegra('Este modelo não tem versão.');
  if (atual.situacao === 'rascunho') throw new ErroDeRegra('Já existe um rascunho deste modelo.');
  return repositorios.modelo_versao.criar({ modelo_id: modeloId, numero: atual.numero + 1, rotulo_versao: String(atual.numero + 1), estrutura: atual.estrutura, variaveis: atual.variaveis, cabecalho: atual.cabecalho, situacao: 'rascunho', validacao_id: null, aviso: null, observacoes: null });
}

/** Troca a cláusula do bloco por outra versão. É sempre explícito: novas versões não entram sozinhas (CA-09.05). */
export function atualizarClausulaNoBloco(estrutura: readonly BlocoModelo[], blocoId: string, clausulaVersaoId: string): BlocoModelo[] {
  return estrutura.map((bloco) => (bloco.id === blocoId ? { ...bloco, clausula_versao_id: clausulaVersaoId } : { ...bloco, blocos: atualizarClausulaNoBloco(bloco.blocos, blocoId, clausulaVersaoId) }));
}

export function moverBloco(estrutura: readonly BlocoModelo[], blocoId: string, passo: -1 | 1): BlocoModelo[] {
  const indice = estrutura.findIndex((bloco) => bloco.id === blocoId);
  if (indice < 0) return estrutura.map((bloco) => ({ ...bloco, blocos: moverBloco(bloco.blocos, blocoId, passo) }));
  const destino = indice + passo;
  if (destino < 0 || destino >= estrutura.length) return [...estrutura];
  const copia = [...estrutura];
  const [movido] = copia.splice(indice, 1);
  copia.splice(destino, 0, movido as BlocoModelo);
  return copia;
}

export function removerBloco(estrutura: readonly BlocoModelo[], blocoId: string): BlocoModelo[] {
  return estrutura.filter((bloco) => bloco.id !== blocoId).map((bloco) => ({ ...bloco, blocos: removerBloco(bloco.blocos, blocoId) }));
}

export function atualizarBloco(estrutura: readonly BlocoModelo[], blocoId: string, parcial: Partial<BlocoModelo>): BlocoModelo[] {
  return estrutura.map((bloco) => (bloco.id === blocoId ? { ...bloco, ...parcial } : { ...bloco, blocos: atualizarBloco(bloco.blocos, blocoId, parcial) }));
}

// ---------- Do modelo para o texto ----------

type VersaoDeClausula = Pick<ClausulaVersao, 'id' | 'texto' | 'situacao'>;

function textoDosBlocos(blocos: readonly BlocoModelo[], clausulas: readonly VersaoDeClausula[]): string {
  return blocos
    .map((bloco) => {
      if (bloco.tipo === 'texto') return bloco.conteudo ?? '';
      if (bloco.tipo === 'clausula') return clausulas.find((versao) => versao.id === bloco.clausula_versao_id)?.texto ?? '';
      if (bloco.tipo === 'condicional') return `[SE ${bloco.condicao ?? ''}]\n${textoDosBlocos(bloco.blocos, clausulas)}\n[FIM SE]`;
      if (bloco.tipo === 'tabela_itens') return '| Item | Quantidade | Valor | Periodicidade |\n|---|---|---|---|\n| [PARA CADA itens] {{item.descricao}} | {{item.quantidade}} | {{item.valor_formatado}} | {{item.periodicidade_texto}} [FIM PARA] |\n\n{{totais_texto}}';
      return '[PARA CADA assinaturas]\n______________________________\n{{item.nome}} · {{item.papel}}\n[FIM PARA]';
    })
    .join('\n\n');
}

export function textoDaEstrutura(estrutura: readonly BlocoModelo[], clausulas: readonly VersaoDeClausula[] = []): string {
  return textoDosBlocos(estrutura, clausulas);
}

export function variaveisDaEstrutura(estrutura: readonly BlocoModelo[], clausulas: readonly VersaoDeClausula[] = []): string[] {
  const { variaveis } = analisarTexto(textoDosBlocos(estrutura, clausulas));
  return variaveis.filter((nome) => !nome.startsWith('item.'));
}

function variaveisComOrigem(nomes: readonly string[], opcionais: readonly string[]): VariavelModelo[] {
  return nomes.map((nome) => {
    const conhecida = DICIONARIO_VARIAVEIS[nome];
    return { nome, origem: conhecida?.origem ?? 'Fora do dicionário', formato: conhecida?.formato ?? 'texto', obrigatoria: !opcionais.includes(nome) };
  });
}

export function errosDaEstrutura(estrutura: readonly BlocoModelo[], clausulas: readonly VersaoDeClausula[]): string[] {
  const erros = [...analisarTexto(textoDosBlocos(estrutura, clausulas)).erros];
  const percorrer = (blocos: readonly BlocoModelo[]) => {
    for (const bloco of blocos) {
      if (bloco.tipo === 'clausula' && !clausulas.some((versao) => versao.id === bloco.clausula_versao_id)) erros.push('Escolha a cláusula de cada bloco de cláusula.');
      if (bloco.tipo === 'condicional' && !bloco.condicao?.trim()) erros.push('Diga a condição de cada bloco condicional.');
      percorrer(bloco.blocos);
    }
  };
  percorrer(estrutura);
  return [...new Set(erros)];
}

/** RN-09.12: modelo Validado só com cláusulas Validadas. Texto e variáveis precisam estar em ordem. */
export function pendenciasParaValidarModelo(versao: Pick<ModeloVersao, 'estrutura'>, clausulas: readonly VersaoDeClausula[]): string[] {
  const pendencias = errosDaEstrutura(versao.estrutura, clausulas);
  if (!versao.estrutura.length) pendencias.push('O modelo está vazio: acrescente pelo menos um bloco.');
  const percorrer = (blocos: readonly BlocoModelo[]) => {
    for (const bloco of blocos) {
      if (bloco.tipo === 'clausula') {
        const clausula = clausulas.find((item) => item.id === bloco.clausula_versao_id);
        if (clausula && clausula.situacao === 'rascunho') pendencias.push('Há cláusula em rascunho: só cláusulas validadas entram em modelos validados.');
      }
      percorrer(bloco.blocos);
    }
  };
  percorrer(versao.estrutura);
  const desconhecidas = variaveisDaEstrutura(versao.estrutura, clausulas).filter((nome) => !variavelConhecida(nome));
  if (desconhecidas.length) pendencias.push(`Variáveis fora do dicionário: ${desconhecidas.join(', ')}.`);
  return [...new Set(pendencias)];
}

export type DocumentoDoModelo = DocumentoRenderizado & { faltando: string[] };

/** A montagem da prévia e da emissão: as vazias marcadas como opcionais no modelo não bloqueiam. */
export function renderizarVersao(versao: Pick<ModeloVersao, 'estrutura' | 'variaveis'>, clausulas: readonly VersaoDeClausula[], dados: unknown): DocumentoDoModelo {
  const documento = renderizarTexto(textoDosBlocos(versao.estrutura, clausulas), dados);
  const opcionais = new Set(versao.variaveis.filter((variavel) => !variavel.obrigatoria).map((variavel) => variavel.nome));
  return { ...documento, faltando: documento.vazias.filter((nome) => !opcionais.has(nome)) };
}

export type DadosDoEditorDeModelo = { modelo: ModeloComVersoes; clausulas: ClausulaComVersoes[]; versoesDeClausula: ClausulaVersao[]; validacoes: Validacao[] };

export async function carregarEditorDeModelo(id: string): Promise<DadosDoEditorDeModelo | null> {
  const [modelos, clausulas, versoesDeClausula, validacoes] = await Promise.all([carregarModelos(), carregarClausulas(), repositorios.clausula_versao.listar(), repositorios.validacao.listar({ onde: { registro_tipo: 'modelo_versao' } })]);
  const modelo = modelos.find((item) => item.id === id);
  return modelo ? { modelo, clausulas, versoesDeClausula, validacoes } : null;
}

export function ultimaValidacao(validacoes: readonly Validacao[], registroId: string): Validacao | null {
  return validacoes.filter((validacao) => validacao.registro_id === registroId).sort((a, b) => b.solicitado_em.localeCompare(a.solicitado_em))[0] ?? null;
}
