'use client';

import { useEffect, useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { Campo } from '@/componentes/campos/campo';
import { Selecao } from '@/componentes/campos/selecao';
import { SelecaoPessoa } from '@/componentes/campos/selecao-pessoa';
import { SeletorContraparte } from '@/componentes/campos/seletor-contraparte';
import { useNovaContraparte } from '@/componentes/contrapartes/nova-contraparte';
import { errosDoFormulario, paraOpcoes } from '@/componentes/f1/apoio';
import { useAvisoDeCredencial } from '@/componentes/produtos/aviso-credencial-m07';
import { aviso } from '@/componentes/padroes/aviso';
import { JanelaFormulario } from '@/componentes/padroes/janela-formulario';
import { Input } from '@/componentes/ui/input';
import { Textarea } from '@/componentes/ui/textarea';
import { mensagemDoErro } from '@/dados/erros';
import type { Contraparte } from '@/dados/tipos/contraparte';
import type { Produto } from '@/dados/tipos/marca';
import type { Pessoa } from '@/dados/tipos/pessoa';
import { useConsulta } from '@/dados/use-consulta';
import { pessoasDoSeletor } from '@/dominio/pessoa-atual';
import { ROTULOS_PRIORIDADE } from '@/dominio/sla';
import { abrirSolicitacao, contratosDaContraparte, contratoSugerido, esquemaFormularioSolicitacao, formularioSolicitacaoVazio, ROTULOS_CANAL_SUPORTE, ROTULOS_TIPO_SUPORTE, type FormularioSolicitacao } from '@/dominio/suporte';

const IDS = { contraparte_id: 'sup-contraparte', solicitante_texto: 'sup-solicitante', produto_id: 'sup-produto', tipo: 'sup-tipo', prioridade: 'sup-prioridade', titulo: 'sup-titulo', responsavel_id: 'sup-responsavel' } as const;

/** T12.03, formulário: contraparte ou solicitante sem cadastro, produto, contrato sugerido, tipo e prioridade. */
export function JanelaNovaSolicitacao({ produtos, pessoas, contrapartes, responsavelInicial, aoFechar, aoCriar }: { produtos: readonly Produto[]; pessoas: readonly Pessoa[]; contrapartes: readonly Contraparte[]; responsavelInicial: string; aoFechar: () => void; aoCriar: (id: string) => void }) {
  const { abrirNovaContraparte } = useNovaContraparte();
  const credencial = useAvisoDeCredencial();
  const formulario = useForm<FormularioSolicitacao>({ resolver: zodResolver(esquemaFormularioSolicitacao), defaultValues: formularioSolicitacaoVazio(responsavelInicial), mode: 'onTouched' });
  const { register, control, handleSubmit, formState, watch, setValue } = formulario;
  const { errors } = formState;
  const contraparte = watch('contraparte_id');
  const produto = watch('produto_id');
  const tipo = watch('tipo');
  const contratos = useConsulta(() => contratosDaContraparte(contraparte, produto), [contraparte, produto]);
  const contatos = pessoas.filter((pessoa) => pessoa.contraparte_id && pessoa.contraparte_id === contraparte && !pessoa.arquivado_em);
  const internas = useMemo(() => pessoasDoSeletor(pessoas), [pessoas]);

  useEffect(() => {
    // O contrato vem sugerido pela contraparte e pelo produto; sem um só, fica em branco.
    let vivo = true;
    void contratoSugerido(contraparte, produto).then((sugerido) => vivo && setValue('contrato_id', sugerido, { shouldDirty: true }));
    return () => {
      vivo = false;
    };
  }, [contraparte, produto, setValue]);

  const enviar = handleSubmit(async (valores) => {
    if (!credencial.conferir([valores.titulo, valores.descricao, valores.solicitante_texto])) return;
    try {
      const salva = await abrirSolicitacao(valores);
      aviso(`Solicitação ${salva.codigo} aberta${salva.sla ? '' : ', sem SLA'}.`);
      aoCriar(salva.id);
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    }
  });
  const opcoes = (rotulos: Readonly<Record<string, string>>) => paraOpcoes(rotulos).map((opcao) => <option key={opcao.valor} value={opcao.valor}>{opcao.rotulo}</option>);
  return (
    <JanelaFormulario colunas={2} aberto aoFechar={aoFechar} titulo="Nova solicitação de suporte" descricao="O prazo do SLA é calculado agora, na abertura, e não muda se a regra mudar depois." alterado={formState.isDirty} aoEnviar={enviar} salvando={formState.isSubmitting} rotuloSalvar="Abrir solicitação" erros={errosDoFormulario(errors, IDS)}>
      <div className="grid grid-cols-1 gap-[18px]">
        {credencial.faixa}
        <Controller control={control} name="contraparte_id" render={({ field }) => (
          <Campo id={IDS.contraparte_id} rotulo="Contraparte" ajuda="Opcional: usuário final sem cadastro entra com nome e contato.">
            {(controle) => <SeletorContraparte {...controle} valor={field.value} aoMudar={field.onChange} contrapartes={contrapartes} aoCriar={() => abrirNovaContraparte()} />}
          </Campo>
        )} />
        {!contraparte && (
          <Campo id={IDS.solicitante_texto} rotulo="Quem pediu (nome e contato)" obrigatorio erro={errors.solicitante_texto?.message}>
            {(controle) => <Input {...controle} autoComplete="off" placeholder="Maria, maria@exemplo.com" {...register('solicitante_texto')} />}
          </Campo>
        )}
        {contatos.length > 0 && (
          <Campo id="sup-contato" rotulo="Contato">
            {(controle) => (
              <Selecao {...controle} {...register('contato_pessoa_id')}>
                <option value="">Sem contato</option>
                {contatos.map((pessoa) => <option key={pessoa.id} value={pessoa.id}>{pessoa.nome_completo}</option>)}
              </Selecao>
            )}
          </Campo>
        )}
        <Campo id={IDS.produto_id} rotulo="Produto" obrigatorio erro={errors.produto_id?.message}>
          {(controle) => (
            <Selecao {...controle} {...register('produto_id')}>
              <option value="">Escolha</option>
              {produtos.filter((linha) => !linha.arquivado_em).map((linha) => <option key={linha.id} value={linha.id}>{linha.nome}</option>)}
            </Selecao>
          )}
        </Campo>
        <Campo id="sup-contrato" rotulo="Contrato" ajuda={contraparte ? 'Sugerido pela contraparte e pelo produto. O SLA de exceção do contrato vem primeiro.' : 'Sem contraparte, vale o SLA padrão da oferta, se houver um só.'}>
          {(controle) => (
            <Selecao {...controle} disabled={!contraparte} {...register('contrato_id')}>
              <option value="">Sem contrato</option>
              {(contratos.dados ?? []).map((contrato) => <option key={contrato.id} value={contrato.id}>{contrato.codigo} · {contrato.titulo}</option>)}
            </Selecao>
          )}
        </Campo>
        <Campo id={IDS.tipo} rotulo="Tipo" obrigatorio ajuda={tipo === 'novo_escopo' ? 'Novo escopo não é atendido como suporte: fica “Aguardando proposta”, e a ficha oferece criar a oportunidade.' : undefined}>
          {(controle) => <Selecao {...controle} {...register('tipo')}>{opcoes(ROTULOS_TIPO_SUPORTE)}</Selecao>}
        </Campo>
        <Campo id={IDS.prioridade} rotulo="Prioridade" obrigatorio>
          {(controle) => <Selecao {...controle} {...register('prioridade')}>{opcoes(ROTULOS_PRIORIDADE)}</Selecao>}
        </Campo>
        <Campo id="sup-canal" rotulo="Canal">
          {(controle) => (
            <Selecao {...controle} {...register('canal')}>
              <option value="">Não informado</option>
              {opcoes(ROTULOS_CANAL_SUPORTE)}
            </Selecao>
          )}
        </Campo>
        <Controller control={control} name="responsavel_id" render={({ field }) => (
          <Campo id={IDS.responsavel_id} rotulo="Responsável" obrigatorio erro={errors.responsavel_id?.message}>
            {(controle) => <SelecaoPessoa {...controle} {...field} pessoas={internas} vazio="Escolha" />}
          </Campo>
        )} />
        <Campo id={IDS.titulo} rotulo="Título" obrigatorio erro={errors.titulo?.message} className="md:col-span-2">
          {(controle) => <Input {...controle} autoComplete="off" {...register('titulo')} />}
        </Campo>
        <Campo id="sup-descricao" rotulo="Descrição" className="md:col-span-2" ajuda="Sem senhas nem tokens: a Central não guarda segredos.">
          {(controle) => <Textarea {...controle} rows={3} {...register('descricao')} />}
        </Campo>
      </div>
    </JanelaFormulario>
  );
}
