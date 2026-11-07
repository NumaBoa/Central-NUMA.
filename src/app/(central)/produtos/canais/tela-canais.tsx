'use client';

import { useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { Plus, Radio, Search } from 'lucide-react';
import { Campo } from '@/componentes/campos/campo';
import { EntradaData } from '@/componentes/campos/entrada-data';
import { Pilulas } from '@/componentes/campos/pilulas';
import { Selecao } from '@/componentes/campos/selecao';
import { SelecaoMoeda } from '@/componentes/campos/selecao-moeda';
import { aviso } from '@/componentes/padroes/aviso';
import { CabecalhoPagina } from '@/componentes/padroes/cabecalho-pagina';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { EtiquetaSituacao } from '@/componentes/padroes/etiquetas';
import { Faixa } from '@/componentes/padroes/faixa';
import { JanelaFormulario, type ErroDeCampo } from '@/componentes/padroes/janela-formulario';
import { Lista, type Coluna } from '@/componentes/padroes/lista';
import { AbasProdutos, AvisoDeFase } from '@/componentes/produtos/aparencia';
import { useAvisoDeCredencial } from '@/componentes/produtos/aviso-credencial-m07';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { Textarea } from '@/componentes/ui/textarea';
import { mensagemDoErro } from '@/dados/erros';
import type { CanalVenda } from '@/dados/tipos/precificacao';
import { useConsulta } from '@/dados/use-consulta';
import { normalizarTexto } from '@/dominio/duplicidade';
import { alertaDoCanal, carregarCanais, esquemaFormularioCanal, FORMULARIO_CANAL_VAZIO, formatarPercentual, formularioDoCanal, ROTULOS_TIPO_CANAL, salvarCanal, type FormularioCanal as DadosDoFormulario } from '@/dominio/precificacao';
import { hojeISO } from '@/lib/datas';
import { formatarDiaISO, formatarDinheiro } from '@/lib/formatacao';

const IDS: Partial<Record<keyof DadosDoFormulario, string>> = { nome: 'canal-nome', taxa_percentual: 'canal-percentual', taxa_fixa: 'canal-fixa', prazo_repasse_dias: 'canal-prazo', verificado_em: 'canal-verificado', fonte_url: 'canal-fonte' };

function textoDaTaxa(canal: CanalVenda): string {
  const percentual = canal.taxa_percentual === null ? 'Percentual não informado' : formatarPercentual(canal.taxa_percentual);
  const fixa = canal.taxa_fixa === null ? 'fixa não informada' : `${formatarDinheiro(canal.taxa_fixa, canal.taxa_fixa_moeda ?? 'BRL')} por transação`;
  return `${percentual} + ${fixa}`;
}

function SituacaoDaVerificacao({ canal, hoje }: { canal: CanalVenda; hoje: string }) {
  const alerta = alertaDoCanal(canal, hoje);
  if (alerta === 'sem_verificacao') return <EtiquetaSituacao tipo="atencao">Sem verificação</EtiquetaSituacao>;
  if (alerta === 'vencida') return <EtiquetaSituacao tipo="erro">Há mais de 12 meses · {formatarDiaISO(canal.verificado_em as string)}</EtiquetaSituacao>;
  return <span className="whitespace-nowrap tabular-nums">{formatarDiaISO(canal.verificado_em as string)}</span>;
}

function FormularioCanal({ aberto, aoFechar, canal }: { aberto: boolean; aoFechar: () => void; canal: CanalVenda | null }) {
  const { register, control, handleSubmit, reset, setError, watch, formState } = useForm<DadosDoFormulario>({ resolver: zodResolver(esquemaFormularioCanal), defaultValues: FORMULARIO_CANAL_VAZIO, mode: 'onTouched' });
  const { errors, isDirty, isSubmitting } = formState;
  const credencial = useAvisoDeCredencial();
  const fixa = watch('taxa_fixa');

  useEffect(() => {
    if (!aberto) return;
    reset(canal ? formularioDoCanal(canal) : FORMULARIO_CANAL_VAZIO);
    credencial.limpar();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- começa do que está salvo a cada vez que abre
  }, [aberto, canal?.id]);

  const erros: ErroDeCampo[] = (Object.keys(IDS) as (keyof DadosDoFormulario)[]).flatMap((campo) => {
    const mensagem = errors[campo]?.message;
    return mensagem ? [{ campoId: IDS[campo] as string, mensagem }] : [];
  });

  const enviar = handleSubmit(async (dados) => {
    if (!credencial.conferir([dados.nome, dados.observacao])) return;
    try {
      await salvarCanal(dados, canal?.id);
      aviso(canal ? 'Canal atualizado.' : 'Canal criado.');
      aoFechar();
    } catch (erro) {
      const mensagem = mensagemDoErro(erro);
      if (mensagem.includes('nome')) setError('nome', { message: mensagem }, { shouldFocus: true });
      else aviso(mensagem);
    }
  });

  return (
    <JanelaFormulario colunas={2} aberto={aberto} aoFechar={aoFechar} titulo={canal ? 'Editar canal' : 'Novo canal de venda'} descricao="As taxas são informadas por vocês. A Central não presume taxas de lojas nem de gateways." alterado={isDirty} aoEnviar={(evento) => void enviar(evento)} rotuloSalvar={canal ? 'Salvar alterações' : 'Criar canal'} salvando={isSubmitting} erros={erros}>
      {credencial.faixa}
      <div className="grid grid-cols-1 gap-[18px]">
        <Campo id={IDS.nome} rotulo="Nome" obrigatorio erro={errors.nome?.message}>
          {(controle) => <Input autoComplete="off" {...controle} {...register('nome')} />}
        </Campo>
        <Controller
          control={control}
          name="tipo"
          render={({ field }) => (
            <Campo rotulo="Tipo" obrigatorio>
              {(controle) => (
                <Selecao {...controle} {...field}>
                  {Object.entries(ROTULOS_TIPO_CANAL).map(([valor, rotulo]) => (
                    <option key={valor} value={valor}>
                      {rotulo}
                    </option>
                  ))}
                </Selecao>
              )}
            </Campo>
          )}
        />
        <Campo id={IDS.taxa_percentual} rotulo="Taxa percentual" erro={errors.taxa_percentual?.message} ajuda="Vazio é “não informado”, e o simulador avisa. Zero é zero.">
          {(controle) => <Input inputMode="decimal" autoComplete="off" {...controle} {...register('taxa_percentual')} />}
        </Campo>
        <Campo id={IDS.taxa_fixa} rotulo="Taxa fixa por transação" erro={errors.taxa_fixa?.message}>
          {(controle) => <Input inputMode="decimal" autoComplete="off" {...controle} {...register('taxa_fixa')} />}
        </Campo>
        {fixa.trim() && (
          <Controller
            control={control}
            name="taxa_fixa_moeda"
            render={({ field }) => <Campo rotulo="Moeda da taxa fixa">{(controle) => <SelecaoMoeda {...controle} {...field} />}</Campo>}
          />
        )}
        <Campo id={IDS.prazo_repasse_dias} rotulo="Prazo de repasse (dias)" erro={errors.prazo_repasse_dias?.message}>
          {(controle) => <Input inputMode="numeric" autoComplete="off" {...controle} {...register('prazo_repasse_dias')} />}
        </Campo>
        <Controller
          control={control}
          name="moeda_repasse"
          render={({ field }) => <Campo rotulo="Moeda de repasse">{(controle) => <SelecaoMoeda {...controle} {...field} />}</Campo>}
        />
        <Campo id={IDS.verificado_em} rotulo="Última verificação" erro={errors.verificado_em?.message} ajuda="Obrigatória quando há taxa.">
          {(controle) => <EntradaData {...controle} max={hojeISO()} {...register('verificado_em')} />}
        </Campo>
        <Campo id={IDS.fonte_url} rotulo="Fonte (link)" erro={errors.fonte_url?.message} ajuda="Onde a taxa foi conferida. Obrigatória quando há taxa.">
          {(controle) => <Input type="url" autoComplete="off" {...controle} {...register('fonte_url')} />}
        </Campo>
        <Campo rotulo="Observação da regra" ajuda="Ex.: percentual reduzido para pequenas empresas: confirmar elegibilidade.">
          {(controle) => <Textarea {...controle} {...register('observacao')} />}
        </Campo>
        <Controller
          control={control}
          name="situacao"
          render={({ field }) => (
            <Pilulas
              rotulo="Situação"
              obrigatorio
              valor={field.value}
              aoMudar={field.onChange}
              opcoes={[
                { valor: 'ativo', rotulo: 'Ativo' },
                { valor: 'inativo', rotulo: 'Inativo' },
              ]}
            />
          )}
        />
      </div>
    </JanelaFormulario>
  );
}

/** T07.05: parâmetros compartilhados pelos produtos; cada simulação guarda os valores que usou (RN-07.15). */
export function TelaCanais() {
  const consulta = useConsulta(carregarCanais);
  const [busca, setBusca] = useState('');
  const [situacao, setSituacao] = useState('ativo');
  const [formulario, setFormulario] = useState<{ aberto: boolean; canal: CanalVenda | null }>({ aberto: false, canal: null });
  const hoje = hojeISO();
  const abrir = (canal: CanalVenda | null) => setFormulario({ aberto: true, canal });

  const colunas = useMemo<readonly Coluna<CanalVenda>[]>(
    () => [
      { id: 'nome', titulo: 'Canal', essencial: true, ordenar: (a, b) => a.nome.localeCompare(b.nome, 'pt-BR'), celula: (canal) => <span className="font-medium">{canal.nome}</span> },
      { id: 'tipo', titulo: 'Tipo', celula: (canal) => ROTULOS_TIPO_CANAL[canal.tipo] },
      { id: 'taxas', titulo: 'Taxas', essencial: true, celula: textoDaTaxa },
      { id: 'repasse', titulo: 'Repasse', celula: (canal) => (canal.prazo_repasse_dias === null ? 'Não informado' : `${canal.prazo_repasse_dias} dias${canal.moeda_repasse ? ` · ${canal.moeda_repasse}` : ''}`) },
      { id: 'verificacao', titulo: 'Última verificação', essencial: true, celula: (canal) => <SituacaoDaVerificacao canal={canal} hoje={hoje} /> },
      {
        id: 'fonte',
        titulo: 'Fonte',
        celula: (canal) =>
          canal.fonte_url ? (
            <a href={canal.fonte_url} target="_blank" rel="noreferrer" className="underline" onClick={(evento) => evento.stopPropagation()}>
              Abrir
            </a>
          ) : (
            <span className="text-ink-soft">Não informada</span>
          ),
      },
    ],
    [hoje],
  );

  if (consulta.estado === 'carregando') return <EstadoCarregando />;
  if (consulta.estado === 'erro') {
    return (
      <>
        <h1 className="mb-5">Canais de venda</h1>
        <EstadoErro titulo="Não deu para ler os canais." aoTentarDeNovo={consulta.recarregar} />
      </>
    );
  }

  const canais = consulta.dados;
  const termo = normalizarTexto(busca);
  const linhas = canais.filter((canal) => (!situacao || canal.situacao === situacao) && (!termo || normalizarTexto(`${canal.nome} ${ROTULOS_TIPO_CANAL[canal.tipo]}`).includes(termo)));
  const vencidos = canais.filter((canal) => canal.situacao === 'ativo' && alertaDoCanal(canal, hoje) === 'vencida').length;
  const filtrando = Boolean(busca.trim()) || situacao !== 'ativo';

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        kicker="Produtos"
        titulo="Canais de venda"
        resumo="Por onde a receita entra e quanto cada canal cobra. Os valores são informados por vocês, com fonte e data."
        acoes={
          <Button onClick={() => abrir(null)}>
            <Plus aria-hidden />
            Novo canal
          </Button>
        }
      />
      <AbasProdutos ativa="canais" />
      <AvisoDeFase />
      {vencidos > 0 && <Faixa tipo="atencao">{vencidos === 1 ? '1 canal está' : `${vencidos} canais estão`} sem verificação há mais de 12 meses. Confira as taxas antes de simular. O alerta no Meu dia ainda não está ligado.</Faixa>}

      <section aria-label="Filtros dos canais" className="flex flex-wrap items-end gap-2.5">
        <div className="min-w-0 flex-1 md:max-w-xs">
          <label htmlFor="busca-canais" className="mb-[7px] block texto-rotulo">
            Buscar
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-soft" aria-hidden />
            <Input id="busca-canais" type="search" placeholder="Nome ou tipo" value={busca} onChange={(evento) => setBusca(evento.target.value)} className="rounded-pill bg-paper pl-10" />
          </div>
        </div>
        <Campo id="filtro-canal-situacao" rotulo="Situação" className="w-40">
          {(controle) => (
            <Selecao {...controle} value={situacao} onChange={(evento) => setSituacao(evento.target.value)}>
              <option value="ativo">Ativos</option>
              <option value="inativo">Inativos</option>
              <option value="">Todos</option>
            </Selecao>
          )}
        </Campo>
        <p role="status" className="ml-auto pb-2.5 text-sm font-semibold">
          {linhas.length === 1 ? '1 canal' : `${linhas.length} canais`}
        </p>
      </section>

      <Lista
        rotulo="Canais de venda"
        linhas={linhas}
        colunas={colunas}
        chave={(canal) => canal.id}
        aoAbrir={abrir}
        filtrando={filtrando}
        aoLimparFiltros={() => {
          setBusca('');
          setSituacao('ativo');
        }}
        vazio={<EstadoVazio icone={Radio} titulo="Nenhum canal ainda." texto="Cadastre um canal, com a taxa e de onde ela veio, para simular preços." acao={<Button onClick={() => abrir(null)}>Novo canal</Button>} />}
        cartao={(canal) => (
          <span className="grid gap-1.5">
            <span className="font-semibold">{canal.nome}</span>
            <span className="text-[13px] text-ink-soft">{ROTULOS_TIPO_CANAL[canal.tipo]}</span>
            <span className="text-[13px]">{textoDaTaxa(canal)}</span>
            <span className="flex flex-wrap items-center gap-2 text-[13px] text-ink-soft">
              Verificação: <SituacaoDaVerificacao canal={canal} hoje={hoje} />
            </span>
          </span>
        )}
      />
      <FormularioCanal aberto={formulario.aberto} aoFechar={() => setFormulario((atual) => ({ ...atual, aberto: false }))} canal={formulario.canal} />
    </div>
  );
}
