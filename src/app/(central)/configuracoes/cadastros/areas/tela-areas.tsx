'use client';

import { useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { Archive, ArchiveRestore, Layers, Pencil, Plus, TriangleAlert } from 'lucide-react';
import { Campo } from '@/componentes/campos/campo';
import { Pilulas } from '@/componentes/campos/pilulas';
import { Selecao } from '@/componentes/campos/selecao';
import { aviso } from '@/componentes/padroes/aviso';
import { CabecalhoPagina } from '@/componentes/padroes/cabecalho-pagina';
import { Confirmacao } from '@/componentes/padroes/confirmacao';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { EtiquetaSituacao } from '@/componentes/padroes/etiquetas';
import { Faixa } from '@/componentes/padroes/faixa';
import { Lista, type Coluna } from '@/componentes/padroes/lista';
import { JanelaFormulario, type ErroDeCampo } from '@/componentes/padroes/janela-formulario';
import { Pessoa as NomeDaPessoa } from '@/componentes/padroes/pessoa';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { ErroDeRegra, mensagemDoErro } from '@/dados/erros';
import type { Area } from '@/dados/tipos/area';
import { useConsulta } from '@/dados/use-consulta';
import {
  arquivarArea,
  carregarAreas,
  esquemaFormularioArea,
  formularioDaArea,
  FORMULARIO_AREA_VAZIO,
  MENSAGEM_NOME_REPETIDO,
  pessoasDaArea,
  pessoasParaArea,
  responsavelForaDaLista,
  restaurarArea,
  salvarArea,
  type DadosAreas,
  type FormularioArea,
} from '@/dominio/areas';
import { formatarNumero } from '@/lib/formatacao';
import { AbasConfiguracoes, SubabasCadastros } from '../../abas';

const SIM_NAO = [
  { valor: 'sim', rotulo: 'Sim' },
  { valor: 'nao', rotulo: 'Não' },
];

function juntarNomes(nomes: readonly string[]): string {
  return nomes.length > 1 ? `${nomes.slice(0, -1).join(', ')} e ${nomes.at(-1)}` : (nomes[0] ?? '');
}

function FormularioDaArea({ aberto, aoFechar, area, dados }: { aberto: boolean; aoFechar: () => void; area: Area | null; dados: DadosAreas }) {
  const { register, handleSubmit, control, reset, watch, setError, formState } = useForm<FormularioArea>({
    resolver: zodResolver(esquemaFormularioArea),
    defaultValues: FORMULARIO_AREA_VAZIO,
    mode: 'onTouched',
  });
  const { errors, isDirty, isSubmitting } = formState;
  const opcoes = useMemo(() => pessoasParaArea(dados.pessoas), [dados.pessoas]);
  const foraDaLista = area ? responsavelForaDaLista(area, dados.pessoas) : false;

  // O formulário começa do que está salvo a cada vez que abre, e não enquanto alguém digita.
  useEffect(() => {
    if (!aberto) return;
    reset(area ? { ...formularioDaArea(area), responsavel_padrao_id: foraDaLista ? '' : (area.responsavel_padrao_id ?? '') } : FORMULARIO_AREA_VAZIO);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a área muda quando os dados mudam em outra aba
  }, [aberto, area?.id, reset]);

  const compartilhada = watch('compartilhada');

  const erros: ErroDeCampo[] = [
    ...(errors.nome?.message ? [{ campoId: 'area-nome', mensagem: errors.nome.message }] : []),
    ...(errors.responsavel_padrao_id?.message ? [{ campoId: 'area-responsavel', mensagem: errors.responsavel_padrao_id.message }] : []),
  ];

  const enviar = handleSubmit(async (formulario) => {
    try {
      await salvarArea(formulario, area?.id);
      aviso(area ? 'Área atualizada.' : 'Área criada.');
      aoFechar();
    } catch (erro) {
      if (erro instanceof ErroDeRegra && erro.message === MENSAGEM_NOME_REPETIDO) {
        setError('nome', { message: MENSAGEM_NOME_REPETIDO }, { shouldFocus: true });
        return;
      }
      aviso(mensagemDoErro(erro));
    }
  });

  return (
    <JanelaFormulario aberto={aberto} aoFechar={aoFechar} titulo={area ? 'Editar área' : 'Nova área'} alterado={isDirty} aoEnviar={enviar} rotuloSalvar={area ? 'Salvar alterações' : 'Salvar'} salvando={isSubmitting} erros={erros}>
      <div className="grid grid-cols-1 gap-[18px]">
        <Campo id="area-nome" rotulo="Nome da área" obrigatorio erro={errors.nome?.message}>
          {(controle) => <Input autoComplete="off" {...controle} {...register('nome')} />}
        </Campo>
        <Controller
          control={control}
          name="compartilhada"
          render={({ field }) => <Pilulas rotulo="Compartilhada" obrigatorio valor={field.value ? 'sim' : 'nao'} aoMudar={(valor) => field.onChange(valor === 'sim')} opcoes={SIM_NAO} />}
        />
        {compartilhada ? (
          <Faixa>Em área compartilhada, a responsável principal é escolhida em cada registro.</Faixa>
        ) : (
          <>
            {foraDaLista && <Faixa tipo="atencao">A responsável padrão não está mais na lista. Escolha outra.</Faixa>}
            <Controller
              control={control}
              name="responsavel_padrao_id"
              render={({ field }) => (
                <Campo id="area-responsavel" rotulo="Responsável padrão" obrigatorio erro={errors.responsavel_padrao_id?.message} ajuda="É sugerida nos novos registros desta área.">
                  {(controle) => (
                    <Selecao {...controle} {...field}>
                      {!field.value && <option value="">Escolha uma pessoa</option>}
                      {opcoes.map((pessoa) => (
                        <option key={pessoa.id} value={pessoa.id}>
                          {pessoa.nome_completo}
                        </option>
                      ))}
                    </Selecao>
                  )}
                </Campo>
              )}
            />
          </>
        )}
      </div>
    </JanelaFormulario>
  );
}

type Painel = { aberto: boolean; area: Area | null };

/** T02.03: lista editável, sem ficha. As mudanças ficam no Histórico da aba Dados. */
export function TelaAreas() {
  const consulta = useConsulta(carregarAreas);
  const [painel, setPainel] = useState<Painel>({ aberto: false, area: null });
  const [verArquivadas, setVerArquivadas] = useState(false);
  const [arquivando, setArquivando] = useState<Area | null>(null);

  const dados = consulta.dados;
  const todas = dados?.areas;
  const linhas = useMemo(() => (todas ?? []).filter((area) => Boolean(area.arquivado_em) === verArquivadas), [todas, verArquivadas]);
  const arquivadas = useMemo(() => (todas ?? []).filter((area) => area.arquivado_em).length, [todas]);
  const ativas = (todas ?? []).length - arquivadas;

  const nomesDaArea = (area: Area) => (dados ? pessoasDaArea(area.id, dados.pessoas, dados.ligacoes).map((pessoa) => pessoa.nome_completo) : []);
  const usadaPor = arquivando ? nomesDaArea(arquivando) : [];

  function ResponsavelDaArea({ area }: { area: Area }) {
    const nome = dados?.pessoas.find((pessoa) => pessoa.id === area.responsavel_padrao_id)?.nome_completo;
    if (area.compartilhada) return <span className="text-ink-soft">—</span>;
    const fora = dados ? responsavelForaDaLista(area, dados.pessoas) : false;
    return (
      <span className="flex flex-wrap items-center gap-2">
        {nome && <NomeDaPessoa nome={nome} />}
        {(fora || !nome) && (
          <EtiquetaSituacao tipo="atencao" icone={TriangleAlert}>
            Escolha outra pessoa
          </EtiquetaSituacao>
        )}
      </span>
    );
  }

  const textoCompartilhada = (area: Area) => {
    if (!area.compartilhada) return 'Não';
    const nomes = nomesDaArea(area);
    return nomes.length ? `Sim (${juntarNomes(nomes)})` : 'Sim';
  };

  const colunas: readonly Coluna<Area>[] = [
    { id: 'area', titulo: 'Área', essencial: true, celula: (area) => <span className="font-medium">{area.nome}</span> },
    { id: 'responsavel', titulo: 'Responsável padrão', essencial: true, celula: (area) => <ResponsavelDaArea area={area} /> },
    { id: 'compartilhada', titulo: 'Compartilhada', essencial: true, celula: textoCompartilhada },
  ];

  async function executar(acao: () => Promise<void>, mensagem: string) {
    try {
      await acao();
      aviso(mensagem);
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    }
  }

  const acoes = (area: Area) =>
    area.arquivado_em ? (
      <Button variante="icone" tamanho="icone" aria-label={`Restaurar ${area.nome}`} onClick={() => void executar(() => restaurarArea(area.id), 'Área restaurada.')}>
        <ArchiveRestore aria-hidden />
      </Button>
    ) : (
      <span className="inline-flex">
        <Button variante="icone" tamanho="icone" aria-label={`Editar ${area.nome}`} onClick={() => setPainel({ aberto: true, area })}>
          <Pencil aria-hidden />
        </Button>
        <Button variante="icone" tamanho="icone" aria-label={`Arquivar ${area.nome}`} onClick={() => setArquivando(area)}>
          <Archive aria-hidden />
        </Button>
      </span>
    );

  return (
    <>
      <CabecalhoPagina
        migalhas={['Central Numa', 'Configurações', 'Cadastros base', 'Áreas']}
        kicker="Configurações"
        titulo="Áreas"
        resumo={todas ? `${formatarNumero(ativas)} ${ativas === 1 ? 'área' : 'áreas'}` : undefined}
        acoes={
          <Button onClick={() => setPainel({ aberto: true, area: null })} disabled={!dados}>
            <Plus aria-hidden />
            Nova área
          </Button>
        }
      />
      <AbasConfiguracoes ativa="cadastros" />
      <SubabasCadastros ativa="areas" />

      <div className="mt-5 space-y-4">
        {consulta.estado === 'carregando' && <EstadoCarregando />}
        {consulta.estado === 'erro' && <EstadoErro titulo="Não deu para ler as áreas." texto="Os dados deste navegador podem estar danificados. Importe um backup ou restaure os exemplos na aba Dados." aoTentarDeNovo={consulta.recarregar} />}
        {consulta.estado === 'pronto' && dados && (
          <>
            <div className="flex justify-end">
              <Button variante="terciario" tamanho="pequeno" aria-pressed={verArquivadas} onClick={() => setVerArquivadas((atual) => !atual)}>
                <Archive aria-hidden />
                {verArquivadas ? 'Voltar às áreas ativas' : `Arquivados (${formatarNumero(arquivadas)})`}
              </Button>
            </div>
            <Lista
              rotulo={verArquivadas ? 'Áreas arquivadas' : 'Áreas'}
              linhas={linhas}
              colunas={colunas}
              chave={(area) => area.id}
              acoesDaLinha={acoes}
              cartao={(area) => (
                <div className="flex items-start justify-between gap-2">
                  <div className="grid min-w-0 gap-1.5">
                    <p className="font-semibold">{area.nome}</p>
                    {!area.compartilhada && <ResponsavelDaArea area={area} />}
                    <p className="text-[13px] text-ink-soft">Compartilhada: {textoCompartilhada(area)}</p>
                  </div>
                  <div className="shrink-0">{acoes(area)}</div>
                </div>
              )}
              vazio={
                verArquivadas ? (
                  <EstadoVazio icone={Archive} titulo="Nenhuma área arquivada." texto="As áreas arquivadas aparecem aqui, e dá para restaurar quando precisar." />
                ) : (
                  <EstadoVazio icone={Layers} titulo="Nenhuma área ainda." texto="Que tal cadastrar a primeira?" acao={<Button onClick={() => setPainel({ aberto: true, area: null })}>Nova área</Button>} />
                )
              }
            />
            <FormularioDaArea aberto={painel.aberto} aoFechar={() => setPainel((atual) => ({ ...atual, aberto: false }))} area={painel.area} dados={dados} />
          </>
        )}
      </div>

      {usadaPor.length ? (
        <Confirmacao
          aberto={arquivando !== null}
          aoFechar={() => setArquivando(null)}
          titulo={`Não dá para arquivar ${arquivando?.nome ?? ''}`}
          texto={`Esta área está em uso: ${juntarNomes(usadaPor)} ${usadaPor.length === 1 ? 'atua' : 'atuam'} nela. Tire a área da ficha dessas pessoas antes de arquivar.`}
          rotuloConfirmar="Entendi"
          soInforma
          aoConfirmar={() => setArquivando(null)}
        />
      ) : (
        <Confirmacao
          aberto={arquivando !== null}
          aoFechar={() => setArquivando(null)}
          titulo={`Arquivar ${arquivando?.nome ?? ''}?`}
          texto="Ela sai das listas e dos seletores. Dá para restaurar quando precisar, em Arquivados."
          rotuloConfirmar="Arquivar área"
          perigo
          aoConfirmar={() => {
            const area = arquivando;
            setArquivando(null);
            if (area) void executar(() => arquivarArea(area.id), 'Área arquivada.');
          }}
        />
      )}
    </>
  );
}
