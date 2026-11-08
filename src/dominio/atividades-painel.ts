/** Regras de T03.02 (05-M03): o painel da atividade, com o que se edita nele. */
import { ErroDeRegra } from '@/dados/erros';
import { listarHistorico } from '@/dados/historico';
import { repositorios } from '@/dados/repositorios';
import { emTransacao } from '@/dados/transacao';
import { parDoVinculo, type AnexoLink, type ChecklistItem, type Comentario, type Vinculo } from '@/dados/tipos/apoio';
import type { Atividade } from '@/dados/tipos/atividade';
import type { Pessoa } from '@/dados/tipos/pessoa';
import type { Recorrencia } from '@/dados/tipos/recorrencia';
import { diaEHoraNoFuso, instanteNoFuso } from '@/lib/datas';
import { CAMINHO_DA_ATIVIDADE, estaAberta, MAXIMO_NO_TITULO } from './atividades';
import { normalizarTexto } from './duplicidade';
import { linkDoDriveValido, MENSAGEM_LINK_DRIVE } from './link-drive';
import { notificarMencoes } from './notificacoes';
import { ORIGEM_DO_ALERTA_F1, REGISTROS_VINCULAVEIS_F1 } from './integracoes/meu-dia-f1';
import { ORIGEM_DO_ALERTA_M06, ORIGEM_TRANSFERENCIA, REGISTROS_VINCULAVEIS_M06 } from './integracoes/meu-dia-m06';
import { ORIGEM_DO_ALERTA_M12, REGISTROS_VINCULAVEIS_M12 } from './integracoes/meu-dia-m12';
import { ORIGEM_DO_ALERTA_M08, REGISTROS_VINCULAVEIS_M08 } from './integracoes/meu-dia-m08';

const TIPO_DO_REGISTRO = 'atividade';
export const TEXTO_DO_COMENTARIO_REMOVIDO = 'Comentário removido';

/** Registros que dá para vincular hoje. Cada módulo novo acrescenta o seu (ferramenta, ativo, título…). */
export const REGISTROS_VINCULAVEIS: Readonly<Record<string, { rotulo: string; href: (id: string) => string }>> = {
  contraparte: { rotulo: 'Contraparte', href: (id) => `/comercial/contrapartes/${id}/cadastro` },
  produto: { rotulo: 'Produto', href: (id) => `/produtos/${id}` },
  ferramenta: { rotulo: 'Ferramenta', href: (id) => `/ferramentas/${id}` },
  ativo_digital: { rotulo: 'Ativo digital', href: (id) => `/ferramentas/ativos/${id}` },
  titulo: { rotulo: 'Lançamento', href: (id) => `/financeiro/${id}` },
  ...REGISTROS_VINCULAVEIS_F1,
  ...REGISTROS_VINCULAVEIS_M06,
  ...REGISTROS_VINCULAVEIS_M12,
  ...REGISTROS_VINCULAVEIS_M08,
};

export { CAMINHO_DA_ATIVIDADE };

/** Encerrada fica só para leitura: para mudar, primeiro reabre. Comentar continua valendo. */
async function atividadeAberta(id: string): Promise<Atividade> {
  const atividade = await repositorios.atividade.obter(id);
  if (!atividade) throw new ErroDeRegra('Esta atividade não existe mais.');
  if (!estaAberta(atividade)) throw new ErroDeRegra('Esta atividade está encerrada: reabra para mudar.');
  return atividade;
}

// ---------- Campos ----------

export async function alterarTitulo(id: string, titulo: string): Promise<void> {
  const limpo = titulo.trim();
  if (!limpo) throw new ErroDeRegra('Informe o título.');
  if (limpo.length > MAXIMO_NO_TITULO) throw new ErroDeRegra(`Use até ${MAXIMO_NO_TITULO} caracteres.`);
  await atividadeAberta(id);
  await repositorios.atividade.atualizar(id, { titulo: limpo });
}

export type CamposSimples = Partial<Pick<Atividade, 'descricao' | 'area_id' | 'prioridade' | 'responsavel_id' | 'inicio' | 'solicitante_pessoa_id' | 'solicitante_texto' | 'resultado_esperado' | 'aguardando_de_pessoa_id' | 'aguardando_de_texto' | 'acompanhamento_em'>>;

export async function alterarCampos(id: string, campos: CamposSimples): Promise<void> {
  await atividadeAberta(id);
  await repositorios.atividade.atualizar(id, campos);
}

export type DatasDaAtividade = { inicio: string; prazo: string; prazo_hora: string; aviso_dia: string; aviso_hora: string };

/** O que as datas pedem (RN-03.03). Elas se conferem juntas: mudar o prazo e o aviso de uma vez é permitido. */
export function errosDasDatas({ inicio, prazo, prazo_hora, aviso_dia, aviso_hora }: DatasDaAtividade, tipo: Atividade['tipo']): Partial<Record<keyof DatasDaAtividade, string>> {
  const erros: Partial<Record<keyof DatasDaAtividade, string>> = {};
  if (prazo_hora && !prazo) erros.prazo = 'Informe o dia do prazo.';
  if (inicio && prazo && inicio > prazo) erros.inicio = 'O início precisa ser antes do prazo.';
  if (tipo === 'lembrete') {
    if (!aviso_dia) erros.aviso_dia = 'Informe a data do aviso.';
    if (!aviso_hora) erros.aviso_hora = 'Informe a hora do aviso.';
  } else if (Boolean(aviso_dia) !== Boolean(aviso_hora)) {
    erros[aviso_dia ? 'aviso_hora' : 'aviso_dia'] = 'Informe o dia e a hora do aviso.';
  }
  if (aviso_dia && prazo && aviso_dia > prazo) erros.aviso_dia = 'O aviso precisa ser antes do prazo.';
  return erros;
}

/** CA-03.05: mudar o prazo grava a data anterior no histórico. Passar para depois conta como adiamento (RN-03.08). */
export async function alterarDatas(id: string, datas: DatasDaAtividade): Promise<void> {
  const atividade = await atividadeAberta(id);
  const [erro] = Object.values(errosDasDatas(datas, atividade.tipo));
  if (erro) throw new ErroDeRegra(erro);
  const { inicio, prazo, prazo_hora, aviso_dia, aviso_hora } = datas;
  const adiou = Boolean(atividade.prazo && prazo && prazo > atividade.prazo);
  await repositorios.atividade.atualizar(id, { inicio: inicio || null, prazo: prazo || null, prazo_hora: prazo_hora || null, aviso_em: aviso_dia ? instanteNoFuso(aviso_dia, aviso_hora) : null, adiamentos: adiou ? atividade.adiamentos + 1 : atividade.adiamentos, editada_individualmente: Boolean(atividade.recorrencia_id) });
}

/** Tira quem saiu e coloca quem entrou, sem repetir nem mexer em quem ficou. */
async function trocarLigacoes<T extends { id: string }>(atuais: readonly T[], campoDe: (linha: T) => string, desejados: readonly string[], arquivar: (id: string) => Promise<unknown>, criar: (valor: string) => Promise<unknown>) {
  const novos = new Set(desejados);
  for (const linha of atuais) {
    if (!novos.has(campoDe(linha))) await arquivar(linha.id);
    novos.delete(campoDe(linha));
  }
  for (const valor of novos) await criar(valor);
}

/** Sem nenhum produto, a atividade é da Numa. */
export async function definirContextos(id: string, produtos: readonly string[]): Promise<void> {
  await atividadeAberta(id);
  await emTransacao(async () => {
    const atuais = await repositorios.atividade_produto.listar({ onde: { atividade_id: id } });
    await trocarLigacoes(atuais, (linha) => linha.produto_id, produtos, (ligacao) => repositorios.atividade_produto.arquivar(ligacao), (produto_id) => repositorios.atividade_produto.criar({ atividade_id: id, produto_id }));
  });
}

export async function definirParticipantes(id: string, pessoas: readonly string[]): Promise<void> {
  await atividadeAberta(id);
  await emTransacao(async () => {
    const atuais = await repositorios.atividade_participante.listar({ onde: { atividade_id: id } });
    await trocarLigacoes(atuais, (linha) => linha.pessoa_id, pessoas, (ligacao) => repositorios.atividade_participante.arquivar(ligacao), (pessoa_id) => repositorios.atividade_participante.criar({ atividade_id: id, pessoa_id }));
  });
}

// ---------- Checklist ----------

export async function adicionarItem(atividadeId: string, texto: string): Promise<void> {
  const limpo = texto.trim();
  if (!limpo) throw new ErroDeRegra('Escreva o item.');
  await atividadeAberta(atividadeId);
  const itens = await repositorios.checklist_item.listar({ onde: { registro_id: atividadeId }, incluirArquivados: true });
  await repositorios.checklist_item.criar({ registro_tipo: TIPO_DO_REGISTRO, registro_id: atividadeId, ordem: itens.reduce((maior, item) => Math.max(maior, item.ordem + 1), 0), texto: limpo, responsavel_id: null, feito: false, feito_por: null, feito_em: null });
}

async function conferirItem(id: string): Promise<void> {
  const item = await repositorios.checklist_item.obter(id);
  if (!item) throw new ErroDeRegra('Este item não existe mais.');
  await atividadeAberta(item.registro_id);
}

/** "Feito por e em" (T03.02): quem marca é a pessoa atual. */
export async function marcarItem(id: string, feito: boolean, pessoaId: string): Promise<void> {
  await conferirItem(id);
  await repositorios.checklist_item.atualizar(id, feito ? { feito: true, feito_por: pessoaId, feito_em: new Date().toISOString() } : { feito: false, feito_por: null, feito_em: null });
}

export async function definirResponsavelDoItem(id: string, pessoaId: string): Promise<void> {
  await conferirItem(id);
  await repositorios.checklist_item.atualizar(id, { responsavel_id: pessoaId || null });
}

export async function removerItem(id: string): Promise<void> {
  await conferirItem(id);
  await repositorios.checklist_item.arquivar(id);
}

// ---------- Comentários (RN-03.22) ----------

/**
 * `@camila` ou `@CamilaLima` viram menção, sem ligar para acento ou maiúscula. Só pessoas internas
 * ativas: é quem recebe a notificação (T13.04).
 */
export function extrairMencoes(texto: string, pessoas: readonly Pick<Pessoa, 'id' | 'nome_completo'>[]): string[] {
  const achadas = new Set<string>();
  for (const [, marca] of texto.matchAll(/@([\p{L}\p{N}]+)/gu)) {
    const alvo = normalizarTexto(marca ?? '');
    const pessoa = pessoas.find(({ nome_completo }) => {
      const partes = normalizarTexto(nome_completo).split(/\s+/);
      return partes[0] === alvo || partes.join('') === alvo;
    });
    if (pessoa) achadas.add(pessoa.id);
  }
  return [...achadas];
}

/** "Edição até 15 min" (02 §6): passado esse tempo, só dá para remover. */
export const MINUTOS_PARA_EDITAR_COMENTARIO = 15;

export function podeEditarComentario(comentario: Pick<Comentario, 'autor_id' | 'criado_em' | 'removido_em'>, pessoaId: string, agora: Date = new Date()): boolean {
  if (comentario.autor_id !== pessoaId || comentario.removido_em) return false;
  return agora.getTime() - new Date(comentario.criado_em).getTime() <= MINUTOS_PARA_EDITAR_COMENTARIO * 60_000;
}

export async function comentar(atividadeId: string, texto: string, autorId: string, pessoas: readonly Pick<Pessoa, 'id' | 'nome_completo'>[]): Promise<Comentario> {
  const limpo = texto.trim();
  if (!limpo) throw new ErroDeRegra('Escreva o comentário.');
  return emTransacao(async () => {
    const comentario = await repositorios.comentario.criar({ registro_tipo: TIPO_DO_REGISTRO, registro_id: atividadeId, autor_id: autorId, texto: limpo, mencoes: extrairMencoes(limpo, pessoas), editado_em: null, removido_em: null });
    await notificarMencoes(comentario, pessoas);
    return comentario;
  });
}

export async function editarComentario(id: string, texto: string, pessoas: readonly Pick<Pessoa, 'id' | 'nome_completo'>[], pessoaId: string): Promise<void> {
  const limpo = texto.trim();
  if (!limpo) throw new ErroDeRegra('Escreva o comentário.');
  const atual = await repositorios.comentario.obter(id);
  if (!atual) throw new ErroDeRegra('Este comentário não existe mais.');
  if (!podeEditarComentario(atual, pessoaId)) throw new ErroDeRegra(`Só dá para editar um comentário seu, até ${MINUTOS_PARA_EDITAR_COMENTARIO} minutos depois de publicar.`);
  await emTransacao(async () => {
    const comentario = await repositorios.comentario.atualizar(id, { texto: limpo, mencoes: extrairMencoes(limpo, pessoas), editado_em: new Date().toISOString() });
    await notificarMencoes(comentario, pessoas);
  });
}

/** Vira "comentário removido" na lista (02 §6), sem o texto. O histórico guarda que ele existiu. */
export async function removerComentario(id: string): Promise<void> {
  await repositorios.comentario.atualizar(id, { texto: TEXTO_DO_COMENTARIO_REMOVIDO, mencoes: [], removido_em: new Date().toISOString() });
}

// ---------- Vínculos e arquivos ----------

export async function adicionarVinculo(atividadeId: string, tipo: string, id: string): Promise<void> {
  await atividadeAberta(atividadeId);
  const par = parDoVinculo({ tipo: TIPO_DO_REGISTRO, id: atividadeId }, { tipo, id });
  const existentes = await repositorios.vinculo.listar({ onde: par });
  if (existentes.length) throw new ErroDeRegra('Este vínculo já existe.');
  await repositorios.vinculo.criar(par);
}

export async function removerVinculo(id: string): Promise<void> {
  const vinculo = await repositorios.vinculo.obter(id);
  if (!vinculo) throw new ErroDeRegra('Este vínculo não existe mais.');
  await atividadeAberta(vinculo.origem_tipo === TIPO_DO_REGISTRO ? vinculo.origem_id : vinculo.destino_id);
  await repositorios.vinculo.arquivar(id);
}

export async function adicionarAnexo(atividadeId: string, url: string, titulo: string): Promise<void> {
  const limpo = url.trim();
  if (!linkDoDriveValido(limpo)) throw new ErroDeRegra(MENSAGEM_LINK_DRIVE);
  await atividadeAberta(atividadeId);
  await repositorios.anexo_link.criar({ registro_tipo: TIPO_DO_REGISTRO, registro_id: atividadeId, titulo: titulo.trim() || 'Arquivo do Drive', url: limpo });
}

export async function removerAnexo(id: string): Promise<void> {
  const anexo = await repositorios.anexo_link.obter(id);
  if (!anexo) throw new ErroDeRegra('Este link não existe mais.');
  await atividadeAberta(anexo.registro_id);
  await repositorios.anexo_link.arquivar(id);
}

// ---------- Duplicar e converter ----------

/** Uma nova atividade, A fazer, com o mesmo contexto, participantes e checklist desmarcado. */
export async function duplicarAtividade(id: string): Promise<Atividade> {
  const original = await repositorios.atividade.obter(id);
  if (!original) throw new ErroDeRegra('Esta atividade não existe mais.');
  if (original.tipo === 'alerta') throw new ErroDeRegra('Alerta não pode ser duplicado: quem cria é o sistema.');
  return emTransacao(async () => {
    const { id: _id, codigo: _codigo, criado_em: _criado, criado_por: _criadoPor, atualizado_em: _atualizado, atualizado_por: _atualizadoPor, arquivado_em: _arquivado, arquivado_por: _arquivadoPor, versao_registro: _versao, exemplo: _exemplo, ...campos } = original;
    const titulo = `${original.titulo.slice(0, MAXIMO_NO_TITULO - 8)} (cópia)`;
    const nova = await repositorios.atividade.criar({ ...campos, titulo, situacao: 'a_fazer', bloqueada: false, bloqueio_motivo: null, bloqueada_em: null, aguardando_de_pessoa_id: null, aguardando_de_texto: null, aguardando_desde: null, acompanhamento_em: null, adiamentos: 0, concluida_em: null, concluida_por: null, conclusao_nota: null, cancelada_motivo: null, dispensada_motivo: null, recorrencia_id: null, ocorrencia_numero: null, ocorrencia_data: null, editada_individualmente: false, chave_idempotencia: null });
    for (const ligacao of await repositorios.atividade_produto.listar({ onde: { atividade_id: id } })) await repositorios.atividade_produto.criar({ atividade_id: nova.id, produto_id: ligacao.produto_id });
    for (const ligacao of await repositorios.atividade_participante.listar({ onde: { atividade_id: id } })) await repositorios.atividade_participante.criar({ atividade_id: nova.id, pessoa_id: ligacao.pessoa_id });
    for (const item of await repositorios.checklist_item.listar({ onde: { registro_id: id } })) await repositorios.checklist_item.criar({ registro_tipo: TIPO_DO_REGISTRO, registro_id: nova.id, ordem: item.ordem, texto: item.texto, responsavel_id: item.responsavel_id, feito: false, feito_por: null, feito_em: null });
    return nova;
  });
}

/** Tarefa vira demanda, com a pessoa atual como solicitante, e demanda vira tarefa. O que era da demanda fica guardado, caso volte. */
export async function converterAtividade(id: string, tipo: 'tarefa' | 'demanda', pessoaId: string): Promise<void> {
  const atividade = await atividadeAberta(id);
  const semSolicitante = !atividade.solicitante_pessoa_id && !atividade.solicitante_texto;
  await repositorios.atividade.atualizar(id, tipo === 'demanda' && semSolicitante ? { tipo, solicitante_pessoa_id: pessoaId } : { tipo });
}

// ---------- Carga do painel ----------

export type LinhaDeVinculo = { id: string; tipo: string; registroId: string; rotulo: string; nome: string; href: string | null };

export type DadosDoPainel = {
  atividade: Atividade;
  produtos: string[];
  participantes: string[];
  itens: ChecklistItem[];
  comentarios: Comentario[];
  vinculos: LinhaDeVinculo[];
  anexos: AnexoLink[];
  /** "Por quem" do bloqueio vem do histórico: a tabela só guarda o motivo e a data (16 §4.3). */
  quemBloqueou: string | null;
  /** A rotina de que esta atividade é ocorrência (T03.05). */
  rotina: Recorrencia | null;
  /** Os ids das etiquetas. Valem só para esta atividade, e não passam para as próximas ocorrências. */
  etiquetas: string[];
};

export async function nomeDoRegistro(tipo: string, id: string): Promise<string> {
  if (tipo === 'contraparte') {
    const contraparte = await repositorios.contraparte.obter(id);
    return contraparte?.nome_fantasia || contraparte?.nome || 'Contraparte removida';
  }
  if (tipo === 'produto') return (await repositorios.produto.obter(id))?.nome ?? 'Produto removido';
  if (tipo === 'ferramenta') return (await repositorios.ferramenta.obter(id))?.nome ?? 'Ferramenta removida';
  if (tipo === 'ativo_digital') return (await repositorios.ativo_digital.obter(id))?.identificador ?? 'Ativo removido';
  if (tipo === 'titulo') return (await repositorios.titulo.obter(id))?.descricao ?? 'Lançamento removido';
  if (tipo === 'reuniao') return (await repositorios.reuniao.obter(id))?.titulo ?? 'Reunião removida';
  if (tipo === 'decisao') return (await repositorios.decisao.obter(id))?.titulo ?? 'Decisão removida';
  if (tipo === 'acordo_societario') return (await repositorios.acordo_societario.obter(id))?.titulo ?? 'Acordo removido';
  if (tipo === 'constituicao_item') return (await repositorios.constituicao_item.obter(id))?.titulo ?? 'Item removido';
  if (tipo === 'obrigacao_corporativa') return (await repositorios.obrigacao_corporativa.obter(id))?.nome ?? 'Obrigação removida';
  if (tipo === 'contrato') return (await repositorios.contrato.obter(id))?.titulo ?? 'Contrato removido';
  return 'Registro removido';
}

export async function vinculosDaAtividade(id: string): Promise<LinhaDeVinculo[]> {
  const todos = await repositorios.vinculo.listar();
  const daAtividade = todos.filter((vinculo) => (vinculo.origem_tipo === TIPO_DO_REGISTRO && vinculo.origem_id === id) || (vinculo.destino_tipo === TIPO_DO_REGISTRO && vinculo.destino_id === id));
  return Promise.all(
    daAtividade.map(async (vinculo: Vinculo) => {
      const ehOrigem = vinculo.origem_tipo === TIPO_DO_REGISTRO && vinculo.origem_id === id;
      const tipo = ehOrigem ? vinculo.destino_tipo : vinculo.origem_tipo;
      const registroId = ehOrigem ? vinculo.destino_id : vinculo.origem_id;
      const destino = REGISTROS_VINCULAVEIS[tipo];
      return { id: vinculo.id, tipo, registroId, rotulo: destino?.rotulo ?? tipo, nome: await nomeDoRegistro(tipo, registroId), href: destino?.href(registroId) ?? null };
    }),
  );
}

export async function carregarPainel(id: string): Promise<DadosDoPainel | null> {
  const atividade = await repositorios.atividade.obter(id);
  if (!atividade) return null;
  const [produtos, participantes, itens, comentarios, anexos, vinculos, eventos, rotina] = await Promise.all([
    repositorios.atividade_produto.listar({ onde: { atividade_id: id } }),
    repositorios.atividade_participante.listar({ onde: { atividade_id: id } }),
    repositorios.checklist_item.listar({ onde: { registro_id: id } }),
    repositorios.comentario.listar({ onde: { registro_id: id } }),
    repositorios.anexo_link.listar({ onde: { registro_id: id } }),
    vinculosDaAtividade(id),
    listarHistorico({ tabela: 'atividade', registroId: id }),
    atividade.recorrencia_id ? repositorios.recorrencia.obter(atividade.recorrencia_id) : Promise.resolve(null),
  ]);
  const bloqueio = eventos.find((evento) => evento.depois?.bloqueada === true);
  const etiquetas = (await repositorios.etiqueta_vinculo.listar({ onde: { registro_tipo: 'atividade', registro_id: id } })).map((vinculo) => vinculo.etiqueta_id);
  return {
    etiquetas,
    atividade,
    produtos: produtos.map((ligacao) => ligacao.produto_id),
    participantes: participantes.map((ligacao) => ligacao.pessoa_id),
    itens: itens.sort((a, b) => a.ordem - b.ordem),
    comentarios: comentarios.sort((a, b) => a.criado_em.localeCompare(b.criado_em)),
    vinculos,
    anexos,
    quemBloqueou: bloqueio?.usuario_id ?? null,
    rotina,
  };
}

// ---------- RN-03.20: a atividade aparece na ficha do registro vinculado ----------

/** A origem do alerta, para cada tipo de registro que tem ficha. */
const ORIGEM_DO_ALERTA: Readonly<Record<string, string>> = { titulo: 'titulo', ferramenta: 'ferramenta', ativo_digital: 'ativo', ...ORIGEM_DO_ALERTA_F1, ...ORIGEM_DO_ALERTA_M06, ...ORIGEM_DO_ALERTA_M12, ...ORIGEM_DO_ALERTA_M08 };

/** Vinculadas a um registro: pelo `vinculo`, no caso do produto também pelo contexto, e os alertas que nasceram dele. */
export async function atividadesDoRegistro(tipo: string, id: string): Promise<Atividade[]> {
  const [vinculos, ligacoes, atividades] = await Promise.all([repositorios.vinculo.listar(), tipo === 'produto' ? repositorios.atividade_produto.listar({ onde: { produto_id: id } }) : Promise.resolve([]), repositorios.atividade.listar()]);
  const ids = new Set([
    ...ligacoes.map((ligacao) => ligacao.atividade_id),
    ...vinculos.flatMap((vinculo) => {
      if (vinculo.origem_tipo === tipo && vinculo.origem_id === id && vinculo.destino_tipo === TIPO_DO_REGISTRO) return [vinculo.destino_id];
      if (vinculo.destino_tipo === tipo && vinculo.destino_id === id && vinculo.origem_tipo === TIPO_DO_REGISTRO) return [vinculo.origem_id];
      return [];
    }),
  ]);
  return atividades.filter((atividade) => ids.has(atividade.id) || (atividade.tipo === 'alerta' && atividade.origem_id === id && ((Boolean(ORIGEM_DO_ALERTA[tipo]) && atividade.origem_tipo === ORIGEM_DO_ALERTA[tipo]) || atividade.origem_tipo === ORIGEM_TRANSFERENCIA)));
}

/** Responsável ou participante. */
export async function atividadesDaPessoa(id: string): Promise<Atividade[]> {
  const [participacoes, atividades] = await Promise.all([repositorios.atividade_participante.listar({ onde: { pessoa_id: id } }), repositorios.atividade.listar()]);
  const ids = new Set(participacoes.map((ligacao) => ligacao.atividade_id));
  return atividades.filter((atividade) => atividade.responsavel_id === id || ids.has(atividade.id));
}
