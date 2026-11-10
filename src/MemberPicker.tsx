import clsx from 'clsx'
import { ChevronDown, Search, X } from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { members, type Member } from './data'
import { useApp } from './state'

export interface MemberPickerProps {
  /** Member id, empty for nobody. */
  value?: string
  onChange: (memberId: string) => void
  /** Who can be chosen at all (a permission, a function, an account ...). Default: every member. */
  allow?: (m: Member) => boolean
  /** Lower comes first: the list starts with the most fitting people. Equal ranks are sorted by name. A typed search puts name matches first. */
  rank?: (m: Member) => number
  /** Says why the list is in this order, shown below the list. */
  rankHint?: string
  /** Extra information on the right of an entry (count, hours, balance ...). */
  info?: (m: Member) => ReactNode
  placeholder?: string
  /** Shows a clear button when a member is chosen (e.g. for filters). */
  clearable?: boolean
  disabled?: boolean
  ariaLabel?: string
  className?: string
}

const initials = (name: string) => name.split(' ').map((p) => p[0]).slice(0, 2).join('')
const PANEL = { width: 320, maxHeight: 340 }

/**
 * THE person choice of the whole app. Type to search by name or function ("pilot", "anna"), arrow keys and Enter work, the list is
 * limited to the members allowed for the task, entries show the functions and a warning for expired documents, `info` adds task specific
 * figures and `rank` sorts the most fitting people first. Used for duties, pilots, accounts, applications ...
 */
export default function MemberPicker({ value, onChange, allow, rank, rankHint, info, placeholder = 'Person wählen', clearable, disabled, ariaLabel, className }: MemberPickerProps) {
  const { functionNames, docsOf } = useApp()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const [box, setBox] = useState<{ left: number; top: number; width: number; up: boolean } | null>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const current = members.find((m) => m.id === value)

  const list = useMemo(() => {
    const tokens = q.toLowerCase().split(/\s+/).filter(Boolean)
    const pool = members.filter((m) => (!allow || allow(m)) && tokens.every((t) => `${m.name} ${functionNames(m.id).join(' ')}`.toLowerCase().includes(t)))
    const starts = (m: Member) => (tokens.length > 0 && m.name.toLowerCase().split(' ').some((w) => tokens.some((t) => w.startsWith(t))) ? 0 : 1)
    return pool.sort((a, b) => starts(a) - starts(b) || (rank ? rank(a) - rank(b) : 0) || a.name.localeCompare(b.name))
  }, [q, allow, rank, functionNames])

  const place = () => {
    const r = trigger.current?.getBoundingClientRect()
    if (!r) return
    const width = Math.max(r.width, PANEL.width)
    const up = window.innerHeight - r.bottom < PANEL.maxHeight + 16 && r.top > window.innerHeight - r.bottom
    setBox({ left: Math.min(r.left, window.innerWidth - width - 8), top: up ? r.top - 4 : r.bottom + 4, width, up })
  }
  useLayoutEffect(() => { if (open) place() }, [open])
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (!panel.current?.contains(e.target as Node) && !trigger.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => { document.removeEventListener('mousedown', close); window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
  }, [open])
  useEffect(() => setActive(0), [q, open])

  const choose = (id: string) => { onChange(id); setOpen(false); setQ(''); trigger.current?.focus() }
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(list.length - 1, i + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(0, i - 1)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (list[active]) choose(list[active].id) }
    else if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); trigger.current?.focus() }
  }

  return (
    <>
      <span className={clsx('relative flex min-w-0', className)}>
        <button ref={trigger} type="button" aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open} disabled={disabled} onClick={() => setOpen((o) => !o)}
          className={clsx('flex h-10 w-full min-w-0 items-center gap-2 rounded-lg border bg-surface px-2 text-left text-sm outline-none transition focus:border-brand disabled:bg-slate-50', open ? 'border-brand' : 'border-line')}>
          {current ? <><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-soft text-[10px] font-semibold text-brand">{initials(current.name)}</span><span className="min-w-0 flex-1 truncate">{current.name}</span></>
            : <span className="min-w-0 flex-1 truncate text-muted">{placeholder}</span>}
          {!disabled && <ChevronDown size={14} className="shrink-0 text-muted" />}
        </button>
        {clearable && current && !disabled && <button type="button" aria-label="Auswahl entfernen" onClick={() => onChange('')} className="absolute right-7 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md text-muted hover:bg-slate-100"><X size={13} /></button>}
      </span>
      {open && box && createPortal(
        <div ref={panel} role="listbox" style={{ position: 'fixed', left: box.left, width: box.width, ...(box.up ? { bottom: window.innerHeight - box.top } : { top: box.top }), maxHeight: PANEL.maxHeight }} className="z-[60] flex flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-xl">
          <div className="relative border-b border-line">
            <Search size={14} className="absolute left-3 top-3 text-muted" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} placeholder="Name oder Funktion suchen" className="h-10 w-full bg-transparent pl-8 pr-3 text-sm outline-none" />
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto p-1">
            {list.map((m, i) => {
              const fns = functionNames(m.id)
              const expired = docsOf(m.id).some((d) => d.state === 'abgelaufen')
              return (
                <li key={m.id} role="option" aria-selected={m.id === value}>
                  <button type="button" onMouseEnter={() => setActive(i)} onClick={() => choose(m.id)} className={clsx('flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left', i === active ? 'bg-slate-100' : '', m.id === value && 'font-medium')}>
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-semibold text-brand">{initials(m.name)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{m.name}</span>
                      <span className="block truncate text-xs text-muted">{fns.length > 0 ? fns.join(' · ') : 'Mitglied'}{expired && <span className="ml-1.5 font-medium text-bad">· Dokument abgelaufen</span>}</span>
                    </span>
                    {info && <span className="shrink-0 text-xs tabular-nums text-muted">{info(m)}</span>}
                  </button>
                </li>
              )
            })}
            {list.length === 0 && <li className="px-3 py-4 text-center text-sm text-muted">Niemand gefunden.</li>}
          </ul>
          {rankHint && !q && list.length > 1 && <div className="border-t border-line px-3 py-1.5 text-[11px] text-muted">{rankHint}</div>}
        </div>,
        document.body,
      )}
    </>
  )
}
