# Ketogenic Performance Ledger — Build Spec for Claude Code

## 1. Purpose

A personal nutrition + training tracking app for a Targeted Ketogenic Diet (TKD)
protocol, built as a real multi-user web app (not a Claude Artifact). Data must
persist independently of any chat session or artifact lifecycle. Must support
multiple independent users with isolated data, at zero/near-zero hosting cost.

**Non-negotiable constraint:** the coaching voice throughout any AI-generated
text (macro assessments, chat responses) is strict, clinical, direct — no
padding, no excessive encouragement, evidence-based only. This is a system
prompt requirement for every Claude API call in the app, not a UI copy choice.

---

## 2. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | React + Vite | SPA, deployed as static build |
| Styling | Tailwind CSS | Dark, clinical/instrument-panel aesthetic (see §7) |
| Backend/DB | Supabase (Postgres) | Free tier — 500MB DB, 50k MAU, more than sufficient |
| Auth | Supabase Auth | Email/password + magic link |
| AI | Anthropic API (Claude) | Called via a serverless proxy — **never** from the client |
| Proxy/API routes | Supabase Edge Functions (Deno) | Holds `ANTHROPIC_API_KEY` server-side |
| Hosting | Vercel or Netlify (free tier) | Static frontend, auto-deploy from git |
| Charts | Recharts | Weight, body fat, carb-ceiling trend charts |

**Critical security requirement:** the Anthropic API key must never be present
in any client-side bundle. All Claude calls (meal photo analysis, coach chat)
route through a Supabase Edge Function that injects the key server-side and
returns only the model's response to the client.

---

## 3. Data Model

```sql
-- profiles: one row per user, extends auth.users
profiles (
  id uuid primary key references auth.users(id),
  display_name text,
  height_cm numeric,
  gender text,
  activity_level numeric,        -- 1-10, self-reported baseline activity
  starting_weight_kg numeric,     -- immutable snapshot at onboarding — never overwritten
  protocol_start_date date,       -- set once at onboarding, the fixed reference point for all progress math
  goal_weight_kg numeric,
  goal_timeline_weeks numeric,
  strava_athlete_id text,        -- null until user connects Strava
  strava_access_token text,      -- encrypted at rest; refreshed via refresh_token
  strava_refresh_token text,
  created_at timestamptz default now()
)

-- targets: macro targets per day-type, per user
targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  day_type text not null check (day_type in ('rest','activity')),
  calories numeric not null,
  protein_g numeric not null,
  fat_g numeric not null,
  net_carbs_g numeric not null,
  unique(user_id, day_type)
)

-- daily_logs: one row per user per date
daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  log_date date not null,
  weight_kg numeric,
  body_fat_pct numeric,
  muscle_mass_kg numeric,
  sleep_quality numeric,       -- 1-10
  energy_level numeric,        -- 1-10
  soreness_notes text,
  day_type text check (day_type in ('rest','activity')),  -- derived: 'activity' if any workouts row exists for the date
  water_liters numeric,
  supplements jsonb default '{}',  -- {creatine: true, electrolytes: false, ...}
  notes text,
  ai_note text,                -- short AI-generated progress note, generated on save
  meal_score numeric,          -- 1-10, AI-scored once the day's meals are logged
  unique(user_id, log_date)
)

-- workouts: user-logged training sessions — no predefined type list.
-- Populated three ways: manual form entry, photo upload (AI-extracted), or Strava auto-sync.
workouts (
  id uuid primary key default gen_random_uuid(),
  daily_log_id uuid references daily_logs(id) on delete cascade not null,
  user_id uuid references auth.users(id) not null,
  source text not null check (source in ('manual','photo','strava')),
  activity_name text not null,   -- free text: "Leg Day", "Tennis", "Cable Crossover Fly", whatever the user/AI extracts
  duration_minutes numeric,
  exercises jsonb,               -- optional structured detail: [{name, sets:[{reps, weight_kg}]}, ...] for lifting sessions
  strava_activity_id text,       -- unique external id, used to prevent duplicate sync inserts
  raw_ai_extraction jsonb,       -- unedited AI output, kept for audit before user corrections
  logged_at timestamptz default now(),
  unique(user_id, strava_activity_id)
)

-- meals: linked to a daily_log
meals (
  id uuid primary key default gen_random_uuid(),
  daily_log_id uuid references daily_logs(id) on delete cascade not null,
  user_id uuid references auth.users(id) not null,
  logged_at timestamptz default now(),
  description text,
  protein_g numeric,
  fat_g numeric,
  net_carbs_g numeric,
  calories numeric,
  confidence text,             -- 'low'|'medium'|'high'|'manual'
  ai_notes text
)
```

**Note on `strava_access_token`/`strava_refresh_token`:** store encrypted
(Supabase Vault or `pgsodium`), never as plaintext readable outside the
owning row's RLS policy. Tokens refresh automatically via a scheduled Edge
Function hitting Strava's token-refresh endpoint before expiry.

**Row-Level Security:** every table gets RLS enabled with a policy restricting
`select/insert/update/delete` to rows where `user_id = auth.uid()`. This is
what makes the app safe for multiple independent users — no user can ever
read another user's logs, targets, or meals.

---

## 4. Feature Flows

### 4.1 Auth / Onboarding
1. User lands on app → sign up or log in (email/password via Supabase Auth).
2. On first login, create `profiles` row (empty) → onboarding wizard:
   a. Height (cm), gender, self-reported activity level (1-10).
   b. Current weight (**stored once as `starting_weight_kg` + `protocol_start_date`
      — this is the fixed baseline for all progress math and is never
      overwritten by later check-ins**), goal weight, desired timeline (weeks).
   c. Client sends this to Edge Function `/generate-targets`, which calls
      Claude with a system prompt to calculate BMR (Mifflin-St Jeor or
      similar), apply an activity multiplier, derive a sustainable deficit
      from the goal/timeline, and split into TKD-appropriate macros for a
      **rest day** and an **activity day** (higher calories/carbs on
      activity days to support performance). Returns structured JSON.
   d. Client shows the AI-generated targets **as editable fields** before
      saving — same principle as meal macros: AI proposes, user confirms
      or corrects, nothing is silently saved.
   e. Confirm writes both rows into `targets` (`rest`, `activity`).
3. Redirect to Dashboard.

### 4.2 Set Targets
1. User opens Targets tab any time after onboarding.
2. Sees editable fields for calories/protein/fat/net-carb-ceiling, one row
   for `rest` and one row for `activity`.
3. Save writes to `targets` table (upsert on `user_id + day_type`).
4. User can also re-trigger the AI onboarding calculation later (e.g. after
   a body recomposition milestone) via a "Recalculate with AI" button.

### 4.3 Morning Check-In
Two entry methods, both writing to the same `daily_logs` row:

**A. Manual form:** weight, body fat %, muscle mass, sleep quality (1-10
slider), energy (1-10 slider), water intake, supplement checklist,
soreness/notes free text.

**B. Photo upload (smart scale screenshot):** user uploads a photo of their
scale app screen (weight, body fat %, muscle mass, etc., all visible in one
shot — this is how the data already naturally exists, per the scale app UI).
Client sends image to Edge Function `/analyze-checkin-photo`, which calls
Claude vision to extract each visible metric into the matching form fields.
**Fields populate but remain editable** — same non-negotiable principle as
meal photos and target generation: AI fills the draft, user confirms.

1. Save performs upsert into `daily_logs` on `(user_id, log_date)`.
2. On save, Edge Function `/generate-checkin-note` calls Claude with the
   day's numbers + the user's last 7 days of history, returns a short
   (1-3 sentence) clinical progress note in the fixed coach voice, stored
   in `daily_logs.ai_note` and shown on the Dashboard.

### 4.4 Log Meal (photo → macros)
1. User uploads a meal photo (camera or gallery).
2. Client sends image (base64) to the Edge Function `/analyze-meal`.
3. Edge Function calls Claude with a vision request and a system prompt
   instructing: clinical macro estimation for a keto protocol, conservative
   portion sizing, flag any visible bread/grain/high-carb items, respond
   in strict JSON only (`description, protein_g, fat_g, net_carbs_g,
   calories, confidence, notes`).
4. Client receives JSON, renders it in **editable** fields (user corrects
   portion sizes — this is a hard product requirement, the AI estimate is
   always a first draft, never final).
5. On confirm, insert into `meals` linked to today's `daily_logs` row
   (create the daily_log row if it doesn't exist yet for today).
6. Running totals for the day (calories/protein/fat/carbs) recompute
   client-side from the sum of today's `meals` rows.
7. Once the user marks the meal day "done" (or at a nightly cutoff), Edge
   Function `/score-meal-day` calls Claude with the full day's meals vs.
   target, returns a 1-10 meal score + one-line justification, stored in
   `daily_logs.meal_score`.

### 4.9 Log Training — hybrid: manual, photo, or Strava sync
No predefined workout list. A day is only marked `day_type = 'activity'`
if at least one `workouts` row exists for that date, sourced one of three
ways:

**A. Manual entry:** simple form — activity name (free text), duration,
optional structured sets (exercise name, reps, weight) for lifting. Insert
into `workouts` with `source = 'manual'`.

**B. Photo upload:** user screenshots their training app (Hevy, Strong, or
similar — this is how the data already exists day-to-day). Client sends to
Edge Function `/analyze-workout-photo`, which calls Claude vision to extract
exercise names, sets, reps, and weights into structured JSON. Client shows
result in editable fields before insert, `source = 'photo'`, raw extraction
kept in `raw_ai_extraction` for audit.

**C. Strava auto-sync:** user connects their Strava account once (OAuth flow
via Edge Function `/strava-connect`, storing encrypted tokens on `profiles`).
A scheduled Edge Function (`/strava-sync`, cron or triggered on app open)
pulls recent activities via Strava's `/athlete/activities` endpoint, inserts
one `workouts` row per new activity (`source = 'strava'`, `strava_activity_id`
enforces no duplicates on re-sync). Covers cardio/endurance sports (running,
tennis if logged, swimming, cycling) well; does **not** reliably cover gym
lifting sessions unless the user's lifting app itself pushes to Strava —
manual/photo entry remains the primary path for resistance training.

Apple Health/HealthKit is explicitly **out of scope**: HealthKit data is
on-device only and has no server-side API a web backend can query without a
native companion app or a paid third-party bridging service (Terra, Spike,
Vital) — none of which fit the free-tier constraint. Revisit only if a
native app wrapper is built later.

### 4.5 Dashboard
1. Pulls today's `daily_logs` row + its `meals` and `workouts`.
2. Renders macro burn-down bars against the target for today's `day_type`
   (`activity` if a `workouts` row exists for today, else `rest`).
3. Shows a COMPLIANT/BREACH stamp based on net_carbs vs. ceiling.
4. Shows supplement-stack completion, weight, sleep at a glance.
5. Pulls `progress_summary` for the user and shows total kg lost, % of
   goal reached, and current rate (kg/week) against the starting baseline —
   never a stale or re-entered "current weight," always derived live.

### 4.6 Trends
1. Pulls last N days of `daily_logs` (+ aggregated `meals` sums per day)
   for the logged-in user only.
2. Line charts: weight, body fat %, sleep quality (with 7.5 target
   reference line).
3. Bar chart: net carbs per day vs. that day's ceiling, breach days
   colored red.

### 4.6.1 Progress Assessment — computation spec
"Current weight" is **never** a stored field — it is always the most
recent `daily_logs.weight_kg` for that user (`order by log_date desc
limit 1`). Progress is computed live, not cached, from three fixed points:
`starting_weight_kg`, `protocol_start_date` (both on `profiles`, immutable),
and `goal_weight_kg`.

Implement as a SQL view (`progress_summary`) so the frontend never
recalculates this logic itself:

```sql
create view progress_summary as
select
  p.id as user_id,
  p.starting_weight_kg,
  p.goal_weight_kg,
  p.protocol_start_date,
  latest.weight_kg as current_weight_kg,
  latest.log_date as current_weight_date,
  (p.starting_weight_kg - latest.weight_kg) as total_lost_kg,
  (p.starting_weight_kg - p.goal_weight_kg) as total_target_loss_kg,
  case when (p.starting_weight_kg - p.goal_weight_kg) > 0
    then round(100.0 * (p.starting_weight_kg - latest.weight_kg)
         / (p.starting_weight_kg - p.goal_weight_kg), 1)
    else null
  end as progress_pct,
  -- linear rate of change over the trailing 14 logged weigh-ins, kg/week
  round(regr_slope(weight_kg, extract(epoch from log_date)::numeric) * 604800, 3)
    as rate_kg_per_week
from profiles p
join lateral (
  select weight_kg, log_date from daily_logs d
  where d.user_id = p.id and weight_kg is not null
  order by log_date desc limit 1
) latest on true
left join lateral (
  select weight_kg, log_date from daily_logs d
  where d.user_id = p.id and weight_kg is not null
  order by log_date desc limit 14
) recent on true
group by p.id, p.starting_weight_kg, p.goal_weight_kg, p.protocol_start_date,
         latest.weight_kg, latest.log_date;
```

RLS on the view inherits from `profiles`/`daily_logs` policies — a user
only ever sees their own row.

Dashboard and Trends both read from `progress_summary` for: total kg lost,
% of goal reached, and current rate of loss (kg/week) — which, combined
with `rate_kg_per_week`, lets the Coach Chat give a real projected date to
goal instead of a static guess.

### 4.7 Coach Chat
1. Client sends the user's message + last 7 days of `daily_logs`/`meals`
   summary (fetched from Supabase) + today's targets, running totals, and
   the user's `progress_summary` row (total lost, % to goal, rate/week —
   enables real projected-date-to-goal answers instead of guesses) to the
   Edge Function `/coach-chat`.
2. Edge Function injects the fixed system prompt (strict/clinical/direct
   nutrition + strength coach persona) + this context, calls Claude,
   streams or returns the response.
3. Chat history can be kept client-side only (not persisted) or persisted
   to a `chat_messages` table if history-across-devices is wanted later —
   **not required for v1**.

### 4.8 Data Export (mitigates lock-in risk)
1. Simple "Export my data" button → queries all of the user's rows across
   `daily_logs`, `meals`, `targets` → downloads as JSON.
2. No deletion trap here: this is a real Postgres DB the user's account
   owns; export is a convenience, not a survival requirement like it was
   with artifact storage.

---

## 5. API Routes (Supabase Edge Functions)

| Route | Method | Input | Output |
|---|---|---|---|
| `/generate-targets` | POST | `{ height_cm, gender, activity_level, starting_weight_kg, goal_weight_kg, goal_timeline_weeks }` | `{ rest: {calories,protein_g,fat_g,net_carbs_g}, activity: {...} }` |
| `/analyze-checkin-photo` | POST | `{ image_base64, media_type }` | `{ weight_kg, body_fat_pct, muscle_mass_kg, ... }` (whatever fields are visible) |
| `/generate-checkin-note` | POST | `{ today: {...}, recent_days: [...] }` | `{ note }` |
| `/analyze-meal` | POST | `{ image_base64, media_type }` | `{ description, protein_g, fat_g, net_carbs_g, calories, confidence, notes }` |
| `/score-meal-day` | POST | `{ meals: [...], target: {...} }` | `{ score, justification }` |
| `/analyze-workout-photo` | POST | `{ image_base64, media_type }` | `{ activity_name, duration_minutes, exercises: [...] }` |
| `/strava-connect` | GET/POST | OAuth redirect + callback | stores tokens on `profiles` |
| `/strava-sync` | POST | `{ user_id }` (or cron-triggered for all connected users) | inserts new `workouts` rows |
| `/coach-chat` | POST | `{ message, context: {targets, today_totals, recent_days} }` | `{ reply }` |

All routes read `ANTHROPIC_API_KEY` (and `STRAVA_CLIENT_SECRET` where
relevant) from Supabase project secrets, never from client env vars.

---

## 6. Non-Functional Requirements

- **Cost:** must run entirely on free tiers (Supabase free + Vercel/Netlify
  free). No paid infra required at current usage scale (single-digit users,
  <1MB/year/user of log data).
- **Multi-user:** must support arbitrary sign-ups out of the box via RLS —
  no manual provisioning per new user.
- **Data durability:** no single client action (unpublishing, clearing
  browser storage, uninstalling the PWA) should be able to delete data.
  Only explicit deletion via the app's own "delete my account" flow should
  remove rows.
- **Mobile-first:** primary usage is on a phone, installed to home screen
  as a PWA (manifest.json + service worker for installability; offline
  support is NOT required for v1).

---

## 7. Visual Direction

Dark, clinical, instrument-panel aesthetic — not a soft wellness-app look.
Near-black background, monospace numerals for all data readouts, a
COMPLIANT/BREACH stamp component, burn-down gauges for macros. Reference:
the existing Claude Artifact prototype (`ProtocolConsole.jsx`) already built
this visual language — port the design tokens, the Protocol Dial signature
element, and component structure; rebuild the data layer on Supabase instead
of mock data.

---

## 8. Out of Scope for v1

- Team/coach-viewing-multiple-clients mode
- Push notifications / reminders
- Native iOS/Android app (PWA is sufficient)
- Food database / barcode scanning (photo-based estimation only)
- Offline-first sync
- Apple Health / HealthKit integration (no free server-side API path — see §4.9)
- Automatic training-app sync beyond Strava (e.g. direct Hevy/Strong API
  pulls) — photo upload covers this gap for v1