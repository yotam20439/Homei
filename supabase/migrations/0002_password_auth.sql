-- Email + password sign-in: verification codes now serve both device checks and password resets.
alter table public.verification_codes add column if not exists purpose text not null default 'device';
alter table public.verification_codes drop constraint if exists verification_codes_purpose_check;
alter table public.verification_codes add constraint verification_codes_purpose_check check (purpose in ('device', 'reset'));
create index if not exists verification_codes_purpose_idx on public.verification_codes(user_id, purpose, created_at desc);
create unique index if not exists profiles_email_idx on public.profiles(lower(email));
