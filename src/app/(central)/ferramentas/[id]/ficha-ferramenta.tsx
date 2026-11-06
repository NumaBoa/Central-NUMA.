'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArchiveRestore, ArrowLeft, Ellipsis, ExternalLink, Globe, Pencil, Plus, Receipt, Replace, Trash2, Wrench } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { AbaAtividades } from '@/componentes/atividades/aba-atividades';
import { Campo, MensagemErro } from '@/componentes/campos/campo';
import { EntradaLinkDrive } from '@/componentes/campos/link-drive';
import { Pilulas, PilulasMultiplas } from '@/componentes/campos/pilulas';
import { Selecao } from '@/componentes/campos/selecao';
import { EtiquetaCritica, SituacaoDaTransferencia } from '@/componentes/ferramentas/etiquetas-ferramentas';
import { FormularioDeFerramenta } from '@/componentes/ferramentas/formulario-ferramenta';
import { CAMINHO_DE_FERRAMENTAS } from '@/componentes/ferramentas/nova-ferramenta';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { aviso } from '@/componentes/padroes/aviso';
import { Confirmacao } from '@/componentes/padroes/confirmacao';
import { Dado, ListaDeDados } from '@/componentes/padroes/dado';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { EtiquetaContexto, EtiquetaLivre } from '@/componentes/padroes/etiquetas';
import { Ficha } from '@/componentes/padroes/ficha';
import { ListaHistorico } from '@/componentes/padroes/historico';
import { CLASSE_LINHA_MENU, LinhaEmBreve, MenuSobreposto } from '@/componentes/padroes/menu-sobreposto';
import { PainelFormulario } from '@/componentes/padroes/painel-formulario';
import { Pessoa as NomeDaPessoa } from '@/componentes/padroes/pessoa';
import { Button } from '@/componentes/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/componentes/ui/dialog';
import { Input } from '@/componentes/ui/input';
import { Textarea } from '@/componentes/ui/textarea';
import { mensagemDoErro } from '@/dados/erros';
import type { AssinaturaFerramenta } from '@/dados/tipos/ferramenta';
import { TIPOS_DE_DADOS } from '@/dados/tipos/ferramenta';
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
  type DadosDasFerramentas,
  type FormularioDadosPessoais,
  type LinhaDaFerramenta,
} from '@/dominio/ferramentas';
import { historicoDaFerramenta } from '@/dominio/historico';
import { valorParaCampo } from '@/dominio/dinheiro';
import { textoDoTitular } from '@/dominio/titularidade';
import { hojeISO } from '@/lib/datas';
import { formatarData, formatarDiaISO, formatarDinheiro } from '@/lib/formatacao';
import { contextosDaFerramenta, SituacaoDaFerramenta, textoDoValor } from '../tela-ferramentas';

const paraOpcoes = (rotulos: Record<string, string>) => Object.entries(rotulos).map(([valor, rotulo]) => ({ valor, rotulo }));

function BotaoAbrir({ url, rotulo }: { url: string | null; rotulo: string }) {
  if (!url) return null;
  return (
    <Button asChild variante="secundario" tamanho="pequeno">
      <a href={url} target="_blank" rel="noopener noreferrer">
        <ExternalLink aria-hidden />
        {rotulo}
      </a>
    </Button>
  );
}

function Resumo({ ferramenta, dados }: { ferramenta: LinhaDaFerramenta; dados: DadosDasFerramentas }) {
  const fornecedor = dados.contrapartes.find((contraparte) => contraparte.id === ferramenta.fornecedor_id);
  return (
    <ListaDeDados>
      <Dado rotulo="Finalidade">{ferramenta.finalidade}</Dado>
      <Dado rotulo="Categoria">{dados.categorias.find((categoria) => categoria.id === ferramenta.categoria_id)?.nome}</Dado>
      <Dado rotulo="Fornecedor">
        {fornecedor && (
          <LinkCentral href={`/configuracoes/cadastros/contrapartes/${fornecedor.id}`} className="inline-flex min-h-11 items-center underline md:min-h-0">
            {nomeDaContraparte(fornecedor)}
          </LinkCentral>
        )}
      </Dado>
      <Dado rotulo="Endereços">
        {(ferramenta.url_acesso || ferramenta.url_admin) && (
          <span className="flex flex-wrap gap-2">
            <BotaoAbrir url={ferramenta.url_acesso} rotulo="Abrir acesso" />
            <BotaoAbrir url={ferramenta.url_admin} rotulo="Abrir administração" />
          </span>
        )}
      </Dado>
      <Dado rotulo="Ambiente ou conta">{ferramenta.ambiente}</Dado>
      <Dado rotulo="E-mail ou usuário de login">{ferramenta.email_login_conta}</Dado>
      <Dado rotulo="Titular atual">{textoDoTitular(ferramenta, dados.pessoas)}</Dado>
      <Dado rotulo="Titular desejado">{ferramenta.titular_desejado}</Dado>
      <Dado rotulo="Segunda etapa na conta">{ROTULOS_MFA[ferramenta.mfa_conta]}</Dado>
      <Dado rotulo="Caminho de recuperação">{ferramenta.caminho_recuperacao}</Dado>
      <Dado rotulo="Referência ao cofre">{ferramenta.referencia_cofre}</Dado>
      <Dado rotulo="Observações">{ferramenta.observacoes}</Dado>
      {ferramenta.situacao === 'cancelada' && (
        <Dado rotulo="Cancelada">
          {ferramenta.cancelada_em ? formatarDiaISO(ferramenta.cancelada_em) : ''}
          {ferramenta.cancelamento_motivo ? ` · ${ferramenta.cancelamento_motivo}` : ''}
        </Dado>
      )}
    </ListaDeDados>
  );
}

function AbaAssinatura({ ferramenta, id, dados }: { ferramenta: LinhaDaFerramenta; id: string; dados: DadosDasFerramentas }) {
  const consulta = useConsulta(() => carregarFichaDaFerramenta(id), [id]);
  const assinatura = ferramenta.assinatura;
  if (!consulta.dados) return <EstadoCarregando linhas={2} />;
  const anteriores = consulta.dados.assinaturas.filter((item) => item.situacao === 'encerrada');
  const conta = dados.contas.find((item) => item.id === assinatura?.conta_financeira_id)?.nome;
  const categoria = dados.categoriasFinanceiras.find((item) => item.id === assinatura?.categoria_financeira_id)?.nome;
  return (
    <div className="grid gap-6">
      {assinatura ? (
        <ListaDeDados>
          <Dado rotulo="Modalidade">{ROTULOS_MODALIDADE[assinatura.modalidade]}</Dado>
          {assinatura.modalidade !== 'gratuita' && <Dado rotulo="Plano">{assinatura.plano}</Dado>}
          {assinatura.modalidade === 'teste' && (
            <>
              <Dado rotulo="Fim do teste">{assinatura.fim_teste && formatarDiaISO(assinatura.fim_teste)}</Dado>
              <Dado rotulo="Valor depois do teste">{assinatura.valor_apos_teste !== null ? formatarDinheiro(assinatura.valor_apos_teste, assinatura.moeda) : null}</Dado>
            </>
          )}
          {assinatura.modalidade === 'paga' && (
            <>
              <Dado rotulo="Valor">{textoDoValor(ferramenta)}</Dado>
              <Dado rotulo="Equivalente mensal em reais">{ferramenta.equivalenteMensal !== null ? `${formatarDinheiro(ferramenta.equivalenteMensal, 'BRL')} (estimado)` : null}</Dado>
              <Dado rotulo="Dia de cobrança">{assinatura.dia_cobranca}</Dado>
              <Dado rotulo="Próxima cobrança">{assinatura.proxima_cobranca && formatarDiaISO(assinatura.proxima_cobranca)}</Dado>
              <Dado rotulo="Renovação">{assinatura.renovacao && ROTULOS_RENOVACAO[assinatura.renovacao]}</Dado>
              <Dado rotulo="Aviso para cancelar">{assinatura.aviso_cancelamento_dias !== null ? `${assinatura.aviso_cancelamento_dias} dias antes` : null}</Dado>
              <Dado rotulo="Conta de pagamento">{conta}</Dado>
              <Dado rotulo="Categoria financeira">{categoria}</Dado>
              <Dado rotulo="Gera títulos">{assinatura.gerar_titulos ? 'Sim' : 'Não'}</Dado>
            </>
          )}
          {assinatura.modalidade !== 'gratuita' && <Dado rotulo="Licenças">{assinatura.licencas}</Dado>}
          <Dado rotulo="Data da contratação">{assinatura.data_contratacao && formatarDiaISO(assinatura.data_contratacao)}</Dado>
        </ListaDeDados>
      ) : (
        <EstadoVazio icone={Wrench} titulo="O custo ainda está a definir." texto="Edite a ferramenta para informar a modalidade e o valor." />
      )}
      {consulta.dados.valores.length > 0 && (
        <section aria-label="Histórico de valores">
          <h3 className="mb-2 text-[15px]">Histórico de valores</h3>
          <ul className="grid gap-2 text-[13px]">
            {consulta.dados.valores.map((valor) => (
              <li key={valor.id} className="rounded-md border border-line bg-paper px-3.5 py-2.5">
                <span className="font-medium tabular-nums">
                  {valor.valor_anterior !== null ? formatarDinheiro(valor.valor_anterior, valor.moeda) : 'A confirmar'} → {formatarDinheiro(valor.valor_novo, valor.moeda)}
                </span>
                <span className="block text-xs text-ink-soft">
                  A partir de {formatarDiaISO(valor.efeito_em)} · {valor.motivo}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {anteriores.length > 0 && (
        <section aria-label="Assinaturas anteriores">
          <h3 className="mb-2 text-[15px]">Assinaturas anteriores</h3>
          <ul className="grid gap-2 text-[13px]">
            {anteriores.map((item: AssinaturaFerramenta) => (
              <li key={item.id} className="rounded-md border border-line bg-paper px-3.5 py-2.5">
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
        </section>
      )}
      <p className="text-xs text-ink-soft">Os títulos vinculados aparecem aqui quando o Financeiro entrar.</p>
    </div>
  );
}

/** RN-04.05: percentuais somando 100%, ou todos vazios. */
function AbaRateio({ ferramenta, dados, somenteLeitura }: { ferramenta: LinhaDaFerramenta; dados: DadosDasFerramentas; somenteLeitura: boolean }) {
  const inicial = () => Object.fromEntries(ferramenta.contextos.map((ligacao) => [ligacao.id, ligacao.percentual_rateio !== null ? valorParaCampo(ligacao.percentual_rateio) : '']));
  const assinaturaDosPercentuais = ferramenta.contextos.map((ligacao) => `${ligacao.id}:${ligacao.percentual_rateio}`).join('|');
  const [valores, setValores] = useState<Record<string, string>>(inicial);
  const [desde, setDesde] = useState(hojeISO());
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => setValores(inicial()), [assinaturaDosPercentuais]); // eslint-disable-line react-hooks/exhaustive-deps -- `inicial` lê a ferramenta atual

  const nomes = contextosDaFerramenta(ferramenta, dados);
  const linhas = ferramenta.contextos.map((ligacao) => ({ ligacaoId: ligacao.id, percentual: valores[ligacao.id] ?? '' }));

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
    <div className="grid gap-4">
      <p className="text-[13px] text-ink-soft">Sem percentuais, o custo vai inteiro para o primeiro contexto. Com percentuais, a soma precisa dar 100%.</p>
      <ul className="grid gap-2">
        {ferramenta.contextos.map((ligacao) => {
          const contexto = nomes.find((item) => item.id === (ligacao.produto_id ?? ID_INSTITUCIONAL));
          return (
            <li key={ligacao.id} className="flex items-center justify-between gap-3 rounded-md border border-line bg-paper px-3.5 py-2">
              {contexto ? <EtiquetaContexto contexto={contexto} /> : <span>Produto removido</span>}
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
            {(controle) => <Input type="date" {...controle} value={desde} onChange={(evento) => setDesde(evento.target.value)} />}
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
    <PainelFormulario aberto={aberto} aoFechar={aoFechar} titulo="Dados pessoais" alterado={isDirty} aoEnviar={enviar} salvando={isSubmitting}>
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
        {trata && (
          <>
            <p className="-mt-3 text-xs text-ink-soft">Os apps afetados são os produtos da ferramenta, em Produtos e rateio.</p>
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
            <Campo id="dados-url" rotulo="Link do acordo" erro={errors.acordo_dados_url?.message}>
              {(controle) => <Input type="url" inputMode="url" autoComplete="off" {...controle} {...register('acordo_dados_url')} />}
            </Campo>
            <Campo id="dados-revisao" rotulo="Última revisão">
              {(controle) => <Input type="date" {...controle} {...register('dados_revisado_em')} />}
            </Campo>
          </>
        )}
      </div>
    </PainelFormulario>
  );
}

function AbaDadosPessoais({ ferramenta, somenteLeitura }: { ferramenta: LinhaDaFerramenta; somenteLeitura: boolean }) {
  const [editando, setEditando] = useState(false);
  return (
    <div className="grid gap-4">
      <ListaDeDados>
        <Dado rotulo="Trata dados pessoais">{ferramenta.trata_dados_pessoais ? 'Sim' : 'Não'}</Dado>
        {ferramenta.trata_dados_pessoais && (
          <>
            <Dado rotulo="Tipos de dados">
              <span className="flex flex-wrap gap-1">
                {ferramenta.tipos_dados.map((tipo) => (
                  <EtiquetaLivre key={tipo}>{ROTULOS_TIPOS_DADOS[tipo]}</EtiquetaLivre>
                ))}
              </span>
            </Dado>
            <Dado rotulo="Região">{ferramenta.regiao_dados}</Dado>
            <Dado rotulo="Acordo de tratamento">{ferramenta.acordo_dados_situacao && ROTULOS_ACORDO_DADOS[ferramenta.acordo_dados_situacao]}</Dado>
            <Dado rotulo="Última revisão">{ferramenta.dados_revisado_em && formatarDiaISO(ferramenta.dados_revisado_em)}</Dado>
          </>
        )}
      </ListaDeDados>
      {ferramenta.acordo_dados_url && <BotaoAbrir url={ferramenta.acordo_dados_url} rotulo="Abrir o acordo" />}
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

/** RN-04.10: data efetiva e motivo. */
function DialogoDeCancelar({ ferramenta, aoFechar }: { ferramenta: LinhaDaFerramenta; aoFechar: () => void }) {
  const [data, setData] = useState(hojeISO());
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  async function confirmar() {
    try {
      await cancelarFerramenta(ferramenta.id, { data, motivo });
      aviso('Ferramenta cancelada.');
      aoFechar();
    } catch (falha) {
      setErro(mensagemDoErro(falha));
    }
  }

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && aoFechar()}>
      <DialogContent semFechar comDescricao>
        <DialogTitle>Cancelar {ferramenta.nome}?</DialogTitle>
        <DialogDescription className="mt-3 leading-[1.6]">A assinatura encerra na data escolhida. Faturas, pagamentos e histórico anteriores ficam guardados.</DialogDescription>
        <div className="mt-4 grid gap-4">
          <Campo id="cancelar-data" rotulo="Data efetiva" obrigatorio>
            {(controle) => <Input type="date" {...controle} value={data} onChange={(evento) => setData(evento.target.value)} />}
          </Campo>
          <Campo id="cancelar-motivo" rotulo="Motivo" obrigatorio erro={erro ?? undefined}>
            {(controle) => <Textarea {...controle} value={motivo} onChange={(evento) => setMotivo(evento.target.value)} />}
          </Campo>
        </div>
        <div className="acoes-dialogo">
          <Button variante="secundario" onClick={aoFechar}>
            Voltar
          </Button>
          <Button variante="perigo" onClick={() => void confirmar()}>
            Cancelar ferramenta
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** T04.02: ficha da ferramenta (P2). Acessos entram na F2 (D14). */
export function FichaFerramenta() {
  const { id } = useParams<{ id: string }>();
  const consulta = useConsulta(carregarFerramentas);
  const [editando, setEditando] = useState<'editar' | 'plano' | null>(null);
  const [cancelando, setCancelando] = useState(false);
  const [arquivando, setArquivando] = useState(false);

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

  async function executar(acao: () => Promise<void>, mensagem: string) {
    try {
      await acao();
      aviso(mensagem);
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    }
  }

  const linhaDoMenu = (fechar: () => void, rotulo: string, aoClicar: () => void) => (
    <li>
      <button
        type="button"
        className={`${CLASSE_LINHA_MENU} hover:bg-hover md:min-h-9 md:py-1.5`}
        onClick={() => {
          fechar();
          aoClicar();
        }}
      >
        {rotulo}
      </button>
    </li>
  );

  const menu = (
    <MenuSobreposto
      titulo="Mais ações"
      largura={240}
      alinhar="end"
      gatilho={
        <Button variante="icone" tamanho="icone" aria-label="Mais ações da ferramenta">
          <Ellipsis aria-hidden />
        </Button>
      }
    >
      {(fechar) => (
        <ul className="grid gap-0.5">
          {/* Registrar pagamento chega com o Financeiro (T05). */}
          {!cancelada && <LinhaEmBreve icone={<Receipt aria-hidden />} rotulo="Registrar pagamento" />}
          {!cancelada && linhaDoMenu(fechar, 'Cancelar ferramenta', () => setCancelando(true))}
          {linhaDoMenu(fechar, 'Arquivar', () => setArquivando(true))}
        </ul>
      )}
    </MenuSobreposto>
  );

  const acoes = arquivada ? null : (
    <>
      {!cancelada && (
        <Button onClick={() => setEditando('editar')}>
          <Pencil aria-hidden />
          Editar
        </Button>
      )}
      {!cancelada && (
        <Button variante="secundario" onClick={() => setEditando('plano')}>
          <Replace aria-hidden />
          Trocar plano
        </Button>
      )}
      {menu}
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
        acoesCelular={acoes}
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
          { id: 'resumo', rotulo: 'Resumo', conteudo: <Resumo ferramenta={ferramenta} dados={dados} /> },
          { id: 'assinatura', rotulo: 'Assinatura e custos', conteudo: <AbaAssinatura ferramenta={ferramenta} id={ferramenta.id} dados={dados} /> },
          { id: 'rateio', rotulo: 'Produtos e rateio', conteudo: <AbaRateio ferramenta={ferramenta} dados={dados} somenteLeitura={somenteLeitura} /> },
          { id: 'dados', rotulo: 'Dados pessoais', conteudo: <AbaDadosPessoais ferramenta={ferramenta} somenteLeitura={somenteLeitura} /> },
          { id: 'ativos', rotulo: 'Ativos hospedados', conteudo: <AbaAtivosHospedados id={ferramenta.id} /> },
          { id: 'atividades', rotulo: 'Atividades', conteudo: <AbaAtividades consultar={() => atividadesDoRegistro('ferramenta', ferramenta.id)} dependencia={ferramenta.id} vazio="Vincule uma atividade a esta ferramenta, pelo painel da atividade." /> },
          { id: 'arquivos', rotulo: 'Arquivos', conteudo: <AbaArquivos id={ferramenta.id} somenteLeitura={somenteLeitura} /> },
          { id: 'historico', rotulo: 'Histórico', conteudo: <AbaHistorico id={ferramenta.id} /> },
        ]}
      />
      <FormularioDeFerramenta aberto={Boolean(editando)} aoFechar={() => setEditando(null)} dados={dados} ferramenta={ferramenta} contextos={ferramenta.contextos} assinatura={ferramenta.assinatura} trocandoPlano={editando === 'plano'} />
      {cancelando && <DialogoDeCancelar ferramenta={ferramenta} aoFechar={() => setCancelando(false)} />}
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
