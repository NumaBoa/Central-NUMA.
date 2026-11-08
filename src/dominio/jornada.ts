/**
 * A jornada da empresa (01 §2): cada marco é verificável no sistema. Nada é marcado à mão nesta etapa: a situação sai dos
 * dados, para nunca dizer que algo aconteceu sem o registro. Critério que depende de módulo ainda não construído fica "Não
 * iniciado", com o motivo, e não vira atingido por falta de dado.
 */
import { repositorios } from '@/dados/repositorios';
import type { AtivoDigital } from '@/dados/tipos/ativo';
import type { Contrato } from '@/dados/tipos/contrato';
import type { Entidade } from '@/dados/tipos/contraparte';
import type { AssinaturaFerramenta, Ferramenta, FerramentaContexto } from '@/dados/tipos/ferramenta';
import type { ContaFinanceira } from '@/dados/tipos/financeiro';
import type { DocumentoLegal, DocumentoLegalVersao } from '@/dados/tipos/legal';
import type { Marca, Produto } from '@/dados/tipos/marca';
import type { Pessoa } from '@/dados/tipos/pessoa';
import type { Oferta, PrecoVersao } from '@/dados/tipos/precificacao';
import type { Acordo, AcordoVersao, MarcaPesquisa, MarcaProcesso } from '@/dados/tipos/sociedade';
import type { Baixa, Titulo } from '@/dados/tipos/titulo';
import type { CompetenciaFechamento } from '@/dados/tipos/fechamento';
import type { Repasse } from '@/dados/tipos/repasse';
import { hojeISO } from '@/lib/datas';
import { exigeParticipacao } from './acordos';
import { criticosPendentes, itensATransferir } from './ativos-a-transferir';
import { contaDaPj } from './constituicao';
import type { Fase } from './navegacao';

export type SituacaoDoMarco = 'atingido' | 'em_andamento' | 'nao_iniciado';

export type Marco = {
  codigo: string;
  nome: string;
  criterio: string;
  fase: Fase;
  situacao: SituacaoDoMarco;
  /** Só quando a data sai dos dados. */
  atingidoEm: string | null;
  /** O que falta, com números quando dá: "2 de 6 pesquisas". */
  detalhe: string;
  /** O link para o que falta (T06.01). */
  href: string | null;
};

export type DadosDaJornada = {
  ferramentas: Ferramenta[];
  assinaturas: AssinaturaFerramenta[];
  contextos: FerramentaContexto[];
  ativos: AtivoDigital[];
  titulos: Titulo[];
  baixas: Baixa[];
  contas: ContaFinanceira[];
  acordos: Acordo[];
  versoes: AcordoVersao[];
  produtos: Produto[];
  documentos: DocumentoLegal[];
  versoesLegais: DocumentoLegalVersao[];
  marcas: Marca[];
  pesquisas: MarcaPesquisa[];
  processos: MarcaProcesso[];
  ofertas: Oferta[];
  precos: PrecoVersao[];
  entidades: Entidade[];
  pessoas: Pessoa[];
  contratos: Contrato[];
  fechamentos: CompetenciaFechamento[];
  repasses: Repasse[];
};

export async function carregarDadosDaJornada(): Promise<DadosDaJornada> {
  const [ferramentas, assinaturas, contextos, ativos, titulos, baixas, contas, acordos, versoes, produtos, documentos, versoesLegais, marcas, pesquisas, processos, ofertas, precos, entidades, pessoas, contratos, fechamentos, repasses] = await Promise.all([
    repositorios.ferramenta.listar(),
    repositorios.assinatura_ferramenta.listar(),
    repositorios.ferramenta_contexto.listar(),
    repositorios.ativo_digital.listar(),
    repositorios.titulo.listar(),
    repositorios.baixa.listar(),
    repositorios.conta_financeira.listar(),
    repositorios.acordo_societario.listar(),
    repositorios.acordo_versao.listar(),
    repositorios.produto.listar(),
    repositorios.documento_legal.listar(),
    repositorios.documento_legal_versao.listar(),
    repositorios.marca.listar(),
    repositorios.marca_pesquisa.listar(),
    repositorios.marca_processo.listar(),
    repositorios.oferta.listar(),
    repositorios.preco_versao.listar(),
    repositorios.entidade.listar(),
    repositorios.pessoa.listar({ incluirArquivados: true }),
    repositorios.contrato.listar(),
    repositorios.competencia_fechamento.listar(),
    repositorios.repasse.listar(),
  ]);
  return { ferramentas, assinaturas, contextos, ativos, titulos, baixas, contas, acordos, versoes, produtos, documentos, versoesLegais, marcas, pesquisas, processos, ofertas, precos, entidades, pessoas, contratos, fechamentos, repasses };
}

const plural = (quantidade: number, singular: string, varios: string) => (quantidade === 1 ? singular : varios);

function situacaoPorContagem(feitos: number, total: number): SituacaoDoMarco {
  if (total > 0 && feitos === total) return 'atingido';
  return feitos > 0 ? 'em_andamento' : 'nao_iniciado';
}

/** ME-01: tudo o que está cadastrado tem titular (obrigatório) e custo: ferramenta precisa da assinatura, mesmo gratuita. */
function marco01({ ferramentas, assinaturas, ativos }: DadosDaJornada): Pick<Marco, 'situacao' | 'detalhe' | 'atingidoEm'> {
  const vivas = ferramentas.filter((ferramenta) => ferramenta.situacao !== 'cancelada');
  const comCusto = vivas.filter((ferramenta) => assinaturas.some((assinatura) => assinatura.ferramenta_id === ferramenta.id));
  const total = vivas.length + ativos.length;
  const feitos = comCusto.length + ativos.length;
  return { situacao: situacaoPorContagem(feitos, total), detalhe: `${feitos} de ${total} ferramentas e ativos com titular e custo`, atingidoEm: null };
}

/** ME-03: os últimos 3 meses. Lançado com comprovante e, se saiu da conta de uma sócia, com aporte ou reembolso. */
function marco03({ titulos, baixas, contas }: DadosDaJornada, hoje: string): Pick<Marco, 'situacao' | 'detalhe' | 'atingidoEm'> {
  const inicio = new Date(`${hoje}T00:00:00Z`);
  inicio.setUTCMonth(inicio.getUTCMonth() - 3);
  const desde = inicio.toISOString().slice(0, 10);
  const doPeriodo = titulos.filter((titulo) => titulo.natureza === 'pagar' && titulo.situacao !== 'cancelado' && titulo.situacao !== 'previsto' && titulo.vencimento >= desde && titulo.vencimento <= hoje);
  const pessoais = new Set(contas.filter((conta) => conta.tipo === 'pessoal_socia').map((conta) => conta.id));
  const completos = doPeriodo.filter((titulo) => {
    const pagamentos = baixas.filter((baixa) => baixa.titulo_id === titulo.id && baixa.tipo === 'pagamento');
    return titulo.situacao === 'quitado' && pagamentos.length > 0 && pagamentos.every((baixa) => baixa.comprovante_url && (!pessoais.has(baixa.conta_financeira_id) || baixa.tratamento));
  });
  return { situacao: situacaoPorContagem(completos.length, doPeriodo.length), detalhe: `${completos.length} de ${doPeriodo.length} despesas dos últimos 3 meses com comprovante e tratamento`, atingidoEm: null };
}

/** CA-06.01: memorando ou acordo de sócias em Vigente. */
function marco04({ acordos, versoes }: DadosDaJornada): Pick<Marco, 'situacao' | 'detalhe' | 'atingidoEm'> {
  const vigente = versoes.find((versao) => versao.situacao === 'vigente' && acordos.some((acordo) => acordo.id === versao.acordo_id && exigeParticipacao(acordo.tipo)));
  if (vigente) return { situacao: 'atingido', detalhe: `V${vigente.numero} vigente`, atingidoEm: vigente.data_assinatura };
  const emAndamento = versoes.some((versao) => ['em_revisao', 'aguardando_assinaturas'].includes(versao.situacao) && acordos.some((acordo) => acordo.id === versao.acordo_id && exigeParticipacao(acordo.tipo)));
  return { situacao: emAndamento ? 'em_andamento' : 'nao_iniciado', detalhe: emAndamento ? 'Memorando a caminho da vigência' : 'Nenhum memorando em revisão ou assinatura', atingidoEm: null };
}

/** Todo produto com usuários tem Termos e Privacidade publicados, e publicar exige a validação do M09. */
function marco05({ produtos, documentos, versoesLegais }: DadosDaJornada): Pick<Marco, 'situacao' | 'detalhe' | 'atingidoEm'> {
  const comUsuarios = produtos.filter((produto) => produto.tem_usuarios_reais && produto.situacao === 'ativo');
  const publicado = (produtoId: string, tipo: DocumentoLegal['tipo']) => documentos.some((documento) => documento.produto_id === produtoId && documento.tipo === tipo && versoesLegais.some((versao) => versao.id === documento.versao_vigente_id && versao.situacao === 'publicado'));
  const conformes = comUsuarios.filter((produto) => publicado(produto.id, 'termos_uso') && publicado(produto.id, 'privacidade'));
  return { situacao: situacaoPorContagem(conformes.length, comUsuarios.length), detalhe: `${conformes.length} de ${comUsuarios.length} produtos com usuários em conformidade`, atingidoEm: null };
}

/** "Marcas prioritárias" não está definido na especificação: por segurança, conta todas. Nunca diz atingido antes da hora. */
function marco06({ marcas, pesquisas, processos }: DadosDaJornada): Pick<Marco, 'situacao' | 'detalhe' | 'atingidoEm'> {
  const comPesquisa = marcas.filter((marca) => pesquisas.some((pesquisa) => pesquisa.marca_id === marca.id));
  const NAO_PROTOCOLADOS: readonly MarcaProcesso['situacao'][] = ['planejado', 'indeferido', 'arquivado'];
  const comPedido = marcas.filter((marca) => processos.some((processo) => processo.marca_id === marca.id && !NAO_PROTOCOLADOS.includes(processo.situacao)));
  const feitos = comPesquisa.length + comPedido.length;
  return { situacao: situacaoPorContagem(feitos, marcas.length * 2), detalhe: `${comPesquisa.length} de ${marcas.length} ${plural(marcas.length, 'pesquisa', 'pesquisas')} · ${comPedido.length} de ${marcas.length} ${plural(marcas.length, 'pedido', 'pedidos')} no INPI`, atingidoEm: null };
}

function marco07({ ofertas, precos }: DadosDaJornada): Pick<Marco, 'situacao' | 'detalhe' | 'atingidoEm'> {
  const aprovados = precos.filter((preco) => preco.simulacao_id && (preco.situacao === 'aprovada' || preco.situacao === 'substituida') && preco.aprovado_em).sort((a, b) => (a.aprovado_em as string).localeCompare(b.aprovado_em as string));
  if (aprovados[0]) return { situacao: 'atingido', detalhe: 'Preço aprovado com simulação vinculada', atingidoEm: (aprovados[0].aprovado_em as string).slice(0, 10) };
  return { situacao: ofertas.length ? 'em_andamento' : 'nao_iniciado', detalhe: ofertas.length ? `${ofertas.length} ${plural(ofertas.length, 'oferta', 'ofertas')}, nenhuma com preço aprovado` : 'Nenhuma oferta cadastrada', atingidoEm: null };
}

/** ME-08: entidade PJ Ativa, com regime tributário, conta PJ e contador. */
function marco08({ entidades, contas }: DadosDaJornada): Pick<Marco, 'situacao' | 'detalhe' | 'atingidoEm'> {
  const pj = entidades.filter((entidade) => entidade.tipo_pessoa === 'pj').sort((a, b) => Number(b.situacao === 'ativa') - Number(a.situacao === 'ativa') || Number(b.entidade_padrao) - Number(a.entidade_padrao))[0];
  const itens = [
    { rotulo: 'entidade Ativa', feito: pj?.situacao === 'ativa' },
    { rotulo: 'regime tributário', feito: Boolean(pj?.regime_tributario) },
    { rotulo: 'conta PJ', feito: contaDaPj(entidades, contas) },
    { rotulo: 'contador', feito: Boolean(pj?.contador_id) },
  ];
  const faltam = itens.filter((item) => !item.feito).map((item) => item.rotulo);
  const feitos = itens.length - faltam.length;
  return { situacao: situacaoPorContagem(feitos, itens.length), detalhe: faltam.length ? `Falta: ${faltam.join(', ')}` : 'Entidade Ativa, com regime, conta PJ e contador', atingidoEm: faltam.length ? null : (pj?.data_abertura ?? null) };
}

/** ME-09: sem PJ Ativa, não há para quem transferir. Sem pendência crítica, atingido. */
function marco09({ ativos, ferramentas, contextos, pessoas, entidades }: DadosDaJornada): Pick<Marco, 'situacao' | 'detalhe' | 'atingidoEm'> {
  const pendentes = criticosPendentes(itensATransferir({ ativos, ferramentas, contextos, pessoas }));
  const temPj = entidades.some((entidade) => entidade.tipo_pessoa === 'pj' && entidade.situacao === 'ativa');
  const texto = `${pendentes} ${plural(pendentes, 'ativo crítico pendente', 'ativos críticos pendentes')}`;
  if (!temPj) return { situacao: 'nao_iniciado', detalhe: `Depende da entidade Ativa · ${texto}`, atingidoEm: null };
  if (pendentes) return { situacao: 'em_andamento', detalhe: texto, atingidoEm: null };
  const ultima = ativos.reduce<string | null>((maior, ativo) => (ativo.critico && ativo.transferido_em && (!maior || ativo.transferido_em > maior) ? ativo.transferido_em : maior), null);
  return { situacao: 'atingido', detalhe: 'Nenhum ativo crítico pendente', atingidoEm: ultima };
}

/** ME-10: primeiro contrato assinado. A receita de adesão chega com o Receber (M05, F1). */
function marco10({ contratos }: DadosDaJornada): Pick<Marco, 'situacao' | 'detalhe' | 'atingidoEm'> {
  if (contratos.some((contrato) => contrato.situacao_documental === 'assinado')) return { situacao: 'atingido', detalhe: 'Contrato assinado', atingidoEm: null };
  const emCurso = contratos.some((contrato) => contrato.situacao_documental !== 'cancelado' && contrato.situacao_documental !== 'recusado');
  return { situacao: emCurso ? 'em_andamento' : 'nao_iniciado', detalhe: emCurso ? 'Contrato em andamento, ainda sem assinatura' : 'Nenhum contrato ainda', atingidoEm: null };
}

/** ME-11: competência fechada e pacote enviado ao contador (T05.10 e T05.11). */
function marco11({ fechamentos }: DadosDaJornada): Pick<Marco, 'situacao' | 'detalhe' | 'atingidoEm'> {
  const fechadas = fechamentos.filter((linha) => !linha.arquivado_em && linha.situacao === 'fechada').sort((a, b) => a.competencia.localeCompare(b.competencia));
  const completa = fechadas.find((linha) => (linha.envios_contador ?? []).length > 0);
  if (completa) return { situacao: 'atingido', detalhe: 'Competência fechada e pacote enviado ao contador', atingidoEm: completa.fechada_em?.slice(0, 10) ?? null };
  if (fechadas.length) return { situacao: 'em_andamento', detalhe: 'Competência fechada; falta registrar o envio ao contador', atingidoEm: null };
  return { situacao: fechamentos.some((linha) => !linha.arquivado_em) ? 'em_andamento' : 'nao_iniciado', detalhe: 'Nenhuma competência fechada ainda', atingidoEm: null };
}

/** ME-12: primeiro repasse a parceiro (T05.13). Clínica formalizada não tem registro próprio ainda. */
function marco12({ repasses }: DadosDaJornada): Pick<Marco, 'situacao' | 'detalhe' | 'atingidoEm'> {
  const primeiro = repasses.filter((linha) => !linha.arquivado_em && linha.situacao !== 'cancelado').sort((a, b) => a.periodo_fim.localeCompare(b.periodo_fim))[0];
  if (primeiro) return { situacao: 'atingido', detalhe: 'Primeiro repasse a parceiro gerado', atingidoEm: primeiro.criado_em?.slice(0, 10) ?? null };
  return { situacao: 'nao_iniciado', detalhe: 'Nenhum repasse a parceiro ainda', atingidoEm: null };
}

/** Os 12 marcos de 01 §2, na ordem. */
export function marcosDaJornada(dados: DadosDaJornada, hoje: string = hojeISO()): Marco[] {
  return [
    { codigo: 'ME-01', nome: 'Casa mapeada', criterio: 'Todas as ferramentas e ativos cadastrados, com titular e custo.', fase: 'f0a', href: '/ferramentas', ...marco01(dados) },
    { codigo: 'ME-02', nome: 'Duas chaves', criterio: 'Toda ferramenta crítica com as duas sócias como administradoras ou com recuperação documentada.', fase: 'f2', href: null, situacao: 'nao_iniciado', atingidoEm: null, detalhe: 'A gestão de acessos chega na Fase 2' },
    { codigo: 'ME-03', nome: 'Custos sob controle', criterio: 'Despesas dos últimos 3 meses lançadas, com comprovante e tratamento (aporte ou reembolso).', fase: 'f0a', href: '/financeiro', ...marco03(dados, hoje) },
    { codigo: 'ME-04', nome: 'Memorando assinado', criterio: 'Memorando ou acordo de sócias em situação Vigente, com arquivo vinculado.', fase: 'f0b', href: '/empresa/acordos', ...marco04(dados) },
    { codigo: 'ME-05', nome: 'Apps em conformidade', criterio: 'Todo produto com usuários tem Termos de Uso e Política de Privacidade publicados e validados.', fase: 'f0b', href: '/legal', ...marco05(dados) },
    { codigo: 'ME-06', nome: 'Nomes protegidos', criterio: 'Pesquisa de anterioridade feita para todas as marcas; pedido INPI protocolado para as marcas prioritárias.', fase: 'f0b', href: '/empresa/marcas', ...marco06(dados) },
    { codigo: 'ME-07', nome: 'Primeiro preço', criterio: 'Pelo menos uma oferta com preço Aprovado e simulação vinculada.', fase: 'f0b', href: '/produtos', ...marco07(dados) },
    { codigo: 'ME-08', nome: 'Empresa constituída', criterio: 'Entidade PJ Ativa, com regime tributário, conta PJ e contador cadastrados.', fase: 'f1', href: '/empresa/entidade', ...marco08(dados) },
    { codigo: 'ME-09', nome: 'Ativos transferidos', criterio: 'Nenhum ativo crítico com titular diferente da Numa.', fase: 'f1', href: '/empresa/ativos', ...marco09(dados) },
    { codigo: 'ME-10', nome: 'Primeira venda', criterio: 'Primeiro contrato assinado ou primeira receita de adesão registrada.', fase: 'f1', href: '/contratos', ...marco10(dados) },
    { codigo: 'ME-11', nome: 'Primeiro fechamento', criterio: 'Primeiro fechamento mensal concluído e pacote enviado ao contador.', fase: 'f1', href: '/financeiro/fechamento', ...marco11(dados) },
    { codigo: 'ME-12', nome: 'Ecossistema', criterio: 'Primeiro parceiro com repasse ou clínica formalizado.', fase: 'f2', href: '/financeiro/repasses', ...marco12(dados) },
  ];
}

export const marcosAtingidos = (marcos: readonly Pick<Marco, 'situacao'>[]) => marcos.filter((marco) => marco.situacao === 'atingido').length;

/** O próximo a olhar: o primeiro em andamento e, se não houver, o primeiro não iniciado que já tem onde agir. */
export function proximoMarco<T extends Pick<Marco, 'situacao' | 'href'>>(marcos: readonly T[]): T | null {
  return marcos.find((marco) => marco.situacao === 'em_andamento') ?? marcos.find((marco) => marco.situacao === 'nao_iniciado' && marco.href) ?? null;
}
