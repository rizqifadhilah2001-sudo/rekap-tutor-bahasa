-- Tutor Grow v2 — Supabase Schema & Row Level Security
-- Safe to re-run (idempotent)

create extension if not exists "pgcrypto";

-- 1. Tutor Profile & Settings
create table if not exists public.tutor_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  avatar_data text,
  ui_language text not null default 'id',
  currency text not null default 'IDR',
  monthly_goal numeric not null default 0,
  first_day_of_week integer not null default 1,
  dark_theme boolean not null default false,
  show_payment_dots boolean not null default true,
  reminders_enabled boolean not null default true,
  reminder_minutes integer not null default 30,
  wa_template text,
  updated_at timestamptz not null default now()
);

-- 2. Students
create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  language text not null default 'English',
  level text not null default '',
  phone text not null default '',
  parent_name text not null default '',
  billing_type text not null default 'per_session',
  hourly_rate numeric not null default 100000,
  package_name text not null default '',
  package_total integer not null default 0,
  package_used integer not null default 0,
  package_price numeric not null default 0,
  package_paid boolean not null default false,
  color text not null default '#434786',
  notes text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 3. Group Classes
create table if not exists public.tutor_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  language text not null default 'English',
  level text not null default '',
  fee_mode text not null default 'flat',
  rate numeric not null default 150000,
  member_ids jsonb not null default '[]'::jsonb,
  color text not null default '#434786',
  notes text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 4. Lessons / Teaching Sessions
create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_type text not null default 'student',
  student_id uuid references public.students(id) on delete set null,
  group_id uuid references public.tutor_groups(id) on delete set null,
  lesson_date date not null,
  start_time text not null default '16:00',
  end_time text not null default '17:00',
  duration_minutes integer not null default 60,
  status text not null default 'scheduled',
  fee numeric not null default 0,
  paid boolean not null default false,
  uses_package boolean not null default false,
  package_label text not null default '',
  topic text not null default '',
  progress_notes text not null default '',
  homework text not null default '',
  attendees jsonb not null default '[]'::jsonb,
  repeat_group_id text,
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_students_user_id on public.students(user_id);
create index if not exists idx_tutor_groups_user_id on public.tutor_groups(user_id);
create index if not exists idx_lessons_user_date on public.lessons(user_id, lesson_date);
create index if not exists idx_lessons_student_id on public.lessons(student_id);
create index if not exists idx_lessons_group_id on public.lessons(group_id);

-- Row Level Security
alter table public.tutor_profiles enable row level security;
alter table public.students enable row level security;
alter table public.tutor_groups enable row level security;
alter table public.lessons enable row level security;

drop policy if exists "tutor_profiles_own_all" on public.tutor_profiles;
create policy "tutor_profiles_own_all"
  on public.tutor_profiles
  for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "students_own_all" on public.students;
create policy "students_own_all"
  on public.students
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "tutor_groups_own_all" on public.tutor_groups;
create policy "tutor_groups_own_all"
  on public.tutor_groups
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "lessons_own_all" on public.lessons;
create policy "lessons_own_all"
  on public.lessons
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Auto-create tutor profile on sign up
create or replace function public.handle_new_tutor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.tutor_profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_tutor();

-- Allow authenticated user to delete their own account
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;
grant execute on function public.delete_my_account() to authenticated;

-- Explicit table permissions for authenticated role (PostgreSQL 15+ / Supabase)
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.tutor_profiles to authenticated;
grant select, insert, update, delete on table public.students to authenticated;
grant select, insert, update, delete on table public.tutor_groups to authenticated;
grant select, insert, update, delete on table public.lessons to authenticated;
grant usage, select on all sequences in schema public to authenticated;
