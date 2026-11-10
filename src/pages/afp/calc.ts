import { inside, type Detail } from '../aircraft/data'
import { converter } from '../aircraft/units'

/** Assumed weight of the equipment of a jumper and of a tandem master (the pilot can change every weight in the AFP). */
export const GEAR_KG = 8, TM_KG = 80
/** Arms (m) of the stations and fuel density: invented for the dummy, in the real project they come from the AFM/POH. */
export const ARM = { pilot: 1.0, cabin: 1.55, bag: 2.43, fuel: 1.22 } as const
export const DENSITY = 0.72

export const hm = (min: number) => `${Math.floor(Math.max(0, min) / 60)}:${String(Math.round(Math.max(0, min) % 60)).padStart(2, '0')} h`

export interface AfpInput { pilotKg: number; pax: { kg: number }[]; bag: number; fuelL: number; planned: number; /** Flight time to the alternate in minutes. */ alternateMin: number; /** Final reserve in minutes (club setting). */ reserveMin: number }
export interface AfpCheck { label: string; ok: boolean; text: string }

/**
 * Mass, balance and endurance of one flight. ONE calculation for the AFP page and for the PDF, so the document shows exactly what the
 * pilot saw when releasing.
 */
export function afpCalc(d: Detail, v: AfpInput) {
  const env = d.envelope
  const u = converter(d.units) // the texts follow the units of the aircraft, the calculation is metric
  const paxKg = v.pax.reduce((n, p) => n + p.kg, 0)
  const at = (litres: number) => {
    const fuelKg = litres * DENSITY
    const w = d.emptyKg + v.pilotKg + paxKg + v.bag + fuelKg
    return { w, arm: (d.emptyKg * d.emptyArm + v.pilotKg * ARM.pilot + paxKg * ARM.cabin + v.bag * ARM.bag + fuelKg * ARM.fuel) / w }
  }
  const start = at(v.fuelL)
  const land = at(Math.max(0, v.fuelL - (d.burnLph * v.planned) / 60))
  const endurance = d.burnLph ? (v.fuelL / d.burnLph) * 60 : 0
  // The fuel at the start must cover the flight, the way to the alternate AND the final reserve.
  const need = v.planned + v.alternateMin + v.reserveMin
  const weightsOk = v.pilotKg > 0 && v.pax.every((p) => p.kg > 0)
  const checks: AfpCheck[] = env ? [
    { label: 'Gewichte vollständig', ok: weightsOk, text: weightsOk ? 'Pilot und alle Passagiere eingetragen' : 'Gewicht fehlt' },
    { label: 'Abflugmasse', ok: start.w <= d.mtow, text: `${u.massText(start.w)} von ${u.massText(d.mtow)} MTOM (${start.w <= d.mtow ? `${u.massText(d.mtow - start.w)} frei` : `${u.massText(start.w - d.mtow)} zu viel`})` },
    { label: 'Schwerpunkt Abflug', ok: inside(env, start.arm, start.w), text: u.lengthText(start.arm) },
    { label: 'Schwerpunkt Landung', ok: inside(env, land.arm, land.w), text: `${u.lengthText(land.arm)} bei ${u.massText(land.w)}` },
    { label: 'Treibstoff', ok: v.fuelL > 0 && v.fuelL <= d.maxFuelL, text: `${u.fuelText(v.fuelL)} von max. ${u.fuelText(d.maxFuelL)} (${u.massText(v.fuelL * DENSITY)})` },
    { label: 'Endurance', ok: endurance >= need, text: `${hm(endurance)}, benötigt ${hm(need)} (Flug ${v.planned} min + Alternate ${v.alternateMin} min + Reserve ${v.reserveMin} min)` },
  ] : []
  return { start, land, endurance, need, paxKg, weightsOk, checks, go: !!env && checks.every((c) => c.ok) }
}
