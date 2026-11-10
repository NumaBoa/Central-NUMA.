'use client';

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent, type ReactNode } from 'react';
import { CloudOff, LogOut } from 'lucide-react';
import { Campo } from '@/componentes/campos/campo';
import { FiosInterativos } from '@/componentes/marca/fios-interativos';
import { Logo } from '@/componentes/marca/logo';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { lerTabela } from '@/dados/armazenamento';
import { gravarMeta, lerMeta } from '@/dados/meta';
import { nuvemConfigurada } from '@/dados/nuvem/config';
import {
  assinarSituacaoEnvio,
  clienteNuvem,
  haEnvioPendente,
  iniciarNuvem,
  lerSituacaoEnvio,
  retomarEnvio,
  tipoDoLinkDeEntrada,
  type SituacaoEnvio,
} from '@/dados/nuvem/sincronizacao';
import type { Pessoa } from '@/dados/tipos/pessoa';

type Etapa =
  | { nome: 'verificando' }
  | { nome: 'entrar' }
  | { nome: 'definir_senha' }
  | { nome: 'sem_acesso'; email: string }
  | { nome: 'carregando' }
  | { nome: 'pronto'; email: string }
  | { nome: 'erro'; mensagem: string };

const SITUACAO_EM_DIA: SituacaoEnvio = { estado: 'em_dia' };

/** "Você é" começa na pessoa cadastrada com o e-mail de quem entrou. */
function escolherPessoaPeloEmail(email: string) {
  if (lerMeta().pessoa_atual_id) return;
  const pessoa = lerTabela<Pessoa>('pessoa').find((item) => item.email?.toLowerCase() === email.toLowerCase() && !item.arquivado_em);
  if (pessoa) gravarMeta({ pessoa_atual_id: pessoa.id });
}

/**
 * Com o Supabase configurado, a Central só abre para quem entrou com um e-mail autorizado. Sem ele,
 * mostra a Central direto, como sempre foi no computador.
 */
export function PortaoNuvem({ children }: { children: ReactNode }) {
  if (!nuvemConfigurada()) return children;
  return <Portao>{children}</Portao>;
}

function Portao({ children }: { children: ReactNode }) {
  const [etapa, setEtapa] = useState<Etapa>({ nome: 'verificando' });
  /** A sessão caiu com a Central aberta: o login aparece por cima, sem perder o que está na tela. */
  const [sessaoCaiu, setSessaoCaiu] = useState(false);
  const iniciou = useRef(false);

  useEffect(() => {
    const auth = clienteNuvem().auth;
    let emailAtual: string | null = null;

    async function entrarCom(email: string) {
      if (iniciou.current) {
        if (email === emailAtual) {
          setSessaoCaiu(false);
          retomarEnvio();
        } else window.location.reload();
        return;
      }
      setEtapa({ nome: 'carregando' });
      const { data: temAcesso, error } = await clienteNuvem().rpc('tem_acesso');
      if (error) return setEtapa({ nome: 'erro', mensagem: 'Não foi possível falar com o servidor. Confira a internet e tente de novo.' });
      if (!temAcesso) return setEtapa({ nome: 'sem_acesso', email });
      try {
        iniciou.current = true;
        emailAtual = email;
        await iniciarNuvem();
        escolherPessoaPeloEmail(email);
        setEtapa({ nome: 'pronto', email });
      } catch (erro) {
        console.error('Central: falha ao carregar os dados', erro);
        iniciou.current = false;
        setEtapa({ nome: 'erro', mensagem: 'Não foi possível carregar os dados. Confira a internet e tente de novo.' });
      }
    }

    const { data } = auth.onAuthStateChange((evento, sessao) => {
      if (evento === 'PASSWORD_RECOVERY') return setEtapa({ nome: 'definir_senha' });
      if (evento === 'SIGNED_OUT') {
        if (iniciou.current) setSessaoCaiu(true);
        else setEtapa({ nome: 'entrar' });
        return;
      }
      if (evento === 'INITIAL_SESSION' || evento === 'SIGNED_IN') {
        if (!sessao) return setEtapa({ nome: 'entrar' });
        if (tipoDoLinkDeEntrada === 'invite' || tipoDoLinkDeEntrada === 'recovery') {
          if (!iniciou.current) return setEtapa({ nome: 'definir_senha' });
        }
        // Fora do callback: o cliente não aceita outra chamada enquanto avisa a mudança.
        setTimeout(() => void entrarCom(sessao.user.email ?? ''), 0);
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  if (etapa.nome === 'pronto') {
    return (
      <>
        {children}
        <AvisoDeEnvio />
        {sessaoCaiu && (
          <div className="fixed inset-0 z-[100] bg-paper/95">
            <TelaEntrar aviso="Sua sessão terminou. Entre de novo para continuar: o que você fez continua aqui." />
          </div>
        )}
      </>
    );
  }
  if (etapa.nome === 'entrar') return <TelaEntrar />;
  if (etapa.nome === 'definir_senha') return <TelaDefinirSenha aoConcluir={() => window.location.replace('/')} />;
  if (etapa.nome === 'sem_acesso') {
    return (
      <Cartao titulo="Acesso ainda não liberado">
        <p className="text-sm text-ink-soft">
          O e-mail <strong className="text-ink">{etapa.email}</strong> entrou, mas ainda não tem acesso à Central. Peça para quem administra a Central incluir este e-mail.
        </p>
        <BotaoSair className="mt-6 w-full" variante="secundario" />
      </Cartao>
    );
  }
  if (etapa.nome === 'erro') {
    return (
      <Cartao titulo="Algo deu errado">
        <p className="text-sm text-ink-soft">{etapa.mensagem}</p>
        <Button className="mt-6 w-full" onClick={() => window.location.reload()}>
          Tentar de novo
        </Button>
      </Cartao>
    );
  }
  return (
    <div className="grid min-h-dvh place-items-center bg-linen" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-4">
        <Logo className="text-4xl" />
        <p className="text-sm text-ink-soft">{etapa.nome === 'carregando' ? 'Carregando os dados…' : 'Abrindo a Central…'}</p>
      </div>
    </div>
  );
}

function Cartao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <main className="relative isolate min-h-dvh overflow-hidden bg-linen">
      <FiosInterativos className="fixed -z-10" />
      <div className="mx-auto grid min-h-dvh max-w-[1180px] content-center items-center gap-8 px-4 py-10 md:px-8 lg:grid-cols-[1fr_400px] lg:gap-16">
        <header className="lg:pb-6">
          <Logo className="text-[64px] md:text-[96px] lg:text-[148px]" pontoClassName="ring-[.09em] ring-indigo-wash" />
          <p className="mt-3 font-display text-xl leading-tight text-ink md:text-2xl lg:mt-5 lg:text-[34px]">Tecnologia que simplifica a vida.</p>
          <p className="mt-2 text-sm text-ink-soft md:text-base">Um estúdio de software para a rotina funcionar numa boa.</p>
        </header>
        <div className="w-full max-w-[400px] rounded-[20px] border border-line bg-paper/95 p-6 shadow-e2 backdrop-blur-sm md:p-8">
          <h1 className="mb-2 font-display text-xl font-bold text-ink">{titulo}</h1>
          {children}
        </div>
      </div>
    </main>
  );
}

function traduzirErro(mensagem: string): string {
  if (/invalid login credentials/i.test(mensagem)) return 'E-mail ou senha incorretos.';
  if (/email not confirmed/i.test(mensagem)) return 'Este e-mail ainda não foi confirmado. Procure o convite na sua caixa de entrada.';
  if (/rate limit|too many/i.test(mensagem)) return 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.';
  if (/should be at least|password.*(short|weak)/i.test(mensagem)) return 'A senha precisa ter pelo menos 8 caracteres, com letras e números.';
  if (/same.*password|different from the old/i.test(mensagem)) return 'A senha nova precisa ser diferente da anterior.';
  if (/fetch|network/i.test(mensagem)) return 'Sem conexão com o servidor. Confira a internet e tente de novo.';
  return 'Não foi possível concluir. Tente de novo em instantes.';
}

function TelaEntrar({ aviso }: { aviso?: string }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    setMensagem(null);
    setEnviando(true);
    const { error } = await clienteNuvem().auth.signInWithPassword({ email: email.trim(), password: senha });
    setEnviando(false);
    if (error) setErro(traduzirErro(error.message));
  }

  async function esqueci() {
    setErro(null);
    setMensagem(null);
    if (!email.trim()) return setErro('Escreva seu e-mail acima para receber o link de nova senha.');
    setEnviando(true);
    const { error } = await clienteNuvem().auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
    setEnviando(false);
    if (error) setErro(traduzirErro(error.message));
    else setMensagem('Se este e-mail tiver acesso, chega em instantes um link para criar uma senha nova.');
  }

  return (
    <Cartao titulo="Entrar na Central">
      {aviso && <p className="mb-4 text-sm text-ink-soft">{aviso}</p>}
      <form onSubmit={entrar} className="flex flex-col gap-4" noValidate>
        <Campo rotulo="E-mail" id="entrar-email">
          {(controle) => <Input {...controle} type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}
        </Campo>
        <Campo rotulo="Senha" id="entrar-senha">
          {(controle) => <Input {...controle} type="password" autoComplete="current-password" required value={senha} onChange={(e) => setSenha(e.target.value)} />}
        </Campo>
        {erro && (
          <p role="alert" className="text-sm text-err">
            {erro}
          </p>
        )}
        {mensagem && (
          <p role="status" className="text-sm text-ink-soft">
            {mensagem}
          </p>
        )}
        <Button type="submit" carregando={enviando} disabled={!email.trim() || !senha}>
          Entrar
        </Button>
        <Button variante="terciario" onClick={esqueci} disabled={enviando}>
          Esqueci minha senha
        </Button>
      </form>
    </Cartao>
  );
}

function TelaDefinirSenha({ aoConcluir }: { aoConcluir: () => void }) {
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    if (senha.length < 8) return setErro('A senha precisa ter pelo menos 8 caracteres.');
    if (senha !== confirmacao) return setErro('As duas senhas não são iguais.');
    setEnviando(true);
    const { error } = await clienteNuvem().auth.updateUser({ password: senha });
    setEnviando(false);
    if (error) return setErro(traduzirErro(error.message));
    aoConcluir();
  }

  return (
    <Cartao titulo="Crie sua senha">
      <p className="mb-4 text-sm text-ink-soft">É com ela que você vai entrar na Central daqui em diante.</p>
      <form onSubmit={salvar} className="flex flex-col gap-4" noValidate>
        <Campo rotulo="Senha nova" id="senha-nova" ajuda="Pelo menos 8 caracteres.">
          {(controle) => <Input {...controle} type="password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} />}
        </Campo>
        <Campo rotulo="Repita a senha" id="senha-confirmacao">
          {(controle) => <Input {...controle} type="password" autoComplete="new-password" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} />}
        </Campo>
        {erro && (
          <p role="alert" className="text-sm text-err">
            {erro}
          </p>
        )}
        <Button type="submit" carregando={enviando}>
          Salvar senha e entrar
        </Button>
      </form>
    </Cartao>
  );
}

/** Só aparece quando o envio ao banco atrasou ou foi recusado. */
function AvisoDeEnvio() {
  const situacao = useSyncExternalStore(assinarSituacaoEnvio, lerSituacaoEnvio, () => SITUACAO_EM_DIA);

  useEffect(() => {
    const aoSair = (evento: BeforeUnloadEvent) => {
      if (haEnvioPendente()) evento.preventDefault();
    };
    window.addEventListener('beforeunload', aoSair);
    return () => window.removeEventListener('beforeunload', aoSair);
  }, []);

  if (situacao.estado !== 'tentando' && situacao.estado !== 'bloqueado') return null;
  return (
    <div role="alert" className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+84px)] z-[90] mx-auto flex max-w-[560px] items-start gap-3 rounded-[14px] bg-ink px-4 py-3 text-sm text-white shadow-e2 lg:bottom-6">
      <CloudOff className="mt-0.5 size-[18px] shrink-0" aria-hidden />
      <p>
        {situacao.mensagem}{' '}
        {situacao.estado === 'tentando' ? 'As últimas alterações ainda não foram salvas; tentando de novo…' : 'As últimas alterações não foram salvas. Recarregue a página.'}
      </p>
    </div>
  );
}

/** "Sair", junto do "Você é". Só existe com o Supabase. */
export function BotaoSair({ className, variante = 'terciario', compacto = false }: { className?: string; variante?: 'terciario' | 'secundario'; compacto?: boolean }) {
  const [saindo, setSaindo] = useState(false);
  if (!nuvemConfigurada()) return null;

  async function sair() {
    if (haEnvioPendente() && !window.confirm('Há alterações ainda não salvas no servidor. Sair mesmo assim?')) return;
    setSaindo(true);
    gravarMeta({ pessoa_atual_id: null });
    await clienteNuvem().auth.signOut();
    window.location.replace('/');
  }

  return (
    <Button variante={variante} tamanho="pequeno" className={className} onClick={sair} carregando={saindo} aria-label="Sair da Central">
      <LogOut aria-hidden />
      <span className={compacto ? 'trilho:hidden' : undefined}>Sair</span>
    </Button>
  );
}
