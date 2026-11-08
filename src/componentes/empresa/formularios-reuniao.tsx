'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Campo } from '@/componentes/campos/campo';
import { EntradaData } from '@/componentes/campos/entrada-data';
import { PilulasMultiplas } from '@/componentes/campos/pilulas';
import { Selecao } from '@/componentes/campos/selecao';
import { SelecaoPessoa } from '@/componentes/campos/selecao-pessoa';
import { useCentral } from '@/componentes/layout/central-provider';
import { Faixa } from '@/componentes/padroes/faixa';
import { JanelaFormulario } from '@/componentes/padroes/janela-formulario';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { Textarea } from '@/componentes/ui/textarea';
import type { Decisao } from '@/dados/tipos/decisao';
import type { Reuniao } from '@/dados/tipos/sociedade';
import { useConsulta } from '@/dados/use-consulta';
import { sociasParaDecidir } from '@/dominio/decisoes';
import { pessoasDoSeletor } from '@/dominio/pessoa-atual';
import { adicionarAcao, errosDaAcao, errosDaReuniao, errosDoFormularioDecisao, formularioDaReuniao, formularioDaSubstituicao, formularioDecisaoVazio, formularioReuniaoVazio, idsDosDecisores, opcoesDeRegistros, registrarDecisao, registrosDaDecisao, salvarReuniao, type DadosDasReunioes, type FormularioDecisao, type FormularioReuniao } from '@/dominio/reunioes';
import { hojeISO } from '@/lib/datas';
import { useFormulario } from './use-formulario';

/** T06.09: título, data e hora, participantes, contexto, pauta e notas. */
export function FormularioDaReuniao({ dados, reuniao, aoFechar, aoCriar }: { dados: DadosDasReunioes; reuniao?: Reuniao; aoFechar: () => void; aoCriar?: (reuniao: Reuniao) => void }) {
  const { pessoa } = useCentral();
  const f = useFormulario<FormularioReuniao>({
    prefixo: 'reuniao',
    inicial: () => (reuniao ? formularioDaReuniao(reuniao, dados.participantes.filter((linha) => linha.reuniao_id === reuniao.id).map((linha) => linha.pessoa_id)) : formularioReuniaoVazio(pessoa.id)),
    validar: errosDaReuniao,
    salvar: async (valores) => {
      const salva = await salvarReuniao(valores, reuniao?.id);
      if (!reuniao) aoCriar?.(salva);
    },
    textos: (valores) => [valores.pauta, valores.notas],
    mensagem: reuniao ? 'Reunião atualizada.' : 'Reunião criada.',
    aoSalvar: aoFechar,
  });
  const { valores, mudar } = f;
  return (
    <JanelaFormulario colunas={2} aberto aoFechar={aoFechar} titulo={reuniao ? 'Editar reunião' : 'Nova reunião'} alterado={f.alterado} aoEnviar={f.enviar} rotuloSalvar={reuniao ? 'Salvar alterações' : 'Salvar'} salvando={f.salvando} erros={f.lista}>
      <div className="grid grid-cols-1 gap-[18px]">
        <Campo rotulo="Título" obrigatorio {...f.campo('titulo')}>
          {(controle) => <Input autoComplete="off" {...controle} {...f.entrada('titulo')} />}
        </Campo>
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
          <Campo rotulo="Data" obrigatorio {...f.campo('data')}>
            {(controle) => <EntradaData {...controle} {...f.entrada('data')} />}
          </Campo>
          <Campo rotulo="Hora" obrigatorio {...f.campo('hora')}>
            {(controle) => <Input type="time" {...controle} {...f.entrada('hora')} />}
          </Campo>
        </div>
        <div id="reuniao-participantes" tabIndex={-1}>
          <PilulasMultiplas rotulo="Participantes" obrigatorio valores={valores.participantes} aoMudar={(participantes) => mudar({ participantes })} opcoes={pessoasDoSeletor(dados.pessoas).map((linha) => ({ valor: linha.id, rotulo: linha.nome_completo }))} />
          {f.erros.participantes && <p className="mt-1.5 text-[13px] font-medium text-err">{f.erros.participantes}</p>}
        </div>
        <Campo rotulo="Contexto" {...f.campo('produto_id')}>
          {(controle) => (
            <Selecao {...controle} {...f.entrada('produto_id')}>
              <option value="">Numa</option>
              {dados.produtos
                .filter((produto) => !produto.arquivado_em)
                .map((produto) => (
                  <option key={produto.id} value={produto.id}>
                    {produto.nome}
                  </option>
                ))}
            </Selecao>
          )}
        </Campo>
      </div>
      <div className="grid grid-cols-1 gap-[18px]">
        <Campo rotulo="Pauta" ajuda="Um item por linha." {...f.campo('pauta')}>
          {(controle) => <Textarea rows={4} {...controle} {...f.entrada('pauta')} />}
        </Campo>
        <Campo rotulo="Notas" {...f.campo('notas')}>
          {(controle) => <Textarea rows={4} {...controle} {...f.entrada('notas')} />}
        </Campo>
        {f.avisoDeCredencial}
      </div>
    </JanelaFormulario>
  );
}

/** RN-06.14: a ação vira atividade no Meu dia, ligada à reunião. */
export function JanelaDaAcao({ dados, reuniaoId, aoFechar }: { dados: Pick<DadosDasReunioes, 'pessoas'>; reuniaoId: string; aoFechar: () => void }) {
  const { pessoa } = useCentral();
  const f = useFormulario({
    prefixo: 'acao',
    inicial: () => ({ titulo: '', responsavel_id: pessoa.id, prazo: '' }),
    validar: errosDaAcao,
    salvar: async (valores) => {
      await adicionarAcao(reuniaoId, valores);
    },
    textos: (valores) => [valores.titulo],
    mensagem: 'Ação criada no Meu dia.',
    aoSalvar: aoFechar,
  });
  return (
    <JanelaFormulario aberto aoFechar={aoFechar} titulo="Adicionar ação" descricao="A ação compartilha a mesma atividade com o Meu dia: concluir em qualquer lugar vale para os dois." alterado={f.alterado} aoEnviar={f.enviar} rotuloSalvar="Adicionar" salvando={f.salvando} erros={f.lista}>
      <div className="grid gap-4">
        <Campo rotulo="Ação" obrigatorio {...f.campo('titulo')}>
          {(controle) => <Input autoComplete="off" maxLength={140} {...controle} {...f.entrada('titulo')} />}
        </Campo>
        <Campo rotulo="Responsável" obrigatorio {...f.campo('responsavel_id')}>
          {(controle) => <SelecaoPessoa pessoas={pessoasDoSeletor(dados.pessoas)} vazio="Escolha" {...controle} {...f.entrada('responsavel_id')} />}
        </Campo>
        <Campo rotulo="Prazo" {...f.campo('prazo')}>
          {(controle) => <EntradaData {...controle} {...f.entrada('prazo')} />}
        </Campo>
        {f.avisoDeCredencial}
      </div>
    </JanelaFormulario>
  );
}

function CampoDosRegistros({ valores, mudar }: { valores: FormularioDecisao['registros']; mudar: (registros: FormularioDecisao['registros']) => void }) {
  const consulta = useConsulta(opcoesDeRegistros);
  const grupos = consulta.dados ?? [];
  const [tipo, setTipo] = useState('');
  const [id, setId] = useState('');
  const grupo = grupos.find((linha) => linha.tipo === tipo);
  const nome = (registro: FormularioDecisao['registros'][number]) => {
    const dele = grupos.find((linha) => linha.tipo === registro.tipo);
    return `${dele?.rotulo ?? registro.tipo}: ${dele?.itens.find((item) => item.id === registro.id)?.nome ?? 'Registro removido'}`;
  };
  return (
    <fieldset className="grid gap-2.5">
      <legend className="mb-[7px] texto-rotulo">Registros afetados</legend>
      {valores.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {valores.map((registro) => (
            <li key={`${registro.tipo}:${registro.id}`} className="inline-flex items-center gap-1 rounded-pill bg-mist py-1 pr-1 pl-3 text-[13px]">
              <span className="min-w-0 break-words">{nome(registro)}</span>
              <Button variante="icone" tamanho="icone" aria-label={`Tirar ${nome(registro)}`} onClick={() => mudar(valores.filter((outro) => outro !== registro))}>
                <X aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="grid gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto] sm:items-end">
        <Campo id="decisao-registro-tipo" rotulo="Tipo">
          {(controle) => (
            <Selecao
              {...controle}
              value={tipo}
              onChange={(evento) => {
                setTipo(evento.target.value);
                setId('');
              }}
            >
              <option value="">Escolha</option>
              {grupos.map((linha) => (
                <option key={linha.tipo} value={linha.tipo}>
                  {linha.rotulo}
                </option>
              ))}
            </Selecao>
          )}
        </Campo>
        <Campo id="decisao-registro-id" rotulo="Registro">
          {(controle) => (
            <Selecao {...controle} value={id} disabled={!grupo} onChange={(evento) => setId(evento.target.value)}>
              <option value="">Escolha</option>
              {grupo?.itens.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nome}
                </option>
              ))}
            </Selecao>
          )}
        </Campo>
        <Button
          variante="secundario"
          disabled={!tipo || !id}
          aria-label="Adicionar registro afetado"
          onClick={() => {
            if (!valores.some((registro) => registro.tipo === tipo && registro.id === id)) mudar([...valores, { tipo, id }]);
            setId('');
          }}
        >
          <Plus aria-hidden />
          Adicionar
        </Button>
      </div>
    </fieldset>
  );
}

type FormularioDaDecisaoProps = { dados: DadosDasReunioes; substitui?: Decisao; reuniaoId?: string; aoFechar: () => void; aoRegistrar?: (decisao: Decisao) => void };

/** T06.09: o registro completo. Depois de salvar, a decisão não muda: a ação disponível é substituir (CA-06.06). */
export function FormularioDaDecisao({ dados, substitui, reuniaoId, aoFechar, aoRegistrar }: FormularioDaDecisaoProps) {
  const { pessoa } = useCentral();
  const hoje = hojeISO();
  const socias = sociasParaDecidir(dados.pessoas).filter((linha) => !dados.saidas.includes(linha.id));
  const f = useFormulario<FormularioDecisao>({
    prefixo: 'decisao',
    inicial: () => {
      if (substitui) return formularioDaSubstituicao(substitui, idsDosDecisores(substitui.id, dados.decisores).filter((id) => socias.some((socia) => socia.id === id)), registrosDaDecisao(substitui.id, dados.vinculos), hoje);
      return { ...formularioDecisaoVazio(pessoa.id, socias, hoje), reuniao_id: reuniaoId ?? '' };
    },
    validar: (valores) => errosDoFormularioDecisao(valores, hoje),
    salvar: async (valores) => {
      const decisao = await registrarDecisao(valores, hoje);
      aoRegistrar?.(decisao);
    },
    textos: (valores) => [valores.descricao, valores.motivo, valores.alternativas, valores.impacto],
    mensagem: substitui ? 'Nova decisão registrada. A anterior ficou Substituída.' : 'Decisão registrada.',
    aoSalvar: aoFechar,
  });
  const { valores, mudar } = f;
  const candidatas = dados.decisoes.filter((decisao) => decisao.situacao === 'registrada');
  return (
    <JanelaFormulario colunas={2} aberto aoFechar={aoFechar} titulo={substitui ? 'Substituir por nova decisão' : 'Nova decisão'} descricao={substitui ? `A ${substitui.codigo} só fica Substituída depois do registro desta.` : 'Depois de registrada, a decisão não muda: só pode ser substituída por outra.'} alterado={f.alterado} aoEnviar={f.enviar} rotuloSalvar="Registrar decisão" salvando={f.salvando} erros={f.lista}>
      <div className="grid grid-cols-1 gap-[18px]">
        <Campo rotulo="Título" obrigatorio {...f.campo('titulo')}>
          {(controle) => <Input autoComplete="off" {...controle} {...f.entrada('titulo')} />}
        </Campo>
        <Campo rotulo="O que foi decidido" obrigatorio {...f.campo('descricao')}>
          {(controle) => <Textarea rows={3} {...controle} {...f.entrada('descricao')} />}
        </Campo>
        <Campo rotulo={substitui ? 'Motivo da substituição' : 'Motivo'} obrigatorio={Boolean(substitui)} {...f.campo('motivo')}>
          {(controle) => <Textarea rows={2} {...controle} {...f.entrada('motivo')} />}
        </Campo>
        <Campo rotulo="Alternativas consideradas" {...f.campo('alternativas')}>
          {(controle) => <Textarea rows={2} {...controle} {...f.entrada('alternativas')} />}
        </Campo>
        <Campo rotulo="Impacto" {...f.campo('impacto')}>
          {(controle) => <Textarea rows={2} {...controle} {...f.entrada('impacto')} />}
        </Campo>
      </div>
      <div className="grid grid-cols-1 gap-[18px]">
        <div id="decisao-decisores" tabIndex={-1}>
          <PilulasMultiplas rotulo="Quem decidiu" obrigatorio valores={valores.decisores} aoMudar={(decisores) => mudar({ decisores })} opcoes={socias.map((socia) => ({ valor: socia.id, rotulo: socia.nome_completo }))} />
          {f.erros.decisores && <p className="mt-1.5 text-[13px] font-medium text-err">{f.erros.decisores}</p>}
        </div>
        <Campo rotulo="Data da decisão" obrigatorio {...f.campo('data')}>
          {(controle) => <EntradaData max={hoje} {...controle} {...f.entrada('data')} />}
        </Campo>
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
          <Campo rotulo="Contexto" {...f.campo('produto_id')}>
            {(controle) => (
              <Selecao {...controle} {...f.entrada('produto_id')}>
                <option value="">Numa</option>
                {dados.produtos
                  .filter((produto) => !produto.arquivado_em)
                  .map((produto) => (
                    <option key={produto.id} value={produto.id}>
                      {produto.nome}
                    </option>
                  ))}
              </Selecao>
            )}
          </Campo>
          <Campo rotulo="Área" {...f.campo('area_id')}>
            {(controle) => (
              <Selecao {...controle} {...f.entrada('area_id')}>
                <option value="">Nenhuma</option>
                {dados.areas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.nome}
                  </option>
                ))}
              </Selecao>
            )}
          </Campo>
        </div>
        <CampoDosRegistros valores={valores.registros} mudar={(registros) => mudar({ registros })} />
        {substitui ? (
          <Faixa tipo="info">
            Vínculo: substitui <strong className="font-semibold">{substitui.codigo}</strong>.
          </Faixa>
        ) : (
          !reuniaoId && (
            <Campo rotulo="Substitui a decisão" {...f.campo('substitui_id')}>
              {(controle) => (
                <Selecao {...controle} {...f.entrada('substitui_id')}>
                  <option value="">Nenhuma</option>
                  {candidatas.map((decisao) => (
                    <option key={decisao.id} value={decisao.id}>
                      {decisao.codigo} · {decisao.titulo}
                    </option>
                  ))}
                </Selecao>
              )}
            </Campo>
          )
        )}
        {f.avisoDeCredencial}
      </div>
    </JanelaFormulario>
  );
}
