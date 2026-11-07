'use client';

import { useEffect, useState } from 'react';
import { Scale } from 'lucide-react';
import { Campo, MensagemErro } from '@/componentes/campos/campo';
import { SelecaoPessoa } from '@/componentes/campos/selecao-pessoa';
import { aviso } from '@/componentes/padroes/aviso';
import { Secao } from '@/componentes/padroes/secao';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { mensagemDoErro } from '@/dados/erros';
import { useConsulta } from '@/dados/use-consulta';
import { carregarConfiguracaoLegal, salvarConfiguracaoLegal } from '@/dominio/legal-configuracao';

/** Chaves de T02.01 usadas por M09 e M10, à parte do formulário geral (RN-09.04, RN-09.10 e D22). */
export function SecaoLegalDaConfiguracao() {
  const consulta = useConsulta(carregarConfiguracaoLegal);
  const dados = consulta.dados;
  const [encarregado, setEncarregado] = useState('');
  const [canal, setCanal] = useState('');
  const [prazo, setPrazo] = useState('');
  const [validade, setValidade] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!dados) return;
    setEncarregado(dados.valores.encarregado_pessoa_id ?? '');
    setCanal(dados.valores.canal_titular_email ?? '');
    setPrazo(dados.valores.prazo_resposta_titular_dias === null ? '' : String(dados.valores.prazo_resposta_titular_dias));
    setValidade(String(dados.valores.validade_proposta_dias));
  }, [dados]);

  async function salvar() {
    setErro(null);
    setSalvando(true);
    try {
      await salvarConfiguracaoLegal({ encarregado, canal, prazo, validade });
      aviso('Configurações de Legal salvas.');
    } catch (problema) {
      setErro(mensagemDoErro(problema));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Secao id="legal" icone={Scale} titulo="Legal e comercial" descricao="O que a publicação e as propostas precisam saber.">
      <div className="grid grid-cols-1 gap-[18px] md:grid-cols-2 md:gap-x-[18px] md:gap-y-5">
        <Campo id="legal-encarregado" rotulo="Encarregado de dados (DPO)" ajuda="Exigido para publicar a Política de Privacidade.">
          {(controle) => <SelecaoPessoa {...controle} pessoas={dados?.pessoas ?? []} value={encarregado} onChange={(evento) => setEncarregado(evento.target.value)} extra={<option value="">Não definido</option>} />}
        </Campo>
        <Campo id="legal-canal" rotulo="Canal do titular" ajuda="E-mail para pedidos de titulares.">
          {(controle) => <Input {...controle} type="email" inputMode="email" autoComplete="off" spellCheck={false} placeholder="Ainda não informado" value={canal} onChange={(evento) => setCanal(evento.target.value)} />}
        </Campo>
        <Campo id="legal-prazo" rotulo="Prazo de resposta ao titular (dias)" ajuda="Sem prazo universal fixado: vazio deixa o prazo pendente em cada solicitação. Confirme a regra aplicável antes de preencher.">
          {(controle) => <Input {...controle} inputMode="numeric" autoComplete="off" placeholder="A definir" value={prazo} onChange={(evento) => setPrazo(evento.target.value)} />}
        </Campo>
        <Campo id="legal-validade" rotulo="Validade das propostas (dias)" obrigatorio ajuda="Padrão de novas propostas (D22).">
          {(controle) => <Input {...controle} inputMode="numeric" autoComplete="off" value={validade} onChange={(evento) => setValidade(evento.target.value)} />}
        </Campo>
      </div>
      {erro && <MensagemErro className="mt-3">{erro}</MensagemErro>}
      <Button variante="secundario" className="mt-4" carregando={salvando} onClick={() => void salvar()}>
        Salvar Legal e comercial
      </Button>
    </Secao>
  );
}
