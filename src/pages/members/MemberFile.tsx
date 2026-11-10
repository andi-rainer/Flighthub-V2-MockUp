import clsx from 'clsx'
import MemberDocuments from './MemberDocuments'
import { ArrowLeft, FileText } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { eur, members } from '../../data'
import { useBack } from '../../backTo'
import { useApp } from '../../state'
import { Badge, Banner, Button, Card } from '../../ui'
import { AccountPanel } from '../finance/Accounts'
import { describe, durationText, feeIsOpen, feeLabel, feeTone, fmtDate, schedule } from './data'
import { FeeDocDrawer, useFeeActions, type Doc } from './FeeDoc'
import DirectAssign from './DirectAssign'
import FunctionAssign from './FunctionAssign'
import MemberHistory from './MemberHistory'
import { useSession } from '../../session/session'
import { CATEGORY_LABELS, PERMISSION_CATALOG, isCurrent, labelOf, permissionsFor, type Assignment } from '../../permissions'
import { TODAY_ISO } from '../../state'

type Tab = 'daten' | 'konto' | 'mitgliedschaft' | 'dokumente' | 'verlauf'

/**
 * The Mitgliederakte: everything about one person on one PC page, in tabs.
 * Data, Betriebskonto, membership and documents are edited here and nowhere else.
 */
export default function MemberFile() {
  const { id = 'm1' } = useParams()
  const nav = useNavigate()
  const { label: backLabel, back } = useBack({ label: 'Alle Mitglieder', to: '/mitglieder' })
  const [params] = useSearchParams()
  const [tab, setTab] = useState<Tab>((params.get('tab') as Tab) ?? 'daten')
  const { fnName, ledger, weights, setWeight, apps, hasAccount, windDown, assignments, setAssignments, grants, can, types, patterns, typeOf, setMemberType, fees } = useApp()
  const m = members.find((x) => x.id === id) ?? members[0]
  const balance = ledger.balances[m.id] ?? 0
  const [saved, setSaved] = useState(false)
  const [assign, setAssign] = useState<{ editing?: Assignment } | null>(null)
  const [doc, setDoc] = useState<Doc | null>(null)
  const [feeNote, setFeeNote] = useState<string | null>(null)
  const { send } = useFeeActions()
  const { guarded } = useSession()
  const mine_ = assignments[m.id] ?? []
  const held = permissionsFor(mine_, grants, TODAY_ISO)
  const saveFn = (a: Assignment) => guarded('members.edit', () => { setAssignments({ ...assignments, [m.id]: [...mine_.filter((x) => x.fn !== a.fn), a] }); setAssign(null) })
  const removeFn = (fn: string) => guarded('members.edit', () => setAssignments({ ...assignments, [m.id]: mine_.filter((a) => a.fn !== fn) }))
  const [first, ...rest] = m.name.split(' ')
  const last = rest.join(' ')
  const { profileOf, updateProfile } = useApp()
  const [form, setForm] = useState(() => profileOf(m.id)) // a draft: it is saved with the button below
  const kg = weights[m.id]
  const myFees = fees.filter((f) => f.person === m.name)
  const ends = apps.find((a) => a.kind === 'Beendigung' && a.status === 'Genehmigt' && a.person === m.name)?.answers['Austritt zum']
  const type = typeOf(m.id)
  const pattern = patterns.find((p) => p.id === type.patternId)!
  const dues = schedule(new Date(2026, 5, 1), type.amount, pattern, 12, type.renew).filter((d) => d.date > new Date(2026, 10, 7)).slice(0, 3) // the dummy has no admission dates: everybody joined on 01.06.2026
  const [direct, setDirect] = useState(false)
  const [kgDraft, setKgDraft] = useState(() => (weights[m.id] ? String(weights[m.id]) : ''))
  const mine = apps.filter((a) => a.person === m.name)

  const tabs: { id: Tab; label: string }[] = [
    { id: 'daten', label: 'Stammdaten' }, { id: 'konto', label: 'Betriebskonto' }, { id: 'mitgliedschaft', label: 'Mitgliedschaft' },
    { id: 'dokumente', label: 'Dokumente und Funktionen' }, { id: 'verlauf', label: 'Verlauf' },
  ]
  const inp = 'mt-1 h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm outline-none focus:border-brand'

  return (
    <>
      <button onClick={back} className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft size={14} /> {backLabel === 'Alle Mitglieder' ? backLabel : `Zurück zu ${backLabel}`}</button>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{m.name}</h1>
          <div className="mt-2 flex flex-wrap gap-2">{m.manual && <Badge tone="warn">Ohne Formular angelegt</Badge>}{mine_.filter((a) => isCurrent(a, TODAY_ISO)).map((a) => <Badge key={a.fn} tone="info">{fnName(a.fn)}</Badge>)}{ends ? <Badge tone="warn">Austritt zum {ends}</Badge> : <Badge tone={m.membership === 'aktiv' ? 'ok' : 'warn'}>{m.membership === 'aktiv' ? 'Aktiv' : m.membership === 'offen' ? 'Beitrag offen' : 'Ruhend'}</Badge>}{myFees.some((f) => feeIsOpen(f)) && <Badge tone="warn">Beitrag offen</Badge>}</div>
        </div>
        {hasAccount(m.id) ? <div className="text-right"><div className="text-xs uppercase tracking-wide text-muted">Betriebskonto</div><div className={clsx('text-2xl font-semibold tabular-nums', balance < 0 && 'text-bad')}>{eur(balance)}</div>{windDown(m.id) && <div className="text-xs text-warn">läuft aus, bis ausgeglichen</div>}</div> : <Badge>Mitgliedschaft ohne Betriebskonto</Badge>}
      </div>

      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-line">
        {tabs.map((t) => <button key={t.id} onClick={() => setTab(t.id)} className={clsx('shrink-0 border-b-2 px-4 py-2.5 text-sm font-medium', tab === t.id ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-ink')}>{t.label}</button>)}
      </div>

      {tab === 'daten' && (
        <Card className="max-w-4xl space-y-6 p-5">
          {saved && <Banner>Gespeichert. Die Änderung steht im Verlauf.</Banner>}
          <section>
            <h3 className="mb-3 text-sm font-semibold">Person</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium">Vorname<input value={form.first} onChange={(e) => setForm({ ...form, first: e.target.value })} className={inp} /></label>
              <label className="text-sm font-medium">Nachname<input value={form.last} onChange={(e) => setForm({ ...form, last: e.target.value })} className={inp} /></label>
              <label className="text-sm font-medium">Geburtsdatum<input value={form.birth} onChange={(e) => setForm({ ...form, birth: e.target.value })} className={inp} /></label>
              <label className="text-sm font-medium">Telefon<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inp} /></label>
              <label className="text-sm font-medium sm:col-span-2">E-Mail<input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inp} /></label>
            </div>
          </section>
          <section>
            <h3 className="mb-3 text-sm font-semibold">Adresse</h3>
            <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
              <label className="text-sm font-medium">Straße<input value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} className={inp} /></label>
              <label className="text-sm font-medium">Hausnummer<input value={form.no} onChange={(e) => setForm({ ...form, no: e.target.value })} className={inp} /></label>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-[120px_1fr_1fr]">
              <label className="text-sm font-medium">PLZ<input value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} className={inp} /></label>
              <label className="text-sm font-medium">Stadt<input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className={inp} /></label>
              <label className="text-sm font-medium">Land<input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className={inp} /></label>
            </div>
          </section>
          <section>
            <h3 className="mb-3 text-sm font-semibold">Notfallkontakt</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium">Name<input value={form.emName} onChange={(e) => setForm({ ...form, emName: e.target.value })} className={inp} /></label>
              <label className="text-sm font-medium">Telefon<input value={form.emPhone} onChange={(e) => setForm({ ...form, emPhone: e.target.value })} className={inp} /></label>
            </div>
          </section>
          <section>
            <h3 className="mb-3 text-sm font-semibold">Flugbetrieb</h3>
            <label className="block text-sm font-medium sm:max-w-xs">Gewicht in kg {m.functions.includes('Sportspringer') && <span className="text-bad">(Pflicht)</span>}
              <input inputMode="numeric" value={kgDraft} onChange={(e) => setKgDraft(e.target.value)} className={inp} />
            </label>
          </section>
          <div className="flex gap-2"><Button variant="primary" onClick={() => { updateProfile(m.id, form, Number(kgDraft) || undefined); setSaved(true) }}>Speichern</Button><Button onClick={() => { setForm(profileOf(m.id)); setKgDraft(weights[m.id] ? String(weights[m.id]) : ''); setSaved(false) }}>Zurücksetzen</Button></div>
        </Card>
      )}

      {tab === 'konto' && (hasAccount(m.id) ? <AccountPanel member={m} ledger={ledger} wide /> : (
        <Card className="max-w-2xl p-5 text-sm">
          <div className="font-semibold">Diese Mitgliedschaft hat kein Betriebskonto</div>
          <p className="mt-1 text-muted">Für die Mitgliedschaft „{type.name}“ ist kein Betriebskonto vorgesehen. Es wird nichts verbucht und {m.name} erscheint nicht in der Kontenliste. Ob eine Art ein Konto hat, stellst du unter Mitglieder, Mitgliedschaft einrichten ein.</p>
          <div className="mt-3"><Button onClick={() => nav('/mitglieder?tab=einstellungen')}>Mitgliedschaften einrichten</Button></div>
        </Card>
      ))}

      {tab === 'mitgliedschaft' && (
        <div className="space-y-5">
        <div className="grid gap-5 lg:grid-cols-2">
          <Card className="space-y-4 p-5 text-sm">
            <div className="flex items-start justify-between gap-3"><div><div className="text-xs uppercase tracking-wide text-muted">Mitgliedschaft</div><div className="text-lg font-semibold">{type.name}</div></div><div className="text-right"><div className="text-lg font-semibold tabular-nums">{eur(type.amount)}</div><div className="text-xs text-muted">pro {pattern.interval === 'monat' ? 'Monat' : 'Jahr'}</div></div></div>
            <div className="rounded-xl bg-slate-50 p-3"><div className="font-medium">{pattern.name}</div><div className="mt-0.5 text-xs text-muted">{describe(pattern)}</div></div>
            <div>
              <div className="mb-1.5 font-medium">{type.renew ? 'Nächste Fälligkeiten' : 'Laufzeit'}</div>
              {!type.renew ? <div className="rounded-xl border border-line px-3 py-2">Einmaliger Beitrag, die Mitgliedschaft endet nach {durationText(type.duration)}, ohne Verlängerung</div> : <div className="divide-y divide-line rounded-xl border border-line">{dues.map((d, i) => <div key={i} className="flex justify-between px-3 py-2"><span>{fmtDate(d.date)} <span className="text-xs text-muted">{d.note}</span></span><span className="font-medium tabular-nums">{eur(d.amount)}</span></div>)}</div>}
            </div>
            <div className="flex flex-wrap gap-2"><Button variant="primary" disabled={!!ends} onClick={() => nav(`/mitglieder?tab=antraege&new=aenderung&member=${m.id}`)}>Mitgliedschaft ändern</Button><Button disabled={!!ends} onClick={() => nav(`/mitglieder?tab=antraege&new=ende&member=${m.id}`)}>Austritt oder Ausschluss</Button>{ends && <span className="basis-full text-xs text-muted">Austritt zum {ends} ist beschlossen. Es gibt nichts mehr zu ändern.</span>}</div>
            {can('members.memberships.manage') && !ends && <p className="border-t border-line pt-3 text-xs text-muted">Ausnahme ohne Formular: <button onClick={() => setDirect(true)} className="text-brand hover:underline">Mitgliedschaft ohne Formular ändern …</button></p>}
            <DirectAssign open={direct} onClose={() => setDirect(false)} memberId={m.id} />
          </Card>
          <Card className="p-5">
            <div className="mb-2 flex items-center justify-between text-sm font-semibold">Anträge und Unterlagen<button onClick={() => nav('/mitglieder?tab=antraege')} className="text-xs font-normal text-brand hover:underline">Alle Anträge</button></div>
            <div className="divide-y divide-line">
              {mine.map((a) => <div key={a.id} className="flex items-center justify-between gap-3 py-2.5 text-sm"><span><b>{a.kind}</b> · {a.date}<span className="block text-xs text-muted">{a.formName}, Version {a.formVersion}</span></span>{a.pdf ? <span className="inline-flex items-center gap-1 text-xs text-muted"><FileText size={14} />{a.pdf}</span> : <Badge>{a.status}</Badge>}</div>)}
              {mine.length === 0 && <p className="py-2 text-sm text-muted">Noch keine Anträge.</p>}
            </div>
          </Card>
        </div>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3"><h3 className="text-sm font-semibold">Beiträge</h3><button onClick={() => nav('/mitglieder?tab=beitraege')} className="text-xs text-brand hover:underline">Zum Beitragslauf</button></div>
          {feeNote && <div className="border-t border-line px-5 py-2 text-xs text-ok">{feeNote}</div>}
          {myFees.length === 0 ? <p className="border-t border-line px-5 py-4 text-sm text-muted">Für diese Mitgliedschaft entstehen keine Beiträge.</p> : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-muted"><tr><th className="px-5 py-2 font-medium">Beitrag</th><th className="px-3 py-2 text-right font-medium">Betrag</th><th className="hidden px-3 py-2 font-medium sm:table-cell">Fällig</th><th className="px-3 py-2 font-medium">Status</th><th className="px-3 py-2" /></tr></thead>
              <tbody className="divide-y divide-line">
                {myFees.map((f) => (
                  <tr key={f.id}>
                    <td className="px-5 py-2.5">{f.note}</td>
                    <td className="px-3 py-2.5 text-right font-medium tabular-nums">{f.state === 'beendet' ? '–' : eur(f.amount)}</td>
                    <td className="hidden px-3 py-2.5 text-muted sm:table-cell">{f.due}</td>
                    <td className="px-3 py-2.5"><Badge tone={feeTone[f.state]}>{feeLabel[f.state]}</Badge>{f.invoice && <span className="ml-2 text-xs text-muted">{f.invoice}</span>}</td>
                    <td className="px-3 py-2 text-right">
                      {f.state === 'faellig' && <Button onClick={() => setDoc({ fee: f, kind: 'Rechnung' })}>Rechnung erstellen</Button>}
                      {f.state === 'ueberfaellig' && <Button onClick={() => setDoc({ fee: f, kind: 'Zahlungsaufforderung' })}>Zahlungsaufforderung</Button>}
                      {(f.state === 'rechnung' || f.state === 'bezahlt') && f.invoice && <button onClick={() => setDoc({ fee: f, kind: 'Rechnung' })} className="text-xs text-brand hover:underline">Rechnung ansehen</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
        <FeeDocDrawer doc={doc} onClose={() => setDoc(null)} onSend={(ids, kind) => { setFeeNote(send(ids, kind)); setDoc(null) }} />
        </div>
      )}

      {tab === 'dokumente' && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card className="p-5"><MemberDocuments memberId={m.id} /></Card>
          <Card className="p-5">
            <div className="mb-2 flex items-center justify-between"><div className="text-sm font-semibold">Funktionen</div>{can('members.edit') && <Button variant="primary" onClick={() => setAssign({})}>Funktion zuweisen</Button>}</div>
            <div className="divide-y divide-line rounded-xl border border-line">
              {mine_.map((a) => (
                <div key={a.fn} className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm">
                  <div><div className="font-medium">{fnName(a.fn)}</div><div className="text-xs text-muted">{!isCurrent(a, TODAY_ISO) ? <span className="text-bad">abgelaufen am {a.until?.split('-').reverse().join('.')}</span> : a.until ? `gültig bis ${a.until.split('-').reverse().join('.')}` : 'unbefristet'}</div></div>
                  {can('members.edit') && <div className="flex gap-3 text-xs"><button className="text-brand hover:underline" onClick={() => setAssign({ editing: a })}>Gültigkeit ändern</button><button className="text-muted hover:text-bad" onClick={() => removeFn(a.fn)}>Entfernen</button></div>}
                </div>
              ))}
              {mine_.length === 0 && <div className="px-3 py-3 text-sm text-muted">Keine Funktion. {can('members.edit') ? 'Mit „Funktion zuweisen“ bekommt die Person Rechte.' : ''}</div>}
            </div>
            <FunctionAssign open={!!assign} person={form.first} current={mine_} editing={assign?.editing} grants={grants} onClose={() => setAssign(null)} onSave={saveFn} />
            <div className="mb-1 mt-5 text-sm font-semibold">Was diese Person darf ({held.size} Rechte)</div>
            <div className="space-y-1">
              {[...new Set(PERMISSION_CATALOG.map((p) => p.category))].map((cat) => {
                const items = PERMISSION_CATALOG.filter((p) => p.category === cat && held.has(p.code))
                if (items.length === 0) return null
                return (
                  <details key={cat} className="rounded-lg border border-line">
                    <summary className="cursor-pointer px-3 py-2 text-sm">{CATEGORY_LABELS[cat]} <span className="text-muted">({items.length})</span></summary>
                    <ul className="space-y-1 border-t border-line px-3 py-2 text-sm">{items.map((p) => <li key={p.code} className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-ok" />{labelOf(p.code)}{p.grantedToAll && <span className="text-xs text-muted">(alle)</span>}</li>)}</ul>
                  </details>
                )
              })}
            </div>
          </Card>
        </div>
      )}

      {tab === 'verlauf' && <MemberHistory member={m} />}
    </>
  )
}
