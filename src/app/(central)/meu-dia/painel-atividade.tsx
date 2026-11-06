'use client';

import { CampoEtiquetas } from '@/componentes/campos/etiquetas';
import { definirEtiquetasDoRegistro } from '@/dominio/etiquetas';
import { useCallback, useEffect, useState, type FocusEvent, type KeyboardEvent, type ReactNode } from 'react';
import { ArrowLeft, Check, Ellipsis, ExternalLink, Plus, Trash2 } from 'lucide-react';
import { CampoRepeticao, type ErrosDaRepeticao } from '@/componentes/atividades/campo-repeticao';
import { Campo, MensagemErro } from '@/componentes/campos/campo';
import { EntradaLinkDrive } from '@/componentes/campos/link-drive';
import { PilulasMultiplas } from '@/componentes/campos/pilulas';
import { Selecao } from '@/componentes/campos/selecao';
import { useCentral } from '@/componentes/layout/central-provider';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { aviso } from '@/componentes/padroes/aviso';
import { Confirmacao } from '@/componentes/padroes/confirmacao';
import { EstadoCarregando, EstadoErro } from '@/componentes/padroes/estados';
import { EtiquetaSituacao } from '@/componentes/padroes/etiquetas';
import { Faixa } from '@/componentes/padroes/faixa';
import { ListaHistorico } from '@/componentes/padroes/historico';
import { CLASSE_LINHA_MENU, MenuSobreposto } from '@/componentes/padroes/menu-sobreposto';
import { Avatar } from '@/componentes/padroes/pessoa';
import { Button } from '@/componentes/ui/button';
import { BotaoFechar, Dialog, DialogContent, DialogDescription, DialogTitle } from '@/componentes/ui/dialog';
import { Input } from '@/componentes/ui/input';
import { Textarea } from '@/componentes/ui/textarea';
import { mensagemDoErro } from '@/dados/erros';
import type { Atividade } from '@/dados/tipos/atividade';
import { useConsulta } from '@/dados/use-consulta';
import { carregarFormularioAtividade } from '@/dominio/atividades-formulario';
import { acaoDoAlerta, estaAberta, ROTULOS_ORIGEM_ALERTA, ROTULOS_PRIORIDADE_ATIVIDADE, ROTULOS_SITUACAO_ATIVIDADE, type AtividadeDoDia, type DadosMeuDia } from '@/dominio/atividades';
import {
  adicionarAnexo,
  adicionarItem,
  adicionarVinculo,
  alterarAviso,
  alterarCampos,
  alterarInicio,
  alterarPrazo,
  CAMINHO_DA_ATIVIDADE,
  carregarPainel,
  comentar,
  converterAtividade,
  definirResponsavelDoItem,
  duplicarAtividade,
  editarComentario,
  marcarItem,
  podeEditarComentario,
  removerAnexo,
  removerComentario,
  removerItem,
  removerVinculo,
  type DadosDoPainel,
} from '@/dominio/atividades-painel';
import { historicoDaAtividade } from '@/dominio/historico';
import { pessoasDoSeletor } from '@/dominio/pessoa-atual';
import { editarOcorrencia, repetirAtividade, type CamposDaOcorrencia, type EscopoDaEdicao } from '@/dominio/recorrencias';
import { errosDaRepeticao, regraDoFormulario, regraPorExtenso, repeticaoPadrao, fimPorExtenso } from '@/dominio/repeticao';
import { AVISO_CREDENCIAL, pareceCredencial } from '@/dominio/segredos';
import { diaEHoraNoFuso, hojeISO } from '@/lib/datas';
import { formatarData, formatarDataHora, formatarDiaISO, formatarHora } from '@/lib/formatacao';
import { cn } from '@/lib/utils';
import type { AcoesDaAtividade } from './acoes-atividade';
import { TipoDaAtividade } from './cartao-atividade';

/** Salvar na hora, e dizer quando não deu. */
async function salvar(acao: () => Promise<unknown>): Promise<string | null> {
  try {
    await acao();
    return null;
  } catch (erro) {
    return mensagemDoErro(erro);
  }
}

/** Grava os campos; numa ocorrência, pergunta antes até onde vale (RN-03.17). `false` é quem desistiu. */
type EditarAtividade = (campos: CamposDaOcorrencia) => Promise<boolean>;

/** Para as ações sem um campo onde mostrar a mensagem. */
function salvarComAviso(acao: () => Promise<unknown>) {
  void salvar(acao).then((falha) => {
    if (falha) aviso(falha);
  });
}

const Secao = ({ titulo, children }: { titulo: string; children: ReactNode }) => (
  <section className="border-t border-line pt-4">
    <h3 className="mb-3 font-body text-[13px] leading-[18px] font-semibold tracking-normal text-ink-soft">{titulo}</h3>
    {children}
  </section>
);

/**
 * Salva ao sair do campo, ou com Enter nos de uma linha. Data e hora também: digitar o ano passa por
 * datas que ninguém escolheu, e cada uma contaria como mudança de prazo.
 */
function TextoSalvo({ id, rotulo, valor, aoSalvar, tipo = 'text', multilinha = false, desativado = false, ajuda }: { id: string; rotulo: string; valor: string; aoSalvar: (novo: string) => Promise<unknown>; tipo?: 'text' | 'date' | 'time'; multilinha?: boolean; desativado?: boolean; ajuda?: ReactNode }) {
  const [texto, setTexto] = useState(valor);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => setTexto(valor), [valor]);

  async function confirmar() {
    if (texto.trim() === valor.trim()) return;
    let desistiu = false;
    const falha = await salvar(async () => {
      desistiu = (await aoSalvar(texto)) === false;
    });
    setErro(falha);
    if (falha || desistiu) setTexto(valor);
  }

  const aoTeclar = (evento: KeyboardEvent<HTMLInputElement>) => {
    if (evento.key === 'Enter') {
      evento.preventDefault();
      evento.currentTarget.blur();
    }
  };

  return (
    <Campo id={id} rotulo={rotulo} erro={erro ?? undefined} ajuda={ajuda}>
      {(controle) => (multilinha ? <Textarea {...controle} disabled={desativado} value={texto} onChange={(evento) => setTexto(evento.target.value)} onBlur={() => void confirmar()} /> : <Input type={tipo} autoComplete="off" {...controle} disabled={desativado} value={texto} onChange={(evento) => setTexto(evento.target.value)} onBlur={() => void confirmar()} onKeyDown={aoTeclar} />)}
    </Campo>
  );
}

function Cabecalho({ atividade, painel, dados, acoes, aoFechar, aoAbrir, editar }: { atividade: Atividade; painel: DadosDoPainel; dados: DadosMeuDia; acoes: AcoesDaAtividade; aoFechar: () => void; aoAbrir: (id: string) => void; editar: EditarAtividade }) {
  const { pessoa } = useCentral();
  const aberta = estaAberta(atividade);
  const doDia: AtividadeDoDia = { ...atividade, produtos: painel.produtos, participantes: painel.participantes, itensFeitos: 0, itensTotal: 0, comentarios: 0, etiquetas: painel.etiquetas };
  const alerta = atividade.tipo === 'alerta';
  const internas = pessoasDoSeletor(dados.pessoas);
  const responsaveis = internas.some((item) => item.id === atividade.responsavel_id) ? internas : [...internas, ...dados.pessoas.filter((item) => item.id === atividade.responsavel_id)];
  const [erro, setErro] = useState<string | null>(null);

  const trocar = async (acao: () => Promise<unknown>) => setErro(await salvar(acao));

  const linha = (rotulo: string, aoClicar: () => void, fechar: () => void) => (
    <button
      type="button"
      className={cn(CLASSE_LINHA_MENU, 'hover:bg-hover md:min-h-9 md:py-1.5')}
      onClick={() => {
        fechar();
        aoClicar();
      }}
    >
      {rotulo}
    </button>
  );

  return (
    <header className="max-md:contents md:shrink-0 md:border-b md:border-line md:px-6 md:pb-4">
      <div className="sticky top-0 z-10 flex shrink-0 items-center gap-2 bg-paper px-4 py-2 md:static md:px-0 md:pt-4 md:pb-0">
        <Button variante="icone" tamanho="icone" aria-label="Voltar" className="md:hidden" onClick={aoFechar}>
          <ArrowLeft aria-hidden />
        </Button>
        <p className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-soft">
          <TipoDaAtividade tipo={atividade.tipo} />
          <span className="tabular-nums">{atividade.codigo}</span>
          {atividade.adiamentos >= 2 && <span>· Adiada {atividade.adiamentos} vezes</span>}
        </p>
        <MenuSobreposto
          titulo="Mais ações"
          largura={270}
          alinhar="end"
          gatilho={
            <Button variante="icone" tamanho="icone" aria-label="Mais ações da atividade">
              <Ellipsis aria-hidden />
            </Button>
          }
        >
          {(fechar) => (
            <div className="grid gap-0.5">
              {aberta && !atividade.bloqueada && linha('Marcar bloqueada', () => acoes.pedir('bloquear', doDia), fechar)}
              {aberta && linha('Adiar', () => acoes.pedir('adiar', doDia), fechar)}
              {!alerta && linha('Duplicar', () => void duplicarAtividade(atividade.id).then((nova) => { aviso('Atividade duplicada.'); aoAbrir(nova.id); }, (falha: unknown) => aviso(mensagemDoErro(falha))), fechar)}
              {aberta && atividade.tipo === 'tarefa' && linha('Converter em demanda', () => void converterAtividade(atividade.id, 'demanda', pessoa.id).then(() => aviso('Convertida em demanda.')), fechar)}
              {aberta && atividade.tipo === 'demanda' && linha('Converter em tarefa', () => void converterAtividade(atividade.id, 'tarefa', pessoa.id).then(() => aviso('Convertida em tarefa.')), fechar)}
              {aberta && !alerta && linha('Cancelar', () => acoes.pedir('cancelar', doDia), fechar)}
              {linha('Copiar link', () => void navigator.clipboard?.writeText(`${window.location.origin}${CAMINHO_DA_ATIVIDADE(atividade.id)}`).then(() => aviso('Link copiado.'), () => aviso('Não deu para copiar o link.')), fechar)}
            </div>
          )}
        </MenuSobreposto>
        <BotaoFechar className="hidden md:inline-grid" onClick={aoFechar} />
      </div>

      <DialogTitle className="sr-only">{atividade.titulo}</DialogTitle>
      <div className="shrink-0 border-b border-line px-4 pb-3 md:border-0 md:p-0">
      <div className="md:mt-2">
        {alerta ? (
          <p className="font-display text-xl leading-[26px] font-semibold tracking-[-.02em] break-words">{atividade.titulo}</p>
        ) : (
          <TextoSalvo id="painel-titulo" rotulo="Título" valor={atividade.titulo} aoSalvar={(novo) => editar({ titulo: novo })} desativado={!aberta} />
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
        <Campo id="painel-situacao" rotulo="Situação">
          {(controle) =>
            atividade.situacao === 'cancelada' ? (
              <EtiquetaSituacao tipo="neutro">{ROTULOS_SITUACAO_ATIVIDADE.cancelada}</EtiquetaSituacao>
            ) : (
              <Selecao {...controle} value={atividade.situacao} onChange={(evento) => acoes.mover(doDia, evento.target.value as 'a_fazer')}>
                {(['a_fazer', 'em_andamento', 'aguardando', 'concluida'] as const).map((situacao) => (
                  <option key={situacao} value={situacao}>
                    {ROTULOS_SITUACAO_ATIVIDADE[situacao]}
                  </option>
                ))}
              </Selecao>
            )
          }
        </Campo>
        <Campo id="painel-prioridade" rotulo="Prioridade">
          {(controle) => (
            <Selecao {...controle} disabled={!aberta} value={atividade.prioridade} onChange={(evento) => void trocar(() => editar({ prioridade: evento.target.value as Atividade['prioridade'] }))}>
              {Object.entries(ROTULOS_PRIORIDADE_ATIVIDADE).map(([valor, rotulo]) => (
                <option key={valor} value={valor}>
                  {rotulo}
                </option>
              ))}
            </Selecao>
          )}
        </Campo>
        <Campo id="painel-responsavel" rotulo="Responsável" className="col-span-2 md:col-span-1">
          {(controle) => (
            <Selecao {...controle} disabled={!aberta} value={atividade.responsavel_id} onChange={(evento) => {
                const pessoaId = evento.target.value;
                void trocar(async () => {
                  if (await editar({ responsavel_id: pessoaId })) aviso('Responsável alterada.');
                });
              }}>
              {responsaveis.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nome_completo}
                </option>
              ))}
            </Selecao>
          )}
        </Campo>
      </div>
      {erro && <MensagemErro>{erro}</MensagemErro>}

      <div className="mt-3 flex flex-wrap gap-2">
        {aberta ? (
          <Button tamanho="pequeno" onClick={() => acoes.concluir(doDia)}>
            <Check aria-hidden />
            Concluir
          </Button>
        ) : (
          <Button variante="secundario" tamanho="pequeno" onClick={() => acoes.pedir('reabrir', doDia)}>
            Reabrir
          </Button>
        )}
        {atividade.bloqueada && aberta && (
          <Button variante="secundario" tamanho="pequeno" onClick={() => acoes.desbloquear(doDia)}>
            Desbloquear
          </Button>
        )}
      </div>
      </div>
    </header>
  );
}

function Detalhes({ atividade, painel, dados, editar, escopo, aoEsquecerEscopo }: { atividade: Atividade; painel: DadosDoPainel; dados: DadosMeuDia; editar: EditarAtividade; escopo: EscopoDaEdicao | null; aoEsquecerEscopo: () => void }) {
  const aberta = estaAberta(atividade);
  const alerta = atividade.tipo === 'alerta';
  const lembrete = atividade.tipo === 'lembrete';
  const avisoSalvo = atividade.aviso_em ? diaEHoraNoFuso(atividade.aviso_em) : { dia: '', hora: '' };
  const [erroAviso, setErroAviso] = useState<string | null>(null);
  const [diaAviso, setDiaAviso] = useState(avisoSalvo.dia);
  const [horaAviso, setHoraAviso] = useState(avisoSalvo.hora);
  useEffect(() => {
    setDiaAviso(avisoSalvo.dia);
    setHoraAviso(avisoSalvo.hora);
  }, [avisoSalvo.dia, avisoSalvo.hora]);
  const produtos = dados.produtos.filter((produto) => !produto.arquivado_em && (produto.situacao === 'ativo' || painel.produtos.includes(produto.id)));
  const pessoas = dados.pessoas.filter((pessoa) => !pessoa.arquivado_em && pessoa.id !== atividade.responsavel_id && (pessoa.situacao === 'ativa' || painel.participantes.includes(pessoa.id)));
  const areas = dados.areas.filter((area) => !area.arquivado_em || area.id === atividade.area_id);

  /** O dia e a hora andam juntos: passar de um para o outro ainda não salva. */
  async function aoSairDoAviso(evento: FocusEvent<HTMLInputElement>) {
    const destino = evento.relatedTarget;
    if (destino instanceof HTMLElement && ['painel-aviso-dia', 'painel-aviso-hora'].includes(destino.id)) return;
    if (diaAviso === avisoSalvo.dia && horaAviso === avisoSalvo.hora) return setErroAviso(null);
    setErroAviso(await salvar(() => alterarAviso(atividade.id, diaAviso, horaAviso)));
  }

  return (
    <Secao titulo="Detalhes">
      <div className="grid gap-[18px]">
        <TextoSalvo id="painel-descricao" rotulo="Descrição" multilinha valor={atividade.descricao ?? ''} desativado={!aberta} aoSalvar={(novo) => editar({ descricao: novo.trim() || null })} ajuda={pareceCredencial(atividade.descricao ?? '') ? <span className="text-warn">{AVISO_CREDENCIAL}</span> : undefined} />
        <Campo id="painel-area" rotulo="Área">
          {(controle) => (
            <Selecao {...controle} disabled={!aberta} value={atividade.area_id ?? ''} onChange={(evento) => salvarComAviso(() => editar({ area_id: evento.target.value || null }))}>
              <option value="">Nenhuma</option>
              {areas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.nome}
                </option>
              ))}
            </Selecao>
          )}
        </Campo>
        <PilulasMultiplas rotulo="Contexto" desativado={!aberta} valores={painel.produtos} aoMudar={(valores) => salvarComAviso(() => editar({ produtos: valores }))} opcoes={produtos.map((produto) => ({ valor: produto.id, rotulo: produto.nome }))} />
        <p className="-mt-3 text-xs text-ink-soft">Sem produto marcado, é da Numa.</p>
        <CampoEtiquetas etiquetas={dados.etiquetas} modulo="atividades" desativado={!aberta} valores={painel.etiquetas} aoMudar={(valores) => salvarComAviso(() => definirEtiquetasDoRegistro('atividade', atividade.id, valores))} />
        <PilulasMultiplas rotulo="Participantes" desativado={!aberta} valores={painel.participantes} aoMudar={(valores) => salvarComAviso(() => editar({ participantes: valores }))} opcoes={pessoas.map((pessoa) => ({ valor: pessoa.id, rotulo: pessoa.nome_completo }))} />
        {!lembrete && <TextoSalvo id="painel-inicio" rotulo="Início" tipo="date" valor={atividade.inicio ?? ''} desativado={!aberta} aoSalvar={(novo) => alterarInicio(atividade.id, novo)} />}
        {!lembrete && !alerta && (
          <div className="grid grid-cols-2 gap-3">
            <TextoSalvo id="painel-prazo" rotulo="Prazo" tipo="date" valor={atividade.prazo ?? ''} desativado={!aberta} aoSalvar={(novo) => alterarPrazo(atividade.id, novo, novo ? (atividade.prazo_hora ?? '') : '')} />
            <TextoSalvo id="painel-prazo-hora" rotulo="Hora (opcional)" tipo="time" valor={atividade.prazo_hora ?? ''} desativado={!aberta || !atividade.prazo} aoSalvar={(novo) => alterarPrazo(atividade.id, atividade.prazo ?? '', novo)} />
            {atividade.recorrencia_id && aberta && <p className="col-span-2 -mt-1 text-xs text-ink-soft">A data muda só nesta ocorrência. Para mudar as próximas, edite a rotina.</p>}
          </div>
        )}
        {alerta && atividade.prazo && <p className="text-[13px]">Prazo: {formatarDiaISO(atividade.prazo)}</p>}
        {!alerta && (
          <div>
            <div className="grid grid-cols-2 gap-3">
              <Campo id="painel-aviso-dia" rotulo={lembrete ? 'Data do aviso' : 'Avisar no dia'} obrigatorio={lembrete}>
                {(controle) => <Input type="date" {...controle} disabled={!aberta} value={diaAviso} onChange={(evento) => setDiaAviso(evento.target.value)} onBlur={(evento) => void aoSairDoAviso(evento)} />}
              </Campo>
              <Campo id="painel-aviso-hora" rotulo={lembrete ? 'Hora do aviso' : 'Às'} obrigatorio={lembrete}>
                {(controle) => <Input type="time" {...controle} disabled={!aberta} value={horaAviso} onChange={(evento) => setHoraAviso(evento.target.value)} onBlur={(evento) => void aoSairDoAviso(evento)} />}
              </Campo>
            </div>
            {erroAviso && <MensagemErro>{erroAviso}</MensagemErro>}
          </div>
        )}
        {!alerta && <RepeticaoDaAtividade atividade={atividade} painel={painel} escopo={escopo} aoEsquecerEscopo={aoEsquecerEscopo} />}
      </div>
    </Secao>
  );
}

/** "Recorrência (resumo + editar)" (T03.02). Quem não repete pode passar a repetir. */
function RepeticaoDaAtividade({ atividade, painel, escopo, aoEsquecerEscopo }: { atividade: Atividade; painel: DadosDoPainel; escopo: EscopoDaEdicao | null; aoEsquecerEscopo: () => void }) {
  const [repetindo, setRepetindo] = useState(false);
  const { rotina } = painel;
  const aberta = estaAberta(atividade);
  const fim = rotina ? fimPorExtenso(rotina) : null;
  return (
    <div>
      <p className="mb-[7px] texto-rotulo">Repetição</p>
      {rotina ? (
        <div className="grid gap-1 text-[13px]" data-repeticao>
          <p className="flex flex-wrap items-center gap-x-2">
            <span>
              {regraPorExtenso(rotina)}
              {fim ? `, ${fim}` : ''}
              {atividade.ocorrencia_numero ? ` · Ocorrência ${atividade.ocorrencia_numero}` : ''}
            </span>
            <LinkCentral href={`/meu-dia/rotinas?rotina=${rotina.id}`} className="inline-flex min-h-11 items-center font-semibold text-indigo underline-offset-2 hover:underline md:min-h-0">
              Ver rotina
            </LinkCentral>
          </p>
          {escopo && aberta && (
            <p className="flex flex-wrap items-center gap-x-2 text-xs text-ink-soft">
              <span>Nesta abertura, as mudanças valem para {escopo === 'esta' ? 'somente esta ocorrência' : 'esta e as próximas'}.</span>
              <Button variante="terciario" tamanho="pequeno" onClick={aoEsquecerEscopo}>
                Perguntar de novo
              </Button>
            </p>
          )}
        </div>
      ) : (
        <p className="flex flex-wrap items-center gap-x-2 text-[13px]">
          <span className="text-ink-soft">Não repete.</span>
          {aberta && (
            <Button variante="terciario" tamanho="pequeno" onClick={() => setRepetindo(true)}>
              Repetir
            </Button>
          )}
        </p>
      )}
      {repetindo && <DialogoDeRepetir atividade={atividade} aoFechar={() => setRepetindo(false)} />}
    </div>
  );
}

function DialogoDeRepetir({ atividade, aoFechar }: { atividade: Atividade; aoFechar: () => void }) {
  const hoje = hojeISO();
  const lembrete = atividade.tipo === 'lembrete';
  const aviso_ = atividade.aviso_em ? diaEHoraNoFuso(atividade.aviso_em) : null;
  const dia = atividade.prazo ?? aviso_?.dia ?? hoje;
  const [valor, setValor] = useState(() => ({ ...repeticaoPadrao(dia > hoje ? dia : hoje), hora: atividade.prazo_hora ?? aviso_?.hora ?? '' }));
  const [erros, setErros] = useState<ErrosDaRepeticao>({});
  const [falha, setFalha] = useState<string | null>(null);

  async function confirmar() {
    const encontrados = errosDaRepeticao(valor, { lembrete, minimoInicio: hoje });
    setErros(encontrados);
    if (Object.keys(encontrados).length) return;
    try {
      await repetirAtividade(atividade.id, regraDoFormulario(valor));
      aviso('Agora esta atividade faz parte de uma rotina.');
      aoFechar();
    } catch (erro) {
      setFalha(mensagemDoErro(erro));
    }
  }

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && aoFechar()}>
      <DialogContent semFechar comDescricao>
        <DialogTitle>Repetir esta atividade</DialogTitle>
        <DialogDescription className="mt-2">Ela vira a primeira ocorrência, na primeira data da regra. As próximas nascem no Meu dia, até 30 dias à frente.</DialogDescription>
        <div className="mt-4">
          <CampoRepeticao id="painel-repeticao" valor={valor} aoMudar={setValor} erros={erros} lembrete={lembrete} hoje={hoje} />
        </div>
        {falha && <MensagemErro>{falha}</MensagemErro>}
        <div className="acoes-dialogo">
          <Button variante="secundario" onClick={aoFechar}>
            Voltar
          </Button>
          <Button onClick={() => void confirmar()}>Repetir</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SecaoDemanda({ atividade, dados, editar }: { atividade: Atividade; dados: DadosMeuDia; editar: EditarAtividade }) {
  const aberta = estaAberta(atividade);
  return (
    <Secao titulo="Demanda">
      <div className="grid gap-[18px]">
        <Campo id="painel-solicitante" rotulo="Solicitante">
          {(controle) => (
            <Selecao {...controle} disabled={!aberta} value={atividade.solicitante_pessoa_id ?? ''} onChange={(evento) => salvarComAviso(() => editar({ solicitante_pessoa_id: evento.target.value || null, solicitante_texto: evento.target.value ? null : atividade.solicitante_texto }))}>
              <option value="">Outra: escrever o nome</option>
              {dados.pessoas
                .filter((pessoa) => !pessoa.arquivado_em || pessoa.id === atividade.solicitante_pessoa_id)
                .map((pessoa) => (
                  <option key={pessoa.id} value={pessoa.id}>
                    {pessoa.nome_completo}
                  </option>
                ))}
            </Selecao>
          )}
        </Campo>
        {!atividade.solicitante_pessoa_id && <TextoSalvo id="painel-solicitante-texto" rotulo="Quem pediu" valor={atividade.solicitante_texto ?? ''} desativado={!aberta} aoSalvar={(novo) => editar({ solicitante_texto: novo.trim() || null })} />}
        <TextoSalvo id="painel-resultado" rotulo="Resultado esperado" multilinha valor={atividade.resultado_esperado ?? ''} desativado={!aberta} aoSalvar={(novo) => editar({ resultado_esperado: novo.trim() || null })} />
      </div>
    </Secao>
  );
}

function SecaoAguardando({ atividade, dados }: { atividade: Atividade; dados: DadosMeuDia }) {
  const nome = atividade.aguardando_de_pessoa_id ? (dados.pessoas.find((pessoa) => pessoa.id === atividade.aguardando_de_pessoa_id)?.nome_completo ?? 'Pessoa removida') : atividade.aguardando_de_texto;
  return (
    <Secao titulo="Aguardando">
      <p className="text-[13px]">
        De {nome}
        {atividade.aguardando_desde ? `, desde ${formatarDiaISO(atividade.aguardando_desde)}` : ''}.
      </p>
      <div className="mt-3">
        <TextoSalvo id="painel-acompanhamento" rotulo="Acompanhar em" tipo="date" valor={atividade.acompanhamento_em ?? ''} aoSalvar={(novo) => alterarCampos(atividade.id, { acompanhamento_em: novo || null })} />
      </div>
    </Secao>
  );
}

function SecaoBloqueio({ atividade, painel, dados }: { atividade: Atividade; painel: DadosDoPainel; dados: DadosMeuDia }) {
  const quem = dados.pessoas.find((pessoa) => pessoa.id === painel.quemBloqueou)?.nome_completo;
  return (
    <Secao titulo="Bloqueio">
      <Faixa tipo="erro">
        <p className="font-semibold break-words">{atividade.bloqueio_motivo}</p>
        <p className="mt-1">
          {atividade.bloqueada_em ? `Desde ${formatarData(atividade.bloqueada_em)}` : ''}
          {quem ? `, por ${quem}` : ''}
        </p>
      </Faixa>
    </Secao>
  );
}

function SecaoChecklist({ atividade, painel, dados }: { atividade: Atividade; painel: DadosDoPainel; dados: DadosMeuDia }) {
  const { pessoa } = useCentral();
  const [novo, setNovo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const aberta = estaAberta(atividade);
  const internas = pessoasDoSeletor(dados.pessoas);

  async function adicionar() {
    const falha = await salvar(() => adicionarItem(atividade.id, novo));
    setErro(falha);
    if (!falha) setNovo('');
  }

  const feitos = painel.itens.filter((item) => item.feito).length;
  return (
    <Secao titulo={painel.itens.length ? `Checklist (${feitos} de ${painel.itens.length})` : 'Checklist'}>
      <ul className="grid gap-1">
        {painel.itens.map((item) => {
          const quem = dados.pessoas.find((itemPessoa) => itemPessoa.id === item.feito_por)?.nome_completo;
          const responsavel = dados.pessoas.find((itemPessoa) => itemPessoa.id === item.responsavel_id)?.nome_completo;
          return (
            <li key={item.id} className="flex flex-wrap items-start gap-x-2 gap-y-1 rounded-sm py-1 md:flex-nowrap">
              <label className={cn('flex min-h-11 w-full min-w-0 items-start gap-2.5 py-1 md:min-h-0 md:w-auto md:flex-1', aberta && 'cursor-pointer')}>
                <input type="checkbox" className="mt-0.5 size-[18px] shrink-0 accent-[var(--ok)]" disabled={!aberta} checked={item.feito} aria-label={item.texto} onChange={(evento) => salvarComAviso(() => marcarItem(item.id, evento.target.checked, pessoa.id))} />
                <span className="min-w-0 text-[13px] leading-[20px] break-words">
                  <span className={item.feito ? 'text-ink-soft line-through' : undefined}>{item.texto}</span>
                  {item.feito && quem && item.feito_em && <span className="block text-xs text-ink-soft">Feito por {quem} em {formatarData(item.feito_em)}</span>}
                  {!aberta && responsavel && <span className="block text-xs text-ink-soft">Responsável: {responsavel}</span>}
                </span>
              </label>
              {aberta && (
                <>
                  <span className="ml-7 min-w-0 flex-1 md:ml-0 md:w-32 md:flex-none">
                    <Selecao aria-label={`Responsável por ${item.texto}`} value={item.responsavel_id ?? ''} onChange={(evento) => salvarComAviso(() => definirResponsavelDoItem(item.id, evento.target.value))} className="min-h-9 text-[13px] max-md:min-h-11 max-md:text-base">
                      <option value="">Ninguém</option>
                      {internas.map((itemPessoa) => (
                        <option key={itemPessoa.id} value={itemPessoa.id}>
                          {itemPessoa.nome_completo}
                        </option>
                      ))}
                    </Selecao>
                  </span>
                  <Button variante="icone" tamanho="icone" aria-label={`Tirar ${item.texto}`} onClick={() => salvarComAviso(() => removerItem(item.id))}>
                    <Trash2 aria-hidden />
                  </Button>
                </>
              )}
            </li>
          );
        })}
      </ul>
      {aberta && (
        <div className="mt-2">
          <div className="flex items-center gap-2">
            <Input
              id="painel-novo-item"
              aria-label="Novo item"
              placeholder="Novo item"
              autoComplete="off"
              value={novo}
              onChange={(evento) => setNovo(evento.target.value)}
              onKeyDown={(evento) => {
                if (evento.key === 'Enter') {
                  evento.preventDefault();
                  void adicionar();
                }
              }}
              className="min-w-0 flex-1"
            />
            <Button variante="secundario" onClick={() => void adicionar()}>
              <Plus aria-hidden />
              Adicionar
            </Button>
          </div>
          {erro && <MensagemErro>{erro}</MensagemErro>}
        </div>
      )}
    </Secao>
  );
}

function SecaoVinculos({ atividade, painel, dados }: { atividade: Atividade; painel: DadosDoPainel; dados: DadosMeuDia }) {
  const [erro, setErro] = useState<string | null>(null);
  const consulta = useConsulta(carregarFormularioAtividade);
  const aberta = estaAberta(atividade);
  const contrapartes = consulta.dados?.contrapartes ?? [];

  async function escolher(valor: string) {
    const [tipo, id] = valor.split(':');
    if (tipo && id) setErro(await salvar(() => adicionarVinculo(atividade.id, tipo, id)));
  }

  return (
    <Secao titulo="Vínculos">
      {painel.vinculos.length > 0 && (
        <ul className="mb-2 grid gap-1">
          {painel.vinculos.map((vinculo) => (
            <li key={vinculo.id} className="flex items-center justify-between gap-2 text-[13px]">
              <span className="min-w-0 break-words">
                <span className="text-ink-soft">{vinculo.rotulo}: </span>
                {vinculo.href ? (
                  <LinkCentral href={vinculo.href} className="inline-flex min-h-11 items-center underline underline-offset-2 md:min-h-0">
                    {vinculo.nome}
                  </LinkCentral>
                ) : (
                  vinculo.nome
                )}
              </span>
              {aberta && (
                <Button variante="icone" tamanho="icone" aria-label={`Tirar o vínculo com ${vinculo.nome}`} onClick={() => salvarComAviso(() => removerVinculo(vinculo.id))}>
                  <Trash2 aria-hidden />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {aberta && (
        <Campo id="painel-vinculo" rotulo="Vincular a" erro={erro ?? undefined}>
          {(controle) => (
            <Selecao {...controle} value="" onChange={(evento) => void escolher(evento.target.value)}>
              <option value="">Escolha um registro</option>
              <optgroup label="Contrapartes">
                {contrapartes.map((contraparte) => (
                  <option key={contraparte.id} value={`contraparte:${contraparte.id}`}>
                    {contraparte.nome_fantasia || contraparte.nome}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Produtos">
                {dados.produtos
                  .filter((produto) => !produto.arquivado_em)
                  .map((produto) => (
                    <option key={produto.id} value={`produto:${produto.id}`}>
                      {produto.nome}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="Ferramentas">
                {(consulta.dados?.ferramentas ?? []).map((ferramenta) => (
                  <option key={ferramenta.id} value={`ferramenta:${ferramenta.id}`}>
                    {ferramenta.nome}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Lançamentos">
                {(consulta.dados?.titulos ?? []).map((titulo) => (
                  <option key={titulo.id} value={`titulo:${titulo.id}`}>
                    {titulo.codigo} · {titulo.descricao}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Ativos digitais">
                {(consulta.dados?.ativos ?? []).map((ativo) => (
                  <option key={ativo.id} value={`ativo_digital:${ativo.id}`}>
                    {ativo.identificador}
                  </option>
                ))}
              </optgroup>
            </Selecao>
          )}
        </Campo>
      )}
    </Secao>
  );
}

function SecaoArquivos({ atividade, painel }: { atividade: Atividade; painel: DadosDoPainel }) {
  const [link, setLink] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const aberta = estaAberta(atividade);

  async function adicionar() {
    const falha = await salvar(() => adicionarAnexo(atividade.id, link, ''));
    setErro(falha);
    if (!falha) setLink('');
  }

  return (
    <Secao titulo="Arquivos">
      {painel.anexos.length > 0 && (
        <ul className="mb-2 grid gap-1">
          {painel.anexos.map((anexo) => (
            <li key={anexo.id} className="flex items-center justify-between gap-2 text-[13px]">
              <a href={anexo.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 min-w-0 items-center gap-1.5 underline underline-offset-2 md:min-h-0 [&_svg]:size-[14px] [&_svg]:shrink-0">
                <ExternalLink aria-hidden />
                <span className="truncate">{anexo.titulo}</span>
              </a>
              {aberta && (
                <Button variante="icone" tamanho="icone" aria-label={`Tirar ${anexo.titulo}`} onClick={() => salvarComAviso(() => removerAnexo(anexo.id))}>
                  <Trash2 aria-hidden />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {aberta && (
        <Campo id="painel-arquivo" rotulo="Link do Drive" erro={erro ?? undefined}>
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
    </Secao>
  );
}

function SecaoAlerta({ atividade, acoes, doDia }: { atividade: Atividade; acoes: AcoesDaAtividade; doDia: AtividadeDoDia }) {
  const acao = acaoDoAlerta(atividade);
  return (
    <Secao titulo="Alerta">
      <dl className="grid gap-1 text-[13px]">
        <div className="flex gap-1.5">
          <dt className="text-ink-soft">Origem:</dt>
          <dd>{ROTULOS_ORIGEM_ALERTA[atividade.origem_tipo ?? ''] ?? 'Sistema'}</dd>
        </div>
        {atividade.alerta_motivo && (
          <div className="flex gap-1.5">
            <dt className="text-ink-soft">Motivo:</dt>
            <dd>{atividade.alerta_motivo}</dd>
          </div>
        )}
        {atividade.alerta_data_referencia && (
          <div className="flex gap-1.5">
            <dt className="text-ink-soft">Data de referência:</dt>
            <dd>{formatarDiaISO(atividade.alerta_data_referencia)}</dd>
          </div>
        )}
      </dl>
      <p className="mt-2 text-xs text-ink-soft">Concluir aqui não executa a ação de origem.</p>
      {estaAberta(atividade) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {acao && (
            <Button asChild tamanho="pequeno">
              <LinkCentral href={acao.href}>{acao.rotulo}</LinkCentral>
            </Button>
          )}
          <Button variante="secundario" tamanho="pequeno" onClick={() => acoes.pedir('dispensar', doDia)}>
            Dispensar alerta
          </Button>
        </div>
      )}
      {atividade.dispensada_motivo && <p className="mt-2 text-[13px]">Dispensado: {atividade.dispensada_motivo}</p>}
    </Secao>
  );
}

function SecaoComentarios({ atividade, painel, dados, aoMudarRascunho }: { atividade: Atividade; painel: DadosDoPainel; dados: DadosMeuDia; aoMudarRascunho: (temRascunho: boolean) => void }) {
  const { pessoa } = useCentral();
  const [texto, setTexto] = useState('');
  useEffect(() => () => aoMudarRascunho(false), [aoMudarRascunho]);

  function mudarTexto(novo: string) {
    setTexto(novo);
    aoMudarRascunho(Boolean(novo.trim()));
  }
  const [avisado, setAvisado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [editando, setEditando] = useState<{ id: string; texto: string } | null>(null);
  const internas = pessoasDoSeletor(dados.pessoas);
  const nome = (id: string) => dados.pessoas.find((item) => item.id === id)?.nome_completo ?? 'Pessoa removida';
  const ativos = painel.comentarios.filter((comentario) => !comentario.removido_em);

  async function enviar() {
    const limpo = texto.trim();
    if (pareceCredencial(limpo) && avisado !== limpo) {
      setAvisado(limpo);
      return;
    }
    const falha = await salvar(() => comentar(atividade.id, limpo, pessoa.id, internas));
    setErro(falha);
    if (!falha) {
      mudarTexto('');
      setAvisado(null);
    }
  }

  return (
    <Secao titulo={ativos.length ? `Comentários (${ativos.length})` : 'Comentários'}>
      <ul className="grid gap-3">
        {painel.comentarios.map((comentario) => (
          <li key={comentario.id} className="flex items-start gap-2.5">
            <Avatar nome={nome(comentario.autor_id)} className="size-7 text-[12px]" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-ink-soft">
                <span className="font-semibold text-ink">{nome(comentario.autor_id)}</span> · {formatarData(comentario.criado_em)} às {formatarHora(comentario.criado_em)}
                {comentario.editado_em ? ' · editado' : ''}
              </p>
              {editando?.id === comentario.id ? (
                <div className="mt-1 grid gap-2">
                  <Textarea aria-label="Editar comentário" value={editando.texto} onChange={(evento) => setEditando({ id: comentario.id, texto: evento.target.value })} />
                  <div className="flex gap-2">
                    <Button
                      tamanho="pequeno"
                      onClick={() => {
                        void salvar(() => editarComentario(comentario.id, editando.texto, internas, pessoa.id)).then((falha) => {
                          setErro(falha);
                          if (!falha) setEditando(null);
                        });
                      }}
                    >
                      Salvar
                    </Button>
                    <Button variante="terciario" tamanho="pequeno" onClick={() => setEditando(null)}>
                      Voltar
                    </Button>
                  </div>
                </div>
              ) : (
                <p className={cn('mt-0.5 text-[13px] leading-[20px] whitespace-pre-wrap break-words', comentario.removido_em && 'text-ink-soft italic')}>{comentario.texto}</p>
              )}
              {comentario.autor_id === pessoa.id && !comentario.removido_em && editando?.id !== comentario.id && (
                <div className="mt-0.5 flex gap-1">
                  {podeEditarComentario(comentario, pessoa.id) && (
                    <Button variante="terciario" tamanho="pequeno" onClick={() => setEditando({ id: comentario.id, texto: comentario.texto })}>
                      Editar
                    </Button>
                  )}
                  <Button variante="terciario" tamanho="pequeno" onClick={() => salvarComAviso(() => removerComentario(comentario.id))}>
                    Remover
                  </Button>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
      <div className={cn('grid gap-2', painel.comentarios.length > 0 && 'mt-3')}>
        <Campo id="painel-comentario" rotulo="Novo comentário" erro={erro ?? undefined}>
          {(controle) => <Textarea {...controle} value={texto} onChange={(evento) => mudarTexto(evento.target.value)} />}
        </Campo>
        {avisado !== null && avisado === texto.trim() && <Faixa tipo="atencao">{AVISO_CREDENCIAL}</Faixa>}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-ink-soft">Mencionar:</span>
          {internas.map((item) => {
            const primeiro = item.nome_completo.split(' ')[0] ?? item.nome_completo;
            return (
              <Button key={item.id} variante="secundario" tamanho="pequeno" aria-label={`Mencionar ${item.nome_completo}`} onClick={() => mudarTexto(`${texto}${texto && !texto.endsWith(' ') ? ' ' : ''}@${primeiro} `)}>
                @{primeiro}
              </Button>
            );
          })}
        </div>
        <Button variante="secundario" className="justify-self-start" onClick={() => void enviar()}>
          Comentar
        </Button>
      </div>
    </Secao>
  );
}

function SecaoHistorico({ id }: { id: string }) {
  const consulta = useConsulta(() => historicoDaAtividade(id), [id]);
  return (
    <Secao titulo="Histórico">
      <ListaHistorico consulta={consulta} comFiltros />
    </Secao>
  );
}

type PainelAtividadeProps = {
  /** O id vem do endereço: dá para copiar o link e abrir direto (T03.02). */
  id: string | null;
  dados: DadosMeuDia;
  acoes: AcoesDaAtividade;
  aoFechar: () => void;
  aoAbrir: (id: string) => void;
};

/** T03.02: painel lateral de 560px (tela inteira no celular), mantendo o Meu dia e os filtros atrás. */
export function PainelAtividade({ id, dados, acoes, aoFechar, aoAbrir }: PainelAtividadeProps) {
  // Guarda o último id para o conteúdo continuar na tela enquanto o painel sai.
  const [atual, setAtual] = useState(id);
  useEffect(() => {
    if (id) setAtual(id);
  }, [id]);
  const consulta = useConsulta(() => (atual ? carregarPainel(atual) : Promise.resolve(null)), [atual]);
  const painel = consulta.dados;
  const atividade = painel?.atividade;
  const doDia: AtividadeDoDia | null = atividade && painel ? { ...atividade, produtos: painel.produtos, participantes: painel.participantes, itensFeitos: 0, itensTotal: 0, comentarios: 0, etiquetas: painel.etiquetas } : null;
  const [temRascunho, setTemRascunho] = useState(false);
  const [confirmandoSaida, setConfirmandoSaida] = useState(false);
  // RN-03.17: pergunta uma vez por abertura, e a resposta fica à vista até o painel fechar.
  const [escopo, setEscopo] = useState<EscopoDaEdicao | null>(null);
  const [pergunta, setPergunta] = useState<{ responder: (resposta: EscopoDaEdicao | null) => void } | null>(null);
  const idDaAtividade = atividade?.id;
  const ehOcorrencia = Boolean(atividade?.recorrencia_id);

  useEffect(() => setEscopo(null), [id]);

  const editar = useCallback<EditarAtividade>(
    async (campos) => {
      if (!idDaAtividade) return false;
      if (!ehOcorrencia) {
        await editarOcorrencia(idDaAtividade, campos, 'esta');
        return true;
      }
      const escolhido = escopo ?? (await new Promise<EscopoDaEdicao | null>((responder) => setPergunta({ responder })));
      if (!escolhido) return false;
      setEscopo(escolhido);
      await editarOcorrencia(idDaAtividade, campos, escolhido);
      return true;
    },
    [idDaAtividade, ehOcorrencia, escopo],
  );

  function responderEscopo(resposta: EscopoDaEdicao | null) {
    pergunta?.responder(resposta);
    setPergunta(null);
  }

  // Fechar com o cursor num campo (Esc, voltar do navegador) salva o que foi escrito: o painel ainda está na tela enquanto sai.
  useEffect(() => {
    const ativo = document.activeElement;
    if (!id && ativo instanceof HTMLElement && ativo.closest('.painel-lateral')) ativo.blur();
  }, [id]);

  /** Os campos salvam sozinhos; o comentário só existe depois de enviado, e por isso pergunta antes (P3). */
  function pedirFechar() {
    if (temRascunho) setConfirmandoSaida(true);
    else aoFechar();
  }


  return (
    <>
    <Dialog open={Boolean(id)} onOpenChange={(aberto) => !aberto && pedirFechar()}>
      <DialogContent variante="painel" semFechar data-largura="detalhe" aria-describedby={undefined}>
        {consulta.estado === 'carregando' && (
          <div className="p-6">
            <DialogTitle className="sr-only">Carregando a atividade</DialogTitle>
            <EstadoCarregando />
          </div>
        )}
        {consulta.estado === 'erro' && (
          <div className="p-6">
            <DialogTitle className="sr-only">Erro ao ler a atividade</DialogTitle>
            <EstadoErro titulo="Não deu para ler esta atividade." aoTentarDeNovo={consulta.recarregar} />
          </div>
        )}
        {consulta.estado === 'pronto' && !atividade && (
          <div className="p-6">
            <DialogTitle className="font-display text-xl">Esta atividade não existe mais</DialogTitle>
            <p className="mt-2 text-sm text-ink-soft">Ela pode ter sido removida ao limpar os exemplos ou ao importar um arquivo.</p>
            <Button variante="secundario" className="mt-4" onClick={aoFechar}>
              Voltar ao Meu dia
            </Button>
          </div>
        )}
        {atividade && painel && doDia && (
          // No celular, a tela é pequena para um cabeçalho fixo: tudo rola, menos a barra de cima.
          <div key={atividade.id} className="flex min-h-0 flex-1 flex-col max-md:relative max-md:overflow-y-auto">
            <Cabecalho atividade={atividade} painel={painel} dados={dados} acoes={acoes} aoFechar={pedirFechar} aoAbrir={aoAbrir} editar={editar} />
            <div className="grid content-start gap-4 px-4 py-5 md:min-h-0 md:flex-1 md:overflow-y-auto md:px-6 [&>section:first-child]:border-t-0 [&>section:first-child]:pt-0">
              {atividade.tipo === 'alerta' && <SecaoAlerta atividade={atividade} acoes={acoes} doDia={doDia} />}
              {atividade.bloqueada && estaAberta(atividade) && <SecaoBloqueio atividade={atividade} painel={painel} dados={dados} />}
              {atividade.situacao === 'aguardando' && <SecaoAguardando atividade={atividade} dados={dados} />}
              {atividade.situacao === 'cancelada' && atividade.cancelada_motivo && !atividade.dispensada_motivo && <Faixa>Cancelada: {atividade.cancelada_motivo}</Faixa>}
              {atividade.concluida_em && (
                <p className="text-[13px] text-ink-soft">
                  Concluída em {formatarDataHora(atividade.concluida_em)}
                  {` por ${atividade.concluida_por ? (dados.pessoas.find((pessoa) => pessoa.id === atividade.concluida_por)?.nome_completo ?? 'Pessoa removida') : 'Sistema'}`}
                  {atividade.conclusao_nota ? `. ${atividade.conclusao_nota}` : ''}
                </p>
              )}
              <Detalhes atividade={atividade} painel={painel} dados={dados} editar={editar} escopo={escopo} aoEsquecerEscopo={() => setEscopo(null)} />
              {atividade.tipo === 'demanda' && <SecaoDemanda atividade={atividade} dados={dados} editar={editar} />}
              {atividade.tipo !== 'lembrete' && <SecaoChecklist atividade={atividade} painel={painel} dados={dados} />}
              <SecaoVinculos atividade={atividade} painel={painel} dados={dados} />
              <SecaoArquivos atividade={atividade} painel={painel} />
              <SecaoComentarios atividade={atividade} painel={painel} dados={dados} aoMudarRascunho={setTemRascunho} />
              <SecaoHistorico id={atividade.id} />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
    <Dialog open={Boolean(pergunta)} onOpenChange={(aberto) => !aberto && responderEscopo(null)}>
      <DialogContent semFechar comDescricao>
        <DialogTitle>Esta atividade faz parte de uma rotina</DialogTitle>
        <DialogDescription className="mt-3">A mudança vale só para esta ocorrência, ou também para as próximas? As anteriores não mudam.</DialogDescription>
        <div className="acoes-dialogo">
          <Button variante="secundario" onClick={() => responderEscopo(null)}>
            Voltar
          </Button>
          <Button variante="secundario" onClick={() => responderEscopo('esta')}>
            Somente esta
          </Button>
          <Button onClick={() => responderEscopo('proximas')}>Esta e as próximas</Button>
        </div>
      </DialogContent>
    </Dialog>
    <Confirmacao
      aberto={confirmandoSaida}
      aoFechar={() => setConfirmandoSaida(false)}
      titulo="Descartar o comentário?"
      texto="O comentário que você escreveu ainda não foi enviado."
      rotuloConfirmar="Descartar comentário"
      rotuloCancelar="Continuar escrevendo"
      perigo
      aoConfirmar={() => {
        setConfirmandoSaida(false);
        aoFechar();
      }}
    />
    </>
  );
}
