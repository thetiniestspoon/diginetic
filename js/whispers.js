// Poetic whispers. Local phrase bank (pure); LLM client added in Task 10.
export function pickLocalWhisper(metrics) {
  const m = metrics ?? {};
  if ((m.births ?? 0) > (m.deaths ?? 0)) return 'New life gathers at the edges.';
  if ((m.deaths ?? 0) > (m.births ?? 0)) return 'Silence spreads through hidden folds.';
  if ((m.tempDrift ?? 0) > 0.2) return 'Warm currents stir the restless.';
  if ((m.tempDrift ?? 0) < -0.2) return 'Cold shadows favor the still.';
  return 'Patterns sway beneath the surface.';
}
