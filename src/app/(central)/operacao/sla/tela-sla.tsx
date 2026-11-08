'use client';

import { useState, type FormEvent } from 'react';
import { Gauge, Pencil, Plus } from 'lucide-react';
import { Campo } from '@/componentes/campos/campo';
import { Selecao } from '@/componentes/campos/selecao';
import { CartaoDePainel, executar } from '@/componentes/f1/apoio';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { AbasOperacao } from '@/componentes/operacao/abas-operacao';
import { aviso } from '@/componentes/padroes/aviso';
import { CabecalhoPagina } from '@/componentes/padroes/cabecalho-pagina';
import { Confirmacao } from '@/componentes/padroes/confirmacao';
import { Dado, ListaDeDados } from '@/componentes/padroes/dado';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { EtiquetaSituacao } from '@/componentes/padroes/etiquetas';
import { Faixa } from '@/componentes/padroes/faixa';
import { JanelaFormulario } from '@/componentes/padroes/janela-formulario';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { Textarea } from '@/componentes/ui/textarea';
import { mensagemDoErro } from '@/dados/erros';
import type { SlaRegra } from '@/dados/tipos/operacao';
import { useConsulta } from '@/dados/use-consulta';
import type { OfertaDoCatalogo } from '@/dominio/integracoes/catalogo-comercial';
import { carregarSla, formularioDeRegras, HORARIO_PADRAO, removerRegras, ROTULOS_CONTAGEM, ROTULOS_PRIORIDADE, salvarRegras, type AlvoDaRegra, type DadosDoSla, type FormularioDeRegras, type Prioridade } from '@/dominio/sla';
import { cn } from '@/lib/utils';

const ORDEM: readonly Prioridade[] = ['critica', 'alta', 'normal', 'baixa'];
const horas = (valor: number) => `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} h`;

function TabelaDeRegras({ regras }: { regras: readonly SlaRegra[] }) {
  if (!regras.length) return <p className="text-[13px] text-ink-soft">Sem regras: as solicitações ficam “Sem SLA”, só com acompanhamento.</p>;
  const primeira = regras[0]!;
  return (
    <div className="grid gap-2">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-line text-left text-xs text-ink-soft">
            <th className="py-2 font-semibold">Prioridade</th>
            <th className="py-2 text-right font-semibold">1ª resposta</th>
            <th className="py-2 text-right font-semibold">Resolução</th>
          </tr>
        </thead>
        <tbody>
          {ORDEM.map((prioridade) => {
            const regra = regras.find((linha) => linha.prioridade === prioridade);
            return (
              <tr key={prioridade} className="border-b border-line last:border-0">
                <th scope="row" className="py-2 text-left font-medium">{ROTULOS_PRIORIDADE[prioridade]}</th>
                <td className="py-2 text-right tabular-nums">{regra ? horas(regra.resposta_horas) : 'Sem SLA'}</td>
                <td className="py-2 text-right tabular-nums">{regra ? horas(regra.resolucao_horas) : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-xs text-ink-soft">
        {ROTULOS_CONTAGEM[primeira.contagem]}
        {primeira.contagem === 'horas_uteis' && `, das ${primeira.horario_inicio} às ${primeira.horario_fim}, em dias úteis do calendário`}
      </p>
    </div>
  );
}

function PromessaDaOferta({ oferta }: { oferta: OfertaDoCatalogo }) {
  return (
    <ListaDeDados>
      <Dado rotulo="Canal">{oferta.suporte?.canal}</Dado>
      <Dado rotulo="Horário">{oferta.suporte?.horario}</Dado>
      <Dado rotulo="1ª resposta, crítico">{oferta.suporte?.prazo_critico}</Dado>
      <Dado rotulo="1ª resposta, normal">{oferta.suporte?.prazo_normal}</Dado>
      <Dado rotulo="Meta de disponibilidade">{oferta.disponibilidade_meta === null ? null : `${oferta.disponibilidade_meta.toLocaleString('pt-BR')}%`}</Dado>
      <Dado rotulo="Compensação">{oferta.disponibilidade_compensacao}</Dado>
    </ListaDeDados>
  );
}

type Edicao = { alvo: AlvoDaRegra; titulo: string; regras: SlaRegra[]; oferta: OfertaDoCatalogo | null } | { alvo: null; titulo: string; regras: []; oferta: null };

/** T12.04: as regras de cada oferta e as exceções por contrato. */
export function TelaSla() {
  const consulta = useConsulta(() => carregarSla());
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const [removendo, setRemovendo] = useState<{ alvo: AlvoDaRegra; titulo: string } | null>(null);
  const dados = consulta.dados;
  const novaExcecao = <Button onClick={() => setEdicao({ alvo: null, titulo: 'Nova exceção de contrato', regras: [], oferta: null })}><Plus aria-hidden />Exceção de contrato</Button>;
  return (
    <>
      <CabecalhoPagina kicker="Operação" titulo="Regras de SLA" resumo="Por oferta, o padrão; por contrato, a exceção. O que a oferta promete fica no M07 e só é lido aqui." acoes={novaExcecao} />
      <AbasOperacao ativa="sla" />
      <div className="mt-5 space-y-6">
        {consulta.estado === 'erro' && <EstadoErro titulo="Não deu para ler as regras." aoTentarDeNovo={consulta.recarregar} />}
        {consulta.estado === 'carregando' && <EstadoCarregando />}
        {dados && <Conteudo dados={dados} aoEditar={setEdicao} aoRemover={setRemovendo} />}
      </div>
      {edicao && dados && (
        <JanelaRegras
          edicao={edicao}
          contratos={dados.contratos.filter((contrato) => !dados.excecoes.some((excecao) => excecao.contrato.id === contrato.id))}
          aoFechar={() => setEdicao(null)}
          aoSalvar={() => {
            setEdicao(null);
            consulta.recarregar();
          }}
        />
      )}
      <Confirmacao
        aberto={Boolean(removendo)}
        aoFechar={() => setRemovendo(null)}
        titulo="Remover as regras?"
        texto={removendo ? `${removendo.titulo}: as próximas solicitações ficam sem este SLA. As já abertas mantêm o prazo calculado na abertura.` : ''}
        rotuloConfirmar="Remover regras"
        perigo
        aoConfirmar={async () => {
          const alvo = removendo;
          setRemovendo(null);
          if (alvo && (await executar(() => removerRegras(alvo.alvo), 'Regras removidas.'))) consulta.recarregar();
        }}
      />
    </>
  );
}

function Conteudo({ dados, aoEditar, aoRemover }: { dados: DadosDoSla; aoEditar: (edicao: Edicao) => void; aoRemover: (alvo: { alvo: AlvoDaRegra; titulo: string }) => void }) {
  return (
    <>
      {dados.estado === 'ausente' && <Faixa tipo="atencao">O catálogo do M07 não está ligado: sem ofertas, só dá para criar exceções por contrato.</Faixa>}
      {dados.estado === 'exemplo' && <Faixa tipo="atencao">Catálogo de EXEMPLO, só para desenvolvimento: as ofertas abaixo não são dados reais do M07.</Faixa>}
      <section aria-label="Regras por oferta" className="grid gap-3">
        <h2 className="text-[19px]">Por oferta</h2>
        {dados.produtos.length ? (
          dados.produtos.map((produto) => (
            <div key={produto.id} className="grid gap-3">
              <h3 className="text-[15px] text-ink-soft">{produto.nome}</h3>
              <ul className="grid gap-3 lg:grid-cols-2">
                {produto.ofertas.map(({ oferta, regras, divergencias }) => (
                  <li key={oferta.id} data-oferta={oferta.id}>
                    <CartaoDePainel
                      titulo={oferta.nome}
                      acao={
                        <span className="flex flex-wrap gap-1.5">
                          {regras.length > 0 && <Button variante="terciario" tamanho="pequeno" onClick={() => aoRemover({ alvo: { tipo: 'oferta', id: oferta.id }, titulo: oferta.nome })}>Remover regras</Button>}
                          <Button variante="secundario" tamanho="pequeno" aria-label={`${regras.length ? 'Editar' : 'Definir'} as regras de ${oferta.nome}`} onClick={() => aoEditar({ alvo: { tipo: 'oferta', id: oferta.id }, titulo: `SLA de ${oferta.nome}`, regras, oferta })}>
                            <Pencil aria-hidden />
                            {regras.length ? 'Editar' : 'Definir regras'}
                          </Button>
                        </span>
                      }
                    >
                      <div className="grid gap-4">
                        {oferta.situacao === 'em_estudo' && <EtiquetaSituacao tipo="neutro">Oferta em estudo</EtiquetaSituacao>}
                        <TabelaDeRegras regras={regras} />
                        {divergencias.map((texto) => <Faixa key={texto} tipo="atencao">{texto}</Faixa>)}
                        <details className="text-[13px]">
                          <summary className="flex min-h-11 cursor-pointer items-center font-semibold md:min-h-8">O que a oferta promete (M07)</summary>
                          <div className="mt-2 grid gap-2">
                            <PromessaDaOferta oferta={oferta} />
                            <LinkCentral href={`/produtos/${oferta.produto_id}/ofertas/${oferta.id}`} className="inline-flex min-h-11 items-center underline md:min-h-0">Editar na oferta</LinkCentral>
                          </div>
                        </details>
                      </div>
                    </CartaoDePainel>
                  </li>
                ))}
              </ul>
            </div>
          ))
        ) : (
          <EstadoVazio icone={Gauge} titulo="Nenhuma oferta no catálogo." texto="As regras padrão são por oferta: cadastre as ofertas em Produtos (M07)." />
        )}
      </section>
      <section aria-label="Exceções por contrato" className="grid gap-3">
        <h2 className="text-[19px]">Exceções por contrato</h2>
        {dados.excecoes.length ? (
          <ul className="grid gap-3 lg:grid-cols-2">
            {dados.excecoes.map(({ contrato, regras }) => (
              <li key={contrato.id}>
                <CartaoDePainel
                  titulo={`${contrato.codigo} · ${contrato.titulo}`}
                  acao={
                    <span className="flex flex-wrap gap-1.5">
                      <Button variante="terciario" tamanho="pequeno" onClick={() => aoRemover({ alvo: { tipo: 'contrato', id: contrato.id }, titulo: contrato.codigo })}>Remover regras</Button>
                      <Button variante="secundario" tamanho="pequeno" aria-label={`Editar as regras de ${contrato.codigo}`} onClick={() => aoEditar({ alvo: { tipo: 'contrato', id: contrato.id }, titulo: `Exceção de ${contrato.codigo}`, regras, oferta: null })}>
                        <Pencil aria-hidden />
                        Editar
                      </Button>
                    </span>
                  }
                >
                  <div className="grid gap-3">
                    <TabelaDeRegras regras={regras} />
                    <ListaDeDados>
                      <Dado rotulo="Disponibilidade mínima">{regras[0]?.disponibilidade_minima === null || regras[0]?.disponibilidade_minima === undefined ? 'A meta da oferta' : `${regras[0].disponibilidade_minima.toLocaleString('pt-BR')}%`}</Dado>
                      <Dado rotulo="Créditos por descumprimento">{regras[0]?.creditos ?? 'A compensação da oferta'}</Dado>
                    </ListaDeDados>
                  </div>
                </CartaoDePainel>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-ink-soft">Nenhuma exceção. Um contrato só tem regra própria quando combinou algo diferente da oferta.</p>
        )}
      </section>
    </>
  );
}

function JanelaRegras({ edicao, contratos, aoFechar, aoSalvar }: { edicao: Edicao; contratos: DadosDoSla['contratos']; aoFechar: () => void; aoSalvar: () => void }) {
  const [contratoId, setContratoId] = useState('');
  const [valores, setValores] = useState<FormularioDeRegras>(() => formularioDeRegras(edicao.regras));
  const [alterado, setAlterado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const alvo: AlvoDaRegra | null = edicao.alvo ?? (contratoId ? { tipo: 'contrato', id: contratoId } : null);
  const doContrato = alvo?.tipo === 'contrato';
  const mudar = (parcial: Partial<FormularioDeRegras>) => {
    setValores((atuais) => ({ ...atuais, ...parcial }));
    setAlterado(true);
  };
  const mudarLinha = (prioridade: Prioridade, campo: 'resposta_horas' | 'resolucao_horas', valor: string) => mudar({ linhas: valores.linhas.map((linha) => (linha.prioridade === prioridade ? { ...linha, [campo]: valor } : linha)) });
  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!alvo) {
      aviso('Escolha o contrato.');
      return;
    }
    setSalvando(true);
    try {
      await salvarRegras(alvo, valores);
      aviso('Regras salvas. Valem para as próximas solicitações.');
      aoSalvar();
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    } finally {
      setSalvando(false);
    }
  }
  return (
    <JanelaFormulario aberto larga aoFechar={aoFechar} titulo={edicao.titulo} descricao="Prioridade em branco fica sem SLA. O prazo é calculado na abertura da solicitação e não muda depois." alterado={alterado} aoEnviar={enviar} salvando={salvando} rotuloSalvar="Salvar regras">
      <div className="grid gap-[18px]">
        {!edicao.alvo && (
          <Campo id="sla-contrato" rotulo="Contrato" obrigatorio>
            {(controle) => (
              <Selecao {...controle} value={contratoId} onChange={(evento) => setContratoId(evento.target.value)}>
                <option value="">Escolha</option>
                {contratos.map((contrato) => <option key={contrato.id} value={contrato.id}>{contrato.codigo} · {contrato.titulo}</option>)}
              </Selecao>
            )}
          </Campo>
        )}
        {edicao.oferta && (
          <details className="rounded-md bg-hover px-3 py-2 text-[13px]">
            <summary className="flex min-h-11 cursor-pointer items-center font-semibold md:min-h-8">O que a oferta promete (M07)</summary>
            <div className="mt-2"><PromessaDaOferta oferta={edicao.oferta} /></div>
          </details>
        )}
        <fieldset>
          <legend className="mb-[7px] texto-rotulo">Contagem *</legend>
          <div className="flex flex-wrap gap-1.5" role="radiogroup">
            {(Object.keys(ROTULOS_CONTAGEM) as FormularioDeRegras['contagem'][]).map((contagem) => (
              <label key={contagem} className={cn('inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-pill border px-3.5 text-[13px] font-semibold md:min-h-9', valores.contagem === contagem ? 'border-espresso bg-espresso text-linen' : 'border-line bg-paper')}>
                <input type="radio" className="sr-only" name="sla-contagem" checked={valores.contagem === contagem} onChange={() => mudar({ contagem })} />
                {ROTULOS_CONTAGEM[contagem]}
              </label>
            ))}
          </div>
        </fieldset>
        {valores.contagem === 'horas_uteis' && (
          <div className="grid gap-[18px] sm:grid-cols-2">
            <Campo id="sla-inicio" rotulo="Atendimento começa" obrigatorio ajuda={`Padrão: ${HORARIO_PADRAO.inicio} (D25).`}>
              {(controle) => <input {...controle} type="time" className="campo" value={valores.horario_inicio} onChange={(evento) => mudar({ horario_inicio: evento.target.value })} />}
            </Campo>
            <Campo id="sla-fim" rotulo="Atendimento termina" obrigatorio ajuda={`Padrão: ${HORARIO_PADRAO.fim}. Em dias úteis do calendário.`}>
              {(controle) => <input {...controle} type="time" className="campo" value={valores.horario_fim} onChange={(evento) => mudar({ horario_fim: evento.target.value })} />}
            </Campo>
          </div>
        )}
        <fieldset>
          <legend className="mb-[7px] texto-rotulo">Prazos, em horas</legend>
          <div className="grid gap-3">
            {ORDEM.map((prioridade) => {
              const linha = valores.linhas.find((item) => item.prioridade === prioridade)!;
              return (
                <div key={prioridade} className="grid grid-cols-2 gap-3 sm:grid-cols-[110px_1fr_1fr] sm:items-end">
                  <span className="col-span-2 text-[13px] font-semibold sm:col-span-1 sm:pb-3">{ROTULOS_PRIORIDADE[prioridade]}</span>
                  <Campo id={`sla-${prioridade}-resposta`} rotulo="1ª resposta">
                    {(controle) => <Input {...controle} inputMode="decimal" autoComplete="off" placeholder="Sem SLA" value={linha.resposta_horas} onChange={(evento) => mudarLinha(prioridade, 'resposta_horas', evento.target.value)} />}
                  </Campo>
                  <Campo id={`sla-${prioridade}-resolucao`} rotulo="Resolução">
                    {(controle) => <Input {...controle} inputMode="decimal" autoComplete="off" placeholder="Sem SLA" value={linha.resolucao_horas} onChange={(evento) => mudarLinha(prioridade, 'resolucao_horas', evento.target.value)} />}
                  </Campo>
                </div>
              );
            })}
          </div>
        </fieldset>
        {doContrato && (
          <div className="grid gap-[18px] sm:grid-cols-2">
            <Campo id="sla-disponibilidade" rotulo="Disponibilidade mínima mensal (%)" ajuda="Opcional. Vazio: vale a meta da oferta.">
              {(controle) => <Input {...controle} inputMode="decimal" autoComplete="off" value={valores.disponibilidade_minima} onChange={(evento) => mudar({ disponibilidade_minima: evento.target.value })} />}
            </Campo>
            <Campo id="sla-creditos" rotulo="Créditos por descumprimento" ajuda="Opcional. Vazio: vale a compensação da oferta." className="sm:col-span-2">
              {(controle) => <Textarea {...controle} rows={2} value={valores.creditos} onChange={(evento) => mudar({ creditos: evento.target.value })} />}
            </Campo>
          </div>
        )}
        {!doContrato && edicao.alvo && <p className="text-xs text-ink-soft">Meta de disponibilidade e compensação ficam na oferta, no M07.</p>}
      </div>
    </JanelaFormulario>
  );
}
