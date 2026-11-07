'use client';

import { EntradaData } from '@/componentes/campos/entrada-data';
import { useState, type ReactNode } from 'react';
import { useParams } from 'next/navigation';
import { ArchiveRestore, ArrowLeft, ArrowRight, ArrowRightLeft, CalendarClock, ChevronDown, ExternalLink, FileCheck2, Globe, IdCard, Info, Pencil, Plus, ReceiptText, Trash2, Users } from 'lucide-react';
import { AbaAtividades } from '@/componentes/atividades/aba-atividades';
import { Campo, MensagemErro } from '@/componentes/campos/campo';
import { EntradaLinkDrive } from '@/componentes/campos/link-drive';
import { Pilulas } from '@/componentes/campos/pilulas';
import { Selecao } from '@/componentes/campos/selecao';
import { EtiquetaCritica, SituacaoDaTransferencia, TextoDoVencimento } from '@/componentes/ferramentas/etiquetas-ferramentas';
import { FormularioDeAtivo } from '@/componentes/ferramentas/formulario-ativo';
import { JanelaDeAcao } from '@/componentes/ferramentas/janela-acao';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { aviso } from '@/componentes/padroes/aviso';
import { Confirmacao } from '@/componentes/padroes/confirmacao';
import { Dado } from '@/componentes/padroes/dado';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { EtiquetaContexto, EtiquetaLivre, EtiquetaSituacao } from '@/componentes/padroes/etiquetas';
import { Faixa } from '@/componentes/padroes/faixa';
import { Ficha } from '@/componentes/padroes/ficha';
import { ListaHistorico } from '@/componentes/padroes/historico';
import { CLASSE_LINHA_MENU, MenuSobreposto } from '@/componentes/padroes/menu-sobreposto';
import { Pessoa as NomeDaPessoa } from '@/componentes/padroes/pessoa';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { Textarea } from '@/componentes/ui/textarea';
import { mensagemDoErro } from '@/dados/erros';
import type { AtivoDigital } from '@/dados/tipos/ativo';
import type { Entidade } from '@/dados/tipos/contraparte';
import { useConsulta } from '@/dados/use-consulta';
import { atividadesDoRegistro } from '@/dominio/atividades-painel';
import { adicionarLinkDoAtivo, arquivarAtivo, carregarAtivos, diasParaVencer, esquemaRegistrarTransferencia, formularioTransferenciaVazio, linksDoAtivo, registrarTransferencia, removerLinkDoAtivo, restaurarAtivo, ROTULOS_TIPO_ATIVO, type DadosDosAtivos, type FormularioTransferencia } from '@/dominio/ativos';
import { ID_INSTITUCIONAL } from '@/dominio/contextos';
import { tintaDaCor } from '@/dominio/cores';
import { ROTULOS_MODALIDADE, ROTULOS_PERIODICIDADE } from '@/dominio/ferramentas';
import { carregarEntidades, numaTemEntidadeAtiva, titularidade } from '@/dominio/ferramentas-ficha';
import { historicoDoAtivo } from '@/dominio/historico';
import { pessoasDoSeletor } from '@/dominio/pessoa-atual';
import { ROTULOS_TITULAR, textoDoTitular } from '@/dominio/titularidade';
import { hojeISO } from '@/lib/datas';
import { formatarData, formatarDiaISO, formatarDinheiro } from '@/lib/formatacao';
import { cn } from '@/lib/utils';

const CAMINHO = '/ferramentas/ativos';

/** Um cartão da ficha: ícone, título e o conteúdo como informação, nunca como campo editável. */
function Cartao({ icone: Icone, titulo, descricao, children, className }: { icone: typeof Info; titulo: string; descricao?: string; children: ReactNode; className?: string }) {
  return (
    <section aria-label={titulo} className={cn('rounded-lg border border-line bg-paper p-4 md:p-5', className)}>
      <header className="flex items-start gap-2.5">
        <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-md bg-indigo-wash text-primary [&_svg]:size-4">
          <Icone />
        </span>
        <div>
          <h3 className="text-[15px]">{titulo}</h3>
          {descricao && <p className="text-[13px] text-ink-soft">{descricao}</p>}
        </div>
      </header>
      <div className="mt-3 text-[13px] leading-5">{children}</div>
    </section>
  );
}

function prazo(vencimento: string | null, hoje: string): string | null {
  const dias = diasParaVencer({ vencimento }, hoje);
  if (dias === null) return null;
  if (dias === 0) return 'vence hoje';
  if (dias < 0) return dias === -1 ? 'venceu ontem' : `venceu há ${-dias} dias`;
  return dias === 1 ? 'em 1 dia' : `em ${dias} dias`;
}

function Resumo({ ativo, dados, entidades }: { ativo: AtivoDigital; dados: DadosDosAtivos; entidades: readonly Entidade[] | undefined }) {
  const ferramenta = dados.ferramentas.find((item) => item.id === ativo.ferramenta_id);
  const produto = dados.produtos.find((item) => item.id === ativo.produto_id);
  const marca = produto ? dados.marcas.find((item) => item.id === produto.marca_id) : dados.marcas.find((item) => item.institucional);
  const responsavel = dados.pessoas.find((pessoa) => pessoa.id === ativo.responsavel_id)?.nome_completo ?? 'Pessoa removida';
  const dono = entidades ? titularidade(ativo, dados.pessoas, entidades) : null;

  return (
    <div className="grid min-w-0 gap-4">
      <Cartao icone={IdCard} titulo="Identificação" descricao="O que é, onde está e de quem é a responsabilidade.">
        <dl>
          <Dado rotulo="Tipo">{ROTULOS_TIPO_ATIVO[ativo.tipo]}</Dado>
          <Dado rotulo="Plataforma">
            {ferramenta && (
              <LinkCentral href={`/ferramentas/${ferramenta.id}`} className="inline-flex min-h-11 items-center gap-1 underline md:min-h-0">
                {ferramenta.nome}
              </LinkCentral>
            )}
          </Dado>
          <Dado rotulo="Produto ou contexto">{marca ? <EtiquetaContexto contexto={{ id: ativo.produto_id ?? ID_INSTITUCIONAL, nome: produto?.nome ?? 'Numa', cor: marca.cor_hex, tinta: tintaDaCor(marca.cor_hex) }} /> : null}</Dado>
          <Dado rotulo="Registrado em">{ativo.registrado_em && formatarDiaISO(ativo.registrado_em)}</Dado>
          <Dado rotulo="Responsável">{responsavel}</Dado>
          <Dado rotulo="Observações">{ativo.observacoes}</Dado>
        </dl>
      </Cartao>
      <Cartao icone={Users} titulo="Titularidade" descricao="Em nome de quem está e em nome de quem deveria estar.">
        <dl>
          <Dado rotulo="Titular atual">{textoDoTitular(ativo, dados.pessoas)}</Dado>
          <Dado rotulo="Titular desejado">{ativo.titular_desejado}</Dado>
          <Dado rotulo="Situação da transferência">
            <span className="grid justify-items-start gap-1">
              <SituacaoDaTransferencia situacao={ativo.transferencia_situacao} />
              {dono?.estado === 'aguarda_entidade' && ativo.transferencia_situacao !== 'concluida' && <span className="text-[13px] text-ink-soft">A Numa ainda não tem entidade PJ ativa: a transferência depende dela.</span>}
            </span>
          </Dado>
          <Dado rotulo="Requisito para transferir">{ativo.requisito_transferencia}</Dado>
          {ativo.transferencia_situacao === 'concluida' && <Dado rotulo="Transferido em">{ativo.transferido_em && formatarDiaISO(ativo.transferido_em)}</Dado>}
        </dl>
        <p className="mt-3 flex items-start gap-2 rounded-md bg-mist px-3 py-2 text-ink-soft">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
          Registrar aqui não transfere a propriedade no fornecedor.
        </p>
      </Cartao>
    </div>
  );
}

/** À direita da ficha, em todas as abas (no celular, abaixo): vencimento, custo e evidência. */
function LateralDoAtivo({ ativo, dados }: { ativo: AtivoDigital; dados: DadosDosAtivos }) {
  const assinatura = dados.assinaturas.find((item) => item.id === ativo.assinatura_id);
  const daAssinatura = assinatura ? dados.ferramentas.find((item) => item.id === assinatura.ferramenta_id) : undefined;
  const hoje = hojeISO();
  // Anual dividido por 12 é só referência: a cobrança continua anual (RN-04.08).
  const mensal = assinatura && assinatura.valor !== null && assinatura.periodicidade && assinatura.periodicidade !== 'mensal' && assinatura.periodicidade !== 'por_uso' && assinatura.periodicidade !== 'unica' ? assinatura.valor / { trimestral: 3, semestral: 6, anual: 12 }[assinatura.periodicidade] : null;
  return (
    <>
      <Cartao icone={CalendarClock} titulo="Vencimento">
        {ativo.vencimento ? (
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-display text-[22px] leading-7">
              <TextoDoVencimento vencimento={ativo.vencimento} hoje={hoje} />
            </span>
            <span className="text-ink-soft">{prazo(ativo.vencimento, hoje)}</span>
          </p>
        ) : (
          <p className="text-ink-soft">{ativo.tipo === 'dominio' ? 'Domínio sem vencimento: edite e informe a data.' : 'Sem vencimento.'}</p>
        )}
        <p className="mt-2">Renovação automática: {ativo.renovacao_automatica === null ? <span className="text-ink-soft">não informada</span> : ativo.renovacao_automatica ? 'Sim' : 'Não'}</p>
        {ativo.vencimento && ativo.vencimento < hoje && <p className="mt-2 text-warn">O vencimento já passou. Se o domínio foi renovado, edite e informe a nova data: o alerta se resolve.</p>}
      </Cartao>
      <Cartao icone={ReceiptText} titulo="Assinatura relacionada">
        {assinatura ? (
          <div className="grid gap-1">
            <p className="font-medium">
              {daAssinatura?.nome ?? 'Ferramenta removida'}
              {assinatura.plano ? ` · ${assinatura.plano}` : ''}
            </p>
            <p className="tabular-nums">
              {assinatura.modalidade !== 'paga' ? ROTULOS_MODALIDADE[assinatura.modalidade] : assinatura.valor === null ? 'Valor a confirmar' : `${formatarDinheiro(assinatura.valor, assinatura.moeda)}${assinatura.periodicidade ? ` · ${ROTULOS_PERIODICIDADE[assinatura.periodicidade].toLowerCase()}` : ''}`}
            </p>
            {mensal !== null && <p className="text-ink-soft tabular-nums">Referência mensal: {formatarDinheiro(mensal, assinatura.moeda)} (só referência)</p>}
            <p className="text-ink-soft">O custo é da ferramenta: o ativo não cria outra cobrança.</p>
            {daAssinatura && (
              <LinkCentral href={`/ferramentas/${daAssinatura.id}`} className="inline-flex min-h-11 items-center text-primary underline-offset-2 hover:underline md:min-h-0">
                Ver a ferramenta e as cobranças
              </LinkCentral>
            )}
          </div>
        ) : (
          <p className="text-ink-soft">Nenhuma. O custo, se houver, fica na ferramenta.</p>
        )}
      </Cartao>
      <Cartao icone={FileCheck2} titulo="Evidência da transferência">
        {ativo.evidencia_transferencia_url ? (
          <a href={ativo.evidencia_transferencia_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 underline md:min-h-0 [&_svg]:size-[14px]">
            <ExternalLink aria-hidden />
            Abrir a evidência
          </a>
        ) : ativo.transferencia_situacao === 'nao_necessaria' ? (
          <p className="text-ink-soft">Não se aplica: o titular atual já é o desejado.</p>
        ) : (
          <EtiquetaSituacao tipo="neutro">Não registrada</EtiquetaSituacao>
        )}
      </Cartao>
    </>
  );
}

function AbaArquivos({ id, somenteLeitura }: { id: string; somenteLeitura: boolean }) {
  const consulta = useConsulta(() => linksDoAtivo(id), [id]);
  const [link, setLink] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  async function adicionar() {
    try {
      await adicionarLinkDoAtivo(id, link);
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
                <Button variante="icone" tamanho="icone" aria-label={`Tirar ${anexo.titulo}`} onClick={() => void removerLinkDoAtivo(anexo.id).catch((falha: unknown) => aviso(mensagemDoErro(falha)))}>
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
        <Campo id="ativo-link" rotulo="Link do Drive" erro={erro ?? undefined}>
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

function AbaHistorico({ id }: { id: string }) {
  const consulta = useConsulta(() => historicoDoAtivo(id), [id]);
  return (
    <div className="rounded-lg border border-line bg-paper p-4 md:p-5">
      <ListaHistorico consulta={consulta} comFiltros />
    </div>
  );
}

/**
 * T04.05: data, novo titular, evidência e observação. Só depois de feita no fornecedor; a evidência é
 * obrigatória (CA-04.07) e é conferida de novo pela regra ao confirmar.
 */
function DialogoDeTransferencia({ ativo, dados, entidades, aoFechar }: { ativo: AtivoDigital; dados: DadosDosAtivos; entidades: readonly Entidade[] | undefined; aoFechar: () => void }) {
  const [valores, setValores] = useState<FormularioTransferencia>(() => formularioTransferenciaVazio());
  const [erros, setErros] = useState<Partial<Record<keyof FormularioTransferencia, string>>>({});
  const [confirmando, setConfirmando] = useState(false);
  const socias = pessoasDoSeletor(dados.pessoas).filter((pessoa) => pessoa.eh_socia);
  const mudar = (parcial: Partial<FormularioTransferencia>) => setValores((atuais) => ({ ...atuais, ...parcial }));
  const novoTitular = valores.titular_tipo === 'pessoa_fisica' ? `Pessoa física — ${socias.find((pessoa) => pessoa.id === valores.titular_pessoa_id)?.nome_completo ?? 'escolha a sócia'}` : valores.titular_tipo === 'terceiro' ? `Terceiro — ${valores.titular_texto || 'diga quem'}` : ROTULOS_TITULAR.numa;
  const semEntidade = valores.titular_tipo === 'numa' && entidades !== undefined && !numaTemEntidadeAtiva(entidades);

  async function confirmar() {
    const conferido = esquemaRegistrarTransferencia.safeParse(valores);
    if (!conferido.success) {
      setErros(Object.fromEntries(conferido.error.issues.map((problema) => [problema.path[0], problema.message])));
      return;
    }
    setConfirmando(true);
    try {
      await registrarTransferencia(ativo.id, conferido.data);
      aviso('Transferência registrada.');
      aoFechar();
    } catch (falha) {
      setErros({ evidencia: mensagemDoErro(falha) });
    } finally {
      setConfirmando(false);
    }
  }

  return (
    <JanelaDeAcao
      titulo="Registrar transferência"
      subtitulo={`${ativo.identificador} · ${ROTULOS_TIPO_ATIVO[ativo.tipo]}`}
      aoFechar={aoFechar}
      aoConfirmar={() => void confirmar()}
      rotuloConfirmar="Registrar transferência"
      confirmando={confirmando}
      rodape={!valores.evidencia.trim() ? <span className="text-ink-soft">Falta a evidência: sem ela, a transferência não conta como concluída.</span> : undefined}
    >
      <div className="grid gap-4">
        <Faixa tipo="atencao">Registre somente depois de concluir a transferência no fornecedor. Registrar aqui não transfere nada.</Faixa>
        <div className="grid items-center gap-2 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
          <div className="rounded-md border border-line bg-paper px-3.5 py-2.5">
            <p className="text-xs text-ink-soft">Atual</p>
            <p className="text-sm font-semibold break-words">{textoDoTitular(ativo, dados.pessoas)}</p>
          </div>
          <ArrowRight aria-label="passa para" className="mx-auto size-4 rotate-90 md:rotate-0" />
          <div className="rounded-md border border-line bg-paper px-3.5 py-2.5">
            <p className="text-xs text-ink-soft">Novo titular</p>
            <p className="text-sm font-semibold break-words">{novoTitular}</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_260px]">
          <div className="grid gap-4">
            <Campo id="transferencia-data" rotulo="Data da transferência" obrigatorio erro={erros.data}>
              {(controle) => <EntradaData {...controle} value={valores.data} onChange={(evento) => mudar({ data: evento.target.value })} />}
            </Campo>
            <Pilulas rotulo="Novo titular" obrigatorio valor={valores.titular_tipo} aoMudar={(valor) => mudar({ titular_tipo: valor as FormularioTransferencia['titular_tipo'] })} opcoes={Object.entries(ROTULOS_TITULAR).map(([valor, rotulo]) => ({ valor, rotulo }))} />
            {semEntidade && <Faixa tipo="atencao">A Numa ainda não tem entidade PJ ativa em Configurações › Entidades. Só registre se a conta já está, de fato, em nome da Numa.</Faixa>}
            {valores.titular_tipo === 'pessoa_fisica' && (
              <Campo id="transferencia-pessoa" rotulo="Sócia titular" obrigatorio erro={erros.titular_pessoa_id}>
                {(controle) => (
                  <Selecao {...controle} value={valores.titular_pessoa_id} onChange={(evento) => mudar({ titular_pessoa_id: evento.target.value })}>
                    <option value="">Escolha uma pessoa</option>
                    {socias.map((pessoa) => (
                      <option key={pessoa.id} value={pessoa.id}>
                        {pessoa.nome_completo}
                      </option>
                    ))}
                  </Selecao>
                )}
              </Campo>
            )}
            {valores.titular_tipo === 'terceiro' && (
              <Campo id="transferencia-texto" rotulo="Para quem" obrigatorio erro={erros.titular_texto}>
                {(controle) => <Input autoComplete="off" {...controle} value={valores.titular_texto} onChange={(evento) => mudar({ titular_texto: evento.target.value })} />}
              </Campo>
            )}
            <Campo id="transferencia-evidencia" rotulo="Evidência da transferência" obrigatorio erro={erros.evidencia} ajuda="Link do Drive para o comprovante.">
              {(controle) => <EntradaLinkDrive link={valores.evidencia} {...controle} value={valores.evidencia} onChange={(evento) => mudar({ evidencia: evento.target.value })} />}
            </Campo>
            <Campo id="transferencia-observacao" rotulo="Observação">
              {(controle) => <Textarea {...controle} value={valores.observacao} onChange={(evento) => mudar({ observacao: evento.target.value })} />}
            </Campo>
          </div>
          <section aria-label="O que o registro faz" className="grid content-start self-start gap-2.5 rounded-lg border border-line bg-mist p-3.5 text-[13px] leading-5">
            <h3 className="text-[15px]">O que o registro faz</h3>
            <p>O titular atual passa a ser {novoTitular}.</p>
            <p>A situação fica Concluída.</p>
            <p>O titular anterior fica no histórico.</p>
            <p className="text-ink-soft">Nada é feito no fornecedor: a transferência de lá é responsabilidade da equipe.</p>
          </section>
        </div>
        {erros.data && <MensagemErro>{erros.data}</MensagemErro>}
      </div>
    </JanelaDeAcao>
  );
}

/** T04.05: ficha do ativo (P2). A aba Acessos entra na F2 (D14). */
export function FichaAtivo() {
  const { id } = useParams<{ id: string }>();
  const consulta = useConsulta(carregarAtivos);
  const entidades = useConsulta(carregarEntidades);
  const [editando, setEditando] = useState(false);
  const [transferindo, setTransferindo] = useState(false);
  const [arquivando, setArquivando] = useState(false);

  const voltar = (
    <LinkCentral href={CAMINHO} className="mb-5 inline-flex min-h-11 items-center gap-1.5 rounded-pill pr-3 text-[13px] font-medium text-ink-soft hover:text-ink md:min-h-0 [&_svg]:size-4">
      <ArrowLeft aria-hidden />
      Ativos digitais
    </LinkCentral>
  );

  if (consulta.estado === 'carregando') return <EstadoCarregando />;
  if (consulta.estado === 'erro' || !consulta.dados) {
    return (
      <>
        {voltar}
        <EstadoErro titulo="Não deu para ler este ativo." texto="Os dados deste navegador podem estar danificados. Importe um backup ou restaure os exemplos em Configurações › Dados." aoTentarDeNovo={consulta.recarregar} />
      </>
    );
  }

  const dados = consulta.dados;
  const ativo = dados.ativos.find((item) => item.id === id);
  if (!ativo) {
    return (
      <>
        {voltar}
        <EstadoVazio icone={Globe} titulo="Esse ativo não existe mais." texto="Ele pode ter sido removido ao limpar os exemplos ou ao importar um arquivo." />
      </>
    );
  }

  const arquivado = Boolean(ativo.arquivado_em);
  const produto = dados.produtos.find((item) => item.id === ativo.produto_id);
  const marca = produto ? dados.marcas.find((item) => item.id === produto.marca_id) : dados.marcas.find((item) => item.institucional);
  const responsavel = dados.pessoas.find((pessoa) => pessoa.id === ativo.responsavel_id)?.nome_completo ?? 'Pessoa removida';
  const podeTransferir = !arquivado && ativo.transferencia_situacao !== 'nao_necessaria' && ativo.transferencia_situacao !== 'concluida';

  async function executar(acao: () => Promise<void>, mensagem: string) {
    try {
      await acao();
      aviso(mensagem);
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    }
  }

  const menu = (comEditar: boolean) => (
    <MenuSobreposto
      titulo="Mais ações"
      largura={220}
      alinhar="end"
      gatilho={
        <Button variante="secundario" aria-label="Mais ações do ativo">
          Mais ações
          <ChevronDown aria-hidden />
        </Button>
      }
    >
      {(fechar) => (
        <ul className="grid gap-0.5">
          {comEditar && (
            <li>
              <button
                type="button"
                className={`${CLASSE_LINHA_MENU} hover:bg-hover md:min-h-9 md:py-1.5`}
                onClick={() => {
                  fechar();
                  setEditando(true);
                }}
              >
                Editar
              </button>
            </li>
          )}
          <li>
            <button
              type="button"
              className={`${CLASSE_LINHA_MENU} hover:bg-hover md:min-h-9 md:py-1.5`}
              onClick={() => {
                fechar();
                setArquivando(true);
              }}
            >
              Arquivar
            </button>
          </li>
        </ul>
      )}
    </MenuSobreposto>
  );

  const transferir = (
    <Button onClick={() => setTransferindo(true)}>
      <ArrowRightLeft aria-hidden />
      Registrar transferência
    </Button>
  );
  const editar = (
    <Button variante={podeTransferir ? 'secundario' : 'primario'} onClick={() => setEditando(true)}>
      <Pencil aria-hidden />
      Editar
    </Button>
  );

  const acoes = arquivado ? null : (
    <>
      {podeTransferir && transferir}
      {editar}
      {menu(false)}
    </>
  );
  // No celular, a barra de baixo tem dois lugares: a ação principal e Mais ações.
  const acoesCelular = arquivado ? null : (
    <>
      {podeTransferir ? transferir : editar}
      {menu(podeTransferir)}
    </>
  );

  return (
    <>
      {voltar}
      <Ficha
        tituloDePagina
        codigo={ativo.codigo}
        titulo={ativo.identificador}
        etiquetas={
          <>
            <EtiquetaLivre>{ROTULOS_TIPO_ATIVO[ativo.tipo]}</EtiquetaLivre>
            {ativo.critico && <EtiquetaCritica rotulo="Crítico" />}
            {marca && <EtiquetaContexto contexto={{ id: ativo.produto_id ?? ID_INSTITUCIONAL, nome: produto?.nome ?? 'Numa', cor: marca.cor_hex, tinta: tintaDaCor(marca.cor_hex) }} />}
            <SituacaoDaTransferencia situacao={ativo.transferencia_situacao} />
          </>
        }
        responsavel={
          <span className="inline-flex items-center gap-2">
            Responsável: <NomeDaPessoa nome={responsavel} className="text-ink" />
          </span>
        }
        acoes={acoes}
        acoesCelular={acoesCelular}
        lateral={<LateralDoAtivo ativo={ativo} dados={dados} />}
        arquivado={
          arquivado
            ? {
                texto: `Este ativo foi arquivado em ${formatarData(ativo.arquivado_em as string)}.`,
                acao: (
                  <Button variante="secundario" tamanho="pequeno" onClick={() => void executar(() => restaurarAtivo(ativo.id), 'Ativo restaurado.')}>
                    <ArchiveRestore aria-hidden />
                    Restaurar
                  </Button>
                ),
              }
            : undefined
        }
        abas={[
          { id: 'resumo', rotulo: 'Resumo', conteudo: <Resumo ativo={ativo} dados={dados} entidades={entidades.dados} /> },
          { id: 'atividades', rotulo: 'Atividades', conteudo: <AbaAtividades consultar={() => atividadesDoRegistro('ativo_digital', ativo.id)} dependencia={ativo.id} vazio="Vincule uma atividade a este ativo, pelo painel da atividade." /> },
          { id: 'arquivos', rotulo: 'Arquivos', conteudo: <AbaArquivos id={ativo.id} somenteLeitura={arquivado} /> },
          { id: 'historico', rotulo: 'Histórico', conteudo: <AbaHistorico id={ativo.id} /> },
        ]}
      />
      <FormularioDeAtivo aberto={editando} aoFechar={() => setEditando(false)} dados={dados} ativo={ativo} />
      {transferindo && <DialogoDeTransferencia ativo={ativo} dados={dados} entidades={entidades.dados} aoFechar={() => setTransferindo(false)} />}
      <Confirmacao
        aberto={arquivando}
        aoFechar={() => setArquivando(false)}
        titulo={`Arquivar ${ativo.identificador}?`}
        texto="Ele sai das listas. Dá para restaurar depois."
        rotuloConfirmar="Arquivar ativo"
        perigo
        aoConfirmar={() => {
          setArquivando(false);
          void executar(() => arquivarAtivo(ativo.id), 'Ativo arquivado.');
        }}
      />
    </>
  );
}
