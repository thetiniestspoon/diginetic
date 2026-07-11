// Environment: vertical temperature gradient + food scalar. Pure.
export function makeEnvironment(params) {
  const temperature = clamp(params?.temperature ?? 0, -1, 1);
  const food = clamp01(params?.food ?? 0.5);
  return {
    temperature,
    food,
    // colder at top (y small), warmer at bottom, biased by base temperature
    sampleTemp(x, y, w, h) {
      const vertical = (y / (h || 1)) * 2 - 1; // -1 top .. +1 bottom
      return clamp(vertical + temperature, -1, 1);
    },
  };
}

// Preferred size rises with temperature: cold (-1) prefers size 0, warm (+1) prefers size 1.
export function fitness(phenotype, localTemp) {
  const preferredSize = (localTemp + 1) / 2;            // 0..1
  const mismatch = Math.abs((phenotype.size ?? 0.5) - preferredSize);
  const sizeFit = 1 - mismatch;                          // 1 perfect .. 0 worst
  const metabolicCost = 0.25 * (phenotype.metabolism ?? 0.5);
  return clamp01(sizeFit - metabolicCost);
}

export function energyDelta(phenotype, localTemp, food) {
  const f = fitness(phenotype, localTemp);
  const gain = food * (0.25 + 0.75 * f) * 0.055;
  const burn = 0.01 + 0.02 * (phenotype.metabolism ?? 0.5);
  return gain - burn;
}

function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
function clamp01(x) { return clamp(x, 0, 1); }
