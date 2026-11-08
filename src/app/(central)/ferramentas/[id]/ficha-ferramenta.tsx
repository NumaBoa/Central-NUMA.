'use client';

import { EntradaData } from '@/componentes/campos/entrada-data';
import { CampoEtiquetas } from '@/componentes/campos/etiquetas';
import { definirEtiquetasDoRegistro } from '@/dominio/etiquetas';
import { useEffect, useState, type ReactNode } from 'react';
import { useParams } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArchiveRestore, ArrowLeft, ArrowRight, CalendarClock, ChevronDown, CircleCheck, CircleDot, ExternalLink, Globe, Info, Link2, Pencil, Plus, ReceiptText, Settings, TriangleAlert, Trash2, Wrench } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { AbaAtividades } from '@/componentes/atividades/aba-atividades';
import { Campo, MensagemErro } from '@/componentes/campos/campo';
import { EntradaLinkDrive } from '@/componentes/campos/link-drive';
import { Pilulas, PilulasMultiplas } from '@/componentes/campos/pilulas';
import { Selecao } from '@/componentes/campos/selecao';
import { EtiquetaCritica, SituacaoDaTransferencia } from '@/componentes/ferramentas/etiquetas-ferramentas';
import { FormularioDeFerramenta } from '@/componentes/ferramentas/formulario-ferramenta';
import { JanelaDeAcao } from '@/componentes/ferramentas/janela-acao';
import { DialogoDeBaixa } from '@/componentes/financeiro/dialogo-baixa';
import { CAMINHO_DE_FERRAMENTAS } from '@/componentes/ferramentas/nova-ferramenta';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { aviso } from '@/componentes/padroes/aviso';
import { Confirmacao } from '@/componentes/padroes/confirmacao';
import { Dado, ListaDeDados } from '@/componentes/padroes/dado';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { EtiquetaContexto, EtiquetaLivre, EtiquetaSituacao, type TipoSituacao } from '@/componentes/padroes/etiquetas';
import { Faixa } from '@/componentes/padroes/faixa';
import { Ficha } from '@/componentes/padroes/ficha';
import { ListaHistorico } from '@/componentes/padroes/historico';
import { CLASSE_LINHA_MENU, MenuSobreposto } from '@/componentes/padroes/menu-sobreposto';
import { JanelaFormulario } from '@/componentes/padroes/janela-formulario';
import { Pessoa as NomeDaPessoa } from '@/componentes/padroes/pessoa';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/componentes/ui/tabs';
import { Textarea } from '@/componentes/ui/textarea';
import { mensagemDoErro } from '@/dados/erros';
import type { AssinaturaFerramenta } from '@/dados/tipos/ferramenta';
import { TIPOS_DE_DADOS } from '@/dados/tipos/ferramenta';
import type { Titulo } from '@/dados/tipos/titulo';
import { useConsulta } from '@/dados/use-consulta';
import { atividadesDoRegistro } from '@/dominio/atividades-painel';
import { ativosDaFerramenta, ROTULOS_TIPO_ATIVO } from '@/dominio/ativos';
import { ID_INSTITUCIONAL } from '@/dominio/contextos';
import { nomeDaContraparte } from '@/dominio/contrapartes';
import {
  adicionarLinkDaFerramenta,
  arquivarFerramenta,
  cancelarFerramenta,
  carregarFerramentas,
  carregarFichaDaFerramenta,
  definirRateio,
  erroDoRateio,
  esquemaDadosPessoais,
  formularioDosDadosPessoais,
  linksDaFerramenta,
  removerLinkDaFerramenta,
  restaurarFerramenta,
  ROTULOS_ACORDO_DADOS,
  ROTULOS_MFA,
  ROTULOS_MODALIDADE,
  ROTULOS_PERIODICIDADE,
  ROTULOS_RENOVACAO,
  ROTULOS_TIPOS_DADOS,
  salvarDadosPessoais,
  ultimoCambio,
  type DadosDasFerramentas,
  type FormularioDadosPessoais,
  type LinhaDaFerramenta,
} from '@/dominio/ferramentas';
import { carregarFinanceiroDaFerramenta, lancamentosParaVincular, pagamentoEfetivo, pendenciasDaFerramenta, previaDoCancelamento, proximoEmAberto, ROTULOS_EFEITO_CANCELAMENTO, titularidade, ultimoPagamento, vincularLancamento, type EfeitoDoCancelamento, type FinanceiroDaFerramenta, type Titularidade } from '@/dominio/ferramentas-ficha';
import { historicoDaFerramenta } from '@/dominio/historico';
import type { LinhaDoTitulo } from '@/dominio/lancamentos';
import { ROTULOS_SITUACAO_TITULO } from '@/dominio/titulos';
import { valorParaCampo } from '@/dominio/dinheiro';
import { textoDoTitular } from '@/dominio/titularidade';
import { hojeISO } from '@/lib/datas';
import { formatarData, formatarDiaISO, formatarDinheiro } from '@/lib/formatacao';
import { cn } from '@/lib/utils';
import { contextosDaFerramenta, SituacaoDaFerramenta, textoDoValor } from '../tela-ferramentas';

const paraOpcoes = (rotulos: Record<string, string>) => Object.entries(rotulos).map(([valor, rotulo]) => ({ valor, rotulo }));
const listaDeNomes = (nomes: readonly string[]) => (nomes.length <= 1 ? (nomes[0] ?? '') : `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`);

function BotaoAbrir({ url, rotulo, icone = <ExternalLink aria-hidden /> }: { url: string | null; rotulo: string; icone?: ReactNode }) {
  if (!url) return null;
  return (
    <Button asChild variante="secundario" tamanho="pequeno">
      <a href={url} target="_blank" rel="noopener noreferrer">
        {icone}
        {rotulo}
      </a>
    </Button>
  );
}

/** Um cartão do resumo: ícone, título e o conteúdo, como informação (não como campo). */
function Cartao({ icone: Icone, titulo, children, className }: { icone: typeof Info; titulo: string; children: ReactNode; className?: string }) {
  return (
    <section aria-label={titulo} className={cn('rounded-lg border border-line bg-paper p-4 md:p-5', className)}>
      <h3 className="flex items-center gap-2 text-[15px]">
        <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-md bg-indigo-wash text-primary [&_svg]:size-4">
          <Icone />
        </span>
        {titulo}
      </h3>
      <div className="mt-3 text-[13px] leading-5">{children}</div>
    </section>
  );
}

const TIPOS_DA_TITULARIDADE: Readonly<Record<Titularidade['estado'], TipoSituacao>> = { igual: 'sucesso', aguarda_entidade: 'info', pendente: 'atencao' };
const ROTULOS_DA_TITULARIDADE: Readonly<Record<Titularidade['estado'], string>> = { igual: 'Não precisa transferir', aguarda_entidade: 'A planejar', pendente: 'Transferência pendente' };

function TextoDaTitularidade({ dono }: { dono: Titularidade }) {
  return (
    <span className="grid justify-items-start gap-1">
      <EtiquetaSituacao tipo={TIPOS_DA_TITULARIDADE[dono.estado]}>{ROTULOS_DA_TITULARIDADE[dono.estado]}</EtiquetaSituacao>
      {dono.estado !== 'igual' && <span className="text-[13px] text-ink-soft">{dono.texto}</span>}
    </span>
  );
}

/** Autenticação em duas etapas, com texto e ícone: a cor nunca é a única informação. */
function DuasEtapas({ valor, critica }: { valor: LinhaDaFerramenta['mfa_conta']; critica: boolean }) {
  if (valor === 'sim') return <EtiquetaSituacao tipo="sucesso">Sim</EtiquetaSituacao>;
  if (valor === 'nao') return <EtiquetaSituacao tipo={critica ? 'erro' : 'atencao'}>Não</EtiquetaSituacao>;
  return <EtiquetaSituacao tipo="neutro">{ROTULOS_MFA.desconhecido}</EtiquetaSituacao>;
}

// ---------- Resumo ----------

function CartaoProximaCobranca({ ferramenta, dados }: { ferramenta: LinhaDaFerramenta; dados: DadosDasFerramentas }) {
  const assinatura = ferramenta.assinatura;
  if (!assinatura) return <p className="text-ink-soft">Custo a definir: ainda não se sabe se é gratuita, paga ou em teste.</p>;
  if (assinatura.modalidade === 'gratuita') return <p className="text-ink-soft">Gratuita: não gera cobrança nem lançamento.</p>;
  if (assinatura.modalidade === 'teste')
    return (
      <p>
        Em teste até <strong className="tabular-nums">{assinatura.fim_teste ? formatarDiaISO(assinatura.fim_teste) : 'data não informada'}</strong>.
        <span className="block text-ink-soft">Depois do teste: {assinatura.valor_apos_teste !== null ? formatarDinheiro(assinatura.valor_apos_teste, assinatura.moeda) : 'valor a confirmar'}.</span>
      </p>
    );
  const cambio = assinatura.moeda !== 'BRL' ? ultimoCambio(assinatura.moeda, dados.cambios) : null;
  return (
    <div className="grid gap-1">
      <p className="flex flex-wrap items-baseline justify-between gap-x-3">
        <strong className="font-display text-[22px] leading-7 tabular-nums">{assinatura.valor === null ? 'A confirmar' : formatarDinheiro(assinatura.valor, assinatura.moeda)}</strong>
        <span className="tabular-nums">{assinatura.proxima_cobranca ? formatarDiaISO(assinatura.proxima_cobranca) : 'Sem data (por uso)'}</span>
      </p>
      <p className="text-ink-soft">
        {assinatura.periodicidade ? ROTULOS_PERIODICIDADE[assinatura.periodicidade] : 'Periodicidade não informada'}
        {assinatura.renovacao ? ` · renovação ${ROTULOS_RENOVACAO[assinatura.renovacao].toLowerCase()}` : ''}
      </p>
      {ferramenta.equivalenteMensal !== null && (assinatura.moeda !== 'BRL' || assinatura.periodicidade !== 'mensal') && (
        <p className="text-ink-soft">
          Estimado: {formatarDinheiro(ferramenta.equivalenteMensal, 'BRL')} por mês{cambio !== null ? `, pelo câmbio de referência (1 ${assinatura.moeda} = ${formatarDinheiro(cambio, 'BRL')})` : ''}. Não é pagamento.
        </p>
      )}
      {assinatura.valor !== null && ferramenta.equivalenteMensal === null && assinatura.moeda !== 'BRL' && <p className="text-ink-soft">Sem estimativa em reais: falta o câmbio de referência de {assinatura.moeda} em Configurações.</p>}
    </div>
  );
}

function CartaoUltimoPagamento({ financeiro }: { financeiro: FinanceiroDaFerramenta | undefined }) {
  if (!financeiro) return <p className="text-ink-soft">Lendo o Financeiro…</p>;
  const ultimo = ultimoPagamento(financeiro.titulos);
  if (!ultimo) return <p className="text-ink-soft">Nenhum pagamento registrado no Financeiro.</p>;
  return (
    <div className="grid gap-1">
      <p className="flex flex-wrap items-baseline gap-x-2">
        <strong className="font-display text-[22px] leading-7 tabular-nums">{formatarDinheiro(ultimo.pagamento.valorBrl, 'BRL')}</strong>
        <span className="text-ink-soft">efetivos</span>
      </p>
      <p className="text-ink-soft tabular-nums">
        Pago em {formatarDiaISO(ultimo.pagamento.data)} · vencimento previsto {formatarDiaISO(ultimo.titulo.vencimento)}
        {ultimo.titulo.moeda !== 'BRL' ? ` · ${formatarDinheiro(ultimo.pagamento.valorMoeda, ultimo.titulo.moeda)} na moeda original` : ''}
      </p>
      <LinkCentral href={`/financeiro/${ultimo.titulo.id}`} className="inline-flex min-h-11 items-center gap-1 text-primary underline-offset-2 hover:underline md:min-h-0">
        Abrir o lançamento {ultimo.titulo.codigo}
      </LinkCentral>
    </div>
  );
}

function Resumo({ ferramenta, dados, financeiro }: { ferramenta: LinhaDaFerramenta; dados: DadosDasFerramentas; financeiro: FinanceiroDaFerramenta | undefined }) {
  const fornecedor = dados.contrapartes.find((contraparte) => contraparte.id === ferramenta.fornecedor_id);
  const editavel = !ferramenta.arquivado_em && ferramenta.situacao !== 'cancelada';
  const entidades = financeiro?.entidades ?? [];
  const dono = titularidade(ferramenta, dados.pessoas, entidades);
  const categoria = dados.categorias.find((item) => item.id === ferramenta.categoria_id)?.nome;
  return (
    <div className="grid min-w-0 gap-4">
      <section aria-label="Identificação" className="rounded-lg border border-line bg-paper p-4 md:p-5">
        <p className="text-xs font-semibold text-ink-soft">{categoria ?? 'Categoria removida'}</p>
        <p className="mt-1 font-display text-lg leading-6 font-[650]">{ferramenta.finalidade}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <BotaoAbrir url={ferramenta.url_acesso} rotulo="Abrir serviço" />
          <BotaoAbrir url={ferramenta.url_admin} rotulo="Administração" icone={<Settings aria-hidden />} />
        </div>
        <dl className="mt-4">
          <Dado rotulo="Fornecedor">
            {fornecedor && (
              <LinkCentral href={`/configuracoes/cadastros/contrapartes/${fornecedor.id}`} className="inline-flex min-h-11 items-center underline md:min-h-0">
                {nomeDaContraparte(fornecedor)}
              </LinkCentral>
            )}
          </Dado>
          <Dado rotulo="Ambiente ou workspace">{ferramenta.ambiente}</Dado>
          <Dado rotulo="Login da conta">{ferramenta.email_login_conta}</Dado>
        </dl>
      </section>
      <ListaDeDados>
        <Dado rotulo="Titular atual">{textoDoTitular(ferramenta, dados.pessoas)}</Dado>
        <Dado rotulo="Titular desejado">{ferramenta.titular_desejado}</Dado>
        <Dado rotulo="Titularidade">{financeiro ? <TextoDaTitularidade dono={dono} /> : null}</Dado>
        <Dado rotulo="Autenticação em duas etapas">
          <DuasEtapas valor={ferramenta.mfa_conta} critica={ferramenta.critica} />
        </Dado>
        <Dado rotulo="Caminho de recuperação">{ferramenta.caminho_recuperacao}</Dado>
        {ferramenta.referencia_cofre && <Dado rotulo="Referência ao cofre">{ferramenta.referencia_cofre}</Dado>}
        <Dado rotulo="Observações">{ferramenta.observacoes}</Dado>
        {ferramenta.situacao === 'cancelada' && (
          <Dado rotulo="Cancelada">
            {ferramenta.cancelada_em ? formatarDiaISO(ferramenta.cancelada_em) : ''}
            {ferramenta.cancelamento_motivo ? ` · ${ferramenta.cancelamento_motivo}` : ''}
          </Dado>
        )}
      </ListaDeDados>
      <div className="rounded-lg border border-line bg-paper p-4 md:p-5">
        <CampoEtiquetas
          etiquetas={dados.etiquetas}
          modulo="ferramentas"
          desativado={!editavel}
          valores={ferramenta.etiquetas}
          aoMudar={(valores) => {
            definirEtiquetasDoRegistro('ferramenta', ferramenta.id, valores).catch((erro: unknown) => aviso(mensagemDoErro(erro)));
          }}
        />
      </div>
    </div>
  );
}

/** À direita da ficha, em todas as abas (no celular, abaixo): cobrança, pagamento e o que falta. */
function LateralDaFerramenta({ ferramenta, dados, financeiro }: { ferramenta: LinhaDaFerramenta; dados: DadosDasFerramentas; financeiro: FinanceiroDaFerramenta | undefined }) {
  const editavel = !ferramenta.arquivado_em && ferramenta.situacao !== 'cancelada';
  const entidades = financeiro?.entidades ?? [];
  const pendencias = financeiro ? pendenciasDaFerramenta(ferramenta, dados.pessoas, entidades) : [];
  const produtos = contextosDaFerramenta(ferramenta, dados).map((item) => item.nome);
  return (
    <>
      <Cartao icone={CalendarClock} titulo="Próxima cobrança">
        <CartaoProximaCobranca ferramenta={ferramenta} dados={dados} />
      </Cartao>
      <Cartao icone={ReceiptText} titulo="Último pagamento">
        <CartaoUltimoPagamento financeiro={financeiro} />
      </Cartao>
      <Cartao icone={CircleCheck} titulo="O que falta">
        {pendencias.length ? (
          <ul className="grid gap-2">
            {pendencias.map((pendencia) => (
              <li key={pendencia.id} className="flex items-start gap-2">
                {pendencia.tom === 'atencao' ? <TriangleAlert aria-label="Atenção" className="mt-0.5 size-4 shrink-0 text-warn" /> : <CircleDot aria-label="Para fazer" className="mt-0.5 size-4 shrink-0 text-info" />}
                <span>{pendencia.texto}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ink-soft">{financeiro ? 'Nada pendente no cadastro.' : 'Lendo…'}</p>
        )}
      </Cartao>
      {ferramenta.critica && editavel && produtos.length > 0 && (
        <Faixa tipo="atencao">
          Crítica: a indisponibilidade pode afetar {listaDeNomes(produtos)}.
        </Faixa>
      )}
  </>
  );
}

// ---------- Assinatura e custos ----------

const TIPOS_DA_SITUACAO_DO_TITULO: Readonly<Record<Titulo['situacao'], TipoSituacao>> = { previsto: 'info', aberto: 'atencao', parcial: 'atencao', quitado: 'sucesso', cancelado: 'neutro' };

function SituacaoDoTitulo({ situacao }: { situacao: Titulo['situacao'] }) {
  return <EtiquetaSituacao tipo={TIPOS_DA_SITUACAO_DO_TITULO[situacao]}>{ROTULOS_SITUACAO_TITULO[situacao]}</EtiquetaSituacao>;
}

/** Previsto × efetivo (RN-04.06): vencimento e valor original de um lado, data e valor pago em reais do outro. */
function LancamentosVinculados({ titulos }: { titulos: readonly LinhaDoTitulo[] }) {
  if (!titulos.length) return <p className="text-sm text-ink-soft">Nenhum lançamento ainda. Gratuita e custo a definir não geram lançamentos; paga sem valor só gera depois do valor confirmado.</p>;
  return (
    <>
      <table className="hidden w-full text-left text-[13px] md:table">
        <caption className="sr-only">Lançamentos vinculados: previsto e efetivo</caption>
        <thead className="text-xs text-ink-soft">
          <tr className="border-b border-line">
            <th scope="col" className="py-2 pr-3 font-semibold">Vencimento previsto</th>
            <th scope="col" className="py-2 pr-3 font-semibold">Situação</th>
            <th scope="col" className="py-2 pr-3 text-right font-semibold">Valor original</th>
            <th scope="col" className="py-2 pr-3 font-semibold">Pagamento efetivo</th>
            <th scope="col" className="py-2 text-right font-semibold">Valor efetivo em reais</th>
          </tr>
        </thead>
        <tbody>
          {titulos.map((titulo) => {
            const pago = pagamentoEfetivo(titulo.baixas);
            return (
              <tr key={titulo.id} className="border-b border-line last:border-b-0">
                <td className="py-2.5 pr-3">
                  <LinkCentral href={`/financeiro/${titulo.id}`} className="font-medium tabular-nums underline-offset-2 hover:underline">
                    {formatarDiaISO(titulo.vencimento)}
                  </LinkCentral>
                  <span className="block text-xs text-ink-soft">{titulo.codigo}</span>
                </td>
                <td className="py-2.5 pr-3">
                  <SituacaoDoTitulo situacao={titulo.situacao} />
                </td>
                <td className="py-2.5 pr-3 text-right tabular-nums">{formatarDinheiro(titulo.valor, titulo.moeda)}</td>
                <td className="py-2.5 pr-3 tabular-nums">{pago ? formatarDiaISO(pago.data) : <span className="text-ink-soft">—</span>}</td>
                <td className="py-2.5 text-right tabular-nums">{pago ? formatarDinheiro(pago.valorBrl, 'BRL') : <span className="text-ink-soft">Não pago</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <ul className="grid gap-2 md:hidden" aria-label="Lançamentos vinculados">
        {titulos.map((titulo) => {
          const pago = pagamentoEfetivo(titulo.baixas);
          return (
            <li key={titulo.id} className="rounded-md border border-line bg-paper px-3.5 py-3 text-[13px]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <LinkCentral href={`/financeiro/${titulo.id}`} className="inline-flex min-h-11 items-center font-medium tabular-nums underline">
                  Vence {formatarDiaISO(titulo.vencimento)}
                </LinkCentral>
                <SituacaoDoTitulo situacao={titulo.situacao} />
              </div>
              <p className="tabular-nums">Valor original: {formatarDinheiro(titulo.valor, titulo.moeda)}</p>
              <p className="text-ink-soft tabular-nums">{pago ? `Pago em ${formatarDiaISO(pago.data)}: ${formatarDinheiro(pago.valorBrl, 'BRL')}` : 'Não pago'}</p>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function Recolhivel({ titulo, quantos, children }: { titulo: string; quantos: number; children: ReactNode }) {
  return (
    <details className="group rounded-lg border border-line bg-paper">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 text-[15px] font-semibold md:px-5 [&::-webkit-details-marker]:hidden">
        <span>
          {titulo} <span className="text-[13px] font-normal text-ink-soft tabular-nums">({quantos})</span>
        </span>
        <ChevronDown aria-hidden className="size-4 transition-transform group-open:rotate-180" />
      </summary>
      <div className="px-4 pb-4 md:px-5">{children}</div>
    </details>
  );
}

function AbaAssinatura({ ferramenta, dados, financeiro, aoVincular, editavel }: { ferramenta: LinhaDaFerramenta; dados: DadosDasFerramentas; financeiro: FinanceiroDaFerramenta | undefined; aoVincular: () => void; editavel: boolean }) {
  const consulta = useConsulta(() => carregarFichaDaFerramenta(ferramenta.id), [ferramenta.id]);
  const assinatura = ferramenta.assinatura;
  if (!consulta.dados || !financeiro) return <EstadoCarregando linhas={2} />;
  const anteriores = consulta.dados.assinaturas.filter((item) => item.situacao === 'encerrada');
  const conta = dados.contas.find((item) => item.id === assinatura?.conta_financeira_id)?.nome;
  const categoria = dados.categoriasFinanceiras.find((item) => item.id === assinatura?.categoria_financeira_id)?.nome;
  const financeira = dados.pessoas.find((pessoa) => pessoa.id === ferramenta.responsavel_financeiro_id)?.nome_completo;
  const cambio = assinatura && assinatura.moeda !== 'BRL' ? dados.cambios.filter((item) => item.moeda === assinatura.moeda).sort((a, b) => b.data_referencia.localeCompare(a.data_referencia))[0] : undefined;
  const paga = assinatura?.modalidade === 'paga';
  return (
    <div className="grid gap-4">
      {assinatura ? (
        <section aria-label="Assinatura em uso" className="rounded-lg border border-line bg-paper p-4 md:p-5">
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            <Celula rotulo="Modalidade">{ROTULOS_MODALIDADE[assinatura.modalidade]}</Celula>
            {assinatura.modalidade !== 'gratuita' && <Celula rotulo="Plano">{assinatura.plano}</Celula>}
            {paga && (
              <>
                <Celula rotulo="Valor">{textoDoValor(ferramenta)}</Celula>
                <Celula rotulo="Renovação">{assinatura.renovacao ? `${ROTULOS_RENOVACAO[assinatura.renovacao]}${assinatura.proxima_cobranca ? ` · próxima ${formatarDiaISO(assinatura.proxima_cobranca)}` : ''}` : assinatura.periodicidade === 'por_uso' ? 'Não se aplica (por uso)' : null}</Celula>
                <Celula rotulo="Dia de cobrança">{assinatura.dia_cobranca}</Celula>
                <Celula rotulo="Prazo para cancelar">{assinatura.aviso_cancelamento_dias !== null ? `${assinatura.aviso_cancelamento_dias} dias antes da renovação` : null}</Celula>
                <Celula rotulo="Conta de pagamento">{conta}</Celula>
                <Celula rotulo="Categoria financeira">{categoria}</Celula>
                <Celula rotulo="Responsável financeira">{financeira}</Celula>
                <Celula rotulo="Geração de lançamentos">{assinatura.gerar_titulos ? <EtiquetaSituacao tipo="sucesso">Ligada</EtiquetaSituacao> : <EtiquetaSituacao tipo="neutro">Desligada</EtiquetaSituacao>}</Celula>
              </>
            )}
            {assinatura.modalidade === 'teste' && (
              <>
                <Celula rotulo="Fim do teste">{assinatura.fim_teste && formatarDiaISO(assinatura.fim_teste)}</Celula>
                <Celula rotulo="Valor depois do teste">{assinatura.valor_apos_teste !== null ? formatarDinheiro(assinatura.valor_apos_teste, assinatura.moeda) : 'A confirmar'}</Celula>
              </>
            )}
            {assinatura.modalidade !== 'gratuita' && <Celula rotulo="Licenças">{assinatura.licencas}</Celula>}
            <Celula rotulo="Data da contratação">{assinatura.data_contratacao && formatarDiaISO(assinatura.data_contratacao)}</Celula>
          </dl>
          {paga && (
            <p className="mt-4 flex items-start gap-2 rounded-md bg-mist px-3.5 py-2.5 text-[13px] leading-5 text-ink-soft">
              <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span>
                {ferramenta.equivalenteMensal !== null
                  ? `Equivalente mensal estimado: ${formatarDinheiro(ferramenta.equivalenteMensal, 'BRL')}${cambio ? `, pelo câmbio de referência de ${formatarDiaISO(cambio.data_referencia)} (1 ${cambio.moeda} = ${formatarDinheiro(cambio.valor_brl, 'BRL')})` : ''}. `
                  : assinatura.valor === null
                    ? 'Sem estimativa enquanto o valor estiver a confirmar. '
                    : assinatura.periodicidade === 'por_uso'
                      ? 'Por uso: sem estimativa mensal. '
                      : `Sem estimativa em reais: falta o câmbio de referência de ${assinatura.moeda}. `}
                {assinatura.periodicidade && assinatura.periodicidade !== 'mensal' && assinatura.periodicidade !== 'por_uso' ? `A cobrança continua ${ROTULOS_PERIODICIDADE[assinatura.periodicidade].toLowerCase()}: o valor mensal é só referência. ` : ''}
                O valor pago de verdade vem da baixa no Financeiro.
              </span>
            </p>
          )}
        </section>
      ) : (
        <EstadoVazio icone={Wrench} titulo="O custo ainda está a definir." texto="Edite a ferramenta para dizer se é gratuita, paga ou em teste." />
      )}
      <section aria-label="Lançamentos vinculados" className="rounded-lg border border-line bg-paper p-4 md:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[15px]">Lançamentos vinculados</h3>
          {paga && editavel && (
            <Button variante="terciario" tamanho="pequeno" onClick={aoVincular}>
              <Link2 aria-hidden />
              Vincular lançamento existente
            </Button>
          )}
        </div>
        <LancamentosVinculados titulos={financeiro.titulos} />
        <p className="mt-3 text-xs text-ink-soft">Gerar lançamentos não registra pagamento. Uma cobrança já lançada no Financeiro é vinculada, e não criada de novo.</p>
      </section>
      {consulta.dados.valores.length > 0 && (
        <Recolhivel titulo="Histórico de valores" quantos={consulta.dados.valores.length}>
          <ul className="grid gap-2 text-[13px]">
            {consulta.dados.valores.map((valor) => (
              <li key={valor.id} className="rounded-md border border-line px-3.5 py-2.5">
                <span className="font-medium tabular-nums">
                  {valor.valor_anterior !== null ? formatarDinheiro(valor.valor_anterior, valor.moeda) : 'A confirmar'} → {formatarDinheiro(valor.valor_novo, valor.moeda)}
                </span>
                <span className="block text-xs text-ink-soft">
                  A partir de {formatarDiaISO(valor.efeito_em)} · {valor.motivo}
                </span>
              </li>
            ))}
          </ul>
        </Recolhivel>
      )}
      {anteriores.length > 0 && (
        <Recolhivel titulo="Assinaturas anteriores" quantos={anteriores.length}>
          <ul className="grid gap-2 text-[13px]">
            {anteriores.map((item: AssinaturaFerramenta) => (
              <li key={item.id} className="rounded-md border border-line px-3.5 py-2.5">
                <span className="font-medium">
                  {ROTULOS_MODALIDADE[item.modalidade]}
                  {item.plano ? ` · ${item.plano}` : ''}
                  {item.valor !== null ? ` · ${formatarDinheiro(item.valor, item.moeda)}` : ''}
                  {item.periodicidade ? ` · ${ROTULOS_PERIODICIDADE[item.periodicidade]}` : ''}
                </span>
                <span className="block text-xs text-ink-soft">
                  De {formatarDiaISO(item.inicio)} a {item.fim ? formatarDiaISO(item.fim) : 'hoje'}
                </span>
              </li>
            ))}
          </ul>
        </Recolhivel>
      )}
    </div>
  );
}

function Celula({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[13px] text-ink-soft">{rotulo}</dt>
      <dd className="mt-0.5 text-sm font-medium break-words">{children ?? <span className="font-normal text-ink-soft">Não informado</span>}</dd>
    </div>
  );
}

// ---------- Produtos e rateio ----------

/** RN-04.05: percentuais somando 100%, incluindo a Numa, ou todos vazios. */
function AbaRateio({ ferramenta, dados, somenteLeitura }: { ferramenta: LinhaDaFerramenta; dados: DadosDasFerramentas; somenteLeitura: boolean }) {
  const inicial = () => Object.fromEntries(ferramenta.contextos.map((ligacao) => [ligacao.id, ligacao.percentual_rateio !== null ? valorParaCampo(ligacao.percentual_rateio) : '']));
  const assinaturaDosPercentuais = ferramenta.contextos.map((ligacao) => `${ligacao.id}:${ligacao.percentual_rateio}`).join('|');
  const [valores, setValores] = useState<Record<string, string>>(inicial);
  const [desde, setDesde] = useState(hojeISO());
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => setValores(inicial()), [assinaturaDosPercentuais]); // eslint-disable-line react-hooks/exhaustive-deps -- `inicial` lê a ferramenta atual

  const nomes = contextosDaFerramenta(ferramenta, dados);
  const linhas = ferramenta.contextos.map((ligacao) => ({ ligacaoId: ligacao.id, percentual: valores[ligacao.id] ?? '' }));
  const semRateio = ferramenta.contextos.every((ligacao) => ligacao.percentual_rateio === null);
  const principal = nomes[0]?.nome;
  const vigente = ferramenta.contextos.map((ligacao) => ligacao.vigente_desde).sort().at(-1);

  async function salvar() {
    const falha = erroDoRateio(linhas);
    setErro(falha);
    if (falha) return;
    try {
      await definirRateio(linhas, desde);
      aviso('Rateio salvo.');
    } catch (problema) {
      setErro(mensagemDoErro(problema));
    }
  }

  return (
    <div className="grid gap-4 rounded-lg border border-line bg-paper p-4 md:p-5">
      <p className="text-[13px] leading-5 text-ink-soft">
        Uma ferramenta compartilhada tem um cadastro só e aparece uma vez na ficha de cada produto. O lançamento também é um só: o rateio divide o valor entre os contextos, somando 100%, com a Numa incluída.
        {semRateio && principal ? ` Sem percentuais, o custo vai inteiro para o contexto principal: ${principal}.` : ''}
        {vigente ? ` Vale a partir de ${formatarDiaISO(vigente)}, para as competências dessa data em diante.` : ''}
      </p>
      <ul className="grid gap-2">
        {ferramenta.contextos.map((ligacao, indice) => {
          const contexto = nomes.find((item) => item.id === (ligacao.produto_id ?? ID_INSTITUCIONAL));
          return (
            <li key={ligacao.id} className="flex items-center justify-between gap-3 rounded-md border border-line px-3.5 py-2">
              <span className="flex flex-wrap items-center gap-2">
                {contexto ? <EtiquetaContexto contexto={contexto} /> : <span>Produto removido</span>}
                {indice === 0 && <span className="text-xs text-ink-soft">principal</span>}
              </span>
              <span className="flex items-center gap-1.5">
                <Input aria-label={`Percentual de ${contexto?.nome ?? 'produto'}`} inputMode="decimal" autoComplete="off" disabled={somenteLeitura} className="w-24 text-right" value={valores[ligacao.id] ?? ''} onChange={(evento) => setValores((atuais) => ({ ...atuais, [ligacao.id]: evento.target.value }))} />
                <span className="text-[13px] text-ink-soft">%</span>
              </span>
            </li>
          );
        })}
      </ul>
      {!somenteLeitura && (
        <div className="grid gap-3 md:grid-cols-[minmax(0,240px)_auto] md:items-end">
          <Campo id="rateio-desde" rotulo="Vale a partir de">
            {(controle) => <EntradaData {...controle} value={desde} onChange={(evento) => setDesde(evento.target.value)} />}
          </Campo>
          <Button variante="secundario" className="justify-self-start" onClick={() => void salvar()}>
            Salvar rateio
          </Button>
        </div>
      )}
      {erro && <MensagemErro>{erro}</MensagemErro>}
    </div>
  );
}

// ---------- Dados pessoais (RN-04.15) ----------

function FormularioDadosDaFerramenta({ ferramenta, aberto, aoFechar }: { ferramenta: LinhaDaFerramenta; aberto: boolean; aoFechar: () => void }) {
  const { register, handleSubmit, control, reset, watch, formState } = useForm<FormularioDadosPessoais>({ resolver: zodResolver(esquemaDadosPessoais), defaultValues: formularioDosDadosPessoais(ferramenta), mode: 'onTouched' });
  const { errors, isDirty, isSubmitting } = formState;
  useEffect(() => {
    if (aberto) reset(formularioDosDadosPessoais(ferramenta));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- vale o que está salvo ao abrir
  }, [aberto, reset]);
  const trata = watch('trata_dados_pessoais');
  const enviar = handleSubmit(async (formulario) => {
    try {
      await salvarDadosPessoais(ferramenta.id, formulario);
      aviso('Dados pessoais atualizados.');
      aoFechar();
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    }
  });
  return (
    <JanelaFormulario aberto={aberto} aoFechar={aoFechar} titulo="Dados pessoais" alterado={isDirty} aoEnviar={enviar} salvando={isSubmitting}>
      <div className="grid gap-[18px]">
        <Controller
          control={control}
          name="trata_dados_pessoais"
          render={({ field }) => (
            <Pilulas
              rotulo="Trata dados pessoais dos usuários"
              valor={field.value ? 'sim' : 'nao'}
              aoMudar={(valor) => field.onChange(valor === 'sim')}
              opcoes={[
                { valor: 'nao', rotulo: 'Não' },
                { valor: 'sim', rotulo: 'Sim' },
              ]}
            />
          )}
        />
        <p className="-mt-3 text-xs text-ink-soft">Tratar dados pessoais é guardar ou processar dados dos usuários dos apps. Ter uma conta de acesso na ferramenta não conta.</p>
        {trata && (
          <>
            <p className="-mt-1 text-xs text-ink-soft">Os apps afetados são os produtos da ferramenta, em Produtos e rateio.</p>
            <div id="dados-tipos" tabIndex={-1}>
              <Controller control={control} name="tipos_dados" render={({ field }) => <PilulasMultiplas rotulo="Tipos de dados" obrigatorio valores={field.value} aoMudar={field.onChange} opcoes={TIPOS_DE_DADOS.map((valor) => ({ valor, rotulo: ROTULOS_TIPOS_DADOS[valor] }))} />} />
              {errors.tipos_dados?.message && <MensagemErro>{errors.tipos_dados.message}</MensagemErro>}
            </div>
            <Campo id="dados-regiao" rotulo="Região de armazenamento" ajuda="Se for conhecida.">
              {(controle) => <Input autoComplete="off" {...controle} {...register('regiao_dados')} />}
            </Campo>
            <Controller
              control={control}
              name="acordo_dados_situacao"
              render={({ field }) => (
                <Campo id="dados-acordo" rotulo="Situação do acordo de tratamento" obrigatorio erro={errors.acordo_dados_situacao?.message}>
                  {(controle) => (
                    <Selecao {...controle} {...field}>
                      <option value="">Escolha</option>
                      {paraOpcoes(ROTULOS_ACORDO_DADOS).map(({ valor, rotulo }) => (
                        <option key={valor} value={valor}>
                          {rotulo}
                        </option>
                      ))}
                    </Selecao>
                  )}
                </Campo>
              )}
            />
            <Campo id="dados-url" rotulo="Link do acordo ou dos termos" erro={errors.acordo_dados_url?.message}>
              {(controle) => <Input type="url" inputMode="url" autoComplete="off" {...controle} {...register('acordo_dados_url')} />}
            </Campo>
            <Campo id="dados-revisao" rotulo="Última revisão">
              {(controle) => <EntradaData {...controle} {...register('dados_revisado_em')} />}
            </Campo>
          </>
        )}
      </div>
    </JanelaFormulario>
  );
}

const TIPOS_DO_ACORDO: Readonly<Record<NonNullable<LinhaDaFerramenta['acordo_dados_situacao']>, TipoSituacao>> = { nao_avaliado: 'atencao', termos_padrao: 'info', dpa_assinado: 'sucesso', nao_aplicavel: 'neutro' };

function AbaDadosPessoais({ ferramenta, dados, somenteLeitura }: { ferramenta: LinhaDaFerramenta; dados: DadosDasFerramentas; somenteLeitura: boolean }) {
  const [editando, setEditando] = useState(false);
  const apps = contextosDaFerramenta(ferramenta, dados);
  return (
    <div className="grid gap-4">
      <ListaDeDados>
        <Dado rotulo="Trata dados pessoais">{ferramenta.trata_dados_pessoais ? 'Sim' : 'Não'}</Dado>
        {ferramenta.trata_dados_pessoais && (
          <>
            <Dado rotulo="Produtos afetados">
              <span className="flex flex-wrap gap-1">
                {apps.map((item) => (
                  <EtiquetaContexto key={item.id} contexto={item} />
                ))}
              </span>
            </Dado>
            <Dado rotulo="Tipos de dados">
              {ferramenta.tipos_dados.length ? (
                <span className="flex flex-wrap gap-1">
                  {ferramenta.tipos_dados.map((tipo) => (
                    <EtiquetaLivre key={tipo}>{ROTULOS_TIPOS_DADOS[tipo]}</EtiquetaLivre>
                  ))}
                </span>
              ) : null}
            </Dado>
            <Dado rotulo="Região">{ferramenta.regiao_dados}</Dado>
            <Dado rotulo="Acordo de tratamento">
              {ferramenta.acordo_dados_situacao ? (
                <span className="grid justify-items-start gap-1">
                  <EtiquetaSituacao tipo={TIPOS_DO_ACORDO[ferramenta.acordo_dados_situacao]}>{ROTULOS_ACORDO_DADOS[ferramenta.acordo_dados_situacao]}</EtiquetaSituacao>
                  {ferramenta.acordo_dados_situacao === 'nao_avaliado' && <span className="text-[13px] text-ink-soft">Ainda não foi avaliado: não conta como conformidade.</span>}
                </span>
              ) : null}
            </Dado>
            <Dado rotulo="Referência">{ferramenta.acordo_dados_url ? <BotaoAbrir url={ferramenta.acordo_dados_url} rotulo="Abrir o acordo" /> : null}</Dado>
            <Dado rotulo="Última revisão">{ferramenta.dados_revisado_em && formatarDiaISO(ferramenta.dados_revisado_em)}</Dado>
          </>
        )}
      </ListaDeDados>
      <p className="text-xs text-ink-soft">O inventário de dados (Legal e privacidade, M09) ainda não está nesta versão da Central. Quando estiver, lê estes dados daqui, sem cópia. Registrar aqui não é revisão jurídica.</p>
      {!somenteLeitura && (
        <Button variante="secundario" className="justify-self-start" onClick={() => setEditando(true)}>
          <Pencil aria-hidden />
          Editar dados pessoais
        </Button>
      )}
      <FormularioDadosDaFerramenta ferramenta={ferramenta} aberto={editando} aoFechar={() => setEditando(false)} />
    </div>
  );
}

// ---------- Mais áreas ----------

/** Links do Drive, até a Biblioteca (M08) trazer os arquivos de verdade. */
function AbaArquivos({ id, somenteLeitura }: { id: string; somenteLeitura: boolean }) {
  const consulta = useConsulta(() => linksDaFerramenta(id), [id]);
  const [link, setLink] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  async function adicionar() {
    try {
      await adicionarLinkDaFerramenta(id, link);
      setLink('');
      setErro(null);
    } catch (falha) {
      setErro(mensagemDoErro(falha));
    }
  }

  return (
    <div className="grid gap-4">
      {consulta.dados?.length ? (
        <ul className="grid gap-1">
          {consulta.dados.map((anexo) => (
            <li key={anexo.id} className="flex items-center justify-between gap-2 text-[13px]">
              <a href={anexo.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 min-w-0 items-center gap-1.5 underline underline-offset-2 md:min-h-0 [&_svg]:size-[14px] [&_svg]:shrink-0">
                <ExternalLink aria-hidden />
                <span className="truncate">{anexo.titulo}</span>
              </a>
              {!somenteLeitura && (
                <Button variante="icone" tamanho="icone" aria-label={`Tirar ${anexo.titulo}`} onClick={() => void removerLinkDaFerramenta(anexo.id).catch((falha: unknown) => aviso(mensagemDoErro(falha)))}>
                  <Trash2 aria-hidden />
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-soft">Nenhum link por enquanto.</p>
      )}
      {!somenteLeitura && (
        <Campo id="ferramenta-link" rotulo="Link do Drive" erro={erro ?? undefined}>
          {(controle) => (
            <div className="grid gap-2">
              <EntradaLinkDrive
                link={link}
                {...controle}
                value={link}
                onChange={(evento) => setLink(evento.target.value)}
                onKeyDown={(evento) => {
                  if (evento.key === 'Enter') {
                    evento.preventDefault();
                    void adicionar();
                  }
                }}
              />
              <Button variante="secundario" tamanho="pequeno" className="justify-self-start" onClick={() => void adicionar()}>
                <Plus aria-hidden />
                Adicionar link
              </Button>
            </div>
          )}
        </Campo>
      )}
    </div>
  );
}

/** T04.02, aba 6: o mesmo registro do ativo, sem cópia. */
function AbaAtivosHospedados({ id }: { id: string }) {
  const consulta = useConsulta(() => ativosDaFerramenta(id), [id]);
  if (consulta.estado === 'carregando') return <EstadoCarregando linhas={2} />;
  if (consulta.estado === 'erro') return <EstadoErro titulo="Não deu para ler os ativos." aoTentarDeNovo={consulta.recarregar} />;
  if (!consulta.dados.length) return <EstadoVazio icone={Globe} titulo="Nenhum ativo aqui." texto="Domínios, contas e perfis ligados a esta ferramenta aparecem aqui." />;
  return (
    <ul className="grid gap-2">
      {consulta.dados.map((ativo) => (
        <li key={ativo.id} className="rounded-lg border border-line bg-paper p-4">
          <LinkCentral href={`/ferramentas/ativos/${ativo.id}`} className="inline-flex min-h-11 items-center font-medium break-all underline-offset-2 hover:underline md:min-h-0">
            {ativo.identificador}
          </LinkCentral>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-soft">
            <span>{ROTULOS_TIPO_ATIVO[ativo.tipo]}</span>
            <SituacaoDaTransferencia situacao={ativo.transferencia_situacao} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function AbaHistorico({ id }: { id: string }) {
  const consulta = useConsulta(() => historicoDaFerramenta(id), [id]);
  return (
    <div className="rounded-lg border border-line bg-paper p-4 md:p-5">
      <ListaHistorico consulta={consulta} comFiltros />
    </div>
  );
}

/** As áreas complementares numa aba só, com navegação própria: a faixa de abas da ficha fica curta. */
function MaisAreas({ ferramenta, somenteLeitura }: { ferramenta: LinhaDaFerramenta; somenteLeitura: boolean }) {
  return (
    <Tabs defaultValue="ativos">
      <TabsList aria-label="Mais áreas da ferramenta" className="rounded-pill border border-line bg-paper p-1">
        <TabsTrigger value="ativos">Ativos hospedados</TabsTrigger>
        <TabsTrigger value="atividades">Atividades</TabsTrigger>
        <TabsTrigger value="arquivos">Arquivos</TabsTrigger>
        <TabsTrigger value="historico">Histórico</TabsTrigger>
      </TabsList>
      <TabsContent value="ativos" className="mt-4">
        <AbaAtivosHospedados id={ferramenta.id} />
      </TabsContent>
      <TabsContent value="atividades" className="mt-4">
        <AbaAtividades consultar={() => atividadesDoRegistro('ferramenta', ferramenta.id)} dependencia={ferramenta.id} vazio="Vincule uma atividade a esta ferramenta, pelo painel da atividade." />
      </TabsContent>
      <TabsContent value="arquivos" className="mt-4">
        <AbaArquivos id={ferramenta.id} somenteLeitura={somenteLeitura} />
      </TabsContent>
      <TabsContent value="historico" className="mt-4">
        <AbaHistorico id={ferramenta.id} />
      </TabsContent>
    </Tabs>
  );
}

// ---------- Ações ----------

const TIPOS_DO_EFEITO: Readonly<Record<EfeitoDoCancelamento, TipoSituacao>> = { sera_cancelado: 'erro', preservado_pago: 'sucesso', preservado_anterior: 'neutro', ja_cancelado: 'neutro' };

/** RN-04.10: data efetiva e motivo, com a prévia do que muda (P6). Não cancela no fornecedor. */
function DialogoDeCancelar({ ferramenta, dados, financeiro, aoFechar }: { ferramenta: LinhaDaFerramenta; dados: DadosDasFerramentas; financeiro: FinanceiroDaFerramenta | undefined; aoFechar: () => void }) {
  const [data, setData] = useState(hojeISO());
  const [motivo, setMotivo] = useState('');
  const [erros, setErros] = useState<{ data?: string; motivo?: string }>({});
  const [confirmando, setConfirmando] = useState(false);
  const previa = previaDoCancelamento(financeiro?.titulos ?? [], data);
  const cancelados = previa.filter((item) => item.efeito === 'sera_cancelado').length;
  const produtos = contextosDaFerramenta(ferramenta, dados).map((item) => item.nome);

  async function confirmar() {
    const faltas = { data: data ? undefined : 'Informe a data efetiva do cancelamento.', motivo: motivo.trim() ? undefined : 'Informe o motivo do cancelamento.' };
    setErros(faltas);
    if (faltas.data || faltas.motivo) return;
    setConfirmando(true);
    try {
      await cancelarFerramenta(ferramenta.id, { data, motivo });
      aviso('Ferramenta cancelada na Central. Lembre de cancelar no fornecedor.');
      aoFechar();
    } catch (falha) {
      setErros({ motivo: mensagemDoErro(falha) });
    } finally {
      setConfirmando(false);
    }
  }

  return (
    <JanelaDeAcao titulo="Cancelar ferramenta" subtitulo={ferramenta.nome} aoFechar={aoFechar} aoConfirmar={() => void confirmar()} rotuloConfirmar="Confirmar cancelamento" perigo confirmando={confirmando}>
      <div className="grid gap-4">
        <Faixa tipo="info">Este registro não cancela a contratação no fornecedor nem transfere ativos. Cancele por lá.</Faixa>
        <div className="grid gap-4 md:grid-cols-[minmax(0,220px)_1fr]">
          <Campo id="cancelar-data" rotulo="Data efetiva" obrigatorio erro={erros.data}>
            {(controle) => <EntradaData {...controle} value={data} onChange={(evento) => setData(evento.target.value)} />}
          </Campo>
          <Campo id="cancelar-motivo" rotulo="Motivo" obrigatorio erro={erros.motivo}>
            {(controle) => <Textarea {...controle} rows={2} value={motivo} onChange={(evento) => setMotivo(evento.target.value)} />}
          </Campo>
        </div>
        <section aria-label="Prévia do que muda nos lançamentos" className="grid gap-2">
          <h3 className="text-[15px]">Prévia nos lançamentos</h3>
          {previa.length ? (
            <ul className="grid gap-1.5">
              {previa.map(({ titulo, efeito }) => (
                <li key={titulo.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-md border border-line px-3.5 py-2 text-[13px] md:grid-cols-[120px_120px_minmax(0,1fr)_auto]">
                  <span className="font-medium tabular-nums">{formatarDiaISO(titulo.vencimento)}</span>
                  <span className="text-right tabular-nums md:text-left">{formatarDinheiro(titulo.valor, titulo.moeda)}</span>
                  <span className="text-ink-soft">{ROTULOS_SITUACAO_TITULO[titulo.situacao]}</span>
                  <EtiquetaSituacao tipo={TIPOS_DO_EFEITO[efeito]}>{ROTULOS_EFEITO_CANCELAMENTO[efeito]}</EtiquetaSituacao>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-ink-soft">Esta ferramenta não tem lançamentos.</p>
          )}
          <p className="text-[13px]">
            {cancelados === 0 ? 'Nenhum lançamento será cancelado.' : cancelados === 1 ? '1 lançamento futuro, sem pagamento, será cancelado.' : `${cancelados} lançamentos futuros, sem pagamento, serão cancelados.`} Pagamentos, vencimentos até a data efetiva e o histórico ficam como estão.
          </p>
        </section>
        <p className="flex flex-wrap items-center gap-2 text-[13px]">
          Situação: <SituacaoDaFerramenta situacao={ferramenta.situacao} /> <ArrowRight aria-label="passa a" className="size-4" /> <SituacaoDaFerramenta situacao="cancelada" />
        </p>
        {produtos.length > 0 && <Faixa tipo="atencao">{listaDeNomes(produtos)} {produtos.length === 1 ? 'usa' : 'usam'} esta ferramenta. Revise se ela sustenta a operação antes de cancelar no fornecedor.</Faixa>}
      </div>
    </JanelaDeAcao>
  );
}

/** RN-04.04: liga uma despesa que já está no Financeiro à assinatura, em vez de gerar outra. */
function DialogoDeVincular({ ferramenta, aoFechar }: { ferramenta: LinhaDaFerramenta; aoFechar: () => void }) {
  const consulta = useConsulta(() => lancamentosParaVincular(ferramenta.id), [ferramenta.id]);
  const [escolhido, setEscolhido] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  async function confirmar() {
    if (!escolhido) return setErro('Escolha o lançamento.');
    setConfirmando(true);
    try {
      const { substituidos } = await vincularLancamento(escolhido, ferramenta.id);
      aviso(substituidos ? 'Lançamento vinculado. A cobrança prevista da mesma data saiu, para não haver duas.' : 'Lançamento vinculado.');
      aoFechar();
    } catch (falha) {
      setErro(mensagemDoErro(falha));
    } finally {
      setConfirmando(false);
    }
  }

  return (
    <JanelaDeAcao titulo="Vincular lançamento existente" subtitulo={ferramenta.nome} aoFechar={aoFechar} aoConfirmar={() => void confirmar()} rotuloConfirmar="Vincular" confirmando={confirmando} rodape={erro ? <MensagemErro>{erro}</MensagemErro> : undefined}>
      <div className="grid gap-4">
        <p className="text-[13px] leading-5 text-ink-soft">Para a cobrança que já foi lançada à mão no Financeiro. Se houver uma cobrança prevista da mesma data (até 3 dias), ela é substituída por este lançamento. Vincular não registra pagamento nem muda o valor.</p>
        {consulta.estado === 'carregando' && <EstadoCarregando linhas={2} />}
        {consulta.dados && !consulta.dados.length && <EstadoVazio icone={ReceiptText} titulo="Nenhum lançamento para vincular." texto="Só aparecem despesas a pagar sem assinatura, do mesmo fornecedor da ferramenta." />}
        {consulta.dados && consulta.dados.length > 0 && (
          <Pilulas
            rotulo="Lançamento"
            valor={escolhido}
            aoMudar={(valor) => {
              setEscolhido(valor);
              setErro(null);
            }}
            opcoes={consulta.dados.map((titulo) => ({ valor: titulo.id, rotulo: `${formatarDiaISO(titulo.vencimento)} · ${formatarDinheiro(titulo.valor, titulo.moeda)} · ${titulo.descricao}` }))}
          />
        )}
      </div>
    </JanelaDeAcao>
  );
}

/** T04.02: ficha da ferramenta (P2). Acessos entram na F2 (D14). */
export function FichaFerramenta() {
  const { id } = useParams<{ id: string }>();
  const consulta = useConsulta(carregarFerramentas);
  const financeiro = useConsulta(() => carregarFinanceiroDaFerramenta(id, hojeISO()), [id]);
  const [editando, setEditando] = useState<'editar' | 'plano' | null>(null);
  const [cancelando, setCancelando] = useState(false);
  const [vinculando, setVinculando] = useState(false);
  const [arquivando, setArquivando] = useState(false);
  const [pagando, setPagando] = useState<LinhaDoTitulo | null>(null);

  const voltar = (
    <LinkCentral href={CAMINHO_DE_FERRAMENTAS} className="mb-5 inline-flex min-h-11 items-center gap-1.5 rounded-pill pr-3 text-[13px] font-medium text-ink-soft hover:text-ink md:min-h-0 [&_svg]:size-4">
      <ArrowLeft aria-hidden />
      Ferramentas
    </LinkCentral>
  );

  if (consulta.estado === 'carregando') return <EstadoCarregando />;
  if (consulta.estado === 'erro' || !consulta.dados) {
    return (
      <>
        {voltar}
        <EstadoErro titulo="Não deu para ler esta ferramenta." texto="Os dados deste navegador podem estar danificados. Importe um backup ou restaure os exemplos em Configurações › Dados." aoTentarDeNovo={consulta.recarregar} />
      </>
    );
  }

  const dados = consulta.dados;
  const ferramenta = dados.ferramentas.find((item) => item.id === id);
  if (!ferramenta) {
    return (
      <>
        {voltar}
        <EstadoVazio icone={Wrench} titulo="Essa ferramenta não existe mais." texto="Ela pode ter sido removida ao limpar os exemplos ou ao importar um arquivo." />
      </>
    );
  }

  const arquivada = Boolean(ferramenta.arquivado_em);
  const cancelada = ferramenta.situacao === 'cancelada';
  const somenteLeitura = arquivada || cancelada;
  const nomeDaPessoa = (pessoaId: string | null) => dados.pessoas.find((pessoa) => pessoa.id === pessoaId)?.nome_completo;
  // "Registrar pagamento" só aparece com um lançamento válido em aberto, e abre a baixa do Financeiro.
  const emAberto = !somenteLeitura && financeiro.dados ? proximoEmAberto(financeiro.dados.titulos) : null;
  const paga = ferramenta.assinatura?.modalidade === 'paga';

  async function executar(acao: () => Promise<void>, mensagem: string) {
    try {
      await acao();
      aviso(mensagem);
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    }
  }

  const linhaDoMenu = (fechar: () => void, rotulo: string, aoClicar: () => void, perigo = false) => (
    <li>
      <button
        type="button"
        className={cn(CLASSE_LINHA_MENU, 'hover:bg-hover md:min-h-9 md:py-1.5', perigo && 'text-err')}
        onClick={() => {
          fechar();
          aoClicar();
        }}
      >
        {rotulo}
      </button>
    </li>
  );

  /** No celular, Editar entra no menu quando o botão principal é o pagamento: a barra de baixo tem dois lugares. */
  const menu = (celular: boolean) => (
    <MenuSobreposto
      titulo="Mais ações"
      largura={260}
      alinhar="end"
      gatilho={
        <Button variante="secundario" aria-label="Mais ações da ferramenta">
          Mais ações
          <ChevronDown aria-hidden />
        </Button>
      }
    >
      {(fechar) => (
        <ul className="grid gap-0.5">
          {celular && emAberto && !somenteLeitura && linhaDoMenu(fechar, 'Editar', () => setEditando('editar'))}
          {!somenteLeitura && linhaDoMenu(fechar, 'Trocar plano', () => setEditando('plano'))}
          {!somenteLeitura && paga && linhaDoMenu(fechar, 'Vincular lançamento existente', () => setVinculando(true))}
          {!somenteLeitura && linhaDoMenu(fechar, 'Cancelar ferramenta', () => setCancelando(true), true)}
          {linhaDoMenu(fechar, 'Arquivar', () => setArquivando(true))}
        </ul>
      )}
    </MenuSobreposto>
  );

  const principal = emAberto ? (
    <Button onClick={() => setPagando(emAberto)}>
      <ReceiptText aria-hidden />
      Registrar pagamento
    </Button>
  ) : !somenteLeitura ? (
    <Button onClick={() => setEditando('editar')}>
      <Pencil aria-hidden />
      Editar
    </Button>
  ) : null;

  const acoes = arquivada ? null : (
    <>
      {principal}
      {emAberto && (
        <Button variante="secundario" onClick={() => setEditando('editar')}>
          <Pencil aria-hidden />
          Editar
        </Button>
      )}
      {menu(false)}
    </>
  );

  const acoesCelular = arquivada ? null : (
    <>
      {principal}
      {menu(true)}
    </>
  );

  return (
    <>
      {voltar}
      <Ficha
        tituloDePagina
        codigo={ferramenta.codigo}
        titulo={ferramenta.nome}
        etiquetas={
          <>
            <SituacaoDaFerramenta situacao={ferramenta.situacao} />
            {ferramenta.critica && <EtiquetaCritica />}
            <EtiquetaLivre>{dados.categorias.find((categoria) => categoria.id === ferramenta.categoria_id)?.nome ?? 'Categoria removida'}</EtiquetaLivre>
            {contextosDaFerramenta(ferramenta, dados).map((item) => (
              <EtiquetaContexto key={item.id} contexto={item} />
            ))}
          </>
        }
        responsavel={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-2">
              Técnica: <NomeDaPessoa nome={nomeDaPessoa(ferramenta.responsavel_tecnico_id) ?? 'Pessoa removida'} className="text-ink" />
            </span>
            {ferramenta.responsavel_financeiro_id && (
              <span className="inline-flex items-center gap-2">
                Financeira: <NomeDaPessoa nome={nomeDaPessoa(ferramenta.responsavel_financeiro_id) ?? 'Pessoa removida'} className="text-ink" />
              </span>
            )}
          </span>
        }
        acoes={acoes}
        acoesCelular={acoesCelular}
        lateral={<LateralDaFerramenta ferramenta={ferramenta} dados={dados} financeiro={financeiro.dados} />}
        arquivado={
          arquivada
            ? {
                texto: `Esta ferramenta foi arquivada em ${formatarData(ferramenta.arquivado_em as string)}.`,
                acao: (
                  <Button variante="secundario" tamanho="pequeno" onClick={() => void executar(() => restaurarFerramenta(ferramenta.id), 'Ferramenta restaurada.')}>
                    <ArchiveRestore aria-hidden />
                    Restaurar
                  </Button>
                ),
              }
            : undefined
        }
        abas={[
          { id: 'resumo', rotulo: 'Resumo', conteudo: <Resumo ferramenta={ferramenta} dados={dados} financeiro={financeiro.dados} /> },
          { id: 'assinatura', rotulo: 'Assinatura e custos', conteudo: <AbaAssinatura ferramenta={ferramenta} dados={dados} financeiro={financeiro.dados} editavel={!somenteLeitura} aoVincular={() => setVinculando(true)} /> },
          { id: 'rateio', rotulo: 'Produtos e rateio', conteudo: <AbaRateio ferramenta={ferramenta} dados={dados} somenteLeitura={somenteLeitura} /> },
          { id: 'dados', rotulo: 'Dados pessoais', conteudo: <AbaDadosPessoais ferramenta={ferramenta} dados={dados} somenteLeitura={somenteLeitura} /> },
          { id: 'mais', rotulo: 'Mais áreas', conteudo: <MaisAreas ferramenta={ferramenta} somenteLeitura={somenteLeitura} /> },
        ]}
      />
      <FormularioDeFerramenta aberto={Boolean(editando)} aoFechar={() => setEditando(null)} dados={dados} ferramenta={ferramenta} contextos={ferramenta.contextos} assinatura={ferramenta.assinatura} trocandoPlano={editando === 'plano'} />
      {cancelando && <DialogoDeCancelar ferramenta={ferramenta} dados={dados} financeiro={financeiro.dados} aoFechar={() => setCancelando(false)} />}
      {vinculando && <DialogoDeVincular ferramenta={ferramenta} aoFechar={() => setVinculando(false)} />}
      {pagando && <DialogoDeBaixa titulo={pagando} contas={dados.contas} aoFechar={() => setPagando(null)} />}
      <Confirmacao
        aberto={arquivando}
        aoFechar={() => setArquivando(false)}
        titulo={`Arquivar ${ferramenta.nome}?`}
        texto="Ela sai das listas e dos totais. Dá para restaurar depois."
        rotuloConfirmar="Arquivar ferramenta"
        perigo
        aoConfirmar={() => {
          setArquivando(false);
          void executar(() => arquivarFerramenta(ferramenta.id), 'Ferramenta arquivada.');
        }}
      />
    </>
  );
}

