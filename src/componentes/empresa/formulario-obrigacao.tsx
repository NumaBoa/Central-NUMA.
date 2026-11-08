'use client';

import { Campo } from '@/componentes/campos/campo';
import { EntradaData } from '@/componentes/campos/entrada-data';
import { Pilulas } from '@/componentes/campos/pilulas';
import { Selecao } from '@/componentes/campos/selecao';
import { SelecaoPessoa } from '@/componentes/campos/selecao-pessoa';
import { useCentral } from '@/componentes/layout/central-provider';
import { Faixa } from '@/componentes/padroes/faixa';
import { JanelaFormulario } from '@/componentes/padroes/janela-formulario';
import { Input } from '@/componentes/ui/input';
import { Textarea } from '@/componentes/ui/textarea';
import { PERIODICIDADES, SITUACOES_DA_OBRIGACAO, type Obrigacao } from '@/dados/tipos/sociedade';
import { entidadeInicial } from '@/dominio/entidade-empresa';
import { entidadesParaVincular } from '@/dominio/entidades';
import { errosDaObrigacao, formularioDaObrigacao, formularioObrigacaoVazio, NOTA_SEM_PRESUNCAO, ROTULOS_PERIODICIDADE_OBRIGACAO, ROTULOS_SITUACAO_OBRIGACAO, salvarObrigacao, type DadosDasObrigacoes, type FormularioObrigacao } from '@/dominio/obrigacoes';
import { pessoasDoSeletor } from '@/dominio/pessoa-atual';
import { hojeISO } from '@/lib/datas';
import { useFormulario } from './use-formulario';

/** T06.08. Nada é presumido: quem define a obrigação é a Numa, com o contador. */
export function FormularioDaObrigacao({ dados, obrigacao, aoFechar }: { dados: DadosDasObrigacoes; obrigacao?: Obrigacao; aoFechar: () => void }) {
  const { pessoa } = useCentral();
  const hoje = hojeISO();
  const f = useFormulario<FormularioObrigacao>({
    prefixo: 'obrigacao',
    inicial: () => (obrigacao ? formularioDaObrigacao(obrigacao) : formularioObrigacaoVazio(entidadeInicial(dados.entidades)?.id ?? '', pessoa.id)),
    validar: (valores) => errosDaObrigacao(valores, { entidades: dados.entidades, fase: dados.fase, hoje, ...(obrigacao ? { baseAtual: obrigacao.vencimento_base } : {}) }),
    salvar: async (valores) => {
      await salvarObrigacao(valores, obrigacao?.id, hoje);
    },
    textos: (valores) => [valores.descricao],
    mensagem: obrigacao ? 'Obrigação atualizada.' : 'Obrigação cadastrada.',
    aoSalvar: aoFechar,
  });
  const { valores, mudar } = f;
  const categorias = dados.categorias.filter((categoria) => categoria.situacao === 'ativa' && !categoria.arquivado_em && (categoria.tipo === 'despesa' || categoria.id === valores.categoria_id));
  return (
    <JanelaFormulario colunas={2} aberto aoFechar={aoFechar} titulo={obrigacao ? 'Editar obrigação' : 'Nova obrigação'} descricao={NOTA_SEM_PRESUNCAO} alterado={f.alterado} aoEnviar={f.enviar} rotuloSalvar={obrigacao ? 'Salvar alterações' : 'Salvar'} salvando={f.salvando} erros={f.lista}>
      <div className="grid grid-cols-1 gap-[18px]">
        <Campo rotulo="Nome" obrigatorio {...f.campo('nome')}>
          {(controle) => <Input autoComplete="off" {...controle} {...f.entrada('nome')} />}
        </Campo>
        <Campo rotulo="Descrição" {...f.campo('descricao')}>
          {(controle) => <Textarea {...controle} {...f.entrada('descricao')} />}
        </Campo>
        <Campo rotulo="Entidade" obrigatorio {...f.campo('entidade_id')}>
          {(controle) => (
            <Selecao {...controle} {...f.entrada('entidade_id')}>
              <option value="">Escolha</option>
              {entidadesParaVincular(dados.entidades).map((entidade) => (
                <option key={entidade.id} value={entidade.id}>
                  {entidade.nome}
                </option>
              ))}
            </Selecao>
          )}
        </Campo>
        <Campo rotulo="Órgão" {...f.campo('orgao')}>
          {(controle) => <Input autoComplete="off" {...controle} {...f.entrada('orgao')} />}
        </Campo>
        <Pilulas rotulo="Periodicidade" obrigatorio valor={valores.periodicidade} aoMudar={(periodicidade) => mudar({ periodicidade: periodicidade as FormularioObrigacao['periodicidade'] })} opcoes={PERIODICIDADES.map((valor) => ({ valor, rotulo: ROTULOS_PERIODICIDADE_OBRIGACAO[valor] }))} />
      </div>
      <div className="grid grid-cols-1 gap-[18px]">
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
          <Campo rotulo="Próximo vencimento" obrigatorio ajuda={valores.periodicidade === 'outra' ? 'As próximas datas são informadas à mão.' : 'As próximas datas seguem a periodicidade.'} {...f.campo('vencimento_base')}>
            {(controle) => <EntradaData {...controle} {...f.entrada('vencimento_base')} />}
          </Campo>
          <Campo rotulo="Antecedência (dias)" obrigatorio {...f.campo('antecedencia_dias')}>
            {(controle) => <Input inputMode="numeric" autoComplete="off" {...controle} {...f.entrada('antecedencia_dias')} />}
          </Campo>
        </div>
        <Campo rotulo="Responsável" obrigatorio {...f.campo('responsavel_id')}>
          {(controle) => <SelecaoPessoa pessoas={pessoasDoSeletor(dados.pessoas)} vazio="Escolha" {...controle} {...f.entrada('responsavel_id')} />}
        </Campo>
        <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-[13px] md:min-h-0">
          <input id="obrigacao-gera-titulo" type="checkbox" className="size-[18px] accent-[var(--ok)]" checked={valores.gera_titulo} onChange={(evento) => mudar({ gera_titulo: evento.target.checked })} />
          <span className="font-medium">Gera título a pagar previsto</span>
        </label>
        {valores.gera_titulo && (
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
            <Campo rotulo="Categoria" obrigatorio {...f.campo('categoria_id')}>
              {(controle) => (
                <Selecao {...controle} {...f.entrada('categoria_id')}>
                  <option value="">Escolha</option>
                  {categorias.map((categoria) => (
                    <option key={categoria.id} value={categoria.id}>
                      {categoria.nome}
                    </option>
                  ))}
                </Selecao>
              )}
            </Campo>
            <Campo rotulo="Valor estimado (R$)" ajuda="Sem valor, o título é lançado quando chegar a guia." {...f.campo('valor_estimado')}>
              {(controle) => <Input inputMode="decimal" autoComplete="off" {...controle} {...f.entrada('valor_estimado')} />}
            </Campo>
          </div>
        )}
        <Campo rotulo="Situação" obrigatorio {...f.campo('situacao')}>
          {(controle) => (
            <Selecao {...controle} {...f.entrada('situacao')}>
              {SITUACOES_DA_OBRIGACAO.map((situacao) => (
                <option key={situacao} value={situacao}>
                  {ROTULOS_SITUACAO_OBRIGACAO[situacao]}
                </option>
              ))}
            </Selecao>
          )}
        </Campo>
        {valores.situacao === 'rascunho' && <Faixa tipo="info">Rascunho não gera ocorrências: valide a aplicabilidade antes de ativar.</Faixa>}
        {f.avisoDeCredencial}
      </div>
    </JanelaFormulario>
  );
}
