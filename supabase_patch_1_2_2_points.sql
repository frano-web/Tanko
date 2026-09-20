-- Tanko 1.2.2 — TYLKO punkty. Bez ciężarówek i bez przebudowy widoków/tabel.
-- Wykonaj w Supabase SQL Editor jako właściciel projektu. Dane historyczne pozostają niezmienione.
create or replace function public.award_report_points() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  awarded integer := 0;
  cooldown interval;
  photo_id bigint;
  photo_author uuid;
begin
  if new.user_id is null then return new; end if;
  awarded := case new.source when 'photo' then 20 when 'manual' then 20 when 'confirmation' then 5 else 0 end;
  cooldown := case new.source when 'photo' then interval '2 hours' when 'manual' then interval '1 hour' else interval '30 minutes' end;

  -- Zgłoszenia mogą być częstsze, ale nie dostają kolejnych punktów w okresie ochronnym.
  if exists (
    select 1 from public.price_reports pr
    where pr.id <> new.id and pr.user_id = new.user_id
      and pr.station_id = new.station_id and pr.source = new.source
      and pr.created_at > now() - cooldown
  ) then awarded := 0; end if;

  if awarded > 0 then
    insert into public.point_events(user_id,points,reason,price_report_id)
    values (new.user_id,awarded,new.source,new.id);
    update public.profiles set points = coalesce(points,0) + awarded,
      reputation = least(2.00, coalesce(reputation,1.00) +
        case new.source when 'photo' then 0.01 when 'confirmation' then 0.003 else 0.005 end)
    where id = new.user_id;
  end if;

  -- Bonus tylko za realne potwierdzenie przez INNĄ osobę, raz na fotograficzne zgłoszenie
  -- dla danego potwierdzającego. Nie przyznawaj go przy spamowaniu potwierdzeń.
  if new.source = 'confirmation' and awarded > 0 then
    select pr.id,pr.user_id into photo_id,photo_author
    from public.price_reports pr
    where pr.station_id = new.station_id and pr.id <> new.id
      and pr.source = 'photo' and pr.user_id is not null and pr.user_id <> new.user_id
      and pr.created_at < new.created_at
    order by pr.created_at desc,pr.id desc limit 1;

    if photo_author is not null and not exists (
      select 1 from public.point_events pe
      join public.price_reports confirmed on confirmed.id = pe.price_report_id
      where pe.user_id = photo_author
        and pe.reason = 'photo_confirmed_bonus'
        and confirmed.user_id = new.user_id
        and confirmed.station_id = new.station_id
        and confirmed.created_at >= (
          select created_at from public.price_reports where id = photo_id
        )
    ) then
      insert into public.point_events(user_id,points,reason,price_report_id)
      values (photo_author,1,'photo_confirmed_bonus',new.id);
      update public.profiles set points = coalesce(points,0) + 1 where id = photo_author;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists price_report_points on public.price_reports;
create trigger price_report_points after insert on public.price_reports
for each row execute function public.award_report_points();
