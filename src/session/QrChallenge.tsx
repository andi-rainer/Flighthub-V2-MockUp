import { RefreshCw, Smartphone } from 'lucide-react'
import { useMemo, useState } from 'react'
import clsx from 'clsx'

/** A QR-looking pattern from a number. Only a picture: the dummy has no camera. */
export function QrPicture({ seed }: { seed: number }) {
  const cells = useMemo(() => {
    const n = 21
    let x = seed * 9301 + 49297
    const rnd = () => { x = (x * 9301 + 49297) % 233280; return x / 233280 }
    const grid: boolean[][] = Array.from({ length: n }, () => Array.from({ length: n }, () => rnd() > 0.52))
    const finder = (ox: number, oy: number) => { for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) grid[oy + i][ox + j] = i === 0 || j === 0 || i === 6 || j === 6 || (i > 1 && i < 5 && j > 1 && j < 5) }
    finder(0, 0); finder(14, 0); finder(0, 14)
    for (let i = 0; i < 8; i++) { grid[7][i] = false; grid[i][7] = false; grid[7][n - 1 - i] = false; grid[i][n - 8] = false; grid[n - 8][i] = false; grid[n - 1 - i][7] = false }
    return grid
  }, [seed])
  return (
    <svg viewBox="0 0 21 21" className="h-40 w-40 rounded-lg border border-line bg-white p-2" shapeRendering="crispEdges" aria-label="QR-Code">
      {cells.map((row, y) => row.map((on, x) => on && <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="#0f172a" />))}
    </svg>
  )
}

const newChallenge = () => {
  const n = 10 + Math.floor(Math.random() * 89)
  const wrong = new Set<number>()
  while (wrong.size < 2) { const w = 10 + Math.floor(Math.random() * 89); if (w !== n) wrong.add(w) }
  const options = [n, ...wrong].sort(() => Math.random() - 0.5)
  return { n, options, seed: Math.floor(Math.random() * 1000) }
}

/**
 * The QR procedure of V1: the computer shows a QR code and a number. The person scans it with the phone, which is a TRUSTED
 * device, and picks that number among three. One wrong pick burns the challenge and a new one appears.
 * The right half simulates the phone, because the dummy cannot scan.
 */
export default function QrChallenge({ who, hint, onApproved }: { who: string; hint?: string; onApproved: () => void }) {
  const [c, setC] = useState(newChallenge)
  const [burned, setBurned] = useState(false)
  const pick = (n: number) => { if (n === c.n) onApproved(); else { setBurned(true); setC(newChallenge()) } }
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2 text-center">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted">Dieser Bildschirm</div>
        <div className="flex justify-center"><QrPicture seed={c.seed} /></div>
        <div className="text-3xl font-semibold tabular-nums tracking-widest" aria-label="Zahl am Bildschirm">{c.n}</div>
        <p className="text-xs text-muted">{hint ?? `${who} scannt den Code mit dem Handy und wählt diese Zahl.`}</p>
      </div>
      <div className="space-y-2 rounded-xl border border-dashed border-line bg-slate-50 p-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted"><Smartphone size={13} /> Handy von {who} (Simulation)</div>
        <p className="text-xs text-muted">Welche Zahl steht am Bildschirm?</p>
        <div className="grid grid-cols-3 gap-2">
          {c.options.map((o) => <button key={o} onClick={() => pick(o)} className={clsx('h-12 rounded-lg border border-line bg-white text-lg font-semibold tabular-nums hover:border-brand hover:bg-brand-soft')}>{o}</button>)}
        </div>
        {burned && <p className="flex items-center gap-1.5 rounded-lg bg-bad-soft px-2 py-1.5 text-xs text-bad"><RefreshCw size={12} /> Falsche Zahl. Der Code ist verbrannt, ein neuer ist da.</p>}
      </div>
    </div>
  )
}
