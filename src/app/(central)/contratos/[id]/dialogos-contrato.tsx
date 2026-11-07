'use client';

import { useEffect, useState } from 'react';
import { Campo, MensagemErro } from '@/componentes/campos/campo';
import { EntradaData } from '@/componentes/campos/entrada-data';
import { EntradaLinkDrive } from '@/componentes/campos/link-drive';
import { Selecao } from '@/componentes/campos/selecao';
import type { TelaDoContrato } from '@/componentes/f1/dados-contrato';
import { aviso } from '@/componentes/padroes/aviso';
import { Faixa } from '@/componentes/padroes/faixa';
import { JanelaFormulario } from '@/componentes/padroes/janela-formulario';
import { Input } from '@/componentes/ui/input';
import { Textarea } from '@/componentes/ui/textarea';
import { mensagemDoErro } from '@/dados/erros';
import type { EventoContrato } from '@/dados/tipos/contrato';
import { ativarProgramacao, CATEGORIA_RECORRENTE, CATEGORIA_UNICA, correcaoAdministrativa, criarAditivo, encerrarContrato, impactoDoEvento, previaDaProgramacao, previaDoEncerramento, registrarAssinatura, registrarEnvioParaAssinatura, registrarEvento, ROTULOS_ENCERRAMENTO, ROTULOS_EVENTO, suspenderContrato, type ImpactoDoEvento, type PrevisaoDaProgramacao, type PreviaDoEncerramento, CHECKLIST_DE_SAIDA } from '@/dominio/contratos';
import { hojeISO } from '@/lib/datas';
import { formatarDiaISO, formatarDinheiro } from '@/lib/formatacao';

type Props = { tela: TelaDoContrato; aoFechar: () => void };

function useEnvio<T>(acao: () => Promise<T>, mensagem: string, aoFechar: () => void) {
  const [erro, setErro] = useState<string | null>(null);
  const enviar = (evento: React.FormEvent) => {
    evento.preventDefault();
    setErro(null);
    void acao().then(
      () => {
        aviso(mensagem);
        aoFechar();
      },
      (problema: unknown) => setErro(mensagemDoErro(problema)),
    );
  };
  return { erro, enviar };
}

/** T11.06, envio: o documento final aprovado vai para assinatura. A plataforma eletrônica é registrada à mão até a F3. */
export function DialogoEnvioAssinatura({ tela, aoFechar }: Props) {
  const [data, setData] = useState(hojeISO());
  const [canal, setCanal] = useState('E-mail');
  const [destinatarios, setDestinatarios] = useState('');
  const { erro, enviar } = useEnvio(() => registrarEnvioParaAssinatura(tela.ficha.contrato.id, { data, canal, destinatarios }), 'Envio registrado. O alerta de assinatura pendente vem em 5 dias.', aoFechar);
  return (
    <JanelaFormulario aberto aoFechar={aoFechar} titulo="Registrar envio para assinatura" rotuloSalvar="Registrar envio" aoEnviar={enviar}>
      <div className="grid gap-[18px]">
        <Campo id="env-data" rotulo="Data" obrigatorio>{(controle) => <EntradaData {...controle} value={data} onChange={(evento) => setData(evento.target.value)} />}</Campo>
        <Campo id="env-canal" rotulo="Canal" obrigatorio ajuda="E-mail, plataforma de assinatura externa ou presencial.">{(controle) => <Input {...controle} value={canal} onChange={(evento) => setCanal(evento.target.value)} />}</Campo>
        <Campo id="env-para" rotulo="Destinatários" obrigatorio>{(controle) => <Input {...controle} value={destinatarios} onChange={(evento) => setDestinatarios(evento.target.value)} />}</Campo>
        {erro && <MensagemErro>{erro}</MensagemErro>}
      </div>
    </JanelaFormulario>
  );
}

/** T11.06, assinatura (RN-11.09 e CA-11.05): por parte, com o arquivo assinado (não a pasta) e a evidência. */
export function DialogoAssinatura({ tela, aoFechar }: Props) {
  const [datas, setDatas] = useState<Record<string, string>>(Object.fromEntries(tela.ficha.signatarios.map((linha) => [linha.id, ''])));
  const [arquivo, setArquivo] = useState('');
  const [evidencia, setEvidencia] = useState('');
  const nome = (id: string) => tela.pessoas.find((pessoa) => pessoa.id === id)?.nome_completo ?? 'Pessoa removida';
  const { erro, enviar } = useEnvio(() => registrarAssinatura(tela.ficha.contrato.id, { datas, arquivoUrl: arquivo, evidenciaUrl: evidencia }), 'Assinatura registrada. A versão foi publicada.', aoFechar);
  return (
    <JanelaFormulario aberto aoFechar={aoFechar} titulo="Registrar assinatura" descricao="Publica a versão com o retrato das partes e registra o evento Assinatura." rotuloSalvar="Confirmar assinatura" alterado={Boolean(arquivo || evidencia)} aoEnviar={enviar}>
      <div className="grid gap-[18px]">
        {tela.ficha.signatarios.map((linha) => (
          <Campo key={linha.id} id={`ass-${linha.id}`} rotulo={`${nome(linha.pessoa_id)} (${linha.parte === 'numa' ? 'Numa' : 'contraparte'}): assinou em`} obrigatorio>
            {(controle) => <EntradaData {...controle} value={datas[linha.id] ?? ''} onChange={(evento) => setDatas((atual) => ({ ...atual, [linha.id]: evento.target.value }))} />}
          </Campo>
        ))}
        {!tela.ficha.signatarios.length && <Faixa tipo="erro">Não há signatários nesta versão. Devolva para rascunho e escolha quem assina.</Faixa>}
        <Campo id="ass-arquivo" rotulo="Arquivo assinado (link do Drive)" obrigatorio ajuda="O arquivo, na versão assinada. Link de pasta não serve.">{(controle) => <EntradaLinkDrive {...controle} link={arquivo} value={arquivo} onChange={(evento) => setArquivo(evento.target.value)} />}</Campo>
        <Campo id="ass-evidencia" rotulo="Evidência (e-mail, registro da plataforma)" obrigatorio>{(controle) => <EntradaLinkDrive {...controle} link={evidencia} value={evidencia} onChange={(evento) => setEvidencia(evento.target.value)} />}</Campo>
        {erro && <MensagemErro>{erro}</MensagemErro>}
      </div>
    </JanelaFormulario>
  );
}

/** T11.07 (P6 e CA-11.06): a prévia completa da janela; o que já existe aparece como "já gerado". */
export function DialogoProgramacao({ tela, aoFechar }: Props) {
  const [previa, setPrevia] = useState<PrevisaoDaProgramacao | null>(null);
  const [erroPrevia, setErroPrevia] = useState<string | null>(null);
  const categorias = tela.categorias.filter((categoria) => categoria.pai_id && !categoria.arquivado_em);
  const natureza = tela.ficha.contrato.familia === 'fornecedor' ? 'despesa' : 'receita';
  const sugerida = (nome: string) => (natureza === 'receita' ? (categorias.find((categoria) => categoria.nome === nome)?.id ?? '') : '');
  const [recorrente, setRecorrente] = useState(sugerida(CATEGORIA_RECORRENTE));
  const [unica, setUnica] = useState(sugerida(CATEGORIA_UNICA));
  useEffect(() => {
    void previaDaProgramacao(tela.ficha.contrato.id).then(setPrevia, (problema: unknown) => setErroPrevia(mensagemDoErro(problema)));
  }, [tela.ficha.contrato.id]);
  const novas = previa?.linhas.filter((linha) => !linha.jaGerado) ?? [];
  const { erro, enviar } = useEnvio(() => ativarProgramacao(tela.ficha.contrato.id, { categoriaRecorrente: recorrente, categoriaUnica: unica }), novas.length ? `${novas.length} lançamentos previstos criados no Financeiro.` : 'Nada novo: todos os títulos já existem.', aoFechar);
  const opcoesCategoria = categorias.filter((categoria) => categoria.tipo === natureza).map((categoria) => <option key={categoria.id} value={categoria.id}>{categoria.nome}</option>);
  return (
    <JanelaFormulario larga aberto aoFechar={aoFechar} titulo="Ativar programação financeira" descricao={previa ? `Janela até ${formatarDiaISO(previa.janelaAte)}. Ativar de novo não duplica.` : undefined} rotuloSalvar={novas.length ? `Criar ${novas.length} lançamentos` : 'Confirmar'} aoEnviar={enviar}>
      <div className="grid gap-3">
        {erroPrevia && <Faixa tipo="erro">{erroPrevia}</Faixa>}
        {previa && (
          <>
            <div className="grid gap-3 md:grid-cols-2">
              <Campo id="prog-recorrente" rotulo="Categoria dos recorrentes" obrigatorio>{(controle) => <Selecao {...controle} value={recorrente} onChange={(evento) => setRecorrente(evento.target.value)}><option value="">Escolha</option>{opcoesCategoria}</Selecao>}</Campo>
              <Campo id="prog-unica" rotulo="Categoria dos valores únicos" obrigatorio>{(controle) => <Selecao {...controle} value={unica} onChange={(evento) => setUnica(evento.target.value)}><option value="">Escolha</option>{opcoesCategoria}</Selecao>}</Campo>
            </div>
            <div className="faixa-rolagem max-h-[50vh] rounded-md border border-line">
              <table className="w-full border-separate border-spacing-0 text-[13px]">
                <thead><tr>{['Item', 'Período', 'Competência', 'Vencimento', 'Valor', 'Natureza', 'Situação'].map((titulo) => <th key={titulo} scope="col" className="bg-mist px-3 py-2 text-left font-semibold whitespace-nowrap">{titulo}</th>)}</tr></thead>
                <tbody>
                  {previa.linhas.map((linha) => (
                    <tr key={linha.chave}>
                      <td className="border-t border-line px-3 py-1.5">{linha.descricao}</td>
                      <td className="border-t border-line px-3 py-1.5 whitespace-nowrap">{linha.periodo_inicio === linha.periodo_fim ? formatarDiaISO(linha.periodo_inicio) : `${formatarDiaISO(linha.periodo_inicio)} a ${formatarDiaISO(linha.periodo_fim)}`}</td>
                      <td className="border-t border-line px-3 py-1.5">{linha.competencia.slice(5, 7)}/{linha.competencia.slice(0, 4)}</td>
                      <td className="border-t border-line px-3 py-1.5 whitespace-nowrap">{formatarDiaISO(linha.vencimento)}{linha.aviso && <span className="block text-xs text-warn">{linha.aviso}</span>}</td>
                      <td className="border-t border-line px-3 py-1.5 text-right tabular-nums">{formatarDinheiro(linha.valor, tela.ficha.contrato.moeda)}</td>
                      <td className="border-t border-line px-3 py-1.5">{linha.natureza === 'receber' ? 'A receber' : 'A pagar'}</td>
                      <td className="border-t border-line px-3 py-1.5">{linha.jaGerado ? 'Já gerado' : 'A gerar'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!previa.linhas.length && <p className="text-sm text-ink-soft">Nenhum título a gerar.</p>}
            {previa.aguardando.map((linha) => <Faixa key={linha.descricao + linha.motivo}>{linha.descricao}: {linha.motivo}</Faixa>)}
          </>
        )}
        {erro && <MensagemErro>{erro}</MensagemErro>}
      </div>
    </JanelaFormulario>
  );
}

/** T11.08: antes de confirmar, o que passa a ter data. A assinatura tem caminho próprio. */
export function DialogoEvento({ tela, aoFechar }: Props) {
  const [tipo, setTipo] = useState<EventoContrato['tipo']>('entrega');
  const [nome, setNome] = useState('');
  const [produto, setProduto] = useState('');
  const [data, setData] = useState(hojeISO());
  const [evidencia, setEvidencia] = useState('');
  const [observacao, setObservacao] = useState('');
  const [impacto, setImpacto] = useState<ImpactoDoEvento | null>(null);
  useEffect(() => {
    if (!data) return setImpacto(null);
    void impactoDoEvento(tela.ficha.contrato.id, { tipo, nome: tipo === 'outro' ? nome : null, produto_id: tipo === 'entrega' ? produto || null : null, data }).then(setImpacto);
  }, [tela.ficha.contrato.id, tipo, nome, produto, data]);
  const { erro, enviar } = useEnvio(() => registrarEvento(tela.ficha.contrato.id, { tipo, nome, produto_id: produto, data, evidencia_url: evidencia, observacao }), 'Evento registrado.', aoFechar);
  return (
    <JanelaFormulario aberto aoFechar={aoFechar} titulo="Registrar evento" rotuloSalvar="Registrar evento" aoEnviar={enviar}>
      <div className="grid gap-[18px]">
        <Campo id="ev-tipo" rotulo="Evento" obrigatorio>{(controle) => <Selecao {...controle} value={tipo} onChange={(evento) => setTipo(evento.target.value as EventoContrato['tipo'])}>{(['inicio_vigencia', 'entrega', 'aceite', 'outro'] as const).map((valor) => <option key={valor} value={valor}>{ROTULOS_EVENTO[valor]}</option>)}</Selecao>}</Campo>
        {tipo === 'outro' && <Campo id="ev-nome" rotulo="Nome do evento" obrigatorio>{(controle) => <Input {...controle} value={nome} onChange={(evento) => setNome(evento.target.value)} />}</Campo>}
        {tipo === 'entrega' && <Campo id="ev-produto" rotulo="Produto entregue">{(controle) => <Selecao {...controle} value={produto} onChange={(evento) => setProduto(evento.target.value)}><option value="">Qualquer</option>{tela.produtos.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</Selecao>}</Campo>}
        <Campo id="ev-data" rotulo="Data" obrigatorio>{(controle) => <EntradaData {...controle} value={data} onChange={(evento) => setData(evento.target.value)} />}</Campo>
        <Campo id="ev-evidencia" rotulo="Evidência">{(controle) => <EntradaLinkDrive {...controle} link={evidencia} value={evidencia} onChange={(evento) => setEvidencia(evento.target.value)} />}</Campo>
        <Campo id="ev-observacao" rotulo="Observação">{(controle) => <Textarea {...controle} rows={2} value={observacao} onChange={(evento) => setObservacao(evento.target.value)} />}</Campo>
        {impacto && (impacto.prazos.length > 0 ? <Faixa>Passam a ter data: {impacto.prazos.map((prazo) => `${prazo.nome} em ${formatarDiaISO(prazo.data)}`).join('; ')}.{impacto.obrigacoes.length ? ` Obrigações afetadas: ${impacto.obrigacoes.join('; ')}.` : ''}</Faixa> : <p className="text-xs text-ink-soft">Nenhum prazo muda com este evento.</p>)}
        {erro && <MensagemErro>{erro}</MensagemErro>}
      </div>
    </JanelaFormulario>
  );
}

/** T11.09: "O que mudou?" Correção administrativa não mexe no assinado; o resto é aditivo. */
export function DialogoMudanca({ tela, aoFechar, aoCriarAditivo }: Props & { aoCriarAditivo: () => void }) {
  const [tipo, setTipo] = useState<'correcao' | 'aditivo'>('correcao');
  const administrativo = tela.ficha.contrato.administrativo;
  const [endereco, setEndereco] = useState(administrativo.endereco_correspondencia ?? '');
  const [banco, setBanco] = useState(administrativo.dados_bancarios ?? '');
  const [observacoes, setObservacoes] = useState(administrativo.observacoes ?? '');
  const [motivo, setMotivo] = useState('');
  const [efeito, setEfeito] = useState('');
  const [justificativa, setJustificativa] = useState('');
  const [resumo, setResumo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const enviar = (evento: React.FormEvent) => {
    evento.preventDefault();
    const acao = tipo === 'correcao' ? correcaoAdministrativa(tela.ficha.contrato.id, { endereco_correspondencia: endereco || null, dados_bancarios: banco || null, observacoes: observacoes || null }, motivo) : criarAditivo(tela.ficha.contrato.id, { tipo: 'aditivo', dataEfeito: efeito, justificativa, resumo }).then(() => aoCriarAditivo());
    void acao.then(
      () => {
        aviso(tipo === 'correcao' ? 'Correção registrada. O documento assinado não mudou.' : 'Aditivo criado em rascunho.');
        aoFechar();
      },
      (problema: unknown) => setErro(mensagemDoErro(problema)),
    );
  };
  return (
    <JanelaFormulario aberto aoFechar={aoFechar} titulo="Nova versão, aditivo ou correção" rotuloSalvar={tipo === 'correcao' ? 'Registrar correção' : 'Criar aditivo'} aoEnviar={enviar}>
      <div className="grid gap-[18px]">
        <fieldset>
          <legend className="mb-[7px] texto-rotulo">O que mudou? *</legend>
          <div className="flex flex-wrap gap-1.5">
            {(['correcao', 'aditivo'] as const).map((opcao) => <button key={opcao} type="button" aria-pressed={tipo === opcao} onClick={() => setTipo(opcao)} className={tipo === opcao ? 'min-h-11 rounded-pill border border-espresso bg-espresso px-4 text-[13px] font-semibold text-linen' : 'min-h-11 rounded-pill border border-line bg-paper px-4 text-[13px] font-semibold'}>{opcao === 'correcao' ? 'Correção administrativa' : 'Aditivo'}</button>)}
          </div>
        </fieldset>
        {tipo === 'correcao' ? (
          <>
            <p className="text-xs text-ink-soft">Só o que não tem efeito contratual. O retrato e o arquivo assinado continuam iguais (RN-11.11).</p>
            <Campo id="cor-endereco" rotulo="Endereço de correspondência">{(controle) => <Input {...controle} value={endereco} onChange={(evento) => setEndereco(evento.target.value)} />}</Campo>
            <Campo id="cor-banco" rotulo="Dados bancários de recebimento">{(controle) => <Input {...controle} value={banco} onChange={(evento) => setBanco(evento.target.value)} />}</Campo>
            <Campo id="cor-obs" rotulo="Observações">{(controle) => <Textarea {...controle} rows={2} value={observacoes} onChange={(evento) => setObservacoes(evento.target.value)} />}</Campo>
            <Campo id="cor-motivo" rotulo="Motivo" obrigatorio>{(controle) => <Textarea {...controle} rows={2} value={motivo} onChange={(evento) => setMotivo(evento.target.value)} />}</Campo>
          </>
        ) : (
          <>
            <p className="text-xs text-ink-soft">Cria a versão seguinte a partir da vigente, com o mesmo fluxo: revisão, documento, aprovação, envio e assinatura. A comparação detalhada entre versões e o recálculo financeiro do aditivo são da F2.</p>
            <Campo id="ad-efeito" rotulo="Data de efeito" obrigatorio>{(controle) => <EntradaData {...controle} value={efeito} onChange={(evento) => setEfeito(evento.target.value)} />}</Campo>
            {efeito && efeito < hojeISO() && <Campo id="ad-justificativa" rotulo="Justificativa da retroatividade" obrigatorio>{(controle) => <Input {...controle} value={justificativa} onChange={(evento) => setJustificativa(evento.target.value)} />}</Campo>}
            <Campo id="ad-resumo" rotulo="Resumo das mudanças">{(controle) => <Textarea {...controle} rows={2} value={resumo} onChange={(evento) => setResumo(evento.target.value)} />}</Campo>
          </>
        )}
        {erro && <MensagemErro>{erro}</MensagemErro>}
      </div>
    </JanelaFormulario>
  );
}

/** RN-11.23: títulos no período ficam marcados como suspensos, não cancelados. */
export function DialogoSuspensao({ tela, aoFechar }: Props) {
  const [inicio, setInicio] = useState(hojeISO());
  const [fim, setFim] = useState('');
  const [motivo, setMotivo] = useState('');
  const { erro, enviar } = useEnvio(() => suspenderContrato(tela.ficha.contrato.id, { inicio, fim, motivo }), 'Contrato suspenso.', aoFechar);
  return (
    <JanelaFormulario aberto aoFechar={aoFechar} titulo="Suspender contrato" rotuloSalvar="Suspender" aoEnviar={enviar}>
      <div className="grid gap-[18px]">
        <Campo id="sus-inicio" rotulo="Início" obrigatorio>{(controle) => <EntradaData {...controle} value={inicio} onChange={(evento) => setInicio(evento.target.value)} />}</Campo>
        <Campo id="sus-fim" rotulo="Fim" ajuda="Vazio: até a decisão.">{(controle) => <EntradaData {...controle} value={fim} onChange={(evento) => setFim(evento.target.value)} />}</Campo>
        <Campo id="sus-motivo" rotulo="Motivo" obrigatorio>{(controle) => <Textarea {...controle} rows={2} value={motivo} onChange={(evento) => setMotivo(evento.target.value)} />}</Campo>
        <p className="text-xs text-ink-soft">Os títulos com vencimento no período ficam marcados “suspenso”, sem cancelar.</p>
        {erro && <MensagemErro>{erro}</MensagemErro>}
      </div>
    </JanelaFormulario>
  );
}

/** T11.12 e CA-11.11: o que é cancelado e o que fica, antes de confirmar. */
export function DialogoEncerramento({ tela, aoFechar }: Props) {
  const [data, setData] = useState(hojeISO());
  const [motivo, setMotivo] = useState<keyof typeof ROTULOS_ENCERRAMENTO | ''>('');
  const [multa, setMulta] = useState('');
  const [descricao, setDescricao] = useState('');
  const [previa, setPrevia] = useState<PreviaDoEncerramento | null>(null);
  useEffect(() => {
    if (!data) return;
    void previaDoEncerramento(tela.ficha.contrato.id, data).then(setPrevia, () => setPrevia(null));
  }, [tela.ficha.contrato.id, data]);
  const { erro, enviar } = useEnvio(() => encerrarContrato(tela.ficha.contrato.id, { dataEfetiva: data, motivo, multaValor: multa.trim() ? Number(multa.replace(/\./g, '').replace(',', '.')) : null, multaDescricao: descricao }), 'Contrato encerrado. As atividades de saída estão no Meu dia.', aoFechar);
  return (
    <JanelaFormulario larga aberto aoFechar={aoFechar} titulo="Encerrar contrato" rotuloSalvar="Encerrar" aoEnviar={enviar}>
      <div className="grid gap-[18px] md:grid-cols-2">
        <Campo id="enc-data" rotulo="Data efetiva" obrigatorio>{(controle) => <EntradaData {...controle} value={data} onChange={(evento) => setData(evento.target.value)} />}</Campo>
        <Campo id="enc-motivo" rotulo="Motivo" obrigatorio>{(controle) => <Selecao {...controle} value={motivo} onChange={(evento) => setMotivo(evento.target.value as typeof motivo)}><option value="">Escolha</option>{Object.entries(ROTULOS_ENCERRAMENTO).map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}</Selecao>}</Campo>
        <Campo id="enc-multa" rotulo="Multa ou proporcionalidade (R$)" ajuda="Só se configurada no contrato. Vazio: sem multa.">{(controle) => <Input {...controle} inputMode="decimal" value={multa} onChange={(evento) => setMulta(evento.target.value)} />}</Campo>
        <Campo id="enc-multa-desc" rotulo="Como foi calculada">{(controle) => <Input {...controle} value={descricao} onChange={(evento) => setDescricao(evento.target.value)} />}</Campo>
        {previa && (
          <div className="grid gap-2 text-[13px] md:col-span-2">
            {previa.obrigacoesAbertas.length > 0 && <Faixa tipo="erro">Obrigações abertas: {previa.obrigacoesAbertas.map((obrigacao) => obrigacao.descricao).join('; ')}. Cumpra ou dispense na aba Obrigações antes de encerrar.</Faixa>}
            <p><strong>Serão cancelados</strong> ({previa.cancelar.length}): futuros não pagos depois de {formatarDiaISO(data)}. {previa.cancelar.slice(0, 6).map((titulo) => `${formatarDiaISO(titulo.vencimento)} ${formatarDinheiro(titulo.valor, titulo.moeda)}`).join(' · ')}{previa.cancelar.length > 6 ? ' · …' : ''}</p>
            <p><strong>Ficam</strong> ({previa.preservados.length}): os quitados, os com baixa e os que vencem até a data.</p>
            <p><strong>Saldo anterior em aberto</strong>: {previa.saldoAnterior.length ? previa.saldoAnterior.map((titulo) => `${formatarDiaISO(titulo.vencimento)} ${formatarDinheiro(titulo.valor, titulo.moeda)}`).join(' · ') : 'nenhum'}.</p>
            <p><strong>Atividades de saída no Meu dia</strong>: {CHECKLIST_DE_SAIDA.join('; ')}.</p>
          </div>
        )}
        {erro && <MensagemErro className="md:col-span-2">{erro}</MensagemErro>}
      </div>
    </JanelaFormulario>
  );
}
