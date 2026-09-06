-- Executar com: supabase test db
-- O teste roda em transacao e desfaz todos os registros ao final.

begin;

create extension if not exists pgtap with schema extensions;

select plan(31);

select is(
  (
    select count(*)::integer
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = any (array[
        'profiles', 'companies', 'company_contacts', 'consulting_projects',
        'executive_diagnostics', 'diagnostic_answers', 'vehicles', 'drivers',
        'visits', 'findings', 'evidences', 'actions', 'indicators'
      ])
      and c.relrowsecurity
      and c.relforcerowsecurity
  ),
  13,
  'RLS e FORCE RLS estao ativos nas 13 tabelas privadas'
);

select is(
  (
    select count(*)::integer
    from information_schema.columns
    where table_schema = 'public'
      and table_name = any (array[
        'profiles', 'companies', 'company_contacts', 'consulting_projects',
        'executive_diagnostics', 'diagnostic_answers', 'vehicles', 'drivers',
        'visits', 'findings', 'evidences', 'actions', 'indicators'
      ])
      and column_name = 'owner_id'
  ),
  13,
  'Todas as tabelas privadas possuem owner_id'
);

select ok(
  not has_table_privilege('anon', 'public.profiles', 'select,insert,update,delete'),
  'anon nao possui privilegios em profiles'
);

select ok(
  not has_table_privilege('anon', 'public.companies', 'select,insert,update,delete'),
  'anon nao possui privilegios em companies'
);

select ok(
  not has_table_privilege('anon', 'public.executive_diagnostics', 'select,insert,update,delete'),
  'anon nao possui privilegios em executive_diagnostics'
);

select ok(
  not has_table_privilege('anon', 'public.diagnostic_answers', 'select,insert,update,delete'),
  'anon nao possui privilegios em diagnostic_answers'
);

select ok(
  has_table_privilege('authenticated', 'public.companies', 'select,insert,update'),
  'authenticated pode selecionar, inserir e atualizar companies'
);

select ok(
  not has_table_privilege('authenticated', 'public.companies', 'delete'),
  'authenticated nao pode excluir companies'
);

select ok(
  has_table_privilege('authenticated', 'public.executive_diagnostics', 'select,insert,update'),
  'authenticated pode trabalhar com diagnosticos'
);

select ok(
  not has_table_privilege('authenticated', 'public.executive_diagnostics', 'delete'),
  'authenticated nao pode excluir diagnosticos'
);

insert into auth.users (id, email)
values
  ('11111111-1111-1111-1111-111111111111', 'owner-test@rodocore.local'),
  ('22222222-2222-2222-2222-222222222222', 'other-test@rodocore.local');

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

select results_eq(
  $$
    insert into public.companies (owner_id, legal_name, fleet_size)
    values ('11111111-1111-1111-1111-111111111111', 'Empresa do proprietario', 12)
    returning legal_name
  $$,
  array['Empresa do proprietario'::text],
  'proprietario cria a propria empresa'
);

select results_eq(
  $$select count(*)::bigint from public.companies$$,
  array[1::bigint],
  'proprietario enxerga a propria empresa'
);

select results_eq(
  $$
    update public.companies
    set fleet_size = 14
    where legal_name = 'Empresa do proprietario'
    returning fleet_size
  $$,
  array[14::integer],
  'proprietario atualiza a propria empresa'
);

select throws_ok(
  $$delete from public.companies where legal_name = 'Empresa do proprietario'$$,
  '42501',
  null,
  'proprietario nao exclui registros pela API'
);

set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

select is_empty(
  $$select id from public.companies where legal_name = 'Empresa do proprietario'$$,
  'outro usuario nao enxerga a empresa'
);

select is_empty(
  $$
    update public.companies
    set fleet_size = 99
    where legal_name = 'Empresa do proprietario'
    returning id
  $$,
  'outro usuario nao atualiza a empresa'
);

select throws_ok(
  $$
    insert into public.companies (owner_id, legal_name)
    values ('11111111-1111-1111-1111-111111111111', 'Empresa forjada')
  $$,
  '42501',
  null,
  'outro usuario nao cria registro para o proprietario'
);

set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

select results_eq(
  $$select fleet_size from public.companies where legal_name = 'Empresa do proprietario'$$,
  array[14::integer],
  'tentativa de outro usuario nao alterou a empresa'
);

select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'public'
      and tablename = 'companies'
      and roles = array['authenticated']::name[]
      and cmd in ('SELECT', 'INSERT', 'UPDATE')
  ),
  3,
  'companies possui politicas explicitas de select, insert e update'
);

select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'public'
      and tablename = 'executive_diagnostics'
      and roles = array['authenticated']::name[]
      and cmd in ('SELECT', 'INSERT', 'UPDATE')
  ),
  3,
  'executive_diagnostics possui politicas explicitas'
);

select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'public'
      and tablename = 'diagnostic_answers'
      and roles = array['authenticated']::name[]
      and cmd in ('SELECT', 'INSERT', 'UPDATE')
  ),
  3,
  'diagnostic_answers possui politicas explicitas'
);

select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'public'
      and tablename = any (array[
        'companies', 'company_contacts', 'consulting_projects',
        'executive_diagnostics', 'diagnostic_answers', 'vehicles', 'drivers',
        'visits', 'findings', 'evidences', 'actions', 'indicators'
      ])
      and cmd = 'DELETE'
  ),
  0,
  'nenhuma tabela privada possui politica de delete pelo cliente'
);

select ok(
  has_table_privilege('authenticated', 'public.company_contacts', 'select,insert,update'),
  'authenticated possui privilegios esperados em company_contacts'
);

select ok(
  has_table_privilege('authenticated', 'public.consulting_projects', 'select,insert,update'),
  'authenticated possui privilegios esperados em consulting_projects'
);

select ok(
  has_table_privilege('authenticated', 'public.vehicles', 'select,insert,update'),
  'authenticated possui privilegios esperados em vehicles'
);

select ok(
  has_table_privilege('authenticated', 'public.drivers', 'select,insert,update'),
  'authenticated possui privilegios esperados em drivers'
);

select ok(
  has_table_privilege('authenticated', 'public.visits', 'select,insert,update'),
  'authenticated possui privilegios esperados em visits'
);

select ok(
  has_table_privilege('authenticated', 'public.findings', 'select,insert,update'),
  'authenticated possui privilegios esperados em findings'
);

select ok(
  has_table_privilege('authenticated', 'public.evidences', 'select,insert,update'),
  'authenticated possui privilegios esperados em evidences'
);

select ok(
  has_table_privilege('authenticated', 'public.actions', 'select,insert,update'),
  'authenticated possui privilegios esperados em actions'
);

select ok(
  has_table_privilege('authenticated', 'public.indicators', 'select,insert,update'),
  'authenticated possui privilegios esperados em indicators'
);

select * from finish();

rollback;
