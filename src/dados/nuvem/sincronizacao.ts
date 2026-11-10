'use client';

/**
 * Liga a Central ao Supabase: carrega tudo ao entrar, envia cada lote na ordem em que foi gravado,
 * tenta de novo se a conexão cair e recebe, em tempo real, o que as outras pessoas gravam.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { gerarUuid } from '@/lib/ids';
import { avisarMudancaExterna, usarDriverPrincipal } from '../armazenamento';
import { esquecerMetaEmMemoria, recarregarMeta } from '../meta';
import { CHAVE_NUVEM, URL_NUVEM } from './config';
import { DriverNuvem, type LinhaNuvem, type Lote, type MudancaRemota } from './driver-nuvem';

let cliente: SupabaseClient | null = null;

/** Lido antes de o cliente consumir o link do e-mail: convite e redefinição pedem uma senha nova. */
export const tipoDoLinkDeEntrada: string | null =
  typeof window === 'undefined' ? null : new URLSearchParams(window.location.hash.slice(1)).get('type') ?? new URLSearchParams(window.location.search).get('type');

export function clienteNuvem(): SupabaseClient {
  cliente ??= createClient(URL_NUVEM, CHAVE_NUVEM, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  return cliente;
}

// ---------- Situação do envio, para o aviso na tela ----------

export type SituacaoEnvio = { estado: 'em_dia' } | { estado: 'enviando' } | { estado: 'tentando'; mensagem: string } | { estado: 'bloqueado'; mensagem: string };

let situacao: SituacaoEnvio = { estado: 'em_dia' };
const ouvintesSituacao = new Set<() => void>();

function mudarSituacao(nova: SituacaoEnvio) {
  situacao = nova;
  ouvintesSituacao.forEach((avisar) => avisar());
}

export function lerSituacaoEnvio(): SituacaoEnvio {
  return situacao;
}

export function assinarSituacaoEnvio(avisar: () => void): () => void {
  ouvintesSituacao.add(avisar);
  return () => ouvintesSituacao.delete(avisar);
}

export function haEnvioPendente(): boolean {
  return fila.length > 0;
}

// ---------- Fila de envio ----------

/** Identifica esta aba: ela ignora o próprio eco no tempo real. */
const ORIGEM = gerarUuid();
const fila: Lote[] = [];
let enviando = false;

function mensagemDoErro(erro: { message?: string; code?: string }): string {
  if (erro.code === '42501') return 'Este e-mail não tem permissão para gravar na Central.';
  return 'Sem conexão com o servidor.';
}

async function processarFila() {
  if (enviando) return;
  enviando = true;
  let espera = 2000;
  for (let lote = fila[0]; lote; lote = fila[0]) {
    mudarSituacao({ estado: 'enviando' });
    const { error } = await clienteNuvem().rpc('gravar_lote', { origem: ORIGEM, upserts: lote.upserts, remocoes: lote.remocoes });
    if (!error) {
      fila.shift();
      espera = 2000;
      continue;
    }
    console.error('Central: falha ao gravar no banco', error);
    if (error.code === '42501' || error.code === '22P02' || error.code === '23502') {
      // Não adianta repetir: o banco recusou o conteúdo ou a pessoa não tem acesso.
      mudarSituacao({ estado: 'bloqueado', mensagem: mensagemDoErro(error) });
      enviando = false;
      return;
    }
    mudarSituacao({ estado: 'tentando', mensagem: mensagemDoErro(error) });
    await new Promise((pronto) => setTimeout(pronto, espera));
    espera = Math.min(espera * 2, 30_000);
  }
  enviando = false;
  mudarSituacao({ estado: 'em_dia' });
}

function enviar(lote: Lote) {
  fila.push(lote);
  void processarFila();
}

/** Depois de entrar de novo, quem estava bloqueado volta a tentar. */
export function retomarEnvio() {
  if (fila.length) void processarFila();
}

// ---------- Carga e tempo real ----------

const TAMANHO_DA_PAGINA = 1000;

async function carregarTudo(): Promise<LinhaNuvem[]> {
  const linhas: LinhaNuvem[] = [];
  for (let inicio = 0; ; inicio += TAMANHO_DA_PAGINA) {
    const { data, error } = await clienteNuvem()
      .from('registro')
      .select('tabela, id, dados')
      .order('ordem')
      .range(inicio, inicio + TAMANHO_DA_PAGINA - 1);
    if (error) throw error;
    linhas.push(...(data as LinhaNuvem[]));
    if (data.length < TAMANHO_DA_PAGINA) return linhas;
  }
}

let driverAtual: DriverNuvem | null = null;

function aplicarRemota(mudanca: MudancaRemota) {
  const tipo = driverAtual?.aplicarRemota(mudanca);
  if (tipo === 'meta') recarregarMeta();
  if (tipo === 'dados') avisarMudancaExterna();
}

type LinhaDoBanco = Partial<LinhaNuvem> & { origem?: string | null };

let inicio: Promise<void> | null = null;

/**
 * Carrega tudo do banco e passa a usar o banco no lugar do localStorage. Chamar de novo devolve a
 * mesma carga: ao abrir a página já logada, o Supabase avisa a entrada mais de uma vez.
 */
export function iniciarNuvem(): Promise<void> {
  inicio ??= conectar().catch((erro: unknown) => {
    inicio = null;
    throw erro;
  });
  return inicio;
}

async function conectar(): Promise<void> {
  const linhas = await carregarTudo();
  driverAtual = new DriverNuvem(linhas, { enviar, pessoal: window.localStorage });
  usarDriverPrincipal(driverAtual);
  esquecerMetaEmMemoria();

  let caiu = false;
  clienteNuvem()
    .channel('central-registro')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'registro' }, (evento) => {
      if (evento.eventType === 'DELETE') {
        const antiga = evento.old as LinhaDoBanco;
        if (antiga.tabela && antiga.id) aplicarRemota({ tipo: 'remocao', tabela: antiga.tabela, id: antiga.id });
        return;
      }
      const nova = evento.new as LinhaDoBanco;
      if (nova.origem === ORIGEM || !nova.tabela || !nova.id) return;
      aplicarRemota({ tipo: 'upsert', linha: { tabela: nova.tabela, id: nova.id, dados: nova.dados } });
    })
    .subscribe((estado) => {
      if (estado === 'CHANNEL_ERROR' || estado === 'TIMED_OUT' || estado === 'CLOSED') caiu = true;
      if (estado === 'SUBSCRIBED' && caiu) {
        // Ficou um tempo sem receber: o que mudou nesse meio-tempo vem numa carga nova.
        caiu = false;
        void recarregarTudo();
      }
    });
}

async function recarregarTudo() {
  if (!driverAtual || fila.length) return;
  try {
    const linhas = await carregarTudo();
    if (fila.length) return;
    driverAtual.substituir(linhas);
    recarregarMeta();
    avisarMudancaExterna();
  } catch {
    // segue com o que já está na tela; a próxima reconexão tenta de novo
  }
}
