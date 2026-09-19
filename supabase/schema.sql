-- VoiceLedger schema.
--
-- One trader, many entries. Entries keep the trader's original words so the
-- record can always be traced back to what was actually said.

create table if not exists traders (
  id uuid primary key default gen_random_uuid(),
  whatsapp_id text unique not null,
  display_name text,
  currency text not null default 'NGN',
  created_at timestamptz not null default now()
);

create type entry_direction as enum ('sale', 'purchase', 'expense');

create table if not exists entries (
  id uuid primary key default gen_random_uuid(),
  trader_id uuid not null references traders(id) on delete cascade,
  direction entry_direction not null,
  item text not null,
  quantity numeric,
  unit text,
  unit_price_minor bigint,
  total_minor bigint not null,
  currency text not null default 'NGN',
  confidence real not null,
  source_text text not null,
  source_kind text not null default 'text', -- text | voice | photo
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists entries_trader_time on entries (trader_id, occurred_at desc);

alter table traders enable row level security;
alter table entries enable row level security;
