'use client';

/**
 * T07.10 (19 §4): a aba "Contrato" da ficha do produto. Formulário com versões, como os documentos legais (T09.02):
 * Salvar rascunho · Enviar para validação · Validar ou Devolver · nova versão ao editar uma Validada.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Plus, Trash2, Wand2 } from 'lucide-react';
import { Campo } from '@/componentes/campos/campo';
import { Selecao } from '@/componentes/campos/selecao';
import { useCentral } from '@/componentes/layout/central-provider';
import { useAlteracoesPendentes } from '@/componentes/layout/protecao-saida';
import { aviso } from '@/componentes/padroes/aviso';
import { Confirmacao } from '@/componentes/padroes/confirmacao';
import { EtiquetaSituacao, type TipoSituacao } from '@/componentes/padroes/etiquetas';
import { Faixa } from '@/componentes/padroes/faixa';
import { CartaoDaFicha } from '@/componentes/produtos/aparencia';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { Textarea } from '@/componentes/ui/textarea';
import { mensagemDoErro } from '@/dados/erros';
import { repositorios } from '@/dados/repositorios';
import { FORMATOS_DE_EXPORTACAO, MODALIDADES_DE_ACESSO, type ConfiguracaoContratualRegistro } from '@/dados/tipos/precificacao';
import { useConsulta } from '@/dados/use-consulta';
import {
  aplicarSugestaoDoInventario,
  devolverConfiguracao,
  enviarParaValidacao,
  errosDoFormulario,
  formularioDaConfiguracao,
  formularioInicial,
  pendenciasDaConfiguracao,
  ROTULOS_SITUACAO_CONFIGURACAO,
  salvarRascunhoDaConfiguracao,
  validarConfiguracao,
  versoesDaConfiguracao,
  type FormularioConfiguracao,
} from '@/dominio/configuracao-contratual';
import { formatarDataHora } from '@/lib/formatacao';

const TOM: Record<ConfiguracaoContratualRegistro['situacao'], TipoSituacao> = { rascunho: 'neutro', em_validacao: 'atencao', validada: 'sucesso', substituida: 'neutro' };

type CampoSimples = Exclude<keyof FormularioConfiguracao, 'modalidades' | 'formatos_exportacao' | 'suboperadores'>;

/** Prazos e avisos: rótulo, unidade e cláusula, na ordem de 19 §4. */
const PRAZOS: readonly [CampoSimples, string, string][] = [
  ['prazo_reembolso_dias', 'Prazo de reembolso', 'dias · cl. 5.2, 12.3 e 18.5'],
  ['aviso_alteracao_dias', 'Aviso de alteração de preço ou função', 'dias, 30 ou mais · cl. 7.2'],
  ['aviso_renovacao_anual_dias', 'Aviso de renovação anual', 'dias · se houver plano anual'],
  ['aviso_manutencao_horas', 'Aviso de manutenção programada', 'horas · cl. 11.2'],
  ['aviso_suboperador_dias', 'Aviso de novo suboperador', 'dias · cl. 15.5'],
  ['prazo_encaminhar_titular_dias', 'Encaminhar pedido de titular', 'dias úteis · cl. 15.7'],
  ['prazo_aviso_incidente_horas', 'Aviso de incidente à contratante', 'horas, até 72 · cl. 16.3'],
  ['prazo_reativacao_horas', 'Reativação após o pagamento', 'horas úteis · cl. 18.4 c'],
  ['aviso_resilicao_dias', 'Aviso de encerramento pelas licenciantes', 'dias, 30 ou mais · cl. 18.5'],
  ['prazo_cura_dias', 'Prazo para corrigir descumprimento', 'dias · cl. 18.6'],
  ['aviso_cessao_dias', 'Aviso de cessão', 'dias · cl. 21'],
  ['prazo_exportacao_dias', 'Exportação após o fim', 'dias · cl. 19.2'],
  ['prazo_exclusao_dias', 'Exclusão da base operacional', 'dias · cl. 19.3'],
  ['prazo_expurgo_backup_dias', 'Expurgo das cópias de segurança', 'dias · igual ou maior que a retenção'],
];

function Grupo({ titulo, descricao, children }: { titulo: string; descricao?: string; children: ReactNode }) {
  return (
    <fieldset className="grid gap-[18px] border-t border-line pt-4 md:grid-cols-2">
      <legend className="float-left mb-1 w-full text-sm font-semibold md:col-span-2">
        {titulo}
        {descricao && <span className="mt-0.5 block text-[13px] font-normal text-ink-soft">{descricao}</span>}
      </legend>
      {children}
    </fieldset>
  );
}

function Marcas<T extends string>({ rotulo, opcoes, valor, aoMudar, desligado }: { rotulo: string; opcoes: readonly T[]; valor: T[]; aoMudar: (valor: T[]) => void; desligado: boolean }) {
  return (
    <div role="group" aria-label={rotulo}>
      <p className="mb-1.5 text-[13px] font-semibold">{rotulo}</p>
      <div className="flex flex-wrap gap-x-4">
        {opcoes.map((opcao) => (
          <label key={opcao} className="flex min-h-11 cursor-pointer items-center gap-2 text-sm md:min-h-9">
            <input type="checkbox" className="size-[18px] accent-[var(--ok)]" disabled={desligado} checked={valor.includes(opcao)} onChange={(evento) => aoMudar(evento.target.checked ? [...valor, opcao] : valor.filter((atual) => atual !== opcao))} />
            {opcao}
          </label>
        ))}
      </div>
    </div>
  );
}

export function AbaContrato({ produtoId }: { produtoId: string }) {
  const { pessoa } = useCentral();
  const consulta = useConsulta(async () => {
    const [versoes, inicial, ofertas] = await Promise.all([versoesDaConfiguracao(produtoId), formularioInicial(produtoId), repositorios.oferta.listar({ onde: { produto_id: produtoId } })]);
    return { versoes, inicial, gratuitas: ofertas.filter((oferta) => oferta.tipo === 'gratuidade') };
  }, [produtoId]);
  const [formulario, setFormulario] = useState<FormularioConfiguracao | null>(null);
  const [salvo, setSalvo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [pendencias, setPendencias] = useState<string[]>([]);
  const [devolvendo, setDevolvendo] = useState(false);

  const ultima = consulta.dados?.versoes[0] ?? null;
  const validada = consulta.dados?.versoes.find((versao) => versao.situacao === 'validada') ?? null;

  useEffect(() => {
    if (!consulta.dados) return;
    const base = ultima ? formularioDaConfiguracao(ultima) : consulta.dados.inicial;
    setFormulario(base);
    setSalvo(JSON.stringify(base));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recomeça do que está salvo a cada leitura
  }, [consulta.dados]);

  // A faixa acompanha o que está sendo preenchido, não só o que foi salvo.
  useEffect(() => {
    if (!formulario) return;
    let atual = true;
    void pendenciasDaConfiguracao(produtoId, formulario).then((lista) => atual && setPendencias(lista));
    return () => {
      atual = false;
    };
  }, [produtoId, formulario]);

  const alterado = formulario !== null && JSON.stringify(formulario) !== salvo;
  useAlteracoesPendentes(alterado);

  if (consulta.estado === 'carregando' || !formulario || !consulta.dados) return <p className="text-sm text-ink-soft">Carregando…</p>;

  const emValidacao = ultima?.situacao === 'em_validacao';
  const erros = errosDoFormulario(formulario);
  const mudar = (parcial: Partial<FormularioConfiguracao>) => setFormulario((atual) => (atual ? { ...atual, ...parcial } : atual));
  const texto = (campo: CampoSimples, rotulo: string, opcoes: { ajuda?: string; longo?: boolean; tipo?: string; largo?: boolean } = {}) => (
    <div className={opcoes.largo || opcoes.longo ? 'md:col-span-2' : undefined}>
      <Campo id={`contrato-${campo}`} rotulo={rotulo} ajuda={opcoes.ajuda} erro={erros[campo]}>
        {(controle) =>
          opcoes.longo ? (
            <Textarea {...controle} disabled={emValidacao} value={formulario[campo]} onChange={(evento) => mudar({ [campo]: evento.target.value })} />
          ) : (
            <Input {...controle} type={opcoes.tipo === 'numero' ? 'text' : opcoes.tipo} inputMode={opcoes.tipo === 'numero' ? 'numeric' : undefined} autoComplete="off" disabled={emValidacao} value={formulario[campo]} onChange={(evento) => mudar({ [campo]: evento.target.value })} />
          )
        }
      </Campo>
    </div>
  );

  async function executar(acao: () => Promise<unknown>, mensagem: string) {
    setOcupado(true);
    try {
      await acao();
      aviso(mensagem);
      consulta.recarregar();
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    } finally {
      setOcupado(false);
    }
  }

  const proximaVersao = !ultima || ultima.situacao === 'validada' || ultima.situacao === 'substituida' ? (ultima?.versao ?? 0) + 1 : ultima.versao;

  return (
    <div className="grid gap-4">
      <CartaoDaFicha
        titulo="Configuração contratual"
        acao={
          ultima ? (
            <EtiquetaSituacao tipo={TOM[ultima.situacao]}>
              V{ultima.versao} · {ROTULOS_SITUACAO_CONFIGURACAO[ultima.situacao]}
            </EtiquetaSituacao>
          ) : (
            <EtiquetaSituacao tipo="neutro">Sem versão</EtiquetaSituacao>
          )
        }
      >
        <p className="text-[13px] text-ink-soft">
          Prazos, avisos, modalidades e o Anexo II que o contrato de assinatura (T11.14) usa. Só a versão Validada vale para a emissão final; o contrato emitido guarda a versão usada.
        </p>
        {validada && validada.id !== ultima?.id && (
          <p className="mt-2 text-[13px]">
            Vale hoje a V{validada.versao}, validada{validada.validado_em ? ` em ${formatarDataHora(validada.validado_em)}` : ''}. A V{ultima?.versao} só passa a valer depois de validada.
          </p>
        )}
        {ultima?.devolucao_motivo && ultima.situacao === 'rascunho' && (
          <Faixa tipo="atencao" className="mt-3">
            Devolvida: {ultima.devolucao_motivo}
          </Faixa>
        )}
        {emValidacao && (
          <Faixa tipo="info" className="mt-3">
            Em validação: os campos ficam bloqueados. Valide ou devolva para rascunho. Sem permissões nesta etapa (D27): a validação registra quem está em “Você é”.
          </Faixa>
        )}
        {!emValidacao && pendencias.length > 0 && (
          <Faixa tipo="info" className="mt-3">
            <details>
              <summary className="cursor-pointer">
                Para enviar à validação, {pendencias.length === 1 ? 'falta 1 campo' : `faltam ${pendencias.length} campos`}. Dá para salvar o rascunho antes.
              </summary>
              <p className="mt-1.5">{pendencias.join(' · ')}</p>
            </details>
          </Faixa>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {emValidacao && ultima ? (
            <>
              <Button disabled={ocupado} onClick={() => void executar(() => validarConfiguracao(ultima.id, pessoa.id || null), `V${ultima.versao} validada.`)}>
                Validar
              </Button>
              <Button variante="secundario" disabled={ocupado} onClick={() => setDevolvendo(true)}>
                Devolver
              </Button>
            </>
          ) : (
            <>
              <Button disabled={ocupado || !alterado} onClick={() => void executar(() => salvarRascunhoDaConfiguracao(produtoId, formulario), `Rascunho salvo (V${proximaVersao}).`)}>
                {ultima?.situacao === 'validada' ? `Salvar como V${proximaVersao}` : 'Salvar rascunho'}
              </Button>
              <Button variante="secundario" disabled={ocupado} onClick={() => void executar(() => enviarParaValidacao(produtoId, formulario, pessoa.id || null), `V${proximaVersao} enviada para validação.`)}>
                Enviar para validação
              </Button>
              {alterado && (
                <Button variante="terciario" disabled={ocupado} onClick={() => setFormulario(JSON.parse(salvo) as FormularioConfiguracao)}>
                  Descartar
                </Button>
              )}
            </>
          )}
        </div>
      </CartaoDaFicha>

      <CartaoDaFicha titulo="Campos do contrato">
        <div className="grid gap-5">
          <Grupo titulo="O produto no contrato">
            {texto('nome_maiusculo', 'Nome em maiúsculas', { ajuda: 'Vem do nome do produto.' })}
            {texto('email_contato', 'E-mail de contato contratual', { ajuda: 'Cl. 22.', tipo: 'email' })}
            {texto('descricao_contratual', 'Descrição contratual', { longo: true, ajuda: 'O que o software faz, em uma frase, sem promessa de resultado.' })}
            {texto('funcoes_de_apoio', 'Funções de apoio', { longo: true, ajuda: 'Lista usada na cl. 13.1.' })}
            <div className="md:col-span-2">
              <Marcas rotulo="Modalidades disponíveis" opcoes={MODALIDADES_DE_ACESSO} valor={formulario.modalidades} aoMudar={(modalidades) => mudar({ modalidades })} desligado={emValidacao} />
            </div>
            {texto('diferencas_modalidades', 'Diferenças entre modalidades', { longo: true, ajuda: 'Opcional. Anexo I, item 6.' })}
            <div className="md:col-span-2">
              <Campo id="contrato-plano_apos_teste" rotulo="Plano após o fim do teste" ajuda="Oferta do tipo Gratuidade. Obrigatório se alguma oferta tiver teste grátis.">
                {(controle) => (
                  <Selecao {...controle} disabled={emValidacao} value={formulario.plano_apos_teste} onChange={(evento) => mudar({ plano_apos_teste: evento.target.value })}>
                    <option value="">{consulta.dados!.gratuitas.length ? 'Escolha' : 'Nenhuma oferta de Gratuidade neste produto'}</option>
                    {consulta.dados!.gratuitas.map((oferta) => (
                      <option key={oferta.id} value={oferta.id}>
                        {oferta.nome}
                      </option>
                    ))}
                  </Selecao>
                )}
              </Campo>
            </div>
          </Grupo>

          <Grupo titulo="Links publicados" descricao="Dos documentos do M09. Use o endereço publicado de cada um.">
            {texto('url_termos', 'Termos de Uso', { tipo: 'url' })}
            {texto('url_privacidade', 'Política de Privacidade', { tipo: 'url' })}
            {texto('url_ajuda', 'Central de ajuda', { tipo: 'url' })}
          </Grupo>

          <Grupo titulo="Prazos e avisos" descricao="Números inteiros. O contrato usa exatamente o que estiver aqui.">
            {PRAZOS.map(([campo, rotulo, ajuda]) => (
              <div key={campo}>{texto(campo, rotulo, { ajuda, tipo: 'numero' })}</div>
            ))}
            <div className="md:col-span-2">
              <Marcas rotulo="Formatos de exportação" opcoes={FORMATOS_DE_EXPORTACAO} valor={formulario.formatos_exportacao} aoMudar={(formatos_exportacao) => mudar({ formatos_exportacao })} desligado={emValidacao} />
              <p className="mt-1 text-[13px] text-ink-soft">Só os formatos que o produto exporta de fato.</p>
            </div>
          </Grupo>

          <Grupo titulo="Anexo II: dados pessoais" descricao="Só controles e fornecedores que existem de fato. O inventário do M09 sugere; você confere.">
            <div className="md:col-span-2">
              <Button
                variante="terciario"
                tamanho="pequeno"
                disabled={emValidacao || ocupado}
                onClick={() =>
                  void aplicarSugestaoDoInventario(produtoId, formulario).then(({ formulario: novo, aplicados }) => {
                    setFormulario(novo);
                    aviso(aplicados ? 'Sugestão do inventário aplicada nos campos vazios. Confira antes de salvar.' : 'O inventário não tem nada novo para os campos vazios deste produto.');
                  })
                }
              >
                <Wand2 aria-hidden />
                Sugerir pelo inventário
              </Button>
            </div>
            {texto('categorias_dados_operador', 'Dados tratados como operadora', { longo: true })}
            {texto('categorias_titulares', 'Titulares', { longo: true })}
            {texto('categorias_dados_controlador', 'Dados tratados como controladora', { longo: true })}
            {texto('provedor_infraestrutura', 'Provedor de infraestrutura')}
            {texto('local_armazenamento', 'Local de armazenamento')}
            {texto('transferencia_internacional_texto', 'Transferência internacional', { longo: true, ajuda: 'Se houver, diga o mecanismo (por exemplo, cláusulas-padrão da ANPD).' })}
            <div className="md:col-span-2">
              <p className="mb-1.5 text-[13px] font-semibold">Suboperadores</p>
              {erros.suboperadores && <p className="mb-1.5 text-[13px] text-err">{erros.suboperadores}</p>}
              <ul className="grid gap-2">
                {formulario.suboperadores.map((item, indice) => (
                  <li key={indice} className="grid gap-2 md:grid-cols-[1fr_1fr_160px_auto] md:items-end">
                    {(['nome', 'finalidade', 'pais'] as const).map((parte) => (
                      <Campo key={parte} id={`contrato-sub-${indice}-${parte}`} rotulo={{ nome: 'Nome', finalidade: 'Finalidade', pais: 'País' }[parte]}>
                        {(controle) => <Input {...controle} autoComplete="off" disabled={emValidacao} value={item[parte]} onChange={(evento) => mudar({ suboperadores: formulario.suboperadores.map((atual, i) => (i === indice ? { ...atual, [parte]: evento.target.value } : atual)) })} />}
                      </Campo>
                    ))}
                    <Button variante="terciario" tamanho="pequeno" disabled={emValidacao} onClick={() => mudar({ suboperadores: formulario.suboperadores.filter((_, i) => i !== indice) })}>
                      <Trash2 aria-hidden />
                      Remover
                    </Button>
                  </li>
                ))}
              </ul>
              <Button className="mt-2" variante="terciario" tamanho="pequeno" disabled={emValidacao} onClick={() => mudar({ suboperadores: [...formulario.suboperadores, { nome: '', finalidade: '', pais: '' }] })}>
                <Plus aria-hidden />
                Adicionar suboperador
              </Button>
            </div>
            {texto('medidas_seguranca', 'Medidas de segurança', { longo: true })}
            {texto('backup_frequencia', 'Frequência das cópias de segurança')}
            {texto('backup_retencao_dias', 'Retenção das cópias (dias)', { tipo: 'numero' })}
            {texto('procedimento_recuperacao', 'Procedimento de recuperação', { longo: true })}
            {texto('canal_privacidade', 'Canal de privacidade', { ajuda: 'E-mail ou endereço. Começa pelo canal do titular de Configurações.' })}
            {texto('canal_incidentes', 'Canal de incidentes', { ajuda: 'E-mail ou endereço.' })}
          </Grupo>
        </div>
      </CartaoDaFicha>

      {consulta.dados.versoes.length > 0 && (
        <CartaoDaFicha titulo="Versões">
          <ul className="grid gap-1.5 text-sm">
            {consulta.dados.versoes.map((versao) => (
              <li key={versao.id} className="flex flex-wrap items-center gap-2">
                <strong>V{versao.versao}</strong>
                <EtiquetaSituacao tipo={TOM[versao.situacao]}>{ROTULOS_SITUACAO_CONFIGURACAO[versao.situacao]}</EtiquetaSituacao>
                <span className="text-[13px] text-ink-soft">{versao.validado_em ? `validada em ${formatarDataHora(versao.validado_em)}` : `atualizada em ${formatarDataHora(versao.atualizado_em)}`}</span>
              </li>
            ))}
          </ul>
        </CartaoDaFicha>
      )}

      {ultima && (
        <Confirmacao
          aberto={devolvendo}
          aoFechar={() => setDevolvendo(false)}
          titulo={`Devolver a V${ultima.versao} para rascunho?`}
          texto="O motivo fica à vista de quem for corrigir."
          rotuloConfirmar="Devolver"
          pedirMotivo
          mensagemSemMotivo="Informe o motivo da devolução."
          aoConfirmar={(motivo) => {
            setDevolvendo(false);
            void executar(() => devolverConfiguracao(ultima.id, motivo), `V${ultima.versao} devolvida para rascunho.`);
          }}
        />
      )}
    </div>
  );
}
