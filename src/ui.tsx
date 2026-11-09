import clsx from 'clsx'
import { ChevronLeft, ChevronRight, MoreHorizontal, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">{actions}</div>
    </div>
  )
}

type BtnProps = {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'md' | 'lg'
  className?: string
  disabled?: boolean
}
export function Button({ children, onClick, variant = 'secondary', size = 'md', className, disabled }: BtnProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition active:scale-[0.98] disabled:opacity-40',
        size === 'md' ? 'h-9 px-3 text-sm' : 'h-12 px-5 text-base',
        variant === 'primary' && 'bg-brand text-white hover:bg-blue-700',
        variant === 'secondary' && 'border border-line bg-surface hover:bg-slate-50',
        variant === 'ghost' && 'hover:bg-slate-100',
        variant === 'danger' && 'border border-bad/30 bg-bad-soft text-bad hover:bg-red-100',
        className,
      )}
    >
      {children}
    </button>
  )
}

const tones = {
  ok: 'bg-ok-soft text-ok',
  warn: 'bg-warn-soft text-warn',
  bad: 'bg-bad-soft text-bad',
  info: 'bg-brand-soft text-brand',
  neutral: 'bg-slate-100 text-slate-600',
}
export function Badge({ tone = 'neutral', children }: { tone?: keyof typeof tones; children: ReactNode }) {
  return <span className={clsx('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', tones[tone])}>{children}</span>
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx('rounded-xl border border-line bg-surface', className)}>{children}</div>
}

export function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'ok' | 'bad' }) {
  return (
    <Card className="p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className={clsx('mt-1 text-2xl font-semibold tabular-nums', tone === 'ok' && 'text-ok', tone === 'bad' && 'text-bad')}>{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </Card>
  )
}

/**
 * THE row-action pattern used everywhere:
 *  - clicking the row opens the detail (all editing lives there)
 *  - at most ONE visible primary action per row
 *  - everything else lives in the "..." menu, always in the same place (right edge)
 */
export type RowAction = { label: string; onSelect: () => void; danger?: boolean }
export function RowMenu({ actions }: { actions: RowAction[] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])
  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button aria-label="Weitere Aktionen" onClick={() => setOpen((o) => !o)} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-slate-100">
        <MoreHorizontal size={18} />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-52 rounded-xl border border-line bg-surface p-1 shadow-lg">
          {actions.map((a) => (
            <button
              key={a.label}
              onClick={() => { setOpen(false); a.onSelect() }}
              className={clsx('block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50', a.danger && 'text-bad')}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function Drawer({ open, title, onClose, children, footer, size = 'md' }: { open: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; size?: 'md' | 'xl' }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/30" onClick={onClose}>
      <div className={clsx('flex h-full w-full flex-col bg-surface shadow-2xl', size === 'xl' ? 'max-w-3xl' : 'max-w-md')} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Schließen" className="grid h-9 w-9 place-items-center rounded-lg hover:bg-slate-100"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <div className="border-t border-line p-4">{footer}</div>}
      </div>
    </div>
  )
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="inline-flex rounded-lg bg-slate-100 p-1">
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)} className={clsx('rounded-md px-3 py-1.5 text-sm font-medium', value === o.value ? 'bg-surface shadow-sm' : 'text-muted')}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Switch({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={(e) => { e.stopPropagation(); onChange(!checked) }}
      className={clsx('relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-40', checked ? 'bg-brand' : 'bg-slate-300')}
    >
      <span className={clsx('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', checked ? 'left-[22px]' : 'left-0.5')} />
    </button>
  )
}

export function Banner({ tone = 'info', children }: { tone?: 'info' | 'warn'; children: ReactNode }) {
  return <div className={clsx('rounded-xl px-4 py-3 text-sm', tone === 'info' ? 'bg-brand-soft text-blue-900' : 'bg-warn-soft text-amber-900')}>{children}</div>
}

/** Footer for every long list: "1-25 of 93", rows per page and previous/next. The caller slices its own rows. */
export function Pagination({ page, pageSize, total, onPage, onPageSize, sizes = [25, 50, 100] }: {
  page: number; pageSize: number; total: number; onPage: (p: number) => void; onPageSize: (n: number) => void; sizes?: number[]
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const current = Math.min(page, pages)
  const from = total === 0 ? 0 : (current - 1) * pageSize + 1
  const to = Math.min(current * pageSize, total)
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-2.5 text-sm text-muted">
      <div className="flex items-center gap-3">
        <span className="tabular-nums">{from}–{to} von {total}</span>
        <label className="flex items-center gap-1.5 text-xs">Zeilen<select value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))} className="h-8 rounded-lg border border-line bg-surface px-2 text-sm text-ink">{sizes.map((n) => <option key={n}>{n}</option>)}</select></label>
      </div>
      <div className="flex items-center gap-2">
        <Button onClick={() => onPage(current - 1)} disabled={current <= 1}><ChevronLeft size={16} /> Zurück</Button>
        <span className="tabular-nums">Seite {current} / {pages}</span>
        <Button onClick={() => onPage(current + 1)} disabled={current >= pages}>Weiter <ChevronRight size={16} /></Button>
      </div>
    </div>
  )
}

/**
 * Slices a list for the current page and hands back the footer. `resetKey` changes whenever filters or search change,
 * which jumps back to page 1. Use `start` when a row needs its index in the full list.
 */
export function usePaging<T>(rows: T[], resetKey: string, sizes: number[] = [25, 50, 100]) {
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(sizes[0])
  const [key, setKey] = useState(resetKey)
  if (key !== resetKey) { setKey(resetKey); setPage(1) }
  const pages = Math.max(1, Math.ceil(rows.length / size))
  const current = Math.min(page, pages)
  const start = (current - 1) * size
  return {
    rows: rows.slice(start, start + size), start,
    bar: <Pagination page={current} pageSize={size} total={rows.length} sizes={sizes} onPage={setPage} onPageSize={(n) => { setSize(n); setPage(1) }} />,
  }
}

/** The FlightHub logo (the V1 app icon). The picture has a white margin around the rounded square, which is cropped away here. */
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <span className="block shrink-0 overflow-hidden" style={{ width: size, height: size, borderRadius: size * 0.23 }} aria-label="FlightHub">
      <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" style={{ width: '116.5%', maxWidth: 'none', marginLeft: '-8.2%', marginTop: '-8.2%' }} />
    </span>
  )
}
