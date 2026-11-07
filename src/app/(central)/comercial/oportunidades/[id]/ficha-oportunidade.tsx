'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, CalendarPlus, CircleAlert, FilePlus2, Flag, Pencil, Plus, RotateCcw, Trash2, TriangleAlert } from 'lucide-react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { AbaAtividades } from '@/componentes/atividades/aba-atividades';
import { Campo, MensagemErro } from '@/componentes/campos/campo';
import { EntradaData } from '@/componentes/campos/entrada-data';
import { Selecao } from '@/componentes/campos/selecao';
import { SelecaoPessoa } from '@/componentes/campos/selecao-pessoa';
import { CaixasDeSelecao, CartaoDePainel, errosDoFormulario, executar, paraOpcoes } from '@/componentes/f1/apoio';
import { FormularioOportunidade } from '@/componentes/f1/formulario-oportunidade';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { aviso } from '@/componentes/padroes/aviso';
import { Confirmacao } from '@/componentes/padroes/confirmacao';
import { Dado, ListaDeDados } from '@/componentes/padroes/dado';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { EtiquetaContexto, EtiquetaSituacao } from '@/componentes/padroes/etiquetas';
import { Faixa } from '@/componentes/padroes/faixa';
import { Ficha } from '@/componentes/padroes/ficha';
import { ListaHistorico } from '@/componentes/padroes/historico';
import { JanelaFormulario } from '@/componentes/padroes/janela-formulario';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { Textarea } from '@/componentes/ui/textarea';
import { mensagemDoErro } from '@/dados/erros';
import { repositorios } from '@/dados/repositorios';
import { idDaPessoaAtual } from '@/dados/sessao';
import type { Oportunidade, Viabilidade } from '@/dados/tipos/comercial';
import { useConsulta } from '@/dados/use-consulta';
import { atividadesDoRegistro } from '@/dominio/atividades-painel';
import { avancarEtapa, carregarComercial, criarProposta, encerrarOportunidade, esquemaFormularioViabilidade, estaAbertaNoFunil, ETAPAS_ABERTAS, REFERENCIA_HISTORICA, reabrirOportunidade, registrarProximaAcao, ROTULOS_CONCLUSAO_VIABILIDADE, ROTULOS_ETAPA, ROTULOS_MOTIVO_PERDA, ROTULOS_SITUACAO_VERSAO, ROTULOS_TIPO_OPORTUNIDADE, salvarViabilidade, textoDosValores, type FormularioViabilidade } from '@/dominio/comercial';
import { nomeDaContraparte, ROTULOS_ORIGEM } from '@/dominio/contrapartes';
import { carregarContextos } from '@/dominio/contextos';
import { historicoDoRegistro } from '@/dominio/historico';
import { pessoasDoSeletor } from '@/dominio/pessoa-atual';
import { hojeISO } from '@/lib/datas';
import { formatarDiaISO, formatarDinheiro } from '@/lib/formatacao';

async function carregar(id: string) {
  const [dados, contextos, produtos, participantes, contatos, viabilidades, propostas, versoes] = await Promise.all([carregarComercial(), carregarContextos(), repositorios.oportunidade_produto.listar({ onde: { oportunidade_id: id } }), repositorios.oportunidade_participante.listar({ onde: { oportunidade_id: id } }), repositorios.oportunidade_contato.listar({ onde: { oportunidade_id: id } }), repositorios.viabilidade.listar({ onde: { oportunidade_id: id } }), repositorios.proposta.listar({ onde: { oportunidade_id: id } }), repositorios.proposta_versao.listar()]);
  const oportunidade = dados.oportunidades.find((item) => item.id === id) ?? null;
  return { dados, contextos, oportunidade, ligacoes: { produtos: produtos.map((item) => item.produto_id), participantes: participantes.map((item) => item.pessoa_id), contatos: contatos.map((item) => item.pessoa_id) }, viabilidade: viabilidades[0] ?? null, propostas: propostas.map((proposta) => ({ proposta, versoes: versoes.filter((versao) => versao.proposta_id === proposta.id).sort((a, b) => b.numero - a.numero) })) };
}
type Dados = Awaited<ReturnType<typeof carregar>>;

function FormularioViabilidade({ oportunidadeId, viabilidade, pessoas, aoFechar }: { oportunidadeId: string; viabilidade: Viabilidade | null; pessoas: Dados['dados']['pessoas']; aoFechar: () => void }) {
  const numero = (valor: number | null) => (valor === null ? '' : valor.toLocaleString('pt-BR'));
  const { register, control, handleSubmit, formState } = useForm<FormularioViabilidade>({
    resolver: zodResolver(esquemaFormularioViabilidade),
    defaultValues: viabilidade
      ? { existe: viabilidade.existe, entregas: viabilidade.entregas.map((entrega) => ({ descricao: entrega.descricao, horas: numero(entrega.horas), prazo_dias: numero(entrega.prazo_dias) })), prazo_estimado_dias: String(viabilidade.prazo_estimado_dias), custo_estimado: numero(viabilidade.custo_estimado), capacidade: viabilidade.capacidade, riscos: viabilidade.riscos ?? '', conclusao: viabilidade.conclusao, decididores: viabilidade.decididores, decidido_em: viabilidade.decidido_em }
      : { existe: '', entregas: [{ descricao: '', horas: '', prazo_dias: '' }], prazo_estimado_dias: '', custo_estimado: '', capacidade: '', riscos: '', conclusao: 'viavel', decididores: [idDaPessoaAtual() ?? ''], decidido_em: hojeISO() },
    mode: 'onTouched',
  });
  const entregas = useFieldArray({ control, name: 'entregas' });
  const { errors } = formState;
  const internas = pessoasDoSeletor(pessoas);
  const enviar = handleSubmit(async (formulario) => {
    try {
      await salvarViabilidade(oportunidadeId, formulario, viabilidade?.id);
      aviso('Viabilidade registrada.');
      aoFechar();
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    }
  });
  return (
    <JanelaFormulario colunas={2} aberto aoFechar={aoFechar} titulo="Viabilidade" descricao="Não bloqueia a proposta: a proposta mostra a conclusão." alterado={formState.isDirty} aoEnviar={enviar} salvando={formState.isSubmitting} erros={errosDoFormulario(errors, { existe: 'viab-existe', entregas: 'viab-entregas', prazo_estimado_dias: 'viab-prazo', capacidade: 'viab-capacidade', decididores: 'viab-decididores', decidido_em: 'viab-data' })}>
      <div className="grid grid-cols-1 gap-[18px]">
        <Campo id="viab-existe" rotulo="O que já existe" obrigatorio erro={errors.existe?.message} ajuda="Recursos e ofertas que já atendem.">
          {(controle) => <Textarea {...controle} rows={2} {...register('existe')} />}
        </Campo>
        <div id="viab-entregas" tabIndex={-1} className="grid gap-2">
          <p className="texto-rotulo">O que precisa ser feito *</p>
          {entregas.fields.map((campo, indice) => (
            <fieldset key={campo.id} className="grid gap-2 rounded-md border border-line p-3">
              <legend className="px-1 text-xs font-semibold">Entrega {indice + 1}</legend>
              <Input aria-label={`Descrição da entrega ${indice + 1}`} placeholder="Descrição" autoComplete="off" {...register(`entregas.${indice}.descricao`)} />
              <div className="grid grid-cols-2 gap-2">
                <Input aria-label={`Horas da entrega ${indice + 1}`} placeholder="Horas" inputMode="decimal" autoComplete="off" {...register(`entregas.${indice}.horas`)} />
                <Input aria-label={`Prazo, em dias, da entrega ${indice + 1}`} placeholder="Prazo (dias)" inputMode="numeric" autoComplete="off" {...register(`entregas.${indice}.prazo_dias`)} />
              </div>
              {entregas.fields.length > 1 && (
                <Button variante="terciario" tamanho="pequeno" className="justify-self-start" onClick={() => entregas.remove(indice)}>
                  <Trash2 aria-hidden />
                  Tirar
                </Button>
              )}
            </fieldset>
          ))}
          <Button variante="secundario" className="justify-self-start" onClick={() => entregas.append({ descricao: '', horas: '', prazo_dias: '' })}>
            <Plus aria-hidden />
            Incluir entrega
          </Button>
          {errors.entregas && <MensagemErro>Complete a descrição e as horas de cada entrega.</MensagemErro>}
        </div>
        <Campo id="viab-prazo" rotulo="Prazo estimado (dias)" obrigatorio erro={errors.prazo_estimado_dias?.message}>
          {(controle) => <Input {...controle} inputMode="numeric" autoComplete="off" {...register('prazo_estimado_dias')} />}
        </Campo>
        <Campo id="viab-custo" rotulo="Custo estimado (R$)" ajuda="Opcional. Vazio não é zero.">
          {(controle) => <Input {...controle} inputMode="decimal" autoComplete="off" placeholder="Não informado" {...register('custo_estimado')} />}
        </Campo>
        <Campo id="viab-capacidade" rotulo="Capacidade" obrigatorio erro={errors.capacidade?.message} ajuda="Quem faz e quando.">
          {(controle) => <Textarea {...controle} rows={2} {...register('capacidade')} />}
        </Campo>
        <Campo id="viab-riscos" rotulo="Riscos">
          {(controle) => <Textarea {...controle} rows={2} {...register('riscos')} />}
        </Campo>
        <Dado rotulo="Referência histórica">{REFERENCIA_HISTORICA}</Dado>
        <Controller
          control={control}
          name="conclusao"
          render={({ field }) => (
            <Campo id="viab-conclusao" rotulo="Conclusão" obrigatorio>
              {(controle) => (
                <Selecao {...controle} {...field}>
                  {paraOpcoes(ROTULOS_CONCLUSAO_VIABILIDADE).map((opcao) => (
                    <option key={opcao.valor} value={opcao.valor}>
                      {opcao.rotulo}
                    </option>
                  ))}
                </Selecao>
              )}
            </Campo>
          )}
        />
        <Controller control={control} name="decididores" render={({ field }) => <CaixasDeSelecao id="viab-decididores" rotulo="Decidido por" obrigatorio opcoes={internas.map((pessoa) => ({ valor: pessoa.id, rotulo: pessoa.nome_completo }))} valores={field.value} aoMudar={field.onChange} erro={errors.decididores?.message} />} />
        <Campo id="viab-data" rotulo="Decidido em" obrigatorio erro={errors.decidido_em?.message}>
          {(controle) => <EntradaData {...controle} {...register('decidido_em')} />}
        </Campo>
      </div>
    </JanelaFormulario>
  );
}

function DialogoProximaAcao({ oportunidade, pessoas, aoFechar }: { oportunidade: Oportunidade; pessoas: Dados['dados']['pessoas']; aoFechar: () => void }) {
  const [titulo, setTitulo] = useState('');
  const [prazo, setPrazo] = useState('');
  const [responsavel, setResponsavel] = useState(oportunidade.responsavel_id);
  const [erro, setErro] = useState<string | null>(null);
  return (
    <JanelaFormulario
      aberto
      aoFechar={aoFechar}
      titulo="Registrar próxima ação"
      descricao="Vira uma tarefa no Meu dia, vinculada a esta oportunidade."
      alterado={Boolean(titulo || prazo)}
      rotuloSalvar="Registrar"
      aoEnviar={(evento) => {
        evento.preventDefault();
        void registrarProximaAcao(oportunidade.id, { titulo, prazo, responsavelId: responsavel }).then(
          () => {
            aviso('Próxima ação registrada no Meu dia.');
            aoFechar();
          },
          (problema: unknown) => setErro(mensagemDoErro(problema)),
        );
      }}
    >
      <div className="grid gap-[18px]">
        <Campo id="acao-titulo" rotulo="O que fazer" obrigatorio>
          {(controle) => <Input {...controle} autoComplete="off" value={titulo} onChange={(evento) => setTitulo(evento.target.value)} />}
        </Campo>
        <Campo id="acao-prazo" rotulo="Quando" obrigatorio>
          {(controle) => <EntradaData {...controle} value={prazo} onChange={(evento) => setPrazo(evento.target.value)} />}
        </Campo>
        <Campo id="acao-responsavel" rotulo="Responsável" obrigatorio>
          {(controle) => <SelecaoPessoa {...controle} pessoas={pessoasDoSeletor(pessoas)} value={responsavel} onChange={(evento) => setResponsavel(evento.target.value)} />}
        </Campo>
        {erro && <MensagemErro>{erro}</MensagemErro>}
      </div>
    </JanelaFormulario>
  );
}

function DialogoEncerrar({ oportunidade, temAceite, aoFechar }: { oportunidade: Oportunidade; temAceite: boolean; aoFechar: () => void }) {
  const [desfecho, setDesfecho] = useState<'ganha' | 'perdida'>(temAceite ? 'ganha' : 'perdida');
  const [motivo, setMotivo] = useState<Oportunidade['motivo_perda'] | ''>('');
  const [texto, setTexto] = useState('');
  const [adesao, setAdesao] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  return (
    <JanelaFormulario
      aberto
      aoFechar={aoFechar}
      titulo="Encerrar oportunidade"
      descricao="Ganhar não cria receita: ela vem do contrato e dos títulos."
      rotuloSalvar={desfecho === 'ganha' ? 'Marcar ganha' : 'Marcar perdida'}
      aoEnviar={(evento) => {
        evento.preventDefault();
        void encerrarOportunidade(oportunidade.id, desfecho === 'ganha' ? { tipo: 'ganha', adesaoPadrao: adesao } : { tipo: 'perdida', motivo: motivo as NonNullable<Oportunidade['motivo_perda']>, texto }).then(
          () => {
            aviso(desfecho === 'ganha' ? 'Oportunidade ganha.' : 'Oportunidade perdida.');
            aoFechar();
          },
          (problema: unknown) => setErro(mensagemDoErro(problema)),
        );
      }}
    >
      <div className="grid gap-[18px]">
        <fieldset>
          <legend className="mb-[7px] texto-rotulo">Desfecho *</legend>
          <div className="flex gap-1.5">
            {(['ganha', 'perdida'] as const).map((opcao) => (
              <button key={opcao} type="button" aria-pressed={desfecho === opcao} onClick={() => setDesfecho(opcao)} className={desfecho === opcao ? 'min-h-11 rounded-pill border border-espresso bg-espresso px-4 text-[13px] font-semibold text-linen' : 'min-h-11 rounded-pill border border-line bg-paper px-4 text-[13px] font-semibold'}>
                {opcao === 'ganha' ? 'Ganha' : 'Perdida'}
              </button>
            ))}
          </div>
        </fieldset>
        {desfecho === 'ganha' ? (
          temAceite ? (
            <Faixa tipo="sucesso">Há proposta com versão aceita.</Faixa>
          ) : (
            <>
              <Faixa tipo="atencao">Ganha exige proposta com versão aceita, ou a adesão padrão, para planos self-service (RN-10.03).</Faixa>
              <label className="flex min-h-11 items-center gap-2 text-[13px] font-semibold">
                <input type="checkbox" checked={adesao} onChange={(evento) => setAdesao(evento.target.checked)} />
                Adesão padrão, sem proposta
              </label>
            </>
          )
        ) : (
          <>
            <Campo id="perda-motivo" rotulo="Motivo" obrigatorio>
              {(controle) => (
                <Selecao {...controle} value={motivo ?? ''} onChange={(evento) => setMotivo(evento.target.value as Oportunidade['motivo_perda'])}>
                  <option value="">Escolha</option>
                  {paraOpcoes(ROTULOS_MOTIVO_PERDA).map((opcao) => (
                    <option key={opcao.valor} value={opcao.valor}>
                      {opcao.rotulo}
                    </option>
                  ))}
                </Selecao>
              )}
            </Campo>
            <Campo id="perda-texto" rotulo="Detalhe" obrigatorio={motivo === 'outro'}>
              {(controle) => <Textarea {...controle} rows={2} value={texto} onChange={(evento) => setTexto(evento.target.value)} />}
            </Campo>
          </>
        )}
        {erro && <MensagemErro>{erro}</MensagemErro>}
      </div>
    </JanelaFormulario>
  );
}

function AbaHistorico({ id }: { id: string }) {
  const consulta = useConsulta(() => historicoDoRegistro('oportunidade', id), [id]);
  return (
    <div className="rounded-lg border border-line bg-paper p-4 md:p-5">
      <ListaHistorico consulta={consulta} comFiltros />
    </div>
  );
}

/** T10.03: ficha da oportunidade, com Viabilidade (T10.04) e Propostas. */
export function FichaOportunidade() {
  const { id } = useParams<{ id: string }>();
  const roteador = useRouter();
  const consulta = useConsulta(() => carregar(id), [id]);
  const [janela, setJanela] = useState<'' | 'editar' | 'viabilidade' | 'acao' | 'encerrar'>('');
  const [reabrindo, setReabrindo] = useState(false);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('encerrar') === '1') setJanela('encerrar');
  }, []);
  const dados = consulta.dados;
  const internas = useMemo(() => pessoasDoSeletor(dados?.dados.pessoas ?? []), [dados]);
  if (consulta.estado === 'carregando') return <EstadoCarregando />;
  if (consulta.estado === 'erro') return <EstadoErro titulo="Não deu para ler a oportunidade." aoTentarDeNovo={consulta.recarregar} />;
  const { oportunidade } = consulta.dados;
  if (!oportunidade) return <EstadoVazio icone={TriangleAlert} titulo="Oportunidade não encontrada." texto="Ela pode ter sido removida." acao={<LinkCentral href="/comercial">Voltar ao funil</LinkCentral>} />;
  const { dados: comercial, contextos, viabilidade, propostas, ligacoes } = consulta.dados;
  const contraparte = comercial.contrapartes.find((item) => item.id === oportunidade.contraparte_id);
  const aberta = estaAbertaNoFunil(oportunidade);
  const temAceite = propostas.some((linha) => linha.proposta.versao_aceita_id);
  const nome = (pessoaId: string) => comercial.pessoas.find((pessoa) => pessoa.id === pessoaId)?.nome_completo ?? 'Pessoa removida';
  const proximaEtapa = ETAPAS_ABERTAS[ETAPAS_ABERTAS.indexOf(oportunidade.etapa) + 1];

  const novaProposta = () => void executar(async () => roteador.push(`/comercial/propostas/${(await criarProposta(oportunidade.id)).id}`), 'Proposta criada em rascunho.');

  return (
    <>
      <LinkCentral href="/comercial" className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-[13px] text-ink-soft hover:text-ink md:min-h-0">
        <ArrowLeft className="size-4" aria-hidden />
        Funil comercial
      </LinkCentral>
      {aberta && !oportunidade.proxima && (
        <Faixa tipo="atencao" className="mb-4" acao={<Button variante="secundario" tamanho="pequeno" onClick={() => setJanela('acao')}>Registrar próxima ação</Button>}>
          Esta oportunidade está sem próxima ação (RN-10.02).
        </Faixa>
      )}
      <Ficha
        tituloDePagina
        codigo={oportunidade.codigo}
        titulo={oportunidade.titulo}
        etiquetas={
          <>
            <EtiquetaSituacao tipo={oportunidade.etapa === 'ganha' ? 'sucesso' : oportunidade.etapa === 'perdida' ? 'erro' : 'info'}>{ROTULOS_ETAPA[oportunidade.etapa]}</EtiquetaSituacao>
            {ligacoes.produtos.map((produtoId) => {
              const contexto = contextos.find((item) => item.id === produtoId);
              return contexto ? <EtiquetaContexto key={produtoId} contexto={contexto} /> : null;
            })}
          </>
        }
        responsavel={`Responsável: ${nome(oportunidade.responsavel_id)}`}
        acoes={
          aberta ? (
            <>
              {proximaEtapa && (
                <Button variante="secundario" onClick={() => void executar(() => avancarEtapa(oportunidade.id, proximaEtapa), `Avançou para ${ROTULOS_ETAPA[proximaEtapa]}.`)}>
                  Avançar para {ROTULOS_ETAPA[proximaEtapa]}
                </Button>
              )}
              <Button variante="secundario" onClick={() => setJanela('acao')}>
                <CalendarPlus aria-hidden />
                Próxima ação
              </Button>
              <Button variante="secundario" onClick={() => setJanela('editar')}>
                <Pencil aria-hidden />
                Editar
              </Button>
              <Button variante="secundario" onClick={() => setJanela('encerrar')}>
                <Flag aria-hidden />
                Ganha ou perdida
              </Button>
              <Button onClick={novaProposta}>
                <FilePlus2 aria-hidden />
                Nova proposta
              </Button>
            </>
          ) : (
            <Button variante="secundario" onClick={() => setReabrindo(true)}>
              <RotateCcw aria-hidden />
              Reabrir
            </Button>
          )
        }
        acoesCelular={aberta ? <><Button variante="secundario" onClick={() => setJanela('acao')}>Próxima ação</Button><Button onClick={novaProposta}>Nova proposta</Button></> : undefined}
        abas={[
          {
            id: 'resumo',
            rotulo: 'Resumo',
            conteudo: (
              <ListaDeDados>
                <Dado rotulo="Contraparte">
                  {contraparte && (
                    <LinkCentral className="underline" href={`/comercial/contrapartes/${contraparte.id}`}>
                      {nomeDaContraparte(contraparte)}
                    </LinkCentral>
                  )}
                </Dado>
                <Dado rotulo="Tipo">{ROTULOS_TIPO_OPORTUNIDADE[oportunidade.tipo]}</Dado>
                <Dado rotulo="Origem">{ROTULOS_ORIGEM[oportunidade.origem]}</Dado>
                <Dado rotulo="Valor estimado">{oportunidade.valor_estimado === null ? null : textoDosValores([{ periodicidade: oportunidade.valor_periodicidade ?? 'unica', valor: oportunidade.valor_estimado }])}</Dado>
                <Dado rotulo="Probabilidade">{oportunidade.probabilidade === null ? null : `${oportunidade.probabilidade}%`}</Dado>
                <Dado rotulo="Fechamento previsto">{oportunidade.fechamento_previsto ? formatarDiaISO(oportunidade.fechamento_previsto) : null}</Dado>
                <Dado rotulo="Próxima ação">{oportunidade.proxima ? `${oportunidade.proxima.titulo} · ${formatarDiaISO(oportunidade.proxima.prazo as string)}` : aberta ? 'Sem próxima ação' : 'Encerrada'}</Dado>
                <Dado rotulo="Participantes">{ligacoes.participantes.length ? ligacoes.participantes.map(nome).join(', ') : null}</Dado>
                <Dado rotulo="Contatos">{ligacoes.contatos.length ? ligacoes.contatos.map(nome).join(', ') : null}</Dado>
                <Dado rotulo="Necessidade">{oportunidade.necessidade}</Dado>
                {oportunidade.motivo_perda && <Dado rotulo="Motivo da perda">{`${ROTULOS_MOTIVO_PERDA[oportunidade.motivo_perda]}${oportunidade.motivo_perda_texto ? `: ${oportunidade.motivo_perda_texto}` : ''}`}</Dado>}
                {oportunidade.adesao_padrao && <Dado rotulo="Ganha por">Adesão padrão</Dado>}
              </ListaDeDados>
            ),
          },
          { id: 'atividades', rotulo: 'Atividades', conteudo: <AbaAtividades consultar={() => atividadesDoRegistro('oportunidade', oportunidade.id)} dependencia={oportunidade.id} vazio="A próxima ação e as demais tarefas vinculadas aparecem aqui." /> },
          {
            id: 'viabilidade',
            rotulo: 'Viabilidade',
            conteudo: viabilidade ? (
              <CartaoDePainel titulo={ROTULOS_CONCLUSAO_VIABILIDADE[viabilidade.conclusao]} acao={aberta ? <Button variante="secundario" tamanho="pequeno" onClick={() => setJanela('viabilidade')}>Editar</Button> : undefined}>
                <ListaDeDados>
                  <Dado rotulo="O que já existe">{viabilidade.existe}</Dado>
                  <Dado rotulo="Entregas">{viabilidade.entregas.map((entrega) => `${entrega.descricao} (${entrega.horas.toLocaleString('pt-BR')} h)`).join('; ')}</Dado>
                  <Dado rotulo="Horas no total">{viabilidade.horas_total.toLocaleString('pt-BR')}</Dado>
                  <Dado rotulo="Prazo estimado">{`${viabilidade.prazo_estimado_dias} dias`}</Dado>
                  <Dado rotulo="Custo estimado">{viabilidade.custo_estimado === null ? null : formatarDinheiro(viabilidade.custo_estimado, 'BRL')}</Dado>
                  <Dado rotulo="Capacidade">{viabilidade.capacidade}</Dado>
                  <Dado rotulo="Riscos">{viabilidade.riscos}</Dado>
                  <Dado rotulo="Referência histórica">{REFERENCIA_HISTORICA}</Dado>
                  <Dado rotulo="Decidido por">{`${viabilidade.decididores.map(nome).join(', ')} em ${formatarDiaISO(viabilidade.decidido_em)}`}</Dado>
                </ListaDeDados>
              </CartaoDePainel>
            ) : (
              <EstadoVazio icone={CircleAlert} titulo="Viabilidade não registrada." texto="Obrigatória quando a proposta tem item sob medida ou recurso planejado. Não bloqueia o envio." acao={aberta ? <Button onClick={() => setJanela('viabilidade')}>Registrar viabilidade</Button> : undefined} />
            ),
          },
          {
            id: 'propostas',
            rotulo: 'Propostas',
            conteudo: propostas.length ? (
              <ul className="grid gap-2">
                {propostas.map(({ proposta, versoes }) => (
                  <li key={proposta.id} className="rounded-md border border-line bg-paper px-3.5 py-2.5 text-[13px]">
                    <LinkCentral href={`/comercial/propostas/${proposta.id}`} className="font-semibold underline">
                      {proposta.codigo}
                    </LinkCentral>
                    <span className="ml-2 text-ink-soft">{versoes.map((versao) => `V${versao.numero}: ${ROTULOS_SITUACAO_VERSAO[versao.situacao]}`).join(' · ')}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EstadoVazio icone={FilePlus2} titulo="Nenhuma proposta ainda." texto="A proposta usa as ofertas aprovadas e o preço vigente do catálogo." acao={aberta ? <Button onClick={novaProposta}>Nova proposta</Button> : undefined} />
            ),
          },
          { id: 'historico', rotulo: 'Histórico', conteudo: <AbaHistorico id={oportunidade.id} /> },
        ]}
      />
      {janela === 'editar' && <FormularioOportunidade dados={comercial} oportunidade={oportunidade} ligacoes={ligacoes} aoFechar={() => setJanela('')} />}
      {janela === 'viabilidade' && <FormularioViabilidade oportunidadeId={oportunidade.id} viabilidade={viabilidade} pessoas={comercial.pessoas} aoFechar={() => setJanela('')} />}
      {janela === 'acao' && <DialogoProximaAcao oportunidade={oportunidade} pessoas={internas} aoFechar={() => setJanela('')} />}
      {janela === 'encerrar' && aberta && <DialogoEncerrar oportunidade={oportunidade} temAceite={temAceite} aoFechar={() => setJanela('')} />}
      <Confirmacao aberto={reabrindo} aoFechar={() => setReabrindo(false)} titulo="Reabrir a oportunidade?" texto="Ela volta para Negociação. O histórico guarda o motivo." rotuloConfirmar="Reabrir" pedirMotivo aoConfirmar={(motivo) => { setReabrindo(false); void executar(() => reabrirOportunidade(oportunidade.id, motivo), 'Oportunidade reaberta.'); }} />
    </>
  );
}
