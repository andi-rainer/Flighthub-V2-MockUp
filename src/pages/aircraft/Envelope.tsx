import clsx from 'clsx'
import { useMemo, useState } from 'react'
import { Badge, Banner, Button, Card } from '../../ui'
import { inside, type Detail } from './data'

const W = 560, H = 340, PAD = { l: 52, r: 16, t: 14, b: 40 }

export default function MassBalance({ d }: { d: Detail }) {
  const stations = d.stations ?? []
  const [load, setLoad] = useState<Record<string, number>>(() => Object.fromEntries(stations.map((s) => [s.id, s.def])))
  const [burn, setBurn] = useState(40) // litres burnt on the flight

  const calc = useMemo(() => {
    const sum = (fuelL: number) => {
      let w = d.emptyKg, m = d.emptyKg * d.emptyArm
      for (const s of stations) { const k = s.unit === 'L' ? fuelL * (s.density ?? 0.72) : load[s.id]; w += k; m += k * s.arm }
      return { w, arm: m / w }
    }
    const fuel = load.fuel ?? 0
    return { start: sum(fuel), land: sum(Math.max(0, fuel - burn)) }
  }, [load, burn, d, stations])

  const hasWB = d.emptyKg > 0
  if (!hasWB) return <EmptyState text="Noch keine Masse- und Schwerpunktdaten. Leermasse, Leerschwerpunkt und Stationen aus dem Wägebericht eintragen." />
  const env = d.envelope
  const ok = env ? inside(env, calc.start.arm, calc.start.w) && inside(env, calc.land.arm, calc.land.w) : undefined
  const over = calc.start.w > d.mtow

  return (
    <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
      <Card className="p-4">
        <div className="mb-3 grid grid-cols-2 gap-2 text-sm">
          <Fact label="Leermasse" v={`${d.emptyKg} kg`} /><Fact label="Leer-CG" v={`${d.emptyArm.toFixed(2)} m`} />
          <Fact label="MTOM" v={`${d.mtow} kg`} /><Fact label="Max. Treibstoff" v={`${d.maxFuelL} L`} />
        </div>
        <div className="space-y-3">
          {stations.map((s) => (
            <label key={s.id} className="block text-sm">
              <span className="flex justify-between"><span className="font-medium">{s.name}</span><span className="text-xs text-muted">Hebelarm {s.arm.toFixed(2)} m{s.max ? ` · max ${s.max} ${s.unit}` : ''}</span></span>
              <div className="mt-1 flex items-center gap-2">
                <input type="range" min={0} max={s.max ?? 300} value={load[s.id]} onChange={(e) => setLoad({ ...load, [s.id]: +e.target.value })} className="flex-1" />
                <input inputMode="numeric" value={load[s.id]} onChange={(e) => setLoad({ ...load, [s.id]: Math.min(s.max ?? 999, +e.target.value || 0) })} className="h-10 w-16 rounded-lg border border-line text-right tabular-nums" />
                <span className="w-5 text-xs text-muted">{s.unit}</span>
              </div>
            </label>
          ))}
          <label className="block text-sm"><span className="font-medium">Verbrauch bis Landung</span>
            <div className="mt-1 flex items-center gap-2"><input type="range" min={0} max={load.fuel ?? 0} value={Math.min(burn, load.fuel ?? 0)} onChange={(e) => setBurn(+e.target.value)} className="flex-1" /><span className="w-14 text-right tabular-nums">{burn} L</span></div>
          </label>
        </div>
      </Card>

      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <Big label="Abflugmasse" v={`${Math.round(calc.start.w)} kg`} tone={over ? 'bad' : undefined} hint={over ? `${Math.round(calc.start.w - d.mtow)} kg über MTOM` : `${Math.round(d.mtow - calc.start.w)} kg unter MTOM`} />
          <Big label="Schwerpunkt Abflug" v={`${calc.start.arm.toFixed(3)} m`} />
          <Big label="Ergebnis" v={ok === undefined ? 'kein Envelope' : ok && !over ? 'im Limit' : 'AUSSERHALB'} tone={ok === undefined ? undefined : ok && !over ? 'ok' : 'bad'} />
        </div>
        {env ? <Chart env={env} start={calc.start} land={calc.land} mtow={d.mtow} /> : <EmptyState text="Weight-and-Balance-Daten sind vorhanden, aber es fehlt der CG-Envelope. Die Eckpunkte aus dem AFM eintragen, dann erscheint hier die Grafik zum Abgleich." action="Envelope aus AFM eintragen" />}
        <p className="text-xs text-muted">Demo mit erfundenen Werten. Im echten System stammen sie aus Wägebericht und AFM, und jede Änderung wird protokolliert.</p>
      </div>
    </div>
  )
}

export function Chart({ env, start, land, mtow }: { env: [number, number][]; start: { w: number; arm: number }; land: { w: number; arm: number }; mtow: number }) {
  const xs = env.map((p) => p[0]), ys = env.map((p) => p[1])
  const x0 = Math.min(...xs) - 0.08, x1 = Math.max(...xs) + 0.08, y0 = Math.min(...ys) - 60, y1 = Math.max(...ys) + 60
  const X = (v: number) => PAD.l + ((v - x0) / (x1 - x0)) * (W - PAD.l - PAD.r)
  const Y = (v: number) => H - PAD.b - ((v - y0) / (y1 - y0)) * (H - PAD.t - PAD.b)
  const poly = env.map(([a, w]) => `${X(a)},${Y(w)}`).join(' ')
  const pts = [{ p: start, l: 'Abflug', c: inside(env, start.arm, start.w) }, { p: land, l: 'Landung', c: inside(env, land.arm, land.w) }]
  const xt = Array.from({ length: 5 }, (_, i) => x0 + ((x1 - x0) * i) / 4)
  const yt = Array.from({ length: 5 }, (_, i) => y0 + ((y1 - y0) * i) / 4)
  return (
    <Card className="p-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="CG-Envelope">
        {xt.map((v) => <g key={v}><line x1={X(v)} x2={X(v)} y1={PAD.t} y2={H - PAD.b} stroke="#e2e8f0" /><text x={X(v)} y={H - PAD.b + 16} textAnchor="middle" fontSize="11" fill="#64748b">{v.toFixed(2)}</text></g>)}
        {yt.map((v) => <g key={v}><line y1={Y(v)} y2={Y(v)} x1={PAD.l} x2={W - PAD.r} stroke="#e2e8f0" /><text x={PAD.l - 6} y={Y(v) + 4} textAnchor="end" fontSize="11" fill="#64748b">{Math.round(v)}</text></g>)}
        <polygon points={poly} fill="#15803d" fillOpacity="0.1" stroke="#15803d" strokeWidth="2" />
        <line x1={PAD.l} x2={W - PAD.r} y1={Y(mtow)} y2={Y(mtow)} stroke="#b91c1c" strokeDasharray="4 3" />
        <text x={W - PAD.r - 4} y={Y(mtow) - 4} textAnchor="end" fontSize="10" fill="#b91c1c">MTOM {mtow} kg</text>
        <line x1={X(start.arm)} y1={Y(start.w)} x2={X(land.arm)} y2={Y(land.w)} stroke="#64748b" strokeDasharray="3 3" />
        {pts.map(({ p, l, c }) => (
          <g key={l}><circle cx={X(p.arm)} cy={Y(p.w)} r="7" fill={c ? '#0b5fff' : '#b91c1c'} stroke="#fff" strokeWidth="2" /><text x={X(p.arm) + 11} y={Y(p.w) + 4} fontSize="11" fontWeight="600" fill="#0f172a">{l}</text></g>
        ))}
        <text x={(PAD.l + W - PAD.r) / 2} y={H - 4} textAnchor="middle" fontSize="11" fill="#64748b">Schwerpunkt (m hinter Bezugsebene)</text>
        <text transform={`translate(12 ${H / 2}) rotate(-90)`} textAnchor="middle" fontSize="11" fill="#64748b">Masse (kg)</text>
      </svg>
      <div className="mt-2 flex flex-wrap gap-2 text-xs"><Badge tone="ok">grün = zulässiger Bereich (AFM)</Badge><Badge tone="info">Punkt blau = im Limit</Badge><Badge tone="bad">Punkt rot = außerhalb</Badge></div>
    </Card>
  )
}

const Fact = ({ label, v }: { label: string; v: string }) => <div className="rounded-lg bg-slate-50 px-3 py-2"><div className="text-xs text-muted">{label}</div><div className="font-semibold tabular-nums">{v}</div></div>
const Big = ({ label, v, hint, tone }: { label: string; v: string; hint?: string; tone?: 'ok' | 'bad' }) => (
  <Card className="p-3"><div className="text-xs font-medium uppercase tracking-wide text-muted">{label}</div><div className={clsx('mt-0.5 text-xl font-semibold tabular-nums', tone === 'ok' && 'text-ok', tone === 'bad' && 'text-bad')}>{v}</div>{hint && <div className="text-xs text-muted">{hint}</div>}</Card>
)
function EmptyState({ text, action }: { text: string; action?: string }) {
  return <Banner tone="warn"><div className="flex flex-wrap items-center justify-between gap-3"><span>{text}</span>{action && <Button>{action}</Button>}</div></Banner>
}
