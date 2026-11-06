import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Instrument_Sans } from 'next/font/google';
import { chaveDaTabela } from '@/dados/armazenamento';
import { CHAVE_META } from '@/dados/meta';
import { FUSO_PADRAO } from '@/lib/datas';
import './globals.css';

const bricolage = Bricolage_Grotesque({ subsets: ['latin'], axes: ['opsz'], variable: '--font-bricolage', display: 'swap' });
const instrument = Instrument_Sans({ subsets: ['latin'], variable: '--font-instrument', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Central Numa', template: '%s · Central Numa' },
  description: 'Sistema interno de gestão da Numa.',
};

export const viewport: Viewport = {
  themeColor: '#F8F6F2',
  viewportFit: 'cover',
};

/**
 * Roda antes da primeira pintura, para nada aparecer e sumir: esconde a Central por trás da
 * abertura e aplica o menu recolhido. Mesmas regras de dominio/abertura, dados/meta e dados/fuso.
 */
const SCRIPT_INICIAL = `(function(){try{
var raiz=document.documentElement;
var meta=JSON.parse(localStorage.getItem(${JSON.stringify(CHAVE_META)})||'{}');
var hoje;
try{
var linhas=JSON.parse(localStorage.getItem(${JSON.stringify(chaveDaTabela('configuracao'))})||'[]');
var fuso=${JSON.stringify(FUSO_PADRAO)};
for(var i=0;i<linhas.length;i++)if(linhas[i].chave==='fuso')fuso=linhas[i].valor;
hoje=new Intl.DateTimeFormat('en-CA',{timeZone:fuso}).format(new Date());
}catch(e){hoje=new Intl.DateTimeFormat('en-CA',{timeZone:${JSON.stringify(FUSO_PADRAO)}}).format(new Date());}
if(meta.ultima_abertura!==hoje||new URLSearchParams(location.search).has('abertura'))raiz.setAttribute('data-abertura','');
if(meta.menu_recolhido)raiz.setAttribute('data-menu-recolhido','');
}catch(e){document.documentElement.setAttribute('data-abertura','');}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" data-scroll-behavior="smooth" className={`${bricolage.variable} ${instrument.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_INICIAL }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
