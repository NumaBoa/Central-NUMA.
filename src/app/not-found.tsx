import Link from 'next/link';
import { Logo } from '@/componentes/marca/logo';
import { Button } from '@/componentes/ui/button';
import { TELA_INICIAL } from '@/dominio/navegacao';

export default function NaoEncontrada() {
  return (
    <main className="mx-4 my-[12vh] max-w-[600px] rounded-xl border border-line bg-paper p-8 md:mx-auto">
      <Logo className="text-[32px]" />
      <h1 className="mt-6">Essa página não existe.</h1>
      <p className="mt-2.5 text-sm text-ink-soft">O endereço pode ter mudado. Volte para o início e siga de lá.</p>
      <Button asChild className="mt-6">
        <Link href={TELA_INICIAL}>Voltar para o início</Link>
      </Button>
    </main>
  );
}
