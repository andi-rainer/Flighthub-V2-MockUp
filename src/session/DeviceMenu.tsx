import { Check, ShieldQuestion } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '../ui'

import { useSession } from './session'

const mm = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`

/**
 * Top right, next to the user menu. Only visible on a public device: a small pill with the time left, a click opens what you can do
 * (confirm now for sensitive actions, or trust this device). On a trusted device there is nothing to show.
 */
export default function DevicePill() {
  const { session, msLeft, elevated, stepUp, trustDevice, fastForward } = useSession()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', close); return () => document.removeEventListener('mousedown', close)
  }, [])
  if (!session || session.trusted) return null
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-label="Öffentliches Gerät" className="flex h-8 items-center gap-1.5 rounded-full border border-warn/40 bg-warn-soft px-2.5 text-xs font-medium text-amber-900 hover:bg-amber-100">
        {elevated ? <Check size={14} /> : <ShieldQuestion size={14} />}<span className="hidden sm:inline">Öffentliches Gerät</span><span className="tabular-nums">{mm(Math.max(0, msLeft))}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-72 space-y-3 rounded-xl border border-line bg-surface p-4 text-sm shadow-lg">
          <div className="font-semibold">Öffentliches Gerät</div>
          <div className="space-y-2">
            <Button variant="primary" className="w-full" onClick={() => { setOpen(false); stepUp(() => {}) }}>{elevated ? 'Neu bestätigen' : 'Identität bestätigen'}</Button>
            <Button className="w-full" onClick={() => { setOpen(false); trustDevice() }}>Diesem Gerät vertrauen</Button>
          </div>
          <button onClick={() => { setOpen(false); fastForward() }} className="text-xs text-muted hover:text-ink">Zeit vorspulen (nur Dummy)</button>
        </div>
      )}
    </div>
  )
}
