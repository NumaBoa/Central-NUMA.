import { ROTULOS_FUSO } from '@/dados/fuso';
import { listarHistorico } from '@/dados/historico';
import { repositorios } from '@/dados/repositorios';
import { TABELAS, type Tabela } from '@/dados/tabelas';
import type { EventoAuditoria } from '@/dados/tipos/auditoria';
import { CATALOGO_CONFIGURACAO, chaveConhecida } from '@/dados/tipos/configuracao';
import { formatarDataHora, formatarDiaISO } from '@/lib/formatacao';
import { ROTULOS_PRIORIDADE_ATIVIDADE, ROTULOS_SITUACAO_ATIVIDADE, ROTULOS_TIPO_ATIVIDADE } from './atividades';
import { ROTULOS_NATUREZA, ROTULOS_SITUACAO_CATEGORIA, ROTULOS_TIPO_CATEGORIA } from './categorias';
import { ROTULOS_SITUACAO_CONTA, ROTULOS_TIPO_CONTA } from './contas';
import { ROTULOS_ORIGEM, ROTULOS_PAPEL_CONTRAPARTE, ROTULOS_TIPO_PESSOA } from './contrapartes';
import { rotuloDosModulos } from './etiquetas';
import { ROTULOS_ABRANGENCIA } from './feriados';
import { ROTULOS_SITUACAO_ENTIDADE, ROTULOS_TIPO_ENTIDADE } from './entidades';
import { avancouDeFase, rotuloDaFase } from './fases';
import { ROTULOS_SITUACAO_MARCA } from './marcas';
import { FASES, type Fase } from './navegacao';
import { formatarTelefone, ROTULOS_PAPEL, ROTULOS_SITUACAO, ROTULOS_TIPO, type PapelContato } from './pessoas';
import { ROTULOS_TIPO_ATIVO, ROTULOS_TRANSFERENCIA } from './ativos';
import { rotuloDaCompetencia, ROTULOS_SITUACAO_TITULO } from './titulos';
import { ROTULOS_ACORDO_DADOS, ROTULOS_MFA, ROTULOS_MODALIDADE, ROTULOS_PERIODICIDADE, ROTULOS_RENOVACAO, ROTULOS_SITUACAO_FERRAMENTA, ROTULOS_TITULAR } from './ferramentas';
import { ROTULOS_ESTAGIO, ROTULOS_SITUACAO_PRODUTO, ROTULOS_TIPO_PRODUTO } from './produtos';
import { ROTULOS_SITUACAO_ROTINA } from './recorrencias';

type Nomes = ReadonlyMap<string, string>;

function plural(quantidade: number, singular: string, varios: string): string {
  return `${quantidade} ${quantidade === 1 ? singular : varios}`;
}

function fraseDaAcaoExecutada(depois: EventoAuditoria['depois']): string {
  const registros = Number(depois?.registros ?? 0);
  switch (depois?.funcao) {
    case 'carga_inicial':
      return 'carregou os dados de exemplo';
    case 'migrar_dados':
      return 'atualizou os dados para a nova versão da Central';
    case 'importar_dados':
      return `importou ${plural(registros, 'registro', 'registros')} de um arquivo${depois?.copia_antes ? ', com cópia do que havia antes' : ''}`;
    case 'restaurar_exemplos':
      return 'restaurou os dados de exemplo';
    case 'limpar_exemplos':
      return `limpou ${plural(registros, 'registro', 'registros')} de exemplo`;
    case 'rodar_rotinas':
      return 'rodou as rotinas do dia';
    default:
      return 'executou uma ação';
  }
}

function nomeDaTabela(tabela: string | null): string {
  return (tabela && TABELAS[tabela as Tabela]?.rotulo) || tabela || 'registros';
}

function ehFase(valor: unknown): valor is Fase {
  return FASES.includes(valor as Fase);
}

const NAO_INFORMADO = 'não informado';

function vazio(valor: unknown): boolean {
  return valor === null || valor === undefined || valor === '' || (Array.isArray(valor) && valor.length === 0);
}

function valorLegivel(chave: string, valor: unknown, nomes: Nomes): string {
  if (vazio(valor)) return NAO_INFORMADO;
  if (chave === 'fuso') return ROTULOS_FUSO[valor as keyof typeof ROTULOS_FUSO] ?? String(valor);
  if (chave === 'responsavel_backup_id') return nomes.get(String(valor)) ?? 'pessoa removida';
  if (chave.endsWith('_dias')) return plural(Number(valor), 'dia', 'dias');
  return String(valor);
}

/** "alterou Moeda padrão: de BRL para USD"; a fase tem verbo próprio e, ao voltar, o motivo. */
function fraseDaConfiguracao(evento: EventoAuditoria, nomes: Nomes): string {
  const chave = String(evento.depois?.chave ?? '');
  const antes = evento.antes?.valor;
  const depois = evento.depois?.valor;
  if (chave === 'fase_ativa' && ehFase(antes) && ehFase(depois)) {
    const verbo = avancouDeFase(antes, depois) ? 'avançou' : 'voltou';
    return `${verbo} para a ${rotuloDaFase(depois)}${evento.motivo ? `. Motivo: ${evento.motivo}` : ''}`;
  }
  const rotulo = chaveConhecida(chave) ? CATALOGO_CONFIGURACAO[chave].rotulo : 'uma configuração';
  return `alterou ${rotulo}: de ${valorLegivel(chave, antes, nomes)} para ${valorLegivel(chave, depois, nomes)}`;
}

function oCambio(dados: EventoAuditoria['depois']): string {
  const moeda = dados?.moeda;
  const data = dados?.data_referencia;
  return typeof moeda === 'string' && typeof data === 'string' ? `o câmbio de ${moeda} de ${formatarDiaISO(data)}` : 'um câmbio';
}

// ---------- Campos de cada tabela, por extenso ----------

type CampoLegivel = {
  rotulo: string;
  valor?: (valor: unknown, nomes: Nomes) => string;
  /** O histórico diz que mudou, sem mostrar o conteúdo: dado sensível ou texto longo. */
  semValores?: boolean;
};

const simNao = (valor: unknown) => (valor ? 'sim' : 'não');

const CAMPOS_LEGIVEIS: Readonly<Record<string, Readonly<Record<string, CampoLegivel>>>> = {
  pessoa: {
    nome_completo: { rotulo: 'Nome completo' },
    nome_exibicao: { rotulo: 'Nome de exibição' },
    tipo: { rotulo: 'Tipo', valor: (valor) => ROTULOS_TIPO[valor as keyof typeof ROTULOS_TIPO] },
    eh_socia: { rotulo: 'É sócia', valor: simNao },
    contraparte_id: { rotulo: 'Contraparte', valor: (valor, nomes) => nomes.get(String(valor)) ?? 'contraparte removida' },
    papeis_contato: { rotulo: 'Papel do contato', valor: (valor) => (valor as PapelContato[]).map((papel) => ROTULOS_PAPEL[papel]).join(', ') },
    funcao: { rotulo: 'Função' },
    email: { rotulo: 'E-mail' },
    telefone: { rotulo: 'Telefone', valor: (valor) => formatarTelefone(String(valor)) },
    cpf: { rotulo: 'CPF', semValores: true },
    observacoes: { rotulo: 'Observações', semValores: true },
    situacao: { rotulo: 'Situação', valor: (valor) => ROTULOS_SITUACAO[valor as keyof typeof ROTULOS_SITUACAO] },
  },
  area: {
    nome: { rotulo: 'Nome' },
    responsavel_padrao_id: { rotulo: 'Responsável padrão', valor: (valor, nomes) => nomes.get(String(valor)) ?? 'pessoa removida' },
    compartilhada: { rotulo: 'Compartilhada', valor: simNao },
  },
  marca: {
    nome: { rotulo: 'Nome' },
    provisorio: { rotulo: 'Nome provisório', valor: simNao },
    cor_hex: { rotulo: 'Cor principal' },
    logo_url: { rotulo: 'Logotipo', semValores: true },
    situacao: { rotulo: 'Situação', valor: (valor) => ROTULOS_SITUACAO_MARCA[valor as keyof typeof ROTULOS_SITUACAO_MARCA] },
  },
  produto: {
    nome: { rotulo: 'Nome' },
    marca_id: { rotulo: 'Marca', valor: (valor, nomes) => nomes.get(String(valor)) ?? 'marca removida' },
    codigo_curto: { rotulo: 'Código curto' },
    tipo: { rotulo: 'Tipo', valor: (valor) => ROTULOS_TIPO_PRODUTO[valor as keyof typeof ROTULOS_TIPO_PRODUTO] },
    descricao_curta: { rotulo: 'Descrição curta', semValores: true },
    estagio: { rotulo: 'Estágio', valor: (valor) => ROTULOS_ESTAGIO[valor as keyof typeof ROTULOS_ESTAGIO] },
    ordem_fila: { rotulo: 'Ordem na fila' },
    responsavel_id: { rotulo: 'Responsável', valor: (valor, nomes) => nomes.get(String(valor)) ?? 'pessoa removida' },
    entidade_id: { rotulo: 'Entidade responsável', valor: (valor, nomes) => nomes.get(String(valor)) ?? 'entidade removida' },
    tem_usuarios_reais: { rotulo: 'Tem usuários reais', valor: simNao },
    data_inicio: { rotulo: 'Data de início', valor: (valor) => formatarDiaISO(String(valor)) },
    situacao: { rotulo: 'Situação', valor: (valor) => ROTULOS_SITUACAO_PRODUTO[valor as keyof typeof ROTULOS_SITUACAO_PRODUTO] },
  },
  contraparte: {
    tipo_pessoa: { rotulo: 'Tipo de pessoa', valor: (valor) => ROTULOS_TIPO_PESSOA[valor as keyof typeof ROTULOS_TIPO_PESSOA] },
    nome: { rotulo: 'Nome' },
    nome_fantasia: { rotulo: 'Nome fantasia' },
    documento: { rotulo: 'Documento', semValores: true },
    papeis: { rotulo: 'Papéis', valor: (valor) => (valor as (keyof typeof ROTULOS_PAPEL_CONTRAPARTE)[]).map((papel) => ROTULOS_PAPEL_CONTRAPARTE[papel]).join(', ') },
    site: { rotulo: 'Site' },
    email: { rotulo: 'E-mail' },
    telefone: { rotulo: 'Telefone' },
    endereco: { rotulo: 'Endereço', semValores: true },
    pais: { rotulo: 'País' },
    origem: { rotulo: 'Origem', valor: (valor) => ROTULOS_ORIGEM[valor as keyof typeof ROTULOS_ORIGEM] },
    responsavel_id: { rotulo: 'Responsável', valor: (valor, nomes) => nomes.get(String(valor)) ?? 'pessoa removida' },
    observacoes: { rotulo: 'Observações', semValores: true },
    situacao: { rotulo: 'Situação', valor: (valor) => ROTULOS_SITUACAO[valor as keyof typeof ROTULOS_SITUACAO] },
  },
  entidade: {
    tipo_pessoa: { rotulo: 'Tipo', valor: (valor) => ROTULOS_TIPO_ENTIDADE[valor as keyof typeof ROTULOS_TIPO_ENTIDADE] },
    nome: { rotulo: 'Nome' },
    nome_fantasia: { rotulo: 'Nome fantasia' },
    documento: { rotulo: 'Documento', semValores: true },
    situacao: { rotulo: 'Situação', valor: (valor) => ROTULOS_SITUACAO_ENTIDADE[valor as keyof typeof ROTULOS_SITUACAO_ENTIDADE] },
    natureza_juridica: { rotulo: 'Natureza jurídica' },
    regime_tributario: { rotulo: 'Regime tributário' },
    inscricao_municipal: { rotulo: 'Inscrição municipal' },
    inscricao_estadual: { rotulo: 'Inscrição estadual' },
    endereco: { rotulo: 'Endereço', semValores: true },
    data_abertura: { rotulo: 'Data de abertura', valor: (valor) => formatarDiaISO(String(valor)) },
    entidade_padrao: { rotulo: 'Entidade padrão', valor: simNao },
    contador_id: { rotulo: 'Contador', valor: (valor, nomes) => nomes.get(String(valor)) ?? 'contraparte removida' },
  },
  categoria_financeira: {
    nome: { rotulo: 'Nome' },
    tipo: { rotulo: 'Tipo', valor: (valor) => ROTULOS_TIPO_CATEGORIA[valor as keyof typeof ROTULOS_TIPO_CATEGORIA] },
    natureza_custo: { rotulo: 'Natureza do custo', valor: (valor) => ROTULOS_NATUREZA[valor as keyof typeof ROTULOS_NATUREZA] },
    pai_id: { rotulo: 'Grupo', valor: (valor, nomes) => nomes.get(String(valor)) ?? 'grupo removido' },
    situacao: { rotulo: 'Situação', valor: (valor) => ROTULOS_SITUACAO_CATEGORIA[valor as keyof typeof ROTULOS_SITUACAO_CATEGORIA] },
  },
  conta_financeira: {
    nome: { rotulo: 'Nome' },
    tipo: { rotulo: 'Tipo', valor: (valor) => ROTULOS_TIPO_CONTA[valor as keyof typeof ROTULOS_TIPO_CONTA] },
    titular_entidade_id: { rotulo: 'Entidade titular', valor: (valor, nomes) => nomes.get(String(valor)) ?? 'entidade removida' },
    titular_pessoa_id: { rotulo: 'Sócia titular', valor: (valor, nomes) => nomes.get(String(valor)) ?? 'pessoa removida' },
    instituicao: { rotulo: 'Instituição' },
    final_numero: { rotulo: 'Final', semValores: true },
    moeda: { rotulo: 'Moeda' },
    saldo_inicial: { rotulo: 'Saldo inicial', semValores: true },
    data_saldo_inicial: { rotulo: 'Data do saldo', valor: (valor) => formatarDiaISO(String(valor)) },
    situacao: { rotulo: 'Situação', valor: (valor) => ROTULOS_SITUACAO_CONTA[valor as keyof typeof ROTULOS_SITUACAO_CONTA] },
  },
  feriado: {
    data: { rotulo: 'Data', valor: (valor) => formatarDiaISO(String(valor)) },
    nome: { rotulo: 'Nome' },
    abrangencia: { rotulo: 'Abrangência', valor: (valor) => ROTULOS_ABRANGENCIA[valor as keyof typeof ROTULOS_ABRANGENCIA] },
    uf: { rotulo: 'Estado' },
    municipio: { rotulo: 'Município' },
  },
  atividade: {
    tipo: { rotulo: 'Tipo', valor: (valor) => ROTULOS_TIPO_ATIVIDADE[valor as keyof typeof ROTULOS_TIPO_ATIVIDADE] },
    titulo: { rotulo: 'Título' },
    descricao: { rotulo: 'Descrição', semValores: true },
    area_id: { rotulo: 'Área', valor: (valor, nomes) => nomes.get(String(valor)) ?? 'área removida' },
    responsavel_id: { rotulo: 'Responsável', valor: (valor, nomes) => nomes.get(String(valor)) ?? 'pessoa removida' },
    prioridade: { rotulo: 'Prioridade', valor: (valor) => ROTULOS_PRIORIDADE_ATIVIDADE[valor as keyof typeof ROTULOS_PRIORIDADE_ATIVIDADE] },
    situacao: { rotulo: 'Situação', valor: (valor) => ROTULOS_SITUACAO_ATIVIDADE[valor as keyof typeof ROTULOS_SITUACAO_ATIVIDADE] },
    bloqueada: { rotulo: 'Bloqueada', valor: simNao },
    bloqueio_motivo: { rotulo: 'Motivo do bloqueio' },
    prazo: { rotulo: 'Prazo', valor: (valor) => formatarDiaISO(String(valor)) },
    prazo_hora: { rotulo: 'Hora do prazo' },
    aviso_em: { rotulo: 'Aviso', valor: (valor) => formatarDataHora(String(valor)) },
    aguardando_de_pessoa_id: { rotulo: 'Aguardando de', valor: (valor, nomes) => nomes.get(String(valor)) ?? 'pessoa removida' },
    aguardando_de_texto: { rotulo: 'Aguardando de' },
    acompanhamento_em: { rotulo: 'Acompanhamento', valor: (valor) => formatarDiaISO(String(valor)) },
    inicio: { rotulo: 'Início', valor: (valor) => formatarDiaISO(String(valor)) },
    conclusao_nota: { rotulo: 'Nota' },
    recorrencia_id: { rotulo: 'Rotina', valor: (valor, nomes) => nomes.get(String(valor)) ?? 'rotina removida' },
  },
  ferramenta: {
    nome: { rotulo: 'Nome' },
    categoria_id: { rotulo: 'Categoria', valor: (valor, nomes) => nomes.get(String(valor)) ?? 'categoria removida' },
    fornecedor_id: { rotulo: 'Fornecedor', valor: (valor, nomes) => nomes.get(String(valor)) ?? 'contraparte removida' },
    finalidade: { rotulo: 'Finalidade' },
    critica: { rotulo: 'Crítica', valor: simNao },
    situacao: { rotulo: 'Situação', valor: (valor) => ROTULOS_SITUACAO_FERRAMENTA[valor as keyof typeof ROTULOS_SITUACAO_FERRAMENTA] },
    url_acesso: { rotulo: 'URL de acesso' },
    url_admin: { rotulo: 'URL de administração' },
    email_login_conta: { rotulo: 'Login da conta', semValores: true },
    ambiente: { rotulo: 'Ambiente' },
    titular_atual_tipo: { rotulo: 'Titular atual', valor: (valor) => ROTULOS_TITULAR[valor as keyof typeof ROTULOS_TITULAR] },
    titular_atual_pessoa_id: { rotulo: 'Sócia titular', valor: (valor, nomes) => nomes.get(String(valor)) ?? 'pessoa removida' },
    titular_atual_texto: { rotulo: 'Em nome de' },
    titular_desejado: { rotulo: 'Titular desejado' },
    referencia_cofre: { rotulo: 'Referência ao cofre', semValores: true },
    mfa_conta: { rotulo: 'Segunda etapa', valor: (valor) => ROTULOS_MFA[valor as keyof typeof ROTULOS_MFA] },
    responsavel_tecnico_id: { rotulo: 'Responsável técnica', valor: (valor, nomes) => nomes.get(String(valor)) ?? 'pessoa removida' },
    responsavel_financeiro_id: { rotulo: 'Responsável financeira', valor: (valor, nomes) => nomes.get(String(valor)) ?? 'pessoa removida' },
    caminho_recuperacao: { rotulo: 'Caminho de recuperação', semValores: true },
    trata_dados_pessoais: { rotulo: 'Trata dados pessoais', valor: simNao },
    tipos_dados: { rotulo: 'Tipos de dados', semValores: true },
    regiao_dados: { rotulo: 'Região dos dados' },
    acordo_dados_situacao: { rotulo: 'Acordo de tratamento', valor: (valor) => ROTULOS_ACORDO_DADOS[valor as keyof typeof ROTULOS_ACORDO_DADOS] },
    cancelada_em: { rotulo: 'Cancelada em', valor: (valor) => formatarDiaISO(String(valor)) },
    cancelamento_motivo: { rotulo: 'Motivo do cancelamento' },
    observacoes: { rotulo: 'Observações', semValores: true },
  },
  titulo: {
    descricao: { rotulo: 'Descrição' },
    contraparte_id: { rotulo: 'Contraparte', valor: (valor, nomes) => nomes.get(String(valor)) ?? 'contraparte removida' },
    categoria_id: { rotulo: 'Categoria', valor: (valor, nomes) => nomes.get(String(valor)) ?? 'categoria removida' },
    competencia: { rotulo: 'Competência', valor: (valor) => rotuloDaCompetencia(String(valor)) },
    vencimento: { rotulo: 'Vencimento', valor: (valor) => formatarDiaISO(String(valor)) },
    valor: { rotulo: 'Valor', valor: (valor) => String(valor).replace('.', ',') },
    moeda: { rotulo: 'Moeda' },
    situacao: { rotulo: 'Situação', valor: (valor) => ROTULOS_SITUACAO_TITULO[valor as keyof typeof ROTULOS_SITUACAO_TITULO] },
    responsavel_id: { rotulo: 'Responsável', valor: (valor, nomes) => nomes.get(String(valor)) ?? 'pessoa removida' },
    cancelado_motivo: { rotulo: 'Motivo do cancelamento' },
    observacao: { rotulo: 'Observação', semValores: true },
  },
  ativo_digital: {
    tipo: { rotulo: 'Tipo', valor: (valor) => ROTULOS_TIPO_ATIVO[valor as keyof typeof ROTULOS_TIPO_ATIVO] },
    identificador: { rotulo: 'Identificador' },
    produto_id: { rotulo: 'Produto', valor: (valor, nomes) => nomes.get(String(valor)) ?? 'produto removido' },
    ferramenta_id: { rotulo: 'Ferramenta', valor: (valor, nomes) => nomes.get(String(valor)) ?? 'ferramenta removida' },
    titular_atual_tipo: { rotulo: 'Titular atual', valor: (valor) => ROTULOS_TITULAR[valor as keyof typeof ROTULOS_TITULAR] },
    titular_atual_pessoa_id: { rotulo: 'Sócia titular', valor: (valor, nomes) => nomes.get(String(valor)) ?? 'pessoa removida' },
    titular_atual_texto: { rotulo: 'Em nome de' },
    titular_desejado: { rotulo: 'Titular desejado' },
    transferencia_situacao: { rotulo: 'Situação da transferência', valor: (valor) => ROTULOS_TRANSFERENCIA[valor as keyof typeof ROTULOS_TRANSFERENCIA] },
    requisito_transferencia: { rotulo: 'Requisito para transferir' },
    registrado_em: { rotulo: 'Data de registro', valor: (valor) => formatarDiaISO(String(valor)) },
    vencimento: { rotulo: 'Vencimento', valor: (valor) => formatarDiaISO(String(valor)) },
    renovacao_automatica: { rotulo: 'Renovação automática', valor: simNao },
    critico: { rotulo: 'Crítico', valor: simNao },
    responsavel_id: { rotulo: 'Responsável', valor: (valor, nomes) => nomes.get(String(valor)) ?? 'pessoa removida' },
    transferido_em: { rotulo: 'Transferido em', valor: (valor) => formatarDiaISO(String(valor)) },
    evidencia_transferencia_url: { rotulo: 'Evidência da transferência' },
    observacoes: { rotulo: 'Observações', semValores: true },
  },
  assinatura_ferramenta: {
    plano: { rotulo: 'Plano' },
    modalidade: { rotulo: 'Modalidade', valor: (valor) => ROTULOS_MODALIDADE[valor as keyof typeof ROTULOS_MODALIDADE] },
    valor: { rotulo: 'Valor', valor: (valor) => String(valor).replace('.', ',') },
    moeda: { rotulo: 'Moeda' },
    periodicidade: { rotulo: 'Periodicidade', valor: (valor) => ROTULOS_PERIODICIDADE[valor as keyof typeof ROTULOS_PERIODICIDADE] },
    proxima_cobranca: { rotulo: 'Próxima cobrança', valor: (valor) => formatarDiaISO(String(valor)) },
    renovacao: { rotulo: 'Renovação', valor: (valor) => ROTULOS_RENOVACAO[valor as keyof typeof ROTULOS_RENOVACAO] },
    fim_teste: { rotulo: 'Fim do teste', valor: (valor) => formatarDiaISO(String(valor)) },
    conta_financeira_id: { rotulo: 'Conta de pagamento', valor: (valor, nomes) => nomes.get(String(valor)) ?? 'conta removida' },
    situacao: { rotulo: 'Situação da assinatura', valor: (valor) => (valor === 'ativa' ? 'Ativa' : 'Encerrada') },
  },
  recorrencia: {
    titulo: { rotulo: 'Título' },
    responsavel_id: { rotulo: 'Responsável', valor: (valor, nomes) => nomes.get(String(valor)) ?? 'pessoa removida' },
    situacao: { rotulo: 'Situação', valor: (valor) => ROTULOS_SITUACAO_ROTINA[valor as keyof typeof ROTULOS_SITUACAO_ROTINA] },
    modelo: { rotulo: 'Detalhes das próximas ocorrências', semValores: true },
    fim_data: { rotulo: 'Fim', valor: (valor) => formatarDiaISO(String(valor)) },
  },
  etiqueta: {
    nome: { rotulo: 'Nome' },
    cor: { rotulo: 'Cor' },
    modulos: { rotulo: 'Módulos', valor: (valor) => rotuloDosModulos(valor as string[]) },
  },
};

/** "Função: de Sócia para Diretora; CPF" (P2: o histórico diz o que mudou, de quanto para quanto). */
function mudancasLegiveis(evento: EventoAuditoria, nomes: Nomes): string {
  const campos = CAMPOS_LEGIVEIS[evento.tabela ?? ''] ?? {};
  return evento.campos_alterados
    .flatMap((nome) => {
      const campo = campos[nome];
      if (!campo) return [];
      if (campo.semValores) return [campo.rotulo];
      const legivel = (valor: unknown) => (vazio(valor) ? NAO_INFORMADO : campo.valor ? campo.valor(valor, nomes) : String(valor));
      return [`${campo.rotulo}: de ${legivel(evento.antes?.[nome])} para ${legivel(evento.depois?.[nome])}`];
    })
    .join('; ');
}

function textoDe(valor: unknown): string | undefined {
  return typeof valor === 'string' && valor ? valor : undefined;
}

/** Como chamar o registro na frase. `undefined` quando o evento não diz: fica a frase genérica. */
function registroPorExtenso(evento: EventoAuditoria, nomes: Nomes): string | undefined {
  const id = evento.registro_id ?? '';
  if (evento.tabela === 'pessoa') return textoDe(evento.depois?.nome_completo) ?? textoDe(evento.antes?.nome_completo) ?? nomes.get(id);
  if (evento.tabela === 'area') {
    const nome = textoDe(evento.depois?.nome) ?? textoDe(evento.antes?.nome) ?? nomes.get(id);
    return nome && `a área ${nome}`;
  }
  if (evento.tabela === 'atividade') {
    const titulo = textoDe(evento.depois?.titulo) ?? textoDe(evento.antes?.titulo) ?? nomes.get(id);
    return titulo && `a atividade ${titulo}`;
  }
  if (evento.tabela === 'recorrencia') {
    const titulo = textoDe(evento.depois?.titulo) ?? textoDe(evento.antes?.titulo) ?? nomes.get(id);
    return titulo && `a rotina ${titulo}`;
  }
  if (evento.tabela === 'titulo') {
    const descricao = textoDe(evento.depois?.descricao) ?? textoDe(evento.antes?.descricao) ?? nomes.get(id);
    return descricao && `o lançamento ${descricao}`;
  }
  if (evento.tabela === 'baixa') {
    const titulo = nomes.get(String(evento.depois?.titulo_id ?? evento.antes?.titulo_id ?? ''));
    return `uma baixa${titulo ? ` de ${titulo}` : ''}`;
  }
  if (evento.tabela === 'titulo_rateio') {
    const titulo = nomes.get(String(evento.depois?.titulo_id ?? evento.antes?.titulo_id ?? ''));
    return `o rateio${titulo ? ` de ${titulo}` : ''}`;
  }
  if (evento.tabela === 'movimento_societario') return 'um movimento societário';
  if (evento.tabela === 'ativo_digital') {
    const identificador = textoDe(evento.depois?.identificador) ?? textoDe(evento.antes?.identificador) ?? nomes.get(id);
    return identificador && `o ativo ${identificador}`;
  }
  if (evento.tabela === 'ferramenta') {
    const nome = textoDe(evento.depois?.nome) ?? textoDe(evento.antes?.nome) ?? nomes.get(id);
    return nome && `a ferramenta ${nome}`;
  }
  if (evento.tabela === 'assinatura_ferramenta') {
    const ferramenta = nomes.get(String(evento.depois?.ferramenta_id ?? evento.antes?.ferramenta_id ?? ''));
    return `a assinatura${ferramenta ? ` de ${ferramenta}` : ''}`;
  }
  const artigos: Readonly<Record<string, string>> = { marca: 'a marca', produto: 'o produto', contraparte: 'a contraparte', entidade: 'a entidade', categoria_financeira: 'a categoria', conta_financeira: 'a conta', feriado: 'o feriado', etiqueta: 'a etiqueta' };
  const artigo = artigos[evento.tabela ?? ''];
  if (artigo) {
    const nome = textoDe(evento.depois?.nome) ?? textoDe(evento.antes?.nome) ?? nomes.get(id);
    return nome && `${artigo} ${nome}`;
  }
  return undefined;
}

function pessoaEArea(dados: EventoAuditoria['depois'], nomes: Nomes): { pessoa: string; area: string } {
  return { pessoa: nomes.get(String(dados?.pessoa_id)) ?? 'Pessoa removida', area: nomes.get(String(dados?.area_id)) ?? 'área removida' };
}

/** Participantes, contexto, checklist, comentários, vínculos e links, em frases que fazem sentido no painel. */
function fraseDoApoioDaAtividade(evento: EventoAuditoria, nomes: Nomes, quem: string): string | null {
  const dados = evento.acao === 'arquivou' ? evento.antes : evento.depois;
  const nome = (id: unknown, reserva: string) => nomes.get(String(id)) ?? reserva;
  const entrou = evento.acao === 'inseriu';
  const saiu = evento.acao === 'arquivou';
  switch (evento.tabela) {
    case 'atividade_participante':
      if (entrou) return `${quem} colocou ${nome(dados?.pessoa_id, 'Pessoa removida')} como participante`;
      return saiu ? `${quem} tirou ${nome(dados?.pessoa_id, 'Pessoa removida')} dos participantes` : null;
    case 'atividade_produto':
      if (entrou) return `${quem} colocou no contexto ${nome(dados?.produto_id, 'produto removido')}`;
      return saiu ? `${quem} tirou do contexto ${nome(dados?.produto_id, 'produto removido')}` : null;
    case 'checklist_item': {
      const item = textoDe(evento.depois?.texto) ?? textoDe(evento.antes?.texto) ?? nomes.get(evento.registro_id ?? '') ?? 'um item';
      if (entrou) return `${quem} acrescentou o item “${item}”`;
      if (saiu) return `${quem} tirou o item “${item}”`;
      if (evento.campos_alterados.includes('feito')) return `${quem} ${evento.depois?.feito ? 'concluiu' : 'reabriu'} o item “${item}”`;
      return `${quem} alterou o item “${item}”`;
    }
    case 'comentario':
      if (entrou) return `${quem} comentou`;
      return evento.campos_alterados.includes('removido_em') ? `${quem} removeu um comentário` : `${quem} editou um comentário`;
    case 'vinculo': {
      const ligados = [dados?.origem_tipo === 'atividade' ? dados?.destino_id : dados?.origem_id];
      if (entrou) return `${quem} vinculou ${nome(ligados[0], 'um registro')}`;
      return saiu ? `${quem} tirou o vínculo com ${nome(ligados[0], 'um registro')}` : null;
    }
    case 'anexo_link':
      if (entrou) return `${quem} acrescentou o link “${textoDe(dados?.titulo) ?? 'Arquivo do Drive'}”`;
      return saiu ? `${quem} tirou o link “${textoDe(dados?.titulo) ?? 'Arquivo do Drive'}”` : null;
    default:
      return null;
  }
}

/** Histórico legível (02 §6): quem fez o quê. */
export function descreverEvento(evento: EventoAuditoria, nomes: Nomes): string {
  const quem = evento.usuario_id === null ? 'Sistema' : (nomes.get(evento.usuario_id) ?? 'Pessoa removida');
  const onde = nomeDaTabela(evento.tabela);
  const registro = evento.registro_codigo ? ` ${evento.registro_codigo}` : '';
  const ehCambio = evento.tabela === 'cambio_referencia';
  const ehLigacao = evento.tabela === 'pessoa_area';
  const ehRepresentante = evento.tabela === 'entidade_representante';
  const ehVinculoDeEtiqueta = evento.tabela === 'etiqueta_vinculo';
  const fraseDeApoio = fraseDoApoioDaAtividade(evento, nomes, quem);
  if (fraseDeApoio) return fraseDeApoio;
  const porExtenso = registroPorExtenso(evento, nomes);
  const motivo = evento.motivo ? `. Motivo: ${evento.motivo}` : '';
  switch (evento.acao) {
    case 'exportou':
      return `${quem} exportou todos os dados`;
    case 'executou_acao':
      return `${quem} ${fraseDaAcaoExecutada(evento.depois)}`;
    case 'inseriu':
      if (ehCambio) return `${quem} adicionou ${oCambio(evento.depois)}`;
      if (ehLigacao) {
        const { pessoa, area } = pessoaEArea(evento.depois, nomes);
        return `${quem} colocou ${pessoa} na área ${area}`;
      }
      if (ehRepresentante) return `${quem} colocou ${nomes.get(String(evento.depois?.pessoa_id)) ?? 'Pessoa removida'} como representante de ${nomes.get(String(evento.depois?.entidade_id)) ?? 'entidade removida'}`;
      if (evento.tabela === 'pessoa' && porExtenso) return `${quem} cadastrou ${porExtenso}`;
      if (porExtenso) return `${quem} criou ${porExtenso}`;
      return `${quem} criou um registro em ${onde}${registro}`;
    case 'alterou': {
      if (evento.tabela === 'configuracao') return `${quem} ${fraseDaConfiguracao(evento, nomes)}`;
      if (ehVinculoDeEtiqueta) return `${quem} moveu um registro para a etiqueta ${nomes.get(String(evento.depois?.etiqueta_id)) ?? 'removida'}`;
      if (evento.tabela === 'pessoa' && evento.campos_alterados.length === 1 && evento.campos_alterados[0] === 'situacao' && porExtenso) {
        return `${quem} ${evento.depois?.situacao === 'inativa' ? 'inativou' : 'reativou'} ${porExtenso}`;
      }
      const mudancas = mudancasLegiveis(evento, nomes);
      if (porExtenso && mudancas) return `${quem} alterou ${porExtenso}: ${mudancas}${motivo}`;
      return `${quem} alterou um registro em ${onde}${registro}`;
    }
    case 'arquivou':
      if (ehCambio) return `${quem} removeu ${oCambio(evento.antes)}`;
      if (ehLigacao) {
        const { pessoa, area } = pessoaEArea(evento.antes, nomes);
        return `${quem} tirou ${pessoa} da área ${area}`;
      }
      if (ehRepresentante) return `${quem} tirou ${nomes.get(String(evento.antes?.pessoa_id)) ?? 'Pessoa removida'} como representante de ${nomes.get(String(evento.antes?.entidade_id)) ?? 'entidade removida'}`;
      if (ehVinculoDeEtiqueta) return `${quem} tirou um registro da etiqueta ${nomes.get(String(evento.antes?.etiqueta_id)) ?? 'removida'}`;
      if (porExtenso) return `${quem} arquivou ${porExtenso}${motivo}`;
      return `${quem} arquivou um registro em ${onde}${registro}${motivo}`;
    case 'restaurou':
      if (porExtenso) return `${quem} restaurou ${porExtenso}`;
      return `${quem} restaurou um registro em ${onde}${registro}`;
    default:
      return `${quem} fez uma alteração`;
  }
}

/** `quem` e `campos` alimentam os filtros do histórico (02 §6). */
export type LinhaHistorico = { id: string; texto: string; em: string; quem: string; campos: string[] };

/** Os nomes usados nas frases, inclusive de quem já foi arquivado. */
async function nomesDosRegistros(): Promise<Map<string, string>> {
  const [pessoas, areas, marcas, produtos, contrapartes, entidades, categorias, contas, feriados, etiquetas, atividades, itens, rotinas, ferramentas, categoriasDeFerramenta, ativos, titulos] = await Promise.all([
    repositorios.pessoa.listar({ incluirArquivados: true }),
    repositorios.area.listar({ incluirArquivados: true }),
    repositorios.marca.listar({ incluirArquivados: true }),
    repositorios.produto.listar({ incluirArquivados: true }),
    repositorios.contraparte.listar({ incluirArquivados: true }),
    repositorios.entidade.listar({ incluirArquivados: true }),
    repositorios.categoria_financeira.listar({ incluirArquivados: true }),
    repositorios.conta_financeira.listar({ incluirArquivados: true }),
    repositorios.feriado.listar({ incluirArquivados: true }),
    repositorios.etiqueta.listar({ incluirArquivados: true }),
    repositorios.atividade.listar({ incluirArquivados: true }),
    repositorios.checklist_item.listar({ incluirArquivados: true }),
    repositorios.recorrencia.listar({ incluirArquivados: true }),
    repositorios.ferramenta.listar({ incluirArquivados: true }),
    repositorios.categoria_ferramenta.listar({ incluirArquivados: true }),
    repositorios.ativo_digital.listar({ incluirArquivados: true }),
    repositorios.titulo.listar({ incluirArquivados: true }),
  ]);
  return new Map([...titulos.map((titulo): [string, string] => [titulo.id, titulo.descricao]), ...ativos.map((ativo): [string, string] => [ativo.id, ativo.identificador]), ...rotinas.map((rotina): [string, string] => [rotina.id, rotina.titulo]), ...[...ferramentas, ...categoriasDeFerramenta].map((linha): [string, string] => [linha.id, linha.nome]), ...pessoas.map((pessoa): [string, string] => [pessoa.id, pessoa.nome_completo]), ...[...areas, ...marcas, ...produtos, ...contrapartes, ...entidades, ...categorias, ...contas, ...feriados, ...etiquetas].map((registro): [string, string] => [registro.id, registro.nome]), ...atividades.map((atividade): [string, string] => [atividade.id, atividade.titulo]), ...itens.map((item): [string, string] => [item.id, item.texto])]);
}

function paraLinha(evento: EventoAuditoria, nomes: Nomes): LinhaHistorico {
  const legiveis = CAMPOS_LEGIVEIS[evento.tabela ?? ''] ?? {};
  return {
    id: evento.id,
    texto: descreverEvento(evento, nomes),
    em: evento.ocorrido_em,
    quem: evento.usuario_id === null ? 'Sistema' : (nomes.get(evento.usuario_id) ?? 'Pessoa removida'),
    campos: evento.campos_alterados.flatMap((campo) => {
      const legivel = legiveis[campo];
      return legivel ? [legivel.rotulo] : [];
    }),
  };
}

export async function historicoRecente(limite: number): Promise<LinhaHistorico[]> {
  const [eventos, nomes] = await Promise.all([listarHistorico({ limite }), nomesDosRegistros()]);
  return eventos.map((evento) => paraLinha(evento, nomes));
}

/** A última mudança de fase, mostrada na própria seção; `null` se a fase nunca mudou. */
export async function ultimaMudancaDeFase(): Promise<LinhaHistorico | null> {
  const [eventos, nomes] = await Promise.all([listarHistorico({ tabela: 'configuracao' }), nomesDosRegistros()]);
  const evento = eventos.find((item) => item.depois?.chave === 'fase_ativa');
  return evento ? paraLinha(evento, nomes) : null;
}

/** Painel da atividade (T03.02): ela e o que faz parte dela. */
export async function historicoDaAtividade(id: string): Promise<LinhaHistorico[]> {
  const [eventos, nomes, itens, comentarios, anexos, vinculos] = await Promise.all([
    listarHistorico(),
    nomesDosRegistros(),
    repositorios.checklist_item.listar({ onde: { registro_id: id }, incluirArquivados: true }),
    repositorios.comentario.listar({ onde: { registro_id: id }, incluirArquivados: true }),
    repositorios.anexo_link.listar({ onde: { registro_id: id }, incluirArquivados: true }),
    repositorios.vinculo.listar({ incluirArquivados: true }),
  ]);
  const dela = new Set([...itens, ...comentarios, ...anexos].map((linha) => linha.id));
  for (const vinculo of vinculos) if (vinculo.origem_id === id || vinculo.destino_id === id) dela.add(vinculo.id);
  return eventos
    .filter((evento) => {
      if (evento.tabela === 'atividade') return evento.registro_id === id;
      if (evento.tabela === 'atividade_produto' || evento.tabela === 'atividade_participante') return evento.depois?.atividade_id === id || evento.antes?.atividade_id === id;
      return Boolean(evento.registro_id && dela.has(evento.registro_id));
    })
    .map((evento) => paraLinha(evento, nomes));
}

/** Aba Histórico de uma ficha (P2): tudo o que aconteceu com aquele registro. */
export async function historicoDoRegistro(tabela: Tabela, id: string): Promise<LinhaHistorico[]> {
  const [eventos, nomes] = await Promise.all([listarHistorico({ tabela, registroId: id }), nomesDosRegistros()]);
  return eventos.map((evento) => paraLinha(evento, nomes));
}

/** Aba Histórico da ficha da pessoa (P2): o cadastro dela e as áreas em que entrou ou de que saiu. */
/** Aba Histórico da ferramenta: o cadastro, as assinaturas, os contextos e os links dela. */
export async function historicoDaFerramenta(id: string): Promise<LinhaHistorico[]> {
  const [eventos, nomes, assinaturas, contextos, anexos] = await Promise.all([listarHistorico(), nomesDosRegistros(), repositorios.assinatura_ferramenta.listar({ onde: { ferramenta_id: id }, incluirArquivados: true }), repositorios.ferramenta_contexto.listar({ onde: { ferramenta_id: id }, incluirArquivados: true }), repositorios.anexo_link.listar({ onde: { registro_id: id }, incluirArquivados: true })]);
  const dela = new Set([id, ...assinaturas, ...contextos, ...anexos].map((linha) => (typeof linha === 'string' ? linha : linha.id)));
  const valores = new Set(assinaturas.map((assinatura) => assinatura.id));
  return eventos.filter((evento) => Boolean(evento.registro_id && dela.has(evento.registro_id)) || (evento.tabela === 'assinatura_valor_historico' && valores.has(String(evento.depois?.assinatura_id)))).map((evento) => paraLinha(evento, nomes));
}

/** Aba Histórico do ativo: o cadastro e os links dele. */
export async function historicoDoAtivo(id: string): Promise<LinhaHistorico[]> {
  const [eventos, nomes, anexos] = await Promise.all([listarHistorico(), nomesDosRegistros(), repositorios.anexo_link.listar({ onde: { registro_id: id }, incluirArquivados: true })]);
  const dele = new Set([id, ...anexos.map((anexo) => anexo.id)]);
  return eventos.filter((evento) => Boolean(evento.registro_id && dele.has(evento.registro_id))).map((evento) => paraLinha(evento, nomes));
}

export async function historicoDaPessoa(id: string): Promise<LinhaHistorico[]> {
  const [eventos, nomes] = await Promise.all([listarHistorico(), nomesDosRegistros()]);
  const dela = eventos.filter((evento) => (evento.tabela === 'pessoa' && evento.registro_id === id) || (evento.tabela === 'pessoa_area' && (evento.depois?.pessoa_id === id || evento.antes?.pessoa_id === id)));
  return dela.map((evento) => paraLinha(evento, nomes));
}
