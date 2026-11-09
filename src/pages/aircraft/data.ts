// THROWAWAY mock data. Envelope numbers are invented, NOT from a real AFM.

export interface Station { id: string; name: string; arm: number; max?: number; unit: 'kg' | 'L'; def: number; density?: number }
export interface Due { id: string; name: string; kind: 'Wartung' | 'Komponente' | 'Dokument'; unit: 'h' | 'Datum'; remaining: number; total: number; label: string; file?: boolean }
export interface Service { date: string; type: string; hours: string; by: string }
export interface Detail {
  hours: number; landings: number
  emptyKg: number; emptyArm: number; mtow: number; maxFuelL: number
  envelope?: [number, number][] // [arm m, weight kg]
  stations?: Station[]
  dues: Due[]
  history: Service[]
  fuelType: string; burnLph: number
  equipment: string[]
}

const stations: Station[] = [
  { id: 'pilot', name: 'Pilot und Beifahrer', arm: 1.0, max: 200, unit: 'kg', def: 160 },
  { id: 'rear', name: 'Hintere Sitze / Springer', arm: 1.55, max: 300, unit: 'kg', def: 220 },
  { id: 'bag', name: 'Gepäckraum', arm: 2.43, max: 90, unit: 'kg', def: 0 },
  { id: 'fuel', name: 'Treibstoff', arm: 1.22, max: 200, unit: 'L', def: 120, density: 0.72 },
]

export const details: Record<string, Detail> = {
  a1: {
    hours: 4821.4, landings: 17432, emptyKg: 905, emptyArm: 1.04, mtow: 1406, maxFuelL: 200,
    envelope: [[0.84, 860], [0.84, 953], [0.97, 1406], [1.2, 1406], [1.2, 860]],
    stations,
    dues: [
      { id: 'd1', name: '100-h-Check', kind: 'Wartung', unit: 'h', remaining: 17.6, total: 100, label: 'in 17,6 h (bei 4.839 h)' },
      { id: 'd2', name: 'Motor Lycoming IO-540 (TBO)', kind: 'Komponente', unit: 'h', remaining: 360, total: 2000, label: 'noch 360 h' },
      { id: 'd3', name: 'Propeller (TBO)', kind: 'Komponente', unit: 'h', remaining: 910, total: 2000, label: 'noch 910 h' },
      { id: 'd4', name: 'Lufttüchtigkeitsprüfung (ARC)', kind: 'Dokument', unit: 'Datum', remaining: 128, total: 365, label: 'bis 14.03.2027', file: true },
      { id: 'd5', name: 'Versicherung', kind: 'Dokument', unit: 'Datum', remaining: 54, total: 365, label: 'bis 31.12.2026', file: true },
      { id: 'd6', name: 'ELT-Batterie', kind: 'Wartung', unit: 'Datum', remaining: 96, total: 730, label: 'bis 11.02.2027' },
    ],
    history: [
      { date: '02.10.2026', type: '100-h-Check', hours: '4.739,4 h', by: 'Fa. Hofer Flugtechnik' },
      { date: '14.03.2026', type: 'Jahresnachprüfung', hours: '4.601,0 h', by: 'Fa. Hofer Flugtechnik' },
      { date: '19.11.2025', type: 'Propeller überholt', hours: '4.388,2 h', by: 'Propeller Service GmbH' },
    ],
    fuelType: 'AVGAS 100LL', burnLph: 50, equipment: ['GNS 430', 'Transponder Mode S', 'ELT 406 MHz'],
  },
  a2: {
    hours: 7310.2, landings: 22180, emptyKg: 640, emptyArm: 2.1, mtow: 1157, maxFuelL: 189,
    // weight and balance numbers exist, but no envelope entered yet
    dues: [
      { id: 'd1', name: 'Jahresnachprüfung', kind: 'Wartung', unit: 'Datum', remaining: 128, total: 365, label: 'bis 03/2027' },
      { id: 'd2', name: 'Versicherung', kind: 'Dokument', unit: 'Datum', remaining: 12, total: 365, label: 'bis 18.11.2026 (in 12 Tagen)', file: true },
    ],
    history: [{ date: '03.03.2026', type: 'Jahresnachprüfung', hours: '7.102,5 h', by: 'Fa. Hofer Flugtechnik' }],
    fuelType: 'AVGAS 100LL', burnLph: 36, equipment: ['GNS 430', 'Transponder Mode S'],
  },
  a3: {
    hours: 2260.9, landings: 9120, emptyKg: 0, emptyArm: 0, mtow: 0, maxFuelL: 0,
    dues: [{ id: 'd1', name: 'Motorüberholung', kind: 'Komponente', unit: 'h', remaining: 0, total: 3600, label: 'läuft, Rückgabe 24.11.' }],
    history: [],
    fuelType: 'Jet A-1', burnLph: 110, equipment: [],
  },
}

export const inside = (poly: [number, number][], x: number, y: number) => {
  let c = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c
  }
  return c
}

const HOURS_PER_DAY = 0.55 // club average (~200 flight hours a year), used to compare hours with dates
export const daysLeft = (d: Due) => (d.unit === 'Datum' ? d.remaining : d.remaining / HOURS_PER_DAY)

/** Furthest aft CG allowed at a given weight (intersect the envelope with a horizontal line). */
export function aftLimit(poly: [number, number][], w: number) {
  let max = -Infinity
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length]
    if ((y1 - w) * (y2 - w) <= 0 && y1 !== y2) max = Math.max(max, x1 + ((w - y1) * (x2 - x1)) / (y2 - y1))
  }
  return max
}
