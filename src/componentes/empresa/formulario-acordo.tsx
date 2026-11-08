'use client';

import { Campo } from '@/componentes/campos/campo';
import { EntradaData } from '@/componentes/campos/entrada-data';
import { PilulasMultiplas } from '@/componentes/campos/pilulas';
import { Selecao } from '@/componentes/campos/selecao';
import { JanelaFormulario } from '@/componentes/padroes/janela-formulario';
import { Input } from '@/componentes/ui/input';
import { Textarea } from '@/componentes/ui/textarea';
import { TIPOS_DE_ACORDO, type Acordo, type AcordoVersao } from '@/dados/tipos/sociedade';
import { criarAcordo, errosDoAcordo, exigeParticipacao, formularioAcordoVazio, formularioDaVersao, ROTULOS_TIPO_ACORDO, salvarVersaoDoAcordo, type DadosDosAcordos, type FormularioAcordo } from '@/dominio/acordos';
import { entidadesParaVincular } from '@/dominio/entidades';
import { nomeDaPessoa, sociasAtivas } from '@/dominio/sociedade';
import { useFormulario } from './use-formulario';

/** T06.03: o resumo estruturado (RN-06.05). O rascunho salva incompleto; o que é obrigatório é cobrado ao pedir as assinaturas. */
export function FormularioDoAcordo({ dados, acordo, versao, aoFechar, aoCriar }: { dados: DadosDosAcordos; acordo?: Acordo; versao?: AcordoVersao; aoFechar: () => void; aoCriar?: (acordo: Acordo) => void }) {
  const ativas = sociasAtivas(dados.socias);
  const f = useFormulario<FormularioAcordo>({
    prefixo: 'acordo',
    inicial: () => (acordo && versao ? formularioDaVersao(acordo, versao) : formularioAcordoVazio(ativas)),
    validar: errosDoAcordo,
    salvar: async (valores) => {
      if (versao) await salvarVersaoDoAcordo(versao.id, valores);
      else {
        const criado = await criarAcordo(valores);
        aoCriar?.(criado);
      }
    },
    textos: (valores) => [valores.aportes, valores.decisao, valores.destino_produtos, valores.saida, valores.observacoes, ...Object.values(valores.dedicacao)],
    mensagem: versao ? 'Resumo salvo.' : 'Acordo criado em rascunho.',
    aoSalvar: aoFechar,
  });
  const { valores, mudar } = f;
  const pessoasDasPartes = [...new Set([...ativas.map((socia) => socia.pessoa_id), ...valores.partes])];
  const obrigatoria = exigeParticipacao(valores.tipo);
  const porSocia = (campo: 'participacao' | 'aportes_valores' | 'dedicacao', pessoa: string, texto: string) => mudar({ [campo]: { ...valores[campo], [pessoa]: texto } });

  return (
    <JanelaFormulario colunas={2} aberto aoFechar={aoFechar} titulo={versao ? `Resumo da V${versao.numero}` : 'Novo acordo'} descricao="O texto final é redigido fora da Central. Aqui ficam os pontos-chave, para consulta e alertas." alterado={f.alterado} aoEnviar={f.enviar} rotuloSalvar={versao ? 'Salvar alterações' : 'Criar em rascunho'} salvando={f.salvando} erros={f.lista}>
      <div className="grid grid-cols-1 gap-[18px]">
        <Campo rotulo="Título" obrigatorio {...f.campo('titulo')}>
          {(controle) => <Input autoComplete="off" {...controle} {...f.entrada('titulo')} />}
        </Campo>
        <Campo rotulo="Tipo" obrigatorio {...f.campo('tipo')}>
          {(controle) => (
            <Selecao {...controle} {...f.entrada('tipo')}>
              {TIPOS_DE_ACORDO.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {ROTULOS_TIPO_ACORDO[tipo]}
                </option>
              ))}
            </Selecao>
          )}
        </Campo>
        <PilulasMultiplas rotulo="Partes" obrigatorio valores={valores.partes} aoMudar={(partes) => mudar({ partes })} opcoes={pessoasDasPartes.map((pessoa) => ({ valor: pessoa, rotulo: nomeDaPessoa(dados.pessoas, pessoa) }))} />
        <Campo rotulo="Entidade, quando existir" {...f.campo('parte_entidade_id')}>
          {(controle) => (
            <Selecao {...controle} {...f.entrada('parte_entidade_id')}>
              <option value="">Nenhuma</option>
              {entidadesParaVincular(dados.entidades).map((entidade) => (
                <option key={entidade.id} value={entidade.id}>
                  {entidade.nome}
                </option>
              ))}
            </Selecao>
          )}
        </Campo>
        {valores.partes.map((pessoa) => (
          <fieldset key={pessoa} className="grid gap-3 rounded-lg border border-line p-3.5">
            <legend className="px-1 texto-rotulo">{nomeDaPessoa(dados.pessoas, pessoa)}</legend>
            <div className="grid grid-cols-2 gap-3">
              <Campo rotulo="Participação (%)" obrigatorio={obrigatoria} {...f.campo(`participacao_${pessoa}`)}>
                {(controle) => <Input inputMode="decimal" autoComplete="off" {...controle} value={valores.participacao[pessoa] ?? ''} onChange={(evento) => porSocia('participacao', pessoa, evento.target.value)} />}
              </Campo>
              <Campo rotulo="Aporte previsto (R$)" {...f.campo(`aporte_${pessoa}`)}>
                {(controle) => <Input inputMode="decimal" autoComplete="off" {...controle} value={valores.aportes_valores[pessoa] ?? ''} onChange={(evento) => porSocia('aportes_valores', pessoa, evento.target.value)} />}
              </Campo>
            </div>
            <Campo id={`acordo-dedicacao-${pessoa}`} rotulo="Dedicação">
              {(controle) => <Input autoComplete="off" {...controle} value={valores.dedicacao[pessoa] ?? ''} onChange={(evento) => porSocia('dedicacao', pessoa, evento.target.value)} />}
            </Campo>
          </fieldset>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-[18px]">
        <Campo rotulo="Aportes previstos" {...f.campo('aportes')}>
          {(controle) => <Textarea {...controle} {...f.entrada('aportes')} />}
        </Campo>
        <Campo rotulo="Regras de decisão" {...f.campo('decisao')}>
          {(controle) => <Textarea {...controle} {...f.entrada('decisao')} />}
        </Campo>
        <label className="flex min-h-11 cursor-pointer items-start gap-2.5 text-[13px] md:min-h-0">
          <input id="acordo-titularidade" type="checkbox" className="mt-0.5 size-[18px] accent-[var(--ok)]" checked={valores.titularidade_numa} onChange={(evento) => mudar({ titularidade_numa: evento.target.checked })} />
          <span>
            <span className="font-medium">A titularidade de ativos e PI pertence à Numa</span>
            <span className="mt-0.5 block text-xs text-ink-soft">Sem acordo vigente com esta marcação, o painel da empresa alerta (D1).</span>
          </span>
        </label>
        <Campo rotulo="Destino dos produtos em caso de saída" {...f.campo('destino_produtos')}>
          {(controle) => <Textarea {...controle} {...f.entrada('destino_produtos')} />}
        </Campo>
        <Campo rotulo="Saída, não concorrência e confidencialidade" {...f.campo('saida')}>
          {(controle) => <Textarea {...controle} {...f.entrada('saida')} />}
        </Campo>
        <Campo rotulo="Vigência e revisão prevista" ajuda="Com o acordo vigente, gera um alerta 30 dias antes." {...f.campo('revisao_prevista')}>
          {(controle) => <EntradaData {...controle} {...f.entrada('revisao_prevista')} />}
        </Campo>
        <Campo rotulo="Observações" {...f.campo('observacoes')}>
          {(controle) => <Textarea {...controle} {...f.entrada('observacoes')} />}
        </Campo>
        {f.avisoDeCredencial}
      </div>
    </JanelaFormulario>
  );
}
