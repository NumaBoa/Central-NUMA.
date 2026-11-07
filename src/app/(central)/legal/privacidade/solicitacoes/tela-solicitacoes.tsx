'use client';

import { useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { CircleDot, Layers, Plus, UserCheck } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { Campo, MensagemErro } from '@/componentes/campos/campo';
import { EntradaData } from '@/componentes/campos/entrada-data';
import { EntradaLinkDrive } from '@/componentes/campos/link-drive';
import { Selecao } from '@/componentes/campos/selecao';
import { SelecaoPessoa } from '@/componentes/campos/selecao-pessoa';
import { AbasLegal } from '@/componentes/f1/abas-modulos';
import { errosDoFormulario, executar, paraOpcoes, seletorDeOpcoes } from '@/componentes/f1/apoio';
import { aviso } from '@/componentes/padroes/aviso';
import { CabecalhoPagina } from '@/componentes/padroes/cabecalho-pagina';
import { EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { EtiquetaSituacao, type TipoSituacao } from '@/componentes/padroes/etiquetas';
import { Faixa } from '@/componentes/padroes/faixa';
import { FiltrosEmLinha } from '@/componentes/padroes/filtros-em-linha';
import { JanelaFormulario } from '@/componentes/padroes/janela-formulario';
import { Lista, type Coluna } from '@/componentes/padroes/lista';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { Textarea } from '@/componentes/ui/textarea';
import { mensagemDoErro } from '@/dados/erros';
import { repositorios } from '@/dados/repositorios';
import { idDaPessoaAtual } from '@/dados/sessao';
import type { SolicitacaoTitular } from '@/dados/tipos/legal';
import { useConsulta } from '@/dados/use-consulta';
import { encerrarSolicitacao, esquemaFormularioSolicitacao, iniciarAnaliseDaSolicitacao, prazoSugerido, responderSolicitacao, ROTULOS_SITUACAO_SOLICITACAO, ROTULOS_TIPO_SOLICITACAO, salvarSolicitacao, situacaoDoPrazo, type FormularioSolicitacao } from '@/dominio/legal';
import { pessoasDoSeletor } from '@/dominio/pessoa-atual';
import { hojeISO } from '@/lib/datas';
import { formatarDiaISO } from '@/lib/formatacao';

async function carregar() {
  const [solicitacoes, produtos, pessoas, configuracao] = await Promise.all([repositorios.solicitacao_titular.listar(), repositorios.produto.listar({ incluirArquivados: true }), repositorios.pessoa.listar({ incluirArquivados: true }), repositorios.configuracao.ler()]);
  return { solicitacoes: solicitacoes.sort((a, b) => b.recebida_em.localeCompare(a.recebida_em)), produtos, pessoas, prazoDias: configuracao.prazo_resposta_titular_dias };
}
type Dados = Awaited<ReturnType<typeof carregar>>;

const TIPO_PRAZO: Readonly<Record<ReturnType<typeof situacaoDoPrazo>['tipo'], TipoSituacao>> = { pendente: 'atencao', atrasado: 'erro', proximo: 'atencao', normal: 'info', encerrado: 'sucesso' };

function FormularioDaSolicitacao({ solicitacao, dados, aoFechar }: { solicitacao: SolicitacaoTitular | null; dados: Dados; aoFechar: () => void }) {
  const hoje = hojeISO();
  const sugestao = prazoSugerido(hoje, dados.prazoDias);
  const inicial: FormularioSolicitacao = solicitacao
    ? { produto_id: solicitacao.produto_id ?? '', titular_nome: solicitacao.titular_nome, titular_contato: solicitacao.titular_contato, canal: solicitacao.canal ?? '', tipo: solicitacao.tipo, recebida_em: solicitacao.recebida_em, prazo: solicitacao.prazo ?? '', prazo_criterio: solicitacao.prazo_criterio ?? '', responsavel_id: solicitacao.responsavel_id, resposta: solicitacao.resposta ?? '', evidencia_url: solicitacao.evidencia_url ?? '', acoes_tomadas: solicitacao.acoes_tomadas ?? '' }
    : { produto_id: '', titular_nome: '', titular_contato: '', canal: '', tipo: 'acesso', recebida_em: hoje, prazo: sugestao.prazo, prazo_criterio: sugestao.criterio, responsavel_id: idDaPessoaAtual() ?? '', resposta: '', evidencia_url: '', acoes_tomadas: '' };
  const { register, control, handleSubmit, formState, watch } = useForm<FormularioSolicitacao>({ resolver: zodResolver(esquemaFormularioSolicitacao), defaultValues: inicial, mode: 'onTouched' });
  const { errors } = formState;
  const pessoas = useMemo(() => pessoasDoSeletor(dados.pessoas), [dados.pessoas]);
  const prazo = watch('prazo');
  const enviar = handleSubmit(async (formulario) => {
    try {
      await salvarSolicitacao(formulario, solicitacao?.id);
      aviso(solicitacao ? 'Solicitação atualizada.' : 'Solicitação registrada.');
      aoFechar();
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    }
  });
  return (
    <JanelaFormulario colunas={2} aberto aoFechar={aoFechar} titulo={solicitacao ? `Solicitação ${solicitacao.codigo}` : 'Nova solicitação de titular'} alterado={formState.isDirty} aoEnviar={enviar} salvando={formState.isSubmitting} rotuloSalvar={solicitacao ? 'Salvar alterações' : 'Salvar'} erros={errosDoFormulario(errors, { titular_nome: 'sol-nome', titular_contato: 'sol-contato', recebida_em: 'sol-recebida', prazo: 'sol-prazo', prazo_criterio: 'sol-criterio', responsavel_id: 'sol-responsavel', evidencia_url: 'sol-evidencia' })}>
      <div className="grid grid-cols-1 gap-[18px]">
        <Campo id="sol-nome" rotulo="Nome do titular" obrigatorio erro={errors.titular_nome?.message}>
          {(controle) => <Input {...controle} autoComplete="off" {...register('titular_nome')} />}
        </Campo>
        <Campo id="sol-contato" rotulo="Contato do titular" obrigatorio erro={errors.titular_contato?.message}>
          {(controle) => <Input {...controle} autoComplete="off" {...register('titular_contato')} />}
        </Campo>
        <Controller
          control={control}
          name="tipo"
          render={({ field }) => (
            <Campo id="sol-tipo" rotulo="Tipo" obrigatorio>
              {(controle) => (
                <Selecao {...controle} {...field}>
                  {paraOpcoes(ROTULOS_TIPO_SOLICITACAO).map((opcao) => (
                    <option key={opcao.valor} value={opcao.valor}>
                      {opcao.rotulo}
                    </option>
                  ))}
                </Selecao>
              )}
            </Campo>
          )}
        />
        <Controller
          control={control}
          name="produto_id"
          render={({ field }) => (
            <Campo id="sol-produto" rotulo="Produto">
              {(controle) => (
                <Selecao {...controle} {...field}>
                  <option value="">Numa institucional</option>
                  {dados.produtos
                    .filter((produto) => !produto.arquivado_em)
                    .map((produto) => (
                      <option key={produto.id} value={produto.id}>
                        {produto.nome}
                      </option>
                    ))}
                </Selecao>
              )}
            </Campo>
          )}
        />
        <Campo id="sol-canal" rotulo="Canal de recebimento">
          {(controle) => <Input {...controle} autoComplete="off" {...register('canal')} />}
        </Campo>
        <Campo id="sol-recebida" rotulo="Recebida em" obrigatorio erro={errors.recebida_em?.message}>
          {(controle) => <EntradaData {...controle} {...register('recebida_em')} />}
        </Campo>
        <Campo id="sol-prazo" rotulo="Prazo de resposta" erro={errors.prazo?.message} ajuda="Não há prazo universal fixado aqui. Vazio fica pendente até definir a regra aplicável.">
          {(controle) => <EntradaData {...controle} {...register('prazo')} />}
        </Campo>
        {prazo && (
          <Campo id="sol-criterio" rotulo="De onde veio o prazo" obrigatorio erro={errors.prazo_criterio?.message}>
            {(controle) => <Input {...controle} autoComplete="off" {...register('prazo_criterio')} />}
          </Campo>
        )}
        <Controller
          control={control}
          name="responsavel_id"
          render={({ field }) => (
            <Campo id="sol-responsavel" rotulo="Responsável" obrigatorio erro={errors.responsavel_id?.message}>
              {(controle) => <SelecaoPessoa {...controle} {...field} pessoas={pessoas} vazio="Escolha" />}
            </Campo>
          )}
        />
        <Campo id="sol-acoes" rotulo="Ações tomadas" ajuda="Como a exclusão executada em cada ferramenta.">
          {(controle) => <Textarea {...controle} rows={2} {...register('acoes_tomadas')} />}
        </Campo>
      </div>
    </JanelaFormulario>
  );
}

function DialogoResposta({ solicitacao, aoFechar }: { solicitacao: SolicitacaoTitular; aoFechar: () => void }) {
  const [resposta, setResposta] = useState(solicitacao.resposta ?? '');
  const [evidencia, setEvidencia] = useState(solicitacao.evidencia_url ?? '');
  const [data, setData] = useState(hojeISO());
  const [erro, setErro] = useState<string | null>(null);
  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    try {
      await responderSolicitacao(solicitacao.id, { resposta, evidencia_url: evidencia, respondida_em: data });
      aviso('Resposta registrada.');
      aoFechar();
    } catch (problema) {
      setErro(mensagemDoErro(problema));
    }
  }
  return (
    <JanelaFormulario aberto aoFechar={aoFechar} titulo={`Responder ${solicitacao.codigo}`} aoEnviar={(evento) => void enviar(evento)} rotuloSalvar="Registrar resposta" alterado={Boolean(resposta || evidencia)}>
      <div className="grid gap-[18px]">
        <Campo id="res-texto" rotulo="Resposta" obrigatorio>
          {(controle) => <Textarea {...controle} rows={4} value={resposta} onChange={(evento) => setResposta(evento.target.value)} />}
        </Campo>
        <Campo id="res-evidencia" rotulo="Evidência da resposta" obrigatorio ajuda="Link do Drive.">
          {(controle) => <EntradaLinkDrive {...controle} link={evidencia} value={evidencia} onChange={(evento) => setEvidencia(evento.target.value)} />}
        </Campo>
        <Campo id="res-data" rotulo="Respondida em" obrigatorio>
          {(controle) => <EntradaData {...controle} value={data} onChange={(evento) => setData(evento.target.value)} />}
        </Campo>
        {erro && <MensagemErro>{erro}</MensagemErro>}
      </div>
    </JanelaFormulario>
  );
}

type Filtros = { busca: string; situacao: string; tipo: string };
const INICIAIS: Filtros = { busca: '', situacao: '', tipo: '' };

/** T09.04: prazo sem valor universal (decisão vigente 11). Dado de titular é pessoal, e não vai para a busca global. */
export function TelaSolicitacoes() {
  const consulta = useConsulta(carregar);
  const dados = consulta.dados;
  const hoje = hojeISO();
  const [filtros, setFiltros] = useState<Filtros>(INICIAIS);
  const [editando, setEditando] = useState<{ solicitacao: SolicitacaoTitular | null } | null>(null);
  const [respondendo, setRespondendo] = useState<SolicitacaoTitular | null>(null);
  const nomeDaPessoa = (id: string) => dados?.pessoas.find((pessoa) => pessoa.id === id)?.nome_completo ?? 'Pessoa removida';
  const nomeDoProduto = (id: string | null) => (id ? (dados?.produtos.find((produto) => produto.id === id)?.nome ?? 'Produto removido') : 'Numa');

  const linhas = useMemo(() => {
    const termo = filtros.busca.trim().toLowerCase();
    return (dados?.solicitacoes ?? []).filter((linha) => (!filtros.situacao || linha.situacao === filtros.situacao) && (!filtros.tipo || linha.tipo === filtros.tipo) && (!termo || `${linha.codigo} ${linha.titular_nome}`.toLowerCase().includes(termo)));
  }, [dados, filtros]);
  const opcoesSituacao = paraOpcoes(ROTULOS_SITUACAO_SOLICITACAO);
  const opcoesTipo = paraOpcoes(ROTULOS_TIPO_SOLICITACAO);

  const Prazo = ({ linha }: { linha: SolicitacaoTitular }) => {
    const situacao = situacaoDoPrazo(linha, hoje);
    return (
      <span className="flex flex-wrap items-center gap-1.5">
        {linha.prazo && <span className="tabular-nums">{formatarDiaISO(linha.prazo)}</span>}
        <EtiquetaSituacao tipo={TIPO_PRAZO[situacao.tipo]}>{situacao.texto}</EtiquetaSituacao>
      </span>
    );
  };

  const acoes = (linha: SolicitacaoTitular) => (
    <span className="flex flex-wrap justify-end gap-1">
      {linha.situacao === 'recebida' && (
        <Button variante="secundario" tamanho="pequeno" onClick={() => void executar(() => iniciarAnaliseDaSolicitacao(linha.id), 'Em análise.')}>
          Analisar
        </Button>
      )}
      {(linha.situacao === 'recebida' || linha.situacao === 'em_analise') && (
        <Button tamanho="pequeno" onClick={() => setRespondendo(linha)}>
          Responder
        </Button>
      )}
      {linha.situacao === 'respondida' && (
        <Button variante="secundario" tamanho="pequeno" onClick={() => void executar(() => encerrarSolicitacao(linha.id), 'Encerrada.')}>
          Encerrar
        </Button>
      )}
    </span>
  );

  const colunas: readonly Coluna<SolicitacaoTitular>[] = [
    { id: 'codigo', titulo: 'Código', essencial: true, celula: (linha) => <span className="font-medium whitespace-nowrap tabular-nums">{linha.codigo}</span> },
    { id: 'titular', titulo: 'Titular', essencial: true, celula: (linha) => linha.titular_nome },
    { id: 'tipo', titulo: 'Tipo', celula: (linha) => ROTULOS_TIPO_SOLICITACAO[linha.tipo] },
    { id: 'produto', titulo: 'Produto', celula: (linha) => nomeDoProduto(linha.produto_id) },
    { id: 'recebida', titulo: 'Recebida em', ordenar: (a, b) => a.recebida_em.localeCompare(b.recebida_em), celula: (linha) => formatarDiaISO(linha.recebida_em) },
    { id: 'prazo', titulo: 'Prazo', essencial: true, celula: (linha) => <Prazo linha={linha} /> },
    { id: 'responsavel', titulo: 'Responsável', celula: (linha) => nomeDaPessoa(linha.responsavel_id) },
    { id: 'situacao', titulo: 'Situação', celula: (linha) => ROTULOS_SITUACAO_SOLICITACAO[linha.situacao] },
  ];

  return (
    <>
      <CabecalhoPagina
        kicker="Legal e privacidade"
        titulo="Solicitações de titulares"
        resumo="Cada pedido com quem responde, o prazo aplicável e a evidência da resposta."
        acoes={
          <Button disabled={!dados} onClick={() => setEditando({ solicitacao: null })}>
            <Plus aria-hidden />
            Nova solicitação
          </Button>
        }
      />
      <AbasLegal ativa="privacidade" sub="solicitacoes" />
      <div className="mt-5 space-y-4">
        {consulta.estado === 'erro' && <EstadoErro titulo="Não deu para ler as solicitações." aoTentarDeNovo={consulta.recarregar} />}
        {dados && dados.prazoDias === null && <Faixa>O prazo padrão de resposta não está definido em Configurações. Cada solicitação fica com o prazo pendente até alguém informar a regra aplicável.</Faixa>}
        <FiltrosEmLinha
          filtros={filtros}
          aoMudar={(parcial) => setFiltros((atuais) => ({ ...atuais, ...parcial }))}
          aoLimpar={() => setFiltros(INICIAIS)}
          rotuloBusca="Buscar solicitações"
          seletores={[seletorDeOpcoes<Filtros>({ id: 'situacao', rotulo: 'Situação', icone: CircleDot, campo: 'situacao', opcoes: opcoesSituacao, todos: 'Todas' }), seletorDeOpcoes<Filtros>({ id: 'tipo', rotulo: 'Tipo', icone: Layers, campo: 'tipo', opcoes: opcoesTipo })]}
          avancados={() => null}
          quantosAvancados={() => 0}
          ativos={[...(filtros.situacao ? [{ id: 'situacao', rotulo: `Situação: ${opcoesSituacao.find((opcao) => opcao.valor === filtros.situacao)?.rotulo ?? ''}` }] : []), ...(filtros.tipo ? [{ id: 'tipo', rotulo: `Tipo: ${opcoesTipo.find((opcao) => opcao.valor === filtros.tipo)?.rotulo ?? ''}` }] : [])]}
          aoRemoverAtivo={(id) => setFiltros((atuais) => ({ ...atuais, [id]: '' }))}
        />
        <Lista
          rotulo="Solicitações de titulares"
          linhas={linhas}
          colunas={colunas}
          chave={(linha) => linha.id}
          estado={consulta.estado === 'carregando' ? 'carregando' : 'pronto'}
          filtrando={Boolean(filtros.busca.trim() || filtros.situacao || filtros.tipo)}
          aoLimparFiltros={() => setFiltros(INICIAIS)}
          aoAbrir={(linha) => setEditando({ solicitacao: linha })}
          acoesDaLinha={acoes}
          cartaoInterativo
          cartao={(linha) => (
            <span className="grid gap-1.5">
              <button type="button" className="min-h-11 text-left font-semibold" onClick={() => setEditando({ solicitacao: linha })}>
                {linha.codigo} · {linha.titular_nome}
              </button>
              <span className="text-[13px] text-ink-soft">{ROTULOS_TIPO_SOLICITACAO[linha.tipo]}</span>
              <Prazo linha={linha} />
              {acoes(linha)}
            </span>
          )}
          vazio={<EstadoVazio icone={UserCheck} titulo="Nenhuma solicitação registrada." texto="Quando um titular fizer um pedido, registre aqui para acompanhar prazo, resposta e evidência." acao={<Button onClick={() => setEditando({ solicitacao: null })}>Nova solicitação</Button>} />}
        />
      </div>
      {editando && dados && <FormularioDaSolicitacao solicitacao={editando.solicitacao} dados={dados} aoFechar={() => setEditando(null)} />}
      {respondendo && <DialogoResposta solicitacao={respondendo} aoFechar={() => setRespondendo(null)} />}
    </>
  );
}
