import clsx from 'clsx'
import { FileUp, Loader2, Paperclip, ScanLine, Smartphone, Sparkles, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { QrPicture } from '../../session/QrChallenge'
import { TODAY_ISO } from '../../state'
import { Field, field } from '../tickets/parts'
import type { NewReceipt } from './ledger'

/** The data of an invoice or delivery note as it is entered or read: the file and its numbers (text, as typed). */
export interface Captured { file: string; supplier: string; number: string; date: string; total: string; liters: string; perLiter: string; /** The numbers come from the reading, not from a person. */ read: boolean }
export const EMPTY_CAPTURE: Captured = { file: '', supplier: '', number: '', date: TODAY_ISO, total: '', liters: '', perLiter: '', read: false }

const num = (v: string) => Number(v.replace(',', '.')) || 0
const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d
const show = (n: number, d = 2) => (n > 0 ? String(round(n, d)).replace('.', ',') : '')

/** What is still missing before the receipt can be kept. Fuel always needs the sum and the price per liter (they give the average fuel cost). */
export function captureProblem(c: Captured, fuel: boolean): string | null {
  if (!c.file) return 'Beleg anhängen.'
  if (!c.supplier.trim()) return 'Lieferant fehlt.'
  if (num(c.total) <= 0) return 'Summe fehlt.'
  if (fuel && num(c.liters) <= 0) return 'Liter fehlen.'
  if (fuel && num(c.perLiter) <= 0) return 'Literpreis fehlt.'
  return null
}

export function toNewReceipt(c: Captured, fuel: boolean, extra: Partial<NewReceipt> = {}): NewReceipt {
  return { file: c.file, supplier: c.supplier.trim(), number: c.number.trim(), date: c.date, amount: round(num(c.total), 2), fuel: fuel ? { liters: num(c.liters), perLiter: round(num(c.perLiter), 3) } : undefined, ...extra }
}

/** From an invoice that is already kept. */
export const captureOf = (r: { name: string; supplier: string; number?: string; date: string; amount: number; fuel?: { liters: number; perLiter: number } }): Captured =>
  ({ file: r.name, supplier: r.supplier, number: r.number ?? '', date: r.date, total: show(r.amount), liters: r.fuel ? show(r.fuel.liters, 1) : '', perLiter: r.fuel ? show(r.fuel.perLiter, 3) : '', read: false })

/** The dummy of the reading: a plausible result from the name of the file. The real project sends the file to a language model. */
function fakeRead(name: string, fuel: boolean): Captured {
  const h = [...name].reduce((n, ch) => n + ch.charCodeAt(0), 0)
  const suppliers = ['Shell Austria', 'Tankstelle LOLW', 'OMV Aviation']
  const liters = 40 + (h % 80)
  const perLiter = round(2.8 + (h % 25) / 100, 3)
  const total = fuel ? round(liters * perLiter, 2) : 20 + (h % 200)
  return { file: name, supplier: suppliers[h % suppliers.length], number: String(10000 + (h % 89999)), date: TODAY_ISO, total: show(total), liters: fuel ? String(liters) : '', perLiter: fuel ? show(perLiter, 3) : '', read: true }
}

const stamp = () => { const d = new Date(); return `${TODAY_ISO}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}` }

/**
 * Takes a receipt in and reads it. Three ways to attach the file: choose a file (on a phone this opens the camera), or scan with the
 * phone: the computer shows a QR code, the phone opens a scanner in its browser and the finished scan lands here. A language model reads
 * supplier, date, sum (and liters and price per liter for fuel); the person only checks the numbers.
 */
export function ReceiptCapture({ value, onChange, fuel, liters, onUseLiters }: {
  value: Captured; onChange: (c: Captured) => void; fuel: boolean
  /** The liters the entry itself names (Bordbuch): the reading is compared to them. */ liters?: number
  onUseLiters?: (n: number) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [reading, setReading] = useState(false)
  const [phone, setPhone] = useState(false)
  const attach = (name: string) => {
    setPhone(false); setReading(true)
    onChange({ ...EMPTY_CAPTURE, file: name, date: TODAY_ISO })
    setTimeout(() => { setReading(false); onChange(fakeRead(name, fuel)) }, 900)
  }
  const set = (p: Partial<Captured>) => onChange({ ...value, ...p, read: false })
  const total = num(value.total), l = num(value.liters)
  // Sum and liters give the price per liter; the price per liter and the liters give the sum.
  const setTotal = (v: string) => set({ total: v, perLiter: fuel && l > 0 && num(v) > 0 ? show(num(v) / l, 3) : value.perLiter })
  const setLiters = (v: string) => set({ liters: v, perLiter: fuel && num(v) > 0 && total > 0 ? show(total / num(v), 3) : value.perLiter })
  const setPer = (v: string) => set({ perLiter: v, total: fuel && l > 0 && num(v) > 0 ? show(l * num(v)) : value.total })
  const differs = fuel && liters !== undefined && liters > 0 && l > 0 && Math.abs(liters - l) > 0.5

  if (!value.file) {
    return (
      <div className="space-y-2">
        <input ref={input} type="file" accept="application/pdf,image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) attach(f.name) }} />
        <div className="grid gap-2 sm:grid-cols-2">
          <button onClick={() => input.current?.click()} className="flex flex-col items-center gap-1 rounded-xl border-2 border-dashed border-line py-5 text-sm text-muted hover:border-brand hover:text-brand"><FileUp size={22} /> Foto aufnehmen oder Datei wählen</button>
          <button onClick={() => setPhone((v) => !v)} className={clsx('flex flex-col items-center gap-1 rounded-xl border-2 border-dashed py-5 text-sm hover:border-brand hover:text-brand', phone ? 'border-brand text-brand' : 'border-line text-muted')}><Smartphone size={22} /> Mit dem Handy scannen</button>
        </div>
        {phone && <PhoneScan onDone={attach} />}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-ok-soft px-3 py-1 text-xs font-medium text-ok"><Paperclip size={12} />{value.file}<button aria-label="Beleg entfernen" onClick={() => onChange(EMPTY_CAPTURE)}><X size={12} /></button></span>
        {reading && <span className="inline-flex items-center gap-1.5 text-xs text-muted"><Loader2 size={13} className="animate-spin" /> Beleg wird gelesen …</span>}
        {!reading && value.read && <span className="inline-flex items-center gap-1.5 text-xs text-brand"><Sparkles size={13} /> Gelesen, bitte prüfen</span>}
      </div>
      {!reading && (
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Field label="Lieferant" className="col-span-2"><input aria-label="Lieferant" value={value.supplier} onChange={(e) => set({ supplier: e.target.value })} className={`${field} w-full`} /></Field>
          <Field label="Belegnummer"><input aria-label="Belegnummer" value={value.number} onChange={(e) => set({ number: e.target.value })} className={`${field} w-full`} /></Field>
          <Field label="Belegdatum"><input type="date" aria-label="Belegdatum" max={TODAY_ISO} value={value.date} onChange={(e) => set({ date: e.target.value })} className={`${field} w-full`} /></Field>
          <Field label="Summe (€)"><input aria-label="Summe" inputMode="decimal" value={value.total} onChange={(e) => setTotal(e.target.value)} className={`${field} w-full text-right tabular-nums`} /></Field>
          {fuel && (
            <>
              <Field label="Liter"><input aria-label="Liter" inputMode="decimal" value={value.liters} onChange={(e) => setLiters(e.target.value)} className={`${field} w-full text-right tabular-nums`} /></Field>
              <Field label="Literpreis (€/L)"><input aria-label="Literpreis" inputMode="decimal" value={value.perLiter} onChange={(e) => setPer(e.target.value)} className={`${field} w-full text-right tabular-nums`} /></Field>
            </>
          )}
        </div>
      )}
      {differs && onUseLiters && (
        <div className="space-y-2 rounded-xl border-2 border-warn bg-warn-soft p-3 text-sm text-amber-900">
          <div className="font-semibold">Der Beleg nennt {value.liters} L, der Eintrag {liters} L. Wurden wirklich {value.liters} L getankt?</div>
          <div className="flex flex-wrap gap-2">
            <button className="h-9 rounded-lg bg-brand px-3 font-medium text-white" onClick={() => onUseLiters(num(value.liters))}>{value.liters} L übernehmen</button>
            <button className="h-9 rounded-lg border border-line bg-white px-3 font-medium text-ink" onClick={() => setLiters(String(liters))}>{liters} L stimmt</button>
          </div>
        </div>
      )}
    </div>
  )
}

/** The phone side, simulated: in the real project the QR code opens a scanner in the browser of the phone and sends the file back. */
function PhoneScan({ onDone }: { onDone: (file: string) => void }) {
  const [seed] = useState(() => Math.floor(Math.random() * 1000))
  const [pages, setPages] = useState(0)
  return (
    <div className="grid gap-3 rounded-xl border border-line p-3 sm:grid-cols-2">
      <div className="space-y-2 text-center">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted">Dieser Bildschirm</div>
        <div className="flex justify-center"><QrPicture seed={seed} /></div>
        <p className="flex items-center justify-center gap-1.5 text-xs text-muted"><Loader2 size={12} className="animate-spin" /> Warte auf den Scan vom Handy</p>
      </div>
      <div className="space-y-2 rounded-xl border border-dashed border-line bg-slate-50 p-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted"><Smartphone size={13} /> Handy (Simulation)</div>
        <div className="relative grid h-28 place-items-center rounded-lg bg-slate-800 text-xs text-slate-300">
          <span className="absolute inset-3 rounded border-2 border-dashed border-slate-500" />
          {pages === 0 ? 'Beleg in den Rahmen legen' : `${pages} ${pages === 1 ? 'Seite' : 'Seiten'} aufgenommen`}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setPages((n) => n + 1)} className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border border-line bg-white text-sm font-medium hover:bg-slate-50"><ScanLine size={15} /> {pages === 0 ? 'Aufnehmen' : 'Weitere Seite'}</button>
          <button disabled={pages === 0} onClick={() => onDone(`Scan-${stamp()}.pdf`)} className="inline-flex h-10 flex-1 items-center justify-center rounded-lg bg-brand text-sm font-medium text-white disabled:opacity-40">Fertig, senden</button>
        </div>
      </div>
    </div>
  )
}
