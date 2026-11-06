import { hojeISO, instanteNoFuso } from '@/lib/datas';
import { montarCodigo } from '@/lib/ids';
import { parDoVinculo, type AnexoLink, type ChecklistItem, type Comentario, type Vinculo } from '../tipos/apoio';
import type { Atividade, AtividadeParticipante, AtividadeProduto } from '../tipos/atividade';
import { controle } from './controle';
import { AREAS_INICIAIS, ID_BRUNA, ID_CAMILA, ID_CONTRAPARTE_CONTABILIDADE, ID_KIMBERLY, ID_PRODUTO_KIPI, ID_PRODUTO_MIMO, ID_PRODUTO_URBANA, ID_PRODUTO_ZARPA, ID_PRODUTO_ZUPI } from './base';

const idDaArea = (nome: (typeof AREAS_INICIAIS)[number]['nome']) => AREAS_INICIAIS.find((area) => area.nome === nome)?.id ?? null;
const idDaAtividade = (numero: number) => `b9d7f8eb-e2a6-4b87-9d78-7a8b9c0d1e${String(numero).padStart(2, '0')}`;
const idDaLigacao = (numero: number) => `cae8a9fc-f3b7-4c98-8e89-8b9c0d1e2f${String(numero).padStart(2, '0')}`;

function diasDepois(dia: string, dias: number): string {
  const data = new Date(`${dia}T00:00:00Z`);
  data.setUTCDate(data.getUTCDate() + dias);
  return data.toISOString().slice(0, 10);
}

type Exemplo = Pick<Atividade, 'titulo' | 'responsavel_id'> & Partial<Atividade> & { produtos?: readonly string[]; participantes?: readonly string[] };

/**
 * Atividades fictícias de `17 §6`, com as datas contadas a partir de hoje: em todas as situações,
 * com e sem prazo, atrasadas e bloqueadas. As recorrentes entram com T03.05.
 */
export function atividadesDeExemplo(agora: string) {
  const hoje = hojeISO(new Date(agora));
  const dia = (dias: number) => diasDepois(hoje, dias);
  const instanteHa = (dias: number) => new Date(new Date(agora).getTime() - dias * 86_400_000).toISOString();

  const exemplos: readonly Exemplo[] = [
    { titulo: 'Revisar os textos da página de preços do Zupi', responsavel_id: ID_KIMBERLY, produtos: [ID_PRODUTO_ZUPI], area_id: idDaArea('Social media / Marketing'), prazo: dia(-3), prioridade: 'alta' },
    { titulo: 'Publicar a nota de versão do Kipi', responsavel_id: ID_CAMILA, produtos: [ID_PRODUTO_KIPI], area_id: idDaArea('Tecnologia'), prazo: hoje, participantes: [ID_KIMBERLY] },
    { titulo: 'Corrigir o erro no login do Kipi', responsavel_id: ID_CAMILA, produtos: [ID_PRODUTO_KIPI], area_id: idDaArea('Tecnologia'), prazo: dia(1), prioridade: 'urgente', situacao: 'em_andamento' },
    { titulo: 'Escrever a política de privacidade do Sobrevivência Urbana', responsavel_id: ID_KIMBERLY, produtos: [ID_PRODUTO_URBANA], area_id: idDaArea('Jurídico e privacidade'), prazo: dia(5), bloqueada: true, bloqueio_motivo: 'Aguardando a definição da entidade', bloqueada_em: instanteHa(1) },
    { titulo: 'Confirmar os documentos para abrir a empresa', responsavel_id: ID_KIMBERLY, area_id: idDaArea('Gestão geral'), prazo: dia(10), situacao: 'aguardando', aguardando_de_texto: 'Souza Contabilidade', aguardando_desde: dia(-2), acompanhamento_em: hoje },
    { titulo: 'Mapear o fluxo de cadastro do Zarpa', responsavel_id: ID_CAMILA, produtos: [ID_PRODUTO_ZARPA], area_id: idDaArea('Produto'), criado_em: instanteHa(60) },
    { tipo: 'demanda', titulo: 'Levantar orçamentos de certificado digital', responsavel_id: ID_CAMILA, area_id: idDaArea('Financeiro'), prazo: dia(7), situacao: 'em_andamento', solicitante_pessoa_id: ID_KIMBERLY, resultado_esperado: 'Três orçamentos comparados' },
    { tipo: 'lembrete', titulo: 'Ligar para o banco sobre a conta da empresa', responsavel_id: ID_KIMBERLY, area_id: idDaArea('Financeiro'), aviso_em: instanteNoFuso(hoje, '15:00') },
    { titulo: 'Organizar a pasta de contratos no Drive', responsavel_id: ID_KIMBERLY, area_id: idDaArea('Gestão geral'), prazo: dia(2), prioridade: 'baixa', adiamentos: 2 },
    { titulo: 'Definir o preço da oferta anual', responsavel_id: ID_KIMBERLY, produtos: [ID_PRODUTO_KIPI, ID_PRODUTO_ZUPI], area_id: idDaArea('Comercial'), prazo: dia(14), prioridade: 'alta', participantes: [ID_CAMILA] },
    { titulo: 'Entregar a nova versão do logotipo do Mimo', responsavel_id: ID_BRUNA, produtos: [ID_PRODUTO_MIMO], area_id: idDaArea('Social media / Marketing'), prazo: dia(4), situacao: 'em_andamento', participantes: [ID_KIMBERLY] },
    { tipo: 'alerta', titulo: 'Exportar os dados da Central', responsavel_id: ID_CAMILA, area_id: idDaArea('Tecnologia'), prazo: hoje, prioridade: 'alta', origem_tipo: 'backup', alerta_motivo: 'Backup atrasado', alerta_data_referencia: hoje, alerta_acao: 'exportar_dados' },
    { titulo: 'Enviar o logotipo final do Zupi', responsavel_id: ID_BRUNA, produtos: [ID_PRODUTO_ZUPI], area_id: idDaArea('Social media / Marketing'), prazo: hoje, situacao: 'concluida', concluida_em: agora, concluida_por: ID_BRUNA },
    { titulo: 'Conferir as faturas de hospedagem', responsavel_id: ID_KIMBERLY, area_id: idDaArea('Financeiro'), prazo: dia(-1), situacao: 'concluida', concluida_em: agora, concluida_por: ID_KIMBERLY },
    { titulo: 'Atualizar a lista de fornecedores', responsavel_id: ID_CAMILA, area_id: idDaArea('Financeiro'), prazo: dia(-1), situacao: 'concluida', concluida_em: instanteHa(1), concluida_por: ID_CAMILA },
    { titulo: 'Testar outra plataforma de e-mail', responsavel_id: ID_KIMBERLY, area_id: idDaArea('Tecnologia'), situacao: 'cancelada', cancelada_motivo: 'Ficamos com a plataforma atual' },
  ];

  const ano = hoje.slice(0, 4);
  const atividade: Atividade[] = exemplos.map(({ produtos: _produtos, participantes: _participantes, ...dados }, indice) => ({
    ...controle(idDaAtividade(indice + 1), true, agora),
    codigo: montarCodigo('ATV', ano, indice + 1),
    tipo: 'tarefa',
    descricao: null,
    area_id: null,
    prioridade: 'normal',
    situacao: 'a_fazer',
    bloqueada: false,
    bloqueio_motivo: null,
    bloqueada_em: null,
    inicio: null,
    prazo: null,
    prazo_hora: null,
    aviso_em: null,
    solicitante_pessoa_id: null,
    solicitante_texto: null,
    resultado_esperado: null,
    aguardando_de_pessoa_id: null,
    aguardando_de_texto: null,
    aguardando_desde: null,
    acompanhamento_em: null,
    recorrencia_id: null,
    ocorrencia_numero: null,
    ocorrencia_data: null,
    editada_individualmente: false,
    origem_tipo: null,
    origem_id: null,
    alerta_motivo: null,
    alerta_data_referencia: null,
    alerta_acao: null,
    chave_idempotencia: null,
    adiamentos: 0,
    concluida_em: null,
    concluida_por: null,
    conclusao_nota: null,
    cancelada_motivo: null,
    dispensada_motivo: null,
    ...dados,
  }));

  let ligacao = 0;
  const atividade_produto: AtividadeProduto[] = exemplos.flatMap((exemplo, indice) => (exemplo.produtos ?? []).map((produto_id) => ({ ...controle(idDaLigacao(++ligacao), true, agora), atividade_id: idDaAtividade(indice + 1), produto_id })));
  const atividade_participante: AtividadeParticipante[] = exemplos.flatMap((exemplo, indice) => (exemplo.participantes ?? []).map((pessoa_id) => ({ ...controle(idDaLigacao(++ligacao), true, agora), atividade_id: idDaAtividade(indice + 1), pessoa_id })));

  const idDoTitulo = (titulo: string) => idDaAtividade(exemplos.findIndex((exemplo) => exemplo.titulo === titulo) + 1);
  const oferta = idDoTitulo('Definir o preço da oferta anual');
  const politica = idDoTitulo('Escrever a política de privacidade do Sobrevivência Urbana');
  const documentos = idDoTitulo('Confirmar os documentos para abrir a empresa');

  const item = (registro_id: string, ordem: number, texto: string, feito_por: string | null): ChecklistItem => ({ ...controle(idDaLigacao(++ligacao), true, agora), registro_tipo: 'atividade', registro_id, ordem, texto, responsavel_id: null, feito: Boolean(feito_por), feito_por, feito_em: feito_por ? agora : null });
  const checklist_item = [item(oferta, 0, 'Levantar o que os concorrentes cobram', ID_KIMBERLY), item(oferta, 1, 'Simular o desconto do plano anual', ID_CAMILA), item(oferta, 2, 'Conferir as taxas das lojas de aplicativos', null), item(oferta, 3, 'Fechar o preço com a Camila', null)];

  const nota = (registro_id: string, autor_id: string, texto: string, mencoes: string[], horasAtras: number): Comentario => ({ ...controle(idDaLigacao(++ligacao), true, agora), criado_em: new Date(new Date(agora).getTime() - horasAtras * 3_600_000).toISOString(), registro_tipo: 'atividade', registro_id, autor_id, texto, mencoes, editado_em: null, removido_em: null });
  const comentario = [nota(oferta, ID_CAMILA, 'Separei os preços dos concorrentes na planilha.', [], 26), nota(oferta, ID_KIMBERLY, '@camila, vamos fechar isso na reunião de sexta?', [ID_CAMILA], 3), nota(politica, ID_KIMBERLY, 'Só dá para terminar depois de definir quem assina.', [], 20)];

  const vinculo: Vinculo[] = [{ ...controle(idDaLigacao(++ligacao), true, agora), ...parDoVinculo({ tipo: 'atividade', id: documentos }, { tipo: 'contraparte', id: ID_CONTRAPARTE_CONTABILIDADE }) }];
  const anexo_link: AnexoLink[] = [{ ...controle(idDaLigacao(++ligacao), true, agora), registro_tipo: 'atividade', registro_id: oferta, titulo: 'Planilha de preços (exemplo)', url: 'https://docs.google.com/spreadsheets/d/exemplo' }];

  return { atividade, atividade_produto, atividade_participante, checklist_item, comentario, vinculo, anexo_link };
}
