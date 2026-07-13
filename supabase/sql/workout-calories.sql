-- Adds calories_burned to workouts, populated by analyze-workout-photo
-- (direct extraction, or a MET/BPM-based estimate) or manual entry.
alter table workouts add column if not exists calories_burned numeric;
