-- Client feedback, 30 Oct 2026 (docs/feedback-2026-10-30.md).

-- Email on the roster.
alter table students add column email text check (email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$');

-- The contract end date is entered by hand: "6 months" lands on a different day depending on the
-- months it spans, so working it out gave wrong dates. Only the intake month still has a default.
create or replace function student_defaults() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.intake_month is null then
    new.intake_month := date_trunc('month', new.start_date + 16)::date;
  end if;
  return new;
end $$;

-- Contact log: the date the contact happened, which the team picks (defaults to today).
alter table student_notes add column contact_date date not null
  default (now() at time zone 'Asia/Kolkata')::date;
