'use client';

import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { Coins, Goal, Plus } from 'lucide-react';
import { AbaAtividades } from '@/componentes/atividades/aba-atividades';
import { Campo } from '@/componentes/campos/campo';
import { EntradaData } from '@/componentes/campos/entrada-data';
import { Selecao } from '@/componentes/campos/selecao';
import { useCentral } from '@/componentes/layout/central-provider';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { aviso } from '@/componentes/padroes/aviso';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { EtiquetaSituacao, type TipoSituacao } from '@/componentes/padroes/etiquetas';
import { Faixa } from '@/componentes/padroes/faixa';
import { ListaHistorico } from '@/componentes/padroes/historico';
import { JanelaFormulario, type ErroDeCampo } from '@/componentes/padroes/janela-formulario';
import { CartaoDaFicha, Indisponivel } from '@/componentes/produtos/aparencia';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { mensagemDoErro } from '@/dados/erros';
import type { Marca } from '@/dados/tipos/marca';
import type { Objetivo } from '@/dados/tipos/precificacao';
import { useConsulta } from '@/dados/use-consulta';
import { atividadesDoRegistro } from '@/dominio/atividades-painel';
import { ativosDoProduto } from '@/dominio/ativos';
import { custoMedioDoProduto, custosPorMesDoProduto } from '@/dominio/custos-produto';
import { carregarFerramentas } from '@/dominio/ferramentas';
import { historicoDoProduto } from '@/dominio/historico';
import { esquemaFormularioObjetivo, objetivosDoProduto, ROTULOS_SITUACAO_OBJETIVO, salvarObjetivo, textoDoCusto, type FormularioObjetivo } from '@/dominio/portfolio';
import { textoDoTitular } from '@/dominio/titularidade';
import { rotuloDaCompetencia } from '@/dominio/titulos';
import { formatarDiaISO, formatarDinheiro } from '@/lib/formatacao';

const TIPOS_DO_OBJETIVO: Readonly<Record<Objetivo['situacao'], TipoSituacao>> = { aberto: 'info', atingido: 'sucesso', nao_atingido: 'atencao', cancelado: 'neutro' };
const dinheiro = (valor: number) => formatarDinheiro(valor, 'BRL');

function FormularioDoObjetivo({ aberto, aoFechar, produtoId, objetivo, pessoas }: { aberto: boolean; aoFechar: () => void; produtoId: string; objetivo: Objetivo | null; pessoas: readonly { id: string; nome: string }[] }) {
  const { pessoa } = useCentral();
  const vazio = (): FormularioObjetivo => ({ titulo: '', metrica: '', meta: '', prazo: '', situacao: 'aberto', responsavel_id: pessoa.id });
  const { register, control, handleSubmit, reset, formState } = useForm<FormularioObjetivo>({ resolver: zodResolver(esquemaFormularioObjetivo), defaultValues: vazio(), mode: 'onTouched' });
  const { errors, isDirty, isSubmitting } = formState;

  useEffect(() => {
    if (aberto) reset(objetivo ? { titulo: objetivo.titulo, metrica: objetivo.metrica ?? '', meta: objetivo.meta ?? '', prazo: objetivo.prazo ?? '', situacao: objetivo.situacao, responsavel_id: objetivo.responsavel_id } : vazio());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- começa do que está salvo a cada vez que abre
  }, [aberto, objetivo?.id]);

  const erros: ErroDeCampo[] = [...(errors.titulo?.message ? [{ campoId: 'objetivo-titulo', mensagem: errors.titulo.message }] : []), ...(errors.responsavel_id?.message ? [{ campoId: 'objetivo-responsavel', mensagem: errors.responsavel_id.message }] : [])];
  const enviar = handleSubmit(async (dados) => {
    try {
      await salvarObjetivo(produtoId, dados, objetivo?.id);
      aviso(objetivo ? 'Objetivo atualizado.' : 'Objetivo criado.');
      aoFechar();
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    }
  });

  return (
    <JanelaFormulario aberto={aberto} aoFechar={aoFechar} titulo={objetivo ? 'Editar objetivo' : 'Novo objetivo'} alterado={isDirty} aoEnviar={(evento) => void enviar(evento)} salvando={isSubmitting} erros={erros}>
      <div className="grid gap-[18px]">
        <Campo id="objetivo-titulo" rotulo="Título" obrigatorio erro={errors.titulo?.message}>
          {(controle) => <Input autoComplete="off" {...controle} {...register('titulo')} />}
        </Campo>
        <Campo rotulo="Métrica">{(controle) => <Input autoComplete="off" {...controle} {...register('metrica')} />}</Campo>
        <Campo rotulo="Meta">{(controle) => <Input autoComplete="off" {...controle} {...register('meta')} />}</Campo>
        <Campo rotulo="Prazo">{(controle) => <EntradaData {...controle} {...register('prazo')} />}</Campo>
        <Controller
          control={control}
          name="situacao"
          render={({ field }) => (
            <Campo rotulo="Situação" obrigatorio>
              {(controle) => (
                <Selecao {...controle} {...field}>
                  {Object.entries(ROTULOS_SITUACAO_OBJETIVO).map(([valor, rotulo]) => (
                    <option key={valor} value={valor}>
                      {rotulo}
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
            <Campo id="objetivo-responsavel" rotulo="Responsável" obrigatorio erro={errors.responsavel_id?.message}>
              {(controle) => (
                <Selecao {...controle} {...field}>
                  <option value="">Escolha</option>
                  {pessoas.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nome}
                    </option>
                  ))}
                </Selecao>
              )}
            </Campo>
          )}
        />
      </div>
    </JanelaFormulario>
  );
}

export function AreaObjetivos({ produtoId, pessoas }: { produtoId: string; pessoas: readonly { id: string; nome: string }[] }) {
  const consulta = useConsulta(() => objetivosDoProduto(produtoId), [produtoId]);
  const [formulario, setFormulario] = useState<{ aberto: boolean; objetivo: Objetivo | null }>({ aberto: false, objetivo: null });
  const abrir = (objetivo: Objetivo | null) => setFormulario({ aberto: true, objetivo });
  const nome = (id: string) => pessoas.find((pessoa) => pessoa.id === id)?.nome ?? 'Pessoa removida';

  if (consulta.estado === 'carregando') return <EstadoCarregando linhas={2} />;
  if (consulta.estado === 'erro') return <EstadoErro titulo="Não deu para ler os objetivos." aoTentarDeNovo={consulta.recarregar} />;
  return (
    <div className="space-y-3">
      {consulta.dados.length > 0 && (
        <div className="flex justify-end">
          <Button onClick={() => abrir(null)}>
            <Plus aria-hidden />
            Novo objetivo
          </Button>
        </div>
      )}
      {consulta.dados.length ? (
        <ul className="grid gap-2.5">
          {consulta.dados.map((objetivo) => (
            <li key={objetivo.id} className="rounded-lg border border-line bg-paper p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <button type="button" onClick={() => abrir(objetivo)} className="min-h-11 text-left font-semibold break-words underline-offset-2 hover:underline md:min-h-0">
                  {objetivo.titulo}
                </button>
                <EtiquetaSituacao tipo={TIPOS_DO_OBJETIVO[objetivo.situacao]}>{ROTULOS_SITUACAO_OBJETIVO[objetivo.situacao]}</EtiquetaSituacao>
              </div>
              <p className="mt-1 text-[13px] break-words text-ink-soft">
                {objetivo.metrica ? `Métrica: ${objetivo.metrica}` : 'Sem métrica'} · {objetivo.meta ? `Meta: ${objetivo.meta}` : 'Sem meta'} · {objetivo.prazo ? `Até ${formatarDiaISO(objetivo.prazo)}` : 'Sem prazo'} · {nome(objetivo.responsavel_id)}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <EstadoVazio icone={Goal} titulo="Nenhum objetivo ainda." texto="O que este produto pretende provar, com métrica, meta e prazo." acao={<Button onClick={() => abrir(null)}>Novo objetivo</Button>} />
      )}
      <FormularioDoObjetivo aberto={formulario.aberto} aoFechar={() => setFormulario((atual) => ({ ...atual, aberto: false }))} produtoId={produtoId} objetivo={formulario.objetivo} pessoas={pessoas} />
    </div>
  );
}

/** Custos rateados (M05). A tela T05.09 e o orçamento T05.08 ainda não existem: aqui só o que os lançamentos já dizem. */
export function AreaCustos({ produtoId, hoje }: { produtoId: string; hoje: string }) {
  const consulta = useConsulta(async () => {
    const [meses, medio] = await Promise.all([custosPorMesDoProduto(produtoId), custoMedioDoProduto(produtoId, hoje)]);
    return { meses, medio };
  }, [produtoId, hoje]);
  if (consulta.estado === 'carregando') return <EstadoCarregando linhas={2} />;
  if (consulta.estado === 'erro') return <EstadoErro titulo="Não deu para ler os custos." aoTentarDeNovo={consulta.recarregar} />;
  const { meses, medio } = consulta.dados;
  return (
    <div className="space-y-3">
      <CartaoDaFicha titulo="Custo médio mensal">
        <p className="font-display text-xl font-semibold">{textoDoCusto(medio, dinheiro)}</p>
        <p className="mt-1 text-[13px] text-ink-soft">{medio.situacao === 'calculado' ? `Média de ${medio.mesesComCusto} ${medio.mesesComCusto === 1 ? 'mês' : 'meses'} com lançamento, entre os 3 anteriores ao mês atual. Sem investimento nem reembolsos.` : 'Precisa de lançamentos rateados a este produto nos 3 meses anteriores ao atual.'}</p>
        {medio.situacao === 'calculado' && medio.mesesComCusto < 3 && <Faixa tipo="atencao" className="mt-2">Só {medio.mesesComCusto} de 3 meses têm lançamento. Mês sem lançamento não entra como zero.</Faixa>}
      </CartaoDaFicha>
      {meses.length ? (
        <ul className="grid gap-2.5">
          {meses.map((mes) => (
            <li key={mes.competencia} className="rounded-lg border border-line bg-paper p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold">{rotuloDaCompetencia(mes.competencia)}</h3>
                <p className="font-semibold tabular-nums">
                  {mes.total === null ? 'Falta câmbio' : dinheiro(mes.total)}
                  {mes.estimado && <span className="ml-1 text-xs font-normal text-ink-soft">estimado</span>}
                </p>
              </div>
              <ul className="mt-1.5 grid gap-0.5 text-[13px] text-ink-soft">
                {mes.categorias.map((categoria) => (
                  <li key={categoria.nome} className="flex justify-between gap-3">
                    <span className="min-w-0 break-words">
                      {categoria.nome}
                      {categoria.investimento ? ' (investimento: fora da média)' : ''}
                    </span>
                    <span className="shrink-0 tabular-nums">{categoria.valor === null ? 'Falta câmbio' : dinheiro(categoria.valor)}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      ) : (
        <EstadoVazio icone={Coins} titulo="Nenhum custo rateado a este produto." texto="Os custos aparecem aqui quando um lançamento do Financeiro for rateado a ele." />
      )}
      <p className="text-xs text-ink-soft">Rateios não são saídas adicionais de caixa. Valores em moeda estrangeira em aberto são estimados.</p>
      <Indisponivel titulo="Orçamento">Sem orçamento cadastrado: a T05.08 ainda não foi construída. Isso não quer dizer orçamento zero.</Indisponivel>
    </div>
  );
}

/** M04: os mesmos registros, sem cópia (CA-04.01), com custo e titularidade. */
export function AreaFerramentas({ produtoId }: { produtoId: string }) {
  const consulta = useConsulta(async () => {
    const [dados, ativos] = await Promise.all([carregarFerramentas(), ativosDoProduto(produtoId)]);
    return { dados, ativos };
  }, [produtoId]);
  if (consulta.estado === 'carregando') return <EstadoCarregando linhas={2} />;
  if (consulta.estado === 'erro') return <EstadoErro titulo="Não deu para ler as ferramentas e os ativos." aoTentarDeNovo={consulta.recarregar} />;
  const { dados, ativos } = consulta.dados;
  const ferramentas = dados.ferramentas.filter((ferramenta) => !ferramenta.arquivado_em && ferramenta.contextos.some((ligacao) => ligacao.produto_id === produtoId));
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <CartaoDaFicha titulo="Ferramentas">
        {ferramentas.length ? (
          <ul className="grid gap-2.5">
            {ferramentas.map((ferramenta) => (
              <li key={ferramenta.id} className="text-[13px]">
                <LinkCentral href={`/ferramentas/${ferramenta.id}`} className="inline-flex min-h-11 items-center font-semibold underline-offset-2 hover:underline md:min-h-0">
                  {ferramenta.nome}
                </LinkCentral>
                <p className="text-ink-soft">{ferramenta.equivalenteMensal === null ? 'Custo não calculado' : `${dinheiro(ferramenta.equivalenteMensal)}/mês (estimado)`}</p>
                <p className="break-words text-ink-soft">Titular: {textoDoTitular(ferramenta, dados.pessoas)}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-ink-soft">Nenhuma ferramenta ligada a este produto.</p>
        )}
      </CartaoDaFicha>
      <CartaoDaFicha titulo="Ativos digitais">
        {ativos.length ? (
          <ul className="grid gap-2.5">
            {ativos.map((ativo) => (
              <li key={ativo.id} className="text-[13px]">
                <LinkCentral href={`/ferramentas/ativos/${ativo.id}`} className="inline-flex min-h-11 items-center font-semibold break-all underline-offset-2 hover:underline md:min-h-0">
                  {ativo.identificador}
                </LinkCentral>
                <p className="break-words text-ink-soft">Titular: {textoDoTitular(ativo, dados.pessoas)}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-ink-soft">Nenhum ativo ligado a este produto.</p>
        )}
      </CartaoDaFicha>
    </div>
  );
}

export function AreaLegal({ temUsuariosReais }: { temUsuariosReais: boolean }) {
  return (
    <div className="space-y-3">
      <Indisponivel titulo="Documentos legais e inventário de dados">O M09 ainda não foi construído, então a Central não sabe se os documentos estão em dia. Isso não quer dizer que estejam.</Indisponivel>
      {temUsuariosReais && <Faixa tipo="atencao">Este produto tem usuários reais: a regra exige Termos de Uso e Política de Privacidade publicados (RN-09.02). Confira fora da Central até o M09 existir.</Faixa>}
    </div>
  );
}

export function AreaMarca({ marca }: { marca: Marca | null }) {
  return (
    <div className="space-y-3">
      <CartaoDaFicha title-id="marca" titulo="Identidade da marca">
        {marca ? (
          <dl className="grid gap-1.5 text-[13px]">
            <div className="flex gap-2">
              <dt className="text-ink-soft">Nome:</dt>
              <dd>
                {marca.nome}
                {marca.provisorio ? ' (nome provisório)' : ''}
              </dd>
            </div>
            <div className="flex items-center gap-2">
              <dt className="text-ink-soft">Cor:</dt>
              <dd className="flex items-center gap-1.5 tabular-nums">
                <span aria-hidden className="size-3.5 rounded-full border border-line" style={{ background: marca.cor_hex }} />
                {marca.cor_hex}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-ink-soft">Logotipo:</dt>
              <dd>
                {marca.logo_url ? (
                  <a href={marca.logo_url} target="_blank" rel="noreferrer" className="underline">
                    Abrir no Drive
                  </a>
                ) : (
                  'Não informado'
                )}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="text-[13px] text-ink-soft">Marca não encontrada.</p>
        )}
      </CartaoDaFicha>
      <Indisponivel titulo="Arquivos">A biblioteca (M08) ainda não foi construída.</Indisponivel>
    </div>
  );
}

/** M03: a mesma aba das fichas, com o mesmo registro: concluir no Meu dia aparece aqui. */
export function AreaAtividades({ produtoId }: { produtoId: string }) {
  return <AbaAtividades consultar={() => atividadesDoRegistro('produto', produtoId)} dependencia={produtoId} vazio="As atividades deste produto aparecem aqui. Crie pelo botão Novo, escolhendo este produto." />;
}

export function AreaHistorico({ produtoId }: { produtoId: string }) {
  const consulta = useConsulta(() => historicoDoProduto(produtoId), [produtoId]);
  return (
    <div className="rounded-lg border border-line bg-paper p-4 md:p-5">
      <ListaHistorico consulta={consulta} comFiltros />
    </div>
  );
}
