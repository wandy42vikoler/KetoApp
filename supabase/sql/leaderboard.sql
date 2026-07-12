-- Leaderboard feature: opt-in, global.
--
-- profiles keeps its existing RLS untouched (it holds Strava tokens). This
-- is deliberately NOT a view over profiles/progress_summary — Postgres 15+
-- views default to security_invoker = true, which would just re-apply the
-- querying user's own RLS and defeat the point. A `security definer`
-- function is the safe, idiomatic way to expose a hard-whitelisted set of
-- columns across users without loosening RLS on the underlying tables.

alter table profiles add column if not exists on_leaderboard boolean not null default false;

create or replace function get_leaderboard()
returns table (
  user_id uuid,
  display_name text,
  total_lost_kg numeric,
  progress_pct numeric,
  achieved boolean,
  avg_meal_score numeric
)
language sql
security definer
set search_path = public
as $$
  select
    p.id,
    p.display_name,
    ps.total_lost_kg,
    ps.progress_pct,
    (ps.current_weight_kg <= p.goal_weight_kg) as achieved,
    (
      select avg(d.meal_score) from daily_logs d
      where d.user_id = p.id and d.meal_score is not null
        and d.log_date >= current_date - interval '30 days'
    ) as avg_meal_score
  from profiles p
  join progress_summary ps on ps.user_id = p.id
  where p.on_leaderboard = true;
$$;

-- Supabase's default project setup grants EXECUTE on new public-schema
-- functions directly to `anon` (via ALTER DEFAULT PRIVILEGES, not the
-- PUBLIC pseudo-role) — revoking from PUBLIC alone does NOT remove this.
-- Must revoke from `anon` by name, confirmed via has_function_privilege().
revoke execute on function get_leaderboard() from public;
revoke execute on function get_leaderboard() from anon;
grant execute on function get_leaderboard() to authenticated;
