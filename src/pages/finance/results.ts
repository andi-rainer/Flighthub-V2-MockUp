import { fixedCostsYear, sparten, varPerMinute } from '../../data'

/** Result per Sparte for the aircraft: income minus variable costs minus the share of fixed costs (by flight minutes). */
export function computeSparten() {
  const totalMin = sparten.reduce((n, s) => n + s.minutes, 0)
  const rows = sparten.map((s) => {
    const variable = s.minutes * varPerMinute
    const fix = (fixedCostsYear * s.minutes) / totalMin
    return { ...s, variable, fix, cost: variable + fix, result: s.income - variable - fix }
  })
  const income = rows.reduce((n, r) => n + r.income, 0)
  const cost = rows.reduce((n, r) => n + r.cost, 0)
  return { rows, totalMin, income, cost, perMin: cost / totalMin }
}
