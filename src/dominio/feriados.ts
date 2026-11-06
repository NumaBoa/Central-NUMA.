/** Regras de T02.09 (04-M02): calendário e feriados, base dos dias úteis. */
import { z } from 'zod';
import { ErroDeRegra } from '@/dados/erros';
import { carregarMunicipios } from '@/dados/referencia/municipios';
import { feriadosDoAno, type FeriadoDeReferencia } from '@/dados/referencia/feriados';
import { repositorios } from '@/dados/repositorios';
import { emTransacao } from '@/dados/transacao';
import type { Feriado } from '@/dados/tipos/calendario';
import { hojeISO } from '@/lib/datas';
import { normalizarTexto } from './duplicidade';

export const ROTULOS_ABRANGENCIA = { nacional: 'Nacional', estadual: 'Estadual', municipal: 'Municipal' } as const;

export type LocalPadrao = { uf: string | null; municipio: string | null };

export const esquemaFormularioFeriado = z
  .object({
    data: z.iso.date('Informe a data.'),
    nome: z.string().trim().min(1, 'Informe o nome.'),
    abrangencia: z.enum(['nacional', 'estadual', 'municipal']),
    uf: z.string(),
    municipio: z.string(),
  })
  .superRefine((dados, contexto) => {
    if (dados.abrangencia !== 'nacional' && !dados.uf) contexto.addIssue({ code: 'custom', path: ['uf'], message: 'Escolha o estado.' });
    if (dados.abrangencia === 'municipal' && !dados.municipio) contexto.addIssue({ code: 'custom', path: ['municipio'], message: 'Escolha o município.' });
  });

export type FormularioFeriado = z.infer<typeof esquemaFormularioFeriado>;

/** Começa no estado e no município padrão de T02.01 (D16). */
export function formularioFeriadoVazio({ uf, municipio }: LocalPadrao): FormularioFeriado {
  return { data: '', nome: '', abrangencia: 'nacional', uf: uf ?? '', municipio: municipio ?? '' };
}

export function formularioDoFeriado(feriado: Feriado, { uf, municipio }: LocalPadrao): FormularioFeriado {
  return { data: feriado.data, nome: feriado.nome, abrangencia: feriado.abrangencia, uf: feriado.uf ?? uf ?? '', municipio: feriado.municipio ?? municipio ?? '' };
}

export function dadosDoFeriado(formulario: FormularioFeriado) {
  return {
    data: formulario.data,
    nome: formulario.nome,
    abrangencia: formulario.abrangencia,
    uf: formulario.abrangencia === 'nacional' ? null : formulario.uf,
    municipio: formulario.abrangencia === 'municipal' ? formulario.municipio : null,
  };
}

// ---------- Gravação ----------

const mesmoFeriado = (a: Pick<Feriado, 'data' | 'nome'>, b: Pick<Feriado, 'data' | 'nome'>) => a.data === b.data && normalizarTexto(a.nome) === normalizarTexto(b.nome);

export const MENSAGEM_FERIADO_REPETIDO = 'Já existe esse feriado nessa data.';

export async function feriadoRepetido(formulario: FormularioFeriado, idAtual?: string): Promise<boolean> {
  const feriados = await repositorios.feriado.listar();
  return feriados.some((feriado) => feriado.id !== idAtual && mesmoFeriado(feriado, formulario));
}

export async function salvarFeriado(formulario: FormularioFeriado, id?: string): Promise<Feriado> {
  if (await feriadoRepetido(formulario, id)) throw new ErroDeRegra(MENSAGEM_FERIADO_REPETIDO);
  const dados = dadosDoFeriado(formulario);
  return id ? repositorios.feriado.atualizar(id, dados) : repositorios.feriado.criar(dados);
}

/** "Remover" na tela é arquivar (RT-03): sai do calendário, e o mesmo feriado pode ser lançado de novo. */
export async function removerFeriado(id: string): Promise<void> {
  await repositorios.feriado.arquivar(id);
}

// ---------- Carregar o ano ----------

export type LinhaDaPrevia = FeriadoDeReferencia & { jaCadastrado: boolean };

/** T02.09: confere antes de confirmar. O que já existe fica como está. */
export function previaDoAno(ano: number, feriados: readonly Feriado[], local: LocalPadrao): LinhaDaPrevia[] {
  return feriadosDoAno(ano, local).map((feriado) => ({ ...feriado, jaCadastrado: feriados.some((existente) => !existente.arquivado_em && mesmoFeriado(existente, feriado)) }));
}

/** Grava de uma vez, ou nada. Devolve quantos entraram. */
export async function carregarFeriadosDoAno(ano: number, local: LocalPadrao): Promise<number> {
  return emTransacao(async () => {
    const novos = previaDoAno(ano, await repositorios.feriado.listar(), local).filter((linha) => !linha.jaCadastrado);
    for (const { jaCadastrado: _jaCadastrado, ...feriado } of novos) await repositorios.feriado.criar(feriado);
    return novos.length;
  });
}

// ---------- Lista ----------

export type FiltrosFeriados = {
  ano: number;
  abrangencia: 'todas' | Feriado['abrangencia'];
};

export function anoAtual(): number {
  return Number(hojeISO().slice(0, 4));
}

/** Os anos que já têm feriados, mais o atual e o próximo. */
export function anosDoCalendario(feriados: readonly Feriado[], atual: number): number[] {
  return [...new Set([...feriados.map((feriado) => Number(feriado.data.slice(0, 4))), atual, atual + 1])].sort((a, b) => a - b);
}

export function filtrarFeriados(feriados: readonly Feriado[], { ano, abrangencia }: FiltrosFeriados): Feriado[] {
  return feriados
    .filter((feriado) => !feriado.arquivado_em && feriado.data.startsWith(String(ano)))
    .filter((feriado) => abrangencia === 'todas' || feriado.abrangencia === abrangencia)
    .sort((a, b) => a.data.localeCompare(b.data) || a.nome.localeCompare(b.nome, 'pt-BR'));
}

export function localDoFeriado(feriado: Pick<Feriado, 'uf' | 'municipio'>): string {
  return [feriado.municipio, feriado.uf].filter(Boolean).join(' · ');
}

export type DadosFeriados = {
  feriados: Feriado[];
  local: LocalPadrao;
  municipios: Awaited<ReturnType<typeof carregarMunicipios>>;
};

export async function carregarTelaFeriados(): Promise<DadosFeriados> {
  const [feriados, configuracoes, municipios] = await Promise.all([repositorios.feriado.listar(), repositorios.configuracao.ler(), carregarMunicipios()]);
  return { feriados, local: { uf: configuracoes.uf_padrao, municipio: configuracoes.municipio_padrao }, municipios };
}

// ---------- Dias úteis (M05, M11 e M12) ----------

const dataUTC = (iso: string) => new Date(`${iso}T00:00:00Z`);

export function diaDaSemana(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: 'UTC' }).format(dataUTC(iso));
}

/** D16: nacionais sempre; estaduais e municipais, só os do local padrão. */
export function feriadosQueValem(feriados: readonly Feriado[], { uf, municipio }: LocalPadrao): Feriado[] {
  return feriados.filter((feriado) => {
    if (feriado.arquivado_em) return false;
    if (feriado.abrangencia === 'nacional') return true;
    if (feriado.uf !== uf) return false;
    return feriado.abrangencia === 'estadual' || feriado.municipio === municipio;
  });
}

function fimDeSemana(iso: string): boolean {
  const dia = dataUTC(iso).getUTCDay();
  return dia === 0 || dia === 6;
}

export function ehDiaUtil(iso: string, feriados: readonly Pick<Feriado, 'data'>[]): boolean {
  return !fimDeSemana(iso) && !feriados.some((feriado) => feriado.data === iso);
}

export function proximoDiaUtil(iso: string, feriados: readonly Pick<Feriado, 'data'>[]): string {
  const data = dataUTC(iso);
  do {
    data.setUTCDate(data.getUTCDate() + 1);
  } while (!ehDiaUtil(data.toISOString().slice(0, 10), feriados));
  return data.toISOString().slice(0, 10);
}

/** T02.09: só informa, não muda o vencimento. `null` quando o dia é útil. */
export function avisoDeVencimento(iso: string, feriados: readonly Pick<Feriado, 'data' | 'nome'>[]): string | null {
  const dia = dataUTC(iso).getUTCDay();
  if (dia === 0) return 'Vence num domingo — pagamento provavelmente no próximo dia útil';
  if (dia === 6) return 'Vence num sábado — pagamento provavelmente no próximo dia útil';
  const feriado = feriados.find((item) => item.data === iso);
  return feriado ? `Vence num feriado (${feriado.nome}) — pagamento provavelmente no próximo dia útil` : null;
}
