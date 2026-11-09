'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowRight } from 'lucide-react';
import { Campo } from '@/componentes/campos/campo';
import { EntradaData } from '@/componentes/campos/entrada-data';
import { Pilulas, PilulasMultiplas } from '@/componentes/campos/pilulas';
import { Selecao } from '@/componentes/campos/selecao';
import { useCentral } from '@/componentes/layout/central-provider';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { aviso } from '@/componentes/padroes/aviso';
import { Faixa } from '@/componentes/padroes/faixa';
import { JanelaFormulario, type ErroDeCampo } from '@/componentes/padroes/janela-formulario';
import { Input } from '@/componentes/ui/input';
import { Textarea } from '@/componentes/ui/textarea';
import { ESTAGIOS_DO_PRODUTO } from '@/dados/tipos/precificacao';
import { mensagemDoErro } from '@/dados/erros';
import type { Produto } from '@/dados/tipos/marca';
import { useConsulta } from '@/dados/use-consulta';
import { ativosDoProduto } from '@/dominio/ativos';
import { novaDecisaoVazia, type EntradaDecisao } from '@/dominio/decisoes';
import { ferramentasDoProduto } from '@/dominio/ferramentas';
import { errosDaMudanca, ITENS_DE_DESCONTINUAR, mudarEstagio, type DadosDaMudanca, type EntradaDoPlano } from '@/dominio/portfolio';
import { atividadesAbertasDoProduto } from '@/dominio/produto-atividades';
import { ROTULOS_ESTAGIO } from '@/dominio/produtos';
import { hojeISO } from '@/lib/datas';
import { CampoDecisao } from './campo-decisao';
import { useAvisoDeCredencial } from './aviso-credencial-m07';

type Props = { aberto: boolean; aoFechar: () => void; produto: Produto; pessoas: readonly { id: string; nome: string }[] };

/** O id do campo que mostra cada erro, para o resumo levar o foco até ele (P3). */
const CAMPOS: Readonly<Record<string, string>> = {
  novo: 'estagio-novo',
  criterio: 'estagio-criterio',
  data: 'estagio-data',
  decisao_decisao_id: 'estagio-decisao-decisao_id',
  decisao_titulo: 'estagio-decisao-titulo',
  decisao_descricao: 'estagio-decisao-descricao',
  decisao_data: 'estagio-decisao-data',
  decisao_decisores: 'estagio-decisao-decisores',
  plano: 'estagio-plano',
  plano_titulo: 'estagio-plano-titulo',
  plano_responsavel_id: 'estagio-plano-responsavel',
  plano_prazo: 'estagio-plano-prazo',
  checklist: 'estagio-checklist',
};

/** T07.03: critério e decisão sempre; ao descontinuar, também o plano, que é uma atividade de verdade no Meu dia. */
export function DialogoMudarEstagio({ aberto, aoFechar, produto, pessoas }: Props) {
  const { pessoa } = useCentral();
  const hoje = hojeISO();
  const inicial = (): DadosDaMudanca => ({ novo: '', criterio: '', metrica: '', resultado: '', data: hoje, decisao: novaDecisaoVazia(hoje, [pessoa.id]), plano: null, checklist: [] });
  const [dados, setDados] = useState<DadosDaMudanca>(inicial);
  const [modoDoPlano, setModoDoPlano] = useState<EntradaDoPlano['modo']>('nova');
  const [plano, setPlano] = useState({ atividade_id: '', titulo: '', responsavel_id: '', prazo: '' });
  const [tentou, setTentou] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const credencial = useAvisoDeCredencial();

  useEffect(() => {
    if (!aberto) return;
    setDados(inicial());
    setModoDoPlano('nova');
    setPlano({ atividade_id: '', titulo: `Plano de encerramento de ${produto.nome}`, responsavel_id: pessoa.id, prazo: '' });
    setTentou(false);
    credencial.limpar();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recomeça a cada vez que abre
  }, [aberto, produto.id]);

  const descontinuar = dados.novo === 'descontinuado';
  const vinculos = useConsulta(async () => {
    if (!descontinuar) return null;
    const [ferramentas, ativos, atividades] = await Promise.all([ferramentasDoProduto(produto.id), ativosDoProduto(produto.id), atividadesAbertasDoProduto(produto.id, hoje)]);
    return { ferramentas, ativos, atividades };
  }, [descontinuar, produto.id]);

  const entradaDoPlano: EntradaDoPlano | null = !descontinuar ? null : modoDoPlano === 'existente' ? { modo: 'existente', atividade_id: plano.atividade_id } : { modo: 'nova', titulo: plano.titulo, responsavel_id: plano.responsavel_id, prazo: plano.prazo };
  const completos: DadosDaMudanca = { ...dados, plano: entradaDoPlano };
  const erros = useMemo(() => errosDaMudanca(produto.estagio, completos, hoje), [completos, produto.estagio, hoje]);
  const visiveis = tentou ? erros : {};
  const listaDeErros: ErroDeCampo[] = Object.entries(visiveis).map(([campo, mensagem]) => ({ campoId: CAMPOS[campo] ?? 'estagio-novo', mensagem }));
  const alterado = Boolean(dados.novo || dados.criterio || dados.metrica || dados.resultado);
  const mudar = (parcial: Partial<DadosDaMudanca>) => setDados((atuais) => ({ ...atuais, ...parcial }));

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (salvando) return;
    setTentou(true);
    const primeiro = Object.keys(erros)[0];
    if (primeiro) {
      requestAnimationFrame(() => document.getElementById(CAMPOS[primeiro] ?? 'estagio-novo')?.focus());
      return;
    }
    const nova = dados.decisao?.modo === 'registrar' ? dados.decisao : null;
    if (!credencial.conferir([dados.criterio, dados.metrica, dados.resultado, nova?.titulo ?? '', nova?.descricao ?? '', nova?.motivo ?? ''])) return;
    setSalvando(true);
    try {
      await mudarEstagio(produto.id, completos, hoje);
      aviso(descontinuar ? `${produto.nome} descontinuado. O plano de encerramento está no Meu dia.` : `${produto.nome} agora está em ${ROTULOS_ESTAGIO[dados.novo as Produto['estagio']]}.`);
      aoFechar();
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <JanelaFormulario larga aberto={aberto} aoFechar={aoFechar} titulo="Mudar estágio" descricao={`${produto.nome}: a mudança fica na linha do tempo, com o critério e a decisão.`} alterado={alterado} aoEnviar={(evento) => void enviar(evento)} rotuloSalvar={descontinuar ? 'Descontinuar produto' : 'Mudar estágio'} salvando={salvando} erros={listaDeErros}>
      {credencial.faixa}
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="grid content-start gap-4">
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-2">
            <div>
              <p className="mb-[7px] texto-rotulo">Estágio atual</p>
              <p className="flex min-h-11 items-center rounded-campo bg-mist px-3 text-sm md:min-h-10">{ROTULOS_ESTAGIO[produto.estagio]}</p>
            </div>
            <ArrowRight aria-hidden className="mb-3 size-4 text-ink-soft" />
            <Campo id={CAMPOS.novo} rotulo="Novo estágio" obrigatorio erro={visiveis.novo}>
              {(controle) => (
                <Selecao {...controle} value={dados.novo} onChange={(evento) => mudar({ novo: evento.target.value as DadosDaMudanca['novo'] })}>
                  <option value="">Escolha</option>
                  {ESTAGIOS_DO_PRODUTO.filter((estagio) => estagio !== produto.estagio).map((estagio) => (
                    <option key={estagio} value={estagio}>
                      {ROTULOS_ESTAGIO[estagio]}
                    </option>
                  ))}
                </Selecao>
              )}
            </Campo>
          </div>
          <Campo id={CAMPOS.criterio} rotulo="Critério atendido" obrigatorio erro={visiveis.criterio}>
            {(controle) => <Textarea {...controle} value={dados.criterio} onChange={(evento) => mudar({ criterio: evento.target.value })} />}
          </Campo>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Métrica de validação">{(controle) => <Input {...controle} value={dados.metrica} onChange={(evento) => mudar({ metrica: evento.target.value })} autoComplete="off" />}</Campo>
            <Campo rotulo="Resultado">{(controle) => <Input {...controle} value={dados.resultado} onChange={(evento) => mudar({ resultado: evento.target.value })} autoComplete="off" />}</Campo>
          </div>
          <Campo id={CAMPOS.data} rotulo="Data" obrigatorio erro={visiveis.data}>
            {(controle) => <EntradaData {...controle} value={dados.data} max={hoje} onChange={(evento) => mudar({ data: evento.target.value })} />}
          </Campo>
          {descontinuar && (
            <section className="grid gap-3.5 rounded-md border border-line p-3.5" aria-label="Plano de encerramento">
              <h3 className="text-sm font-semibold">Plano de encerramento</h3>
              <div id={CAMPOS.plano} tabIndex={-1}>
                <Pilulas
                  rotulo="Atividade no Meu dia"
                  obrigatorio
                  valor={modoDoPlano}
                  aoMudar={(valor) => setModoDoPlano(valor as EntradaDoPlano['modo'])}
                  opcoes={[
                    { valor: 'nova', rotulo: 'Criar agora' },
                    { valor: 'existente', rotulo: 'Usar uma aberta' },
                  ]}
                />
                {visiveis.plano && <p className="mt-1.5 text-xs text-err">{visiveis.plano}</p>}
              </div>
              {modoDoPlano === 'existente' ? (
                vinculos.dados?.atividades.length ? (
                  <Campo rotulo="Atividade aberta deste produto" obrigatorio>
                    {(controle) => (
                      <Selecao {...controle} value={plano.atividade_id} onChange={(evento) => setPlano((atual) => ({ ...atual, atividade_id: evento.target.value }))}>
                        <option value="">Escolha</option>
                        {vinculos.dados?.atividades.map((atividade) => (
                          <option key={atividade.id} value={atividade.id}>
                            {atividade.codigo} · {atividade.titulo}
                          </option>
                        ))}
                      </Selecao>
                    )}
                  </Campo>
                ) : (
                  <p className="text-[13px] text-ink-soft">Este produto não tem atividade aberta. Crie o plano agora.</p>
                )
              ) : (
                <>
                  <Campo id={CAMPOS.plano_titulo} rotulo="Título" obrigatorio erro={visiveis.plano_titulo}>
                    {(controle) => <Input {...controle} value={plano.titulo} onChange={(evento) => setPlano((atual) => ({ ...atual, titulo: evento.target.value }))} autoComplete="off" />}
                  </Campo>
                  <Campo id={CAMPOS.plano_responsavel_id} rotulo="Responsável" obrigatorio erro={visiveis.plano_responsavel_id}>
                    {(controle) => (
                      <Selecao {...controle} value={plano.responsavel_id} onChange={(evento) => setPlano((atual) => ({ ...atual, responsavel_id: evento.target.value }))}>
                        <option value="">Escolha</option>
                        {pessoas.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.nome}
                          </option>
                        ))}
                      </Selecao>
                    )}
                  </Campo>
                  <Campo id={CAMPOS.plano_prazo} rotulo="Prazo" obrigatorio erro={visiveis.plano_prazo}>
                    {(controle) => <EntradaData {...controle} value={plano.prazo} onChange={(evento) => setPlano((atual) => ({ ...atual, prazo: evento.target.value }))} />}
                  </Campo>
                  <p className="text-xs text-ink-soft">A atividade é criada no Meu dia só ao confirmar, junto com a mudança.</p>
                </>
              )}
            </section>
          )}
        </div>
        <div className="grid content-start gap-4">
          <CampoDecisao valor={dados.decisao as EntradaDecisao} aoMudar={(decisao) => mudar({ decisao })} regras={{ produto_id: produto.id, assunto: 'estagio' }} erros={visiveis} prefixo="estagio-decisao" pessoaId={pessoa.id} />
          {descontinuar && (
            <section className="grid gap-3 rounded-md border border-line p-3.5" aria-label="Revisão antes de descontinuar">
              <h3 className="text-sm font-semibold">Revisão antes de descontinuar</h3>
              <div className="text-[13px] text-ink-soft">
                {vinculos.estado === 'pronto' && vinculos.dados ? (
                  <>
                    <p>{vinculos.dados.ferramentas.length ? `Ferramentas: ${vinculos.dados.ferramentas.map((item) => item.nome).join(', ')}.` : 'Nenhuma ferramenta vinculada.'}</p>
                    <p className="mt-1">{vinculos.dados.ativos.length ? `Ativos: ${vinculos.dados.ativos.map((item) => item.identificador).join(', ')}.` : 'Nenhum ativo vinculado.'}</p>
                  </>
                ) : (
                  <p>Lendo os vínculos…</p>
                )}
                <p className="mt-1">
                  Nada é cancelado sozinho: confira em{' '}
                  <LinkCentral href="/ferramentas" className="underline">
                    Ferramentas e ativos
                  </LinkCentral>
                  .
                </p>
              </div>
              <Faixa tipo="info">
                Confira os documentos legais e o inventário do produto em{' '}
                <LinkCentral href="/legal" className="underline">
                  Legal e privacidade
                </LinkCentral>
                : descontinuar não muda nada lá sozinho.
              </Faixa>
              <div id={CAMPOS.checklist} tabIndex={-1}>
                <PilulasMultiplas rotulo="Conferi" obrigatorio valores={dados.checklist} aoMudar={(checklist) => mudar({ checklist })} opcoes={ITENS_DE_DESCONTINUAR.map((item) => ({ valor: item.id, rotulo: item.rotulo }))} />
                {visiveis.checklist && <p className="mt-1.5 text-xs text-err">{visiveis.checklist}</p>}
              </div>
            </section>
          )}
        </div>
      </div>
    </JanelaFormulario>
  );
}
