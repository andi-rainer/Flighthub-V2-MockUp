import clsx from 'clsx'
import { AlertTriangle, ArrowRight, Search } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { eur, members } from '../../data'
import { useApp } from '../../state'
import { Banner, Button, Drawer } from '../../ui'
import { useSession } from '../../session/session'
import { describe, fmtDate, parseDate } from './data'

const inp = 'h-10 rounded-lg border border-line bg-surface px-3 text-sm outline-none focus:border-brand'
const reasons = ['Datenübernahme aus dem alten System', 'Korrektur eines Eingabefehlers', 'Vorstandsbeschluss']

/**
 * Changing a membership WITHOUT a form is the absolute exception: there is no signature and no PDF. So it asks for what, from when and
 * why, shows a summary, and needs one more explicit confirmation before it happens. It is written to the history with the reason.
 * Entry points: the member file (member fixed, choose the membership) and the membership setup (membership fixed, choose the members).
 */
export default function DirectAssign({ open, onClose, memberId, typeId }: { open: boolean; onClose: () => void; memberId?: string; typeId?: string }) {
  const nav = useNavigate()
  const { types, patterns, typeOf, hasAccount, ledger, changeMembership } = useApp()
  const { guarded } = useSession()
  const [target, setTarget] = useState(typeId ?? '')
  const [picked, setPicked] = useState<string[]>(memberId ? [memberId] : [])
  const [q, setQ] = useState('')
  const [from, setFrom] = useState('2026-11-07')
  const [reason, setReason] = useState('')
  const [phase, setPhase] = useState<'form' | 'confirm' | 'done'>('form')
  const [sure, setSure] = useState(false)

  const type = types.find((t) => t.id === (typeId ?? target))
  const ids = memberId ? [memberId] : picked
  /** The new membership has no Betriebskonto but this member still has a balance: the account stays until it is settled. */
  const keeps = (id: string) => !!type && !type.account && (ledger.balances[id] ?? 0) !== 0
  const bal = (id: string) => eur(ledger.balances[id] ?? 0)
  const pool = members.filter((m) => !memberId && typeOf(m.id).id !== typeId && m.name.toLowerCase().includes(q.toLowerCase()))
  const name = (id: string) => members.find((m) => m.id === id)!.name
  const ok = !!type && ids.length > 0 && ids.every((id) => typeOf(id).id !== type.id) && !!from && reason.trim().length >= 10
  const close = () => { setPhase('form'); setSure(false); setReason(''); setPicked(memberId ? [memberId] : []); setQ(''); if (!typeId) setTarget(''); onClose() }
  const apply = () => guarded('members.memberships.manage', () => {
    ids.forEach((id) => changeMembership(id, type!.id, { exception: { from: fmtDate(parseDate(from)), reason: reason.trim() } }))
    setPhase('done')
  })
  const per = (id: string) => (patterns.find((p) => p.id === types.find((t) => t.id === id)?.patternId)?.interval === 'monat' ? 'Monat' : 'Jahr')

  return (
    <Drawer open={open} title="Mitgliedschaft ohne Formular ändern" onClose={close} size="xl"
      footer={phase === 'form' ? <Button variant="primary" size="lg" className="w-full" disabled={!ok} onClick={() => setPhase('confirm')}>Weiter zur Bestätigung</Button>
        : phase === 'confirm' ? <div className="flex gap-2"><Button size="lg" onClick={() => { setPhase('form'); setSure(false) }}>Zurück</Button><Button variant="danger" size="lg" className="flex-1" disabled={!sure} onClick={apply}>Jetzt ohne Formular ändern</Button></div>
        : <Button variant="primary" size="lg" className="w-full" onClick={close}>Fertig</Button>}>
      {phase === 'done' ? (
        <Banner>Geändert. {ids.map(name).join(', ')} {ids.length > 1 ? 'haben' : 'hat'} jetzt die Mitgliedschaft {type?.name}. Die Änderung steht mit Grund und deinem Namen im Verlauf.</Banner>
      ) : phase === 'confirm' ? (
        <div className="space-y-4">
          <Banner tone="warn"><span className="flex items-start gap-2"><AlertTriangle size={16} className="mt-0.5 shrink-0" /><span>Bitte noch einmal prüfen. Ohne Formular gibt es <b>keine Unterschrift und kein PDF</b>. Das ist die Ausnahme.</span></span></Banner>
          <div className="divide-y divide-line rounded-xl border border-line text-sm">
            {ids.map((id) => <div key={id} className="flex items-center justify-between gap-3 px-4 py-3"><span className="font-medium">{name(id)}</span><span className="flex items-center gap-2">{typeOf(id).name}<ArrowRight size={14} className="text-muted" /><b>{type?.name}</b></span></div>)}
            {ids.filter(keeps).map((id) => <div key={`k${id}`} className="px-4 py-3"><span className="text-muted">Betriebskonto {name(id)}</span><div className="font-medium">bleibt bis zum Ausgleich bestehen ({bal(id)})</div></div>)}
            <div className="flex justify-between px-4 py-3"><span className="text-muted">Gültig ab</span><span className="font-medium">{fmtDate(parseDate(from))}</span></div>
            <div className="px-4 py-3"><div className="text-muted">Grund</div><div className="mt-0.5 font-medium">{reason.trim()}</div></div>
          </div>
          <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} className="mt-0.5 h-5 w-5" />Ich bestätige die Änderung ohne Formular. Sie wird mit meinem Namen, dem Zeitpunkt und dem Grund im Verlauf protokolliert.</label>
        </div>
      ) : (
        <div className="space-y-6">
          <Banner><span className="block"><b>Normalerweise gibt es dafür ein Formular.</b> Es wird unterschrieben und als PDF abgelegt. Nimm diesen Weg nur, wenn das nicht geht, zum Beispiel bei einer Datenübernahme oder einem Fehler.</span>{memberId && <button onClick={() => { close(); nav(`/mitglieder?tab=antraege&new=aenderung&member=${memberId}`) }} className="mt-2 font-medium underline">Stattdessen Formular erstellen</button>}</Banner>

          {!memberId && (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">1 · Wer bekommt „{type?.name}“?</h3>
              <div className="relative"><Search size={16} className="absolute left-3 top-2.5 text-muted" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Mitglied suchen" className={clsx(inp, 'w-full pl-9')} /></div>
              <div className="max-h-64 divide-y divide-line overflow-y-auto rounded-xl border border-line">
                {pool.map((m) => (
                  <label key={m.id} className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm hover:bg-slate-50">
                    <input type="checkbox" checked={picked.includes(m.id)} onChange={() => setPicked((p) => (p.includes(m.id) ? p.filter((x) => x !== m.id) : [...p, m.id]))} className="h-4 w-4" />
                    <span className="flex-1"><span className="font-medium">{m.name}</span><span className="block text-xs text-muted">bisher {typeOf(m.id).name}{keeps(m.id) && <span className="text-amber-800"> · Konto bleibt bis zum Ausgleich ({bal(m.id)})</span>}</span></span>
                  </label>
                ))}
                {pool.length === 0 && <p className="px-3 py-4 text-sm text-muted">Niemand gefunden.</p>}
              </div>
            </section>
          )}

          {!typeId && (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">1 · {name(memberId!)}: Welche Mitgliedschaft?</h3>
              <p className="text-xs text-muted">Bisher: <b>{typeOf(memberId!).name}</b></p>
              <div className="grid gap-2 sm:grid-cols-2">
                {types.filter((t) => t.id !== typeOf(memberId!).id).map((t) => (
                  <button key={t.id} onClick={() => setTarget(t.id)} className={clsx('rounded-xl border p-3 text-left text-sm', target === t.id ? 'border-brand bg-brand-soft' : 'border-line hover:bg-slate-50')}>
                    <div className="flex items-baseline justify-between gap-2 font-medium">{t.name}<span className="tabular-nums">{eur(t.amount)} / {per(t.id)}</span></div>
                    <div className="mt-1 text-xs text-muted">{describe(patterns.find((p) => p.id === t.patternId)!)}</div>
                    <div className="mt-0.5 text-xs text-muted">{t.account ? 'mit Betriebskonto' : 'ohne Betriebskonto'}</div>
                  </button>
                ))}
              </div>
              {memberId && keeps(memberId) && <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm">Das Betriebskonto von {name(memberId)} bleibt bestehen, bis es ausgeglichen ist: <b>{bal(memberId)}</b></p>}
            </section>
          )}

          <section className="space-y-2">
            <h3 className="text-sm font-semibold">2 · Gültig ab</h3>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inp} aria-label="Gültig ab" />
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold">3 · Grund (Pflicht)</h3>
            <div className="flex flex-wrap gap-2">{reasons.map((r) => <button key={r} onClick={() => setReason(r)} className={clsx('rounded-lg border px-3 py-1.5 text-sm', reason === r ? 'border-brand bg-brand-soft text-brand' : 'border-line hover:bg-slate-50')}>{r}</button>)}</div>
            <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Warum geht das nicht mit einem Formular? Mindestens 10 Zeichen." className="w-full rounded-lg border border-line p-3 text-sm outline-none focus:border-brand" />
          </section>
        </div>
      )}
    </Drawer>
  )
}
