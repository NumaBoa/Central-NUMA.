'use client';

import { useState } from 'react';
import { CalendarDays, LogOut, Pencil, Users } from 'lucide-react';
import { Campo } from '@/componentes/campos/campo';
import { EntradaData } from '@/componentes/campos/entrada-data';
import { Pilulas } from '@/componentes/campos/pilulas';
import { Selecao } from '@/componentes/campos/selecao';
import { MolduraDaEmpresa, ResumoDaEmpresa } from '@/componentes/empresa/aparencia';
import { MenuDeAcoes } from '@/componentes/empresa/menu-de-acoes';
import { useFormulario } from '@/componentes/empresa/use-formulario';
import { useCentral } from '@/componentes/layout/central-provider';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { EtiquetaSituacao } from '@/componentes/padroes/etiquetas';
import { Faixa } from '@/componentes/padroes/faixa';
import { JanelaFormulario } from '@/componentes/padroes/janela-formulario';
import { Avatar } from '@/componentes/padroes/pessoa';
import { CampoDecisao } from '@/componentes/produtos/campo-decisao';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/componentes/ui/tabs';
import { Textarea } from '@/componentes/ui/textarea';
import type { Socia } from '@/dados/tipos/sociedade';
import { useConsulta } from '@/dados/use-consulta';
import { ROTULOS_SITUACAO_VERSAO, versaoAtual } from '@/dominio/acordos';
import { alterarParticipacao, carregarSociedade, dedicacaoDaSocia, divergenciaDoAcordo, errosDaParticipacao, errosDaSaida, formularioDaParticipacao, formularioDaSaida, lerParticipacao, linhaDoTempoDaParticipacao, nomeDaPessoa, pessoasDaParticipacao, REGRAS_DA_DECISAO_DE_PARTICIPACAO, registrarSaida, salvarEntradaDaSocia, sociaEstaAtiva, sociasAtivas, somaDasParticipacoes, textoDaParticipacao, textoDoFundamento, ultimaVigencia, versoesParaFundamento, type DadosDaSociedade, type FormularioParticipacao } from '@/dominio/sociedade';
import { hojeISO } from '@/lib/datas';
import { formatarDiaISO } from '@/lib/formatacao';
import { cn } from '@/lib/utils';

function CamposDaParticipacao({ dados, valores, mudar, campo, erros, prefixo }: { dados: DadosDaSociedade; valores: Pick<FormularioParticipacao, 'linhas'>; mudar: (parcial: Pick<FormularioParticipacao, 'linhas'>) => void; campo: (nome: string) => { id: string; erro?: string }; erros: Readonly<Record<string, string>>; prefixo: string }) {
  const soma = somaDasParticipacoes(valores.linhas.map((linha) => lerParticipacao(linha.percentual)));
  const fecha = Math.abs(soma - 100) < 0.0001;
  return (
    <div className="grid gap-3">
      {valores.linhas.map((linha) => (
        <Campo key={linha.pessoa_id} rotulo={nomeDaPessoa(dados.pessoas, linha.pessoa_id)} obrigatorio {...campo(`participacao_${linha.pessoa_id}`)}>
          {(controle) => (
            <div className="relative">
              <Input inputMode="decimal" autoComplete="off" {...controle} value={linha.percentual} className="pr-9" onChange={(evento) => mudar({ linhas: valores.linhas.map((outra) => (outra.pessoa_id === linha.pessoa_id ? { ...outra, percentual: evento.target.value } : outra)) })} />
              <span aria-hidden className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-[13px] text-ink-soft">
                %
              </span>
            </div>
          )}
        </Campo>
      ))}
      <div id={`${prefixo}-total`} tabIndex={-1} role="status" className={cn('flex items-center justify-between rounded-md px-3.5 py-2.5 text-sm font-semibold', fecha ? 'bg-ok-wash text-ok' : 'bg-err-wash text-err')}>
        <span>Total</span>
        <span className="tabular-nums">{textoDaParticipacao(soma)}</span>
      </div>
      {erros.total && <p className="text-[13px] font-medium text-err">{erros.total}</p>}
    </div>
  );
}

function CamposDoFundamento({ dados, valores, mudar, campo, erros, prefixo, pessoaId }: { dados: DadosDaSociedade; valores: Pick<FormularioParticipacao, 'fundamento_tipo' | 'acordo_versao_id' | 'decisao'>; mudar: (parcial: Partial<FormularioParticipacao>) => void; campo: (nome: string) => { id: string; erro?: string }; erros: Readonly<Record<string, string>>; prefixo: string; pessoaId: string }) {
  const vigentes = versoesParaFundamento(dados.versoes);
  return (
    <div className="grid gap-3.5">
      <Pilulas
        rotulo="Fundamento *"
        valor={valores.fundamento_tipo}
        aoMudar={(valor) => mudar({ fundamento_tipo: valor as FormularioParticipacao['fundamento_tipo'] })}
        opcoes={[
          { valor: 'acordo', rotulo: 'Acordo vigente' },
          { valor: 'decisao', rotulo: 'Decisão' },
        ]}
      />
      {valores.fundamento_tipo === 'acordo' ? (
        <Campo rotulo="Acordo de fundamento" obrigatorio {...campo('acordo_versao_id')} ajuda={vigentes.length ? undefined : 'Ainda não há acordo vigente. Use uma decisão como fundamento, ou conclua um acordo em Acordos.'}>
          {(controle) => (
            <Selecao {...controle} value={valores.acordo_versao_id} onChange={(evento) => mudar({ acordo_versao_id: evento.target.value })}>
              <option value="">Escolha</option>
              {vigentes.map((versao) => (
                <option key={versao.id} value={versao.id}>
                  {dados.acordos.find((acordo) => acordo.id === versao.acordo_id)?.titulo ?? 'Acordo'} · V{versao.numero}
                </option>
              ))}
            </Selecao>
          )}
        </Campo>
      ) : (
        <CampoDecisao valor={valores.decisao} aoMudar={(decisao) => mudar({ decisao })} regras={REGRAS_DA_DECISAO_DE_PARTICIPACAO} erros={erros} prefixo={`${prefixo}-decisao`} pessoaId={pessoaId} rotulo="Decisão de fundamento" />
      )}
    </div>
  );
}

function JanelaParticipacao({ dados, inicial, aoFechar }: { dados: DadosDaSociedade; inicial?: Partial<FormularioParticipacao>; aoFechar: () => void }) {
  const { pessoa } = useCentral();
  const hoje = hojeISO();
  const ultima = ultimaVigencia(dados.historico);
  const f = useFormulario<FormularioParticipacao>({
    prefixo: 'participacao',
    inicial: () => ({ ...formularioDaParticipacao(dados, pessoa.id, hoje), ...inicial }),
    validar: (valores) => errosDaParticipacao(valores, { hoje, ultimaVigencia: ultima }),
    salvar: (valores) => alterarParticipacao(valores, hoje),
    mensagem: 'Participação atualizada.',
    aoSalvar: aoFechar,
  });
  const nomes = pessoasDaParticipacao(dados, hoje);
  return (
    <JanelaFormulario aberto aoFechar={aoFechar} titulo="Editar participação" descricao="Atualize as participações das sócias e informe o fundamento." alterado={f.alterado} aoEnviar={f.enviar} rotuloSalvar="Salvar alterações" salvando={f.salvando} erros={f.lista}>
      <div className="grid gap-4">
        {nomes.some((linha) => linha.atual === null) && <Faixa tipo="info">Quem foi marcada como sócia em Pessoas entra aqui, com a participação em branco.</Faixa>}
        <CamposDaParticipacao dados={dados} valores={f.valores} mudar={f.mudar} campo={f.campo} erros={f.erros} prefixo="participacao" />
        <CamposDoFundamento dados={dados} valores={f.valores} mudar={f.mudar} campo={f.campo} erros={f.erros} prefixo="participacao" pessoaId={pessoa.id} />
        <Campo rotulo="Data de vigência" obrigatorio {...f.campo('vigente_desde')}>
          {(controle) => <EntradaData max={hoje} {...controle} {...f.entrada('vigente_desde')} />}
        </Campo>
      </div>
    </JanelaFormulario>
  );
}

function JanelaSaida({ dados, pessoaId, aoFechar }: { dados: DadosDaSociedade; pessoaId: string; aoFechar: () => void }) {
  const { pessoa } = useCentral();
  const hoje = hojeISO();
  const ultima = ultimaVigencia(dados.historico);
  const f = useFormulario({
    prefixo: 'saida',
    inicial: () => formularioDaSaida(dados, pessoaId, pessoa.id, hoje),
    validar: (valores) => errosDaSaida(valores, { hoje, ultimaVigencia: ultima }),
    salvar: (valores) => registrarSaida(valores, hoje),
    textos: (valores) => [valores.motivo],
    mensagem: 'Saída registrada.',
    aoSalvar: aoFechar,
  });
  const nome = nomeDaPessoa(dados.pessoas, pessoaId);
  return (
    <JanelaFormulario aberto aoFechar={aoFechar} titulo={`Registrar saída de ${nome}`} descricao="A pessoa continua no cadastro e no Financeiro. A participação dela fica no histórico." alterado={f.alterado} aoEnviar={f.enviar} rotuloSalvar="Registrar saída" salvando={f.salvando} erros={f.lista}>
      <div className="grid gap-4">
        <Campo rotulo="Data de saída" obrigatorio {...f.campo('data')}>
          {(controle) => <EntradaData max={hoje} {...controle} {...f.entrada('data')} />}
        </Campo>
        <Campo rotulo="Motivo" obrigatorio {...f.campo('motivo')}>
          {(controle) => <Textarea {...controle} {...f.entrada('motivo')} />}
        </Campo>
        {f.valores.linhas.length > 0 && <p className="texto-rotulo">Participação de quem fica</p>}
        <CamposDaParticipacao dados={dados} valores={f.valores} mudar={f.mudar} campo={f.campo} erros={f.erros} prefixo="saida" />
        <CamposDoFundamento dados={dados} valores={f.valores} mudar={f.mudar} campo={f.campo} erros={f.erros} prefixo="saida" pessoaId={pessoa.id} />
        {f.avisoDeCredencial}
      </div>
    </JanelaFormulario>
  );
}

function JanelaEntrada({ socia, nome, aoFechar }: { socia: Socia; nome: string; aoFechar: () => void }) {
  const hoje = hojeISO();
  const f = useFormulario({
    prefixo: 'entrada',
    inicial: () => ({ entrada: socia.entrada_em ?? '' }),
    validar: ({ entrada }): Record<string, string> => {
      if (!entrada) return { entrada: 'Informe a data de entrada.' };
      return entrada > hoje ? { entrada: 'Use hoje ou uma data passada.' } : {};
    },
    salvar: ({ entrada }) => salvarEntradaDaSocia(socia.id, entrada, hoje),
    mensagem: 'Data de entrada salva.',
    aoSalvar: aoFechar,
  });
  return (
    <JanelaFormulario aberto aoFechar={aoFechar} titulo={`Data de entrada de ${nome}`} alterado={f.alterado} aoEnviar={f.enviar} salvando={f.salvando} erros={f.lista}>
      <Campo rotulo="Data de entrada" obrigatorio {...f.campo('entrada')}>
        {(controle) => <EntradaData max={hoje} {...controle} {...f.entrada('entrada')} />}
      </Campo>
    </JanelaFormulario>
  );
}

function Informacao({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold text-ink-soft">{rotulo}</dt>
      <dd className="mt-0.5 break-words">{children}</dd>
    </div>
  );
}

function CartaoDaSocia({ socia, dados, aoEditarEntrada, aoRegistrarSaida, podeSair }: { socia: Socia; dados: DadosDaSociedade; aoEditarEntrada: () => void; aoRegistrarSaida: () => void; podeSair: boolean }) {
  const nome = nomeDaPessoa(dados.pessoas, socia.pessoa_id);
  const ativa = sociaEstaAtiva(socia);
  const fundamento = textoDoFundamento(socia, dados);
  const areas = dados.ligacoes.filter((ligacao) => ligacao.pessoa_id === socia.pessoa_id).flatMap((ligacao) => dados.areas.find((area) => area.id === ligacao.area_id)?.nome ?? []);
  return (
    <article className="rounded-lg border border-line bg-paper p-4 md:p-5" aria-label={nome}>
      <div className="flex items-start gap-3">
        <Avatar nome={nome} className="size-11 text-[14px]" />
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] leading-6">{nome}</h2>
          <p className="mt-0.5 text-[13px] text-ink-soft">
            {ativa ? (
              <>
                Participação cadastrada: <strong className="font-semibold text-ink tabular-nums">{textoDaParticipacao(socia.participacao)}</strong>
              </>
            ) : (
              'Sem participação desde a saída'
            )}
          </p>
        </div>
        {ativa ? <EtiquetaSituacao tipo="sucesso">Ativa</EtiquetaSituacao> : <EtiquetaSituacao tipo="neutro">Saiu em {formatarDiaISO(socia.saida_em as string)}</EtiquetaSituacao>}
        <MenuDeAcoes
          rotulo={`Mais ações de ${nome}`}
          acoes={[
            { rotulo: socia.entrada_em ? 'Corrigir data de entrada' : 'Informar data de entrada', icone: CalendarDays, aoClicar: aoEditarEntrada },
            ...(ativa && podeSair ? [{ rotulo: 'Registrar saída', icone: LogOut, aoClicar: aoRegistrarSaida, perigo: true }] : []),
          ]}
        />
      </div>
      <dl className="mt-4 grid gap-3 text-[13px] sm:grid-cols-2 xl:grid-cols-4">
        <Informacao rotulo="Data de entrada">{socia.entrada_em ? formatarDiaISO(socia.entrada_em) : <span className="text-ink-soft">Não informada</span>}</Informacao>
        <Informacao rotulo="Dedicação">{dedicacaoDaSocia(socia, dados.versoes) ?? <span className="text-ink-soft">Não definida no acordo</span>}</Informacao>
        <Informacao rotulo="Acordo de fundamento">
          {fundamento.href ? (
            <LinkCentral href={fundamento.href} className="inline-flex min-h-11 items-center underline underline-offset-2 md:min-h-0">
              {fundamento.texto}
            </LinkCentral>
          ) : (
            fundamento.texto
          )}
        </Informacao>
        <Informacao rotulo="Áreas">{areas.length ? areas.join(', ') : <span className="text-ink-soft">Nenhuma</span>}</Informacao>
      </dl>
    </article>
  );
}

function AbaDoHistorico({ dados }: { dados: DadosDaSociedade }) {
  const mudancas = linhaDoTempoDaParticipacao(dados);
  if (!mudancas.length) {
    return (
      <Faixa tipo="info">
        <strong className="font-semibold">Nenhuma alteração de participação registrada.</strong> A participação atual é a do cadastro inicial.
      </Faixa>
    );
  }
  return (
    <ol className="grid gap-2.5">
      {mudancas.map((mudanca) => (
        <li key={mudanca.id} className="rounded-lg border border-line bg-paper p-4 text-[13px]">
          <p className="font-semibold">Desde {formatarDiaISO(mudanca.vigente_desde)}</p>
          <p className="mt-1 tabular-nums">{mudanca.linhas.map((linha) => `${linha.nome}: ${textoDaParticipacao(linha.participacao)}`).join(' · ')}</p>
          <p className="mt-1 text-ink-soft">
            Fundamento:{' '}
            {mudanca.fundamento.href ? (
              <LinkCentral href={mudanca.fundamento.href} className="inline-flex min-h-11 items-center underline underline-offset-2 md:min-h-0">
                {mudanca.fundamento.texto}
              </LinkCentral>
            ) : (
              mudanca.fundamento.texto
            )}
          </p>
        </li>
      ))}
    </ol>
  );
}

type Edicao = { inicial?: Partial<FormularioParticipacao> };

/** T06.02: as sócias, a participação cadastrada e a linha do tempo. Investimento fica no Financeiro (T05.05). */
export function TelaSociasDaEmpresa() {
  const consulta = useConsulta(carregarSociedade);
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const [saida, setSaida] = useState<string | null>(null);
  const [entrada, setEntrada] = useState<Socia | null>(null);

  const moldura = (conteudo: React.ReactNode, acoes?: React.ReactNode, resumo?: string) => (
    <MolduraDaEmpresa ativa="socias" titulo="Sócias e participação" resumo={resumo ?? 'Sócias, participação cadastrada e o acordo de referência.'} acoes={acoes}>
      {conteudo}
    </MolduraDaEmpresa>
  );

  if (consulta.estado === 'carregando') return moldura(<EstadoCarregando />);
  if (consulta.estado === 'erro') return moldura(<EstadoErro titulo="Não deu para ler as sócias." aoTentarDeNovo={consulta.recarregar} />);

  const dados = consulta.dados;
  const ativas = sociasAtivas(dados.socias);
  const soma = somaDasParticipacoes(ativas.map((socia) => socia.participacao));
  const referencia = ativas[0] ? textoDoFundamento(ativas[0], dados) : null;
  const memorando = dados.acordos.find((acordo) => acordo.tipo === 'memorando' || acordo.tipo === 'acordo_socias');
  const versaoDoMemorando = memorando ? versaoAtual(memorando.id, dados.versoes) : undefined;
  const divergencia = divergenciaDoAcordo(dados);

  const acoes = (
    <Button onClick={() => setEdicao({})}>
      <Pencil aria-hidden />
      Editar participação
    </Button>
  );

  return moldura(
    <>
      <ResumoDaEmpresa
        itens={[
          { rotulo: 'Sócias', valor: ativas.map((socia) => `${nomeDaPessoa(dados.pessoas, socia.pessoa_id)} (${textoDaParticipacao(socia.participacao)})`).join(' e ') || 'Nenhuma' },
          { rotulo: 'Participação cadastrada', valor: textoDaParticipacao(soma) },
          { rotulo: 'Referência', valor: referencia?.texto ?? 'Não informada' },
          ...(memorando && versaoDoMemorando ? [{ rotulo: memorando.titulo, valor: `V${versaoDoMemorando.numero} · ${ROTULOS_SITUACAO_VERSAO[versaoDoMemorando.situacao]}` }] : []),
        ]}
      />
      {referencia && !referencia.vigente && <Faixa tipo="atencao">A participação está cadastrada, mas o acordo de referência ainda não está vigente. Só o acordo vigente define as condições (RN-06.02).</Faixa>}
      {divergencia && (
        <Faixa
          tipo="atencao"
          acao={
            <Button
              variante="secundario"
              tamanho="pequeno"
              onClick={() =>
                setEdicao({
                  inicial: {
                    linhas: divergencia.versao.resumo.participacao.map((linha) => ({ pessoa_id: linha.pessoa_id, percentual: String(linha.percentual).replace('.', ',') })),
                    fundamento_tipo: 'acordo',
                    acordo_versao_id: divergencia.versao.id,
                  },
                })
              }
            >
              Aplicar a do acordo
            </Button>
          }
        >
          {divergencia.acordo.titulo} V{divergencia.versao.numero}, vigente, traz outra participação.
        </Faixa>
      )}
      <Tabs defaultValue="socias" className="min-w-0">
        <TabsList aria-label="Sócias e histórico">
          <TabsTrigger value="socias">Sócias ({ativas.length})</TabsTrigger>
          <TabsTrigger value="historico">Histórico de participação</TabsTrigger>
        </TabsList>
        <TabsContent value="socias" className="mt-4">
          {dados.socias.length ? (
            <div className="grid gap-3">
              {dados.socias.map((socia) => (
                <CartaoDaSocia key={socia.id} socia={socia} dados={dados} podeSair={ativas.length > 1} aoEditarEntrada={() => setEntrada(socia)} aoRegistrarSaida={() => setSaida(socia.pessoa_id)} />
              ))}
            </div>
          ) : (
            <EstadoVazio icone={Users} titulo="Nenhuma sócia cadastrada." texto="Marque as sócias em Pessoas e informe a participação." />
          )}
        </TabsContent>
        <TabsContent value="historico" className="mt-4">
          <AbaDoHistorico dados={dados} />
        </TabsContent>
      </Tabs>
      {edicao && <JanelaParticipacao dados={dados} {...(edicao.inicial ? { inicial: edicao.inicial } : {})} aoFechar={() => setEdicao(null)} />}
      {saida && <JanelaSaida dados={dados} pessoaId={saida} aoFechar={() => setSaida(null)} />}
      {entrada && <JanelaEntrada socia={entrada} nome={nomeDaPessoa(dados.pessoas, entrada.pessoa_id)} aoFechar={() => setEntrada(null)} />}
    </>,
    acoes,
    `${ativas.length} ${ativas.length === 1 ? 'sócia ativa' : 'sócias ativas'} · participação cadastrada de ${textoDaParticipacao(soma)}`,
  );
}
