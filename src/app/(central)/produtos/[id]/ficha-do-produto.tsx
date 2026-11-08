'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { ArrowLeft, Box, ChevronDown, FileBarChart, Pencil, Plus, Tag, Trash2, TrendingUp } from 'lucide-react';
import { ChipDaMarca, SituacaoDoProduto } from '@/app/(central)/configuracoes/cadastros/marcas/aparencia';
import { FONTE_DA_MARCA } from '@/app/(central)/configuracoes/cadastros/marcas/produtos/[id]/fontes';
import { Campo } from '@/componentes/campos/campo';
import { EntradaData } from '@/componentes/campos/entrada-data';
import { Pilulas } from '@/componentes/campos/pilulas';
import { Selecao } from '@/componentes/campos/selecao';
import { useCentral } from '@/componentes/layout/central-provider';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { aviso } from '@/componentes/padroes/aviso';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { EtiquetaLivre } from '@/componentes/padroes/etiquetas';
import { Faixa } from '@/componentes/padroes/faixa';
import { JanelaFormulario, type ErroDeCampo } from '@/componentes/padroes/janela-formulario';
import { CLASSE_LINHA_MENU, MenuSobreposto } from '@/componentes/padroes/menu-sobreposto';
import { AvisoDaMarcaProvisoria } from '@/componentes/empresa/aviso-da-marca';
import { AvisoDeFase, EtiquetaEstagio } from '@/componentes/produtos/aparencia';
import { useAvisoDeCredencial } from '@/componentes/produtos/aviso-credencial-m07';
import { DialogoMudarEstagio } from '@/componentes/produtos/dialogo-mudar-estagio';
import { FormularioOferta } from '@/componentes/produtos/formularios-oferta';
import { Button, variantesBotao } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/componentes/ui/tabs';
import { Textarea } from '@/componentes/ui/textarea';
import { mensagemDoErro } from '@/dados/erros';
import type { Pessoa } from '@/dados/tipos/pessoa';
import type { Produto } from '@/dados/tipos/marca';
import { useConsulta } from '@/dados/use-consulta';
import { entidadesParaVincular } from '@/dominio/entidades';
import { areasDisponiveis, carregarFicha, esquemaFormularioFicha, formularioDaFicha, salvarFicha, type FormularioFicha, type IdDaArea } from '@/dominio/portfolio';
import { pessoasParaProduto } from '@/dominio/produtos';
import { hojeISO } from '@/lib/datas';
import { cn } from '@/lib/utils';
import { AbaEstagio, AbaVisaoGeral } from './abas-principais';
import { AbaIndicadores, FormularioKpi } from './aba-indicadores';
import { AbaOfertas } from './aba-ofertas';
import { AbaSimulacoes } from './aba-simulacoes';
import { AreaAtividades, AreaCustos, AreaFerramentas, AreaHistorico, AreaLegal, AreaMarca, AreaObjetivos } from './areas-secundarias';

const IDS: Partial<Record<keyof FormularioFicha, string>> = { descricao_curta: 'ficha-descricao-curta', responsavel_id: 'ficha-responsavel' };

function FormularioDaFicha({ aberto, aoFechar, produto, pessoas, entidades }: { aberto: boolean; aoFechar: () => void; produto: Produto; pessoas: readonly Pessoa[]; entidades: Parameters<typeof entidadesParaVincular>[0] }) {
  const { register, control, handleSubmit, reset, formState } = useForm<FormularioFicha>({ resolver: zodResolver(esquemaFormularioFicha), defaultValues: formularioDaFicha(produto, [...pessoas]), mode: 'onTouched' });
  const { errors, isDirty, isSubmitting } = formState;
  const links = useFieldArray({ control, name: 'links' });
  const credencial = useAvisoDeCredencial();

  useEffect(() => {
    if (!aberto) return;
    reset(formularioDaFicha(produto, [...pessoas]));
    credencial.limpar();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- começa do que está salvo a cada vez que abre
  }, [aberto, produto.id]);

  const erros: ErroDeCampo[] = [
    ...(Object.keys(IDS) as (keyof FormularioFicha)[]).flatMap((campo) => {
      const mensagem = errors[campo]?.message;
      return mensagem ? [{ campoId: IDS[campo] as string, mensagem }] : [];
    }),
    ...links.fields.flatMap((_, indice) => {
      const falha = errors.links?.[indice];
      const mensagem = falha?.rotulo?.message ?? falha?.url?.message;
      return mensagem ? [{ campoId: `ficha-link-${falha?.rotulo?.message ? 'rotulo' : 'url'}-${indice}`, mensagem }] : [];
    }),
  ];

  const enviar = handleSubmit(async (dados) => {
    if (!credencial.conferir([dados.descricao_curta, dados.descricao, dados.proposta_valor, dados.publico, dados.problema, dados.como_nasceu, dados.definicao_usuario_ativo])) return;
    try {
      await salvarFicha(produto.id, dados);
      aviso('Ficha atualizada.');
      aoFechar();
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    }
  });

  return (
    <JanelaFormulario colunas={2} aberto={aberto} aoFechar={aoFechar} titulo={`Editar ${produto.nome}`} descricao="Nome, marca e código ficam em Configurações › Marcas e produtos. Estágio e fila mudam com decisão." alterado={isDirty} aoEnviar={(evento) => void enviar(evento)} rotuloSalvar="Salvar alterações" salvando={isSubmitting} erros={erros}>
      {credencial.faixa}
      <div className="grid grid-cols-1 gap-[18px]">
        <Controller
          control={control}
          name="responsavel_id"
          render={({ field }) => (
            <Campo id={IDS.responsavel_id} rotulo="Responsável pelo produto" obrigatorio erro={errors.responsavel_id?.message}>
              {(controle) => (
                <Selecao {...controle} {...field}>
                  {!field.value && <option value="">Escolha uma pessoa</option>}
                  {pessoasParaProduto([...pessoas]).map((pessoa) => (
                    <option key={pessoa.id} value={pessoa.id}>
                      {pessoa.nome_completo}
                    </option>
                  ))}
                </Selecao>
              )}
            </Campo>
          )}
        />
        <Controller
          control={control}
          name="entidade_id"
          render={({ field }) => (
            <Campo rotulo="Entidade responsável">
              {(controle) => (
                <Selecao {...controle} {...field}>
                  <option value="">A definir</option>
                  {entidadesParaVincular(entidades).map((entidade) => (
                    <option key={entidade.id} value={entidade.id}>
                      {entidade.nome_fantasia || entidade.nome}
                    </option>
                  ))}
                </Selecao>
              )}
            </Campo>
          )}
        />
        <Campo id={IDS.descricao_curta} rotulo="Descrição curta" erro={errors.descricao_curta?.message}>
          {(controle) => <Textarea {...controle} {...register('descricao_curta')} />}
        </Campo>
        <Campo rotulo="Proposta de valor">{(controle) => <Textarea {...controle} {...register('proposta_valor')} />}</Campo>
        <Campo rotulo="Público">{(controle) => <Textarea {...controle} {...register('publico')} />}</Campo>
        <Campo rotulo="Problema que resolve">{(controle) => <Textarea {...controle} {...register('problema')} />}</Campo>
        <Campo rotulo="Como nasceu">{(controle) => <Textarea {...controle} {...register('como_nasceu')} />}</Campo>
        <Campo rotulo="Descrição">{(controle) => <Textarea {...controle} {...register('descricao')} />}</Campo>
        <Campo rotulo="O que é usuário ativo neste produto" ajuda="Ex.: abriu o app no mês. Vazio fica “Definição pendente”.">
          {(controle) => <Input autoComplete="off" {...controle} {...register('definicao_usuario_ativo')} />}
        </Campo>
        <Controller
          control={control}
          name="tem_usuarios_reais"
          render={({ field }) => (
            <Pilulas
              rotulo="Tem usuários reais"
              obrigatorio
              valor={field.value ? 'sim' : 'nao'}
              aoMudar={(valor) => field.onChange(valor === 'sim')}
              opcoes={[
                { valor: 'sim', rotulo: 'Sim' },
                { valor: 'nao', rotulo: 'Não' },
              ]}
            />
          )}
        />
        <Campo rotulo="Data de início">{(controle) => <EntradaData {...controle} {...register('data_inicio')} />}</Campo>
        <div className="md:col-span-2">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="texto-rotulo">Links (site, lojas)</h3>
            <Button variante="terciario" tamanho="pequeno" onClick={() => links.append({ rotulo: '', url: '' })}>
              <Plus aria-hidden />
              Adicionar link
            </Button>
          </div>
          <ul className="grid gap-2.5">
            {links.fields.map((campo, indice) => (
              <li key={campo.id} className="grid items-start gap-2.5 sm:grid-cols-[1fr_2fr_auto]">
                <Campo id={`ficha-link-rotulo-${indice}`} rotulo="O que é" erro={errors.links?.[indice]?.rotulo?.message}>
                  {(controle) => <Input autoComplete="off" {...controle} {...register(`links.${indice}.rotulo`)} />}
                </Campo>
                <Campo id={`ficha-link-url-${indice}`} rotulo="Link" erro={errors.links?.[indice]?.url?.message}>
                  {(controle) => <Input type="url" autoComplete="off" {...controle} {...register(`links.${indice}.url`)} />}
                </Campo>
                <Button variante="terciario" tamanho="pequeno" className="sm:mt-[25px]" aria-label={`Remover link ${indice + 1}`} onClick={() => links.remove(indice)}>
                  <Trash2 aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </JanelaFormulario>
  );
}

/** T07.02: cinco acessos principais; o resto em "Mais áreas", para não virar uma linha longa de abas. */
export function FichaDoProduto() {
  const { id } = useParams<{ id: string }>();
  const parametros = useSearchParams();
  const roteador = useRouter();
  const { faseAtiva } = useCentral();
  const hoje = hojeISO();
  const consulta = useConsulta(() => carregarFicha(id, hoje), [id, hoje]);
  const [aba, setAba] = useState<IdDaArea>('visao');
  const [editando, setEditando] = useState(false);
  const [mudandoEstagio, setMudandoEstagio] = useState(false);
  const [novaOferta, setNovaOferta] = useState(false);
  const [registrandoKpi, setRegistrandoKpi] = useState(false);

  const areas = useMemo(() => areasDisponiveis(faseAtiva), [faseAtiva]);
  const principais = areas.filter((area) => area.grupo === 'principal');
  const secundarias = areas.filter((area) => area.grupo === 'mais');
  const pedida = parametros.get('aba');

  // O link diz a aba: `?aba=indicadores`. Só vale o que está liberado.
  useEffect(() => {
    if (pedida && areas.some((area) => area.id === pedida)) setAba(pedida as IdDaArea);
  }, [pedida, areas]);

  function irPara(nova: IdDaArea) {
    setAba(nova);
    roteador.replace(`/produtos/${id}?aba=${nova}`, { scroll: false });
  }

  const voltar = (
    <LinkCentral href="/produtos" className="mb-4 inline-flex min-h-11 items-center gap-1.5 rounded-pill pr-3 text-[13px] font-medium text-ink-soft hover:text-ink md:min-h-9 [&_svg]:size-4">
      <ArrowLeft aria-hidden />
      Portfólio
    </LinkCentral>
  );

  if (consulta.estado === 'carregando') return <EstadoCarregando />;
  if (consulta.estado === 'erro') {
    return (
      <>
        {voltar}
        <EstadoErro titulo="Não deu para ler este produto." texto="Os dados deste navegador podem estar danificados. Importe um backup ou restaure os exemplos em Configurações › Dados." aoTentarDeNovo={consulta.recarregar} />
      </>
    );
  }
  if (!consulta.dados) {
    return (
      <>
        {voltar}
        <EstadoVazio icone={Box} titulo="Esse produto não existe mais." texto="Ele pode ter sido arquivado ou removido ao importar um arquivo." />
      </>
    );
  }

  const { linha, pessoas, entidades } = consulta.dados;
  const entidade = entidades.find((item) => item.id === linha.entidade_id);
  const secundariaAtiva = secundarias.find((area) => area.id === aba);
  const opcoesDePessoa = pessoasParaProduto(pessoas).map((pessoa) => ({ id: pessoa.id, nome: pessoa.nome_completo }));

  return (
    <article className="space-y-5">
      <div>
        {voltar}
        <header className="flex flex-wrap items-start justify-between gap-x-5 gap-y-3">
          <div className="flex min-w-0 items-start gap-3.5">
            {linha.marca && <ChipDaMarca marca={linha.marca} className="size-14 rounded-md [&_svg]:size-7" />}
            <div className="min-w-0">
              <p className="mb-1 flex items-center gap-2 text-[13px] leading-[18px] font-semibold text-ink-soft before:size-2 before:shrink-0 before:rounded-full before:bg-indigo">Produtos</p>
              <h1 className={cn('break-words', linha.marca && FONTE_DA_MARCA[linha.marca.id])}>{linha.nome}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <EtiquetaEstagio produto={linha} />
                <SituacaoDoProduto situacao={linha.situacao} />
                {linha.marca?.provisorio && <EtiquetaLivre>Nome provisório</EtiquetaLivre>}
              </div>
              <dl className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-ink-soft">
                {linha.marca && (
                  <div className="flex gap-1">
                    <dt>Marca:</dt>
                    <dd className="font-medium text-ink">{linha.marca.nome}</dd>
                  </div>
                )}
                <div className="flex gap-1">
                  <dt>Responsável:</dt>
                  <dd className="font-medium text-ink">{linha.responsavel ?? 'A definir'}</dd>
                </div>
                <div className="flex gap-1">
                  <dt>Entidade responsável:</dt>
                  <dd className="font-medium text-ink">{entidade ? entidade.nome_fantasia || entidade.nome : 'A definir'}</dd>
                </div>
              </dl>
            </div>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 md:w-auto max-md:[&>*]:flex-1">
            <LinkCentral href={`/produtos/simulador?produto=${linha.id}`} className={variantesBotao()}>
              <FileBarChart aria-hidden />
              Nova simulação
            </LinkCentral>
            <Button variante="secundario" onClick={() => setEditando(true)}>
              <Pencil aria-hidden />
              Editar
            </Button>
            <Button variante="secundario" onClick={() => setMudandoEstagio(true)}>
              <TrendingUp aria-hidden />
              Mudar estágio
            </Button>
            <MenuSobreposto
              titulo="Mais ações"
              alinhar="end"
              largura={260}
              gatilho={
                <Button variante="secundario">
                  Mais ações
                  <ChevronDown aria-hidden />
                </Button>
              }
            >
              {(fechar) => (
                <ul className="px-1 pb-1 md:px-2">
                  <li>
                    <button
                      type="button"
                      className={CLASSE_LINHA_MENU}
                      onClick={() => {
                        fechar();
                        irPara('ofertas');
                        setNovaOferta(true);
                      }}
                    >
                      <Tag aria-hidden />
                      Nova oferta
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      className={CLASSE_LINHA_MENU}
                      onClick={() => {
                        fechar();
                        irPara('indicadores');
                        setRegistrandoKpi(true);
                      }}
                    >
                      <TrendingUp aria-hidden />
                      Registrar KPI
                    </button>
                  </li>
                  <li>
                    <LinkCentral href={`/configuracoes/cadastros/marcas/produtos/${linha.id}`} className={CLASSE_LINHA_MENU}>
                      <Box aria-hidden />
                      Cadastro básico
                    </LinkCentral>
                  </li>
                </ul>
              )}
            </MenuSobreposto>
          </div>
        </header>
      </div>

      <AvisoDeFase />
      <AvisoDaMarcaProvisoria marcaId={linha.marca?.id} />
      {!linha.responsavel && <Faixa tipo="atencao">Este produto está sem responsável. Edite e escolha uma pessoa.</Faixa>}

      <Tabs value={aba} onValueChange={(valor) => irPara(valor as IdDaArea)} className="min-w-0">
        <div className="flex min-w-0 items-center gap-1.5 rounded-pill">
          <TabsList aria-label={`Seções de ${linha.nome}`} className="min-w-0 flex-1 md:flex-none">
            {principais.map((area) => (
              <TabsTrigger key={area.id} value={area.id}>
                {area.rotulo}
              </TabsTrigger>
            ))}
          </TabsList>
          <MenuSobreposto
            titulo="Mais áreas"
            alinhar="end"
            largura={280}
            gatilho={
              <button type="button" className={cn('inline-flex min-h-11 shrink-0 items-center gap-1 rounded-pill px-3.5 text-[13px] font-medium whitespace-nowrap md:min-h-9 [&_svg]:size-4', secundariaAtiva ? 'bg-active font-semibold text-ink' : 'text-ink-soft hover:text-ink')}>
                <span className="max-md:hidden">{secundariaAtiva?.rotulo ?? 'Mais áreas'}</span>
                <span className="md:hidden">{secundariaAtiva ? secundariaAtiva.rotulo : 'Mais'}</span>
                <ChevronDown aria-hidden />
              </button>
            }
          >
            {(fechar) => (
              <ul className="px-1 pb-1 md:px-2">
                {secundarias.map((area) => (
                  <li key={area.id}>
                    <button
                      type="button"
                      aria-current={area.id === aba ? 'true' : undefined}
                      className={cn(CLASSE_LINHA_MENU, area.id === aba && 'font-semibold')}
                      onClick={() => {
                        fechar();
                        irPara(area.id);
                      }}
                    >
                      {area.rotulo}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </MenuSobreposto>
        </div>

        <TabsContent value="visao" className="mt-4 text-sm">
          <AbaVisaoGeral linha={linha} aoEditar={() => setEditando(true)} hoje={hoje} />
        </TabsContent>
        <TabsContent value="estagio" className="mt-4 text-sm">
          <AbaEstagio produtoId={linha.id} aoMudar={() => setMudandoEstagio(true)} />
        </TabsContent>
        <TabsContent value="ofertas" className="mt-4 text-sm">
          <AbaOfertas produtoId={linha.id} aoNova={() => setNovaOferta(true)} hoje={hoje} />
        </TabsContent>
        <TabsContent value="simulacoes" className="mt-4 text-sm">
          <AbaSimulacoes produtoId={linha.id} />
        </TabsContent>
        <TabsContent value="indicadores" className="mt-4 text-sm">
          <AbaIndicadores produto={linha} aoRegistrar={() => setRegistrandoKpi(true)} aoEditarDefinicao={() => setEditando(true)} hoje={hoje} />
        </TabsContent>
        <TabsContent value="objetivos" className="mt-4 text-sm">
          <AreaObjetivos produtoId={linha.id} pessoas={opcoesDePessoa} />
        </TabsContent>
        <TabsContent value="custos" className="mt-4 text-sm">
          <AreaCustos produtoId={linha.id} hoje={hoje} />
        </TabsContent>
        <TabsContent value="ferramentas" className="mt-4 text-sm">
          <AreaFerramentas produtoId={linha.id} />
        </TabsContent>
        <TabsContent value="legal" className="mt-4 text-sm">
          <AreaLegal temUsuariosReais={linha.tem_usuarios_reais} />
        </TabsContent>
        <TabsContent value="marca" className="mt-4 text-sm">
          <AreaMarca marca={linha.marca} />
        </TabsContent>
        <TabsContent value="atividades" className="mt-4 text-sm">
          <AreaAtividades produtoId={linha.id} />
        </TabsContent>
        <TabsContent value="historico" className="mt-4 text-sm">
          <AreaHistorico produtoId={linha.id} />
        </TabsContent>
      </Tabs>

      <FormularioDaFicha aberto={editando} aoFechar={() => setEditando(false)} produto={linha} pessoas={pessoas} entidades={entidades} />
      <DialogoMudarEstagio aberto={mudandoEstagio} aoFechar={() => setMudandoEstagio(false)} produto={linha} pessoas={opcoesDePessoa} />
      <FormularioOferta aberto={novaOferta} aoFechar={() => setNovaOferta(false)} produtoId={linha.id} nomeDoProduto={linha.nome} aoCriar={(oferta) => roteador.push(`/produtos/${linha.id}/ofertas/${oferta.id}`)} />
      <FormularioKpi aberto={registrandoKpi} aoFechar={() => setRegistrandoKpi(false)} produtoId={linha.id} nomeDoProduto={linha.nome} hoje={hoje} />
    </article>
  );
}
