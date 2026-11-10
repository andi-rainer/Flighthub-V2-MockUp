/**
 * Units of an aircraft. Aircraft come in kg or lb, m or inches, litres or US gallons, and one club can fly all of them. The data of an
 * aircraft are stored metric (kg, m, L), so every calculation and every comparison between aircraft works without conversion. Each aircraft
 * has its own display units: what people read and type follows them, `converter` does the conversion at the edge.
 */
export type MassUnit = 'kg' | 'lb'
export type LengthUnit = 'm' | 'in'
export type FuelUnit = 'L' | 'gal'
export interface Units { mass: MassUnit; length: LengthUnit; fuel: FuelUnit }
export const METRIC: Units = { mass: 'kg', length: 'm', fuel: 'L' }

const KG = { kg: 1, lb: 0.45359237 } as const
const M = { m: 1, in: 0.0254 } as const
const L = { L: 1, gal: 3.785411784 } as const // US gallon
export const FUEL_LABEL: Record<FuelUnit, string> = { L: 'L', gal: 'US gal' }

const round = (n: number, digits = 2) => { const f = 10 ** digits; return Math.round(n * f) / f }
const text = (n: number, digits: number) => n.toLocaleString('de-AT', { minimumFractionDigits: 0, maximumFractionDigits: digits })

/** Conversion between the metric storage and the display units of one aircraft. */
export function converter(u: Units) {
  const lengthDigits = u.length === 'm' ? 3 : 2
  const fuelDigits = u.fuel === 'L' ? 0 : 1
  return {
    units: u,
    massUnit: u.mass as string, lengthUnit: u.length as string, fuelUnit: FUEL_LABEL[u.fuel],
    /** Stored (metric) → number shown to people, rounded; and back. */
    mass: (kg: number) => round(kg / KG[u.mass]), toKg: (n: number) => n * KG[u.mass],
    length: (m: number) => round(m / M[u.length], 3), toM: (n: number) => n * M[u.length],
    fuel: (l: number) => round(l / L[u.fuel]), toL: (n: number) => n * L[u.fuel],
    /** With the unit, for reading. */
    massText: (kg: number, digits = 0) => `${text(kg / KG[u.mass], digits)} ${u.mass}`,
    lengthText: (m: number, digits = lengthDigits) => `${text(m / M[u.length], digits)} ${u.length}`,
    fuelText: (l: number, digits = fuelDigits) => `${text(l / L[u.fuel], digits)} ${FUEL_LABEL[u.fuel]}`,
    /** The metric equivalent of a value in another system, empty for a metric aircraft: "≙ 1.021 kg". */
    massAlt: (kg: number) => (u.mass === 'kg' ? '' : `≙ ${text(kg, 0)} kg`),
    lengthAlt: (m: number) => (u.length === 'm' ? '' : `≙ ${text(m, 3)} m`),
    fuelAlt: (l: number) => (u.fuel === 'L' ? '' : `≙ ${text(l, 0)} L`),
  }
}
export type Conv = ReturnType<typeof converter>
