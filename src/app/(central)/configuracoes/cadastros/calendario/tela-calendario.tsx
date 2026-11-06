'use client';

import { useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { CalendarDays, CalendarPlus, Pencil, Plus, Trash2 } from 'lucide-react';
import { Campo } from '@/componentes/campos/campo';
import { Pilulas } from '@/componentes/campos/pilulas';
import { Selecao } from '@/componentes/campos/selecao';
import { aviso } from '@/componentes/padroes/aviso';
import { CabecalhoPagina } from '@/componentes/padroes/cabecalho-pagina';
import { Confirmacao } from '@/componentes/padroes/confirmacao';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { EtiquetaLivre } from '@/componentes/padroes/etiquetas';
import { BarraFiltros } from '@/componentes/padroes/filtros';
import { Lista, type Coluna } from '@/componentes/padroes/lista';
import { PainelFormulario, type ErroDeCampo } from '@/componentes/padroes/painel-formulario';
import { Previa } from '@/componentes/padroes/previa';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { mensagemDoErro } from '@/dados/erros';
import { municipiosDaUf } from '@/dados/referencia/municipios';
import type { Feriado } from '@/dados/tipos/calendario';
import { useConsulta } from '@/dados/use-consulta';
import {
  anoAtual,
  anosDoCalendario,
  carregarFeriadosDoAno,
  carregarTelaFeriados,
  diaDaSemana,
  esquemaFormularioFeriado,
  feriadoRepetido,
  filtrarFeriados,
  formularioDoFeriado,
  formularioFeriadoVazio,
  localDoFeriado,
  MENSAGEM_FERIADO_REPETIDO,
  previaDoAno,
  removerFeriado,
  ROTULOS_ABRANGENCIA,
  salvarFeriado,
  type DadosFeriados,
  type FiltrosFeriados,
  type FormularioFeriado,
} from '@/dominio/feriados';
import { formatarDiaISO, formatarNumero } from '@/lib/formatacao';
import { AbasConfiguracoes, SubabasCadastros } from '../../abas';

const OPCOES_ABRANGENCIA = Object.entries(ROTULOS_ABRANGENCIA).map(([valor, rotulo]) => ({ valor, rotulo }));

function FormularioDoFeriado({ aberto, aoFechar, feriado, dados, aoSalvar }: { aberto: boolean; aoFechar: () => void; feriado: Feriado | null; dados: DadosFeriados; aoSalvar: (feriado: Feriado) => void }) {
  const { register, handleSubmit, control, reset, watch, setError, setValue, formState } = useForm<FormularioFeriado>({
    resolver: zodResolver(esquemaFormularioFeriado),
    defaultValues: formularioFeriadoVazio(dados.local),
    mode: 'onTouched',
  });
  const { errors, isDirty, isSubmitting } = formState;

  // O formulário começa do que está salvo a cada vez que abre, e não enquanto alguém digita.
  useEffect(() => {
    if (aberto) reset(feriado ? formularioDoFeriado(feriado, dados.local) : formularioFeriadoVazio(dados.local));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- os dados mudam quando alguém mexe em outra aba
  }, [aberto, feriado?.id, reset]);

  const abrangencia = watch('abrangencia');
  const uf = watch('uf');
  const municipio = watch('municipio');
  const listaDeMunicipios = useMemo(() => {
    const lista = municipiosDaUf(dados.municipios, uf);
    return municipio && !lista.includes(municipio) ? [municipio, ...lista] : lista;
  }, [dados.municipios, uf, municipio]);

  const erros: ErroDeCampo[] = [
    ['feriado-data', errors.data?.message],
    ['feriado-nome', errors.nome?.message],
    ['feriado-uf', errors.uf?.message],
    ['feriado-municipio', errors.municipio?.message],
  ].flatMap(([campoId, mensagem]) => (mensagem ? [{ campoId: campoId as string, mensagem }] : []));

  const enviar = handleSubmit(async (formulario) => {
    if (await feriadoRepetido(formulario, feriado?.id)) {
      setError('nome', { message: MENSAGEM_FERIADO_REPETIDO }, { shouldFocus: true });
      return;
    }
    try {
      const salvo = await salvarFeriado(formulario, feriado?.id);
      aviso(feriado ? 'Feriado atualizado.' : 'Feriado criado.');
      aoSalvar(salvo);
      aoFechar();
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    }
  });

  return (
    <PainelFormulario aberto={aberto} aoFechar={aoFechar} titulo={feriado ? 'Editar feriado' : 'Novo feriado'} alterado={isDirty} aoEnviar={enviar} rotuloSalvar={feriado ? 'Salvar alterações' : 'Salvar'} salvando={isSubmitting} erros={erros}>
      <div className="grid grid-cols-1 gap-[18px]">
        <Campo id="feriado-data" rotulo="Data" obrigatorio erro={errors.data?.message}>
          {(controle) => <Input type="date" {...controle} {...register('data')} />}
        </Campo>
        <Campo id="feriado-nome" rotulo="Nome" obrigatorio erro={errors.nome?.message}>
          {(controle) => <Input autoComplete="off" {...controle} {...register('nome')} />}
        </Campo>
        <Controller
          control={control}
          name="abrangencia"
          render={({ field }) => <Pilulas rotulo="Abrangência" obrigatorio valor={field.value} aoMudar={field.onChange} opcoes={OPCOES_ABRANGENCIA} />}
        />
        {abrangencia !== 'nacional' && (
          <Controller
            control={control}
            name="uf"
            render={({ field }) => (
              <Campo id="feriado-uf" rotulo="Estado" obrigatorio erro={errors.uf?.message}>
                {(controle) => (
                  <Selecao
                    {...controle}
                    {...field}
                    onChange={(evento) => {
                      field.onChange(evento);
                      setValue('municipio', '', { shouldDirty: true });
                    }}
                  >
                    {!field.value && <option value="">Escolha o estado</option>}
                    {dados.municipios.ufs.map((estado) => (
                      <option key={estado.sigla} value={estado.sigla}>
                        {estado.nome} · {estado.sigla}
                      </option>
                    ))}
                  </Selecao>
                )}
              </Campo>
            )}
          />
        )}
        {abrangencia === 'municipal' && (
          <Controller
            control={control}
            name="municipio"
            render={({ field }) => (
              <Campo id="feriado-municipio" rotulo="Município" obrigatorio erro={errors.municipio?.message}>
                {(controle) => (
                  <Selecao {...controle} {...field}>
                    {!field.value && <option value="">Escolha o município</option>}
                    {listaDeMunicipios.map((nome) => (
                      <option key={nome} value={nome}>
                        {nome}
                      </option>
                    ))}
                  </Selecao>
                )}
              </Campo>
            )}
          />
        )}
      </div>
    </PainelFormulario>
  );
}

const plural = (quantidade: number) => `${formatarNumero(quantidade)} ${quantidade === 1 ? 'feriado' : 'feriados'}`;

/** T02.09: feriados por ano. A base dos dias úteis (M11 e M12) e do aviso de vencimento (M05). */
export function TelaCalendario() {
  const consulta = useConsulta(carregarTelaFeriados);
  const [filtros, setFiltros] = useState<FiltrosFeriados>(() => ({ ano: anoAtual(), abrangencia: 'todas' }));
  const [painel, setPainel] = useState<{ aberto: boolean; feriado: Feriado | null }>({ aberto: false, feriado: null });
  const [removendo, setRemovendo] = useState<Feriado | null>(null);
  const [carregando, setCarregando] = useState(false);

  const dados = consulta.dados;
  const feriados = dados?.feriados;
  const { ano, abrangencia } = filtros;
  const anos = useMemo(() => anosDoCalendario(feriados ?? [], anoAtual()), [feriados]);
  const visiveis = useMemo(() => filtrarFeriados(feriados ?? [], filtros), [feriados, filtros]);
  const doAno = useMemo(() => filtrarFeriados(feriados ?? [], { ano, abrangencia: 'todas' }), [feriados, ano]);
  const de = (tipo: Feriado['abrangencia']) => doAno.filter((feriado) => feriado.abrangencia === tipo).length;
  const previa = useMemo(() => (dados ? previaDoAno(ano, dados.feriados, dados.local) : []), [dados, ano]);
  const novos = previa.filter((linha) => !linha.jaCadastrado);

  const mudar = (parcial: Partial<FiltrosFeriados>) => setFiltros((atuais) => ({ ...atuais, ...parcial }));

  async function carregarAno() {
    if (!dados) return;
    setCarregando(false);
    try {
      const quantos = await carregarFeriadosDoAno(ano, dados.local);
      aviso(`${plural(quantos)} de ${ano} ${quantos === 1 ? 'carregado' : 'carregados'}.`);
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    }
  }

  async function remover() {
    const alvo = removendo;
    setRemovendo(null);
    if (!alvo) return;
    try {
      await removerFeriado(alvo.id);
      aviso('Feriado removido.');
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    }
  }

  const acoes = (feriado: Feriado) => (
    <span className="inline-flex">
      <Button variante="icone" tamanho="icone" aria-label={`Editar ${feriado.nome}`} onClick={() => setPainel({ aberto: true, feriado })}>
        <Pencil aria-hidden />
      </Button>
      <Button variante="icone" tamanho="icone" aria-label={`Remover ${feriado.nome}`} onClick={() => setRemovendo(feriado)}>
        <Trash2 aria-hidden />
      </Button>
    </span>
  );

  const colunas: readonly Coluna<Feriado>[] = [
    { id: 'data', titulo: 'Data', essencial: true, celula: (feriado) => <span className="tabular-nums">{formatarDiaISO(feriado.data)}</span> },
    { id: 'dia', titulo: 'Dia da semana', celula: (feriado) => diaDaSemana(feriado.data) },
    { id: 'nome', titulo: 'Feriado', essencial: true, celula: (feriado) => <span className="font-medium">{feriado.nome}</span> },
    { id: 'abrangencia', titulo: 'Abrangência', essencial: true, celula: (feriado) => <EtiquetaLivre>{ROTULOS_ABRANGENCIA[feriado.abrangencia]}</EtiquetaLivre> },
    { id: 'local', titulo: 'Local', celula: (feriado) => localDoFeriado(feriado) || '—' },
  ];

  return (
    <>
      <CabecalhoPagina
        migalhas={['Central Numa', 'Configurações', 'Cadastros base', 'Calendário']}
        kicker="Configurações"
        titulo="Calendário e feriados"
        resumo={feriados ? `${plural(doAno.length)} em ${ano}` : undefined}
        acoes={
          <Button onClick={() => setPainel({ aberto: true, feriado: null })} disabled={!dados}>
            <Plus aria-hidden />
            Novo feriado
          </Button>
        }
      />
      <AbasConfiguracoes ativa="cadastros" />
      <SubabasCadastros ativa="calendario" />

      <div className="mt-5 space-y-4">
        {consulta.estado === 'carregando' && <EstadoCarregando />}
        {consulta.estado === 'erro' && <EstadoErro titulo="Não deu para ler os feriados." texto="Os dados deste navegador podem estar danificados. Importe um backup ou restaure os exemplos na aba Dados." aoTentarDeNovo={consulta.recarregar} />}
        {consulta.estado === 'pronto' && dados && (
          <>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <Campo rotulo="Ano" id="calendario-ano" className="w-32">
                {(controle) => (
                  <Selecao {...controle} value={String(ano)} onChange={(evento) => mudar({ ano: Number(evento.target.value) })}>
                    {anos.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </Selecao>
                )}
              </Campo>
              <Button variante="secundario" onClick={() => setCarregando(true)}>
                <CalendarPlus aria-hidden />
                Carregar feriados de {ano}
              </Button>
            </div>
            <BarraFiltros
              rapidos={[
                { id: 'todas', rotulo: 'Todos', contador: doAno.length },
                { id: 'nacional', rotulo: 'Nacionais', contador: de('nacional') },
                { id: 'estadual', rotulo: 'Estaduais', contador: de('estadual') },
                { id: 'municipal', rotulo: 'Municipais', contador: de('municipal') },
              ]}
              rapidoAtivo={abrangencia}
              aoEscolherRapido={(escolhida) => mudar({ abrangencia: escolhida as FiltrosFeriados['abrangencia'] })}
            />
            <Lista
              rotulo={`Feriados de ${ano}`}
              linhas={visiveis}
              colunas={colunas}
              chave={(feriado) => feriado.id}
              acoesDaLinha={acoes}
              filtrando={abrangencia !== 'todas'}
              aoLimparFiltros={() => mudar({ abrangencia: 'todas' })}
              cartao={(feriado) => (
                <div className="flex items-start justify-between gap-2">
                  <div className="grid min-w-0 gap-1.5">
                    <p className="font-semibold break-words">{feriado.nome}</p>
                    <p className="text-[13px] text-ink-soft tabular-nums">
                      {formatarDiaISO(feriado.data)} · {diaDaSemana(feriado.data)}
                    </p>
                    <span className="flex flex-wrap items-center gap-1.5">
                      <EtiquetaLivre>{ROTULOS_ABRANGENCIA[feriado.abrangencia]}</EtiquetaLivre>
                      {localDoFeriado(feriado) && <span className="text-[13px] text-ink-soft">{localDoFeriado(feriado)}</span>}
                    </span>
                  </div>
                  <div className="shrink-0">{acoes(feriado)}</div>
                </div>
              )}
              vazio={<EstadoVazio icone={CalendarDays} titulo={`Nenhum feriado em ${ano}.`} texto="Carregue os feriados do ano e confira antes de confirmar." acao={<Button onClick={() => setCarregando(true)}>Carregar feriados de {ano}</Button>} />}
            />
            <FormularioDoFeriado
              aberto={painel.aberto}
              aoFechar={() => setPainel((atual) => ({ ...atual, aberto: false }))}
              feriado={painel.feriado}
              dados={dados}
              aoSalvar={(salvo) => mudar({ ano: Number(salvo.data.slice(0, 4)) })}
            />
          </>
        )}
      </div>

      {carregando && novos.length === 0 ? (
        <Confirmacao aberto aoFechar={() => setCarregando(false)} titulo={`Os feriados de ${ano} já estão aqui`} texto="Tudo o que a Central calcula para este ano já está cadastrado. Nada a acrescentar." rotuloConfirmar="Entendi" soInforma aoConfirmar={() => setCarregando(false)} />
      ) : (
        <Previa
          aberto={carregando}
          aoFechar={() => setCarregando(false)}
          titulo={`Carregar feriados de ${ano}`}
          texto="Confira antes de confirmar. A Central usa uma lista fixa e calcula o Carnaval, a Sexta-feira Santa e o Corpus Christi a partir da Páscoa. Os do estado e do município vêm do local padrão, em Configurações › Geral."
          colunas={['Feriado', 'Data', 'Situação']}
          linhas={previa.map((linha) => [linha.abrangencia === 'nacional' ? linha.nome : `${linha.nome} (${ROTULOS_ABRANGENCIA[linha.abrangencia].toLowerCase()})`, formatarDiaISO(linha.data), linha.jaCadastrado ? 'Já cadastrado' : 'Novo'])}
          avisos={previa.length > novos.length ? [`${plural(previa.length - novos.length)} já ${previa.length - novos.length === 1 ? 'cadastrado fica' : 'cadastrados ficam'} como está.`] : []}
          rotuloConfirmar={`Carregar ${plural(novos.length)}`}
          aoConfirmar={() => void carregarAno()}
        />
      )}

      <Confirmacao
        aberto={removendo !== null}
        aoFechar={() => setRemovendo(null)}
        titulo={`Remover ${removendo?.nome ?? ''}?`}
        texto="Ele sai do calendário e deixa de contar nos dias úteis. Dá para lançar de novo quando precisar."
        rotuloConfirmar="Remover feriado"
        perigo
        aoConfirmar={() => void remover()}
      />
    </>
  );
}
