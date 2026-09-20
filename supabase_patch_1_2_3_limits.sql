-- Tanko 1.2.3: uruchom PO patchu punktów 1.2.2.
-- Nie kasuje tabel ani historycznych cen.
-- Limit dodawania: na jedno konto i jedną stację, niezależnie od manual/photo: 10 godzin.
-- Potwierdzenie: maksymalnie 80 m, bez potwierdzania własnego zgłoszenia.
-- Dodanie ceny: maksymalnie 100 m od stacji.
create or replace function public.validate_price_report_location() returns trigger
language plpgsql security definer set search_path=public as $$
declare
  slat double precision; slng double precision; d double precision;
  last_author uuid; last_report bigint;
begin
  if auth.uid() is null or new.user_id is distinct from auth.uid() then
    raise exception 'Zaloguj się ponownie, aby zgłosić cenę.';
  end if;
  if new.source not in ('manual','photo','confirmation') then
    raise exception 'Niedozwolony typ zgłoszenia.';
  end if;
  -- Blokada wiersza stacji serializuje równoczesne zapisy na tej samej stacji.
  select latitude,longitude into slat,slng from public.stations
  where id=new.station_id for update;
  if not found then raise exception 'Nie znaleziono stacji.'; end if;
  if new.latitude is null or new.longitude is null
    or not isfinite(new.latitude) or not isfinite(new.longitude)
    or new.latitude not between -90 and 90 or new.longitude not between -180 and 180 then
    raise exception 'Włącz GPS i spróbuj ponownie.';
  end if;
  d := 2000 * 6371 * asin(least(1.0,sqrt(
      power(sin(radians(new.latitude-slat)/2),2) +
      cos(radians(slat))*cos(radians(new.latitude))*power(sin(radians(new.longitude-slng)/2),2)
  )));
  if new.source in ('manual','photo') then
    if d > 100 then raise exception 'Cenę można dodać tylko w odległości do 100 m od stacji.'; end if;
    if exists(select 1 from public.price_reports pr
      where pr.user_id=new.user_id and pr.station_id=new.station_id
      and pr.source in ('manual','photo')
      and pr.created_at > now()-interval '10 hours') then
      raise exception 'Na tej stacji możesz dodać kolejną cenę dopiero po 10 godzinach.';
    end if;
  else
    if d > 80 then raise exception 'Cenę można potwierdzić tylko w odległości do 80 m od stacji.'; end if;
    select pr.id,pr.user_id into last_report,last_author from public.price_reports pr
      where pr.station_id=new.station_id and pr.source in ('manual','photo')
      order by pr.created_at desc,pr.id desc limit 1;
    if last_report is null then raise exception 'Nie ma jeszcze ceny do potwierdzenia.'; end if;
    if last_author is null or last_author=new.user_id then
      raise exception 'Nie możesz potwierdzić własnej ceny.';
    end if;
    if exists(select 1 from public.price_reports pr
      where pr.user_id=new.user_id and pr.station_id=new.station_id
      and pr.source='confirmation' and pr.created_at > now()-interval '30 minutes') then
      raise exception 'Tę stację potwierdzałeś niedawno. Spróbuj później.';
    end if;
    new.is_verified:=true;
  end if;
  return new;
end;
$$;
drop trigger if exists validate_price_report_location_trigger on public.price_reports;
create trigger validate_price_report_location_trigger before insert on public.price_reports
for each row execute function public.validate_price_report_location();
