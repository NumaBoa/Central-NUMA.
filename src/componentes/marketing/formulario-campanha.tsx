'use client';

import { useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { Campo } from '@/componentes/campos/campo';
import { EntradaData } from '@/componentes/campos/entrada-data';
import { PilulasMultiplas } from '@/componentes/campos/pilulas';
import { Selecao } from '@/componentes/campos/selecao';
import { useCentral } from '@/componentes/layout/central-provider';
import { aviso } from '@/componentes/padroes/aviso';
import { Confirmacao } from '@/componentes/padroes/confirmacao';
import { JanelaFormulario, type ErroDeCampo } from '@/componentes/padroes/janela-formulario';
import { Input } from '@/componentes/ui/input';
import { Textarea } from '@/componentes/ui/textarea';
import { mensagemDoErro } from '@/dados/erros';
import { CANAIS_DE_CONTEUDO, SITUACOES_DE_CAMPANHA, type Campanha } from '@/dados/tipos/marketing';
import { avisosDaCampanha, criarCampanha, esquemaFormularioCampanha, formularioCampanhaVazio, formularioDaCampanha, ROTULOS_SITUACAO_CAMPANHA, salvarCampanha, type DadosDasCampanhas, type FormularioCampanha } from '@/dominio/campanhas';
import { ROTULOS_CANAL } from '@/dominio/conteudo';
import { pessoasDoSeletor } from '@/dominio/pessoa-atual';
import { opcoesDeContexto } from './apoio';

const CAMPOS: Partial<Record<keyof FormularioCampanha, string>> = { nome: 'campanha-nome', contexto: 'campanha-contexto', inicio: 'campanha-inicio', fim: 'campanha-fim', orcamento: 'campanha-orcamento', responsavel_id: 'campanha-responsavel' };

/** T08.06, F1 básico. Orçamento é só o planejado; os lançamentos continuam no M05. */
export function FormularioDeCampanha({ dados, campanha, aoFechar, aoCriar }: { dados: DadosDasCampanhas; campanha?: Campanha | null; aoFechar: () => void; aoCriar?: (campanha: Campanha) => void }) {
  const { pessoa, contexto } = useCentral();
  const inicial = useMemo(() => (campanha ? formularioDaCampanha(campanha) : formularioCampanhaVazio(pessoa.id, contexto.id)), [campanha, pessoa.id, contexto.id]);
  const { register, handleSubmit, control, reset, watch, formState } = useForm<FormularioCampanha>({ resolver: zodResolver(esquemaFormularioCampanha), defaultValues: inicial, mode: 'onTouched' });
  const { errors, isDirty, isSubmitting } = formState;
  const [avisos, setAvisos] = useState<{ formulario: FormularioCampanha; textos: readonly string[] } | null>(null);

  useEffect(() => reset(inicial), [inicial, reset]);

  const internas = pessoasDoSeletor(dados.pessoas);
  const atual = watch('responsavel_id');
  const responsaveis = atual && !internas.some((item) => item.id === atual) ? [...internas, ...dados.pessoas.filter((item) => item.id === atual)] : internas;
  const erros: ErroDeCampo[] = (Object.entries(CAMPOS) as [keyof FormularioCampanha, string][]).flatMap(([campo, campoId]) => {
    const mensagem = errors[campo]?.message;
    return typeof mensagem === 'string' ? [{ campoId, mensagem }] : [];
  });

  async function gravar(formulario: FormularioCampanha) {
    try {
      if (campanha) {
        await salvarCampanha(campanha.id, formulario);
        aviso('Campanha atualizada.');
      } else {
        const criada = await criarCampanha(formulario);
        if (aoCriar) aoCriar(criada);
        else aviso('Campanha criada.');
      }
      aoFechar();
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    }
  }

  const enviar = handleSubmit(async (formulario) => {
    const textos = avisosDaCampanha(formulario);
    if (textos.length) {
      setAvisos({ formulario, textos });
      return;
    }
    await gravar(formulario);
  });

  return (
    <>
      <JanelaFormulario colunas={2} aberto aoFechar={aoFechar} titulo={campanha ? 'Editar campanha' : 'Nova campanha'} alterado={isDirty} aoEnviar={(evento) => void enviar(evento)} rotuloSalvar={campanha ? 'Salvar' : 'Salvar campanha'} salvando={isSubmitting} erros={erros}>
        <div className="grid gap-[18px]">
          <Campo id="campanha-nome" rotulo="Nome" obrigatorio erro={errors.nome?.message}>
            {(controle) => <Input autoComplete="off" {...controle} {...register('nome')} />}
          </Campo>
          <Controller
            control={control}
            name="contexto"
            render={({ field }) => (
              <Campo id="campanha-contexto" rotulo="Marca ou produto" obrigatorio erro={errors.contexto?.message}>
                {(controle) => (
                  <Selecao {...controle} {...field}>
                    <option value="">Escolha</option>
                    {opcoesDeContexto(dados.produtos).map((opcao) => (
                      <option key={opcao.valor} value={opcao.valor}>
                        {opcao.rotulo}
                      </option>
                    ))}
                  </Selecao>
                )}
              </Campo>
            )}
          />
          <Campo id="campanha-objetivo" rotulo="Objetivo">
            {(controle) => <Textarea {...controle} {...register('objetivo')} />}
          </Campo>
          <Campo id="campanha-publico" rotulo="Público">
            {(controle) => <Input autoComplete="off" {...controle} {...register('publico')} />}
          </Campo>
          <Controller control={control} name="canais" render={({ field }) => <PilulasMultiplas rotulo="Canais" valores={field.value ?? []} aoMudar={field.onChange} opcoes={CANAIS_DE_CONTEUDO.map((valor) => ({ valor, rotulo: ROTULOS_CANAL[valor] }))} />} />
          <div className="grid grid-cols-2 gap-3">
            <Campo id="campanha-inicio" rotulo="Início" erro={errors.inicio?.message}>
              {(controle) => <EntradaData {...controle} {...register('inicio')} />}
            </Campo>
            <Campo id="campanha-fim" rotulo="Fim" erro={errors.fim?.message}>
              {(controle) => <EntradaData {...controle} {...register('fim')} />}
            </Campo>
          </div>
          <Campo id="campanha-orcamento" rotulo="Orçamento planejado (R$) · FIN" erro={errors.orcamento?.message} ajuda="Vazio é não definido, nunca zero. Os lançamentos são vinculados na ficha, a partir do Financeiro.">
            {(controle) => <Input inputMode="decimal" autoComplete="off" {...controle} {...register('orcamento')} />}
          </Campo>
          <Controller
            control={control}
            name="responsavel_id"
            render={({ field }) => (
              <Campo id="campanha-responsavel" rotulo="Responsável" obrigatorio erro={errors.responsavel_id?.message}>
                {(controle) => (
                  <Selecao {...controle} {...field}>
                    <option value="">Escolha uma pessoa</option>
                    {responsaveis.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.nome_completo}
                      </option>
                    ))}
                  </Selecao>
                )}
              </Campo>
            )}
          />
          <Controller
            control={control}
            name="situacao"
            render={({ field }) => (
              <Campo id="campanha-situacao" rotulo="Situação" obrigatorio>
                {(controle) => (
                  <Selecao {...controle} {...field}>
                    {SITUACOES_DE_CAMPANHA.map((valor) => (
                      <option key={valor} value={valor}>
                        {ROTULOS_SITUACAO_CAMPANHA[valor]}
                      </option>
                    ))}
                  </Selecao>
                )}
              </Campo>
            )}
          />
          {watch('situacao') === 'cancelada' && (
            <Campo id="campanha-motivo" rotulo="Motivo do cancelamento">
              {(controle) => <Input autoComplete="off" {...controle} {...register('cancelada_motivo')} />}
            </Campo>
          )}
        </div>
      </JanelaFormulario>
      <Confirmacao
        aberto={avisos !== null}
        aoFechar={() => setAvisos(null)}
        titulo="Salvar mesmo assim?"
        texto={avisos?.textos.join(' ')}
        rotuloConfirmar="Salvar mesmo assim"
        rotuloCancelar="Voltar e revisar"
        aoConfirmar={() => {
          const salvo = avisos;
          setAvisos(null);
          if (salvo) void gravar(salvo.formulario);
        }}
      />
    </>
  );
}
