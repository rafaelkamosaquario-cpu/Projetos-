-- RodoCore Diagnósticos — captura pública consentida
-- Aplicar somente no projeto novo e exclusivo "rodocore-consultoria".
-- Esta tabela não concede leitura, alteração ou exclusão ao navegador.

create table if not exists public.public_diagnostic_leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(trim(name)) between 2 and 80),
  company text not null check (char_length(trim(company)) between 2 and 120),
  whatsapp text not null check (whatsapp ~ '^[0-9]{10,13}$'),
  consent_at timestamptz not null,
  consent_text_version text not null check (char_length(consent_text_version) between 1 and 40),
  source_path text not null default '/diagnostico/' check (char_length(source_path) between 1 and 200),
  fleet_type text check (fleet_type in ('Leve', 'Média', 'Pesada', 'Mista')),
  vehicle_count integer check (vehicle_count between 1 and 100000),
  visibility_level smallint not null check (visibility_level between 0 and 3),
  fuel_maturity smallint not null check (fuel_maturity between 0 and 3),
  maintenance_maturity smallint not null check (maintenance_maturity between 0 and 3),
  tires_maturity smallint not null check (tires_maturity between 0 and 3),
  priority_pillar text not null check (priority_pillar in ('Combustível', 'Manutenção', 'Pneus'))
);

comment on table public.public_diagnostic_leads is
  'Pedidos consentidos originados no check-up público RodoCore. Sem leitura pelo navegador.';

alter table public.public_diagnostic_leads enable row level security;

revoke all on table public.public_diagnostic_leads from anon, authenticated;
grant insert on table public.public_diagnostic_leads to anon, authenticated;

drop policy if exists "public_diagnostic_leads_insert_with_consent"
  on public.public_diagnostic_leads;

create policy "public_diagnostic_leads_insert_with_consent"
  on public.public_diagnostic_leads
  for insert
  to anon, authenticated
  with check (
    consent_at is not null
    and char_length(trim(name)) between 2 and 80
    and char_length(trim(company)) between 2 and 120
    and whatsapp ~ '^[0-9]{10,13}$'
  );

create index if not exists public_diagnostic_leads_created_at_idx
  on public.public_diagnostic_leads (created_at desc);
