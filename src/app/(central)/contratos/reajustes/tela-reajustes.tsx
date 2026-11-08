'use client';

/** T11.10 Reajuste (RN-11.20, CA-11.09): datas-base dos próximos 60 dias; índice com fonte e data; prévia; aplicar ou dispensar. */
import { useEffect, useState } from 'react';
import { Percent } from 'lucide-react';
import { Campo } from '@/componentes/campos/campo';
import { AbasContratos } from '@/componentes/f1/abas-modulos';
import { executar } from '@/componentes/f1/apoio';
import { useCentral } from '@/componentes/layout/central-provider';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { aviso } from '@/componentes/padroes/aviso';
import { CabecalhoPagina } from '@/componentes/padroes/cabecalho-pagina';
import { Confirmacao } from '@/componentes/padroes/confirmacao';
import { EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { EtiquetaSituacao } from '@/componentes/padroes/etiquetas';
import { Faixa } from '@/componentes/padroes/faixa';
import { JanelaFormulario } from '@/componentes/padroes/janela-formulario';
import { Lista, type Coluna } from '@/componentes/padroes/lista';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { mensagemDoErro } from '@/dados/erros';
import type { LinhaDaPrevia } from '@/dados/tipos/reajuste';
import { useConsulta } from '@/dados/use-consulta';
import { aplicarReajuste, calcularPrevia, carregarReajustes, dispensarReajuste, FORMULARIO_REAJUSTE_VAZIO, HORIZONTE_DIAS, lerPercentual, registrarComunicacao, ROTULOS_SITUACAO_REAJUSTE, salvarCalculo, type FormularioDoReajuste, type LinhaDoReajuste, type TelaDosReajustes } from '@/dominio/reajustes';
import { hojeISO } from '@/lib/datas';
import { formatarDiaISO, formatarDinheiro } from '@/lib/formatacao';

const percentualPorExtenso = (valor: number | null) => (valor === null ? '—' : `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 4 })}%`);

function TabelaDaPrevia({ titulo, linhas, moeda, vazio }: { titulo: string; linhas: readonly LinhaDaPrevia[]; moeda: string; vazio: string }) {
  return (
    <section className="grid gap-1.5" aria-label={titulo}>
      <h3 className="text-[13px] font-semibold">{titulo}</h3>
      {linhas.length ? (
        <ul className="grid gap-1 text-[13px]" data-previa={titulo}>
          {linhas.map((linha) => (
            <li key={linha.id} className="grid grid-cols-[1fr_auto] gap-3 border-b border-line pb-1 last:border-0">
              <span className="min-w-0 break-words">
                {linha.descricao}
                {linha.vencimento && <span className="block text-xs text-ink-soft">Vence em {formatarDiaISO(linha.vencimento)}</span>}
              </span>
              <span className="text-right whitespace-nowrap tabular-nums">
                <span className="text-ink-soft line-through">{formatarDinheiro(linha.de, moeda)}</span> {formatarDinheiro(linha.para, moeda)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-ink-soft">{vazio}</p>
      )}
    </section>
  );
}

function JanelaDoCalculo({ linha, aoFechar }: { linha: LinhaDoReajuste; aoFechar: () => void }) {
  const inicial: FormularioDoReajuste = linha.registro ? { percentual: linha.registro.percentual?.toLocaleString('pt-BR', { maximumFractionDigits: 4 }) ?? '', fonte: linha.registro.indice_fonte ?? '', data: linha.registro.indice_data ?? '' } : FORMULARIO_REAJUSTE_VAZIO;
  const [dados, setDados] = useState<FormularioDoReajuste>(inicial);
  const [previa, setPrevia] = useState<{ itens: LinhaDaPrevia[]; titulos: LinhaDaPrevia[] } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const mudar = (parcial: Partial<FormularioDoReajuste>) => setDados((atual) => ({ ...atual, ...parcial }));
  const moeda = linha.contrato.moeda;

  useEffect(() => {
    let vivo = true;
    let percentual: number | null = null;
    try {
      percentual = lerPercentual(dados.percentual);
    } catch {
      percentual = null;
    }
    if (percentual === null) {
      setPrevia(null);
      return;
    }
    void calcularPrevia(linha, percentual).then((resultado) => vivo && setPrevia(resultado));
    return () => {
      vivo = false;
    };
  }, [dados.percentual, linha]);

  return (
    <JanelaFormulario
      colunas={2}
      aberto
      aoFechar={aoFechar}
      titulo={`Reajuste de ${linha.contrato.codigo}`}
      descricao={`${linha.indice}, data-base ${formatarDiaISO(linha.dataBase)}. Informe o índice do período com a fonte e a data. Salvar não muda nada: aplicar é o passo seguinte.`}
      alterado={JSON.stringify(dados) !== JSON.stringify(inicial)}
      rotuloSalvar="Salvar cálculo"
      salvando={salvando}
      aoEnviar={(evento) => {
        evento.preventDefault();
        setSalvando(true);
        void salvarCalculo(linha, dados)
          .then(() => {
            aviso('Cálculo salvo. Confira a prévia e aplique quando estiver de acordo.');
            aoFechar();
          })
          .catch((erro) => aviso(mensagemDoErro(erro)))
          .finally(() => setSalvando(false));
      }}
    >
      <div className="grid gap-[18px]">
        <Campo id="reajuste-percentual" rotulo={`Percentual do ${linha.indice} no período`} obrigatorio ajuda="Acumulado dos últimos meses, como a fonte publica. Ex.: 4,68.">
          {(controle) => <Input {...controle} inputMode="decimal" autoComplete="off" value={dados.percentual} onChange={(evento) => mudar({ percentual: evento.target.value })} />}
        </Campo>
        <Campo id="reajuste-fonte" rotulo="Fonte do índice" obrigatorio ajuda="Onde o número foi conferido: IBGE, FGV ou o link da publicação.">
          {(controle) => <Input {...controle} autoComplete="off" value={dados.fonte} onChange={(evento) => mudar({ fonte: evento.target.value })} />}
        </Campo>
        <Campo id="reajuste-data" rotulo="Data do índice" obrigatorio>
          {(controle) => <Input {...controle} type="date" value={dados.data} onChange={(evento) => mudar({ data: evento.target.value })} />}
        </Campo>
      </div>
      <div className="grid content-start gap-4" data-previa-do-reajuste>
        {previa ? (
          <>
            <TabelaDaPrevia titulo="Itens recorrentes" linhas={previa.itens} moeda={moeda} vazio="Nenhum item recorrente com valor." />
            <TabelaDaPrevia titulo="Títulos futuros afetados" linhas={previa.titulos} moeda={moeda} vazio="Nenhum título futuro em aberto: o novo valor vale para os que a programação ainda vai gerar." />
            <p className="text-xs text-ink-soft">Títulos pagos, mesmo em parte, ficam com o valor original (CA-11.09).</p>
          </>
        ) : (
          <p className="text-[13px] text-ink-soft">Informe o percentual para ver a prévia.</p>
        )}
      </div>
    </JanelaFormulario>
  );
}

function JanelaDaComunicacao({ registro, aoFechar }: { registro: TelaDosReajustes['tratados'][number]; aoFechar: () => void }) {
  const [dados, setDados] = useState({ data: hojeISO(), canal: '', evidencia: '' });
  const [salvando, setSalvando] = useState(false);
  return (
    <JanelaFormulario
      aberto
      aoFechar={aoFechar}
      titulo={`Comunicação do reajuste de ${registro.codigo}`}
      descricao="Quando e como o cliente foi avisado, com a evidência (o e-mail enviado ou a carta assinada)."
      alterado={Boolean(dados.canal || dados.evidencia)}
      rotuloSalvar="Registrar comunicação"
      salvando={salvando}
      aoEnviar={(evento) => {
        evento.preventDefault();
        setSalvando(true);
        void registrarComunicacao(registro.id, dados)
          .then(() => {
            aviso('Comunicação registrada.');
            aoFechar();
          })
          .catch((erro) => aviso(mensagemDoErro(erro)))
          .finally(() => setSalvando(false));
      }}
    >
      <Campo id="comunicacao-data" rotulo="Data" obrigatorio>
        {(controle) => <Input {...controle} type="date" value={dados.data} onChange={(evento) => setDados((atual) => ({ ...atual, data: evento.target.value }))} />}
      </Campo>
      <Campo id="comunicacao-canal" rotulo="Canal" obrigatorio ajuda="E-mail, carta, reunião…">
        {(controle) => <Input {...controle} autoComplete="off" value={dados.canal} onChange={(evento) => setDados((atual) => ({ ...atual, canal: evento.target.value }))} />}
      </Campo>
      <Campo id="comunicacao-evidencia" rotulo="Evidência" ajuda="Link do e-mail ou do documento no Drive.">
        {(controle) => <Input {...controle} type="url" autoComplete="off" value={dados.evidencia} onChange={(evento) => setDados((atual) => ({ ...atual, evidencia: evento.target.value }))} />}
      </Campo>
    </JanelaFormulario>
  );
}

export function TelaReajustes() {
  const { pessoa } = useCentral();
  const consulta = useConsulta(() => carregarReajustes());
  const dados = consulta.dados;
  const [calculando, setCalculando] = useState<LinhaDoReajuste | null>(null);
  const [aplicando, setAplicando] = useState<LinhaDoReajuste | null>(null);
  const [dispensando, setDispensando] = useState<LinhaDoReajuste | null>(null);
  const [comunicando, setComunicando] = useState<TelaDosReajustes['tratados'][number] | null>(null);
  const hoje = hojeISO();

  const colunas: readonly Coluna<LinhaDoReajuste>[] = [
    { id: 'contrato', titulo: 'Contrato', essencial: true, celula: (linha) => <LinkCentral className="font-medium underline" href={`/contratos/${linha.contrato.id}`}>{linha.contrato.codigo} · {linha.contrato.titulo}</LinkCentral> },
    { id: 'contraparte', titulo: 'Contraparte', celula: (linha) => linha.contraparte },
    { id: 'base', titulo: 'Data-base', essencial: true, celula: (linha) => <span className={linha.dataBase < hoje ? 'font-semibold text-err' : undefined}>{formatarDiaISO(linha.dataBase)}</span> },
    { id: 'indice', titulo: 'Índice', celula: (linha) => `${linha.indice}, a cada ${linha.periodicidadeMeses} meses` },
    { id: 'situacao', titulo: 'Situação', essencial: true, celula: (linha) => (linha.registro ? <EtiquetaSituacao tipo="atencao">Calculado: {percentualPorExtenso(linha.registro.percentual)}</EtiquetaSituacao> : <EtiquetaSituacao tipo="neutro">A calcular</EtiquetaSituacao>) },
  ];
  const acoes = (linha: LinhaDoReajuste) => (
    <span className="flex flex-wrap justify-end gap-1">
      <Button tamanho="pequeno" variante={linha.registro ? 'secundario' : 'primario'} onClick={() => setCalculando(linha)}>
        {linha.registro ? 'Rever cálculo' : 'Calcular'}
      </Button>
      {linha.registro && (
        <Button tamanho="pequeno" onClick={() => setAplicando(linha)}>
          Aplicar
        </Button>
      )}
      <Button tamanho="pequeno" variante="terciario" onClick={() => setDispensando(linha)}>
        Dispensar
      </Button>
    </span>
  );

  return (
    <>
      <CabecalhoPagina comoUsar="/ajuda/contratos/reajuste" kicker="Contratos" titulo="Reajuste" resumo={`Datas-base dos próximos ${HORIZONTE_DIAS} dias. Padrão: IPCA, anual, a partir do início da vigência (D25).`} />
      <AbasContratos ativa="reajustes" />
      <div className="mt-5 space-y-5">
        {consulta.estado === 'erro' && <EstadoErro aoTentarDeNovo={consulta.recarregar} />}
        <Lista
          rotulo="Reajustes a tratar"
          linhas={dados?.pendentes ?? []}
          colunas={colunas}
          chave={(linha) => `${linha.contrato.id}:${linha.dataBase}`}
          estado={consulta.estado === 'carregando' ? 'carregando' : 'pronto'}
          acoesDaLinha={acoes}
          cartaoInterativo
          cartao={(linha) => (
            <span className="grid gap-1.5">
              <LinkCentral className="font-semibold underline" href={`/contratos/${linha.contrato.id}`}>
                {linha.contrato.codigo} · {linha.contraparte}
              </LinkCentral>
              <span className="text-[13px] text-ink-soft">
                {linha.indice} · data-base {formatarDiaISO(linha.dataBase)}
              </span>
              {acoes(linha)}
            </span>
          )}
          vazio={<EstadoVazio icone={Percent} titulo={`Nenhuma data-base nos próximos ${HORIZONTE_DIAS} dias.`} texto="Os contratos vigentes com itens recorrentes aparecem aqui perto do aniversário." />}
        />

        {dados && dados.tratados.length > 0 && (
          <section aria-labelledby="tratados-titulo" className="space-y-2">
            <h2 id="tratados-titulo" className="text-base font-semibold">
              Aplicados e dispensados
            </h2>
            <ul className="grid gap-2" aria-label="Reajustes tratados">
              {dados.tratados.map((registro) => (
                <li key={registro.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-line bg-paper p-3 text-[13px]">
                  <span className="grid gap-0.5">
                    <span className="font-semibold">
                      {registro.codigo} · {registro.contraparte}
                    </span>
                    <span className="text-ink-soft">
                      Data-base {formatarDiaISO(registro.data_base)} · {registro.indice_nome} {percentualPorExtenso(registro.percentual)}
                      {registro.situacao === 'dispensado' && registro.dispensado_motivo ? ` · Motivo: ${registro.dispensado_motivo}` : ''}
                    </span>
                    {registro.situacao === 'aplicado' && (
                      <span className="text-ink-soft">{registro.comunicado_em ? `Comunicado em ${formatarDiaISO(registro.comunicado_em)} por ${registro.comunicado_canal}` : 'Comunicação ao cliente ainda não registrada.'}</span>
                    )}
                  </span>
                  <span className="flex items-center gap-2">
                    <EtiquetaSituacao tipo={registro.situacao === 'aplicado' ? 'sucesso' : 'neutro'}>{ROTULOS_SITUACAO_REAJUSTE[registro.situacao]}</EtiquetaSituacao>
                    {registro.situacao === 'aplicado' && !registro.comunicado_em && (
                      <Button tamanho="pequeno" variante="secundario" onClick={() => setComunicando(registro)}>
                        Registrar comunicação
                      </Button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
        <Faixa>A carta de reajuste por modelo entra quando houver um modelo de carta validado em Legal › Modelos. Até lá, registre a comunicação com o link da evidência.</Faixa>
      </div>

      {calculando && <JanelaDoCalculo key={calculando.contrato.id} linha={calculando} aoFechar={() => setCalculando(null)} />}
      {comunicando && <JanelaDaComunicacao registro={comunicando} aoFechar={() => setComunicando(null)} />}
      <Confirmacao
        aberto={aplicando !== null}
        aoFechar={() => setAplicando(null)}
        titulo={aplicando ? `Aplicar o reajuste de ${aplicando.contrato.codigo}?` : ''}
        texto={aplicando?.registro ? `${aplicando.indice} ${percentualPorExtenso(aplicando.registro.percentual)}: ${aplicando.registro.previa.titulos.length} títulos futuros mudam de valor, e a programação passa a gerar com o novo valor. Os pagos ficam como estão.` : ''}
        rotuloConfirmar="Aplicar reajuste"
        aoConfirmar={() => {
          const alvo = aplicando;
          setAplicando(null);
          if (alvo?.registro) void executar(() => aplicarReajuste(alvo.registro!.id, pessoa.id), 'Reajuste aplicado.');
        }}
      />
      <Confirmacao
        aberto={dispensando !== null}
        aoFechar={() => setDispensando(null)}
        titulo={dispensando ? `Dispensar o reajuste de ${dispensando.contrato.codigo}?` : ''}
        texto="Os valores continuam como estão nesta data-base. O motivo fica registrado."
        rotuloConfirmar="Dispensar reajuste"
        pedirMotivo
        aoConfirmar={(motivo) => {
          const alvo = dispensando;
          setDispensando(null);
          if (alvo) void executar(() => dispensarReajuste(alvo, motivo ?? '', pessoa.id), 'Reajuste dispensado.');
        }}
      />
    </>
  );
}
