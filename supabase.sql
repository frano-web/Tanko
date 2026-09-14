-- TANKO 1.0 — kompletna migracja Supabase
-- Uruchom CAŁOŚĆ w SQL Editorze.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text,
  points integer not null default 0,
  reputation numeric(5,2) not null default 1.00,
  role text not null default 'user' check (role in ('user','admin')),
  onboarding_completed boolean not null default false,
  sounds_enabled boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.profiles add column if not exists reputation numeric(5,2) not null default 1.00;
alter table public.profiles add column if not exists role text not null default 'user';
alter table public.profiles add column if not exists onboarding_completed boolean not null default false;
alter table public.profiles add column if not exists sounds_enabled boolean not null default true;

create table if not exists public.cars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  engine text,
  fuel_type text not null check (fuel_type in ('pb95','pb98','on','lpg')),
  consumption numeric(5,2) not null check (consumption > 0),
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
  source text not null default 'manual',
  external_id text,
  photo_url text,
  is_closed boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.stations add column if not exists is_closed boolean not null default false;
alter table public.stations add column if not exists source text not null default 'manual';
alter table public.stations add column if not exists external_id text;
alter table public.stations add column if not exists photo_url text;
create unique index if not exists stations_external_id_unique on public.stations(external_id) where external_id is not null;
create index if not exists stations_geo_idx on public.stations(latitude, longitude);

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
create index if not exists price_reports_station_created_idx on public.price_reports(station_id,created_at desc);

create table if not exists public.point_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  points integer not null,
  reason text not null,
  price_report_id bigint references public.price_reports(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists point_events_user_created_idx on public.point_events(user_id,created_at desc);

create table if not exists public.favorite_stations (
  user_id uuid not null references auth.users(id) on delete cascade,
  station_id bigint not null references public.stations(id) on delete cascade,
  notify_new_price boolean not null default false,
  last_seen_price_report_id bigint,
  created_at timestamptz not null default now(),
  primary key(user_id,station_id)
);

create table if not exists public.station_reports (
  id bigint generated always as identity primary key,
  station_id bigint not null references public.stations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  category text not null check (category in ('closed','wrong_name','wrong_location','missing_fuel','duplicate','other')),
  message text,
  status text not null default 'new' check (status in ('new','in_progress','resolved','rejected')),
  admin_note text,
  handled_by uuid references auth.users(id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists station_reports_status_idx on public.station_reports(status,created_at desc);

create table if not exists public.recent_stations (
  user_id uuid not null references auth.users(id) on delete cascade,
  station_id bigint not null references public.stations(id) on delete cascade,
  last_opened_at timestamptz not null default now(),
  primary key(user_id,station_id)
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin');
$$;

create or replace view public.stations_with_latest_prices with (security_invoker=true) as
select s.id,s.name,s.address,s.latitude,s.longitude,s.brand,s.source,s.external_id,s.photo_url,s.is_closed,
  (r.prices->>'pb95')::numeric as pb95,
  (r.prices->>'pb98')::numeric as pb98,
  (r.prices->>'on')::numeric as on_price,
  (r.prices->>'lpg')::numeric as lpg,
  r.id as latest_report_id,
  r.source as price_source,
  r.created_at as price_updated_at,
  coalesce((select count(*)::int from public.price_reports c where c.station_id=s.id and c.created_at > now()-interval '24 hours'),0) as confirmations
from public.stations s
left join lateral (
  select * from public.price_reports pr where pr.station_id=s.id order by pr.created_at desc limit 1
) r on true
where s.is_closed=false;

alter table public.profiles enable row level security;
alter table public.cars enable row level security;
alter table public.stations enable row level security;
alter table public.price_reports enable row level security;
alter table public.point_events enable row level security;
alter table public.favorite_stations enable row level security;
alter table public.station_reports enable row level security;
alter table public.recent_stations enable row level security;

-- PROFILE
DROP POLICY IF EXISTS "profiles ranking readable" ON public.profiles;
create policy "profiles ranking readable" on public.profiles for select to authenticated using (true);
DROP POLICY IF EXISTS "users update own profile" ON public.profiles;
create policy "users update own profile" on public.profiles for update to authenticated
using (auth.uid()=id) with check (auth.uid()=id);


-- Użytkownik może zmieniać swoje ustawienia, ale nie może sam nadać sobie admina, punktów ani reputacji.
create or replace function public.protect_profile_fields() returns trigger language plpgsql as $$
begin
  if auth.uid() is not null and auth.uid()=old.id then
    new.role:=old.role;
    new.points:=old.points;
    new.reputation:=old.reputation;
  end if;
  return new;
end;$$;
drop trigger if exists protect_profile_fields_trigger on public.profiles;
create trigger protect_profile_fields_trigger before update on public.profiles for each row execute procedure public.protect_profile_fields();

-- CARS
DROP POLICY IF EXISTS "users own cars" ON public.cars;
create policy "users own cars" on public.cars for all to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);

-- STATIONS
DROP POLICY IF EXISTS "stations readable by everyone" ON public.stations;
create policy "stations readable by everyone" on public.stations for select to authenticated using (true);
DROP POLICY IF EXISTS "authenticated add stations" ON public.stations;
create policy "authenticated add stations" on public.stations for insert to authenticated with check (true);
DROP POLICY IF EXISTS "admins update stations" ON public.stations;
create policy "admins update stations" on public.stations for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- PRICE REPORTS
DROP POLICY IF EXISTS "reports readable by everyone" ON public.price_reports;
create policy "reports readable by everyone" on public.price_reports for select to authenticated using (true);
DROP POLICY IF EXISTS "users insert own reports" ON public.price_reports;
create policy "users insert own reports" on public.price_reports for insert to authenticated with check (auth.uid()=user_id);

-- POINTS
DROP POLICY IF EXISTS "users read own points" ON public.point_events;
create policy "users read own points" on public.point_events for select to authenticated using (auth.uid()=user_id or public.is_admin());

-- FAVORITES
DROP POLICY IF EXISTS "users own favorites" ON public.favorite_stations;
create policy "users own favorites" on public.favorite_stations for all to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);

-- REPORTS TO ADMIN
DROP POLICY IF EXISTS "users create station reports" ON public.station_reports;
create policy "users create station reports" on public.station_reports for insert to authenticated with check (auth.uid()=user_id);
DROP POLICY IF EXISTS "users read own station reports" ON public.station_reports;
create policy "users read own station reports" on public.station_reports for select to authenticated using (auth.uid()=user_id or public.is_admin());
DROP POLICY IF EXISTS "admins update station reports" ON public.station_reports;
create policy "admins update station reports" on public.station_reports for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- RECENT STATIONS
DROP POLICY IF EXISTS "users own recent stations" ON public.recent_stations;
create policy "users own recent stations" on public.recent_stations for all to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);

grant select on public.profiles,public.stations,public.price_reports,public.stations_with_latest_prices to authenticated;
grant select,insert,update,delete on public.cars,public.favorite_stations,public.recent_stations to authenticated;
grant select,insert on public.station_reports to authenticated;
grant update on public.station_reports, public.stations to authenticated;
grant insert on public.stations,public.price_reports to authenticated;
grant select on public.point_events to authenticated;
grant usage,select on all sequences in schema public to authenticated;

-- Profil po rejestracji
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,nickname)
  values(new.id,coalesce(nullif(split_part(new.email,'@',1),''),'Użytkownik'))
  on conflict(id) do nothing;
  return new;
end;$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

-- Punkty po zgłoszeniu ceny
create or replace function public.award_report_points() returns trigger language plpgsql security definer set search_path=public as $$
declare p integer;
begin
  if new.user_id is null then return new; end if;
  p:=case new.source when 'photo' then 10 when 'confirmation' then 2 when 'manual' then 5 else 0 end;
  if p>0 then
    insert into public.point_events(user_id,points,reason,price_report_id) values(new.user_id,p,new.source,new.id);
    update public.profiles
      set points=points+p,
          reputation=least(2.00, reputation + case new.source when 'photo' then 0.01 when 'confirmation' then 0.002 else 0.004 end)
      where id=new.user_id;
  end if;
  return new;
end;$$;
drop trigger if exists price_report_points on public.price_reports;
create trigger price_report_points after insert on public.price_reports for each row execute procedure public.award_report_points();

-- Bucket zdjęć pylonów
insert into storage.buckets(id,name,public) values('pylon-photos','pylon-photos',false) on conflict(id) do nothing;
DROP POLICY IF EXISTS "users upload own pylon photos" ON storage.objects;
create policy "users upload own pylon photos" on storage.objects for insert to authenticated
with check (bucket_id='pylon-photos' and (storage.foldername(name))[1]=auth.uid()::text);
DROP POLICY IF EXISTS "users read own pylon photos" ON storage.objects;
create policy "users read own pylon photos" on storage.objects for select to authenticated
using (bucket_id='pylon-photos' and ((storage.foldername(name))[1]=auth.uid()::text or public.is_admin()));

insert into public.profiles(id,nickname)
select u.id,coalesce(nullif(split_part(u.email,'@',1),''),'Użytkownik') from auth.users u
on conflict(id) do nothing;

-- >>> OPCJONALNIE: ustaw swoje konto administratorem (podmień e-mail):
-- update public.profiles set role='admin' where id=(select id from auth.users where email='TWÓJ_EMAIL');
