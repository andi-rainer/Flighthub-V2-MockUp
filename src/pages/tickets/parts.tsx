import clsx from 'clsx'
import { ChevronDown, MessageSquare, Search, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { members } from '../../data'
import { useApp } from '../../state'
import { ActionPanel, Button, Drawer, field, Field, Segmented } from '../../ui'
import type { LogEntry } from './data'

export { Field, field }

/** Name of the person who is working, for the history. */
export function useActor() {
  const { persona } = useApp()
  return members.find((m) => m.id === persona.memberId)?.name ?? persona.label
}

export const stamp = (todayIso: string) => `${todayIso} ${new Date().toTimeString().slice(0, 5)}`
export const newLog = (todayIso: string, by: string, text: string, kind: LogEntry['kind'] = 'event'): LogEntry => ({ id: `l-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, at: stamp(todayIso), by, kind, text })
/** "2026-11-07 09:41" → "07.11.2026 09:41" */
export const atText = (at: string) => { const [d, t] = at.split(' '); return `${d.split('-').reverse().join('.')} ${t}` }

export { ActionPanel }

/** History and comments in one list, newest first. Staff can add a comment. */
export function Timeline({ log, onComment, canComment }: { log: LogEntry[]; onComment: (text: string) => void; canComment: boolean }) {
  const [text, setText] = useState('')
  const rows = [...log].sort((a, b) => b.at.localeCompare(a.at))
  const send = () => { if (text.trim()) { onComment(text.trim()); setText('') } }
  return (
    <div className="space-y-4">
      {canComment && (
        <div className="space-y-2">
          <textarea aria-label="Kommentar" rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Kommentar für das Team" className="w-full rounded-lg border border-line bg-surface p-2.5 text-sm outline-none focus:border-brand" />
          <div className="flex justify-end"><Button variant="primary" disabled={!text.trim()} onClick={send}>Kommentar speichern</Button></div>
        </div>
      )}
      <ol className="relative space-y-3 border-l border-line pl-5">
        {rows.map((l) => (
          <li key={l.id} className="relative">
            <span className={clsx('absolute -left-[26px] top-1 grid h-3 w-3 place-items-center rounded-full ring-4 ring-surface', l.kind === 'comment' ? 'bg-brand' : 'bg-slate-300')} />
            <div className="text-xs text-muted">{atText(l.at)} · {l.by}</div>
            {l.kind === 'comment' ? <div className="mt-1 flex gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm"><MessageSquare size={14} className="mt-0.5 shrink-0 text-brand" />{l.text}</div> : <div className="text-sm">{l.text}</div>}
          </li>
        ))}
        {rows.length === 0 && <li className="text-sm text-muted">Noch nichts passiert.</li>}
      </ol>
    </div>
  )
}

/** Several values of a list can be ticked; the button shows how many. */
export function MultiSelect({ label, options, value, onChange }: { label: string; options: { value: string; label: string }[]; value: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v])
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className={clsx(field, 'flex min-w-36 items-center justify-between gap-2', value.length > 0 && 'border-brand text-brand')}>
        <span className="truncate">{value.length === 0 ? label : `${label} · ${value.length}`}</span><ChevronDown size={14} />
      </button>
      {open && (
        <div className="absolute left-0 z-20 mt-1 w-56 rounded-xl border border-line bg-surface p-1 shadow-lg">
          {options.map((o) => <label key={o.value} className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 text-sm hover:bg-slate-50"><input type="checkbox" checked={value.includes(o.value)} onChange={() => toggle(o.value)} />{o.label}</label>)}
          {value.length > 0 && <button onClick={() => onChange([])} className="mt-1 block w-full rounded-lg px-3 py-1.5 text-left text-xs text-muted hover:bg-slate-50">Auswahl aufheben</button>}
        </div>
      )}
    </div>
  )
}

export interface Filters { q: string; status: string[]; type: string; pay: '' | 'paid' | 'open'; from: string; to: string }
export const NO_FILTERS: Filters = { q: '', status: [], type: '', pay: '', from: '', to: '' }
export const isFiltered = (f: Filters) => JSON.stringify(f) !== JSON.stringify(NO_FILTERS)

/** One search field for code, name and e-mail, plus the filters that matter. The date range filters `dateLabel`. */
export function FilterBar({ f, onChange, statuses, types, dateLabel, count }: {
  f: Filters; onChange: (f: Filters) => void; statuses: { value: string; label: string }[]; types: { value: string; label: string }[]; dateLabel: string; count: number
}) {
  const set = (p: Partial<Filters>) => onChange({ ...f, ...p })
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-60 flex-1">
        <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
        <input aria-label="Suchen" value={f.q} onChange={(e) => set({ q: e.target.value })} placeholder="Code, Name oder E-Mail suchen" className={clsx(field, 'w-full pl-8')} />
      </div>
      <MultiSelect label="Status" options={statuses} value={f.status} onChange={(status) => set({ status })} />
      <select aria-label="Art" value={f.type} onChange={(e) => set({ type: e.target.value })} className={clsx(field, f.type && 'border-brand text-brand')}><option value="">Alle Arten</option>{types.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select>
      <select aria-label="Zahlung" value={f.pay} onChange={(e) => set({ pay: e.target.value as Filters['pay'] })} className={clsx(field, f.pay && 'border-brand text-brand')}><option value="">Zahlung: alle</option><option value="paid">Bezahlt</option><option value="open">Offen</option></select>
      <div className="flex items-center gap-1.5 text-sm text-muted">{dateLabel}<input type="date" aria-label={`${dateLabel} von`} value={f.from} onChange={(e) => set({ from: e.target.value })} className={field} />–<input type="date" aria-label={`${dateLabel} bis`} value={f.to} onChange={(e) => set({ to: e.target.value })} className={field} /></div>
      {isFiltered(f) && <button onClick={() => onChange(NO_FILTERS)} className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-sm text-muted hover:text-ink"><X size={14} /> Zurücksetzen</button>}
      <span className="ml-auto text-sm tabular-nums text-muted">{count} Treffer</span>
    </div>
  )
}

/** Downloads rows as a CSV file for Excel (semicolon, UTF-8 with BOM). */
export function downloadCsv(name: string, header: string[], rows: (string | number)[][]) {
  const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
  const text = [header, ...rows].map((r) => r.map(cell).join(';')).join('\n')
  const url = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url; a.download = name; a.click()
  URL.revokeObjectURL(url)
}

/** Does the text appear in one of the values? Case does not matter. */
export const matches = (q: string, ...values: (string | undefined)[]) => !q.trim() || values.some((v) => v?.toLowerCase().includes(q.trim().toLowerCase()))
/** Is the ISO date inside the (open ended) range? */
export const inRange = (iso: string, from: string, to: string) => (!from || iso >= from) && (!to || iso <= to)

/**
 * The detail view of a voucher or ticket: status, ALL actions in one bar (the list only has the one that is usually next), the form of the
 * action that is open, and two tabs: the facts and the history with comments.
 */
export function DetailShell({ title, subtitle, badges, actions, notice, panel, details, log, onComment, canComment, onClose }: {
  title: string; subtitle: string; badges: ReactNode; actions: ReactNode; notice?: string | null; panel: ReactNode; details: ReactNode
  log: LogEntry[]; onComment: (text: string) => void; canComment: boolean; onClose: () => void
}) {
  const [tab, setTab] = useState<'details' | 'verlauf'>('details')
  return (
    <Drawer open title={title} onClose={onClose} size="xl">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2"><span className="text-sm text-muted">{subtitle}</span>{badges}</div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        {notice && <div className="rounded-lg bg-ok-soft px-3 py-2 text-sm text-ok">{notice}</div>}
        {panel}
        <Segmented value={tab} onChange={setTab} options={[{ value: 'details', label: 'Details' }, { value: 'verlauf', label: `Verlauf und Kommentare (${log.length})` }]} />
        {tab === 'details' ? <div className="space-y-4">{details}</div> : <Timeline log={log} onComment={onComment} canComment={canComment} />}
      </div>
    </Drawer>
  )
}

/** The reasons a voucher or booking is extended, moved or cancelled; "Sonstiges" asks for a text. */
export const REASONS = ['Kulanz', 'Schlechtwetter', 'Krankheit', 'Kein passender Termin', 'Sonstiges']
/** Select plus (for "Sonstiges") a text; `reason` is the finished text or empty while it is incomplete. */
export function ReasonField({ onChange }: { onChange: (reason: string) => void }) {
  const [sel, setSel] = useState('')
  const [text, setText] = useState('')
  const out = (s: string, t: string) => onChange(s === 'Sonstiges' ? t.trim() : s)
  return (
    <div className="space-y-2">
      <Field label="Grund"><select aria-label="Grund" value={sel} onChange={(e) => { setSel(e.target.value); out(e.target.value, text) }} className={`${field} w-full`}><option value="">Grund wählen</option>{REASONS.map((r) => <option key={r}>{r}</option>)}</select></Field>
      {sel === 'Sonstiges' && <input aria-label="Grund als Text" value={text} onChange={(e) => { setText(e.target.value); out(sel, e.target.value) }} placeholder="Grund kurz beschreiben" className={`${field} w-full`} />}
    </div>
  )
}
