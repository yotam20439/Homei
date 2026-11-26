-- Table privileges for the API roles (newer Supabase projects don't grant them automatically).
-- Row Level Security still decides which rows each user can see.
grant usage on schema public to authenticated, service_role;

grant all on all tables in schema public to service_role;
grant execute on all functions in schema public to service_role;

grant select, insert, update, delete on
  public.profiles, public.households, public.household_users, public.residents,
  public.documents, public.bills, public.bill_charges, public.alerts, public.invitations
  to authenticated;
grant select on public.market_offers to authenticated;
grant execute on function public.is_member(uuid), public.is_owner(uuid), public.shares_household(uuid),
  public.create_household(text, text, text) to authenticated;

-- Second-factor tables: server only.
revoke all on public.verification_codes, public.trusted_devices from anon, authenticated;
revoke all on all tables in schema public from anon;

alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant execute on functions to service_role;
