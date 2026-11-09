import clsx from 'clsx'
import { ArrowLeft, Plus, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { eur, members } from '../../data'
import { useApp } from '../../state'
import { Badge, Button, Card, Segmented, Switch, usePaging } from '../../ui'
import DirectAssign from './DirectAssign'
import { MONTHS, describe, durationText, endDate, fmtDate, newPattern, parseDate, schedule, type FeePattern, type MembershipType, type Model, type Prorata, type Unit } from './data'

const inp = 'h-10 rounded-lg border border-line bg-surface px-3 text-sm outline-none focus:border-brand'
type Sub = 'arten' | 'muster'
const JOIN_SAMPLE = new Date(2026, 5, 1) // the dummy has no admission dates: every member joined on 01.06.2026
const TODAY = new Date(2026, 10, 7)

/**
 * The list of Mitgliedschaften is the page: name, amount, what it means. HOW a fee is billed (Beitragsmuster) is a reusable rule
 * a Mitgliedschaft points to; it is managed one click away and always opened from the Mitgliedschaft that uses it.
 */
export default function Setup() {
  const { types, patterns } = useApp()
  const [sub, setSub] = useState<Sub>('arten')
  const [typeId, setTypeId] = useState(types[0].id)
  const [patternId, setPatternId] = useState(patterns[0].id)
  const jump = (to: Sub, id: string) => { if (to === 'muster') setPatternId(id); else setTypeId(id); setSub(to) }
  return (
    <div className="space-y-5">
      {sub === 'arten'
        ? <div className="flex justify-end"><Button onClick={() => setSub('muster')}>Beitragsmuster verwalten</Button></div>
        : <button onClick={() => setSub('arten')} className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft size={14} /> Zurück zu Mitgliedschaften</button>}
      {sub === 'arten' && <TypesPane selId={typeId} setSelId={setTypeId} onOpenPattern={(id) => jump('muster', id)} />}
      {sub === 'muster' && <PatternsPane selId={patternId} setSelId={setPatternId} onOpenType={(id) => jump('arten', id)} />}
    </div>
  )
}

/** Left column of a master-detail pane. */
function Master({ title, onNew, newLabel, children }: { title: string; onNew: () => void; newLabel: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-semibold">{title}</h2></div>
      <Card className="divide-y divide-line overflow-hidden">{children}<button onClick={onNew} className="flex w-full items-center gap-2 px-4 py-3 text-sm font-medium text-brand hover:bg-slate-50"><Plus size={14} />{newLabel}</button></Card>
    </div>
  )
}
const Item = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button onClick={onClick} className={clsx('block w-full px-4 py-3 text-left text-sm', active ? 'bg-brand-soft' : 'hover:bg-slate-50')}>{children}</button>
)

function PreviewRows({ rows, ends }: { rows: ReturnType<typeof schedule>; ends?: Date }) {
  return (
    <div className="divide-y divide-line rounded-xl border border-line">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
          <div><div className="font-medium">{fmtDate(r.date)}</div><div className="text-xs text-muted">{r.note}</div></div>
          <div className="text-right"><div className="font-semibold tabular-nums">{eur(r.amount)}</div>{r.pct !== 100 && <Badge tone="warn">{r.pct} %</Badge>}</div>
        </div>
      ))}
      {ends && <div className="flex items-center justify-between gap-3 bg-slate-50 px-4 py-2.5 text-sm"><div><div className="font-medium">{fmtDate(ends)}</div><div className="text-xs text-muted">Mitgliedschaft endet, keine Verlängerung</div></div></div>}
    </div>
  )
}

// ---------- Mitgliedschaften ----------
function TypesPane({ selId, setSelId, onOpenPattern }: { selId: string; setSelId: (id: string) => void; onOpenPattern: (id: string) => void }) {
  const { types, setTypes, patterns, typeOf, hasAccount, windDown, ledger } = useApp()
  const t = types.find((x) => x.id === selId) ?? types[0]
  const pattern = patterns.find((p) => p.id === t.patternId) ?? patterns[0]
  const people = members.filter((m) => typeOf(m.id).id === t.id)
  const [join, setJoin] = useState('2026-11-07')
  const [assigning, setAssigning] = useState(false)
  const [unitNote, setUnitNote] = useState<string | null>(null)
  const patch = (p: Partial<MembershipType>) => setTypes(types.map((x) => (x.id === t.id ? { ...x, ...p } : x)))
  const per = pattern.interval === 'monat' ? 'Monat' : 'Jahr'
  const paging = usePaging(people, t.id, [10, 25, 50])
  const add = () => { const n: MembershipType = { id: `t-${Date.now()}`, name: 'Neue Mitgliedschaft', amount: 0, patternId: patterns[0].id, note: '', account: true, renew: true }; setTypes([...types, n]); setSelId(n.id) }
  const remove = () => { const rest = types.filter((x) => x.id !== t.id); setTypes(rest); setSelId(rest[0].id) }

  return (
    <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
      <div className="space-y-4"><Master title="Mitgliedschaften" onNew={add} newLabel="Neue Mitgliedschaft">
        {types.map((x) => {
          const n = members.filter((m) => typeOf(m.id).id === x.id).length
          return (
            <Item key={x.id} active={x.id === t.id} onClick={() => { setSelId(x.id); setUnitNote(null) }}>
              <div className="flex items-baseline justify-between gap-2"><span className="font-medium">{x.name}</span><span className="tabular-nums">{eur(x.amount)}<span className="text-xs text-muted"> / {patterns.find((p) => p.id === x.patternId)?.interval === 'monat' ? 'Monat' : 'Jahr'}</span></span></div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted"><span>{n} Mitglieder</span><span>·</span><span className="truncate">{patterns.find((p) => p.id === x.patternId)?.name}</span>{!x.account && <Badge>ohne Konto</Badge>}{!x.renew && x.duration && <Badge tone="warn">endet nach {durationText(x.duration)}</Badge>}{x.checkin && <Badge tone="info">Check-in</Badge>}</div>
            </Item>
          )
        })}
      </Master>
      <CheckinSetting />
      </div>

      <div className="space-y-5">
        <Card className="space-y-5 p-5">
          <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
            <label className="text-sm font-medium">Name<input value={t.name} onChange={(e) => patch({ name: e.target.value })} className={clsx(inp, 'mt-1 w-full')} /></label>
            <label className="text-sm font-medium">Beitrag pro {per}<span className="mt-1 flex items-center gap-2"><input inputMode="decimal" value={t.amount || ''} onChange={(e) => patch({ amount: Number(e.target.value.replace(',', '.')) || 0 })} className={clsx(inp, 'w-full text-right tabular-nums')} /><span className="text-muted">€</span></span></label>
          </div>
          {unitNote && <p className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-amber-900">{unitNote}</p>}
          <label className="block text-sm font-medium">Beschreibung<input value={t.note} onChange={(e) => patch({ note: e.target.value })} className={clsx(inp, 'mt-1 w-full')} /></label>

          <div>
            <div className="mb-1.5 flex items-center justify-between text-sm"><span className="font-medium">Wann und wie wird abgerechnet?</span><button onClick={() => onOpenPattern(pattern.id)} className="text-brand hover:underline">Beitragsmuster bearbeiten</button></div>
            <div className="grid gap-2 sm:grid-cols-2">
              {patterns.map((p) => (
                <button key={p.id} onClick={() => { patch({ patternId: p.id }); setUnitNote(p.interval !== pattern.interval ? `Der Beitrag gilt jetzt pro ${p.interval === 'monat' ? 'Monat' : 'Jahr'}. Bitte den Betrag prüfen.` : null) }} className={clsx('rounded-xl border p-3 text-left text-sm', p.id === t.patternId ? 'border-brand bg-brand-soft' : 'border-line hover:bg-slate-50')}>
                  <div className="flex items-center justify-between gap-2 font-medium">{p.name}<Badge tone={p.interval === 'monat' ? 'warn' : 'neutral'}>{p.interval === 'monat' ? 'monatlich' : 'jährlich'}</Badge></div>
                  <div className="mt-1 text-xs text-muted">{describe(p)}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-1.5 text-sm font-medium">Laufzeit</div>
            <Segmented<'auto' | 'ende'> value={t.renew ? 'auto' : 'ende'} onChange={(v) => patch(v === 'auto' ? { renew: true, duration: undefined } : { renew: false, duration: t.duration ?? { n: 1, unit: 'Monate' } })} options={[{ value: 'auto', label: 'Verlängert sich automatisch' }, { value: 'ende', label: 'Endet, keine Verlängerung' }]} />
            {!t.renew && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">Endet nach
                <input type="number" min={1} value={t.duration?.n ?? 1} onChange={(e) => patch({ duration: { n: Math.max(1, Number(e.target.value) || 1), unit: t.duration?.unit ?? 'Monate' } })} className={clsx(inp, 'w-20')} aria-label="Dauer" />
                <select value={t.duration?.unit ?? 'Monate'} onChange={(e) => patch({ duration: { n: t.duration?.n ?? 1, unit: e.target.value as Unit } })} className={inp} aria-label="Einheit"><option>Tage</option><option>Wochen</option><option>Monate</option></select>
                <span className="text-muted">· der Beitrag wird einmal fällig</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line px-4 py-3">
            <div className="min-w-0 flex-1 basis-64 text-sm font-medium">Betriebskonto</div>
            <Switch checked={t.account} onChange={(v) => patch({ account: v })} label={`${t.name} hat Betriebskonto`} />
          </div>
        </Card>

        <Card className="space-y-3 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">Was zahlt ein neues Mitglied?</h3>
            <label className="flex items-center gap-2 text-sm text-muted">Eintritt am<input type="date" value={join} onChange={(e) => setJoin(e.target.value)} className={inp} /></label></div>
          <PreviewRows rows={schedule(parseDate(join), t.amount, pattern, 3, t.renew)} ends={!t.renew && t.duration ? endDate(parseDate(join), t.duration) : undefined} />
        </Card>

        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3"><h3 className="text-sm font-semibold">Mitglieder mit „{t.name}“ ({people.length})</h3><div className="flex gap-2"><Button onClick={remove} disabled={people.length > 0 || types.length < 2}><Trash2 size={14} /> Löschen</Button><Button variant="primary" onClick={() => setAssigning(true)}><Plus size={14} /> Ohne Formular zuordnen</Button></div></div>
          {people.length === 0 ? <p className="border-t border-line px-5 py-6 text-sm text-muted">Noch niemand.</p> : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-muted"><tr><th className="px-5 py-2 font-medium">Name</th><th className="px-3 py-2 font-medium">Nächster Beitrag</th><th className="px-3 py-2 text-right font-medium">Betriebskonto</th></tr></thead>
              <tbody className="divide-y divide-line">
                {paging.rows.map((m) => {
                  const next = t.renew ? schedule(JOIN_SAMPLE, t.amount, pattern, 14).find((d) => d.date > TODAY) : undefined
                  const bal = ledger.balances[m.id] ?? 0
                  return (
                    <tr key={m.id}>
                      <td className="px-5 py-2.5"><a href={`#/mitglieder/${m.id}?tab=mitgliedschaft`} className="font-medium hover:underline">{m.name}</a></td>
                      <td className="px-3 py-2.5 text-muted">{!t.renew ? 'einmalig' : next ? `${fmtDate(next.date)} · ${eur(next.amount)}` : '–'}</td>
                      <td className={clsx('px-3 py-2.5 text-right tabular-nums', bal < 0 && 'text-bad')}>{hasAccount(m.id) ? <>{eur(bal)}{windDown(m.id) && <span className="ml-2 text-xs text-warn">läuft aus</span>}</> : <span className="text-muted">kein Konto</span>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
          {people.length > 10 && paging.bar}
        </Card>
      </div>

      <DirectAssign open={assigning} onClose={() => setAssigning(false)} typeId={t.id} />
    </div>
  )
}

/**
 * Which membership a person gets who registers at the tandem check-in. It is a setting of the check-in, not a property of one
 * membership, so it is chosen here from all memberships (or none). Stored as the `checkin` mark of exactly one membership.
 */
function CheckinSetting() {
  const { types, setTypes } = useApp()
  const chosen = types.find((t) => t.checkin)?.id ?? ''
  return (
    <Card className="space-y-2 p-4">
      <label className="block text-sm font-medium">Tandem-Check-in: Gäste bekommen
        <select value={chosen} onChange={(e) => setTypes(types.map((x) => ({ ...x, checkin: x.id === e.target.value })))} className={clsx(inp, 'mt-1 w-full')}>
          <option value="">Keine Mitgliedschaft</option>
          {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </label>
    </Card>
  )
}

// ---------- Beitragsmuster ----------
function PatternsPane({ selId, setSelId, onOpenType }: { selId: string; setSelId: (id: string) => void; onOpenType: (id: string) => void }) {
  const { patterns, setPatterns, types } = useApp()
  const p = patterns.find((x) => x.id === selId) ?? patterns[0]
  const users = types.filter((t) => t.patternId === p.id)
  const [join, setJoin] = useState('2026-11-07')
  const [sampleId, setSampleId] = useState<string>('')
  const sample = users.find((t) => t.id === sampleId) ?? users[0]
  const amount = sample?.amount ?? (p.interval === 'monat' ? 15 : 100)
  const patch = (x: Partial<FeePattern>) => setPatterns(patterns.map((y) => (y.id === p.id ? { ...y, ...x } : y)))
  const setInterval = (interval: FeePattern['interval']) => patch({ interval, prorata: interval === 'monat' && p.prorata === 'stufen' ? 'monatsgenau' : p.prorata })
  const add = () => { const n = newPattern(patterns.length + 1); setPatterns([...patterns, n]); setSelId(n.id) }
  const remove = () => { const rest = patterns.filter((x) => x.id !== p.id); setPatterns(rest); setSelId(rest[0].id) }
  const monthly = p.interval === 'monat'

  return (
    <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
      <Master title="Beitragsmuster" onNew={add} newLabel="Neues Muster">
        {patterns.map((x) => {
          const used = types.filter((t) => t.patternId === x.id)
          return (
            <Item key={x.id} active={x.id === p.id} onClick={() => setSelId(x.id)}>
              <div className="flex items-center justify-between gap-2"><span className="font-medium">{x.name}</span><Badge tone={x.interval === 'monat' ? 'warn' : 'neutral'}>{x.interval === 'monat' ? 'monatlich' : 'jährlich'}</Badge></div>
              <div className="mt-0.5 text-xs text-muted">{used.length === 0 ? 'wird nicht verwendet' : `verwendet von ${used.map((t) => t.name).join(', ')}`}</div>
            </Item>
          )
        })}
      </Master>

      <div className="space-y-5">
        <Card className="space-y-5 p-5">
          <label className="block text-sm font-medium">Name<input value={p.name} onChange={(e) => patch({ name: e.target.value })} className={clsx(inp, 'mt-1 w-full max-w-md')} /></label>
          <div>
            <div className="mb-1 text-sm font-medium">Wie oft?</div>
            <Segmented<FeePattern['interval']> value={p.interval} onChange={setInterval} options={[{ value: 'jahr', label: 'Jährlich' }, { value: 'monat', label: 'Monatlich' }]} />
          </div>
          <div>
            <div className="mb-1 text-sm font-medium">Wann ist der Beitrag fällig?</div>
            <Segmented<Model> value={p.model} onChange={(model) => patch({ model })} options={monthly
              ? [{ value: 'stichtag', label: 'Fester Tag im Monat' }, { value: 'jahrestag', label: 'Am Eintrittstag' }]
              : [{ value: 'stichtag', label: 'Fester Stichtag für alle' }, { value: 'jahrestag', label: 'Am Eintrittsdatum' }]} />
            {p.model === 'stichtag' && (
              <div className="mt-3 flex items-center gap-2 text-sm"><span className="font-medium">{monthly ? 'Am' : 'Stichtag'}</span>
                <input type="number" min={1} max={28} value={p.stichtagDay} onChange={(e) => patch({ stichtagDay: Math.min(28, Math.max(1, Number(e.target.value) || 1)) })} className={clsx(inp, 'w-16')} />
                {monthly ? <span>. jedes Monats</span> : <select value={p.stichtagMonth} onChange={(e) => patch({ stichtagMonth: Number(e.target.value) })} className={inp}>{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select>}
              </div>
            )}
                      </div>

          {p.model === 'stichtag' && (
            <div>
              <div className="mb-1 text-sm font-medium">{monthly ? 'Erster Monat bei Eintritt mitten im Monat' : 'Erster Beitrag bei Eintritt mitten im Jahr'}</div>
              <Segmented<Prorata> value={p.prorata} onChange={(prorata) => patch({ prorata })} options={[{ value: 'voll', label: monthly ? 'Voller Monat' : 'Voller Beitrag' }, { value: 'monatsgenau', label: monthly ? 'Nach Tagen' : 'Monatsgenau' }, ...(monthly ? [] : [{ value: 'stufen' as Prorata, label: 'Stufen' }])]} />
              {p.prorata === 'stufen' && !monthly && (
                <div className="mt-3 space-y-2">
                  {p.steps.map((s, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-2 text-sm">Eintritt ab
                      <select value={s.fromMonth} onChange={(e) => patch({ steps: p.steps.map((x, k) => (k === i ? { ...x, fromMonth: Number(e.target.value) } : x)) })} className={inp}>{MONTHS.map((m, k) => <option key={m} value={k + 1}>{m}</option>)}</select>
                      zahlt <input type="number" min={0} max={100} value={s.pct} onChange={(e) => patch({ steps: p.steps.map((x, k) => (k === i ? { ...x, pct: Number(e.target.value) || 0 } : x)) })} className={clsx(inp, 'w-20')} /> %
                      {p.steps.length > 1 && <button aria-label="Stufe entfernen" onClick={() => patch({ steps: p.steps.filter((_, k) => k !== i) })} className="grid h-8 w-8 place-items-center rounded-md hover:bg-slate-100"><X size={14} /></button>}
                    </div>
                  ))}
                  <button className="text-sm text-brand" onClick={() => patch({ steps: [...p.steps, { fromMonth: 9, pct: 25 }] })}>+ Stufe</button>
                </div>
              )}
            </div>
          )}
          <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm"><span className="font-medium">In einem Satz: </span>{describe(p)}</div>
        </Card>

        <Card className="space-y-3 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">Rechenbeispiel</h3>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
              {users.length > 1 && <select value={sample?.id} onChange={(e) => setSampleId(e.target.value)} className={inp}>{users.map((t) => <option key={t.id} value={t.id}>{t.name} ({eur(t.amount)})</option>)}</select>}
              {users.length === 1 && <span>{sample.name} ({eur(sample.amount)})</span>}
              Eintritt am<input type="date" value={join} onChange={(e) => setJoin(e.target.value)} className={inp} />
            </div>
          </div>
          <PreviewRows rows={schedule(parseDate(join), amount, p, 3)} />
        </Card>

        <Card className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-sm">
          <div><span className="font-medium">Verwendet von: </span>{users.length === 0 ? <span className="text-muted">keiner Mitgliedschaft</span> : users.map((t) => <button key={t.id} onClick={() => onOpenType(t.id)} className="mr-2 text-brand hover:underline">{t.name}</button>)}</div>
          <Button onClick={remove} disabled={users.length > 0 || patterns.length < 2}><Trash2 size={14} /> Muster löschen</Button>
        </Card>
      </div>
    </div>
  )
}
