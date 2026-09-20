-- Tanko 1.2.5. Uruchom PO dotychczasowych patchach 1.2.2 i 1.2.3.
-- Nie usuwa stacji, kont ani historycznych cen.

-- Zmiana aktywnego auta jest atomowa: błąd cofa całą transakcję.
create or replace function public.set_active_car(p_car_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_user uuid := auth.uid();
begin
 if v_user is null then raise exception 'Zaloguj się ponownie.'; end if;
 perform 1 from public.cars where id=p_car_id and user_id=v_user;
 if not found then raise exception 'Nie znaleziono Twojego samochodu.'; end if;
 -- Blokada na profilu serializuje równoczesne zmiany tego samego konta.
 perform 1 from public.profiles where id=v_user for update;
 update public.cars set is_active=(id=p_car_id) where user_id=v_user;
end;$$;
revoke all on function public.set_active_car(uuid) from public;
grant execute on function public.set_active_car(uuid) to authenticated;

-- Dodanie nowego auta i aktywowanie go w jednej transakcji.
create or replace function public.add_active_car(p_name text,p_engine text,p_fuel_type text,p_consumption numeric)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_user uuid := auth.uid(); v_id uuid;
begin
 if v_user is null then raise exception 'Zaloguj się ponownie.'; end if;
 if nullif(btrim(p_name),'') is null or length(p_name)>120 then raise exception 'Podaj nazwę samochodu (maks. 120 znaków).'; end if;
 if p_fuel_type not in ('pb95','pb98','on','lpg') or p_consumption is null or p_consumption<=0 or p_consumption>100 then
  raise exception 'Sprawdź rodzaj paliwa i spalanie.';
 end if;
 perform 1 from public.profiles where id=v_user for update;
 update public.cars set is_active=false where user_id=v_user;
 insert into public.cars(user_id,name,engine,fuel_type,consumption,is_active)
 values(v_user,btrim(p_name),nullif(btrim(p_engine),''),p_fuel_type,p_consumption,true)
 returning id into v_id;
 return v_id;
end;$$;
revoke all on function public.add_active_car(text,text,text,numeric) from public;
grant execute on function public.add_active_car(text,text,text,numeric) to authenticated;

-- Statystyki: potwierdzenie przypisane do najnowszej WCZEŚNIEJSZEJ ceny ręcznej/ze zdjęcia.
-- Nie liczymy innych aktualizacji jako potwierdzeń.
create or replace view public.ranking_activity_stats with (security_invoker=true) as
with confirmations as (
 select c.id,c.user_id as confirmer_id, original.user_id as author_id
 from public.price_reports c
 join lateral (
  select p.user_id from public.price_reports p
  where p.station_id=c.station_id and p.source in ('manual','photo')
    and (p.created_at,p.id)<(c.created_at,c.id)
  order by p.created_at desc,p.id desc limit 1
 ) original on true
 where c.source='confirmation' and c.is_verified=true
   and c.user_id is distinct from original.user_id
), additions as (
 select user_id,count(*)::bigint as added_prices
 from public.price_reports where source in ('manual','photo') and user_id is not null group by user_id
), received as (
 select author_id,count(*)::bigint as received_confirmations
 from confirmations where author_id is not null group by author_id
), given as (
 select confirmer_id,count(*)::bigint as given_confirmations
 from confirmations where confirmer_id is not null group by confirmer_id
)
select p.id as user_id,coalesce(a.added_prices,0) as added_prices,
 coalesce(r.received_confirmations,0) as received_confirmations,
 coalesce(g.given_confirmations,0) as given_confirmations
from public.profiles p
left join additions a on a.user_id=p.id
left join received r on r.author_id=p.id
left join given g on g.confirmer_id=p.id;
grant select on public.ranking_activity_stats to authenticated;

-- Korekta licznika w istniejącym widoku stacji bez zmiany jego kolumn/kolejności:
-- istniejący widok ma pole confirmations; nie zastępuj go liczbą aktualizacji.
-- Statystyki rankingu korzystają z dokładnego powiązania powyżej.
