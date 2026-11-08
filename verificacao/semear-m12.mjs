// Dados de teste das suítes do M12: um contrato assinado mínimo (versão publicada, item sob medida do Kipi,
// entrega 30 dias corridos após a assinatura, evento Assinatura hoje), gravado direto nas tabelas, no formato
// dos esquemas. Não é carga da Central: só existe dentro do Chrome da suíte.
export const ID_KIPI = 'c4e2a3f6-9d51-4c32-8e23-2b3c4d5e6f03';
export const ID_CONTRATO = '7e000000-0000-4000-8000-000000000001';
export const ID_VERSAO = '7e000000-0000-4000-8000-000000000002';
export const ID_KIMBERLY = '0b7f1c52-3f6e-4a1b-9d2c-5e8a7c4f1a01';
export const ID_CONTRAPARTE = 'e6a4c5b8-bf73-4e54-8a45-4d5e6f7a8b01';
export const ID_OFERTA = '7e000000-0000-4000-8000-000000000007';
const ID_ENTIDADE = 'd5f3b4a7-ae62-4d43-9f34-3c4d5e6f7a01';
const DRIVE = 'https://drive.google.com/file/d/abc/view';

/** JavaScript para rodar na página: acrescenta o contrato, se ainda não estiver lá. */
export function scriptDoContrato(hoje) {
  const agora = new Date().toISOString();
  const controle = (id) => ({ id, criado_em: agora, criado_por: null, atualizado_em: agora, atualizado_por: null, arquivado_em: null, arquivado_por: null, versao_registro: 1, exemplo: false });
  const condicoes = { forma_pagamento: 'pix', dia_vencimento: 10, parcelas: [], multa_atraso: null, juros_mes: null, fidelidade_meses: null, fidelidade_motivo: null, multa_rescisoria: null, reajuste_indice: null, reajuste_periodicidade_meses: null, reajuste_aviso_dias: null, renovacao_tipo: 'sem_renovacao', renovacao_periodo_meses: null, aviso_previo_dias: null, aceite_criterios: 'Agenda funcionando no celular da equipe.', aceite_prazo_dias: 5 };
  const tabelas = {
    contrato: [{ ...controle(ID_CONTRATO), codigo: 'CTR-2026-0901', titulo: 'Kipi para o Café Aurora', familia: 'cliente_negociado', tipo: 'implantacao', entidade_id: ID_ENTIDADE, contraparte_id: ID_CONTRAPARTE, responsavel_id: ID_KIMBERLY, participantes: [], proposta_versao_id: null, moeda: 'BRL', situacao_documental: 'assinado', renovacao_situacao: 'nao_se_aplica', versao_vigente_id: ID_VERSAO, versao_elaboracao_id: null, classe: 'doc', saas: false, suspensao: null, vigencia_prorrogada_ate: null, encerrado_em: null, encerramento_motivo: null, cancelado_motivo: null, administrativo: { endereco_correspondencia: null, dados_bancarios: null, observacoes: null } }],
    contrato_versao: [{ ...controle(ID_VERSAO), contrato_id: ID_CONTRATO, numero: 1, tipo: 'original', situacao: 'publicada', fluxo: 'assinado', representante_contraparte_id: null, data_efeito: hoje, retroatividade_justificativa: null, resumo_mudancas: null, vigencia_inicio: null, vigencia_inicio_evento: 'assinatura', vigencia_inicio_evento_nome: null, vigencia_fim: null, vigencia_duracao_meses: 12, vigencia_indeterminada: false, condicoes, dados_saas: null, modelo_versao_id: null, snapshot: null, aprovada_envio_por: null, aprovada_envio_em: null, enviada_em: null, enviada_canal: null, enviada_destinatarios: null, enviada_documento_id: null, assinado_arquivo_url: DRIVE, assinatura_evidencia_url: DRIVE, assinatura_confirmada_por: null, assinatura_confirmada_em: null, publicada_em: agora, publicada_por: null, devolucao_motivo: null, recusa_motivo: null }],
    item_contrato: [{ ...controle('7e000000-0000-4000-8000-000000000003'), versao_id: ID_VERSAO, produto_id: ID_KIPI, tipo_item: 'sob_medida', oferta_id: null, preco_versao_id: null, canal_id: null, descricao: 'Implantação assistida', quantidade: 1, valor_unitario: 2000, justificativa_valor: 'Escopo combinado', desconto_percentual: null, desconto: null, desconto_justificativa: null, desconto_por: null, desconto_em: null, valor_total: 2000, recorrente: false, periodicidade: 'unica', inicio: null, fim: null, item_origem_id: null, proposta_item_id: null, ordem: 0 }, { ...controle('7e000000-0000-4000-8000-000000000006'), versao_id: ID_VERSAO, produto_id: ID_KIPI, tipo_item: 'oferta', oferta_id: ID_OFERTA, preco_versao_id: null, canal_id: null, descricao: 'Kipi Equipe', quantidade: 1, valor_unitario: 99, justificativa_valor: null, desconto_percentual: null, desconto: null, desconto_justificativa: null, desconto_por: null, desconto_em: null, valor_total: 99, recorrente: true, periodicidade: 'mensal', inicio: null, fim: null, item_origem_id: null, proposta_item_id: null, ordem: 1 }],
    oferta: [{ ...controle(ID_OFERTA), codigo: 'OFE-2026-0901', produto_id: ID_KIPI, nome: 'Kipi Equipe', tipo: 'assinatura', publico: 'b2b', descricao: null, formalizacao: 'ambos', periodicidade: 'mensal', exclusoes: null, sla_regra_id: null, situacao: 'aprovada', regras_uso: null, suporte_canal: 'E-mail e WhatsApp', suporte_horario: 'dias úteis, das 9h às 18h', suporte_prazo_critico: 'até 4 horas úteis', suporte_prazo_normal: 'até 2 dias úteis', disponibilidade_meta: 99.5, disponibilidade_compensacao: '10% da mensalidade do mês', teste_dias: null, adicionais_ids: [] }],
    regra_prazo: [{ ...controle('7e000000-0000-4000-8000-000000000004'), versao_id: ID_VERSAO, nome: 'Entrega do Kipi', uso: 'entrega', produto_id: ID_KIPI, evento_referencia: 'assinatura', evento_nome: null, data_fixa: null, duracao: 30, unidade: 'dias_corridos', excecao_justificativa: null }],
    evento_contrato: [{ ...controle('7e000000-0000-4000-8000-000000000005'), contrato_id: ID_CONTRATO, tipo: 'assinatura', nome: null, produto_id: null, data: hoje, confirmado_por: ID_KIMBERLY, evidencia_url: DRIVE, observacao: null, corrigido_de: null, correcao_motivo: null }],
  };
  return `(()=>{const t=${JSON.stringify(tabelas)};for(const [nome,linhas] of Object.entries(t)){const k='numa-central:v1:'+nome;const atuais=JSON.parse(localStorage.getItem(k)||'[]');for(const linha of linhas)if(!atuais.some(a=>a.id===linha.id))atuais.push(linha);localStorage.setItem(k,JSON.stringify(atuais))}})()`;
}

/** As regras de SLA da oferta: normal 4 h / 16 h e crítica 1 h / 4 h, em horas úteis, 9h–18h. */
export function scriptDasRegras() {
  const agora = new Date().toISOString();
  const linha = (id, prioridade, resposta, resolucao) => ({ id, criado_em: agora, criado_por: null, atualizado_em: agora, atualizado_por: null, arquivado_em: null, arquivado_por: null, versao_registro: 1, exemplo: false, oferta_id: ID_OFERTA, contrato_id: null, prioridade, resposta_horas: resposta, resolucao_horas: resolucao, contagem: 'horas_uteis', horario_inicio: '09:00', horario_fim: '18:00', disponibilidade_minima: null, creditos: null });
  const regras = [linha('7e000000-0000-4000-8000-000000000011', 'normal', 4, 16), linha('7e000000-0000-4000-8000-000000000012', 'critica', 1, 4)];
  return `(()=>{const k='numa-central:v1:sla_regra';const atuais=JSON.parse(localStorage.getItem(k)||'[]');for(const r of ${JSON.stringify(regras)})if(!atuais.some(a=>a.id===r.id))atuais.push(r);localStorage.setItem(k,JSON.stringify(atuais))})()`;
}

/** Hoje + n dias, em aaaa-mm-dd. */
export const somarDias = (dia, dias) => {
  const data = new Date(`${dia}T12:00:00Z`);
  data.setUTCDate(data.getUTCDate() + dias);
  return data.toISOString().slice(0, 10);
};

export const diaBr = (dia) => dia.split('-').reverse().join('/');
