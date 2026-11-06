'use client';

import { useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { Archive, ArchiveRestore, Merge, Pencil, Plus, Tag } from 'lucide-react';
import { Campo, MensagemErro } from '@/componentes/campos/campo';
import { EntradaCor } from '@/componentes/campos/cor';
import { Pilulas, PilulasMultiplas } from '@/componentes/campos/pilulas';
import { Selecao } from '@/componentes/campos/selecao';
import { aviso } from '@/componentes/padroes/aviso';
import { CabecalhoPagina } from '@/componentes/padroes/cabecalho-pagina';
import { Confirmacao } from '@/componentes/padroes/confirmacao';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { EtiquetaColorida } from '@/componentes/padroes/etiquetas';
import { BarraFiltros } from '@/componentes/padroes/filtros';
import { Lista, type Coluna } from '@/componentes/padroes/lista';
import { PainelFormulario, type ErroDeCampo } from '@/componentes/padroes/painel-formulario';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { mensagemDoErro } from '@/dados/erros';
import type { Etiqueta } from '@/dados/tipos/etiqueta';
import { useConsulta } from '@/dados/use-consulta';
import {
  arquivarEtiqueta,
  carregarEtiquetas,
  conferirNomeDaEtiqueta,
  esquemaFormularioEtiqueta,
  filtrarEtiquetas,
  formularioDaEtiqueta,
  FORMULARIO_ETIQUETA_VAZIO,
  mesclarEtiquetas,
  restaurarEtiqueta,
  rotuloDosModulos,
  ROTULOS_MODULO_ETIQUETA,
  salvarEtiqueta,
  usosDaEtiqueta,
  type FormularioEtiqueta,
} from '@/dominio/etiquetas';
import { formatarNumero } from '@/lib/formatacao';
import { AbasConfiguracoes, SubabasCadastros } from '../../abas';

const OPCOES_MODULO = Object.entries(ROTULOS_MODULO_ETIQUETA).map(([valor, rotulo]) => ({ valor, rotulo }));
const plural = (quantidade: number, um: string, varios: string) => `${formatarNumero(quantidade)} ${quantidade === 1 ? um : varios}`;

function FormularioDaEtiqueta({ aberto, aoFechar, etiqueta }: { aberto: boolean; aoFechar: () => void; etiqueta: Etiqueta | null }) {
  const { register, handleSubmit, control, reset, watch, setError, formState } = useForm<FormularioEtiqueta>({
    resolver: zodResolver(esquemaFormularioEtiqueta),
    defaultValues: FORMULARIO_ETIQUETA_VAZIO,
    mode: 'onTouched',
  });
  const { errors, isDirty, isSubmitting } = formState;

  // O formulário começa do que está salvo a cada vez que abre, e não enquanto alguém digita.
  useEffect(() => {
    if (aberto) reset(etiqueta ? formularioDaEtiqueta(etiqueta) : FORMULARIO_ETIQUETA_VAZIO);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a etiqueta muda quando alguém mexe em outra aba
  }, [aberto, etiqueta?.id, reset]);

  const escopo = watch('escopo');

  const erros: ErroDeCampo[] = [
    ['etiqueta-nome', errors.nome?.message],
    ['etiqueta-cor', errors.cor?.message],
    ['etiqueta-modulos', errors.modulos?.message],
  ].flatMap(([campoId, mensagem]) => (mensagem ? [{ campoId: campoId as string, mensagem }] : []));

  const enviar = handleSubmit(async (formulario) => {
    const erroNome = await conferirNomeDaEtiqueta(formulario.nome, etiqueta?.id);
    if (erroNome) {
      setError('nome', { message: erroNome }, { shouldFocus: true });
      return;
    }
    try {
      await salvarEtiqueta(formulario, etiqueta?.id);
      aviso(etiqueta ? 'Etiqueta atualizada.' : 'Etiqueta criada.');
      aoFechar();
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    }
  });

  return (
    <PainelFormulario aberto={aberto} aoFechar={aoFechar} titulo={etiqueta ? 'Editar etiqueta' : 'Nova etiqueta'} alterado={isDirty} aoEnviar={enviar} rotuloSalvar={etiqueta ? 'Salvar alterações' : 'Salvar'} salvando={isSubmitting} erros={erros}>
      <div className="grid grid-cols-1 gap-[18px]">
        <Campo id="etiqueta-nome" rotulo="Nome" obrigatorio erro={errors.nome?.message}>
          {(controle) => <Input autoComplete="off" {...controle} {...register('nome')} />}
        </Campo>
        <Controller
          control={control}
          name="cor"
          render={({ field }) => (
            <Campo id="etiqueta-cor" rotulo="Cor" erro={errors.cor?.message} ajuda="Se ficar vazia, a etiqueta fica neutra.">
              {(controle) => <EntradaCor {...controle} valor={field.value} aoMudar={field.onChange} onBlur={field.onBlur} />}
            </Campo>
          )}
        />
        <Controller
          control={control}
          name="escopo"
          render={({ field }) => (
            <Pilulas
              rotulo="Onde pode ser usada"
              valor={field.value}
              aoMudar={field.onChange}
              opcoes={[
                { valor: 'todos', rotulo: 'Todos os módulos' },
                { valor: 'alguns', rotulo: 'Só alguns' },
              ]}
            />
          )}
        />
        {escopo === 'alguns' && (
          <div id="etiqueta-modulos" tabIndex={-1}>
            <Controller
              control={control}
              name="modulos"
              render={({ field }) => <PilulasMultiplas rotulo="Módulos" obrigatorio valores={field.value} aoMudar={field.onChange} opcoes={OPCOES_MODULO} />}
            />
            {errors.modulos?.message && <MensagemErro>{errors.modulos.message}</MensagemErro>}
          </div>
        )}
      </div>
    </PainelFormulario>
  );
}

/** T02.10: etiquetas livres, para filtros e buscas. Os módulos passam a usá-las a partir da T03. */
export function TelaEtiquetas() {
  const consulta = useConsulta(carregarEtiquetas);
  const [busca, setBusca] = useState('');
  const [verArquivadas, setVerArquivadas] = useState(false);
  const [painel, setPainel] = useState<{ aberto: boolean; etiqueta: Etiqueta | null }>({ aberto: false, etiqueta: null });
  const [arquivando, setArquivando] = useState<Etiqueta | null>(null);
  const [mesclando, setMesclando] = useState<{ origem: Etiqueta; destino: string } | null>(null);

  const dados = consulta.dados;
  const etiquetas = dados?.etiquetas;
  const vinculos = useMemo(() => dados?.vinculos ?? [], [dados]);
  const linhas = useMemo(() => filtrarEtiquetas(etiquetas ?? [], busca, verArquivadas), [etiquetas, busca, verArquivadas]);
  const vivas = useMemo(() => filtrarEtiquetas(etiquetas ?? [], '', false), [etiquetas]);
  const arquivadas = (etiquetas ?? []).length - vivas.length;
  const usosDeArquivando = arquivando ? usosDaEtiqueta(arquivando.id, vinculos) : 0;
  const destinos = vivas.filter((etiqueta) => etiqueta.id !== mesclando?.origem.id);

  async function executar(acao: () => Promise<unknown>, mensagem: string) {
    try {
      await acao();
      aviso(mensagem);
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    }
  }

  const mesclar = () => {
    const pendente = mesclando;
    setMesclando(null);
    if (pendente) void executar(() => mesclarEtiquetas(pendente.origem.id, pendente.destino), 'Etiquetas mescladas.');
  };

  const acoes = (etiqueta: Etiqueta) =>
    etiqueta.arquivado_em ? (
      <Button variante="icone" tamanho="icone" aria-label={`Restaurar ${etiqueta.nome}`} onClick={() => void executar(() => restaurarEtiqueta(etiqueta.id), 'Etiqueta restaurada.')}>
        <ArchiveRestore aria-hidden />
      </Button>
    ) : (
      <span className="inline-flex">
        <Button variante="icone" tamanho="icone" aria-label={`Editar ${etiqueta.nome}`} onClick={() => setPainel({ aberto: true, etiqueta })}>
          <Pencil aria-hidden />
        </Button>
        {vivas.length > 1 && (
          <Button variante="icone" tamanho="icone" aria-label={`Mesclar ${etiqueta.nome}`} onClick={() => setMesclando({ origem: etiqueta, destino: vivas.find((outra) => outra.id !== etiqueta.id)?.id ?? '' })}>
            <Merge aria-hidden />
          </Button>
        )}
        <Button variante="icone" tamanho="icone" aria-label={`Arquivar ${etiqueta.nome}`} onClick={() => setArquivando(etiqueta)}>
          <Archive aria-hidden />
        </Button>
      </span>
    );

  const colunas: readonly Coluna<Etiqueta>[] = [
    { id: 'nome', titulo: 'Etiqueta', essencial: true, celula: (etiqueta) => <EtiquetaColorida nome={etiqueta.nome} cor={etiqueta.cor} /> },
    { id: 'modulos', titulo: 'Onde pode ser usada', essencial: true, celula: (etiqueta) => rotuloDosModulos(etiqueta.modulos) },
    { id: 'usos', titulo: 'Registros', essencial: true, numerica: true, celula: (etiqueta) => formatarNumero(usosDaEtiqueta(etiqueta.id, vinculos)) },
  ];

  return (
    <>
      <CabecalhoPagina
        migalhas={['Central Numa', 'Configurações', 'Cadastros base', 'Etiquetas']}
        kicker="Configurações"
        titulo="Etiquetas"
        resumo={etiquetas ? plural(vivas.length, 'etiqueta', 'etiquetas') : undefined}
        acoes={
          <Button onClick={() => setPainel({ aberto: true, etiqueta: null })} disabled={!dados}>
            <Plus aria-hidden />
            Nova etiqueta
          </Button>
        }
      />
      <AbasConfiguracoes ativa="cadastros" />
      <SubabasCadastros ativa="etiquetas" />

      <div className="mt-5 space-y-4">
        {consulta.estado === 'carregando' && <EstadoCarregando />}
        {consulta.estado === 'erro' && <EstadoErro titulo="Não deu para ler as etiquetas." texto="Os dados deste navegador podem estar danificados. Importe um backup ou restaure os exemplos na aba Dados." aoTentarDeNovo={consulta.recarregar} />}
        {consulta.estado === 'pronto' && dados && (
          <>
            <BarraFiltros busca={busca} aoBuscar={setBusca} rotuloBusca="Buscar por nome" />
            <div className="flex justify-end">
              <Button variante="terciario" tamanho="pequeno" aria-pressed={verArquivadas} onClick={() => setVerArquivadas((atual) => !atual)}>
                <Archive aria-hidden />
                {verArquivadas ? 'Voltar às etiquetas ativas' : `Arquivados (${formatarNumero(arquivadas)})`}
              </Button>
            </div>
            <Lista
              rotulo={verArquivadas ? 'Etiquetas arquivadas' : 'Etiquetas'}
              linhas={linhas}
              colunas={colunas}
              chave={(etiqueta) => etiqueta.id}
              acoesDaLinha={acoes}
              filtrando={Boolean(busca.trim())}
              aoLimparFiltros={() => setBusca('')}
              cartao={(etiqueta) => (
                <div className="flex items-start justify-between gap-2">
                  <div className="grid min-w-0 gap-1.5">
                    <span>
                      <EtiquetaColorida nome={etiqueta.nome} cor={etiqueta.cor} />
                    </span>
                    <p className="text-[13px] text-ink-soft">{rotuloDosModulos(etiqueta.modulos)}</p>
                    <p className="text-[13px] text-ink-soft">{plural(usosDaEtiqueta(etiqueta.id, vinculos), 'registro', 'registros')}</p>
                  </div>
                  <div className="shrink-0">{acoes(etiqueta)}</div>
                </div>
              )}
              vazio={
                verArquivadas ? (
                  <EstadoVazio icone={Archive} titulo="Nenhuma etiqueta arquivada." texto="As arquivadas e as mescladas aparecem aqui, e dá para restaurar quando precisar." />
                ) : (
                  <EstadoVazio icone={Tag} titulo="Nenhuma etiqueta ainda." texto="Etiquetas são livres e servem a filtros e buscas." acao={<Button onClick={() => setPainel({ aberto: true, etiqueta: null })}>Nova etiqueta</Button>} />
                )
              }
            />
            <FormularioDaEtiqueta aberto={painel.aberto} aoFechar={() => setPainel((atual) => ({ ...atual, aberto: false }))} etiqueta={painel.etiqueta} />
          </>
        )}
      </div>

      <Confirmacao
        aberto={mesclando !== null}
        aoFechar={() => setMesclando(null)}
        titulo={`Mesclar ${mesclando?.origem.nome ?? ''}`}
        texto={
          mesclando && (
            <div className="grid gap-3">
              <p>
                {plural(usosDaEtiqueta(mesclando.origem.id, vinculos), 'registro passa', 'registros passam')} para a etiqueta escolhida, sem repetir. {mesclando.origem.nome} vai para Arquivados.
              </p>
              <Campo rotulo="Mesclar em" id="mesclar-destino">
                {(controle) => (
                  <Selecao {...controle} value={mesclando.destino} onChange={(evento) => setMesclando({ ...mesclando, destino: evento.target.value })}>
                    {destinos.map((etiqueta) => (
                      <option key={etiqueta.id} value={etiqueta.id}>
                        {etiqueta.nome}
                      </option>
                    ))}
                  </Selecao>
                )}
              </Campo>
            </div>
          )
        }
        rotuloConfirmar="Mesclar etiquetas"
        aoConfirmar={mesclar}
      />
      {usosDeArquivando > 0 ? (
        <Confirmacao
          aberto
          aoFechar={() => setArquivando(null)}
          titulo={`Não dá para arquivar ${arquivando?.nome ?? ''}`}
          texto={`Esta etiqueta está em ${plural(usosDeArquivando, 'registro', 'registros')}. Mescle com outra para não perder os vínculos.`}
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
          rotuloConfirmar="Arquivar etiqueta"
          perigo
          aoConfirmar={() => {
            const alvo = arquivando;
            setArquivando(null);
            if (alvo) void executar(() => arquivarEtiqueta(alvo.id), 'Etiqueta arquivada.');
          }}
        />
      )}
    </>
  );
}
