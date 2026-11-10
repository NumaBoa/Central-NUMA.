-- Central Numa no Supabase: rodar inteiro no SQL Editor (pode rodar de novo sem perder dados).
--
-- Cada linha de cada tabela da Central vira um registro aqui, com o conteúdo em `dados` (JSON).
-- As regras, o histórico e as migrações continuam no código (src/dominio e src/dados/carga.ts).
-- Só entra quem estiver logado E com o e-mail em `acesso`.

-- ---------- Quem pode entrar ----------

create table if not exists public.acesso (
  email text primary key check (email = lower(email)),
  incluido_em timestamptz not null default now()
);
alter table public.acesso enable row level security;
-- Sem políticas: ninguém lê nem grava `acesso` pelo site. Inclua e retire e-mails pelo painel.

create or replace function public.tem_acesso()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.acesso a
    where a.email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- ---------- Os dados ----------

create table if not exists public.registro (
  tabela text not null,
  id text not null,
  dados jsonb not null,
  -- Mantém a ordem em que as linhas foram criadas, como na versão local.
  ordem bigint generated always as identity,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid default auth.uid(),
  -- Qual aba aberta gravou: ela ignora o próprio eco no tempo real.
  origem text,
  primary key (tabela, id)
);
create index if not exists registro_ordem on public.registro (ordem);
alter table public.registro enable row level security;
-- No tempo real, a remoção chega com a tabela e o id: é o que basta para tirar a linha da tela.

drop policy if exists "ler com acesso" on public.registro;
drop policy if exists "incluir com acesso" on public.registro;
drop policy if exists "alterar com acesso" on public.registro;
drop policy if exists "remover com acesso" on public.registro;
create policy "ler com acesso" on public.registro for select to authenticated using ((select public.tem_acesso()));
create policy "incluir com acesso" on public.registro for insert to authenticated with check ((select public.tem_acesso()));
create policy "alterar com acesso" on public.registro for update to authenticated using ((select public.tem_acesso())) with check ((select public.tem_acesso()));
create policy "remover com acesso" on public.registro for delete to authenticated using ((select public.tem_acesso()));

-- Várias tabelas de uma vez: ou tudo, ou nada (AR-02). Uma chamada é uma transação.
create or replace function public.gravar_lote(origem text, upserts jsonb, remocoes jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not public.tem_acesso() then
    raise exception 'Este e-mail não tem acesso à Central.' using errcode = '42501';
  end if;

  delete from public.registro r
  using jsonb_to_recordset(coalesce(remocoes, '[]'::jsonb)) as x(tabela text, id text)
  where r.tabela = x.tabela and r.id = x.id;

  insert into public.registro (tabela, id, dados, origem)
  select x.tabela, x.id, x.dados, gravar_lote.origem
  from rows from (jsonb_to_recordset(coalesce(upserts, '[]'::jsonb)) as (tabela text, id text, dados jsonb)) with ordinality as x(tabela, id, dados, n)
  order by x.n
  on conflict (tabela, id) do update
    set dados = excluded.dados,
        origem = excluded.origem,
        atualizado_em = now(),
        atualizado_por = auth.uid();
end;
$$;

-- ---------- Permissões: só o necessário, só para quem está logado ----------

revoke all on public.acesso from anon, authenticated;
revoke all on public.registro from anon, authenticated;
grant select, insert, update, delete on public.registro to authenticated;

revoke all on function public.tem_acesso() from public, anon;
revoke all on function public.gravar_lote(text, jsonb, jsonb) from public, anon;
grant execute on function public.tem_acesso() to authenticated;
grant execute on function public.gravar_lote(text, jsonb, jsonb) to authenticated;

-- ---------- Tempo real: quem está com a Central aberta vê o que os outros gravam ----------

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'registro'
  ) then
    alter publication supabase_realtime add table public.registro;
  end if;
end $$;
