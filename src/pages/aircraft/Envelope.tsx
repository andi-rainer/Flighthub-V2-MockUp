import clsx from 'clsx'
import { useMemo, useState, type ReactNode } from 'react'
import { Badge, Banner, Card } from '../../ui'
import { inside, type Detail, type Station } from './data'
import { converter, type Conv } from './units'

const W = 560, H = 340, PAD = { l: 52, r: 16, t: 14, b: 40 }

/** The calculator: load the aircraft, see mass and balance against the envelope. `configure` is the way to the data (only for people who may edit it). */
export default function MassBalance({ d, configure }: { d: Detail; configure?: ReactNode }) {
  const c = converter(d.units)
  const stations = d.stations ?? []
  /** Everything people see and type here is in the units of the aircraft; the calculation runs metric. */
  const shown = (s: Station, stored: number) => (s.unit === 'L' ? c.fuel(stored) : c.mass(stored))
  const unitOf = (s: Station) => (s.unit === 'L' ? c.fuelUnit : c.massUnit)
  const [load, setLoad] = useState<Record<string, number>>(() => Object.fromEntries(stations.map((s) => [s.id, shown(s, s.def)])))
  const [burn, setBurn] = useState(() => Math.round(c.fuel(40))) // fuel burnt on the flight, in fuel units

  const calc = useMemo(() => {
    const kgOf = (s: Station, n: number) => (s.unit === 'L' ? c.toL(n) * (s.density ?? 0.72) : c.toKg(n))
    const sum = (fuel: number) => {
      let w = d.emptyKg, m = d.emptyKg * d.emptyArm
      for (const s of stations) { const k = kgOf(s, s.unit === 'L' ? fuel : (load[s.id] ?? shown(s, s.def))); w += k; m += k * s.arm }
      return { w, arm: m / w }
    }
    const fuelSt = stations.find((s) => s.unit === 'L')
    const fuel = fuelSt ? (load[fuelSt.id] ?? shown(fuelSt, fuelSt.def)) : 0
    return { start: sum(fuel), land: sum(Math.max(0, fuel - burn)) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, burn, d, stations])

  const fuelSt = stations.find((s) => s.unit === 'L')
  const fuelNow = fuelSt ? (load[fuelSt.id] ?? shown(fuelSt, fuelSt.def)) : 0
  const hasWB = d.emptyKg > 0
  if (!hasWB) return <EmptyState text="Für dieses Flugzeug sind noch keine Masse- und Schwerpunktdaten hinterlegt." action={configure} />
  const env = d.envelope
  const ok = env ? inside(env, calc.start.arm, calc.start.w) && inside(env, calc.land.arm, calc.land.w) : undefined
  const over = calc.start.w > d.mtow
  const alt = (a: string) => (a ? ` · ${a}` : '')

  return (
    <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
      <Card className="p-4">
        <div className="mb-3 grid grid-cols-2 gap-2 text-sm">
          <Fact label="Leermasse" v={c.massText(d.emptyKg)} /><Fact label="Leer-CG" v={c.lengthText(d.emptyArm)} />
          <Fact label="MTOM" v={c.massText(d.mtow)} /><Fact label="Max. Treibstoff" v={c.fuelText(d.maxFuelL)} />
        </div>
        <div className="space-y-3">
          {stations.map((s) => {
            const max = s.max !== undefined ? shown(s, s.max) : 300
            const now = load[s.id] ?? shown(s, s.def)
            return (
              <label key={s.id} className="block text-sm">
                <span className="flex justify-between"><span className="font-medium">{s.name}</span><span className="text-xs text-muted">Hebelarm {c.lengthText(s.arm, 2)}{s.max ? ` · max ${max} ${unitOf(s)}` : ''}</span></span>
                <div className="mt-1 flex items-center gap-2">
                  <input type="range" min={0} max={max} value={now} onChange={(e) => setLoad({ ...load, [s.id]: +e.target.value })} className="flex-1" />
                  <input inputMode="decimal" value={now} onChange={(e) => setLoad({ ...load, [s.id]: Math.min(s.max !== undefined ? max : 9999, Number(e.target.value.replace(',', '.')) || 0) })} className="h-10 w-16 rounded-lg border border-line text-right tabular-nums" />
                  <span className="min-w-7 whitespace-nowrap text-xs text-muted">{unitOf(s)}</span>
                </div>
              </label>
            )
          })}
          <label className="block text-sm"><span className="font-medium">Verbrauch bis Landung</span>
            <div className="mt-1 flex items-center gap-2"><input type="range" min={0} max={fuelNow} value={Math.min(burn, fuelNow)} onChange={(e) => setBurn(+e.target.value)} className="flex-1" /><span className="min-w-14 whitespace-nowrap text-right tabular-nums">{burn} {c.fuelUnit}</span></div>
          </label>
        </div>
      </Card>

      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <Big label="Abflugmasse" v={c.massText(calc.start.w)} tone={over ? 'bad' : undefined} hint={`${over ? `${c.massText(calc.start.w - d.mtow)} über MTOM` : `${c.massText(d.mtow - calc.start.w)} unter MTOM`}${alt(c.massAlt(calc.start.w))}`} />
          <Big label="Schwerpunkt Abflug" v={c.lengthText(calc.start.arm)} hint={c.lengthAlt(calc.start.arm)} />
          <Big label="Ergebnis" v={ok === undefined ? 'kein Envelope' : ok && !over ? 'im Limit' : 'AUSSERHALB'} tone={ok === undefined ? undefined : ok && !over ? 'ok' : 'bad'} />
        </div>
        {env ? <Chart c={c} env={env} start={calc.start} land={calc.land} mtow={d.mtow} /> : <EmptyState text="Es fehlen die Schwerpunktgrenzen (Envelope) aus dem AFM." action={configure} />}
      </div>
    </div>
  )
}

/** The envelope. Points are stored metric; the axes show the units of the aircraft. */
export function Chart({ c, env, start, land, mtow }: { c: Conv; env: [number, number][]; start?: { w: number; arm: number }; land?: { w: number; arm: number }; mtow: number }) {
  const xs = env.map((p) => p[0]), ys = env.map((p) => p[1])
  const x0 = Math.min(...xs) - 0.08, x1 = Math.max(...xs) + 0.08, y0 = Math.min(...ys) - 60, y1 = Math.max(...ys) + 60
  const X = (v: number) => PAD.l + ((v - x0) / (x1 - x0)) * (W - PAD.l - PAD.r)
  const Y = (v: number) => H - PAD.b - ((v - y0) / (y1 - y0)) * (H - PAD.t - PAD.b)
  const poly = env.map(([a, w]) => `${X(a)},${Y(w)}`).join(' ')
  const pts = [start && { p: start, l: 'Abflug', c: inside(env, start.arm, start.w) }, land && { p: land, l: 'Landung', c: inside(env, land.arm, land.w) }].filter((x): x is { p: { w: number; arm: number }; l: string; c: boolean } => !!x)
  const xt = Array.from({ length: 5 }, (_, i) => x0 + ((x1 - x0) * i) / 4)
  const yt = Array.from({ length: 5 }, (_, i) => y0 + ((y1 - y0) * i) / 4)
  return (
    <Card className="p-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="CG-Envelope">
        {xt.map((v) => <g key={v}><line x1={X(v)} x2={X(v)} y1={PAD.t} y2={H - PAD.b} stroke="#e2e8f0" /><text x={X(v)} y={H - PAD.b + 16} textAnchor="middle" fontSize="11" fill="#64748b">{c.length(v).toFixed(c.units.length === 'm' ? 2 : 1)}</text></g>)}
        {yt.map((v) => <g key={v}><line y1={Y(v)} y2={Y(v)} x1={PAD.l} x2={W - PAD.r} stroke="#e2e8f0" /><text x={PAD.l - 6} y={Y(v) + 4} textAnchor="end" fontSize="11" fill="#64748b">{Math.round(c.mass(v))}</text></g>)}
        <polygon points={poly} fill="#15803d" fillOpacity="0.1" stroke="#15803d" strokeWidth="2" />
        <line x1={PAD.l} x2={W - PAD.r} y1={Y(mtow)} y2={Y(mtow)} stroke="#b91c1c" strokeDasharray="4 3" />
        <text x={W - PAD.r - 4} y={Y(mtow) - 4} textAnchor="end" fontSize="10" fill="#b91c1c">MTOM {c.massText(mtow)}</text>
        {start && land && <line x1={X(start.arm)} y1={Y(start.w)} x2={X(land.arm)} y2={Y(land.w)} stroke="#64748b" strokeDasharray="3 3" />}
        {pts.map(({ p, l, c }) => (
          <g key={l}><circle cx={X(p.arm)} cy={Y(p.w)} r="7" fill={c ? '#0b5fff' : '#b91c1c'} stroke="#fff" strokeWidth="2" /><text x={X(p.arm) + 11} y={Y(p.w) + 4} fontSize="11" fontWeight="600" fill="#0f172a">{l}</text></g>
        ))}
        <text x={(PAD.l + W - PAD.r) / 2} y={H - 4} textAnchor="middle" fontSize="11" fill="#64748b">Schwerpunkt ({c.lengthUnit} hinter Bezugsebene)</text>
        <text transform={`translate(12 ${H / 2}) rotate(-90)`} textAnchor="middle" fontSize="11" fill="#64748b">Masse ({c.massUnit})</text>
      </svg>
      {(start || land) && <div className="mt-2 flex flex-wrap gap-2 text-xs"><Badge tone="ok">grün = zulässiger Bereich (AFM)</Badge><Badge tone="info">Punkt blau = im Limit</Badge><Badge tone="bad">Punkt rot = außerhalb</Badge></div>}
    </Card>
  )
}

const Fact = ({ label, v }: { label: string; v: string }) => <div className="rounded-lg bg-slate-50 px-3 py-2"><div className="text-xs text-muted">{label}</div><div className="font-semibold tabular-nums">{v}</div></div>
const Big = ({ label, v, hint, tone }: { label: string; v: string; hint?: string; tone?: 'ok' | 'bad' }) => (
  <Card className="p-3"><div className="text-xs font-medium uppercase tracking-wide text-muted">{label}</div><div className={clsx('mt-0.5 text-xl font-semibold tabular-nums', tone === 'ok' && 'text-ok', tone === 'bad' && 'text-bad')}>{v}</div>{hint && <div className="text-xs text-muted">{hint}</div>}</Card>
)
function EmptyState({ text, action }: { text: string; action?: ReactNode }) {
  return <Banner tone="warn"><div className="flex flex-wrap items-center justify-between gap-3"><span>{text}</span>{action}</div></Banner>
}
