'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { Campo } from '@/componentes/campos/campo';
import { EntradaData } from '@/componentes/campos/entrada-data';
import { Selecao } from '@/componentes/campos/selecao';
import { SelecaoPessoa } from '@/componentes/campos/selecao-pessoa';
import { SeletorContraparte } from '@/componentes/campos/seletor-contraparte';
import { useNovaContraparte } from '@/componentes/contrapartes/nova-contraparte';
import { aviso } from '@/componentes/padroes/aviso';
import { JanelaFormulario } from '@/componentes/padroes/janela-formulario';
import { Input } from '@/componentes/ui/input';
import { Textarea } from '@/componentes/ui/textarea';
import { mensagemDoErro } from '@/dados/erros';
import { idDaPessoaAtual } from '@/dados/sessao';
import type { Oportunidade } from '@/dados/tipos/comercial';
import { ETAPAS_ABERTAS, esquemaFormularioOportunidade, formularioDaOportunidade, formularioOportunidadeVazio, ROTULOS_ETAPA, ROTULOS_PERIODICIDADE_VALOR, ROTULOS_TIPO_OPORTUNIDADE, salvarOportunidade, type DadosComerciais, type FormularioOportunidade } from '@/dominio/comercial';
import { ORIGENS_DO_FORMULARIO, ROTULOS_ORIGEM } from '@/dominio/contrapartes';
import { pessoasDoSeletor } from '@/dominio/pessoa-atual';
import { CaixasDeSelecao, errosDoFormulario, paraOpcoes } from './apoio';

const IDS = { contraparte_id: 'op-contraparte', titulo: 'op-titulo', produtos: 'op-produtos', tipo: 'op-tipo', origem: 'op-origem', valor_estimado: 'op-valor', valor_periodicidade: 'op-periodicidade', probabilidade: 'op-probabilidade', responsavel_id: 'op-responsavel' } as const;

/** T10.03, formulário: contraparte com criação rápida (02 §6), produtos de interesse e valor com periodicidade. */
export function FormularioOportunidade({ dados, oportunidade, ligacoes, contraparteInicial = '', aoFechar }: { dados: DadosComerciais; oportunidade?: Oportunidade; ligacoes?: { produtos: string[]; participantes: string[]; contatos: string[] }; contraparteInicial?: string; aoFechar: () => void }) {
  const roteador = useRouter();
  const { abrirNovaContraparte } = useNovaContraparte();
  const inicial = oportunidade && ligacoes ? formularioDaOportunidade(oportunidade, ligacoes) : formularioOportunidadeVazio(idDaPessoaAtual() ?? '', contraparteInicial);
  const { register, control, handleSubmit, formState, watch } = useForm<FormularioOportunidade>({ resolver: zodResolver(esquemaFormularioOportunidade), defaultValues: inicial, mode: 'onTouched' });
  const { errors } = formState;
  const pessoas = useMemo(() => pessoasDoSeletor(dados.pessoas), [dados.pessoas]);
  const contraparte = watch('contraparte_id');
  const contatos = dados.pessoas.filter((pessoa) => pessoa.contraparte_id && pessoa.contraparte_id === contraparte && !pessoa.arquivado_em);
  const enviar = handleSubmit(async (formulario) => {
    try {
      const salva = await salvarOportunidade(formulario, oportunidade?.id);
      aviso(oportunidade ? 'Oportunidade atualizada.' : 'Oportunidade criada. Registre a próxima ação.');
      aoFechar();
      if (!oportunidade) roteador.push(`/comercial/oportunidades/${salva.id}`);
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    }
  });
  const opcoesSelecao = (rotulos: Readonly<Record<string, string>>) =>
    paraOpcoes(rotulos).map((opcao) => (
      <option key={opcao.valor} value={opcao.valor}>
        {opcao.rotulo}
      </option>
    ));
  return (
    <JanelaFormulario colunas={2} aberto aoFechar={aoFechar} titulo={oportunidade ? 'Editar oportunidade' : 'Nova oportunidade'} alterado={formState.isDirty} aoEnviar={enviar} salvando={formState.isSubmitting} rotuloSalvar={oportunidade ? 'Salvar alterações' : 'Salvar'} erros={errosDoFormulario(errors, IDS)}>
      <div className="grid grid-cols-1 gap-[18px]">
        <Controller
          control={control}
          name="contraparte_id"
          render={({ field }) => (
            <Campo id={IDS.contraparte_id} rotulo="Contraparte" obrigatorio erro={errors.contraparte_id?.message}>
              {(controle) => <SeletorContraparte {...controle} valor={field.value} aoMudar={field.onChange} contrapartes={dados.contrapartes} aoCriar={() => abrirNovaContraparte()} />}
            </Campo>
          )}
        />
        <Campo id={IDS.titulo} rotulo="Título" obrigatorio erro={errors.titulo?.message}>
          {(controle) => <Input {...controle} autoComplete="off" {...register('titulo')} />}
        </Campo>
        <Controller control={control} name="produtos" render={({ field }) => <CaixasDeSelecao id={IDS.produtos} rotulo="Produtos de interesse" obrigatorio opcoes={dados.produtos.filter((produto) => !produto.arquivado_em).map((produto) => ({ valor: produto.id, rotulo: produto.nome }))} valores={field.value} aoMudar={field.onChange} erro={errors.produtos?.message} />} />
        <Controller
          control={control}
          name="tipo"
          render={({ field }) => (
            <Campo id={IDS.tipo} rotulo="Tipo" obrigatorio>
              {(controle) => (
                <Selecao {...controle} {...field}>
                  {opcoesSelecao(ROTULOS_TIPO_OPORTUNIDADE)}
                </Selecao>
              )}
            </Campo>
          )}
        />
        <Controller
          control={control}
          name="origem"
          render={({ field }) => (
            <Campo id={IDS.origem} rotulo="Origem" obrigatorio>
              {(controle) => (
                <Selecao {...controle} {...field}>
                  {ORIGENS_DO_FORMULARIO.map((origem) => (
                    <option key={origem} value={origem}>
                      {ROTULOS_ORIGEM[origem]}
                    </option>
                  ))}
                </Selecao>
              )}
            </Campo>
          )}
        />
        <Controller
          control={control}
          name="campanha_id"
          render={({ field }) => (
            <Campo id="op-campanha" rotulo="Campanha de origem" ajuda="Opcional. Informada à mão: a Central não atribui sozinha.">
              {(controle) => (
                <Selecao {...controle} {...field}>
                  <option value="">Nenhuma</option>
                  {dados.campanhas
                    .filter((campanha) => campanha.situacao !== 'cancelada' || campanha.id === field.value)
                    .map((campanha) => (
                      <option key={campanha.id} value={campanha.id}>
                        {campanha.codigo} · {campanha.nome}
                      </option>
                    ))}
                </Selecao>
              )}
            </Campo>
          )}
        />
        <Controller
          control={control}
          name="etapa"
          render={({ field }) => (
            <Campo id="op-etapa" rotulo="Etapa" obrigatorio>
              {(controle) => (
                <Selecao {...controle} {...field}>
                  {ETAPAS_ABERTAS.map((etapa) => (
                    <option key={etapa} value={etapa}>
                      {ROTULOS_ETAPA[etapa]}
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
            <Campo id={IDS.responsavel_id} rotulo="Responsável principal" obrigatorio erro={errors.responsavel_id?.message}>
              {(controle) => <SelecaoPessoa {...controle} {...field} pessoas={pessoas} vazio="Escolha" />}
            </Campo>
          )}
        />
        <Campo id={IDS.valor_estimado} rotulo="Valor estimado" erro={errors.valor_estimado?.message} ajuda="Opcional. Vazio fica “Não informado”, nunca zero.">
          {(controle) => <Input {...controle} inputMode="decimal" autoComplete="off" placeholder="Não informado" {...register('valor_estimado')} />}
        </Campo>
        <Controller
          control={control}
          name="valor_periodicidade"
          render={({ field }) => (
            <Campo id={IDS.valor_periodicidade} rotulo="Periodicidade do valor" erro={errors.valor_periodicidade?.message}>
              {(controle) => (
                <Selecao {...controle} {...field}>
                  <option value="">Sem valor</option>
                  {opcoesSelecao(ROTULOS_PERIODICIDADE_VALOR)}
                </Selecao>
              )}
            </Campo>
          )}
        />
        <Campo id={IDS.probabilidade} rotulo="Probabilidade (%)" erro={errors.probabilidade?.message} ajuda="Informativo.">
          {(controle) => <Input {...controle} inputMode="numeric" autoComplete="off" {...register('probabilidade')} />}
        </Campo>
        <Campo id="op-fechamento" rotulo="Data prevista de fechamento">
          {(controle) => <EntradaData {...controle} {...register('fechamento_previsto')} />}
        </Campo>
        <Controller control={control} name="participantes" render={({ field }) => <CaixasDeSelecao rotulo="Participantes" opcoes={pessoas.map((pessoa) => ({ valor: pessoa.id, rotulo: pessoa.nome_completo }))} valores={field.value} aoMudar={field.onChange} />} />
        {contatos.length > 0 && <Controller control={control} name="contatos" render={({ field }) => <CaixasDeSelecao rotulo="Contatos da contraparte" opcoes={contatos.map((pessoa) => ({ valor: pessoa.id, rotulo: pessoa.nome_completo }))} valores={field.value} aoMudar={field.onChange} />} />}
        <Campo id="op-necessidade" rotulo="Necessidade do cliente">
          {(controle) => <Textarea {...controle} rows={3} {...register('necessidade')} />}
        </Campo>
      </div>
    </JanelaFormulario>
  );
}
