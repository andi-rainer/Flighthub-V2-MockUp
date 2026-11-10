import clsx from 'clsx'
import { ChevronLeft, ChevronRight, Plane, Plus } from 'lucide-react'
import { useState, type MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { dayIso, dayShort, fmtAbs, hmOf, toAbs } from '../dates'
import { aircraft, members } from '../data'
import { TODAY_ISO, useApp, type Reservation } from '../state'
import { groundedReason } from './aircraft/data'
import { Banner, Button, Drawer, PageHeader } from '../ui'
import { flightKey, flightPath } from './FlightPage'

const START = 6, END = 22 // visible hours per day, the night is hidden (as in V1)
const RANGE = END - START
const PAGE = 7 // days per page
const NOW = 13 // the dummy's "now" on day 0
const LABEL_W = 'w-[88px] md:w-[132px]'
const ACTIVE_TOP = 4, ACTIVE_H = 38, STANDBY_H = 20, STANDBY_GAP = 3
const STANDBY_TOP = ACTIVE_TOP + ACTIVE_H + 4
const pct = (h: number) => ((Math.min(END, Math.max(START, h)) - START) / RANGE) * 100
const fmtH = (h: number) => hmOf(h)

interface Form { id?: number; aircraft: string; fromDate: string; fromTime: string; toDate: string; toTime: string }

/**
 * V1 layout: the days are stacked below each other, every day shows one lane per aircraft over the same time axis.
 * A reservation can span days (arrows at the cut edges), one person can hold several, a clash puts the newer one on
 * standby (stacked under the active block). Click an empty lane to reserve at that time; your own block opens the
 * flight page ("Flug beginnen"); the pencil edits it.
 * Requirement for the real build (not in this dummy): move reservations by drag and drop, drag the edges to resize.
 */
export default function Reservations() {
  const nav = useNavigate()
  const { persona, can, reservations: res, setReservations: setRes, afps, afpConfig, modules, aircraftData } = useApp()
  const me = members.find((m) => m.id === persona.memberId)!
  const [offset, setOffset] = useState(0)
  const [count, setCount] = useState(PAGE)
  const [form, setForm] = useState<Form | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [note, setNote] = useState<{ text: string; resId?: number } | null>(null)
  const mayFly = can('afp.create')
  const days = Array.from({ length: count }, (_, i) => offset + i)

  const openNew = (reg = 'OE-DZA', day = offset, startH = 17.5) => {
    setErr(null)
    setForm({ aircraft: reg, fromDate: dayIso(day), fromTime: hmOf(day * 24 + startH), toDate: dayIso(day), toTime: hmOf(day * 24 + Math.min(startH + 1.5, 23.75)) })
  }
  const openEdit = (r: Reservation) => { setErr(null); setForm({ id: r.id, aircraft: r.aircraft, fromDate: dayIso(Math.floor(r.from / 24)), fromTime: hmOf(r.from), toDate: dayIso(Math.floor(r.to / 24)), toTime: hmOf(r.to) }) }

  const clickLane = (e: MouseEvent<HTMLDivElement>, reg: string, day: number) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const h = START + ((e.clientX - rect.left) / rect.width) * RANGE
    const snapped = Math.round(h * 4) / 4
    if (day === 0 && snapped < NOW - 2) return setNote({ text: 'Der Beginn darf höchstens 2 Stunden zurückliegen.' })
    openNew(reg, day, snapped)
  }

  const save = () => {
    if (!form) return
    const from = toAbs(form.fromDate, form.fromTime), to = toAbs(form.toDate, form.toTime)
    if (to <= from) return setErr('Das Ende muss nach dem Beginn liegen.')
    setErr(null)
    const clash = res.find((r) => r.id !== form.id && r.aircraft === form.aircraft && !r.standby && r.from < to && r.to > from)
    const id = form.id ?? Date.now()
    const next: Reservation = { id, aircraft: form.aircraft, from, to, who: me.name, memberId: me.id, label: me.name, standby: !!clash }
    setRes(form.id ? res.map((r) => (r.id === form.id ? { ...r, ...next } : r)) : [...res, next])
    const mineSameDay = res.filter((r) => r.memberId === me.id && r.id !== form.id && Math.floor(r.from / 24) === Math.floor(from / 24)).length
    setNote({
      text: clash ? `Kollision mit „${clash.label}“. Du stehst auf Standby und rückst nach, wenn die Reservierung entfällt. Du bekommst eine Mail.`
        : form.id ? 'Reservierung geändert.' : mineSameDay > 0 ? `Reserviert. Das ist deine ${mineSameDay + 1}. Reservierung an diesem Tag.` : 'Reserviert.',
      resId: clash || form.id ? undefined : id,
    })
    setForm(null)
  }
  const remove = () => { if (form?.id) { setRes(res.filter((r) => r.id !== form.id)); setNote({ text: 'Reservierung gelöscht.' }); setForm(null) } }

  const hourTicks = Array.from({ length: RANGE + 1 }, (_, i) => START + i)

  const block = (r: Reservation, day: number, top: number, height: number, queue?: number) => {
    const s = r.from - day * 24, e = r.to - day * 24
    const left = pct(s), width = pct(e) - left
    if (width <= 0) return null
    const mine = r.memberId === me.id
    const done = afps[flightKey({ kind: 'res', resId: r.id })]
    const editable = !r.priority && (mine || can('reservations.manage.any'))
    const label = `${s < 0 ? '← ' : ''}${fmtH(Math.max(s, 0))}–${e > 24 ? '24:00' : fmtH(e)}${e > 24 ? ' →' : ''}`
    const canFly = mine && !r.standby && mayFly && afpConfig.enabled
    const state = done ? (done.status === 'Gelandet' ? 'beendet' : 'läuft') : 'Flug beginnen'
    return (
      <div key={r.id} title={`${fmtAbs(r.from)} bis ${fmtAbs(r.to)}${editable ? ' · klicken zum Bearbeiten' : ''}`}
        role={editable ? 'button' : undefined} aria-label={editable ? `Reservierung bearbeiten: ${r.label}` : undefined}
        onClick={(ev) => { ev.stopPropagation(); if (editable) openEdit(r) }}
        className={clsx('absolute flex justify-between gap-1 overflow-hidden rounded-sm px-2 text-left',
          editable && 'cursor-pointer hover:shadow-md',
          r.standby ? 'items-center border border-dashed border-warn bg-surface text-warn' : r.priority ? 'border-l-[3px] border-brand bg-brand-soft text-brand' : mine ? 'border-l-[3px] border-ok bg-ok-soft text-ok' : 'border-l-[3px] border-slate-400 bg-slate-100 text-ink')}
        style={{ left: `calc(${left}% + 2px)`, width: `calc(${width}% - 4px)`, top, height }}>
        {r.standby ? (
          <span className="flex min-w-0 flex-1 items-center gap-2 text-[11px] font-medium"><span className="font-mono text-[10px] font-semibold">#{queue}</span><span className="truncate">{r.label}</span><span className="ml-auto shrink-0 font-mono text-[9px] text-muted">{label}</span></span>
        ) : (
          <>
            <div className="min-w-0 flex-1 py-1">
              <div className="truncate font-mono text-[9px] tracking-wider opacity-80">{label}</div>
              <div className="truncate text-[12px] font-medium leading-tight">{r.label}</div>
            </div>
            {canFly && <button aria-label={state} title={state} className="my-1 flex shrink-0 items-center gap-1 self-center rounded-md bg-ok px-1.5 py-1 text-[11px] font-semibold text-white hover:bg-green-800" onClick={(ev) => { ev.stopPropagation(); nav(flightPath({ kind: 'res', resId: r.id })) }}><Plane size={12} /><span className="hidden xl:inline">{state}</span></button>}
          </>
        )}
      </div>
    )
  }

  return (
    <>
      <PageHeader title="Reservierungen" actions={<Button variant="primary" onClick={() => openNew()}><Plus size={16} /> Reservieren</Button>} />
      <div className="mb-3 flex items-center gap-2">
        <Button onClick={() => setOffset(Math.max(0, offset - PAGE))} disabled={offset === 0}><ChevronLeft size={16} /></Button>
        <Button onClick={() => { setOffset(0); setCount(PAGE) }}>Heute</Button>
        <Button onClick={() => setOffset(offset + PAGE)}><ChevronRight size={16} /></Button>
        <span className="ml-2 text-sm text-muted">{dayShort(offset)} bis {dayShort(offset + count - 1)}</span>
      </div>
      {note && <div className="mb-3"><Banner><span className="flex flex-wrap items-center justify-between gap-3"><span>{note.text}</span>{note.resId && mayFly && afpConfig.enabled && <Button variant="primary" onClick={() => nav(flightPath({ kind: 'res', resId: note.resId! }))}>Flug beginnen</Button>}</span></Banner></div>}

      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        {days.map((d) => {
          const today = d === 0
          const dayRes = res.filter((r) => (modules.skydive || !r.priority) && r.from < (d + 1) * 24 && r.to > d * 24)
          const active = dayRes.filter((r) => !r.standby).length, standby = dayRes.filter((r) => r.standby).length
          return (
            <section key={d}>
              <header className="border-y border-line bg-slate-50 first:border-t-0">
                <div className="flex items-center justify-between px-4 py-2">
                  <div className="flex items-baseline gap-3">
                    <span className="text-[17px] font-medium leading-none">{dayShort(d)}</span>
                    {today && <span className="rounded-sm bg-brand px-1.5 py-0.5 text-[9px] font-semibold tracking-widest text-white">HEUTE</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[10px] tracking-widest text-muted">{active} RES.{standby > 0 && ` · ${standby} STANDBY`}</span>
                    <button onClick={() => openNew('OE-DZA', d, d === 0 ? Math.max(START, NOW) : 9)} className="flex items-center gap-1 rounded-sm border border-brand/40 px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-brand hover:border-brand hover:bg-brand-soft"><Plus size={12} />Neu</button>
                  </div>
                </div>
                <div className="flex border-t border-line/60">
                  <div className={clsx(LABEL_W, 'shrink-0 border-r border-line/60 px-2 py-1 md:px-4')}><div className="text-[9px] font-semibold uppercase tracking-[0.2em] text-muted md:text-[10px]">Flugzeug</div></div>
                  <div className="relative h-7 flex-1">
                    {hourTicks.map((h) => (
                      <div key={h} className={clsx('absolute top-2 font-mono text-[10px] tracking-widest text-muted', h !== START && h !== END && h % 2 !== 0 && 'hidden md:block')} style={{ left: `${pct(h)}%`, transform: h === END ? 'translateX(-100%)' : h === START ? 'none' : 'translateX(-50%)' }}>{String(h).padStart(2, '0')}</div>
                    ))}
                    {today && <><div className="absolute bottom-0 top-0 w-px bg-brand" style={{ left: `${pct(NOW)}%` }} /><div className="absolute top-1 -translate-x-1/2 rounded-sm bg-brand px-1.5 py-0.5 font-mono text-[9px] tracking-widest text-white" style={{ left: `${pct(NOW)}%` }}>JETZT · {fmtH(NOW)}</div></>}
                  </div>
                </div>
              </header>

              {aircraft.map((a) => {
                const lane = dayRes.filter((r) => r.aircraft === a.reg)
                const standbys = lane.filter((r) => r.standby).sort((x, y) => x.id - y.id)
                const reason = groundedReason(a.status, aircraftData[a.id], TODAY_ISO)
                const away = reason !== null
                const height = away ? 30 : standbys.length === 0 ? ACTIVE_TOP + ACTIVE_H + 10 : STANDBY_TOP + standbys.length * (STANDBY_H + STANDBY_GAP) + 8
                return (
                  <div key={a.id} className="flex border-b border-line/50 last:border-b-0" style={{ height }}>
                    <div className={clsx(LABEL_W, 'flex shrink-0 flex-col justify-center border-r border-line/60 bg-slate-50 px-2 md:px-4', away ? 'py-0' : 'py-1.5')}>
                      <div className="truncate font-mono text-[10px] font-medium tracking-wider md:text-[12px]">{a.reg}</div>
                      {!away && <div className="mt-0.5 truncate text-[9px] leading-tight text-muted md:text-[10px]">{a.uses.join(', ')}</div>}
                    </div>
                    <div role="button" aria-label={`Reservieren ${a.reg} ${dayShort(d)}`} onClick={(e) => !away && clickLane(e, a.reg, d)}
                      className={clsx('relative flex-1', away ? 'cursor-not-allowed' : 'cursor-cell hover:bg-slate-50/70')}>
                      {hourTicks.map((h) => <div key={h} className="pointer-events-none absolute bottom-0 top-0 w-px bg-slate-900/[0.05]" style={{ left: `${pct(h)}%` }} />)}
                      {today && <div className="pointer-events-none absolute bottom-0 top-0 w-px bg-brand/50" style={{ left: `${pct(NOW)}%` }} />}
                      {away && <div className="absolute inset-0 grid place-items-center bg-warn-soft text-[11px] text-warn">{a.status === 'wartung' ? 'in Wartung bis 24.11.' : `${reason}, keine Reservierung möglich`}</div>}
                      {lane.filter((r) => !r.standby).map((r) => block(r, d, ACTIVE_TOP, ACTIVE_H))}
                      {standbys.map((r, i) => block(r, d, STANDBY_TOP + i * (STANDBY_H + STANDBY_GAP), STANDBY_H, i + 1))}
                    </div>
                  </div>
                )
              })}
            </section>
          )
        })}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3 text-xs text-muted">{modules.skydive && <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded-sm border-l-[3px] border-brand bg-brand-soft" />Sprungtag (hat Vorrang)</span>}<span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded-sm border-l-[3px] border-ok bg-ok-soft" />deine Reservierung (Flugzeug-Symbol: Flug beginnen)</span><span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded-sm border border-dashed border-warn" />Standby</span></div>
        <Button onClick={() => setCount(count + PAGE)}>Weitere {PAGE} Tage</Button>
      </div>

      <DrawerForm form={form} setForm={setForm} err={err} save={save} remove={remove} />
    </>
  )
}


function DrawerForm({ form, setForm, err, save, remove }: { form: Form | null; setForm: (f: Form | null) => void; err: string | null; save: () => void; remove: () => void }) {
  const { aircraftData } = useApp()
  return (
    <Drawer open={!!form} title={form?.id ? 'Reservierung bearbeiten' : 'Flugzeug reservieren'} onClose={() => setForm(null)}
      footer={form && <div className="flex gap-2"><Button variant="primary" size="lg" className="flex-1" onClick={save}>{form.id ? 'Speichern' : 'Reservieren'}</Button>{form.id && <Button variant="danger" size="lg" onClick={remove}>Löschen</Button>}</div>}>
      {form && (
        <div className="space-y-4 text-sm">
          <label className="block font-medium">Flugzeug<select value={form.aircraft} onChange={(e) => setForm({ ...form, aircraft: e.target.value })} className="mt-1 h-11 w-full rounded-lg border border-line px-3">{aircraft.filter((a) => groundedReason(a.status, aircraftData[a.id], TODAY_ISO) === null || a.reg === form.aircraft).map((a) => <option key={a.id}>{a.reg}</option>)}</select></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block font-medium">Von (Datum)<input type="date" value={form.fromDate} onChange={(e) => setForm({ ...form, fromDate: e.target.value, toDate: form.toDate < e.target.value ? e.target.value : form.toDate })} className="mt-1 h-11 w-full rounded-lg border border-line px-3" /></label>
            <label className="block font-medium">Uhrzeit<input type="time" value={form.fromTime} onChange={(e) => setForm({ ...form, fromTime: e.target.value })} className="mt-1 h-11 w-full rounded-lg border border-line px-3" /></label>
            <label className="block font-medium">Bis (Datum)<input type="date" value={form.toDate} onChange={(e) => setForm({ ...form, toDate: e.target.value })} className="mt-1 h-11 w-full rounded-lg border border-line px-3" /></label>
            <label className="block font-medium">Uhrzeit<input type="time" value={form.toTime} onChange={(e) => setForm({ ...form, toTime: e.target.value })} className="mt-1 h-11 w-full rounded-lg border border-line px-3" /></label>
          </div>
          {err && <p className="rounded-lg bg-bad-soft px-3 py-2 text-bad">{err}</p>}
          <p className="text-xs text-muted">Du kannst mehrere Reservierungen haben, auch am selben Tag und über mehrere Tage. Überschneidet sich ein Zeitraum mit einer anderen Reservierung, kommst du auf Standby und rückst automatisch nach. 60 Minuten vor Beginn erinnert dich eine Mail.</p>
        </div>
      )}
    </Drawer>
  )
}
