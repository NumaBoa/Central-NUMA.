'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, ExternalLink, ListChecks, Lock, Pencil, Play, Plus, RotateCcw, SkipForward, Trash2 } from 'lucide-react';
import { FormularioConta } from '@/app/(central)/configuracoes/cadastros/contas/formulario-conta';
import { FormularioDaEntidade } from '@/app/(central)/configuracoes/cadastros/entidades/tela-entidades';
import { Campo } from '@/componentes/campos/campo';
import { EntradaData } from '@/componentes/campos/entrada-data';
import { EntradaLinkDrive } from '@/componentes/campos/link-drive';
import { Pilulas } from '@/componentes/campos/pilulas';
import { Selecao } from '@/componentes/campos/selecao';
import { SelecaoPessoa } from '@/componentes/campos/selecao-pessoa';
import { MolduraDaEmpresa, ResumoDaEmpresa, SituacaoDoItem } from '@/componentes/empresa/aparencia';
import { useFormulario } from '@/componentes/empresa/use-formulario';
import { useCentral } from '@/componentes/layout/central-provider';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { aviso } from '@/componentes/padroes/aviso';
import { Confirmacao } from '@/componentes/padroes/confirmacao';
import { Dado, ListaDeDados } from '@/componentes/padroes/dado';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { Faixa } from '@/componentes/padroes/faixa';
import { JanelaFormulario } from '@/componentes/padroes/janela-formulario';
import { Lista, type Coluna } from '@/componentes/padroes/lista';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { Textarea } from '@/componentes/ui/textarea';
import { mensagemDoErro } from '@/dados/erros';
import type { ConstituicaoItem } from '@/dados/tipos/sociedade';
import { useConsulta } from '@/dados/use-consulta';
import { ROTULOS_SITUACAO_VERSAO, versaoAtual } from '@/dominio/acordos';
import { CAMINHO_DA_ATIVIDADE, ROTULOS_SITUACAO_ATIVIDADE } from '@/dominio/atividades';
import { acordosParaEvidencia, carregarConstituicao, checklistIniciado, concluirItem, entidadePrincipal, errosDaConclusao, errosDoItem, estadoDoItem, formularioDoItem, formularioItemVazio, iniciarChecklist, iniciarItem, marcarNaoSeAplica, motivoDoBloqueio, progressoDoChecklist, reabrirItem, removerItem, rotuloDoResponsavel, ROTULOS_EVIDENCIA_ITEM, salvarItem, type DadosDaConstituicao, type FormularioItem } from '@/dominio/constituicao';
import { carregarContas } from '@/dominio/contas';
import { carregarEntidades, ROTULOS_SITUACAO_ENTIDADE } from '@/dominio/entidades';
import { pessoasDoSeletor } from '@/dominio/pessoa-atual';
import { nomeDaPessoa, sociasAtivas, textoDaParticipacao } from '@/dominio/sociedade';
import { hojeISO } from '@/lib/datas';
import { formatarDiaISO } from '@/lib/formatacao';

async function executar(acao: () => Promise<unknown>, mensagem: string) {
  try {
    await acao();
    aviso(mensagem);
  } catch (erro) {
    aviso(mensagemDoErro(erro));
  }
}

function textoDaEvidencia(item: ConstituicaoItem): string {
  if (!item.exige_evidencia) return 'Não exigida';
  if (item.evidencia_url || item.evidencia_registro_id) return 'Registrada';
  return item.evidencia_tipo ? ROTULOS_EVIDENCIA_ITEM[item.evidencia_tipo] : ROTULOS_EVIDENCIA_ITEM.arquivo;
}

function textoDasDependencias(item: ConstituicaoItem, itens: readonly ConstituicaoItem[]): string {
  const nomes = item.depende_de.flatMap((id) => {
    const outro = itens.find((linha) => linha.id === id);
    return outro ? [`${outro.ordem}. ${outro.titulo}`] : [];
  });
  return nomes.join(' · ') || '—';
}

/** T06.06 e RN-06.10: a evidência certa para cada item. CNPJ e conta PJ passam pelos cadastros de M02, sem duplicar. */
function JanelaDaConclusao({ item, dados, aoFechar }: { item: ConstituicaoItem; dados: DadosDaConstituicao; aoFechar: () => void }) {
  const hoje = hojeISO();
  const acordos = acordosParaEvidencia(item, dados);
  const decisoes = dados.decisoes.filter((decisao) => decisao.situacao === 'registrada');
  const [ativando, setAtivando] = useState(false);
  const [cadastrandoConta, setCadastrandoConta] = useState(false);
  const entidades = useConsulta(carregarEntidades);
  const contas = useConsulta(carregarContas);
  const f = useFormulario({
    prefixo: 'conclusao',
    inicial: () => ({ evidencia_url: item.evidencia_url ?? '', evidencia_registro_id: item.evidencia_registro_id ?? (item.evidencia_tipo === 'acordo' && acordos.length === 1 ? (acordos[0]?.id ?? '') : '') }),
    validar: (valores) => errosDaConclusao(item, valores, dados),
    salvar: (valores) => concluirItem(item.id, valores, hoje),
    mensagem: 'Item concluído.',
    aoSalvar: aoFechar,
  });
  const entidade = entidades.dados ? entidadePrincipal(entidades.dados.entidades.filter((linha) => !linha.arquivado_em)) : undefined;

  return (
    <>
      <JanelaFormulario aberto aoFechar={aoFechar} titulo={`Concluir: ${item.titulo}`} alterado={f.alterado} aoEnviar={f.enviar} rotuloSalvar="Concluir item" salvando={f.salvando} erros={f.lista}>
        <div className="grid gap-4">
          {!item.exige_evidencia && item.chave !== 'cnpj' && item.chave !== 'conta_pj' && <p className="text-sm">Este item não exige evidência.</p>}
          {item.chave === 'cnpj' && (
            <Faixa
              tipo={f.erros.entidade || entidade?.situacao !== 'ativa' ? 'atencao' : 'sucesso'}
              acao={
                entidade?.situacao !== 'ativa' ? (
                  <Button id="conclusao-entidade" variante="secundario" tamanho="pequeno" disabled={!entidades.dados} onClick={() => setAtivando(true)}>
                    Completar e ativar
                  </Button>
                ) : undefined
              }
            >
              {entidade?.situacao === 'ativa' ? `A entidade ${entidade.nome} está Ativa.` : 'Concluir este item pede os dados da entidade: CNPJ, endereço, representante e data de abertura. Ela passa a Ativa, sem um segundo cadastro.'}
            </Faixa>
          )}
          {item.chave === 'conta_pj' && (
            <Faixa
              tipo={f.erros.conta ? 'atencao' : 'info'}
              acao={
                <Button id="conclusao-conta" variante="secundario" tamanho="pequeno" disabled={!contas.dados} onClick={() => setCadastrandoConta(true)}>
                  Cadastrar a conta
                </Button>
              }
            >
              A conta bancária da PJ entra em Contas financeiras, com a entidade como titular.
            </Faixa>
          )}
          {item.exige_evidencia && item.evidencia_tipo === 'acordo' && (
            <Campo rotulo="Acordo vigente" obrigatorio ajuda={acordos.length ? undefined : 'Nenhum acordo vigente serve para este item ainda.'} {...f.campo('evidencia_registro_id')}>
              {(controle) => (
                <Selecao {...controle} {...f.entrada('evidencia_registro_id')}>
                  <option value="">Escolha</option>
                  {acordos.map((acordo) => (
                    <option key={acordo.id} value={acordo.id}>
                      {acordo.titulo}
                    </option>
                  ))}
                </Selecao>
              )}
            </Campo>
          )}
          {item.exige_evidencia && item.evidencia_tipo === 'decisao' && (
            <Campo
              rotulo="Decisão registrada"
              obrigatorio
              ajuda={
                <LinkCentral href="/empresa/decisoes" className="inline-flex min-h-11 items-center underline underline-offset-2 md:min-h-0">
                  Registrar uma decisão
                </LinkCentral>
              }
              {...f.campo('evidencia_registro_id')}
            >
              {(controle) => (
                <Selecao {...controle} {...f.entrada('evidencia_registro_id')}>
                  <option value="">Escolha</option>
                  {decisoes.map((decisao) => (
                    <option key={decisao.id} value={decisao.id}>
                      {decisao.codigo} · {decisao.titulo}
                    </option>
                  ))}
                </Selecao>
              )}
            </Campo>
          )}
          {item.exige_evidencia && item.evidencia_tipo === 'ativos' && (
            <Faixa tipo={dados.pendentesDeTransferencia.length ? 'atencao' : 'sucesso'}>
              {dados.pendentesDeTransferencia.length ? (
                <>
                  Cada ativo tem a própria evidência, em{' '}
                  <LinkCentral href="/empresa/ativos" className="inline-flex min-h-11 items-center underline underline-offset-2 md:min-h-0">
                    Ativos a transferir
                  </LinkCentral>
                  . Ainda {dados.pendentesDeTransferencia.length === 1 ? 'falta 1 item' : `faltam ${dados.pendentesDeTransferencia.length} itens`}.
                </>
              ) : (
                'Não há ativos pendentes: cada transferência já tem a própria evidência.'
              )}
            </Faixa>
          )}
          {item.exige_evidencia && (item.evidencia_tipo === 'arquivo' || !item.evidencia_tipo) && (
            <Campo rotulo="Link da evidência" obrigatorio ajuda="Link do Drive. A evidência fica no Drive da Numa." {...f.campo('evidencia_url')}>
              {(controle) => <EntradaLinkDrive link={f.valores.evidencia_url} {...controle} {...f.entrada('evidencia_url')} />}
            </Campo>
          )}
        </div>
      </JanelaFormulario>
      {ativando && entidades.dados && <FormularioDaEntidade aberto aoFechar={() => setAtivando(false)} entidade={entidade ?? null} dados={entidades.dados} situacaoInicial="ativa" />}
      {cadastrandoConta && contas.dados && <FormularioConta aberto aoFechar={() => setCadastrandoConta(false)} conta={null} dados={contas.dados} />}
    </>
  );
}

function JanelaDoFormularioDoItem({ item, dados, aoFechar }: { item?: ConstituicaoItem; dados: DadosDaConstituicao; aoFechar: () => void }) {
  const { pessoa } = useCentral();
  const f = useFormulario<FormularioItem>({
    prefixo: 'item',
    inicial: () => (item ? formularioDoItem(item) : formularioItemVazio(pessoa.id)),
    validar: (valores) => errosDoItem(valores, item?.id, dados.itens),
    salvar: async (valores) => {
      await salvarItem(valores, item?.id);
    },
    textos: (valores) => [valores.descricao],
    mensagem: item ? 'Item atualizado.' : 'Item adicionado ao checklist.',
    aoSalvar: aoFechar,
  });
  const { valores, mudar } = f;
  const outros = dados.itens.filter((outro) => outro.id !== item?.id);
  return (
    <JanelaFormulario colunas={2} aberto aoFechar={aoFechar} titulo={item ? 'Editar item' : 'Novo item'} descricao="O checklist é um roteiro para conferir com o contador." alterado={f.alterado} aoEnviar={f.enviar} rotuloSalvar={item ? 'Salvar alterações' : 'Adicionar'} salvando={f.salvando} erros={f.lista}>
      <div className="grid grid-cols-1 gap-[18px]">
        <Campo rotulo="Título" obrigatorio {...f.campo('titulo')}>
          {(controle) => <Input autoComplete="off" {...controle} {...f.entrada('titulo')} />}
        </Campo>
        <Campo rotulo="Descrição" {...f.campo('descricao')}>
          {(controle) => <Textarea {...controle} {...f.entrada('descricao')} />}
        </Campo>
        <Pilulas
          rotulo="Responsável"
          obrigatorio
          valor={valores.responsavel_tipo}
          aoMudar={(valor) => mudar({ responsavel_tipo: valor as FormularioItem['responsavel_tipo'] })}
          opcoes={[
            { valor: 'pessoa', rotulo: 'Uma pessoa' },
            { valor: 'ambas', rotulo: 'Ambas' },
            { valor: 'contador', rotulo: 'Contador' },
          ]}
        />
        {valores.responsavel_tipo === 'pessoa' && (
          <Campo rotulo="Quem" obrigatorio {...f.campo('responsavel_id')}>
            {(controle) => <SelecaoPessoa pessoas={pessoasDoSeletor(dados.pessoas)} vazio="Escolha" {...controle} {...f.entrada('responsavel_id')} />}
          </Campo>
        )}
        <Campo rotulo="Prazo" {...f.campo('prazo')}>
          {(controle) => <EntradaData {...controle} {...f.entrada('prazo')} />}
        </Campo>
      </div>
      <div className="grid grid-cols-1 gap-[18px]">
        <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-[13px] md:min-h-0">
          <input id="item-exige-evidencia" type="checkbox" className="size-[18px] accent-[var(--ok)]" checked={valores.exige_evidencia} onChange={(evento) => mudar({ exige_evidencia: evento.target.checked })} />
          <span className="font-medium">Exige evidência para concluir</span>
        </label>
        {valores.exige_evidencia && item?.evidencia_tipo !== 'ativos' && (
          <Pilulas
            rotulo="Evidência"
            valor={valores.evidencia_tipo}
            aoMudar={(valor) => mudar({ evidencia_tipo: valor as FormularioItem['evidencia_tipo'] })}
            opcoes={[
              { valor: 'arquivo', rotulo: ROTULOS_EVIDENCIA_ITEM.arquivo },
              { valor: 'acordo', rotulo: ROTULOS_EVIDENCIA_ITEM.acordo },
              { valor: 'decisao', rotulo: ROTULOS_EVIDENCIA_ITEM.decisao },
            ]}
          />
        )}
        <fieldset id="item-depende_de" tabIndex={-1}>
          <legend className="mb-[7px] texto-rotulo">Depende de</legend>
          <div className="grid max-h-64 gap-1 overflow-y-auto rounded-md border border-line p-2">
            {outros.map((outro) => (
              <label key={outro.id} className="flex min-h-11 cursor-pointer items-start gap-2 py-1 text-[13px] md:min-h-0">
                <input
                  type="checkbox"
                  className="mt-0.5 size-[18px] shrink-0 accent-[var(--ok)]"
                  checked={valores.depende_de.includes(outro.id)}
                  onChange={(evento) => mudar({ depende_de: evento.target.checked ? [...valores.depende_de, outro.id] : valores.depende_de.filter((id) => id !== outro.id) })}
                />
                <span>
                  {outro.ordem}. {outro.titulo}
                </span>
              </label>
            ))}
          </div>
          {f.erros.depende_de && <p className="mt-1.5 text-[13px] font-medium text-err">{f.erros.depende_de}</p>}
        </fieldset>
        {f.avisoDeCredencial}
      </div>
    </JanelaFormulario>
  );
}

function JanelaDoItem({ item, dados, aoFechar, aoConcluir, aoEditar }: { item: ConstituicaoItem; dados: DadosDaConstituicao; aoFechar: () => void; aoConcluir: () => void; aoEditar: () => void }) {
  const [naoAplica, setNaoAplica] = useState(false);
  const [reabrindo, setReabrindo] = useState(false);
  const [removendo, setRemovendo] = useState(false);
  const estado = estadoDoItem(item, dados.itens);
  const motivo = motivoDoBloqueio(item, dados.itens);
  const atividade = dados.atividades.find((linha) => linha.id === item.atividade_id);
  const aberto = item.situacao === 'a_fazer' || item.situacao === 'em_andamento';
  const acordo = dados.acordos.find((linha) => linha.id === item.evidencia_registro_id);
  const decisao = dados.decisoes.find((linha) => linha.id === item.evidencia_registro_id);
  const atividadeSemItem = atividade?.situacao === 'concluida' && aberto;

  return (
    <>
      <JanelaFormulario soLeitura aberto aoFechar={aoFechar} titulo={`${item.ordem}. ${item.titulo}`} {...(item.descricao ? { descricao: item.descricao } : {})} aoEnviar={(evento) => evento.preventDefault()}>
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <SituacaoDoItem estado={estado} />
            {item.concluido_em && <span className="text-[13px] text-ink-soft">em {formatarDiaISO(item.concluido_em)}</span>}
          </div>
          {motivo && <Faixa tipo="atencao">{motivo}</Faixa>}
          {item.situacao === 'nao_se_aplica' && item.motivo_nao_aplica && <Faixa tipo="info">Não se aplica: {item.motivo_nao_aplica}</Faixa>}
          {atividadeSemItem && <Faixa tipo="info">A atividade foi concluída no Meu dia. Para o checklist andar, conclua o item{item.exige_evidencia ? ' com a evidência' : ''}.</Faixa>}
          <ListaDeDados>
            <Dado rotulo="Responsável">{rotuloDoResponsavel(item, dados.pessoas)}</Dado>
            <Dado rotulo="Prazo">{item.prazo ? formatarDiaISO(item.prazo) : 'Sem prazo'}</Dado>
            <Dado rotulo="Dependências">{textoDasDependencias(item, dados.itens)}</Dado>
            <Dado rotulo="Evidência necessária">{item.exige_evidencia ? (item.evidencia_tipo ? ROTULOS_EVIDENCIA_ITEM[item.evidencia_tipo] : ROTULOS_EVIDENCIA_ITEM.arquivo) : 'Não exigida'}</Dado>
            {(item.evidencia_url || acordo || decisao) && (
              <Dado rotulo="Evidência registrada">
                {item.evidencia_url && (
                  <a href={item.evidencia_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center underline underline-offset-2 md:min-h-0">
                    Abrir no Drive
                  </a>
                )}
                {acordo && (
                  <LinkCentral href={`/empresa/acordos/${acordo.id}`} className="inline-flex min-h-11 items-center underline underline-offset-2 md:min-h-0">
                    {acordo.titulo}
                  </LinkCentral>
                )}
                {decisao && (
                  <LinkCentral href={`/empresa/decisoes/${decisao.id}`} className="inline-flex min-h-11 items-center underline underline-offset-2 md:min-h-0">
                    {decisao.codigo} · {decisao.titulo}
                  </LinkCentral>
                )}
              </Dado>
            )}
            <Dado rotulo="Atividade no Meu dia">
              {atividade ? (
                <LinkCentral href={CAMINHO_DA_ATIVIDADE(atividade.id)} className="inline-flex items-center gap-1 underline underline-offset-2 [&_svg]:size-3.5">
                  {atividade.codigo} · {ROTULOS_SITUACAO_ATIVIDADE[atividade.situacao]}
                  <ExternalLink aria-hidden />
                </LinkCentral>
              ) : (
                <span className="text-ink-soft">Criada ao iniciar o checklist</span>
              )}
            </Dado>
          </ListaDeDados>
          <div className="flex flex-wrap gap-2">
            {aberto && (
              <Button disabled={estado === 'bloqueado'} onClick={aoConcluir}>
                <CheckCircle2 aria-hidden />
                Concluir
              </Button>
            )}
            {item.situacao === 'a_fazer' && (
              <Button variante="secundario" disabled={estado === 'bloqueado'} onClick={() => void executar(() => iniciarItem(item.id), 'Item em andamento.')}>
                <Play aria-hidden />
                Iniciar
              </Button>
            )}
            {!aberto && (
              <Button variante="secundario" onClick={() => setReabrindo(true)}>
                <RotateCcw aria-hidden />
                Reabrir
              </Button>
            )}
            <Button variante="secundario" onClick={aoEditar}>
              <Pencil aria-hidden />
              Editar
            </Button>
            {aberto && item.chave !== 'cnpj' && (
              <Button variante="terciario" onClick={() => setNaoAplica(true)}>
                <SkipForward aria-hidden />
                Não se aplica
              </Button>
            )}
            {item.chave !== 'cnpj' && (
              <Button variante="terciario" onClick={() => setRemovendo(true)}>
                <Trash2 aria-hidden />
                Tirar do checklist
              </Button>
            )}
          </div>
        </div>
      </JanelaFormulario>
      <Confirmacao
        aberto={naoAplica}
        aoFechar={() => setNaoAplica(false)}
        titulo="Este item não se aplica?"
        texto="O item sai da conta do progresso e deixa de segurar os que dependem dele. A atividade é cancelada."
        rotuloConfirmar="Não se aplica"
        pedirMotivo
        mensagemSemMotivo="“Não se aplica” exige o motivo."
        aoConfirmar={(texto) => {
          setNaoAplica(false);
          void executar(() => marcarNaoSeAplica(item.id, texto), 'Item marcado como não aplicável.');
        }}
      />
      <Confirmacao
        aberto={reabrindo}
        aoFechar={() => setReabrindo(false)}
        titulo="Reabrir este item?"
        texto="A atividade volta a ficar aberta no Meu dia."
        rotuloConfirmar="Reabrir"
        pedirMotivo
        aoConfirmar={(texto) => {
          setReabrindo(false);
          void executar(() => reabrirItem(item.id, texto), 'Item reaberto.');
        }}
      />
      <Confirmacao
        aberto={removendo}
        aoFechar={() => setRemovendo(false)}
        titulo="Tirar este item do checklist?"
        texto="O histórico guarda, e a atividade aberta é cancelada."
        rotuloConfirmar="Tirar do checklist"
        perigo
        aoConfirmar={() => {
          setRemovendo(false);
          void removerItem(item.id).then(
            () => {
              aviso('Item removido do checklist.');
              aoFechar();
            },
            (erro: unknown) => aviso(mensagemDoErro(erro)),
          );
        }}
      />
    </>
  );
}

type FiltroDoChecklist = 'todos' | 'a_fazer' | 'bloqueados' | 'concluidos';

/** T06.06: o roteiro até a empresa aberta. O item abre em janela central; no celular, em tela inteira. */
export function TelaConstituicao() {
  const parametros = useSearchParams();
  const consulta = useConsulta(carregarConstituicao);
  const [filtro, setFiltro] = useState<FiltroDoChecklist>('todos');
  const [aberto, setAberto] = useState<string | null>(null);
  const [concluindo, setConcluindo] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const [novo, setNovo] = useState(false);
  const [iniciando, setIniciando] = useState(false);
  const dados = consulta.dados;

  // Vindo do vínculo da atividade (T03.02): abre o item.
  const pedido = parametros.get('item');
  useEffect(() => {
    if (pedido) setAberto(pedido);
  }, [pedido]);

  const linhas = useMemo(() => {
    if (!dados) return [];
    return dados.itens.filter((item) => {
      const estado = estadoDoItem(item, dados.itens);
      if (filtro === 'bloqueados') return estado === 'bloqueado';
      if (filtro === 'concluidos') return estado === 'concluido' || estado === 'nao_se_aplica';
      if (filtro === 'a_fazer') return estado === 'a_fazer' || estado === 'em_andamento';
      return true;
    });
  }, [dados, filtro]);

  async function iniciar() {
    setIniciando(true);
    try {
      const novas = await iniciarChecklist();
      aviso(novas ? `${novas === 1 ? '1 atividade criada' : `${novas} atividades criadas`} no Meu dia.` : 'Nada novo: cada item aberto já tem a sua atividade.');
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    } finally {
      setIniciando(false);
    }
  }

  const iniciado = dados ? checklistIniciado(dados.itens) : false;
  const moldura = (conteudo: React.ReactNode) => (
    <MolduraDaEmpresa
      ativa="constituicao"
      titulo="Constituição da empresa"
      resumo="Roteiro editável, para conferir com o contador."
      acoes={
        <>
          <Button onClick={() => void iniciar()} carregando={iniciando} disabled={!dados}>
            <Play aria-hidden />
            {iniciado ? 'Atualizar atividades' : 'Iniciar checklist'}
          </Button>
          <Button variante="secundario" onClick={() => setNovo(true)} disabled={!dados}>
            <Plus aria-hidden />
            Novo item
          </Button>
        </>
      }
    >
      {conteudo}
    </MolduraDaEmpresa>
  );

  if (consulta.estado === 'carregando') return moldura(<EstadoCarregando />);
  if (consulta.estado === 'erro' || !dados) return moldura(<EstadoErro titulo="Não deu para ler o checklist." aoTentarDeNovo={consulta.recarregar} />);

  const progresso = progressoDoChecklist(dados.itens);
  const entidade = entidadePrincipal(dados.entidades);
  const memorando = dados.acordos.find((acordo) => acordo.tipo === 'memorando' || acordo.tipo === 'acordo_socias');
  const versaoDoMemorando = memorando ? versaoAtual(memorando.id, dados.versoes) : undefined;
  const percentual = progresso.total ? Math.round((progresso.concluidos / progresso.total) * 100) : 0;
  const itemAberto = dados.itens.find((item) => item.id === aberto);
  const itemConcluindo = dados.itens.find((item) => item.id === concluindo);
  const itemEditando = dados.itens.find((item) => item.id === editando);

  const colunas: readonly Coluna<ConstituicaoItem>[] = [
    { id: 'ordem', titulo: '#', essencial: true, celula: (item) => <span className="tabular-nums">{item.ordem}</span> },
    { id: 'titulo', titulo: 'Item', essencial: true, celula: (item) => <span className="font-medium">{item.titulo}</span> },
    { id: 'situacao', titulo: 'Situação', essencial: true, celula: (item) => <SituacaoDoItem estado={estadoDoItem(item, dados.itens)} /> },
    { id: 'responsavel', titulo: 'Responsável', celula: (item) => rotuloDoResponsavel(item, dados.pessoas) },
    { id: 'dependencias', titulo: 'Depende de', celula: (item) => <span className="text-[13px]">{item.depende_de.map((id) => dados.itens.find((outro) => outro.id === id)?.ordem).filter(Boolean).join(', ') || '—'}</span> },
    { id: 'evidencia', titulo: 'Evidência', celula: (item) => <span className="text-[13px]">{textoDaEvidencia(item)}</span> },
    { id: 'prazo', titulo: 'Prazo', celula: (item) => (item.prazo ? formatarDiaISO(item.prazo) : <span className="text-ink-soft">Sem prazo</span>) },
  ];

  return moldura(
    <>
      <ResumoDaEmpresa
        itens={[
          { rotulo: 'Entidade', valor: entidade ? ROTULOS_SITUACAO_ENTIDADE[entidade.situacao] : 'Nenhuma' },
          { rotulo: 'Sócias', valor: sociasAtivas(dados.socias).map((socia) => `${nomeDaPessoa(dados.pessoas, socia.pessoa_id)} (${textoDaParticipacao(socia.participacao)})`).join(' e ') },
          ...(versaoDoMemorando ? [{ rotulo: 'Memorando', valor: `V${versaoDoMemorando.numero} · ${ROTULOS_SITUACAO_VERSAO[versaoDoMemorando.situacao]}` }] : []),
        ]}
      />
      <section aria-label="Progresso do checklist" className="rounded-lg border border-line bg-paper p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <p className="font-semibold tabular-nums">
            {progresso.concluidos} de {progresso.total} itens concluídos
          </p>
          <p className="text-[13px] text-ink-soft">
            <Lock className="mr-1 inline size-3.5 align-[-2px]" aria-hidden />
            {progresso.bloqueados === 1 ? '1 bloqueado' : `${progresso.bloqueados} bloqueados`}
          </p>
        </div>
        <div role="progressbar" aria-label="Progresso do checklist" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentual} className="mt-2 h-2 overflow-hidden rounded-pill bg-mist">
          <div className="h-full rounded-pill bg-indigo-dk" style={{ width: `${percentual}%` }} />
        </div>
      </section>

      <Pilulas
        rotulo="Mostrar"
        rotuloOculto
        valor={filtro}
        aoMudar={(valor) => setFiltro(valor as FiltroDoChecklist)}
        opcoes={[
          { valor: 'todos', rotulo: 'Todos' },
          { valor: 'a_fazer', rotulo: 'Para fazer' },
          { valor: 'bloqueados', rotulo: 'Bloqueados' },
          { valor: 'concluidos', rotulo: 'Resolvidos' },
        ]}
      />

      <Lista
        rotulo="Itens do checklist"
        linhas={linhas}
        colunas={colunas}
        chave={(item) => item.id}
        aoAbrir={(item) => setAberto(item.id)}
        filtrando={filtro !== 'todos'}
        aoLimparFiltros={() => setFiltro('todos')}
        vazio={<EstadoVazio icone={ListChecks} titulo="O checklist está vazio." texto="Adicione os itens que valem para a Numa." acao={<Button onClick={() => setNovo(true)}>Novo item</Button>} />}
        cartao={(item) => (
          <span className="grid gap-1.5">
            <span className="font-medium">
              {item.ordem}. {item.titulo}
            </span>
            <span>
              <SituacaoDoItem estado={estadoDoItem(item, dados.itens)} />
            </span>
            <span className="text-[13px] text-ink-soft">Responsável: {rotuloDoResponsavel(item, dados.pessoas)}</span>
            <span className="text-[13px] text-ink-soft">Evidência: {textoDaEvidencia(item)}</span>
          </span>
        )}
      />
      <p className="text-[13px] text-ink-soft">Ao iniciar, cada item ganha uma atividade no Meu dia, sem duplicar. O item 8 ativa a entidade, e o 11 pede a conta da PJ.</p>

      {itemAberto && !concluindo && !editando && (
        <JanelaDoItem
          item={itemAberto}
          dados={dados}
          aoFechar={() => setAberto(null)}
          aoConcluir={() => setConcluindo(itemAberto.id)}
          aoEditar={() => setEditando(itemAberto.id)}
        />
      )}
      {itemConcluindo && <JanelaDaConclusao item={itemConcluindo} dados={dados} aoFechar={() => setConcluindo(null)} />}
      {(novo || itemEditando) && (
        <JanelaDoFormularioDoItem
          {...(itemEditando ? { item: itemEditando } : {})}
          dados={dados}
          aoFechar={() => {
            setNovo(false);
            setEditando(null);
          }}
        />
      )}
    </>,
  );
}
