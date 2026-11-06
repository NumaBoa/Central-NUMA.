'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { Campo } from '@/componentes/campos/campo';
import { Pilulas } from '@/componentes/campos/pilulas';
import { Selecao } from '@/componentes/campos/selecao';
import { useCentral } from '@/componentes/layout/central-provider';
import { aviso } from '@/componentes/padroes/aviso';
import { Confirmacao } from '@/componentes/padroes/confirmacao';
import { PainelFormulario, type ErroDeCampo } from '@/componentes/padroes/painel-formulario';
import { Input } from '@/componentes/ui/input';
import { Textarea } from '@/componentes/ui/textarea';
import { mensagemDoErro } from '@/dados/erros';
import { TIPOS_DE_ATIVO, type AtivoDigital } from '@/dados/tipos/ativo';
import { conferirAtivo, criarAtivo, esquemaFormularioAtivo, formularioAtivoVazio, formularioDoAtivo, ROTULOS_TIPO_ATIVO, ROTULOS_TRANSFERENCIA, salvarAtivo, situacaoDaTransferencia, tipoSugereCritico, type DadosDosAtivos, type FormularioAtivo as Formulario } from '@/dominio/ativos';
import { ID_INSTITUCIONAL } from '@/dominio/contextos';
import { responsaveisPadrao } from '@/dominio/ferramentas';
import { pessoasDoSeletor } from '@/dominio/pessoa-atual';
import { ROTULOS_TITULAR } from '@/dominio/titularidade';

const SIM_NAO = [
  { valor: 'nao', rotulo: 'Não' },
  { valor: 'sim', rotulo: 'Sim' },
];
const ID_DO_CAMPO: Partial<Record<keyof Formulario, string>> = {
  identificador: 'ativo-identificador',
  contexto: 'ativo-contexto',
  titular_atual_pessoa_id: 'ativo-titular-pessoa',
  titular_atual_texto: 'ativo-titular-texto',
  titular_desejado: 'ativo-titular-desejado',
  vencimento: 'ativo-vencimento',
  responsavel_id: 'ativo-responsavel',
};
const CAMPOS_COM_ERRO = Object.keys(ID_DO_CAMPO) as (keyof Formulario)[];

type FormularioDeAtivoProps = {
  aberto: boolean;
  aoFechar: () => void;
  dados: DadosDosAtivos;
  /** Sem ativo, é um novo. */
  ativo?: AtivoDigital | null;
  /** A aba em que a lista estava: um novo já começa do tipo dela. */
  tipoInicial?: AtivoDigital['tipo'];
  aoCriar?: (ativo: AtivoDigital) => void;
};

/** T04.05: cadastro do ativo. Acessos entram na F2 (D14). */
export function FormularioDeAtivo({ aberto, aoFechar, dados, ativo, tipoInicial, aoCriar }: FormularioDeAtivoProps) {
  const { pessoa, contexto } = useCentral();
  const inicial = useMemo(() => {
    if (ativo) return formularioDoAtivo(ativo);
    return formularioAtivoVazio(dados.pessoas.find((item) => item.id === pessoa.id)?.eh_socia ? pessoa.id : '', contexto.id, responsaveisPadrao(dados.areas, dados.pessoas).tecnica, tipoInicial);
  }, [ativo, tipoInicial, pessoa.id, contexto.id, dados.areas, dados.pessoas]);
  const { register, handleSubmit, control, reset, watch, setValue, setError, trigger, formState } = useForm<Formulario>({ resolver: zodResolver(esquemaFormularioAtivo), defaultValues: inicial, mode: 'onTouched' });
  const { errors, isDirty, isSubmitting } = formState;
  const [avisos, setAvisos] = useState<{ formulario: Formulario; textos: readonly string[] } | null>(null);

  useEffect(() => {
    if (aberto) reset(inicial);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `inicial` vale no momento de abrir
  }, [aberto, ativo?.id, tipoInicial, reset]);

  const tipo = watch('tipo');
  const titular = watch('titular_atual_tipo');
  // Depois de tentar salvar, o tipo pode resolver o erro do vencimento, e o titular, o dos campos dele.
  const camposLigados = `${tipo}|${titular}`;
  const ligadosConferidos = useRef(camposLigados);
  useEffect(() => {
    if (ligadosConferidos.current === camposLigados) return;
    ligadosConferidos.current = camposLigados;
    if (formState.isSubmitted) void trigger();
  }, [camposLigados, formState.isSubmitted, trigger]);
  const identificador = watch('identificador') ?? '';
  const valores = watch();
  const situacao = situacaoDaTransferencia(valores, dados.pessoas, ativo);
  const internas = pessoasDoSeletor(dados.pessoas);
  const comEscolhida = (lista: typeof internas, id: string) => (id && !lista.some((item) => item.id === id) ? [...lista, ...dados.pessoas.filter((item) => item.id === id)] : lista);
  const socias = comEscolhida(internas.filter((item) => item.eh_socia), valores.titular_atual_pessoa_id);
  const produtos = dados.produtos.filter((produto) => !produto.arquivado_em && produto.situacao === 'ativo');
  const ferramentas = dados.ferramentas.filter((ferramenta) => !ferramenta.arquivado_em && (ferramenta.situacao !== 'cancelada' || ferramenta.id === valores.ferramenta_id));
  const assinaturas = dados.assinaturas.filter((assinatura) => !valores.ferramenta_id || assinatura.ferramenta_id === valores.ferramenta_id);
  const nomeDaFerramenta = (id: string) => dados.ferramentas.find((ferramenta) => ferramenta.id === id)?.nome ?? 'Ferramenta removida';

  const erroDoIdentificador = identificador || formState.isSubmitted ? errors.identificador?.message : undefined;
  const erros: ErroDeCampo[] = CAMPOS_COM_ERRO.flatMap((campo) => {
    const mensagem = campo === 'identificador' ? erroDoIdentificador : errors[campo]?.message;
    const campoId = ID_DO_CAMPO[campo];
    return typeof mensagem === 'string' && campoId ? [{ campoId, mensagem }] : [];
  });

  async function gravar(formulario: Formulario) {
    try {
      if (ativo) {
        await salvarAtivo(ativo.id, formulario, dados.pessoas);
        aviso('Ativo atualizado.');
      } else {
        const criado = await criarAtivo(formulario, dados.pessoas);
        if (aoCriar) aoCriar(criado);
        else aviso('Ativo criado.');
      }
      aoFechar();
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    }
  }

  const enviar = handleSubmit(async (formulario) => {
    const { erroIdentificador, avisos: textos } = conferirAtivo(formulario, dados.ativos, ativo?.id);
    if (erroIdentificador) {
      setError('identificador', { message: erroIdentificador });
      return;
    }
    if (textos.length) {
      setAvisos({ formulario, textos });
      return;
    }
    await gravar(formulario);
  });

  return (
    <>
      <PainelFormulario aberto={aberto} aoFechar={aoFechar} titulo={ativo ? 'Editar ativo' : 'Novo ativo'} alterado={isDirty} aoEnviar={enviar} rotuloSalvar={ativo ? 'Salvar' : 'Salvar ativo'} salvando={isSubmitting} erros={erros}>
        <div className="grid gap-[18px]">
          <Controller
            control={control}
            name="tipo"
            render={({ field }) => (
              <Campo id="ativo-tipo" rotulo="Tipo" obrigatorio>
                {(controle) => (
                  <Selecao
                    {...controle}
                    {...field}
                    onChange={(evento) => {
                      const novo = evento.target.value as Formulario['tipo'];
                      field.onChange(novo);
                      if (!ativo) setValue('critico', tipoSugereCritico(novo), { shouldDirty: true });
                    }}
                  >
                    {TIPOS_DE_ATIVO.map((valor) => (
                      <option key={valor} value={valor}>
                        {ROTULOS_TIPO_ATIVO[valor]}
                      </option>
                    ))}
                  </Selecao>
                )}
              </Campo>
            )}
          />
          <Campo id={ID_DO_CAMPO.identificador} rotulo="Identificador" obrigatorio erro={erroDoIdentificador} ajuda="O domínio, o @perfil, o nome da conta ou da organização.">
            {(controle) => <Input autoComplete="off" {...controle} {...register('identificador')} />}
          </Campo>
          <Controller
            control={control}
            name="contexto"
            render={({ field }) => (
              <Campo id={ID_DO_CAMPO.contexto} rotulo="Produto ou contexto" obrigatorio erro={errors.contexto?.message}>
                {(controle) => (
                  <Selecao {...controle} {...field}>
                    <option value="">Escolha</option>
                    <option value={ID_INSTITUCIONAL}>Numa</option>
                    {produtos.map((produto) => (
                      <option key={produto.id} value={produto.id}>
                        {produto.nome}
                      </option>
                    ))}
                  </Selecao>
                )}
              </Campo>
            )}
          />
          <Controller
            control={control}
            name="ferramenta_id"
            render={({ field }) => (
              <Campo id="ativo-ferramenta" rotulo="Ferramenta ou plataforma" ajuda="Onde este ativo está. Ele aparece na ficha da ferramenta.">
                {(controle) => (
                  <Selecao
                    {...controle}
                    {...field}
                    onChange={(evento) => {
                      field.onChange(evento.target.value);
                      // A assinatura escolhida pode ser de outra ferramenta.
                      setValue('assinatura_id', '', { shouldDirty: true });
                    }}
                  >
                    <option value="">Nenhuma</option>
                    {ferramentas.map((ferramenta) => (
                      <option key={ferramenta.id} value={ferramenta.id}>
                        {ferramenta.nome}
                      </option>
                    ))}
                  </Selecao>
                )}
              </Campo>
            )}
          />
          <Controller
            control={control}
            name="assinatura_id"
            render={({ field }) => (
              <Campo id="ativo-assinatura" rotulo="Assinatura relacionada" ajuda="Liga o ativo ao custo.">
                {(controle) => (
                  <Selecao {...controle} {...field}>
                    <option value="">Nenhuma</option>
                    {assinaturas.map((assinatura) => (
                      <option key={assinatura.id} value={assinatura.id}>
                        {nomeDaFerramenta(assinatura.ferramenta_id)}
                        {assinatura.plano ? ` · ${assinatura.plano}` : ''}
                      </option>
                    ))}
                  </Selecao>
                )}
              </Campo>
            )}
          />
          <Controller control={control} name="critico" render={({ field }) => <Pilulas rotulo="Crítico" obrigatorio valor={field.value ? 'sim' : 'nao'} aoMudar={(valor) => field.onChange(valor === 'sim')} opcoes={SIM_NAO} />} />
          <Controller control={control} name="titular_atual_tipo" render={({ field }) => <Pilulas rotulo="Titular atual" obrigatorio valor={field.value} aoMudar={field.onChange} opcoes={Object.entries(ROTULOS_TITULAR).map(([valor, rotulo]) => ({ valor, rotulo }))} />} />
          {titular === 'pessoa_fisica' && (
            <Controller
              control={control}
              name="titular_atual_pessoa_id"
              render={({ field }) => (
                <Campo id={ID_DO_CAMPO.titular_atual_pessoa_id} rotulo="Sócia titular" obrigatorio erro={errors.titular_atual_pessoa_id?.message}>
                  {(controle) => (
                    <Selecao {...controle} {...field}>
                      <option value="">Escolha uma pessoa</option>
                      {socias.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.nome_completo}
                        </option>
                      ))}
                    </Selecao>
                  )}
                </Campo>
              )}
            />
          )}
          {titular === 'terceiro' && (
            <Campo id={ID_DO_CAMPO.titular_atual_texto} rotulo="Em nome de quem" obrigatorio erro={errors.titular_atual_texto?.message}>
              {(controle) => <Input autoComplete="off" {...controle} {...register('titular_atual_texto')} />}
            </Campo>
          )}
          <Campo id={ID_DO_CAMPO.titular_desejado} rotulo="Titular desejado" obrigatorio erro={errors.titular_desejado?.message} ajuda="O padrão é a Numa.">
            {(controle) => <Input autoComplete="off" {...controle} {...register('titular_desejado')} />}
          </Campo>
          {situacao === 'nao_necessaria' || situacao === 'concluida' ? (
            <p id="ativo-transferencia" className="text-[13px] text-ink-soft">
              Transferência: {ROTULOS_TRANSFERENCIA[situacao]}.
            </p>
          ) : (
            <>
              <Controller
                control={control}
                name="transferencia_situacao"
                render={({ field }) => (
                  <Campo id="ativo-transferencia" rotulo="Situação da transferência" obrigatorio ajuda="Para concluir, use “Registrar transferência” na ficha: pede a evidência.">
                    {(controle) => (
                      <Selecao {...controle} {...field}>
                        {(['pendente', 'em_andamento', 'impedida'] as const).map((valor) => (
                          <option key={valor} value={valor}>
                            {ROTULOS_TRANSFERENCIA[valor]}
                          </option>
                        ))}
                      </Selecao>
                    )}
                  </Campo>
                )}
              />
              <Campo id="ativo-requisito" rotulo="Requisito para transferir" ajuda="Ex.: exige CNPJ e D-U-N-S.">
                {(controle) => <Input autoComplete="off" {...controle} {...register('requisito_transferencia')} />}
              </Campo>
            </>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Campo id="ativo-registrado" rotulo="Data de registro">
              {(controle) => <Input type="date" {...controle} {...register('registrado_em')} />}
            </Campo>
            <Campo id={ID_DO_CAMPO.vencimento} rotulo="Vencimento" obrigatorio={tipo === 'dominio'} erro={errors.vencimento?.message}>
              {(controle) => <Input type="date" {...controle} {...register('vencimento')} />}
            </Campo>
          </div>
          <Controller
            control={control}
            name="renovacao_automatica"
            render={({ field }) => (
              <Pilulas
                rotulo="Renovação automática"
                valor={field.value}
                aoMudar={field.onChange}
                opcoes={SIM_NAO}
              />
            )}
          />
          <Controller
            control={control}
            name="responsavel_id"
            render={({ field }) => (
              <Campo id={ID_DO_CAMPO.responsavel_id} rotulo="Responsável" obrigatorio erro={errors.responsavel_id?.message}>
                {(controle) => (
                  <Selecao {...controle} {...field}>
                    <option value="">Escolha uma pessoa</option>
                    {comEscolhida(internas, field.value).map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.nome_completo}
                      </option>
                    ))}
                  </Selecao>
                )}
              </Campo>
            )}
          />
          <Campo id="ativo-observacoes" rotulo="Observações">
            {(controle) => <Textarea {...controle} {...register('observacoes')} />}
          </Campo>
        </div>
      </PainelFormulario>
      <Confirmacao
        aberto={avisos !== null}
        aoFechar={() => setAvisos(null)}
        titulo="Salvar mesmo assim?"
        texto={avisos?.textos.join(' ')}
        rotuloConfirmar="Salvar mesmo assim"
        rotuloCancelar="Voltar e revisar"
        aoConfirmar={() => {
          const atual = avisos;
          setAvisos(null);
          if (atual) void gravar(atual.formulario);
        }}
      />
    </>
  );
}
