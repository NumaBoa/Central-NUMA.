/**
 * T11.14 (19-M11): o contrato de assinatura a partir de `MOD-SAAS-LIC`. Ninguém edita o texto jurídico para
 * gerar um contrato: o que muda vem da configuração do produto (T07.10), da oferta e do preço (M07) e dos
 * dados do cliente. O preço não é digitado (RN-11.31), e o modelo segue em rascunho até o parecer jurídico.
 */
import { ErroDeRegra } from '@/dados/erros';
import { ID_MODELO_SAAS } from '@/dados/carga-f1';
import { repositorios } from '@/dados/repositorios';
import { idDaPessoaAtual } from '@/dados/sessao';
import { emTransacao } from '@/dados/transacao';
import type { Contrato, DadosSaas } from '@/dados/tipos/contrato';
import type { ModeloVersao } from '@/dados/tipos/legal';
import { hojeISO } from '@/lib/datas';
import { formatarDiaISO, formatarDinheiro } from '@/lib/formatacao';
import { carregarContrato, criarContrato, pendenciasDoContrato, type FichaDoContrato } from './contratos';
import { dadosDaContraparteNoModelo, dadosDaEntidadeNoModelo, dataPorExtenso } from './documentos-emitidos';
import { carregarDocumentosLegais, criarDocumentoLegal, documentosFaltandoNoProduto, ROTULOS_TIPO_DOCUMENTO_LEGAL } from './legal';
import { textoDoEncarregado } from './legal-configuracao';
import { camposVaziosDaConfiguracao, MENSAGEM_CATALOGO_AUSENTE, precoVigente, textoDoLimite, type CanalDoCatalogo, type ConfiguracaoContratual, type OfertaDoCatalogo, type PrecoDoCatalogo } from './integracoes/catalogo-comercial';
import { catalogoComercial } from './integracoes/conexoes';
import { renderizarVersao } from './modelos';
import type { Pendencia } from './pendencias';
import { textoDoDocumento } from './modelo-texto';

export const MODALIDADES = ['Navegador', 'Android', 'iOS'] as const;
const TEXTO_MODALIDADE: Readonly<Record<string, string>> = { Navegador: 'navegador de internet', Android: 'aplicativo Android', iOS: 'aplicativo iOS' };

export function dadosSaasPadrao(hoje: string, { teste = null, cidade = null }: { teste?: number | null; cidade?: string | null } = {}): DadosSaas {
  return { produto_id: null, oferta_id: null, periodicidade: null, canal_id: null, adicionais: [], condicao_especial: null, modalidades: [], data_inicio: hoje, data_inicio_justificativa: null, forma_pagamento_texto: 'Pix', vencimento_texto: null, dia_vencimento: null, teste_dias: teste, garantia_dias: 7, multa_atraso_pct: 2, juros_mes_pct: 1, suspensao_dias_atraso: 10, aviso_suspensao_dias: 3, cancelamento_dias_atraso: 60, reajuste_indice: 'IPCA', reajuste_aviso_dias: 30, fidelidade_meses: null, fidelidade_motivo: null, multa_rescisoria_texto: null, limite_responsabilidade_meses: null, limite_responsabilidade_justificativa: null, relacao_nao_consumo: false, foro: cidade, local: cidade, forma_assinatura: 'Eletrônica', plataforma_assinatura: null, signatarios_licenciante: [], testemunha1_nome: null, testemunha1_cpf: null, testemunha2_nome: null, testemunha2_cpf: null, justificativas_padrao: null };
}

/** Os padrões de 19 §5, etapa 3: mudar um deles pede justificativa, que aparece na revisão. */
const PADROES: Partial<Record<keyof DadosSaas, unknown>> = { garantia_dias: 7, multa_atraso_pct: 2, juros_mes_pct: 1, suspensao_dias_atraso: 10, aviso_suspensao_dias: 3, cancelamento_dias_atraso: 60, reajuste_indice: 'IPCA', reajuste_aviso_dias: 30 };

export function padroesAlterados(dados: DadosSaas): string[] {
  return (Object.entries(PADROES) as [keyof DadosSaas, unknown][]).filter(([campo, valor]) => dados[campo] !== null && dados[campo] !== valor).map(([campo]) => campo);
}

/** RN-11.33 e CA-11.16: os limites legais, com o motivo na mensagem. Valem para salvar, não só para emitir. */
export function errosDosLimites(dados: DadosSaas, { contrapartePj, hoje }: { contrapartePj: boolean; hoje: string }): Partial<Record<keyof DadosSaas, string>> {
  const erros: Partial<Record<keyof DadosSaas, string>> = {};
  if (dados.garantia_dias !== null && dados.garantia_dias < 7) erros.garantia_dias = 'Mínimo de 7 dias (CDC, art. 49).';
  if (dados.multa_atraso_pct !== null && dados.multa_atraso_pct > 2) erros.multa_atraso_pct = 'Máximo de 2% (CDC, art. 52, §1º)';
  if (dados.juros_mes_pct !== null && dados.juros_mes_pct > 1) erros.juros_mes_pct = 'Máximo de 1% ao mês.';
  if (dados.teste_dias !== null && (dados.teste_dias < 0 || dados.teste_dias > 30)) erros.teste_dias = 'O teste vai de 0 a 30 dias.';
  if (dados.suspensao_dias_atraso !== null && dados.suspensao_dias_atraso < 5) erros.suspensao_dias_atraso = 'Suspender só depois de pelo menos 5 dias de atraso.';
  if (dados.aviso_suspensao_dias !== null && dados.aviso_suspensao_dias < 2) erros.aviso_suspensao_dias = 'Avise com pelo menos 2 dias antes de suspender.';
  if (dados.cancelamento_dias_atraso !== null && dados.suspensao_dias_atraso !== null && dados.cancelamento_dias_atraso <= dados.suspensao_dias_atraso) erros.cancelamento_dias_atraso = 'O cancelamento vem depois da suspensão.';
  if (dados.reajuste_aviso_dias !== null && dados.reajuste_aviso_dias < 30) erros.reajuste_aviso_dias = 'Aviso de reajuste de pelo menos 30 dias.';
  if (dados.dia_vencimento !== null && (dados.dia_vencimento < 1 || dados.dia_vencimento > 28)) erros.dia_vencimento = 'Use um dia de 1 a 28.';
  if (dados.fidelidade_meses && !dados.fidelidade_motivo?.trim()) erros.fidelidade_motivo = 'Fidelidade só com motivo (contrapartida).';
  if (dados.fidelidade_meses && !dados.multa_rescisoria_texto?.trim()) erros.multa_rescisoria_texto = 'Diga a multa, proporcional ao tempo restante.';
  if (dados.limite_responsabilidade_meses) {
    if (!contrapartePj || !dados.relacao_nao_consumo) erros.limite_responsabilidade_meses = 'Limite de responsabilidade só para contraparte PJ em relação que não é de consumo.';
    else if (!dados.limite_responsabilidade_justificativa?.trim()) erros.limite_responsabilidade_justificativa = 'Justifique o limite de responsabilidade.';
  }
  if (dados.data_inicio && dados.data_inicio < hoje && !dados.data_inicio_justificativa?.trim()) erros.data_inicio_justificativa = 'Início antes de hoje exige justificativa.';
  if (dados.condicao_especial) {
    if (dados.condicao_especial.valor === null) erros.condicao_especial = 'Informe o valor da condição especial.';
    else if (!dados.condicao_especial.duracao_meses) erros.condicao_especial = 'Informe a duração da condição especial, em meses.';
    else if (!dados.condicao_especial.motivo?.trim()) erros.condicao_especial = 'Diga o motivo da condição especial.';
  }
  if (dados.forma_assinatura === 'Eletrônica' && !dados.plataforma_assinatura?.trim()) erros.plataforma_assinatura = 'Diga a plataforma de assinatura.';
  if (dados.forma_assinatura === 'Manuscrita' && (!dados.testemunha1_nome || !dados.testemunha1_cpf || !dados.testemunha2_nome || !dados.testemunha2_cpf)) erros.testemunha1_nome = 'Assinatura manuscrita pede duas testemunhas, com nome e CPF.';
  return erros;
}

/** O modelo usado: a última versão Validada; sem ela, a última, com o aviso (19 §5, etapa 1). */
export async function modeloSaasParaEmissao(): Promise<{ versao: ModeloVersao | null; validado: boolean }> {
  const versoes = (await repositorios.modelo_versao.listar({ onde: { modelo_id: ID_MODELO_SAAS } })).sort((a, b) => b.numero - a.numero);
  const validada = versoes.find((versao) => versao.situacao === 'validada');
  return { versao: validada ?? versoes[0] ?? null, validado: Boolean(validada) };
}

export type CatalogoDoContrato = { oferta: OfertaDoCatalogo | null; preco: PrecoDoCatalogo | null; canal: CanalDoCatalogo | null; configuracao: ConfiguracaoContratual | null; configuracaoRecente: ConfiguracaoContratual | null; adicionais: { oferta: OfertaDoCatalogo; preco: PrecoDoCatalogo | null; quantidade: number }[] };

export async function catalogoDoContrato(dados: DadosSaas, hoje: string): Promise<CatalogoDoContrato> {
  const catalogo = catalogoComercial();
  const naData = dados.data_inicio ?? hoje;
  const oferta = dados.oferta_id ? await catalogo.oferta(dados.oferta_id) : null;
  const preco = oferta ? precoVigente(await catalogo.precosDaOferta(oferta.id), { canalId: dados.canal_id, periodicidade: dados.periodicidade, naData }) : null;
  const canal = dados.canal_id ? ((await catalogo.canais()).find((item) => item.id === dados.canal_id) ?? null) : null;
  const [configuracao, configuracaoRecente] = dados.produto_id ? await Promise.all([catalogo.configuracaoValidada(dados.produto_id), catalogo.configuracaoMaisRecente(dados.produto_id)]) : [null, null];
  const adicionais = [];
  for (const adicional of dados.adicionais) {
    const ofertaAdicional = await catalogo.oferta(adicional.oferta_id);
    if (ofertaAdicional) adicionais.push({ oferta: ofertaAdicional, preco: precoVigente(await catalogo.precosDaOferta(ofertaAdicional.id), { canalId: dados.canal_id, periodicidade: dados.periodicidade, naData }), quantidade: adicional.quantidade });
  }
  return { oferta, preco, canal, configuracao, configuracaoRecente, adicionais };
}

const periodoTexto = (periodicidade: DadosSaas['periodicidade']) => (periodicidade === 'anual' ? 'ano' : periodicidade === 'mensal' ? 'mês' : null);
const dinheiro = (valor: number | null | undefined) => (valor === null || valor === undefined ? null : formatarDinheiro(valor, 'BRL'));
const decimal = (valor: number | null) => (valor === null ? null : valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 }));

export function modalidadesEmTexto(modalidades: readonly string[]): string | null {
  const nomes = modalidades.map((item) => TEXTO_MODALIDADE[item] ?? item);
  if (!nomes.length) return null;
  return nomes.length === 1 ? (nomes[0] as string) : `${nomes.slice(0, -1).join(', ')} e ${nomes.at(-1)}`;
}

/** As variáveis de 19 §6, resolvidas. Vazio continua vazio: a prévia realça e a emissão final bloqueia. */
export async function dadosDoModeloSaas(ficha: FichaDoContrato, catalogo: CatalogoDoContrato, hoje: string) {
  const dados = ficha.atual.dados_saas as DadosSaas;
  const [licenciantes, socias, representantes, pessoas, valores, produto] = await Promise.all([repositorios.entidade_licenciante.listar({ onde: { entidade_id: ficha.contrato.entidade_id } }), repositorios.entidade_socias.listar({ onde: { entidade_id: ficha.contrato.entidade_id } }), repositorios.entidade_representante.listar({ onde: { entidade_id: ficha.contrato.entidade_id } }), repositorios.pessoa.listar({ incluirArquivados: true }), repositorios.configuracao.ler(), dados.produto_id ? repositorios.produto.obter(dados.produto_id) : null]);
  const pessoa = (id: string | null) => pessoas.find((item) => item.id === id) ?? null;
  const { oferta, preco, canal, configuracao: config, adicionais } = catalogo;
  const total = preco?.valor !== null && preco?.valor !== undefined ? adicionais.reduce<number | null>((soma, adicional) => (soma === null || adicional.preco?.valor === null || adicional.preco?.valor === undefined ? null : soma + adicional.preco.valor * adicional.quantidade), preco.valor) : null;
  const especial = dados.condicao_especial;
  return {
    modelo: { codigo: 'MOD-SAAS-LIC', versao: (await modeloSaasParaEmissao()).versao?.rotulo_versao ?? null },
    contrato: {
      codigo: ficha.contrato.codigo,
      data_inicio: dados.data_inicio ? formatarDiaISO(dados.data_inicio) : null,
      data_emissao_extenso: dataPorExtenso(hoje),
      periodicidade: dados.periodicidade,
      periodicidade_texto: periodoTexto(dados.periodicidade),
      valor_formatado: dinheiro(preco?.valor),
      adicionais: adicionais.map((adicional) => ({ nome: adicional.oferta.nome, quantidade: adicional.quantidade, valor_formatado: dinheiro(adicional.preco?.valor === null || adicional.preco?.valor === undefined ? null : adicional.preco.valor * adicional.quantidade) })),
      total_periodo_formatado: dinheiro(total),
      condicao_especial: especial ? { valor_formatado: dinheiro(especial.valor), duracao_texto: especial.duracao_meses ? `${especial.duracao_meses} ${especial.duracao_meses === 1 ? 'mês' : 'meses'}` : null, motivo: especial.motivo } : null,
      modalidades: dados.modalidades,
      modalidades_texto: modalidadesEmTexto(dados.modalidades),
      canal_cobranca: canal?.cobranca ?? null,
      gateway_nome: canal?.gateway_nome ?? null,
      forma_pagamento_texto: dados.forma_pagamento_texto,
      vencimento_texto: dados.vencimento_texto ?? (dados.dia_vencimento ? `todo dia ${dados.dia_vencimento}` : 'na data de renovação de cada Período'),
      teste_dias: dados.teste_dias,
      garantia_dias: dados.garantia_dias,
      multa_atraso_pct: decimal(dados.multa_atraso_pct),
      juros_mes_pct: decimal(dados.juros_mes_pct),
      suspensao_dias_atraso: dados.suspensao_dias_atraso,
      aviso_suspensao_dias: dados.aviso_suspensao_dias,
      cancelamento_dias_atraso: dados.cancelamento_dias_atraso,
      reajuste_indice: dados.reajuste_indice,
      reajuste_aviso_dias: dados.reajuste_aviso_dias,
      fidelidade_meses: dados.fidelidade_meses,
      fidelidade_motivo: dados.fidelidade_motivo,
      multa_rescisoria_texto: dados.multa_rescisoria_texto,
      limite_responsabilidade: Boolean(dados.limite_responsabilidade_meses),
      limite_responsabilidade_meses: dados.limite_responsabilidade_meses,
      foro: dados.foro,
      local: dados.local,
      forma_assinatura: dados.forma_assinatura,
      plataforma_assinatura: dados.plataforma_assinatura,
      signatarios_licenciante: ficha.signatarios.filter((linha) => linha.parte === 'numa').map((linha) => {
        const socia = licenciantes.find((item) => item.pessoa_id === linha.pessoa_id);
        const quem = pessoa(linha.pessoa_id);
        return { nome: socia?.nome_civil ?? quem?.nome_completo ?? null, cpf: socia?.cpf ? socia.cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4') : (quem?.cpf ?? null), papel: socia ? 'Licenciante' : (quem?.funcao ?? 'Representante') };
      }),
      testemunha1: { nome: dados.testemunha1_nome, cpf: dados.testemunha1_cpf },
      testemunha2: { nome: dados.testemunha2_nome, cpf: dados.testemunha2_cpf },
    },
    entidade: dadosDaEntidadeNoModelo(ficha.entidade, licenciantes, socias[0]?.marca_comercial ?? null, pessoas.filter((item) => representantes.some((ligacao) => ligacao.pessoa_id === item.id))),
    contraparte: dadosDaContraparteNoModelo(ficha.contraparte, pessoa(ficha.atual.representante_contraparte_id)),
    produto: {
      nome: produto?.nome ?? null,
      nome_maiusculo: config?.nome_maiusculo ?? null,
      descricao_contratual: config?.descricao_contratual ?? null,
      funcoes_de_apoio: config?.funcoes_de_apoio ?? null,
      plano_apos_teste: config?.plano_apos_teste ?? null,
      url_termos: config?.url_termos ?? null,
      url_privacidade: config?.url_privacidade ?? null,
      url_ajuda: config?.url_ajuda ?? null,
      contrato: config ? { ...config, formatos_exportacao: config.formatos_exportacao.join(', ') || null, suboperadores: config.suboperadores } : {},
    },
    oferta: oferta ? { nome: oferta.nome, descricao: oferta.descricao, exclusoes: oferta.exclusoes, regras_uso: oferta.regras_uso, suporte: oferta.suporte ?? {}, disponibilidade_meta: oferta.disponibilidade_meta, disponibilidade_compensacao: oferta.disponibilidade_compensacao, recursos: [...oferta.recursos].sort((a, b) => a.ordem - b.ordem).map((recurso) => ({ nome: recurso.nome, incluido_texto: recurso.incluido ? 'Incluído' : 'Não incluído', limite_texto: recurso.incluido ? textoDoLimite(recurso.limite) || null : 'Não incluído' })) } : {},
    organizacao: { encarregado_texto: textoDoEncarregado(valores, pessoas) },
  };
}

/** RN-11.35 (a) a (g), com o caminho para corrigir. Junta as pendências comuns do contrato (T11.04). */
export async function pendenciasSaas(ficha: FichaDoContrato, catalogo: CatalogoDoContrato, hoje: string): Promise<Pendencia[]> {
  const dados = ficha.atual.dados_saas as DadosSaas;
  const pendencias = await pendenciasDoContrato(ficha, hoje);
  const bloqueia = (id: string, mensagem: string, etapa: string, href?: string) => pendencias.push({ id, mensagem, tipo: 'bloqueia', bloqueia: 'emissão final', etapa, ...(href ? { href } : {}) });
  const avisa = (id: string, mensagem: string, etapa: string) => pendencias.push({ id, mensagem, tipo: 'aviso', etapa });
  if (catalogoComercial().estado === 'ausente') bloqueia('catalogo', MENSAGEM_CATALOGO_AUSENTE, 'plano');
  if (!dados.produto_id) bloqueia('produto', 'Escolha o produto.', 'produto');
  else if (!catalogo.configuracao) bloqueia('config', catalogo.configuracaoRecente ? `Configuração contratual do produto em ${catalogo.configuracaoRecente.situacao === 'rascunho' ? 'Rascunho' : 'validação'}: a emissão final exige versão Validada (CA-11.15). Fica em Produto › Contrato (T07.10).` : 'O produto não tem configuração contratual validada (T07.10, Produto › Contrato).', 'produto', `/configuracoes/cadastros/marcas/produtos/${dados.produto_id}`);
  else for (const campo of camposVaziosDaConfiguracao(catalogo.configuracao)) bloqueia(`config-${campo}`, `Configuração do produto sem ${campo} (RN-11.35 g).`, 'produto', `/configuracoes/cadastros/marcas/produtos/${dados.produto_id}`);
  if (!dados.oferta_id) bloqueia('oferta', 'Escolha o plano.', 'plano');
  else if (!catalogo.oferta || catalogo.oferta.situacao !== 'aprovada') bloqueia('oferta-aprovada', 'O plano não está Aprovado no catálogo.', 'plano');
  else if (catalogo.oferta.tipo !== 'assinatura') bloqueia('oferta-tipo', 'Só plano do tipo Assinatura gera contrato; Gratuidade não.', 'plano');
  if (!dados.periodicidade) bloqueia('periodicidade', 'Escolha a periodicidade.', 'plano');
  if (!dados.canal_id) bloqueia('canal', 'Escolha o canal de cobrança.', 'plano');
  if (dados.oferta_id && dados.periodicidade && dados.canal_id && (!catalogo.preco || catalogo.preco.valor === null)) bloqueia('preco', 'Sem preço Aprovado vigente para este plano, canal e periodicidade. O valor não é digitado (RN-11.31).', 'plano');
  for (const adicional of catalogo.adicionais) if (!adicional.preco || adicional.preco.valor === null) bloqueia(`adicional-${adicional.oferta.id}`, `${adicional.oferta.nome}: sem preço aprovado.`, 'plano');
  for (const recurso of catalogo.oferta?.recursos ?? []) if (recurso.incluido && recurso.limite.tipo === 'nao_informado') bloqueia(`limite-${recurso.id}`, `Limite de “${recurso.nome}” não informado na oferta. Vazio não é ilimitado.`, 'plano');
  if (!dados.modalidades.length) bloqueia('modalidades', 'Escolha pelo menos uma modalidade de acesso.', 'plano');
  else if (catalogo.configuracao && dados.modalidades.some((item) => !catalogo.configuracao?.modalidades.includes(item as never))) bloqueia('modalidades-produto', 'Há modalidade que o produto não oferece.', 'plano');
  if (dados.periodicidade === 'anual' && catalogo.configuracao && catalogo.configuracao.aviso_renovacao_anual_dias === null) bloqueia('aviso-anual', 'Plano anual pede o aviso de renovação anual na configuração do produto.', 'produto');
  if (dados.produto_id) {
    const produto = await repositorios.produto.obter(dados.produto_id);
    const { documentos } = await carregarDocumentosLegais();
    if (produto) for (const tipo of documentosFaltandoNoProduto(produto, documentos)) bloqueia(`legal-${tipo}`, `${ROTULOS_TIPO_DOCUMENTO_LEGAL[tipo]} do produto não está Publicado (RN-09.02).`, 'produto', '/legal');
  }
  const limites = errosDosLimites(dados, { contrapartePj: ficha.contraparte?.tipo_pessoa === 'pj', hoje });
  for (const [campo, mensagem] of Object.entries(limites)) bloqueia(`limite-${campo}`, mensagem as string, campo.startsWith('testemunha') || campo === 'plataforma_assinatura' ? 'assinatura' : campo === 'condicao_especial' ? 'plano' : 'condicoes');
  if (padroesAlterados(dados).length && !dados.justificativas_padrao?.trim()) bloqueia('justificativa-padrao', 'Mudou um padrão das condições: escreva a justificativa.', 'condicoes');
  if (!dados.forma_assinatura) bloqueia('forma', 'Escolha a forma de assinatura.', 'assinatura');
  const { validado } = await modeloSaasParaEmissao();
  if (!validado) avisa('modelo-saas', 'MOD-SAAS-LIC v2.0 é rascunho para validação jurídica: a emissão final pede confirmação e motivo (RN-09.13).', 'revisao');
  return pendencias;
}

export async function montarDocumentoSaas(ficha: FichaDoContrato, hoje: string = hojeISO()) {
  const dadosSaas = ficha.atual.dados_saas;
  if (!dadosSaas) throw new ErroDeRegra('Este contrato não tem os dados da assinatura.');
  const catalogo = await catalogoDoContrato(dadosSaas, hoje);
  const pendencias = await pendenciasSaas(ficha, catalogo, hoje);
  const dados = await dadosDoModeloSaas(ficha, catalogo, hoje);
  const { versao } = await modeloSaasParaEmissao();
  if (!versao) return { nos: [], dados, faltando: [], pendencias };
  const documento = renderizarVersao(versao, [], dados);
  for (const nome of documento.faltando) pendencias.push({ id: `var-${nome}`, mensagem: `Variável obrigatória vazia: ${nome}.`, tipo: 'bloqueia', bloqueia: 'emissão final', etapa: 'revisao' });
  return { nos: documento.nos, dados: { ...dados, referencias: { configuracao: catalogo.configuracao ? { id: catalogo.configuracao.id, versao: catalogo.configuracao.versao } : null, preco: catalogo.preco ? { id: catalogo.preco.id, versao: catalogo.preco.versao } : null, modelo_versao_id: versao.id } }, faltando: documento.faltando, pendencias };
}

/** T11.14: cria o contrato comum de M11, com o modelo SaaS e os padrões. */
export async function criarContratoSaas({ titulo, familia, entidadeId, contraparteId, responsavelId }: { titulo: string; familia: 'cliente_negociado' | 'adesao_condicao_especial'; entidadeId: string; contraparteId: string; responsavelId: string }, hoje: string = hojeISO()): Promise<Contrato> {
  const entidade = await repositorios.entidade.obter(entidadeId);
  const { versao } = await modeloSaasParaEmissao();
  const contrato = await criarContrato({ titulo, familia, tipo: 'assinatura', entidade_id: entidadeId, contraparte_id: contraparteId, responsavel_id: responsavelId, participantes: [] }, { saas: true, dadosSaas: dadosSaasPadrao(hoje, { cidade: entidade?.endereco?.cidade && entidade.endereco.uf ? `${entidade.endereco.cidade}/${entidade.endereco.uf}` : null }) });
  await repositorios.contrato_versao.atualizar(contrato.versao_elaboracao_id as string, { modelo_versao_id: versao?.id ?? null, vigencia_indeterminada: true, vigencia_inicio_evento: 'data_fixa', vigencia_inicio: hoje, condicoes: { ...(await repositorios.contrato_versao.obter(contrato.versao_elaboracao_id as string))!.condicoes, renovacao_tipo: 'automatica', renovacao_periodo_meses: 1, multa_atraso: 2, juros_mes: 1, reajuste_indice: 'IPCA', reajuste_periodicidade_meses: 12, reajuste_aviso_dias: 30, forma_pagamento: 'pix' } });
  return contrato;
}

/**
 * Salva os dados de T11.14 e mantém os itens do contrato iguais ao plano escolhido: o valor vem do preço
 * aprovado, nunca digitado. Assim a programação financeira (T11.07) usa o mesmo número do documento.
 */
export async function salvarDadosSaas(contratoId: string, dados: DadosSaas, { representante }: { representante?: string | null } = {}, hoje: string = hojeISO()): Promise<void> {
  const ficha = await carregarContrato(contratoId, hoje);
  if (!ficha || !ficha.contrato.saas) throw new ErroDeRegra('Este não é um contrato de assinatura.');
  if (ficha.atual.situacao !== 'em_elaboracao' || ficha.atual.fluxo !== 'rascunho') throw new ErroDeRegra('Só o rascunho se edita.');
  const limites = errosDosLimites(dados, { contrapartePj: ficha.contraparte?.tipo_pessoa === 'pj', hoje });
  // Os limites legais barram já ao salvar (CA-11.16); a falta de dados só barra a emissão.
  const legal = (['garantia_dias', 'multa_atraso_pct', 'juros_mes_pct', 'teste_dias', 'suspensao_dias_atraso', 'aviso_suspensao_dias', 'cancelamento_dias_atraso', 'reajuste_aviso_dias', 'dia_vencimento', 'limite_responsabilidade_meses'] as const).find((campo) => limites[campo]);
  if (legal) throw new ErroDeRegra(limites[legal] as string);
  const catalogo = await catalogoDoContrato(dados, hoje);
  await emTransacao(async () => {
    await repositorios.contrato_versao.atualizar(ficha.atual.id, { dados_saas: dados, ...(representante !== undefined ? { representante_contraparte_id: representante } : {}), vigencia_inicio: dados.data_inicio, condicoes: { ...ficha.atual.condicoes, multa_atraso: dados.multa_atraso_pct, juros_mes: dados.juros_mes_pct, dia_vencimento: dados.dia_vencimento, fidelidade_meses: dados.fidelidade_meses, fidelidade_motivo: dados.fidelidade_motivo, multa_rescisoria: dados.multa_rescisoria_texto, reajuste_indice: dados.reajuste_indice, reajuste_aviso_dias: dados.reajuste_aviso_dias, renovacao_tipo: 'automatica', renovacao_periodo_meses: dados.periodicidade === 'anual' ? 12 : 1 } });
    for (const item of ficha.itens) await repositorios.item_contrato.arquivar(item.id);
    const linhas = catalogo.oferta ? [{ oferta: catalogo.oferta, preco: catalogo.preco, quantidade: 1 }, ...catalogo.adicionais] : [];
    for (const [ordem, linha] of linhas.entries()) {
      const valor = linha.preco?.valor ?? null;
      await repositorios.item_contrato.criar({ versao_id: ficha.atual.id, produto_id: linha.oferta.produto_id, tipo_item: 'oferta', oferta_id: linha.oferta.id, preco_versao_id: linha.preco?.id ?? null, canal_id: dados.canal_id, descricao: linha.oferta.nome, quantidade: linha.quantidade, valor_unitario: valor, justificativa_valor: null, desconto_percentual: null, desconto: null, desconto_justificativa: ordem === 0 && dados.condicao_especial ? (dados.condicao_especial.motivo ?? null) : null, desconto_por: ordem === 0 && dados.condicao_especial ? idDaPessoaAtual() : null, desconto_em: ordem === 0 && dados.condicao_especial ? hoje : null, valor_total: valor === null ? null : Math.round(valor * linha.quantidade * 100) / 100, recorrente: true, periodicidade: dados.periodicidade, inicio: dados.data_inicio, fim: null, item_origem_id: null, proposta_item_id: null, ordem });
    }
  });
}

/**
 * RN-11.37 e CA-11.19: os Termos de Assinatura públicos, do mesmo modelo, com aceite eletrônico e sem
 * contraparte individual. Saem como rascunho em T09.02 e seguem validação e publicação (decisão vigente 7).
 * O modelo v2.0 descreve um plano por vez: a tabela de todos os planos aprovados vai ao fim, como dado.
 */
export async function gerarTermosDeAssinatura(produtoId: string, responsavelId: string, hoje: string = hojeISO()): Promise<{ documentoId: string; vazias: string[] }> {
  const catalogo = catalogoComercial();
  const [produto, configuracao, ofertas] = await Promise.all([repositorios.produto.obter(produtoId), catalogo.configuracaoValidada(produtoId), catalogo.ofertasDoProduto(produtoId)]);
  if (!produto) throw new ErroDeRegra('Este produto não existe mais.');
  if (catalogo.estado === 'ausente') throw new ErroDeRegra(MENSAGEM_CATALOGO_AUSENTE);
  const planos = ofertas.filter((oferta) => oferta.situacao === 'aprovada' && oferta.tipo === 'assinatura');
  if (!planos.length) throw new ErroDeRegra('O produto não tem plano de assinatura aprovado.');
  const { versao } = await modeloSaasParaEmissao();
  if (!versao) throw new ErroDeRegra('O modelo MOD-SAAS-LIC não está disponível.');
  const tabela: string[] = [];
  for (const plano of planos) {
    const precos = await catalogo.precosDaOferta(plano.id);
    const vigentes = ['mensal', 'anual'].flatMap((periodicidade) => {
      const preco = precoVigente(precos, { canalId: null, periodicidade, naData: hoje });
      return preco?.valor !== null && preco?.valor !== undefined ? [`${formatarDinheiro(preco.valor, preco.moeda)} por ${periodicidade === 'anual' ? 'ano' : 'mês'}`] : [];
    });
    tabela.push(`| ${plano.nome} | ${vigentes.join('; ') || 'preço não definido'} | ${plano.recursos.map((recurso) => `${recurso.nome}: ${recurso.incluido ? textoDoLimite(recurso.limite) || 'limite não informado' : 'não incluído'}`).join('; ')} |`);
  }
  const dados = { modelo: { codigo: 'MOD-SAAS-LIC', versao: versao.rotulo_versao }, contrato: { forma_assinatura: 'Aceite eletrônico', modalidades: configuracao?.modalidades ?? [], modalidades_texto: modalidadesEmTexto(configuracao?.modalidades ?? []) }, entidade: {}, contraparte: {}, produto: { nome: produto.nome, nome_maiusculo: configuracao?.nome_maiusculo ?? null, descricao_contratual: configuracao?.descricao_contratual ?? null, funcoes_de_apoio: configuracao?.funcoes_de_apoio ?? null, url_termos: configuracao?.url_termos ?? null, url_privacidade: configuracao?.url_privacidade ?? null, url_ajuda: configuracao?.url_ajuda ?? null, contrato: configuracao ?? {} }, oferta: {} };
  const documento = renderizarVersao(versao, [], dados);
  const texto = `${textoDoDocumento(documento.nos)}\n\n## TABELA DE PLANOS APROVADOS (dados do catálogo em ${formatarDiaISO(hoje)})\n\n| Plano | Preço | Recursos e limites |\n|---|---|---|\n${tabela.join('\n')}`;
  const existentes = (await carregarDocumentosLegais()).documentos.find((item) => item.produto_id === produtoId && item.tipo === 'termos_assinatura');
  if (existentes) {
    if (['rascunho', 'em_validacao', 'validado'].includes(existentes.atual.situacao)) throw new ErroDeRegra('Os Termos de Assinatura deste produto já têm uma versão em andamento em Documentos legais.');
    const { novaVersaoDoDocumento, salvarRascunhoDoDocumento } = await import('./legal');
    const nova = await novaVersaoDoDocumento(existentes.id);
    await salvarRascunhoDoDocumento(nova.id, { texto, resumo_mudancas: `Gerado de MOD-SAAS-LIC v${versao.rotulo_versao}`, arquivo_url: '', url_publica: nova.url_publica ?? '' });
    await repositorios.documento_legal_versao.atualizar(nova.id, { modelo_versao_id: versao.id });
    return { documentoId: existentes.id, vazias: documento.vazias };
  }
  const criado = await criarDocumentoLegal({ produto_id: produtoId, tipo: 'termos_assinatura', responsavel_id: responsavelId }, { texto, modelo_versao_id: versao.id });
  return { documentoId: criado.id, vazias: documento.vazias };
}

// ---------- Adesão padrão (T11.13) ----------

/** RN-11.25: agregada por oferta, termos e canal. Sem Termos de Assinatura (ou de Uso) publicados, não se cria. */
export async function criarRelacaoAdesao({ produtoId, ofertaId, canalId, inicio }: { produtoId: string; ofertaId: string; canalId: string; inicio: string }): Promise<void> {
  if (!produtoId || !ofertaId || !canalId || !inicio) throw new ErroDeRegra('Escolha produto, oferta, canal e início.');
  const catalogo = catalogoComercial();
  const oferta = await catalogo.oferta(ofertaId);
  if (!oferta) throw new ErroDeRegra(catalogo.estado === 'ausente' ? MENSAGEM_CATALOGO_AUSENTE : 'Oferta não encontrada no catálogo.');
  if (oferta.situacao !== 'aprovada' || oferta.formalizacao === 'contrato_negociado') throw new ErroDeRegra('A oferta precisa estar Aprovada e aceitar adesão padrão.');
  const { documentos } = await carregarDocumentosLegais();
  const termos = documentos.find((documento) => documento.produto_id === produtoId && documento.tipo === 'termos_assinatura' && documento.vigente?.situacao === 'publicado') ?? documentos.find((documento) => documento.produto_id === produtoId && documento.tipo === 'termos_uso' && documento.vigente?.situacao === 'publicado');
  if (!termos) throw new ErroDeRegra('O produto não tem Termos de Assinatura (ou Termos de Uso com seção de assinatura) Publicados.');
  const ativas = await repositorios.relacao_adesao.listar({ onde: { situacao: 'ativa', oferta_id: ofertaId, canal_id: canalId } });
  if (ativas.length) throw new ErroDeRegra('Já existe uma relação de adesão ativa para esta oferta e canal.');
  await repositorios.relacao_adesao.criar({ produto_id: produtoId, oferta_id: ofertaId, canal_id: canalId, documento_legal_id: termos.id, inicio, situacao: 'ativa', encerrada_em: null });
}

export async function encerrarRelacaoAdesao(id: string, data: string, motivo: string): Promise<void> {
  if (!motivo.trim()) throw new ErroDeRegra('Encerrar exige motivo.');
  if (!data) throw new ErroDeRegra('Informe a data.');
  await repositorios.relacao_adesao.atualizar(id, { situacao: 'encerrada', encerrada_em: data }, { motivo: motivo.trim() });
}

