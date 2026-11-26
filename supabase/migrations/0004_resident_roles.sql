-- Who each resident is, so the apartment shows the right figure.
alter table public.residents add column if not exists role text not null default 'other';
alter table public.residents drop constraint if exists residents_role_check;
alter table public.residents add constraint residents_role_check check (role in ('self', 'partner', 'child', 'other'));
update public.residents r set role = 'self'
  where r.user_id is not null and r.role = 'other'
    and exists (select 1 from public.households h where h.id = r.household_id and h.created_by = r.user_id);
