'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useParams } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Check, Copy, Ellipsis, ExternalLink, Pencil, Receipt, Undo2 } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { AbaAtividades } from '@/componentes/atividades/aba-atividades';
import { Campo, MensagemErro } from '@/componentes/campos/campo';
import { SeletorContraparte } from '@/componentes/campos/seletor-contraparte';
import { Selecao } from '@/componentes/campos/selecao';
import { DialogoDeBaixa } from '@/componentes/financeiro/dialogo-baixa';
import { FormularioDeDespesa } from '@/componentes/financeiro/formulario-despesa';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { aviso } from '@/componentes/padroes/aviso';
import { Confirmacao } from '@/componentes/padroes/confirmacao';
import { Dado, ListaDeDados } from '@/componentes/padroes/dado';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { EtiquetaContexto, EtiquetaLivre } from '@/componentes/padroes/etiquetas';
import { Ficha } from '@/componentes/padroes/ficha';
import { ListaHistorico } from '@/componentes/padroes/historico';
import { CLASSE_LINHA_MENU, MenuSobreposto } from '@/componentes/padroes/menu-sobreposto';
import { PainelFormulario } from '@/componentes/padroes/painel-formulario';
import { Pessoa as NomeDaPessoa } from '@/componentes/padroes/pessoa';
import { Button } from '@/componentes/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/componentes/ui/dialog';
import { Input } from '@/componentes/ui/input';
import { Textarea } from '@/componentes/ui/textarea';
import { mensagemDoErro } from '@/dados/erros';
import type { Baixa } from '@/dados/tipos/titulo';
import { useConsulta } from '@/dados/use-consulta';
import { atividadesDoRegistro } from '@/dominio/atividades-painel';
import { alterarTratamento, cancelarTitulo, carregarFichaDoTitulo, confirmarTitulo, edicaoPedeMotivo, editarRateioDoTitulo, esquemaFormularioTitulo, formularioDoTitulo, salvarTitulo, type FichaDoTitulo, type FormularioTitulo } from '@/dominio/baixas';
import { nomeDaContraparte } from '@/dominio/contrapartes';
import { valorParaCampo } from '@/dominio/dinheiro';
import { historicoDoTitulo } from '@/dominio/historico';
import type { LinhaDoTitulo } from '@/dominio/lancamentos';
import { pessoasDoSeletor } from '@/dominio/pessoa-atual';
import { erroDoRateioDoTitulo, formularioParaDuplicar, ROTULOS_NATUREZA_TITULO, ROTULOS_ORIGEM_TITULO, ROTULOS_TIPO_BAIXA, ROTULOS_TRATAMENTO, rotuloDaCompetencia } from '@/dominio/titulos';
import { hojeISO } from '@/lib/datas';
import { formatarDiaISO, formatarDinheiro } from '@/lib/formatacao';
import { contextosDoTitulo, nomeDoFavorecido, SituacaoDoTitulo } from '../tela-lancamentos';

const CAMINHO = '/financeiro';

function AbaDados({ ficha }: { ficha: FichaDoTitulo }) {
  const { titulo, dados, origem } = ficha;
  const categoria = dados.categorias.find((item) => item.id === titulo.categoria_id)?.nome;
  const ferramenta = dados.ferramentas.find((item) => item.id === titulo.ferramenta_id);
  const favorecido = nomeDoFavorecido(titulo, dados);
  return (
    <ListaDeDados>
      <Dado rotulo="Natureza">{ROTULOS_NATUREZA_TITULO[titulo.natureza]}</Dado>
      <Dado rotulo="Favorecido">{favorecido || null}</Dado>
      <Dado rotulo="Categoria">{categoria}</Dado>
      <Dado rotulo="Competência">{rotuloDaCompetencia(titulo.competencia)}</Dado>
      <Dado rotulo="Vencimento">{formatarDiaISO(titulo.vencimento)}</Dado>
      <Dado rotulo="Valor">{formatarDinheiro(titulo.valor, titulo.moeda)}</Dado>
      <Dado rotulo="Saldo">{formatarDinheiro(titulo.saldo, titulo.moeda)}</Dado>
      <Dado rotulo="Origem">
        <span className="flex flex-wrap items-center gap-x-2">
          {ROTULOS_ORIGEM_TITULO[titulo.origem]}
          {titulo.ajustado_manualmente && <EtiquetaLivre>Ajustado manualmente</EtiquetaLivre>}
        </span>
      </Dado>
      <Dado rotulo="Ferramenta">
        {ferramenta && (
          <LinkCentral href={`/ferramentas/${ferramenta.id}`} className="inline-flex min-h-11 items-center underline md:min-h-0">
            {ferramenta.nome}
          </LinkCentral>
        )}
      </Dado>
      {origem && (
        <Dado rotulo="Despesa de origem">
          <LinkCentral href={`${CAMINHO}/${origem.id}`} className="inline-flex min-h-11 items-center underline md:min-h-0">
            {origem.codigo} · {origem.descricao}
          </LinkCentral>
        </Dado>
      )}
      {titulo.situacao === 'cancelado' && <Dado rotulo="Motivo do cancelamento">{titulo.cancelado_motivo}</Dado>}
      <Dado rotulo="Observação">{titulo.observacao}</Dado>
    </ListaDeDados>
  );
}

function AbaRateio({ titulo, ficha, somenteLeitura }: { titulo: LinhaDoTitulo; ficha: FichaDoTitulo; somenteLeitura: boolean }) {
  const inicial = () => Object.fromEntries(titulo.rateio.map((linha) => [linha.id, valorParaCampo(linha.percentual)]));
  const assinaturaDoRateio = titulo.rateio.map((linha) => `${linha.id}:${linha.percentual}`).join('|');
  const [valores, setValores] = useState<Record<string, string>>(inicial);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => setValores(inicial()), [assinaturaDoRateio]); // eslint-disable-line react-hooks/exhaustive-deps -- `inicial` lê o rateio atual
  const contextos = contextosDoTitulo(titulo, ficha.dados);
  const linhas = titulo.rateio.map((linha) => ({ ligacaoId: linha.id, percentual: valores[linha.id] ?? '' }));

  async function salvar() {
    const falha = erroDoRateioDoTitulo(linhas);
    setErro(falha);
    if (falha) return;
    try {
      await editarRateioDoTitulo(titulo.id, linhas);
      aviso('Rateio salvo.');
    } catch (problema) {
      setErro(mensagemDoErro(problema));
    }
  }

  return (
    <div className="grid gap-4">
      <p className="text-[13px] text-ink-soft">Rateio não é saída adicional de caixa: é como o custo se divide entre os contextos.</p>
      <ul className="grid gap-2">
        {titulo.rateio.map((linha, indice) => {
          const contexto = contextos[indice];
          return (
            <li key={linha.id} className="flex items-center justify-between gap-3 rounded-md border border-line bg-paper px-3.5 py-2">
              {contexto ? <EtiquetaContexto contexto={contexto} /> : <span>Contexto removido</span>}
              <span className="flex items-center gap-1.5">
                <Input aria-label={`Percentual de ${contexto?.nome ?? 'contexto'}`} inputMode="decimal" autoComplete="off" disabled={somenteLeitura || titulo.rateio.length === 1} className="w-24 text-right" value={valores[linha.id] ?? ''} onChange={(evento) => setValores((atuais) => ({ ...atuais, [linha.id]: evento.target.value }))} />
                <span className="text-[13px] text-ink-soft">%</span>
                <span className="w-24 text-right text-[13px] tabular-nums">{formatarDinheiro(linha.valor, titulo.moeda)}</span>
              </span>
            </li>
          );
        })}
      </ul>
      {!somenteLeitura && titulo.rateio.length > 1 && (
        <Button variante="secundario" className="justify-self-start" onClick={() => void salvar()}>
          Salvar rateio
        </Button>
      )}
      {erro && <MensagemErro>{erro}</MensagemErro>}
    </div>
  );
}

/** RN-05.06: desfaz o aporte ou o reembolso, e refaz o outro. */
function DialogoDeTratamento({ baixa, aoFechar }: { baixa: Baixa; aoFechar: () => void }) {
  const novo = baixa.tratamento === 'aporte' ? 'reembolso' : 'aporte';
  const [vencimento, setVencimento] = useState('');
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  async function confirmar() {
    if (novo === 'reembolso' && !vencimento) return setErro('Informe quando a Numa vai reembolsar.');
    try {
      await alterarTratamento(baixa.id, novo, vencimento || null, motivo);
      aviso('Tratamento alterado.');
      aoFechar();
    } catch (falha) {
      setErro(mensagemDoErro(falha));
    }
  }

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && aoFechar()}>
      <DialogContent semFechar comDescricao>
        <DialogTitle>Tratar como {ROTULOS_TRATAMENTO[novo].toLowerCase()}?</DialogTitle>
        <DialogDescription className="mt-3 leading-[1.6]">{novo === 'reembolso' ? 'O aporte é desfeito, e nasce um título a pagar para a sócia.' : 'O título de reembolso é cancelado, e nasce um aporte da sócia.'}</DialogDescription>
        <div className="mt-4 grid gap-4">
          {novo === 'reembolso' && (
            <Campo id="tratamento-vencimento" rotulo="Vencimento do reembolso" obrigatorio>
              {(controle) => <Input type="date" {...controle} value={vencimento} onChange={(evento) => setVencimento(evento.target.value)} />}
            </Campo>
          )}
          <Campo id="tratamento-motivo" rotulo="Motivo" obrigatorio erro={erro ?? undefined}>
            {(controle) => <Input autoComplete="off" {...controle} value={motivo} onChange={(evento) => setMotivo(evento.target.value)} />}
          </Campo>
        </div>
        <div className="acoes-dialogo">
          <Button variante="secundario" onClick={aoFechar}>
            Voltar
          </Button>
          <Button onClick={() => void confirmar()}>Alterar tratamento</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AbaBaixas({ ficha, somenteLeitura, aoRegistrar }: { ficha: FichaDoTitulo; somenteLeitura: boolean; aoRegistrar: () => void }) {
  const { titulo, dados } = ficha;
  const [tratando, setTratando] = useState<Baixa | null>(null);
  const contaDe = (id: string) => dados.contas.find((conta) => conta.id === id)?.nome ?? 'Conta removida';
  const pessoaDe = (id: string | null) => dados.pessoas.find((pessoa) => pessoa.id === id)?.nome_completo;
  const estornadas = new Set(titulo.baixas.filter((baixa) => baixa.tipo === 'estorno').map((baixa) => baixa.baixa_original_id));
  const baixas = [...titulo.baixas].sort((a, b) => b.data.localeCompare(a.data) || b.criado_em.localeCompare(a.criado_em));
  if (!baixas.length) {
    return (
      <EstadoVazio
        icone={Receipt}
        titulo="Nenhuma baixa ainda."
        texto="Quando este título for pago, o pagamento aparece aqui."
        acao={somenteLeitura ? undefined : <Button onClick={aoRegistrar}>Registrar baixa</Button>}
      />
    );
  }
  return (
    <>
      <ul className="grid gap-2">
        {baixas.map((baixa) => (
          <li key={baixa.id} className="grid gap-1 rounded-md border border-line bg-paper p-3.5 text-[13px]">
            <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <span className="font-semibold">
                {ROTULOS_TIPO_BAIXA[baixa.tipo]} · {formatarDiaISO(baixa.data)}
                {estornadas.has(baixa.id) && <span className="ml-1.5 font-normal text-ink-soft">(estornado)</span>}
              </span>
              <span className="font-semibold tabular-nums">{formatarDinheiro(baixa.valor_moeda, titulo.moeda)}</span>
            </span>
            <span className="text-ink-soft">
              {contaDe(baixa.conta_financeira_id)}
              {baixa.cambio !== null ? ` · câmbio ${String(baixa.cambio).replace('.', ',')}` : ''}
              {baixa.iof_brl !== null ? ` · IOF ${formatarDinheiro(baixa.iof_brl, 'BRL')}` : ''}
              {titulo.moeda !== 'BRL' ? ` · ${formatarDinheiro(baixa.valor_brl, 'BRL')}` : ''}
              {pessoaDe(baixa.registrado_por) ? ` · por ${pessoaDe(baixa.registrado_por)}` : ''}
            </span>
            {baixa.motivo && <span>Motivo: {baixa.motivo}</span>}
            {baixa.comprovante_url ? (
              <a href={baixa.comprovante_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 justify-self-start underline md:min-h-0 [&_svg]:size-[14px]">
                <ExternalLink aria-hidden />
                Abrir o comprovante
              </a>
            ) : (
              baixa.tipo !== 'estorno' && <span className="text-ink-soft">Sem comprovante: {baixa.sem_comprovante_motivo}</span>
            )}
            {baixa.tratamento && (
              <span className="flex flex-wrap items-center gap-2">
                <EtiquetaLivre>{ROTULOS_TRATAMENTO[baixa.tratamento]}</EtiquetaLivre>
                {baixa.titulo_reembolso_id && (
                  <LinkCentral href={`${CAMINHO}/${baixa.titulo_reembolso_id}`} className="inline-flex min-h-11 items-center underline md:min-h-0">
                    Abrir o reembolso
                  </LinkCentral>
                )}
                {!somenteLeitura && !estornadas.has(baixa.id) && (
                  <Button variante="terciario" tamanho="pequeno" onClick={() => setTratando(baixa)}>
                    Tratar como {baixa.tratamento === 'aporte' ? 'reembolso' : 'aporte'}
                  </Button>
                )}
              </span>
            )}
          </li>
        ))}
      </ul>
      {tratando && <DialogoDeTratamento baixa={tratando} aoFechar={() => setTratando(null)} />}
    </>
  );
}

function AbaVinculos({ ficha }: { ficha: FichaDoTitulo }) {
  const { reembolsos, movimentos, origem, dados } = ficha;
  const nomeDaPessoa = (id: string) => dados.pessoas.find((pessoa) => pessoa.id === id)?.nome_completo ?? 'Pessoa removida';
  if (!reembolsos.length && !movimentos.length && !origem) return <p className="text-sm text-ink-soft">Nada ligado a este título por enquanto.</p>;
  return (
    <ul className="grid gap-2 text-[13px]">
      {origem && (
        <li className="rounded-md border border-line bg-paper px-3.5 py-2.5">
          Despesa de origem:{' '}
          <LinkCentral href={`${CAMINHO}/${origem.id}`} className="inline-flex min-h-11 items-center underline md:min-h-0">
            {origem.codigo} · {origem.descricao}
          </LinkCentral>
        </li>
      )}
      {reembolsos.map((reembolso) => (
        <li key={reembolso.id} className="rounded-md border border-line bg-paper px-3.5 py-2.5">
          Reembolso:{' '}
          <LinkCentral href={`${CAMINHO}/${reembolso.id}`} className="inline-flex min-h-11 items-center underline md:min-h-0">
            {reembolso.codigo} · {formatarDinheiro(reembolso.valor, reembolso.moeda)}
          </LinkCentral>
        </li>
      ))}
      {movimentos.map((movimento) => (
        <li key={movimento.id} className="rounded-md border border-line bg-paper px-3.5 py-2.5">
          Aporte de {nomeDaPessoa(movimento.socia_id)}: {movimento.codigo} · {formatarDinheiro(movimento.valor_brl, 'BRL')}
          {movimento.arquivado_em ? ' (desfeito)' : ''}
        </li>
      ))}
    </ul>
  );
}

function AbaHistorico({ id }: { id: string }) {
  const consulta = useConsulta(() => historicoDoTitulo(id), [id]);
  return (
    <div className="rounded-lg border border-line bg-paper p-4 md:p-5">
      <ListaHistorico consulta={consulta} comFiltros />
    </div>
  );
}

function FormularioDoTitulo({ ficha, aberto, aoFechar }: { ficha: FichaDoTitulo; aberto: boolean; aoFechar: () => void }) {
  const { titulo, dados } = ficha;
  const { register, handleSubmit, control, reset, watch, formState } = useForm<FormularioTitulo>({ resolver: zodResolver(esquemaFormularioTitulo), defaultValues: formularioDoTitulo(titulo), mode: 'onTouched' });
  const { errors, isDirty, isSubmitting } = formState;
  const [erroDoMotivo, setErroDoMotivo] = useState<string | null>(null);
  useEffect(() => {
    if (aberto) reset(formularioDoTitulo(titulo));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- vale o que está salvo ao abrir
  }, [aberto, reset]);
  const valores = watch();
  const pedeMotivo = edicaoPedeMotivo(titulo, valores);
  const categorias = dados.categorias.filter((categoria) => categoria.pai_id && categoria.tipo === titulo.natureza.replace('pagar', 'despesa').replace('receber', 'receita') && !categoria.arquivado_em && (categoria.situacao === 'ativa' || categoria.id === titulo.categoria_id));
  const internas = pessoasDoSeletor(dados.pessoas);
  const opcoesDePessoa = (id: string) => (internas.some((item) => item.id === id) ? internas : [...internas, ...dados.pessoas.filter((item) => item.id === id)]);

  const enviar = handleSubmit(async (formulario) => {
    if (pedeMotivo && !formulario.motivo) {
      setErroDoMotivo('Diga por que este título gerado mudou.');
      return;
    }
    setErroDoMotivo(null);
    try {
      await salvarTitulo(titulo.id, formulario);
      aviso('Lançamento atualizado.');
      aoFechar();
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    }
  });

  return (
    <PainelFormulario aberto={aberto} aoFechar={aoFechar} titulo="Editar lançamento" alterado={isDirty} aoEnviar={enviar} salvando={isSubmitting}>
      <div className="grid gap-[18px]">
        <Campo id="titulo-descricao" rotulo="Descrição" obrigatorio erro={errors.descricao?.message}>
          {(controle) => <Input autoComplete="off" {...controle} {...register('descricao')} />}
        </Campo>
        {titulo.origem !== 'reembolso' && (
          <Controller control={control} name="contraparte_id" render={({ field }) => <Campo id="titulo-contraparte" rotulo="Fornecedor">{(controle) => <SeletorContraparte {...controle} valor={field.value} aoMudar={field.onChange} contrapartes={dados.contrapartes} papel="fornecedor" />}</Campo>} />
        )}
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
          <Campo id="titulo-valor" rotulo={`Valor em ${titulo.moeda}`} obrigatorio erro={errors.valor?.message}>
            {(controle) => <Input inputMode="decimal" autoComplete="off" {...controle} {...register('valor')} />}
          </Campo>
          <Campo id="titulo-vencimento" rotulo="Vencimento" obrigatorio erro={errors.vencimento?.message}>
            {(controle) => <Input type="date" {...controle} {...register('vencimento')} />}
          </Campo>
        </div>
        <Campo id="titulo-competencia" rotulo="Competência" obrigatorio erro={errors.competencia?.message}>
          {(controle) => <Input type="month" {...controle} {...register('competencia')} />}
        </Campo>
        <Controller
          control={control}
          name="categoria_id"
          render={({ field }) => (
            <Campo id="titulo-categoria" rotulo="Categoria" obrigatorio erro={errors.categoria_id?.message}>
              {(controle) => (
                <Selecao {...controle} {...field}>
                  {categorias.map((categoria) => (
                    <option key={categoria.id} value={categoria.id}>
                      {categoria.nome}
                    </option>
                  ))}
                </Selecao>
              )}
            </Campo>
          )}
        />
        <Controller
          control={control}
          name="responsavel_id"
          render={({ field }) => (
            <Campo id="titulo-responsavel" rotulo="Responsável" obrigatorio erro={errors.responsavel_id?.message}>
              {(controle) => (
                <Selecao {...controle} {...field}>
                  {opcoesDePessoa(field.value).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nome_completo}
                    </option>
                  ))}
                </Selecao>
              )}
            </Campo>
          )}
        />
        <Campo id="titulo-observacao" rotulo="Observação">
          {(controle) => <Textarea {...controle} {...register('observacao')} />}
        </Campo>
        {pedeMotivo && (
          <Campo id="titulo-motivo" rotulo="Motivo da mudança" obrigatorio erro={erroDoMotivo ?? undefined} ajuda="Este título foi gerado: ele fica como “ajustado manualmente”, e a geração não passa por cima.">
            {(controle) => <Input autoComplete="off" {...controle} {...register('motivo')} />}
          </Campo>
        )}
      </div>
    </PainelFormulario>
  );
}

/** T05.03: ficha do título (P2). */
export function FichaTitulo() {
  const { id } = useParams<{ id: string }>();
  const hoje = hojeISO();
  const consulta = useConsulta(() => carregarFichaDoTitulo(id, hoje), [id, hoje]);
  const [baixando, setBaixando] = useState<'pagamento' | 'estorno' | null>(null);
  const [editando, setEditando] = useState(false);
  const [duplicando, setDuplicando] = useState(false);
  const [cancelando, setCancelando] = useState(false);

  const voltar = (
    <LinkCentral href={CAMINHO} className="mb-5 inline-flex min-h-11 items-center gap-1.5 rounded-pill pr-3 text-[13px] font-medium text-ink-soft hover:text-ink md:min-h-0 [&_svg]:size-4">
      <ArrowLeft aria-hidden />
      Lançamentos
    </LinkCentral>
  );

  if (consulta.estado === 'carregando') return <EstadoCarregando />;
  if (consulta.estado === 'erro') {
    return (
      <>
        {voltar}
        <EstadoErro titulo="Não deu para ler este lançamento." texto="Os dados deste navegador podem estar danificados. Importe um backup ou restaure os exemplos em Configurações › Dados." aoTentarDeNovo={consulta.recarregar} />
      </>
    );
  }
  const ficha = consulta.dados;
  if (!ficha) {
    return (
      <>
        {voltar}
        <EstadoVazio icone={Receipt} titulo="Esse lançamento não existe mais." texto="Ele pode ter sido removido ao limpar os exemplos ou ao importar um arquivo." />
      </>
    );
  }

  const { titulo, dados } = ficha;
  const encerrado = titulo.situacao === 'cancelado' || titulo.situacao === 'quitado';
  const responsavel = dados.pessoas.find((pessoa) => pessoa.id === titulo.responsavel_id)?.nome_completo ?? 'Pessoa removida';
  const temPagamentoAtivo = titulo.baixas.some((baixa) => baixa.tipo === 'pagamento' && !titulo.baixas.some((outra) => outra.tipo === 'estorno' && outra.baixa_original_id === baixa.id));

  async function executar(acao: () => Promise<void>, mensagem: string) {
    try {
      await acao();
      aviso(mensagem);
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    }
  }

  const linhaDoMenu = (fechar: () => void, rotulo: string, icone: ReactNode, aoClicar: () => void) => (
    <li>
      <button
        type="button"
        className={`${CLASSE_LINHA_MENU} hover:bg-hover md:min-h-9 md:py-1.5`}
        onClick={() => {
          fechar();
          aoClicar();
        }}
      >
        {icone}
        {rotulo}
      </button>
    </li>
  );

  const acoes = (
    <>
      {titulo.situacao !== 'cancelado' && titulo.saldo > 0 && (
        <Button onClick={() => setBaixando('pagamento')}>
          <Receipt aria-hidden />
          Registrar baixa
        </Button>
      )}
      {!encerrado && (
        <Button variante="secundario" onClick={() => setEditando(true)}>
          <Pencil aria-hidden />
          Editar
        </Button>
      )}
      <MenuSobreposto
        titulo="Mais ações"
        largura={240}
        alinhar="end"
        gatilho={
          <Button variante="icone" tamanho="icone" aria-label="Mais ações do lançamento">
            <Ellipsis aria-hidden />
          </Button>
        }
      >
        {(fechar) => (
          <ul className="grid gap-0.5">
            {titulo.situacao === 'previsto' && linhaDoMenu(fechar, 'Confirmar', <Check aria-hidden />, () => void executar(() => confirmarTitulo(titulo.id), 'Lançamento confirmado.'))}
            {titulo.origem !== 'reembolso' && titulo.origem !== 'ajuste' && linhaDoMenu(fechar, 'Duplicar', <Copy aria-hidden />, () => setDuplicando(true))}
            {temPagamentoAtivo && linhaDoMenu(fechar, 'Estornar baixa', <Undo2 aria-hidden />, () => setBaixando('estorno'))}
            {titulo.situacao !== 'cancelado' && linhaDoMenu(fechar, 'Cancelar', <span aria-hidden className="size-4" />, () => setCancelando(true))}
          </ul>
        )}
      </MenuSobreposto>
    </>
  );

  return (
    <>
      {voltar}
      <Ficha
        tituloDePagina
        codigo={titulo.codigo}
        titulo={titulo.descricao}
        etiquetas={
          <>
            <SituacaoDoTitulo titulo={titulo} />
            <EtiquetaLivre>{ROTULOS_NATUREZA_TITULO[titulo.natureza]}</EtiquetaLivre>
            {contextosDoTitulo(titulo, dados).map((item) => (
              <EtiquetaContexto key={item.id} contexto={item} />
            ))}
          </>
        }
        responsavel={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="tabular-nums">
              Vence em {formatarDiaISO(titulo.vencimento)} · {formatarDinheiro(titulo.valor, titulo.moeda)} · Saldo <strong className="text-ink">{formatarDinheiro(titulo.saldo, titulo.moeda)}</strong>
            </span>
            <span className="inline-flex items-center gap-2">
              Responsável: <NomeDaPessoa nome={responsavel} className="text-ink" />
            </span>
          </span>
        }
        acoes={acoes}
        acoesCelular={acoes}
        abas={[
          { id: 'dados', rotulo: 'Dados', conteudo: <AbaDados ficha={ficha} /> },
          { id: 'rateio', rotulo: 'Rateio', conteudo: <AbaRateio titulo={titulo} ficha={ficha} somenteLeitura={titulo.situacao === 'cancelado'} /> },
          { id: 'baixas', rotulo: 'Baixas', conteudo: <AbaBaixas ficha={ficha} somenteLeitura={titulo.situacao === 'cancelado'} aoRegistrar={() => setBaixando('pagamento')} /> },
          { id: 'vinculos', rotulo: 'Vínculos', conteudo: <AbaVinculos ficha={ficha} /> },
          { id: 'atividades', rotulo: 'Atividades', conteudo: <AbaAtividades consultar={() => atividadesDoRegistro('titulo', titulo.id)} dependencia={titulo.id} vazio="Vincule uma atividade a este lançamento, pelo painel da atividade." /> },
          { id: 'historico', rotulo: 'Histórico', conteudo: <AbaHistorico id={titulo.id} /> },
        ]}
      />
      {baixando && <DialogoDeBaixa titulo={titulo} contas={dados.contas} tipoInicial={baixando} aoFechar={() => setBaixando(null)} />}
      <FormularioDoTitulo ficha={ficha} aberto={editando} aoFechar={() => setEditando(false)} />
      <FormularioDeDespesa aberto={duplicando} aoFechar={() => setDuplicando(false)} dados={dados} valoresIniciais={formularioParaDuplicar(titulo, hoje)} />
      <Confirmacao
        aberto={cancelando}
        aoFechar={() => setCancelando(false)}
        titulo={`Cancelar ${titulo.codigo}?`}
        texto="O título sai do que está em aberto, e fica no histórico. Com pagamentos, é preciso estornar antes."
        pedirMotivo
        mensagemSemMotivo="Diga por que está cancelando."
        rotuloConfirmar="Cancelar lançamento"
        perigo
        aoConfirmar={(motivo) => {
          setCancelando(false);
          void executar(() => cancelarTitulo(titulo.id, motivo), 'Lançamento cancelado.');
        }}
      />
    </>
  );
}
