'use client';

import { Campo } from '@/componentes/campos/campo';
import { EntradaData } from '@/componentes/campos/entrada-data';
import { EntradaLinkDrive } from '@/componentes/campos/link-drive';
import { Pilulas } from '@/componentes/campos/pilulas';
import { Selecao } from '@/componentes/campos/selecao';
import { SelecaoPessoa } from '@/componentes/campos/selecao-pessoa';
import { useCentral } from '@/componentes/layout/central-provider';
import { Faixa } from '@/componentes/padroes/faixa';
import { JanelaFormulario } from '@/componentes/padroes/janela-formulario';
import { Input } from '@/componentes/ui/input';
import { Textarea } from '@/componentes/ui/textarea';
import { APRESENTACOES_DA_MARCA, SITUACOES_DO_PROCESSO, type MarcaProcesso } from '@/dados/tipos/sociedade';
import { nomeDaContraparte } from '@/dominio/contrapartes';
import { entidadesParaVincular } from '@/dominio/entidades';
import { adicionarPrazo, errosDaPesquisa, errosDoPrazo, errosDoProcesso, formularioDoProcesso, formularioPesquisaVazio, formularioProcessoVazio, NOTA_PESQUISA_MANUAL, registrarPesquisa, ROTULOS_APRESENTACAO, ROTULOS_RESULTADO_PESQUISA, ROTULOS_SITUACAO_PROCESSO, salvarProcesso, type DadosDasMarcas } from '@/dominio/marcas-inpi';
import { pessoasDoSeletor } from '@/dominio/pessoa-atual';
import { hojeISO } from '@/lib/datas';
import { useFormulario } from './use-formulario';

/** T06.05: registro manual. A marca vem escolhida quando a janela abre de uma linha ou da ficha. */
export function JanelaDaPesquisa({ dados, marcaId = '', aoFechar }: { dados: DadosDasMarcas; marcaId?: string; aoFechar: () => void }) {
  const { pessoa } = useCentral();
  const hoje = hojeISO();
  const f = useFormulario({
    prefixo: 'pesquisa',
    inicial: () => formularioPesquisaVazio(marcaId, pessoa.id, hoje),
    validar: (valores) => errosDaPesquisa(valores, hoje),
    salvar: async (valores) => {
      await registrarPesquisa(valores, hoje);
    },
    textos: (valores) => [valores.bases, valores.observacoes],
    mensagem: 'Pesquisa registrada.',
    aoSalvar: aoFechar,
  });
  return (
    <JanelaFormulario colunas={2} aberto aoFechar={aoFechar} titulo="Registrar pesquisa" alterado={f.alterado} aoEnviar={f.enviar} rotuloSalvar="Salvar" salvando={f.salvando} erros={f.lista}>
      <div className="grid grid-cols-1 gap-[18px]">
        <Campo rotulo="Marca" obrigatorio {...f.campo('marca_id')}>
          {(controle) => (
            <Selecao {...controle} {...f.entrada('marca_id')}>
              <option value="">Escolha</option>
              {dados.marcas.map((marca) => (
                <option key={marca.id} value={marca.id}>
                  {marca.nome}
                </option>
              ))}
            </Selecao>
          )}
        </Campo>
        <Campo rotulo="Data da pesquisa" obrigatorio {...f.campo('data')}>
          {(controle) => <EntradaData max={hoje} {...controle} {...f.entrada('data')} />}
        </Campo>
        <Campo rotulo="Quem fez" obrigatorio {...f.campo('feita_por')}>
          {(controle) => <SelecaoPessoa pessoas={pessoasDoSeletor(dados.pessoas)} vazio="Escolha" {...controle} {...f.entrada('feita_por')} />}
        </Campo>
        <div id="pesquisa-resultado" tabIndex={-1}>
          <Pilulas rotulo="Resultado" obrigatorio valor={f.valores.resultado} aoMudar={(resultado) => f.mudar({ resultado })} opcoes={Object.entries(ROTULOS_RESULTADO_PESQUISA).map(([valor, rotulo]) => ({ valor, rotulo }))} />
          {f.erros.resultado && <p className="mt-1.5 text-[13px] font-medium text-err">{f.erros.resultado}</p>}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-[18px]">
        <Campo rotulo="Bases consultadas" {...f.campo('bases')}>
          {(controle) => <Input autoComplete="off" {...controle} {...f.entrada('bases')} />}
        </Campo>
        <Campo rotulo="Link de evidência" {...f.campo('evidencia_url')}>
          {(controle) => <EntradaLinkDrive link={f.valores.evidencia_url} {...controle} {...f.entrada('evidencia_url')} />}
        </Campo>
        <Campo rotulo="Observações" {...f.campo('observacoes')}>
          {(controle) => <Textarea {...controle} {...f.entrada('observacoes')} />}
        </Campo>
        <Faixa tipo="info">{NOTA_PESQUISA_MANUAL}</Faixa>
        {f.avisoDeCredencial}
      </div>
    </JanelaFormulario>
  );
}

/** T06.05: um processo por classe ou grupo de classes. Planejada vale como intenção; protocolo exige titular real. */
export function JanelaDoProcesso({ dados, marcaId = '', processo, aoFechar }: { dados: DadosDasMarcas; marcaId?: string; processo?: MarcaProcesso; aoFechar: () => void }) {
  const hoje = hojeISO();
  const f = useFormulario({
    prefixo: 'processo',
    inicial: () => (processo ? formularioDoProcesso(processo) : formularioProcessoVazio(marcaId)),
    validar: (valores) => errosDoProcesso(valores, dados.entidades, hoje),
    salvar: async (valores) => {
      await salvarProcesso(valores, processo?.id, hoje);
    },
    textos: (valores) => [valores.observacoes],
    mensagem: processo ? 'Processo atualizado.' : 'Processo criado.',
    aoSalvar: aoFechar,
  });
  const protocolado = f.valores.situacao !== 'planejado';
  return (
    <JanelaFormulario colunas={2} aberto aoFechar={aoFechar} titulo={processo ? 'Editar processo' : 'Novo processo'} descricao="Situação e prazos são informados à mão: a Central não consulta o INPI nesta fase." alterado={f.alterado} aoEnviar={f.enviar} rotuloSalvar={processo ? 'Salvar alterações' : 'Salvar'} salvando={f.salvando} erros={f.lista}>
      <div className="grid grid-cols-1 gap-[18px]">
        <Campo rotulo="Marca" obrigatorio {...f.campo('marca_id')}>
          {(controle) => (
            <Selecao {...controle} {...f.entrada('marca_id')}>
              <option value="">Escolha</option>
              {dados.marcas.map((marca) => (
                <option key={marca.id} value={marca.id}>
                  {marca.nome}
                </option>
              ))}
            </Selecao>
          )}
        </Campo>
        <Campo rotulo="Classes (Nice)" obrigatorio ajuda="Por exemplo: 9, 42." {...f.campo('classes')}>
          {(controle) => <Input autoComplete="off" {...controle} {...f.entrada('classes')} />}
        </Campo>
        <div id="processo-apresentacao" tabIndex={-1}>
          <Pilulas rotulo="Apresentação" obrigatorio valor={f.valores.apresentacao} aoMudar={(apresentacao) => f.mudar({ apresentacao })} opcoes={APRESENTACOES_DA_MARCA.map((valor) => ({ valor, rotulo: ROTULOS_APRESENTACAO[valor] }))} />
          {f.erros.apresentacao && <p className="mt-1.5 text-[13px] font-medium text-err">{f.erros.apresentacao}</p>}
        </div>
        <Campo rotulo="Titular" obrigatorio ajuda="Planejada vale como intenção. O protocolo exige uma entidade Ativa." {...f.campo('titular_entidade_id')}>
          {(controle) => (
            <Selecao {...controle} {...f.entrada('titular_entidade_id')}>
              <option value="">Escolha</option>
              {entidadesParaVincular(dados.entidades).map((entidade) => (
                <option key={entidade.id} value={entidade.id}>
                  {entidade.nome}
                </option>
              ))}
            </Selecao>
          )}
        </Campo>
      </div>
      <div className="grid grid-cols-1 gap-[18px]">
        <Campo rotulo="Situação" obrigatorio {...f.campo('situacao')}>
          {(controle) => (
            <Selecao {...controle} {...f.entrada('situacao')}>
              {SITUACOES_DO_PROCESSO.map((situacao) => (
                <option key={situacao} value={situacao}>
                  {ROTULOS_SITUACAO_PROCESSO[situacao]}
                </option>
              ))}
            </Selecao>
          )}
        </Campo>
        <Campo rotulo="Número do processo" obrigatorio={protocolado} {...f.campo('numero_processo')}>
          {(controle) => <Input autoComplete="off" {...controle} {...f.entrada('numero_processo')} />}
        </Campo>
        <Campo rotulo="Data do depósito" obrigatorio={protocolado} {...f.campo('data_deposito')}>
          {(controle) => <EntradaData max={hoje} {...controle} {...f.entrada('data_deposito')} />}
        </Campo>
        <Campo rotulo="Procurador ou escritório" {...f.campo('procurador_id')}>
          {(controle) => (
            <Selecao {...controle} {...f.entrada('procurador_id')}>
              <option value="">Nenhum</option>
              {dados.contrapartes.map((contraparte) => (
                <option key={contraparte.id} value={contraparte.id}>
                  {nomeDaContraparte(contraparte)}
                </option>
              ))}
            </Selecao>
          )}
        </Campo>
        <Campo rotulo="Observações" {...f.campo('observacoes')}>
          {(controle) => <Textarea {...controle} {...f.entrada('observacoes')} />}
        </Campo>
        {f.avisoDeCredencial}
      </div>
    </JanelaFormulario>
  );
}

export function JanelaDoPrazo({ dados, processoId, aoFechar }: { dados: Pick<DadosDasMarcas, 'pessoas'>; processoId: string; aoFechar: () => void }) {
  const { pessoa } = useCentral();
  const f = useFormulario({
    prefixo: 'prazo',
    inicial: () => ({ descricao: '', data_limite: '', responsavel_id: pessoa.id }),
    validar: errosDoPrazo,
    salvar: async (valores) => {
      await adicionarPrazo(processoId, valores);
    },
    textos: (valores) => [valores.descricao],
    mensagem: 'Prazo adicionado.',
    aoSalvar: aoFechar,
  });
  return (
    <JanelaFormulario aberto aoFechar={aoFechar} titulo="Novo prazo" descricao="Cadastrado à mão: a Central não consulta o INPI. O alerta segue a antecedência de domínios, em Configurações." alterado={f.alterado} aoEnviar={f.enviar} rotuloSalvar="Salvar" salvando={f.salvando} erros={f.lista}>
      <div className="grid gap-4">
        <Campo rotulo="Descrição" obrigatorio {...f.campo('descricao')}>
          {(controle) => <Input autoComplete="off" {...controle} {...f.entrada('descricao')} />}
        </Campo>
        <Campo rotulo="Data-limite" obrigatorio {...f.campo('data_limite')}>
          {(controle) => <EntradaData {...controle} {...f.entrada('data_limite')} />}
        </Campo>
        <Campo rotulo="Responsável" obrigatorio {...f.campo('responsavel_id')}>
          {(controle) => <SelecaoPessoa pessoas={pessoasDoSeletor(dados.pessoas)} vazio="Escolha" {...controle} {...f.entrada('responsavel_id')} />}
        </Campo>
        {f.avisoDeCredencial}
      </div>
    </JanelaFormulario>
  );
}
