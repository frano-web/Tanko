-- TANKO 1.1 PATCH — uruchom raz w Supabase SQL Editor
alter table public.profiles add column if not exists theme text not null default 'system';

create or replace function public.protect_profile_fields() returns trigger language plpgsql as $$
begin
  if pg_trigger_depth() <= 1 and auth.uid() is not null and auth.uid()=old.id then
    new.role:=old.role;
    new.points:=old.points;
    new.reputation:=old.reputation;
  end if;
  return new;
end;$$;

drop trigger if exists protect_profile_fields_trigger on public.profiles;
create trigger protect_profile_fields_trigger before update on public.profiles for each row execute procedure public.protect_profile_fields();

DROP POLICY IF EXISTS "admins delete stations" ON public.stations;
create policy "admins delete stations" on public.stations for delete to authenticated using (public.is_admin());
grant delete on public.stations to authenticated;

create or replace function public.validate_price_report_location() returns trigger
language plpgsql security definer set search_path=public as $$
declare slat double precision; slng double precision; d double precision;
begin
  if new.source='confirmation' then
    if new.latitude is null or new.longitude is null then
      raise exception 'Włącz GPS. Cenę można potwierdzić tylko będąc przy stacji.';
    end if;
    select latitude,longitude into slat,slng from public.stations where id=new.station_id;
    d := 6371 * 2 * asin(sqrt(power(sin(radians(new.latitude-slat)/2),2)+cos(radians(slat))*cos(radians(new.latitude))*power(sin(radians(new.longitude-slng)/2),2)));
    if d > 0.5 then raise exception 'Jesteś za daleko od stacji, aby potwierdzić cenę.'; end if;
    if exists(select 1 from public.price_reports pr where pr.user_id=new.user_id and pr.station_id=new.station_id and pr.source='confirmation' and pr.created_at > now()-interval '30 minutes') then
      raise exception 'Tę cenę potwierdzałeś niedawno. Spróbuj później.';
    end if;
    new.is_verified:=true;
  end if;
  return new;
end;$$;
drop trigger if exists validate_price_report_location_trigger on public.price_reports;
create trigger validate_price_report_location_trigger before insert on public.price_reports for each row execute procedure public.validate_price_report_location();

create or replace function public.award_report_points() returns trigger language plpgsql security definer set search_path=public as $$
declare p integer; cooldown interval;
begin
  if new.user_id is null then return new; end if;
  p:=case new.source when 'photo' then 10 when 'confirmation' then 2 when 'manual' then 5 else 0 end;
  cooldown:=case new.source when 'photo' then interval '2 hours' when 'manual' then interval '1 hour' else interval '30 minutes' end;
  if exists(select 1 from public.price_reports pr where pr.id<>new.id and pr.user_id=new.user_id and pr.station_id=new.station_id and pr.source=new.source and pr.created_at > now()-cooldown) then p:=0; end if;
  if p>0 then
    insert into public.point_events(user_id,points,reason,price_report_id) values(new.user_id,p,new.source,new.id);
    update public.profiles set points=points+p,reputation=least(2.00,reputation+case new.source when 'photo' then 0.01 when 'confirmation' then 0.002 else 0.004 end) where id=new.user_id;
  end if;
  return new;
end;$$;
drop trigger if exists price_report_points on public.price_reports;
create trigger price_report_points after insert on public.price_reports for each row execute procedure public.award_report_points();
