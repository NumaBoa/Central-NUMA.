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
