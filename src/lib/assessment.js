// Deterministic BMI/deficit/projection arithmetic — kept out of the LLM
// prompt entirely so rounding and formatting are always exact. Mirrored in
// supabase/functions/_shared/assessment.ts for the edge function (Deno
// can't import this file directly, so keep both in sync on changes).

const KCAL_PER_KG_FAT = 7700

function bmiCategory(bmi) {
  if (bmi < 18.5) return 'Underweight'
  if (bmi < 25) return 'Normal'
  if (bmi < 30) return 'Overweight'
  return 'Obese'
}

export function computeAssessment({ weight_kg, height_cm, goal_weight_kg, calories, maintenance_calories }) {
  const heightM = height_cm / 100
  const bmi = weight_kg / (heightM * heightM)
  const bmiRounded = (Math.round(bmi * 10) / 10).toFixed(1)
  const category = bmiCategory(bmi)

  const deficit = Math.round(maintenance_calories - calories)
  const weeklyLossKg = Math.round(((deficit * 7) / KCAL_PER_KG_FAT) * 100) / 100
  const weeksToGoal = weeklyLossKg > 0 ? Math.round((weight_kg - goal_weight_kg) / weeklyLossKg) : null

  return (
    `At ${weight_kg}kg and ${height_cm}cm, your BMI is ${bmiRounded} (${category}). ` +
    `These targets create a ~${deficit}kcal deficit — about ${weeklyLossKg.toFixed(2)}kg/week, ` +
    `sustainable at your protein intake — putting you on track to reach ${goal_weight_kg}kg in ` +
    `roughly ${weeksToGoal !== null ? weeksToGoal + ' weeks' : 'an unclear timeframe at this deficit'}.`
  )
}
