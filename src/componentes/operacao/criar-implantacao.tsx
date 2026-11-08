'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Campo } from '@/componentes/campos/campo';
import { Selecao } from '@/componentes/campos/selecao';
import { SelecaoPessoa } from '@/componentes/campos/selecao-pessoa';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { aviso } from '@/componentes/padroes/aviso';
import { Dado, ListaDeDados } from '@/componentes/padroes/dado';
import { EstadoCarregando } from '@/componentes/padroes/estados';
import { Faixa } from '@/componentes/padroes/faixa';
import { JanelaFormulario } from '@/componentes/padroes/janela-formulario';
import { mensagemDoErro } from '@/dados/erros';
import { repositorios } from '@/dados/repositorios';
import { useConsulta } from '@/dados/use-consulta';
import { nomeDaContraparte } from '@/dominio/contrapartes';
import { formatarHoras } from '@/dominio/horas';
import { contratosParaImplantar, criarImplantacao, previaDaImplantacao, produtosParaImplantar, responsavelSugerida } from '@/dominio/implantacoes';
import { pessoasDoSeletor } from '@/dominio/pessoa-atual';
import { formatarDiaISO } from '@/lib/formatacao';

async function carregar(contratoId?: string) {
  const [contratos, produtos, pessoas, contrapartes, sugerida] = await Promise.all([contratoId ? Promise.resolve(null) : contratosParaImplantar(), repositorios.produto.listar({ incluirArquivados: true }), repositorios.pessoa.listar(), repositorios.contraparte.listar({ incluirArquivados: true }), responsavelSugerida()]);
  return { contratos, produtos, pessoas, contrapartes, sugerida };
}

/**
 * "Criar implantação" (T11.02 e T12.01, RN-12.01): a prévia mostra o que vem do contrato e as tarefas
 * sugeridas (RN-12.04), que se escolhem antes de criar. Criar de novo abre a que já existe.
 */
export function JanelaCriarImplantacao({ contratoId: contratoInicial, aoFechar, aoCriar }: { contratoId?: string; aoFechar: () => void; aoCriar: (id: string) => void }) {
  const consulta = useConsulta(() => carregar(contratoInicial), [contratoInicial]);
  const [contratoId, setContratoId] = useState(contratoInicial ?? '');
  const [produtoId, setProdutoId] = useState('');
  const [responsavelId, setResponsavelId] = useState('');
  const [tarefas, setTarefas] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const produtos = useConsulta(() => (contratoId ? produtosParaImplantar(contratoId) : Promise.resolve(null)), [contratoId]);
  const disponiveis = produtos.dados?.produtos ?? [];
  const previa = useConsulta(() => (contratoId && produtoId ? previaDaImplantacao(contratoId, produtoId) : Promise.resolve(null)), [contratoId, produtoId]);

  useEffect(() => {
    if (consulta.dados && !responsavelId) setResponsavelId(consulta.dados.sugerida);
  }, [consulta.dados, responsavelId]);
  useEffect(() => {
    // Com um produto só, ele vem escolhido; com vários, o primeiro ainda sem implantação.
    if (disponiveis.length && !disponiveis.some((linha) => linha.produtoId === produtoId)) setProdutoId((disponiveis.find((linha) => !linha.implantacaoId) ?? disponiveis[0])!.produtoId);
  }, [disponiveis, produtoId]);
  useEffect(() => {
    setTarefas(previa.dados?.tarefas.map((tarefa) => tarefa.titulo) ?? []);
  }, [previa.dados]);

  const dados = consulta.dados;
  const nomeDoProduto = (id: string) => dados?.produtos.find((produto) => produto.id === id)?.nome ?? 'Produto removido';
  const existente = previa.dados?.jaExiste ?? null;

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (existente) {
      aoCriar(existente.id);
      return;
    }
    if (!contratoId || !produtoId) {
      aviso('Escolha o contrato e o produto.');
      return;
    }
    setSalvando(true);
    try {
      const resultado = await criarImplantacao(contratoId, produtoId, { responsavelId, tarefas });
      aviso(resultado.criada ? `Implantação ${resultado.implantacao.codigo} criada${resultado.tarefas ? `, com ${resultado.tarefas} ${resultado.tarefas === 1 ? 'tarefa' : 'tarefas'} no Meu dia` : ''}.` : 'Esta implantação já existia: nada foi duplicado.');
      aoCriar(resultado.implantacao.id);
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    } finally {
      setSalvando(false);
    }
  }

  const contraparte = previa.dados ? dados?.contrapartes.find((linha) => linha.id === previa.dados?.contrato.contraparte_id) : null;
  return (
    <JanelaFormulario aberto larga aoFechar={aoFechar} titulo="Criar implantação" descricao="Uma por produto do contrato. O que vem do contrato fica só para leitura." aoEnviar={enviar} salvando={salvando} rotuloSalvar={existente ? 'Abrir a implantação' : 'Criar implantação'}>
      {!dados ? (
        <EstadoCarregando linhas={3} />
      ) : (
        <div className="grid gap-[18px]">
          {!contratoInicial && (
            <Campo id="criar-imp-contrato" rotulo="Contrato" obrigatorio ajuda={dados.contratos?.length ? 'Só os assinados com item de implantação ou sob medida ainda por implantar.' : undefined}>
              {(controle) => (
                <Selecao {...controle} value={contratoId} onChange={(evento) => { setContratoId(evento.target.value); setProdutoId(''); }}>
                  <option value="">Escolha</option>
                  {(dados.contratos ?? []).map(({ contrato }) => (
                    <option key={contrato.id} value={contrato.id}>
                      {contrato.codigo} · {contrato.titulo}
                    </option>
                  ))}
                </Selecao>
              )}
            </Campo>
          )}
          {!contratoInicial && !dados.contratos?.length && <Faixa>Nenhum contrato assinado com item de implantação ou sob medida por implantar. A implantação nasce do contrato (RN-12.01); contratação de uso imediato dispensa implantação.</Faixa>}
          {produtos.dados?.motivo && <Faixa tipo="atencao">{produtos.dados.motivo}</Faixa>}
          {produtos.dados && produtos.dados.semProduto.length > 0 && <Faixa>Itens sem produto não viram implantação: {produtos.dados.semProduto.map((item) => item.descricao).join(', ')}.</Faixa>}
          {disponiveis.length > 1 && (
            <Campo id="criar-imp-produto" rotulo="Produto" obrigatorio>
              {(controle) => (
                <Selecao {...controle} value={produtoId} onChange={(evento) => setProdutoId(evento.target.value)}>
                  {disponiveis.map((linha) => (
                    <option key={linha.produtoId} value={linha.produtoId}>
                      {nomeDoProduto(linha.produtoId)}
                      {linha.implantacaoId ? ' (já tem implantação)' : ''}
                    </option>
                  ))}
                </Selecao>
              )}
            </Campo>
          )}
          {existente && (
            <Faixa acao={<LinkCentral href={`/operacao/${existente.id}`} className="font-semibold underline">Abrir {existente.codigo}</LinkCentral>}>
              Este produto já tem a implantação {existente.codigo}. Criar de novo não duplica.
            </Faixa>
          )}
          {previa.dados && !existente && (
            <>
              <ListaDeDados>
                <Dado rotulo="Produto">{nomeDoProduto(previa.dados.produtoId)}</Dado>
                <Dado rotulo="Contraparte">{contraparte ? nomeDaContraparte(contraparte) : null}</Dado>
                <Dado rotulo="Entrega contratual">{previa.dados.entrega.prazo ? (previa.dados.entrega.prazo.pendente ? previa.dados.entrega.prazo.texto : formatarDiaISO(previa.dados.entrega.prazo.data)) : 'Sem prazo contratual de entrega'}</Dado>
                <Dado rotulo="Horas estimadas">{previa.dados.horasEstimadas === null ? 'Não estimadas' : formatarHoras(previa.dados.horasEstimadas)}</Dado>
                <Dado rotulo="Prazo estimado">{previa.dados.prazoEstimadoDias === null ? 'Não estimado' : `${previa.dados.prazoEstimadoDias} dias`}</Dado>
                <Dado rotulo="Critérios de aceite">{previa.dados.aceiteCriterios}</Dado>
              </ListaDeDados>
              <Campo id="criar-imp-responsavel" rotulo="Responsável" obrigatorio ajuda="Sugerida pela área de Tecnologia (D11).">
                {(controle) => <SelecaoPessoa {...controle} pessoas={pessoasDoSeletor(dados.pessoas)} vazio="Escolha" value={responsavelId} onChange={(evento) => setResponsavelId(evento.target.value)} />}
              </Campo>
              <fieldset>
                <legend className="mb-[7px] texto-rotulo">Tarefas no Meu dia</legend>
                {previa.dados.tarefas.length ? (
                  <ul className="grid gap-1" aria-label="Tarefas sugeridas">
                    {previa.dados.tarefas.map((tarefa) => (
                      <li key={tarefa.titulo}>
                        <label className="flex min-h-11 items-center gap-2.5 text-[13px] md:min-h-8">
                          <input type="checkbox" className="size-[18px] accent-[var(--indigo-dk)]" checked={tarefas.includes(tarefa.titulo)} onChange={(evento) => setTarefas((atuais) => (evento.target.checked ? [...atuais, tarefa.titulo] : atuais.filter((titulo) => titulo !== tarefa.titulo)))} />
                          <span>
                            {tarefa.titulo}
                            {tarefa.horas !== null && <span className="text-ink-soft"> · {formatarHoras(tarefa.horas)} estimadas</span>}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[13px] text-ink-soft">Sem entregas na viabilidade nem itens sob medida: nenhuma tarefa sugerida.</p>
                )}
                <p className="mt-1.5 text-xs text-ink-soft">Uma por entrega da viabilidade e por item sob medida, sem prazo: as datas são da operação.</p>
              </fieldset>
            </>
          )}
        </div>
      )}
    </JanelaFormulario>
  );
}
