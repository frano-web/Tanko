-- Tankuj MVP - schema Supabase
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text,
  points integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.cars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  engine text,
  fuel_type text not null check (fuel_type in ('pb95','pb98','on','lpg')),
  consumption numeric(4,1) not null check (consumption > 0),
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.stations (
  id bigint generated always as identity primary key,
  name text not null,
  address text,
  latitude double precision not null,
  longitude double precision not null,
  brand text,
  created_at timestamptz not null default now()
);

create table if not exists public.price_reports (
  id bigint generated always as identity primary key,
  station_id bigint not null references public.stations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  prices jsonb not null default '{}'::jsonb,
  latitude double precision,
  longitude double precision,
  source text not null default 'manual' check (source in ('manual','photo','confirmation','partner')),
  photo_url text,
  is_verified boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.point_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  points integer not null,
  reason text not null,
  price_report_id bigint references public.price_reports(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists price_reports_station_created_idx on public.price_reports(station_id, created_at desc);
create index if not exists stations_geo_idx on public.stations(latitude, longitude);

-- Widok ostatnich zgłoszonych cen dla każdej stacji.
create or replace view public.stations_with_latest_prices as
select
  s.id, s.name, s.address, s.latitude, s.longitude, s.brand,
  (r.prices->>'pb95')::numeric as pb95,
  (r.prices->>'pb98')::numeric as pb98,
  (r.prices->>'on')::numeric as on_price,
  (r.prices->>'lpg')::numeric as lpg,
  r.created_at as price_updated_at,
  1::integer as confirmations
from public.stations s
left join lateral (
  select * from public.price_reports pr
  where pr.station_id=s.id
  order by pr.created_at desc
  limit 1
) r on true;

alter table public.profiles enable row level security;
alter table public.cars enable row level security;
alter table public.stations enable row level security;
alter table public.price_reports enable row level security;
alter table public.point_events enable row level security;

create policy "stations readable by everyone" on public.stations for select using (true);
create policy "reports readable by everyone" on public.price_reports for select using (true);
create policy "users insert own reports" on public.price_reports for insert to authenticated with check (auth.uid() = user_id);
create policy "users read own profile" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "users update own profile" on public.profiles for update to authenticated using (auth.uid() = id);
create policy "users own cars" on public.cars for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users read own points" on public.point_events for select to authenticated using (auth.uid() = user_id);

-- Automatyczne tworzenie profilu po rejestracji.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,nickname) values(new.id, split_part(new.email,'@',1));
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
