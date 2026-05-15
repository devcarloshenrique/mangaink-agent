
-- profiles table
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  credits integer not null default 10,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "users view own profile" on public.profiles
  for select using (auth.uid() = id);
create policy "users update own profile" on public.profiles
  for update using (auth.uid() = id);
create policy "users insert own profile" on public.profiles
  for insert with check (auth.uid() = id);

-- credit transactions
create table public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  delta integer not null,
  reason text not null,
  created_at timestamptz not null default now()
);

alter table public.credit_transactions enable row level security;

create policy "users view own tx" on public.credit_transactions
  for select using (auth.uid() = user_id);
create policy "users insert own tx" on public.credit_transactions
  for insert with check (auth.uid() = user_id);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- handle_new_user trigger creates profile with 10 free credits
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, credits)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    10
  );
  insert into public.credit_transactions (user_id, delta, reason)
  values (new.id, 10, 'welcome_bonus');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
