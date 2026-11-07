'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { CircleDot, FileStack, Layers, Plus } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { Campo } from '@/componentes/campos/campo';
import { Selecao } from '@/componentes/campos/selecao';
import { AbasLegal } from '@/componentes/f1/abas-modulos';
import { errosDoFormulario, paraOpcoes, seletorDeOpcoes } from '@/componentes/f1/apoio';
import { aviso } from '@/componentes/padroes/aviso';
import { CabecalhoPagina } from '@/componentes/padroes/cabecalho-pagina';
import { EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { EtiquetaSituacao, type TipoSituacao } from '@/componentes/padroes/etiquetas';
import { FiltrosEmLinha } from '@/componentes/padroes/filtros-em-linha';
import { JanelaFormulario } from '@/componentes/padroes/janela-formulario';
import { Lista, type Coluna } from '@/componentes/padroes/lista';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { mensagemDoErro } from '@/dados/erros';
import type { ModeloVersao } from '@/dados/tipos/legal';
import { useConsulta } from '@/dados/use-consulta';
import { carregarModelos, criarModelo, esquemaFormularioModelo, ROTULOS_FAMILIA, ROTULOS_SITUACAO_MODELO, ROTULOS_TIPO_DOCUMENTO, type FormularioModelo, type ModeloComVersoes } from '@/dominio/modelos';

const TIPOS: Readonly<Record<ModeloVersao['situacao'], TipoSituacao>> = { rascunho: 'neutro', validada: 'sucesso', obsoleta: 'neutro' };
export const SituacaoDoModelo = ({ situacao }: { situacao: ModeloVersao['situacao'] }) => <EtiquetaSituacao tipo={TIPOS[situacao]}>{ROTULOS_SITUACAO_MODELO[situacao]}</EtiquetaSituacao>;

function NovoModelo({ aoFechar }: { aoFechar: () => void }) {
  const roteador = useRouter();
  const { register, control, handleSubmit, formState } = useForm<FormularioModelo>({ resolver: zodResolver(esquemaFormularioModelo), defaultValues: { nome: '', tipo_documento: 'contrato', familia: '' }, mode: 'onTouched' });
  const { errors } = formState;
  const enviar = handleSubmit(async (formulario) => {
    try {
      const modelo = await criarModelo(formulario);
      aviso('Modelo criado em rascunho.');
      roteador.push(`/legal/modelos/${modelo.id}`);
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    }
  });
  return (
    <JanelaFormulario aberto aoFechar={aoFechar} titulo="Novo modelo" alterado={formState.isDirty} aoEnviar={enviar} salvando={formState.isSubmitting} rotuloSalvar="Criar rascunho" erros={errosDoFormulario(errors, { nome: 'mod-nome', tipo_documento: 'mod-tipo' })}>
      <div className="grid gap-[18px]">
        <Campo id="mod-nome" rotulo="Nome" obrigatorio erro={errors.nome?.message}>
          {(controle) => <Input {...controle} autoComplete="off" {...register('nome')} />}
        </Campo>
        <Controller
          control={control}
          name="tipo_documento"
          render={({ field }) => (
            <Campo id="mod-tipo" rotulo="Tipo de documento" obrigatorio erro={errors.tipo_documento?.message}>
              {(controle) => (
                <Selecao {...controle} {...field}>
                  {paraOpcoes(ROTULOS_TIPO_DOCUMENTO).map((opcao) => (
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
          name="familia"
          render={({ field }) => (
            <Campo id="mod-familia" rotulo="Família contratual">
              {(controle) => (
                <Selecao {...controle} {...field}>
                  <option value="">Qualquer família</option>
                  {paraOpcoes(ROTULOS_FAMILIA).map((opcao) => (
                    <option key={opcao.valor} value={opcao.valor}>
                      {opcao.rotulo}
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

type Filtros = { busca: string; tipo: string; situacao: string };
const INICIAIS: Filtros = { busca: '', tipo: '', situacao: '' };

/** T09.07, lista. `MOD-SAAS-LIC` vem da carga, em rascunho até o parecer jurídico. */
export function TelaModelos() {
  const roteador = useRouter();
  const consulta = useConsulta(carregarModelos);
  const modelos = consulta.dados;
  const [filtros, setFiltros] = useState<Filtros>(INICIAIS);
  const [novo, setNovo] = useState(false);
  const linhas = useMemo(() => {
    const termo = filtros.busca.trim().toLowerCase();
    return (modelos ?? []).filter((linha) => !linha.arquivado_em && (!filtros.tipo || linha.tipo_documento === filtros.tipo) && (!filtros.situacao || linha.atual?.situacao === filtros.situacao) && (!termo || `${linha.codigo} ${linha.nome}`.toLowerCase().includes(termo)));
  }, [modelos, filtros]);
  const opcoesTipo = paraOpcoes(ROTULOS_TIPO_DOCUMENTO);
  const opcoesSituacao = paraOpcoes(ROTULOS_SITUACAO_MODELO);
  const colunas: readonly Coluna<ModeloComVersoes>[] = [
    { id: 'nome', titulo: 'Nome', essencial: true, ordenar: (a, b) => a.nome.localeCompare(b.nome, 'pt-BR'), celula: (linha) => <span className="grid"><span className="font-medium">{linha.nome}</span><span className="text-xs text-ink-soft">{linha.codigo}</span></span> },
    { id: 'tipo', titulo: 'Tipo', essencial: true, celula: (linha) => ROTULOS_TIPO_DOCUMENTO[linha.tipo_documento] },
    { id: 'familia', titulo: 'Família', celula: (linha) => (linha.familia ? ROTULOS_FAMILIA[linha.familia] : 'Qualquer') },
    { id: 'versao', titulo: 'Versão', celula: (linha) => (linha.atual ? `v${linha.atual.rotulo_versao}` : '—') },
    { id: 'situacao', titulo: 'Situação', essencial: true, celula: (linha) => (linha.atual ? <SituacaoDoModelo situacao={linha.atual.situacao} /> : '—') },
    { id: 'variaveis', titulo: 'Variáveis', numerica: true, celula: (linha) => linha.obrigatorias },
  ];
  return (
    <>
      <CabecalhoPagina
        kicker="Legal e privacidade"
        titulo="Modelos de documentos"
        resumo="Modelo comum: produto, plano e cliente fornecem os dados."
        acoes={
          <Button disabled={!modelos} onClick={() => setNovo(true)}>
            <Plus aria-hidden />
            Novo modelo
          </Button>
        }
      />
      <AbasLegal ativa="modelos" sub="modelos" />
      <div className="mt-5 space-y-4">
        {consulta.estado === 'erro' && <EstadoErro titulo="Não deu para ler os modelos." aoTentarDeNovo={consulta.recarregar} />}
        <FiltrosEmLinha
          filtros={filtros}
          aoMudar={(parcial) => setFiltros((atuais) => ({ ...atuais, ...parcial }))}
          aoLimpar={() => setFiltros(INICIAIS)}
          rotuloBusca="Buscar modelos"
          seletores={[seletorDeOpcoes<Filtros>({ id: 'tipo', rotulo: 'Tipo', icone: Layers, campo: 'tipo', opcoes: opcoesTipo }), seletorDeOpcoes<Filtros>({ id: 'situacao', rotulo: 'Situação', icone: CircleDot, campo: 'situacao', opcoes: opcoesSituacao, todos: 'Todas' })]}
          avancados={() => null}
          quantosAvancados={() => 0}
          ativos={[...(filtros.tipo ? [{ id: 'tipo', rotulo: `Tipo: ${opcoesTipo.find((opcao) => opcao.valor === filtros.tipo)?.rotulo ?? ''}` }] : []), ...(filtros.situacao ? [{ id: 'situacao', rotulo: `Situação: ${opcoesSituacao.find((opcao) => opcao.valor === filtros.situacao)?.rotulo ?? ''}` }] : [])]}
          aoRemoverAtivo={(id) => setFiltros((atuais) => ({ ...atuais, [id]: '' }))}
        />
        <Lista
          rotulo="Modelos de documentos"
          linhas={linhas}
          colunas={colunas}
          chave={(linha) => linha.id}
          estado={consulta.estado === 'carregando' ? 'carregando' : 'pronto'}
          filtrando={Boolean(filtros.busca.trim() || filtros.tipo || filtros.situacao)}
          aoLimparFiltros={() => setFiltros(INICIAIS)}
          aoAbrir={(linha) => roteador.push(`/legal/modelos/${linha.id}`)}
          cartao={(linha) => (
            <span className="grid gap-1">
              <span className="font-semibold">{linha.nome}</span>
              <span className="text-[13px] text-ink-soft">
                {linha.codigo} · {ROTULOS_TIPO_DOCUMENTO[linha.tipo_documento]}
              </span>
              {linha.atual && <SituacaoDoModelo situacao={linha.atual.situacao} />}
            </span>
          )}
          vazio={<EstadoVazio icone={FileStack} titulo="Nenhum modelo ainda." texto="Monte a estrutura de contratos e propostas a partir de cláusulas e blocos." acao={<Button onClick={() => setNovo(true)}>Novo modelo</Button>} />}
        />
      </div>
      {novo && <NovoModelo aoFechar={() => setNovo(false)} />}
    </>
  );
}
