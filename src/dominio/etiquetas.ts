/** Regras de T02.10 (04-M02): etiquetas livres, para filtros e buscas. */
import { z } from 'zod';
import { ErroDeRegra } from '@/dados/erros';
import { repositorios } from '@/dados/repositorios';
import { emTransacao } from '@/dados/transacao';
import type { Etiqueta, EtiquetaVinculo } from '@/dados/tipos/etiqueta';
import { corVisivel } from './cores';
import { normalizarTexto } from './duplicidade';

/** Só os módulos da fase ativa (RT-23). Os das outras fases entram junto com as telas deles. */
export const ROTULOS_MODULO_ETIQUETA = { atividades: 'Atividades', ferramentas: 'Ferramentas e ativos', financeiro: 'Financeiro', contrapartes: 'Contrapartes' } as const;

export type ModuloEtiqueta = keyof typeof ROTULOS_MODULO_ETIQUETA;

export const esquemaFormularioEtiqueta = z
  .object({
    nome: z.string().trim().min(1, 'Informe o nome.'),
    cor: z.string().trim(),
    escopo: z.enum(['todos', 'alguns']),
    modulos: z.array(z.string()),
  })
  .superRefine((dados, contexto) => {
    if (dados.cor && !/^#[0-9A-Fa-f]{6}$/.test(dados.cor)) contexto.addIssue({ code: 'custom', path: ['cor'], message: 'Use o formato #RRGGBB.' });
    else if (dados.cor && !corVisivel(dados.cor)) contexto.addIssue({ code: 'custom', path: ['cor'], message: 'Esta cor é clara demais para aparecer nas etiquetas. Escolha uma mais forte.' });
    if (dados.escopo === 'alguns' && !dados.modulos.length) contexto.addIssue({ code: 'custom', path: ['modulos'], message: 'Escolha pelo menos um módulo.' });
  });

export type FormularioEtiqueta = z.infer<typeof esquemaFormularioEtiqueta>;

export const FORMULARIO_ETIQUETA_VAZIO: FormularioEtiqueta = { nome: '', cor: '', escopo: 'todos', modulos: [] };

export function formularioDaEtiqueta(etiqueta: Etiqueta): FormularioEtiqueta {
  return { nome: etiqueta.nome, cor: etiqueta.cor ?? '', escopo: etiqueta.modulos.length ? 'alguns' : 'todos', modulos: etiqueta.modulos };
}

export function dadosDaEtiqueta(formulario: FormularioEtiqueta) {
  return { nome: formulario.nome, cor: formulario.cor ? formulario.cor.toUpperCase() : null, modulos: formulario.escopo === 'alguns' ? formulario.modulos : [] };
}

export function rotuloDosModulos(modulos: readonly string[]): string {
  if (!modulos.length) return 'Todos os módulos';
  return modulos.map((modulo) => ROTULOS_MODULO_ETIQUETA[modulo as ModuloEtiqueta] ?? modulo).join(', ');
}

// ---------- Nome único ----------

export function erroDeNomeDaEtiqueta(nome: string, etiquetas: readonly Etiqueta[], idAtual?: string): string | null {
  const repetida = etiquetas.find((etiqueta) => etiqueta.id !== idAtual && normalizarTexto(etiqueta.nome) === normalizarTexto(nome));
  if (!repetida) return null;
  return repetida.arquivado_em ? `Já existe “${repetida.nome}” em Arquivados: restaure em vez de criar outra.` : `Já existe “${repetida.nome}”.`;
}

export async function conferirNomeDaEtiqueta(nome: string, idAtual?: string): Promise<string | null> {
  return erroDeNomeDaEtiqueta(nome, await repositorios.etiqueta.listar({ incluirArquivados: true }), idAtual);
}

export async function salvarEtiqueta(formulario: FormularioEtiqueta, id?: string): Promise<Etiqueta> {
  const erro = await conferirNomeDaEtiqueta(formulario.nome, id);
  if (erro) throw new ErroDeRegra(erro);
  const dados = dadosDaEtiqueta(formulario);
  return id ? repositorios.etiqueta.atualizar(id, dados) : repositorios.etiqueta.criar(dados);
}

// ---------- Usos, arquivo e mescla ----------

export function usosDaEtiqueta(id: string, vinculos: readonly EtiquetaVinculo[]): number {
  return vinculos.filter((vinculo) => vinculo.etiqueta_id === id).length;
}

/** Etiqueta em uso não é arquivada: mesclar leva os vínculos para outra. */
export async function arquivarEtiqueta(id: string): Promise<void> {
  const usos = usosDaEtiqueta(id, await repositorios.etiqueta_vinculo.listar({ onde: { etiqueta_id: id } }));
  if (usos) throw new ErroDeRegra(`Esta etiqueta está em ${usos === 1 ? '1 registro' : `${usos} registros`}. Mescle com outra para não perder os vínculos.`);
  await repositorios.etiqueta.arquivar(id);
}

export async function restaurarEtiqueta(id: string): Promise<void> {
  await repositorios.etiqueta.restaurar(id);
}

/**
 * T02.10: mesclar duas etiquetas move os vínculos, sem repetir um registro que já tinha as duas. A
 * etiqueta de origem vai para Arquivados. Grava tudo de uma vez, ou nada. Devolve quantos vínculos ela tinha.
 */
export async function mesclarEtiquetas(origemId: string, destinoId: string): Promise<number> {
  if (origemId === destinoId) throw new ErroDeRegra('Escolha outra etiqueta para mesclar.');
  const destino = await repositorios.etiqueta.obter(destinoId);
  if (!destino || destino.arquivado_em) throw new ErroDeRegra('Esta etiqueta não está mais na lista. Escolha outra.');
  return emTransacao(async () => {
    const [daOrigem, doDestino] = await Promise.all([repositorios.etiqueta_vinculo.listar({ onde: { etiqueta_id: origemId } }), repositorios.etiqueta_vinculo.listar({ onde: { etiqueta_id: destinoId } })]);
    for (const vinculo of daOrigem) {
      const jaTem = doDestino.some((outro) => outro.registro_tipo === vinculo.registro_tipo && outro.registro_id === vinculo.registro_id);
      if (jaTem) await repositorios.etiqueta_vinculo.arquivar(vinculo.id);
      else await repositorios.etiqueta_vinculo.atualizar(vinculo.id, { etiqueta_id: destinoId });
    }
    await repositorios.etiqueta.arquivar(origemId, `Mesclada em ${destino.nome}`);
    return daOrigem.length;
  });
}

/**
 * Decisão de Kimberly em 06/11/2026: as etiquetas entram nas atividades e nas ferramentas, como campo e filtro.
 * O tipo do registro e o módulo de onde vêm as etiquetas que ele aceita.
 */
export const MODULO_DO_REGISTRO = { atividade: 'atividades', ferramenta: 'ferramentas' } as const satisfies Record<string, ModuloEtiqueta>;

export type RegistroComEtiqueta = keyof typeof MODULO_DO_REGISTRO;

/** Os ids das etiquetas de cada registro, para as listas e os filtros. */
export function etiquetasPorRegistro(vinculos: readonly Pick<EtiquetaVinculo, 'registro_tipo' | 'registro_id' | 'etiqueta_id' | 'arquivado_em'>[], tipo: RegistroComEtiqueta): Map<string, string[]> {
  const mapa = new Map<string, string[]>();
  for (const vinculo of vinculos) {
    if (vinculo.registro_tipo !== tipo || vinculo.arquivado_em) continue;
    mapa.set(vinculo.registro_id, [...(mapa.get(vinculo.registro_id) ?? []), vinculo.etiqueta_id]);
  }
  return mapa;
}

/** Deixa o registro com estas etiquetas: tira as que saíram e põe as novas. Só as do módulo, ativas. */
export async function definirEtiquetasDoRegistro(tipo: RegistroComEtiqueta, id: string, ids: readonly string[]): Promise<void> {
  const desejadas = [...new Set(ids)];
  const [etiquetas, atuais] = await Promise.all([repositorios.etiqueta.listar(), repositorios.etiqueta_vinculo.listar({ onde: { registro_tipo: tipo, registro_id: id } })]);
  const disponiveis = new Set(etiquetasDoModulo(etiquetas, MODULO_DO_REGISTRO[tipo]).map((etiqueta) => etiqueta.id));
  if (desejadas.some((etiquetaId) => !disponiveis.has(etiquetaId) && !atuais.some((vinculo) => vinculo.etiqueta_id === etiquetaId))) throw new ErroDeRegra('Esta etiqueta não está disponível aqui. Escolha outra.');
  await emTransacao(async () => {
    for (const vinculo of atuais) if (!desejadas.includes(vinculo.etiqueta_id)) await repositorios.etiqueta_vinculo.arquivar(vinculo.id);
    for (const etiquetaId of desejadas) if (!atuais.some((vinculo) => vinculo.etiqueta_id === etiquetaId)) await repositorios.etiqueta_vinculo.criar({ etiqueta_id: etiquetaId, registro_tipo: tipo, registro_id: id });
  });
}

/** Para os seletores dos módulos: vazio vale para todos. */
export function etiquetasDoModulo(etiquetas: readonly Etiqueta[], modulo: ModuloEtiqueta): Etiqueta[] {
  return etiquetas.filter((etiqueta) => !etiqueta.arquivado_em && (!etiqueta.modulos.length || etiqueta.modulos.includes(modulo)));
}

// ---------- Lista ----------

export type DadosEtiquetas = {
  etiquetas: Etiqueta[];
  vinculos: EtiquetaVinculo[];
};

export function filtrarEtiquetas(etiquetas: readonly Etiqueta[], busca: string, arquivadas: boolean): Etiqueta[] {
  const texto = normalizarTexto(busca);
  return etiquetas
    .filter((etiqueta) => Boolean(etiqueta.arquivado_em) === arquivadas)
    .filter((etiqueta) => !texto || normalizarTexto(etiqueta.nome).includes(texto))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export async function carregarEtiquetas(): Promise<DadosEtiquetas> {
  const [etiquetas, vinculos] = await Promise.all([repositorios.etiqueta.listar({ incluirArquivados: true }), repositorios.etiqueta_vinculo.listar()]);
  return { etiquetas, vinculos };
}
