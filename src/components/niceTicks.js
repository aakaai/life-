// Graduations « rondes » (0, 5, 10… / 0, 250, 500…).
export function niceTicks(lo, hi, count = 4) {
  if (hi - lo < 1e-9) hi = lo + 1
  const raw = (hi - lo) / count
  const p = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= raw)
  const start = Math.floor(lo / step) * step
  const ticks = []
  for (let v = start; v < hi + step * 0.999; v += step) ticks.push(Math.round(v * 1e6) / 1e6)
  return ticks
}
