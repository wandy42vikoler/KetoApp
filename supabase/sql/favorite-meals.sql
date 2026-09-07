-- Favorite/reusable meals: standard per-user RLS, nothing cross-user here
-- (unlike leaderboard.sql, which needs a security-definer function).
create table if not exists favorite_meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  description text not null,
  protein_g numeric,
  fat_g numeric,
  carbs_g numeric,
  calories numeric,
  created_at timestamptz default now()
);

alter table favorite_meals enable row level security;

drop policy if exists "Users manage own favorite meals" on favorite_meals;
create policy "Users manage own favorite meals" on favorite_meals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
