
-- Roles enum + table
create type public.app_role as enum ('admin', 'user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique(user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.user_roles where user_id=_user_id and role=_role) $$;

create policy "users view own roles" on public.user_roles for select to authenticated using (auth.uid() = user_id);
create policy "admins view all roles" on public.user_roles for select to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "admins manage roles" on public.user_roles for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles self read" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "profiles self update" on public.profiles for update to authenticated using (auth.uid() = id);
create policy "profiles admin read" on public.profiles for select to authenticated using (public.has_role(auth.uid(),'admin'));

-- Wallets
create table public.wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance numeric(12,2) not null default 1000.00 check (balance >= 0),
  updated_at timestamptz not null default now()
);
alter table public.wallets enable row level security;
create policy "wallet self read" on public.wallets for select to authenticated using (auth.uid() = user_id);
create policy "wallet admin read" on public.wallets for select to authenticated using (public.has_role(auth.uid(),'admin'));

-- Transactions
create type public.tx_type as enum ('deposit','withdrawal','bet','win','bonus');
create type public.tx_status as enum ('pending','completed','failed','rejected');
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  type tx_type not null,
  amount numeric(12,2) not null,
  status tx_status not null default 'completed',
  reference text,
  metadata jsonb,
  created_at timestamptz not null default now()
);
alter table public.transactions enable row level security;
create policy "tx self read" on public.transactions for select to authenticated using (auth.uid() = user_id);
create policy "tx admin read" on public.transactions for select to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "tx admin update" on public.transactions for update to authenticated using (public.has_role(auth.uid(),'admin'));

-- Games
create table public.games (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  bet_amount numeric(12,2) not null,
  cups int not null check (cups between 3 and 9),
  picked_cup int not null,
  winning_cup int not null,
  won boolean not null,
  payout numeric(12,2) not null default 0,
  multiplier numeric(6,3) not null,
  created_at timestamptz not null default now()
);
alter table public.games enable row level security;
create policy "games self read" on public.games for select to authenticated using (auth.uid() = user_id);
create policy "games admin read" on public.games for select to authenticated using (public.has_role(auth.uid(),'admin'));

-- Withdrawal requests
create table public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  amount numeric(12,2) not null check (amount > 0),
  phone text not null,
  status tx_status not null default 'pending',
  admin_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
alter table public.withdrawals enable row level security;
create policy "wd self read" on public.withdrawals for select to authenticated using (auth.uid() = user_id);
create policy "wd self insert" on public.withdrawals for insert to authenticated with check (auth.uid() = user_id);
create policy "wd admin all" on public.withdrawals for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- Auto profile + wallet + default user role on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, username, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1)), coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)));
  insert into public.wallets(user_id) values (new.id);
  insert into public.user_roles(user_id, role) values (new.id, 'user');
  return new;
end; $$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
