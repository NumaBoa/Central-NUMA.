/** Regras de T13.04 (15-M13): o sino, com alertas, menções, lembretes e falhas de rotina. */
import { AREAS_INICIAIS } from '@/dados/exemplos/base';
import { repositorios } from '@/dados/repositorios';
import { comoSistema } from '@/dados/sessao';
import { emTransacao } from '@/dados/transacao';
import type { Comentario } from '@/dados/tipos/apoio';
import type { Notificacao } from '@/dados/tipos/notificacao';
import type { Pessoa } from '@/dados/tipos/pessoa';
import { CAMINHO_DA_ATIVIDADE, estaAberta, primeiroNome } from './atividades';

export const ROTULOS_TIPO_NOTIFICACAO = { alerta: 'Alerta', mencao: 'Menção', lembrete: 'Lembrete', job: 'Rotina do dia' } as const;

/** Lidas somem do sino depois de 30 dias; o alerta continua no Meu dia até ser concluído. */
export const DIAS_NO_SINO_DEPOIS_DE_LIDA = 30;

const UM_DIA = 86_400_000;
const ID_TECNOLOGIA = AREAS_INICIAIS.find((area) => area.nome === 'Tecnologia')?.id ?? '';
const TIPO_ROTINAS = 'rotinas_do_dia';

// ---------- Menções (RN-03.22) ----------

/** Quem foi mencionado recebe, menos quem escreveu. A chave impede repetir ao editar o comentário. */
export async function notificarMencoes(comentario: Pick<Comentario, 'id' | 'registro_tipo' | 'registro_id' | 'autor_id' | 'mencoes'>, pessoas: readonly Pick<Pessoa, 'id' | 'nome_completo'>[]): Promise<void> {
  const destinatarios = comentario.mencoes.filter((id) => id !== comentario.autor_id);
  if (!destinatarios.length) return;
  const [atividade, existentes] = await Promise.all([repositorios.atividade.obter(comentario.registro_id), repositorios.notificacao.listar({ incluirArquivados: true })]);
  const chaves = new Set(existentes.map((notificacao) => notificacao.chave));
  const autor = pessoas.find((pessoa) => pessoa.id === comentario.autor_id)?.nome_completo;
  const titulo = `${autor ? primeiroNome(autor) : 'Alguém'} mencionou você em ${atividade?.titulo ?? 'um comentário'}`;
  for (const usuario_id of destinatarios) {
    const chave = `mencao:${comentario.id}:${usuario_id}`;
    if (!chaves.has(chave)) await repositorios.notificacao.criar({ usuario_id, tipo: 'mencao', titulo, registro_tipo: comentario.registro_tipo, registro_id: comentario.registro_id, lida_em: null, chave });
  }
}

// ---------- Falhas das rotinas do dia ----------

/** "Falhas de job (Tecnologia)": vai para a responsável padrão da área. */
export async function notificarFalhasDasRotinas(falhas: readonly string[], hoje: string): Promise<void> {
  const [area, { responsavel_backup_id }, existentes] = await Promise.all([repositorios.area.obter(ID_TECNOLOGIA), repositorios.configuracao.ler(), repositorios.notificacao.listar({ incluirArquivados: true })]);
  const usuario_id = area?.responsavel_padrao_id ?? responsavel_backup_id;
  const chaves = new Set(existentes.map((notificacao) => notificacao.chave));
  for (const rotina of falhas) {
    const chave = `job:${hoje}:${rotina}`;
    if (!chaves.has(chave)) await repositorios.notificacao.criar({ usuario_id, tipo: 'job', titulo: `A rotina do dia “${rotina}” não terminou`, registro_tipo: TIPO_ROTINAS, registro_id: null, lida_em: null, chave });
  }
}

// ---------- Alertas e lembretes ----------

let sincronizando = false;

/**
 * Alertas abertos da responsável e lembretes que chegaram na hora (RN-03.21). Roda ao abrir a Central e
 * a cada minuto enquanto ela estiver aberta. Rodar de novo não repete nada (RT-09). Alerta que se
 * resolveu sai das não lidas, e quem assumiu um alerta recebe a dela.
 */
export async function sincronizarNotificacoes(agora: Date = new Date()): Promise<number> {
  if (sincronizando) return 0;
  sincronizando = true;
  try {
    const [atividades, existentes] = await Promise.all([repositorios.atividade.listar(), repositorios.notificacao.listar({ incluirArquivados: true })]);
    const chaves = new Set(existentes.map((notificacao) => notificacao.chave));
    const momento = agora.toISOString();
    const abertas = atividades.filter(estaAberta);
    const novas = abertas.flatMap((atividade) => {
      const base = { usuario_id: atividade.responsavel_id, registro_tipo: 'atividade', registro_id: atividade.id, lida_em: null, exemplo: atividade.exemplo };
      const linhas = [];
      const chaveDoAlerta = `alerta:${atividade.id}:${atividade.responsavel_id}`;
      if (atividade.tipo === 'alerta' && !chaves.has(chaveDoAlerta)) linhas.push({ ...base, tipo: 'alerta' as const, titulo: atividade.titulo, chave: chaveDoAlerta });
      const chaveDoLembrete = `lembrete:${atividade.id}:${atividade.aviso_em}`;
      if (atividade.aviso_em && atividade.aviso_em <= momento && !chaves.has(chaveDoLembrete)) linhas.push({ ...base, tipo: 'lembrete' as const, titulo: atividade.titulo, chave: chaveDoLembrete });
      return linhas;
    });
    const idsAbertos = new Set(abertas.map((atividade) => atividade.id));
    const resolvidos = existentes.filter((notificacao) => notificacao.tipo === 'alerta' && !notificacao.lida_em && !notificacao.arquivado_em && notificacao.registro_id && !idsAbertos.has(notificacao.registro_id));
    if (!novas.length && !resolvidos.length) return 0;
    await comoSistema(() =>
      emTransacao(async () => {
        for (const nova of novas) await repositorios.notificacao.criar(nova);
        for (const resolvido of resolvidos) await repositorios.notificacao.atualizar(resolvido.id, { lida_em: momento });
      }),
    );
    return novas.length;
  } finally {
    sincronizando = false;
  }
}

// ---------- O sino ----------

/** As da pessoa, mais recentes primeiro. */
export async function carregarNotificacoes(pessoaId: string, agora: Date = new Date()): Promise<Notificacao[]> {
  const limite = new Date(agora.getTime() - DIAS_NO_SINO_DEPOIS_DE_LIDA * UM_DIA).toISOString();
  const delas = await repositorios.notificacao.listar({ onde: { usuario_id: pessoaId } });
  return delas.filter((notificacao) => !notificacao.lida_em || notificacao.lida_em >= limite).sort((a, b) => b.criado_em.localeCompare(a.criado_em));
}

export async function marcarComoLida(id: string): Promise<void> {
  await repositorios.notificacao.atualizar(id, { lida_em: new Date().toISOString() });
}

export async function marcarTodasComoLidas(pessoaId: string): Promise<void> {
  const naoLidas = (await repositorios.notificacao.listar({ onde: { usuario_id: pessoaId } })).filter((notificacao) => !notificacao.lida_em);
  await emTransacao(async () => {
    for (const notificacao of naoLidas) await marcarComoLida(notificacao.id);
  });
}

/** Abrir a origem. Sem registro, a notificação só informa. */
export function caminhoDaNotificacao({ registro_tipo, registro_id }: Pick<Notificacao, 'registro_tipo' | 'registro_id'>): string | null {
  if (registro_tipo === 'atividade' && registro_id) return CAMINHO_DA_ATIVIDADE(registro_id);
  if (registro_tipo === TIPO_ROTINAS) return '/configuracoes/dados';
  return null;
}
