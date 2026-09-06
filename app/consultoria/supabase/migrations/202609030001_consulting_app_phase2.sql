-- RodoCore Consultoria - Fase 2
-- Aplicar somente no projeto Supabase exclusivo "rodocore-consultoria".
-- Todas as tabelas deste arquivo sao privadas e isoladas por owner_id.

do $$
begin
  create type public.rodocore_diagnostic_status as enum ('draft', 'completed', 'archived');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.rodocore_classification as enum ('D', 'E', 'N', 'NA');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.rodocore_project_status as enum ('planning', 'active', 'paused', 'completed', 'cancelled');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.rodocore_visit_status as enum ('planned', 'completed', 'cancelled');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.rodocore_action_status as enum ('planned', 'in_progress', 'completed', 'cancelled');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  owner_id uuid not null unique references auth.users (id) on delete cascade,
  display_name text not null default 'Consultor' check (char_length(trim(display_name)) between 2 and 120),
  job_title text check (job_title is null or char_length(trim(job_title)) between 2 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_owner_matches_id check (owner_id = id)
);

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  legal_name text not null check (char_length(trim(legal_name)) between 2 and 160),
  trade_name text check (trade_name is null or char_length(trim(trade_name)) between 2 and 160),
  registration_number text check (registration_number is null or char_length(trim(registration_number)) between 2 and 32),
  fleet_size integer check (fleet_size is null or fleet_size between 1 and 100000),
  notes text check (notes is null or char_length(notes) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id)
);

create table if not exists public.company_contacts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  company_id uuid not null,
  full_name text not null check (char_length(trim(full_name)) between 2 and 120),
  job_title text check (job_title is null or char_length(trim(job_title)) between 2 and 120),
  email text check (email is null or char_length(trim(email)) between 5 and 254),
  phone text check (phone is null or char_length(trim(phone)) between 8 and 24),
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id),
  constraint company_contacts_company_owner_fk
    foreign key (company_id, owner_id)
    references public.companies (id, owner_id)
    on delete cascade
);

create table if not exists public.executive_diagnostics (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  company_id uuid not null,
  title text not null default 'Diagnostico Executivo' check (char_length(trim(title)) between 2 and 160),
  status public.rodocore_diagnostic_status not null default 'draft',
  current_step integer not null default 0 check (current_step between 0 and 200),
  fuel_maturity smallint check (fuel_maturity between 0 and 3),
  maintenance_maturity smallint check (maintenance_maturity between 0 and 3),
  tires_maturity smallint check (tires_maturity between 0 and 3),
  drivers_maturity smallint check (drivers_maturity between 0 and 3),
  general_notes text check (general_notes is null or char_length(general_notes) <= 12000),
  preliminary_summary jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id),
  constraint executive_diagnostics_company_owner_fk
    foreign key (company_id, owner_id)
    references public.companies (id, owner_id)
    on delete cascade,
  constraint executive_diagnostics_completion_check check (
    (status <> 'completed') or completed_at is not null
  )
);

create table if not exists public.diagnostic_answers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  diagnostic_id uuid not null,
  pillar text not null check (pillar in ('fuel', 'maintenance', 'tires', 'drivers')),
  question_key text not null check (char_length(question_key) between 2 and 100),
  classification public.rodocore_classification not null,
  maturity_score smallint check (maturity_score is null or maturity_score between 0 and 3),
  answer_payload jsonb not null default '{}'::jsonb,
  notes text check (notes is null or char_length(notes) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (diagnostic_id, question_key),
  unique (id, owner_id),
  constraint diagnostic_answers_diagnostic_owner_fk
    foreign key (diagnostic_id, owner_id)
    references public.executive_diagnostics (id, owner_id)
    on delete cascade
);

create table if not exists public.consulting_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  company_id uuid not null,
  source_diagnostic_id uuid,
  name text not null check (char_length(trim(name)) between 2 and 160),
  status public.rodocore_project_status not null default 'planning',
  objective text check (objective is null or char_length(objective) <= 4000),
  starts_on date,
  target_ends_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id),
  unique (source_diagnostic_id),
  constraint consulting_projects_company_owner_fk
    foreign key (company_id, owner_id)
    references public.companies (id, owner_id)
    on delete cascade,
  constraint consulting_projects_diagnostic_owner_fk
    foreign key (source_diagnostic_id, owner_id)
    references public.executive_diagnostics (id, owner_id)
    on delete restrict,
  constraint consulting_projects_dates_check check (
    target_ends_on is null or starts_on is null or target_ends_on >= starts_on
  )
);

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  company_id uuid not null,
  internal_code text not null check (char_length(trim(internal_code)) between 1 and 60),
  license_plate text check (license_plate is null or char_length(trim(license_plate)) between 6 and 12),
  vehicle_type text check (vehicle_type is null or char_length(trim(vehicle_type)) between 2 and 80),
  active boolean not null default true,
  notes text check (notes is null or char_length(notes) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id),
  unique (owner_id, company_id, internal_code),
  constraint vehicles_company_owner_fk
    foreign key (company_id, owner_id)
    references public.companies (id, owner_id)
    on delete cascade
);

create table if not exists public.drivers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  company_id uuid not null,
  internal_code text not null check (char_length(trim(internal_code)) between 1 and 60),
  active boolean not null default true,
  notes text check (notes is null or char_length(notes) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id),
  unique (owner_id, company_id, internal_code),
  constraint drivers_company_owner_fk
    foreign key (company_id, owner_id)
    references public.companies (id, owner_id)
    on delete cascade
);

comment on table public.drivers is
  'Motoristas identificados apenas por codigo interno; nao armazenar CPF, CNH ou dados pessoais desnecessarios.';

create table if not exists public.visits (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid not null,
  visit_number smallint check (visit_number is null or visit_number between 1 and 100),
  focus_pillar text check (focus_pillar is null or focus_pillar in ('fuel', 'maintenance', 'tires', 'drivers', 'general')),
  scheduled_on date,
  completed_on date,
  status public.rodocore_visit_status not null default 'planned',
  notes text check (notes is null or char_length(notes) <= 12000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id),
  constraint visits_project_owner_fk
    foreign key (project_id, owner_id)
    references public.consulting_projects (id, owner_id)
    on delete cascade
);

create table if not exists public.findings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid not null,
  diagnostic_id uuid,
  pillar text not null check (pillar in ('fuel', 'maintenance', 'tires', 'drivers', 'general')),
  title text not null check (char_length(trim(title)) between 2 and 180),
  description text check (description is null or char_length(description) <= 12000),
  classification public.rodocore_classification,
  priority smallint check (priority is null or priority between 1 and 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id),
  constraint findings_project_owner_fk
    foreign key (project_id, owner_id)
    references public.consulting_projects (id, owner_id)
    on delete cascade,
  constraint findings_diagnostic_owner_fk
    foreign key (diagnostic_id, owner_id)
    references public.executive_diagnostics (id, owner_id)
    on delete restrict
);

create table if not exists public.evidences (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  finding_id uuid not null,
  evidence_type text not null default 'note' check (evidence_type in ('note', 'document_reference', 'photo_reference', 'system_reference')),
  reference_code text check (reference_code is null or char_length(trim(reference_code)) <= 240),
  description text not null check (char_length(trim(description)) between 2 and 12000),
  observed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id),
  constraint evidences_finding_owner_fk
    foreign key (finding_id, owner_id)
    references public.findings (id, owner_id)
    on delete cascade
);

create table if not exists public.actions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid not null,
  finding_id uuid,
  title text not null check (char_length(trim(title)) between 2 and 180),
  description text check (description is null or char_length(description) <= 12000),
  responsible_label text check (responsible_label is null or char_length(trim(responsible_label)) <= 120),
  due_on date,
  status public.rodocore_action_status not null default 'planned',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id),
  constraint actions_project_owner_fk
    foreign key (project_id, owner_id)
    references public.consulting_projects (id, owner_id)
    on delete cascade,
  constraint actions_finding_owner_fk
    foreign key (finding_id, owner_id)
    references public.findings (id, owner_id)
    on delete restrict
);

create table if not exists public.indicators (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid not null,
  name text not null check (char_length(trim(name)) between 2 and 160),
  unit text check (unit is null or char_length(trim(unit)) <= 40),
  baseline_value numeric,
  target_value numeric,
  current_value numeric,
  measured_on date,
  notes text check (notes is null or char_length(notes) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id),
  constraint indicators_project_owner_fk
    foreign key (project_id, owner_id)
    references public.consulting_projects (id, owner_id)
    on delete cascade
);

create or replace function public.rodocore_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.rodocore_touch_updated_at() from public, anon, authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles', 'companies', 'company_contacts', 'consulting_projects',
    'executive_diagnostics', 'diagnostic_answers', 'vehicles', 'drivers',
    'visits', 'findings', 'evidences', 'actions', 'indicators'
  ]
  loop
    execute format('drop trigger if exists rodocore_touch_updated_at on public.%I', table_name);
    execute format(
      'create trigger rodocore_touch_updated_at before update on public.%I for each row execute function public.rodocore_touch_updated_at()',
      table_name
    );
  end loop;
end $$;

create or replace function public.rodocore_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, owner_id, display_name)
  values (
    new.id,
    new.id,
    left(
      coalesce(
        nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
        'Consultor'
      ),
      120
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.rodocore_handle_new_user() from public, anon, authenticated;

drop trigger if exists on_rodocore_auth_user_created on auth.users;
create trigger on_rodocore_auth_user_created
  after insert on auth.users
  for each row execute function public.rodocore_handle_new_user();

insert into public.profiles (id, owner_id, display_name)
select
  users.id,
  users.id,
  left(
    coalesce(
      nullif(trim(users.raw_user_meta_data ->> 'display_name'), ''),
      'Consultor'
    ),
    120
  )
from auth.users as users
on conflict (id) do nothing;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles', 'companies', 'company_contacts', 'consulting_projects',
    'executive_diagnostics', 'diagnostic_answers', 'vehicles', 'drivers',
    'visits', 'findings', 'evidences', 'actions', 'indicators'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format('create index if not exists %I on public.%I (owner_id)', table_name || '_owner_id_idx', table_name);
    execute format('revoke all on table public.%I from anon, authenticated', table_name);
  end loop;
end $$;

grant select, update on table public.profiles to authenticated;

grant select, insert, update on table
  public.companies,
  public.company_contacts,
  public.consulting_projects,
  public.executive_diagnostics,
  public.diagnostic_answers,
  public.vehicles,
  public.drivers,
  public.visits,
  public.findings,
  public.evidences,
  public.actions,
  public.indicators
to authenticated;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) is not null and owner_id = (select auth.uid()));

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) is not null and owner_id = (select auth.uid()))
  with check ((select auth.uid()) is not null and owner_id = (select auth.uid()) and id = owner_id);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'companies', 'company_contacts', 'consulting_projects',
    'executive_diagnostics', 'diagnostic_answers', 'vehicles', 'drivers',
    'visits', 'findings', 'evidences', 'actions', 'indicators'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', table_name || '_select_own', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select auth.uid()) is not null and owner_id = (select auth.uid()))',
      table_name || '_select_own',
      table_name
    );

    execute format('drop policy if exists %I on public.%I', table_name || '_insert_own', table_name);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) is not null and owner_id = (select auth.uid()))',
      table_name || '_insert_own',
      table_name
    );

    execute format('drop policy if exists %I on public.%I', table_name || '_update_own', table_name);
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select auth.uid()) is not null and owner_id = (select auth.uid())) with check ((select auth.uid()) is not null and owner_id = (select auth.uid()))',
      table_name || '_update_own',
      table_name
    );
  end loop;
end $$;

create index if not exists company_contacts_company_id_idx on public.company_contacts (company_id);
create index if not exists executive_diagnostics_company_id_idx on public.executive_diagnostics (company_id);
create index if not exists diagnostic_answers_diagnostic_id_idx on public.diagnostic_answers (diagnostic_id);
create index if not exists consulting_projects_company_id_idx on public.consulting_projects (company_id);
create index if not exists vehicles_company_id_idx on public.vehicles (company_id);
create index if not exists drivers_company_id_idx on public.drivers (company_id);
create index if not exists visits_project_id_idx on public.visits (project_id);
create index if not exists findings_project_id_idx on public.findings (project_id);
create index if not exists evidences_finding_id_idx on public.evidences (finding_id);
create index if not exists actions_project_id_idx on public.actions (project_id);
create index if not exists indicators_project_id_idx on public.indicators (project_id);

comment on table public.profiles is 'Perfil privado do consultor, isolado pelo usuario autenticado.';
comment on table public.companies is 'Empresas privadas cadastradas pelo consultor.';
comment on table public.executive_diagnostics is 'Diagnosticos executivos privados, com maturidade de 0 a 3.';
comment on table public.diagnostic_answers is 'Respostas D, E, N ou NA do diagnostico executivo.';
comment on table public.consulting_projects is 'Projetos de consultoria originados ou nao de um diagnostico concluido.';
