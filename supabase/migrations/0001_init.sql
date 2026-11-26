-- HOMEi: household bills tracker
-- Run in Supabase SQL editor (or `supabase db push`). Idempotent where practical.

create extension if not exists pgcrypto;

-- ---------- Profiles ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- ---------- Households & membership ----------
create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  address text check (char_length(address) <= 160),
  floor text check (char_length(floor) <= 20),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.household_users (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index if not exists household_users_user_idx on public.household_users(user_id);

-- People living in the apartment (may or may not have an app account).
create table if not exists public.residents (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  color text not null default '#C9C3F0' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  user_id uuid references auth.users(id) on delete set null,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists residents_household_idx on public.residents(household_id);

-- ---------- Membership helpers (security definer, used by policies) ----------
create or replace function public.is_member(hid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from household_users where household_id = hid and user_id = auth.uid());
$$;

create or replace function public.is_owner(hid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from household_users where household_id = hid and user_id = auth.uid() and role = 'owner');
$$;

create or replace function public.shares_household(other uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from household_users a join household_users b on a.household_id = b.household_id
    where a.user_id = auth.uid() and b.user_id = other
  );
$$;

-- Creates a household with the caller as owner, atomically.
create or replace function public.create_household(p_name text, p_address text, p_floor text)
returns uuid language plpgsql security definer set search_path = public as $$
declare hid uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into households(name, address, floor, created_by) values (p_name, p_address, p_floor, auth.uid()) returning id into hid;
  insert into household_users(household_id, user_id, role) values (hid, auth.uid(), 'owner');
  return hid;
end $$;

-- ---------- Bills ----------
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  storage_path text not null unique,
  mime text not null check (mime in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  size_bytes int not null check (size_bytes > 0 and size_bytes <= 10485760),
  kind text not null default 'contract' check (kind in ('contract', 'invoice', 'quote')),
  status text not null default 'uploaded' check (status in ('uploaded', 'extracted', 'failed')),
  extracted jsonb,
  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists documents_household_idx on public.documents(household_id);

create table if not exists public.bills (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  category text not null check (category in (
    'tv', 'internet', 'landline', 'electricity', 'gas', 'water', 'cellular',
    'insurance_home', 'insurance_car', 'insurance_health', 'arnona', 'other')),
  status text not null default 'active' check (status in ('active', 'quote', 'ended')),
  provider text check (char_length(provider) <= 80),
  plan text check (char_length(plan) <= 120),
  monthly_price numeric(10,2) check (monthly_price >= 0),
  promo_end date,
  post_promo_price numeric(10,2) check (post_promo_price >= 0),
  commitment_end date,
  exit_fee numeric(10,2) check (exit_fee >= 0),
  renewal_date date,
  quote_valid_until date,
  resident_id uuid references public.residents(id) on delete set null,
  document_id uuid references public.documents(id) on delete set null,
  notes text check (char_length(notes) <= 1000),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists bills_household_idx on public.bills(household_id);

-- Actual charges from invoices, to compare against the contract price.
create table if not exists public.bill_charges (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.bills(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  period date not null,
  amount numeric(10,2) not null check (amount >= 0),
  months_covered int not null default 1 check (months_covered between 1 and 12),
  document_id uuid references public.documents(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (bill_id, period)
);

-- Market offers maintained by the operator (service role) for comparison.
create table if not exists public.market_offers (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  provider text not null,
  plan text not null,
  monthly_price numeric(10,2) not null,
  post_promo_price numeric(10,2),
  promo_months int,
  commitment_months int,
  url text,
  is_partner boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  bill_id uuid references public.bills(id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  dedupe_key text not null,
  emailed_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (household_id, dedupe_key)
);

-- ---------- Invitations ----------
create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  email text not null check (email = lower(email)),
  token_hash text not null unique,
  invited_by uuid not null references auth.users(id),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- ---------- Second factor: email codes & trusted devices (service role only) ----------
create table if not exists public.verification_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null,
  attempts int not null default 0,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists verification_codes_user_idx on public.verification_codes(user_id, created_at desc);

create table if not exists public.trusted_devices (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index if not exists trusted_devices_user_idx on public.trusted_devices(user_id);

-- ---------- Row Level Security ----------
alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_users enable row level security;
alter table public.residents enable row level security;
alter table public.documents enable row level security;
alter table public.bills enable row level security;
alter table public.bill_charges enable row level security;
alter table public.market_offers enable row level security;
alter table public.alerts enable row level security;
alter table public.invitations enable row level security;
alter table public.verification_codes enable row level security; -- no policies: service role only
alter table public.trusted_devices enable row level security;    -- no policies: service role only

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_household(id));
drop policy if exists profiles_upsert on public.profiles;
create policy profiles_upsert on public.profiles for insert to authenticated with check (id = auth.uid());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists households_select on public.households;
create policy households_select on public.households for select to authenticated using (public.is_member(id));
drop policy if exists households_update on public.households;
create policy households_update on public.households for update to authenticated using (public.is_owner(id)) with check (public.is_owner(id));
drop policy if exists households_delete on public.households;
create policy households_delete on public.households for delete to authenticated using (public.is_owner(id));

drop policy if exists hu_select on public.household_users;
create policy hu_select on public.household_users for select to authenticated using (public.is_member(household_id));
drop policy if exists hu_delete on public.household_users;
-- Owners remove members; anyone may leave. Owners cannot remove themselves this way.
create policy hu_delete on public.household_users for delete to authenticated
  using ((public.is_owner(household_id) and user_id <> auth.uid()) or (user_id = auth.uid() and role = 'member'));

-- Member-scoped CRUD for household data.
do $$
declare t text;
begin
  foreach t in array array['residents', 'documents', 'bills', 'bill_charges', 'alerts'] loop
    execute format('drop policy if exists %I_all on public.%I', t, t);
    execute format('create policy %I_all on public.%I for all to authenticated using (public.is_member(household_id)) with check (public.is_member(household_id))', t, t);
  end loop;
end $$;

drop policy if exists offers_read on public.market_offers;
create policy offers_read on public.market_offers for select to authenticated using (true);

drop policy if exists invitations_owner on public.invitations;
create policy invitations_owner on public.invitations for all to authenticated
  using (public.is_owner(household_id)) with check (public.is_owner(household_id) and invited_by = auth.uid());

-- Bills must reference a resident / document of the same household.
create or replace function public.bills_same_household()
returns trigger language plpgsql as $$
begin
  if new.resident_id is not null and not exists (select 1 from residents where id = new.resident_id and household_id = new.household_id) then
    raise exception 'resident belongs to another household';
  end if;
  if new.document_id is not null and not exists (select 1 from documents where id = new.document_id and household_id = new.household_id) then
    raise exception 'document belongs to another household';
  end if;
  new.updated_at = now();
  return new;
end $$;
drop trigger if exists bills_same_household on public.bills;
create trigger bills_same_household before insert or update on public.bills
  for each row execute function public.bills_same_household();

create or replace function public.charges_same_household()
returns trigger language plpgsql as $$
begin
  if not exists (select 1 from bills where id = new.bill_id and household_id = new.household_id) then
    raise exception 'bill belongs to another household';
  end if;
  return new;
end $$;
drop trigger if exists charges_same_household on public.bill_charges;
create trigger charges_same_household before insert or update on public.bill_charges
  for each row execute function public.charges_same_household();

-- ---------- Private storage for contracts and invoices ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 10485760,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Objects live at "<household_id>/<uuid>.<ext>"; only members of that household can touch them.
drop policy if exists documents_rw on storage.objects;
create policy documents_rw on storage.objects for all to authenticated
  using (bucket_id = 'documents' and public.is_member(((storage.foldername(name))[1])::uuid))
  with check (bucket_id = 'documents' and public.is_member(((storage.foldername(name))[1])::uuid));
