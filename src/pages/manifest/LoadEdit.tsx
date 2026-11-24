import clsx from 'clsx'
import { ArrowRightLeft, RotateCcw, UserMinus } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import MemberPicker from '../../MemberPicker'
import { eur, members, type Jumper } from '../../data'
import { useSession } from '../../session/session'
import { flightNo, sportJumper, TODAY_ISO, useApp, type Load } from '../../state'
import { Button, Drawer, useConfirm } from '../../ui'
import { flightText } from '../finance/cashDocs'
import { useActor } from '../tickets/parts'
import { capacityOf, dmy, sportPriceOn, type ManifestDay } from './data'
import { useSettle } from './Settle'
import { nowHm } from './settleStore'
import { slots } from './slots'

/**
 * [Entwurf] "Load bearbeiten": a landed flight changed in an emergency, on the day page (flight card, person panel, check-out sheet) and in
 * "Tag abschließen". A sport jumper who was not on it is swapped against the one who really was ("Tauschen gegen …") or taken out; someone
 * missing is added. One confirmation with a clear summary; who was already settled for the flight gets the seat back as a difference
 * booking (vorläufig like every booking of the day). Every change is logged on the flight.
 */
type Op = { kind: 'raus' } | { kind: 'tausch'; to: string }

export function LoadEditSheet({ day, load: l, focus, onClose, onDone }: { day: ManifestDay; load: Load; /** Member id to start with (the person whose settlement showed the flight). */ focus?: string; onClose: () => void; onDone?: () => void }) {
  const { loads, setLoads, weights, settings, checkedIn, memberCan } = useApp()
  const { guarded } = useSession()
  const settle = useSettle(day)
  const actor = useActor()
  const confirm = useConfirm()
  const [ops, setOps] = useState<Record<string, Op>>({})
  const [picking, setPicking] = useState<string | null>(null)
  const [adds, setAdds] = useState<string[]>([])
  const no = flightNo(loads, l), price = sportPriceOn(settings, day.date), cap = capacityOf(day.aircraft)
  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? id
  const sport = l.jumpers.filter((j) => j.kind === 'sport' && j.memberId)
  const settledFor = (memberId: string) => settle.done.find((s) => s.memberId === memberId && s.loadIds.includes(l.id))
  const incoming = [...Object.values(ops).flatMap((o) => (o.kind === 'tausch' ? [o.to] : [])), ...adds]
  const taken = new Set([...l.jumpers.map((j) => j.memberId).filter(Boolean) as string[], ...incoming])
  const free = cap - slots(l.jumpers) + Object.values(ops).filter((o) => o.kind === 'raus').length - adds.length
  const pick = (allowFor?: string) => (
    <MemberPicker ariaLabel={allowFor ? `Tauschen gegen (statt ${nameOf(allowFor)})` : `Auf Flug ${no} nachtragen`} className="w-full" value="" placeholder={allowFor ? 'Tauschen gegen …' : 'Nachtragen …'}
      onChange={(id) => { if (!id) return; if (allowFor) { setOps((o) => ({ ...o, [allowFor]: { kind: 'tausch', to: id } })); setPicking(null) } else setAdds((a) => [...a, id]) }}
      allow={(m) => memberCan(m.id, 'manifest.jumps.sport') && !taken.has(m.id)}
      rank={(m) => (checkedIn.includes(m.id) ? 0 : 1)} rankHint="Am Platz zuerst" info={(m) => (checkedIn.includes(m.id) ? 'am Platz' : undefined)} />
  )

  // ---------- What happens, in plain words ----------
  const outs = sport.filter((j) => ops[j.memberId!])
  const headline = `Flug ${no}: ${[...outs.map((j) => `${j.name} raus`), ...incoming.map((id) => `${nameOf(id)} rein`)].join(', ')}`
  const effects = [
    ...outs.map((j) => {
      const st = settledFor(j.memberId!)
      return st ? `${j.name} war schon abgerechnet: ${eur(st.loadIds.length ? st.price / st.loadIds.length : price)} zurück aufs Konto` : `${j.name} wird für Flug ${no} nicht verrechnet`
    }),
    ...incoming.map((id) => `${nameOf(id)} wird 1 Sprung mehr verrechnet (${eur(price)})`),
  ]
  const changed = outs.length + incoming.length > 0

  const apply = () => guarded('manifest.jumpers.remove', () => {
    const at = nowHm()
    const swapIn = (j: Jumper): Jumper[] => {
      const op = ops[j.memberId ?? '']
      if (!op) return [j]
      if (op.kind === 'raus') return []
      const m = members.find((x) => x.id === op.to)
      return m ? [sportJumper(m, weights[m.id], price)] : []
    }
    const added = adds.map((id) => members.find((m) => m.id === id)).filter((m): m is NonNullable<typeof m> => !!m).map((m) => sportJumper(m, weights[m.id], price))
    const nextJumpers = [...l.jumpers.flatMap(swapIn), ...added]
    setLoads((ls) => ls.map((x) => (x.id === l.id ? { ...x, jumpers: nextJumpers, log: [...(x.log ?? []), { at: TODAY_ISO, time: at, by: actor, text: headline.replace(`Flug ${no}: `, '') }] } : x)))
    // Already settled for this flight: the seat goes back as a difference booking; the flights left keep their text.
    outs.forEach((j) => {
      const st = settledFor(j.memberId!)
      if (!st) return
      const rest = loads.filter((x) => st.loadIds.includes(x.id) && x.id !== l.id)
      const sid = `s-${st.memberId}`
      const jumped = rest.filter((x) => x.jumpers.some((y) => y.id === sid && !y.noShow)).map((x) => flightNo(loads, x))
      const seats = rest.filter((x) => x.jumpers.some((y) => y.id === sid && y.noShow)).map((x) => flightNo(loads, x))
      settle.uncover(st, l.id, no, !!j.noShow, flightText(jumped, seats))
    })
    onDone?.()
    onClose()
  })
  const go = () => confirm.ask({ title: `Flug ${no} ändern?`, confirm: 'Ja, ändern', lines: [<b className="font-semibold">{headline}</b>, ...effects], run: apply })

  return (
    <Drawer open title={`Flug ${no} bearbeiten · ${l.time}`} onClose={onClose}
      footer={<div className="flex gap-2"><Button size="lg" className="flex-1" onClick={onClose}>Abbrechen</Button><Button size="lg" variant="primary" className="flex-[2]" disabled={!changed} onClick={go}>Änderung buchen</Button></div>}>
      <div className="space-y-5">
        <section className="space-y-2">
          {[...sport].sort((a, b) => (a.memberId === focus ? -1 : b.memberId === focus ? 1 : 0)).map((j) => {
            const id = j.memberId!, op = ops[id], st = settledFor(id)
            return (
              <div key={j.id} className={clsx('rounded-xl border px-3 py-2', id === focus ? 'border-brand/40 bg-brand-soft/30' : 'border-line')}>
                <div className="flex min-h-11 items-center gap-2">
                  <span className="min-w-0 flex-1">
                    <span className={clsx('block truncate text-base', op && 'text-muted line-through')}>{j.name}</span>
                    <span className="block truncate text-sm text-muted">{[j.noShow ? 'Platz bezahlt' : '1 Sprung', st ? `abgerechnet ${st.time}` : 'offen'].join(' · ')}</span>
                  </span>
                  {op ? <>
                    {op.kind === 'tausch' && <span className="truncate text-base font-medium text-brand">→ {nameOf(op.to)}</span>}
                    <Small onClick={() => setOps(({ [id]: _gone, ...rest }) => rest)}><RotateCcw size={15} /> Zurück</Small>
                  </> : <>
                    <Small onClick={() => setPicking(picking === id ? null : id)}><ArrowRightLeft size={15} /> Tauschen</Small>
                    <Small onClick={() => setOps((o) => ({ ...o, [id]: { kind: 'raus' } }))}><UserMinus size={15} /> Raus</Small>
                  </>}
                </div>
                {picking === id && !op && <div className="pb-1 pt-2">{pick(id)}</div>}
              </div>
            )
          })}
          {l.jumpers.filter((j) => j.kind === 'tandem').map((j) => <div key={j.id} className="flex min-h-11 items-center rounded-xl bg-slate-50 px-3 text-base text-muted">{j.name.replace(/^Tandem: /, 'Tandem: ')}</div>)}
          {adds.map((id) => (
            <div key={id} className="flex min-h-11 items-center gap-2 rounded-xl border border-ok/40 bg-ok-soft/40 px-3">
              <span className="min-w-0 flex-1 truncate text-base font-medium">+ {nameOf(id)}</span>
              <Small onClick={() => setAdds((a) => a.filter((x) => x !== id))}><RotateCcw size={15} /> Zurück</Small>
            </div>
          ))}
        </section>
        {free > 0 && <section>{pick()}</section>}
        {changed && (
          <div className="rounded-xl border border-brand/30 bg-brand-soft/40 px-4 py-3 text-sm">
            <div className="mb-1 font-medium text-brand">{headline}</div>
            <ul className="space-y-0.5">{effects.map((e) => <li key={e}>{e}</li>)}</ul>
          </div>
        )}
        {(l.log?.length ?? 0) > 0 && (
          <section>
            <div className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted">Verlauf</div>
            <ul className="divide-y divide-line rounded-xl border border-line text-sm">
              {l.log!.map((e, i) => <li key={i} className="px-3 py-1.5"><span className="text-muted">{dmy(e.at).slice(0, 6)} {e.time} · {e.by}:</span> {e.text}</li>)}
            </ul>
          </section>
        )}
      </div>
      {confirm.dialog}
    </Drawer>
  )
}

function Small({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return <button onClick={onClick} className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-sm font-medium hover:bg-slate-50">{children}</button>
}

/** [Entwurf] The discreet entry point on a landed flight: "Load bearbeiten". */
export function LoadEditLink({ day, load, focus, label = 'Load bearbeiten', onDone, className }: { day: ManifestDay; load: Load; focus?: string; label?: string; onDone?: () => void; className?: string }) {
  const { can } = useApp()
  const [open, setOpen] = useState(false)
  if (!can('manifest.jumpers.remove') || load.status !== 'gelandet' || day.status === 'abgeschlossen' || day.status === 'abgesagt') return null
  return (
    <>
      <button onClick={() => setOpen(true)} className={clsx('inline-flex min-h-9 items-center text-xs font-medium text-muted underline-offset-2 hover:text-brand hover:underline', className)}>{label}</button>
      {open && <LoadEditSheet day={day} load={load} focus={focus} onClose={() => setOpen(false)} onDone={onDone} />}
    </>
  )
}
