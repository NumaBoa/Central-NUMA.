/**
 * Só para os testes do M12: um contrato assinado de verdade, pelo mesmo caminho das telas (proposta aceita →
 * contrato → assinatura), com item sob medida do Kipi, parcelas 50% na assinatura e 50% no aceite, e a
 * entrega 30 dias corridos após a assinatura. Usa o catálogo de exemplo do M07.
 */
import { CATEGORIAS_INICIAIS, ID_CAMILA, ID_KIMBERLY, ID_PRODUTO_KIPI } from '@/dados/exemplos/base';
import { repositorios } from '@/dados/repositorios';
import { carregarProposta, criarProposta, emitirProposta, formularioOportunidadeVazio, ITEM_VAZIO, registrarAceite, registrarEnvio, salvarItemDaProposta, salvarOportunidade, salvarVersaoDaProposta, salvarViabilidade } from './comercial';
import { aprovarParaEnvio, carregarContrato, converterPropostaEmContrato, definirSignatarios, emitirContrato, enviarParaRevisao, registrarAssinatura, registrarEnvioParaAssinatura, salvarRegraDePrazo, salvarVersao } from './contratos';
import { FORMULARIO_ENTIDADE_VAZIO, salvarEntidade } from './entidades';
import { ID_CANAL_DIRETO, ID_OFERTA_REVENDA } from './integracoes/catalogo-de-exemplo';
import { decidirValidacao, enviarParaValidacao } from './legal';
import { criarModelo, novoBloco, salvarEstruturaDoModelo } from './modelos';

export const DRIVE = 'https://drive.google.com/file/d/abc/view';
export const categoria = (nome: string) => CATEGORIAS_INICIAIS.find((item) => item.nome === nome)!.id;

async function modeloValidado(tipo: 'proposta' | 'contrato') {
  const modelo = await criarModelo({ nome: `Modelo de ${tipo}`, tipo_documento: tipo, familia: '' });
  const [versao] = await repositorios.modelo_versao.listar({ onde: { modelo_id: modelo.id } });
  const texto = tipo === 'proposta' ? 'Proposta {{proposta.codigo}} para {{contraparte.nome_ou_razao}}. Validade {{proposta.validade}}.' : 'Contrato {{contrato.codigo}} entre {{entidade.marca_comercial}} e {{contraparte.nome_ou_razao}}, com endereço em {{contraparte.endereco}}.';
  await salvarEstruturaDoModelo(versao!.id, { estrutura: [novoBloco('texto', { conteudo: texto }), novoBloco('tabela_itens')], cabecalho: '', observacoes: '', opcionais: [] });
  await enviarParaValidacao('modelo_versao', versao!.id);
  const pedido = (await repositorios.validacao.listar({ onde: { registro_id: versao!.id } }))[0]!;
  await decidirValidacao(pedido.id, 'validar', {});
  return versao!.id;
}

export async function contratoComImplantacao(hoje: string, { comViabilidade = true, horasNoItem = '20' } = {}) {
  const contraparte = await repositorios.contraparte.criar({ tipo_pessoa: 'pj', nome: 'Café Aurora Ltda', nome_fantasia: 'Café Aurora', documento: '11222333000181', documento_normalizado: '11222333000181', papeis: ['prospect'], site: null, email: 'contato@cafe.exemplo', telefone: null, endereco: { cep: '20000-000', logradouro: 'Rua A', numero: '1', complemento: null, bairro: 'Centro', cidade: 'Rio de Janeiro', uf: 'RJ' }, pais: 'BR', origem: 'indicacao', responsavel_id: ID_KIMBERLY, classe: 'int', observacoes: null, situacao: 'ativa' });
  const entidade = await salvarEntidade({ ...FORMULARIO_ENTIDADE_VAZIO, tipo_pessoa: 'socias_pf', nome: 'Kimberly e Camila', situacao: 'ativa', marca_comercial: 'Numa', licenciantes: [{ pessoa_id: ID_KIMBERLY, nome_civil: 'Kimberly Grebe', nacionalidade: 'brasileira', cpf: '111.444.777-35', endereco: 'Rua B, 2, Rio de Janeiro/RJ', email: 'k@exemplo.com', responsabilidade_pct: '50' }, { pessoa_id: ID_CAMILA, nome_civil: 'Camila Lima', nacionalidade: 'brasileira', cpf: '52998224725', endereco: 'Rua C, 3, Rio de Janeiro/RJ', email: 'c@exemplo.com', responsabilidade_pct: '50' }] });
  const oportunidade = await salvarOportunidade({ ...formularioOportunidadeVazio(ID_KIMBERLY, contraparte.id), titulo: 'Kipi para o Café Aurora', produtos: [ID_PRODUTO_KIPI] }, undefined, hoje);
  if (comViabilidade) await salvarViabilidade(oportunidade.id, { existe: 'O app Kipi', entregas: [{ descricao: 'Configurar a agenda do café', horas: '10', prazo_dias: '' }, { descricao: 'Treinar a equipe', horas: '6', prazo_dias: '' }], prazo_estimado_dias: '30', custo_estimado: '', capacidade: 'Camila, em novembro', riscos: '', conclusao: 'viavel', decididores: [ID_KIMBERLY], decidido_em: hoje });
  const proposta = await criarProposta(oportunidade.id, hoje);
  const fichaProposta = (await carregarProposta(proposta.id))!;
  await salvarVersaoDaProposta(fichaProposta.atual.id, { ...fichaProposta.atual, entidade_id: entidade.id, modelo_versao_id: await modeloValidado('proposta'), escopo_incluido: 'Agenda, cardápio e treinamento.', escopo_excluido: 'Integração com o caixa.' });
  await salvarItemDaProposta(fichaProposta.atual.id, { ...ITEM_VAZIO, oferta_id: ID_OFERTA_REVENDA, canal_id: ID_CANAL_DIRETO, periodicidade: 'mensal' }, undefined, hoje);
  await salvarItemDaProposta(fichaProposta.atual.id, { ...ITEM_VAZIO, tipo_item: 'sob_medida', produto_id: ID_PRODUTO_KIPI, descricao: 'Implantação assistida', valor_unitario: '2.000,00', justificativa_valor: 'Escopo da viabilidade', periodicidade: 'unica', horas_estimadas: horasNoItem }, undefined, hoje);
  await emitirProposta(proposta.id, true, {}, hoje);
  await registrarEnvio(fichaProposta.atual.id, { data: hoje, canal: 'E-mail', para: 'contato@cafe.exemplo', evidencia: '' }, hoje);
  await registrarAceite(fichaProposta.atual.id, { data: hoje, forma: 'email', evidencia: DRIVE }, hoje);
  const { contrato } = await converterPropostaEmContrato(proposta.id);
  const ficha = (await carregarContrato(contrato.id, hoje))!;
  await salvarVersao(ficha.atual.id, { modelo_versao_id: await modeloValidado('contrato'), vigencia_duracao_meses: 12, vigencia_inicio_evento: 'assinatura', vigencia_inicio: null, condicoes: { ...ficha.atual.condicoes, forma_pagamento: 'pix', dia_vencimento: 10, renovacao_tipo: 'mediante_aditivo', aviso_previo_dias: 30, aceite_criterios: 'Agenda funcionando no celular da equipe.', aceite_prazo_dias: 5, parcelas: [{ percentual: 50, gatilho: 'evento', data: null, evento: 'Assinatura' }, { percentual: 50, gatilho: 'evento', data: null, evento: 'Aceite' }] } }, hoje);
  await salvarRegraDePrazo(ficha.atual.id, { nome: 'Entrega do Kipi', uso: 'entrega', produto_id: ID_PRODUTO_KIPI, evento_referencia: 'assinatura', evento_nome: null, data_fixa: null, duracao: 30, unidade: 'dias_corridos', excecao_justificativa: null });
  await definirSignatarios(ficha.atual.id, 'numa', [ID_KIMBERLY]);
  const representante = await repositorios.pessoa.criar({ nome_completo: 'Ana do Café', nome_exibicao: null, tipo: 'externa', eh_socia: false, contraparte_id: contrato.contraparte_id, papeis_contato: [], funcao: null, email: null, telefone: null, cpf: null, observacoes: null, situacao: 'ativa' });
  await definirSignatarios(ficha.atual.id, 'contraparte', [representante.id]);
  await enviarParaRevisao(contrato.id, hoje);
  await emitirContrato(contrato.id, true, {}, hoje);
  await aprovarParaEnvio(contrato.id, hoje);
  await registrarEnvioParaAssinatura(contrato.id, { data: hoje, canal: 'E-mail', destinatarios: 'ana' }, hoje);
  const signatarios = (await carregarContrato(contrato.id, hoje))!.signatarios;
  await registrarAssinatura(contrato.id, { datas: Object.fromEntries(signatarios.map((linha) => [linha.id, hoje])), arquivoUrl: DRIVE, evidenciaUrl: DRIVE }, hoje);
  return (await carregarContrato(contrato.id, hoje))!;
}
