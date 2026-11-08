'use client';

/** T05.11 Exportação para a contabilidade (F1): os arquivos da competência e o registro do envio. */
import { useState } from 'react';
import { Download, Send } from 'lucide-react';
import { Campo } from '@/componentes/campos/campo';
import { AbasFinanceiro } from '@/componentes/financeiro/abas-financeiro';
import { useCentral } from '@/componentes/layout/central-provider';
import { aviso } from '@/componentes/padroes/aviso';
import { CabecalhoPagina } from '@/componentes/padroes/cabecalho-pagina';
import { EstadoCarregando, EstadoErro } from '@/componentes/padroes/estados';
import { JanelaFormulario } from '@/componentes/padroes/janela-formulario';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { mensagemDoErro } from '@/dados/erros';
import { useConsulta } from '@/dados/use-consulta';
import { csvDosMovimentos, csvDosTitulos, listaDeComprovantes, montarPacote, registrarEnvio } from '@/dominio/contador';
import { competenciaPadrao } from '@/dominio/fechamento';
import { rotuloDoMes } from '@/dominio/lancamentos';
import { baixarArquivo } from '@/lib/baixar-arquivo';
import { hojeISO } from '@/lib/datas';
import { formatarDiaISO } from '@/lib/formatacao';

const CSV = 'text/csv;charset=utf-8';

function JanelaDoEnvio({ mes, aoFechar }: { mes: string; aoFechar: () => void }) {
  const { pessoa } = useCentral();
  const [dados, setDados] = useState({ data: hojeISO(), para: '', como: '' });
  const [salvando, setSalvando] = useState(false);
  return (
    <JanelaFormulario
      aberto
      aoFechar={aoFechar}
      titulo={`Envio do pacote de ${rotuloDoMes(mes).toLowerCase()}`}
      descricao="Quando, para quem e como o pacote foi enviado. É este registro que marca o item 8 do fechamento."
      alterado={Boolean(dados.para || dados.como)}
      rotuloSalvar="Registrar envio"
      salvando={salvando}
      aoEnviar={(evento) => {
        evento.preventDefault();
        setSalvando(true);
        void registrarEnvio(mes, dados, pessoa.id)
          .then(() => {
            aviso('Envio registrado.');
            aoFechar();
          })
          .catch((erro) => aviso(mensagemDoErro(erro)))
          .finally(() => setSalvando(false));
      }}
    >
      <Campo id="envio-data" rotulo="Data" obrigatorio>
        {(controle) => <Input {...controle} type="date" value={dados.data} onChange={(evento) => setDados((atual) => ({ ...atual, data: evento.target.value }))} />}
      </Campo>
      <Campo id="envio-para" rotulo="Para quem" obrigatorio ajuda="O escritório ou a pessoa da contabilidade.">
        {(controle) => <Input {...controle} autoComplete="off" value={dados.para} onChange={(evento) => setDados((atual) => ({ ...atual, para: evento.target.value }))} />}
      </Campo>
      <Campo id="envio-como" rotulo="Como" obrigatorio ajuda="E-mail, pasta no Drive…">
        {(controle) => <Input {...controle} autoComplete="off" value={dados.como} onChange={(evento) => setDados((atual) => ({ ...atual, como: evento.target.value }))} />}
      </Campo>
    </JanelaFormulario>
  );
}

export function TelaContador() {
  const hoje = hojeISO();
  const [mes, setMes] = useState(competenciaPadrao(hoje));
  const consulta = useConsulta(() => montarPacote(mes), [mes]);
  const [registrando, setRegistrando] = useState(false);

  if (consulta.estado === 'carregando' && !consulta.dados) return <EstadoCarregando />;
  if (consulta.estado === 'erro' || !consulta.dados) {
    return (
      <>
        <h1 className="mb-5">Pacote do contador</h1>
        <EstadoErro titulo="Não deu para montar o pacote." texto="Os dados deste navegador podem estar danificados. Importe um backup ou restaure os exemplos em Configurações › Dados." aoTentarDeNovo={consulta.recarregar} />
      </>
    );
  }
  const pacote = consulta.dados;
  const arquivos = [
    { rotulo: 'Títulos e baixas', detalhe: `${pacote.titulos.length} linhas`, baixar: () => baixarArquivo(`numa-titulos-e-baixas-${mes}.csv`, csvDosTitulos(pacote), CSV) },
    { rotulo: 'Movimentos societários', detalhe: `${pacote.movimentos.length} linhas`, baixar: () => baixarArquivo(`numa-movimentos-societarios-${mes}.csv`, csvDosMovimentos(pacote), CSV) },
    { rotulo: 'Lista de comprovantes', detalhe: `${pacote.comprovantes.length} links`, baixar: () => baixarArquivo(`numa-comprovantes-${mes}.csv`, listaDeComprovantes(pacote), CSV) },
  ];

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        kicker="Financeiro"
        titulo="Pacote do contador"
        resumo="Os arquivos da competência para a contabilidade e o registro de cada envio."
        acoes={
          <Button onClick={() => setRegistrando(true)}>
            <Send aria-hidden />
            Registrar envio
          </Button>
        }
      />
      <AbasFinanceiro ativa="contador" />
      <div className="w-48">
        <Campo id="contador-mes" rotulo="Competência">
          {(controle) => <Input {...controle} type="month" max={hoje.slice(0, 7)} value={mes} onChange={(evento) => evento.target.value && setMes(evento.target.value)} />}
        </Campo>
      </div>

      <ul className="grid gap-3 md:grid-cols-3" aria-label="Arquivos do pacote">
        {arquivos.map((arquivo) => (
          <li key={arquivo.rotulo} className="flex flex-col gap-3 rounded-lg border border-line bg-paper p-4">
            <span>
              <span className="block font-semibold">{arquivo.rotulo}</span>
              <span className="text-[13px] text-ink-soft">{arquivo.detalhe}</span>
            </span>
            <Button variante="secundario" onClick={arquivo.baixar}>
              <Download aria-hidden />
              Baixar CSV
            </Button>
          </li>
        ))}
      </ul>
      <p className="text-xs text-ink-soft">Títulos da competência e baixas com data no mês, com contraparte, documento, categoria, valor em reais, conta e comprovante. Título em moeda estrangeira sem baixa vai sem valor em reais: o valor efetivo vem com o pagamento.</p>

      <section aria-labelledby="envios-titulo" className="space-y-2">
        <h2 id="envios-titulo" className="text-base font-semibold">
          Envios de {rotuloDoMes(mes).toLowerCase()}
        </h2>
        {pacote.envios.length ? (
          <ul className="grid gap-2" aria-label="Envios registrados" data-envios>
            {pacote.envios.map((envio, indice) => (
              <li key={`${envio.data}-${indice}`} className="rounded-lg border border-line bg-paper p-3 text-[13px]">
                {formatarDiaISO(envio.data)} · para {envio.para} · {envio.como}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-ink-soft">Nenhum envio registrado nesta competência.</p>
        )}
      </section>

      {registrando && <JanelaDoEnvio mes={mes} aoFechar={() => setRegistrando(false)} />}
    </div>
  );
}
