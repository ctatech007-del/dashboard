-- Views stamps as soon as a Reel passes the mark (client, 18 Nov: "View stamps are not working").
-- Until now Hidden Gem / Landmark / Wonder of the World waited for the final day-7 count, so a Reel
-- that hit 1M on day 2 showed no stamp for another five days. Views only go up, so the first daily
-- count at or above 10K / 100K / 1M is enough. Still only Reels posted on or after the join date, and
-- only for students in the academy; stamps stay once given (award() never removes or re-dates).

create or replace function award_views_stamps() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform award(p.student_id, x.key, ist_day(new.day) + interval '6 hours')
  from posts p join students st on st.id = p.student_id
  cross join (values ('hidden_gem', 10000), ('landmark', 100000), ('wonder_of_the_world', 1000000)) as x(key, n)
  where p.id = new.post_id and not p.excluded and st.status = 'active'
    and (p.posted_at at time zone 'Asia/Kolkata')::date >= st.start_date
    and new.views >= x.n;
  return new;
end $$;
revoke execute on function award_views_stamps() from public, anon, authenticated;

create trigger post_views_stamps after insert or update of views on post_views
  for each row execute function award_views_stamps();

-- Backfill from the daily counts already recorded: dated with the first day over the mark.
select award(p.student_id, x.key, ist_day(min(v.day)) + interval '6 hours')
from post_views v join posts p on p.id = v.post_id join students st on st.id = p.student_id
cross join (values ('hidden_gem', 10000), ('landmark', 100000), ('wonder_of_the_world', 1000000)) as x(key, n)
where not p.excluded and st.status = 'active'
  and (p.posted_at at time zone 'Asia/Kolkata')::date >= st.start_date
  and v.views >= x.n
group by p.student_id, x.key;
