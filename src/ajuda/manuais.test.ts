import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buscarNaAjuda } from '@/dominio/busca-ajuda';
import { MODULO_CONFIGURACOES, MODULOS_EMPRESA, MODULOS_TOPO, moduloDisponivel } from '@/dominio/navegacao';
import { manuaisPublicados, MODULOS_DOS_MANUAIS, telaDoModulo } from './modulos';
import { assinaturaDoManual, caminhoDoArtigo, textoDaDisponibilidade, textoDoArtigo } from './texto';

const RAIZ = path.resolve(__dirname, '..', '..');

/** A tela de um endereço da Central existe? (`/meu-dia/rotinas` → `src/app/(central)/meu-dia/rotinas/page.tsx`) */
function telaExiste(href: string): boolean {
  const caminho = href.split(/[?#]/)[0] ?? '';
  return existsSync(path.join(RAIZ, 'src', 'app', '(central)', ...caminho.split('/').filter(Boolean), 'page.tsx'));
}

describe('manuais: estrutura', () => {
  it('um item por módulo, M01 a M13, com códigos e endereços únicos', () => {
    expect(MODULOS_DOS_MANUAIS.map((modulo) => modulo.codigo)).toEqual(Array.from({ length: 13 }, (_, i) => `M${String(i + 1).padStart(2, '0')}`));
    expect(new Set(MODULOS_DOS_MANUAIS.map((modulo) => modulo.slug)).size).toBe(13);
  });

  it('um manual por módulo, cada um com o próprio arquivo de PDF', () => {
    const publicados = manuaisPublicados();
    expect(publicados).toHaveLength(13);
    expect(new Set(publicados.map((manual) => manual.arquivo)).size).toBe(publicados.length);
    for (const manual of publicados) expect(manual.arquivo).toMatch(/^Manual-[A-Za-z-]+-Numa$/);
  });

  it('a disponibilidade do módulo vem do menu: sem lista paralela', () => {
    const doMenu = [...MODULOS_TOPO, ...MODULOS_EMPRESA, MODULO_CONFIGURACOES];
    for (const modulo of MODULOS_DOS_MANUAIS) {
      const item = doMenu.find((entrada) => entrada.id === modulo.menu);
      expect(telaDoModulo(modulo)).toBe(item?.href ?? null);
      // Manual publicado só para módulo que existe no menu e tem tela.
      if (modulo.manual) {
        expect(modulo.manual.slug).toBe(modulo.slug);
        // Sem item no menu (M13: busca, sino e relatórios espalhados pelos módulos), o manual volta a uma tela que existe.
        if (modulo.menu === null) expect(telaExiste(modulo.manual.telaDoModulo)).toBe(true);
        else {
          expect(item && moduloDisponivel(item)).toBe(true);
          expect(modulo.manual.telaDoModulo).toBe(item?.href);
        }
      }
    }
  });

  for (const manual of manuaisPublicados()) {
    describe(`Manual ${manual.doModulo}`, () => {
      it('o arquivo do conteúdo tem o nome do endereço (o gerador de PDF depende disso)', () => {
        expect(existsSync(path.join(RAIZ, 'src', 'ajuda', 'manuais', `${manual.slug}.ts`))).toBe(true);
      });

      it('artigos com identificador único, endereço válido e assunto existente', () => {
        const ids = manual.artigos.map((artigo) => artigo.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const artigo of manual.artigos) {
          expect(artigo.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
          expect(manual.assuntos.some((assunto) => assunto.id === artigo.assunto)).toBe(true);
          expect(artigo.resumo.length).toBeGreaterThan(10);
          expect(artigo.palavrasChave.length).toBeGreaterThan(0);
          expect(caminhoDoArtigo(manual, artigo)).toBe(`/ajuda/${manual.slug}/${artigo.id}`);
        }
        // Nenhum assunto vazio.
        for (const assunto of manual.assuntos) expect(manual.artigos.some((artigo) => artigo.assunto === assunto.id)).toBe(true);
      });

      it('recurso futuro nunca oferece ação; condição sempre diz qual', () => {
        for (const artigo of manual.artigos) {
          if (artigo.disponibilidade.tipo === 'futuro') expect(artigo.acao).toBeUndefined();
          if (artigo.disponibilidade.tipo === 'condicao') expect(artigo.disponibilidade.condicao.length).toBeGreaterThan(10);
        }
        expect(textoDaDisponibilidade({ tipo: 'futuro', quando: 'F2' })).toBe('Ainda não implementado. Previsto para: F2.');
      });

      it('todo "Ir para essa ação" leva a uma tela que existe', () => {
        for (const artigo of manual.artigos) if (artigo.acao) expect(telaExiste(artigo.acao.href), `${artigo.id} → ${artigo.acao.href}`).toBe(true);
        expect(telaExiste(manual.telaDoModulo)).toBe(true);
      });

      it('procedimentos sempre completos: objetivo, caminho, passos e resultado', () => {
        const procedimentos = manual.artigos.flatMap((artigo) => artigo.blocos.filter((bloco) => bloco.tipo === 'procedimento'));
        expect(procedimentos.length).toBeGreaterThan(0);
        for (const bloco of procedimentos) {
          expect(bloco.objetivo).not.toBe('');
          expect(bloco.caminho).not.toBe('');
          expect(bloco.passos.length).toBeGreaterThan(0);
          expect(bloco.resultado).not.toBe('');
        }
      });

      it('sem nomes técnicos no texto (tabela, componente, biblioteca)', () => {
        const proibidos = /localStorage|repositorio|componente|tabela_|React|Next\.js|Tailwind|Zod|\bAPI\b/i;
        for (const artigo of manual.artigos) expect(`${artigo.titulo} ${artigo.resumo} ${textoDoArtigo(artigo)}`, artigo.id).not.toMatch(proibidos);
      });

      it('o PDF publicado foi gerado deste conteúdo (senão: node scripts/gerar-manuais.mjs)', () => {
        const pdf = path.join(RAIZ, 'public', 'manuais', `${manual.arquivo}.pdf`);
        expect(existsSync(pdf)).toBe(true);
        expect(readFileSync(pdf).subarray(0, 5).toString()).toBe('%PDF-');
        const manifesto = JSON.parse(readFileSync(path.join(RAIZ, 'public', 'manuais', 'manuais.json'), 'utf8'));
        expect(manifesto[manual.slug]?.arquivo).toBe(`${manual.arquivo}.pdf`);
        expect(manifesto[manual.slug]?.assinatura, 'o PDF está desatualizado: gere de novo').toBe(assinaturaDoManual(manual));
      });
    });
  }
});

describe('busca "Como fazer"', () => {
  const ids = (busca: string) => buscarNaAjuda(busca).itens.map((item) => item.id);

  it('acha pelo título, sem ligar para acento ou maiúscula', () => {
    expect(ids('ADIAR')[0]).toBe('meu-dia/adiar');
    expect(ids('historico')).toContain('meu-dia/historico');
  });

  it('entende termos equivalentes', () => {
    expect(ids('remarcar prazo')).toContain('meu-dia/adiar');
    expect(ids('recorrência')).toContain('meu-dia/criar-rotina');
    expect(ids('dar baixa')).toEqual(ids('registrar pagamento'));
    expect(ids('dar baixa').slice(0, 3)).toContain('financeiro/registrar-baixa');
    expect(ids('pagar conta')).toContain('financeiro/registrar-baixa');
  });

  it('diz o módulo, leva ao artigo e oferece a ação só quando ela existe', () => {
    const [primeiro] = buscarNaAjuda('criar rotina').itens;
    expect(primeiro).toMatchObject({ id: 'meu-dia/criar-rotina', modulo: 'Meu dia', href: '/ajuda/meu-dia/criar-rotina', acao: { href: '/meu-dia/rotinas' } });
    for (const item of buscarNaAjuda('login').itens) if (item.disponibilidade.tipo === 'futuro') expect(item.acao).toBeNull();
  });

  it('todas as palavras contam: busca com duas palavras não traz o que só tem uma', () => {
    expect(ids('adiar xyzabc')).toEqual([]);
  });

  it('reembolso: o artigo do Financeiro, com o módulo', () => {
    expect(buscarNaAjuda('reembolso').itens[0]).toMatchObject({ id: 'financeiro/reembolso', modulo: 'Financeiro' });
  });

  it('sem artigo para o assunto, volta vazio (a busca mostra o aviso e o link para os manuais)', () => {
    expect(buscarNaAjuda('xilofone')).toEqual({ itens: [], total: 0 });
    expect(buscarNaAjuda('  ')).toEqual({ itens: [], total: 0 });
  });

  it('até 6 artigos, dizendo quantos há', () => {
    const resultado = buscarNaAjuda('atividade');
    expect(resultado.itens.length).toBe(6);
    expect(resultado.total).toBeGreaterThan(6);
  });
});
