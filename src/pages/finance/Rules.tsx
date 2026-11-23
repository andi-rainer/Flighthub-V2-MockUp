import clsx from 'clsx'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { eur, members } from '../../data'
import MemberPicker from '../../MemberPicker'
import { useApp } from '../../state'
import { Button, ConfirmDelete, Drawer, Segmented, Switch } from '../../ui'
import { dmy } from '../manifest/data'
import { Field, field, useActor } from '../tickets/parts'
import { type Ledger } from './ledger'
import { newRuleId, removeRule, ruleHits, saveRule, useRules, type Rule } from './ruleStore'

const DIR = { alle: 'Ein- und Ausgang', ein: 'Nur Eingang', aus: 'Nur Ausgang' } as const

/** What a rule books on, in words. */
export function ruleTargetLabel(r: Pick<Rule, 'target'>, ledger: Ledger) {
  const t = r.target
  if (t.kind === 'umbuchung') return `Umbuchung ${ledger.accountName(t.accountId)}`
  if (t.kind === 'konto') return `Betriebskonto ${members.find((m) => m.id === t.memberId)?.name ?? '?'}`
  return ledger.label(t)
}

/** [Entwurf] The club's assignment rules: a list, each with its hits; a click edits it. */
export function RulesDrawer({ ledger, onClose }: { ledger: Ledger; onClose: () => void }) {
  const rules = useRules()
  const [form, setForm] = useState<Partial<Rule> | null>(null)
  const hits = (r: Rule) => ledger.lines.filter((l) => ruleHits(r, l)).length
  return (
    <>
      <Drawer open={!form} title="Regeln für Vorschläge" size="xl" onClose={onClose} footer={<div className="flex justify-end"><Button onClick={onClose}>Schließen</Button></div>}>
        <div className="space-y-3 text-sm">
          <div className="flex justify-end"><Button variant="primary" onClick={() => setForm({})}><Plus size={15} /> Regel anlegen</Button></div>
          <div className="divide-y divide-line rounded-xl border border-line">
            <div className="hidden grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,1.5fr)_5rem_4rem] gap-3 bg-slate-50 px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted md:grid">
              <span>Regel</span><span>Wenn Bank-Text enthält</span><span>Dann</span><span className="text-right">Treffer</span><span>Aktiv</span>
            </div>
            {rules.map((r) => (
              <div key={r.id} role="button" tabIndex={0} onClick={() => setForm(r)} onKeyDown={(e) => e.key === 'Enter' && setForm(r)}
                className={clsx('grid cursor-pointer gap-x-3 gap-y-0.5 px-3 py-2 hover:bg-slate-50 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,1.5fr)_5rem_4rem] md:items-center', !r.active && 'opacity-60')}>
                <span className="min-w-0"><span className="block truncate font-medium">{r.name}</span><span className="text-xs text-muted">{r.by} · {dmy(r.at)}</span></span>
                <span className="min-w-0 truncate">„{r.match}“{r.iban && <span className="text-xs text-muted"> · IBAN {r.iban}</span>}<span className="block text-xs text-muted">{DIR[r.dir]}</span></span>
                <span className="min-w-0 truncate">{ruleTargetLabel(r, ledger)}{r.supplier && <span className="block truncate text-xs text-muted">Rechnung von {r.supplier}</span>}</span>
                <span className="tabular-nums text-muted md:text-right">{hits(r)}</span>
                <span onClick={(e) => e.stopPropagation()}><Switch checked={r.active} onChange={(v) => saveRule({ ...r, active: v })} label={`${r.name} aktiv`} /></span>
              </div>
            ))}
            {rules.length === 0 && <p className="p-4 text-muted">Noch keine Regeln.</p>}
          </div>
        </div>
      </Drawer>
      {form && <RuleForm ledger={ledger} rule={form} onClose={() => setForm(null)} />}
    </>
  )
}

/** One rule: condition and target. A new rule from a booking comes prefilled with its text and its target. */
export function RuleForm({ ledger, rule, onClose }: { ledger: Ledger; rule: Partial<Rule>; onClose: () => void }) {
  const actor = useActor()
  const { hasAccount } = useApp()
  const existing = !!rule.id
  const ccs = ledger.costCenters.filter((c) => !c.archived)
  const accounts = ledger.accounts.filter((a) => !a.archived)
  const [name, setName] = useState(rule.name ?? '')
  const [match, setMatch] = useState(rule.match ?? '')
  const [iban, setIban] = useState(rule.iban ?? '')
  const [dir, setDir] = useState<Rule['dir']>(rule.dir ?? 'aus')
  const [kind, setKind] = useState<Rule['target']['kind']>(rule.target?.kind ?? 'buchung')
  const first = rule.target?.kind === 'buchung' ? rule.target.splits[0] : undefined
  const [cc, setCc] = useState(first?.costCenterId ?? '')
  const [cat, setCat] = useState(first?.categoryId ?? '')
  const [acc, setAcc] = useState(rule.target?.kind === 'umbuchung' ? rule.target.accountId : '')
  const [member, setMember] = useState(rule.target?.kind === 'konto' ? rule.target.memberId : '')
  const [supplier, setSupplier] = useState(rule.supplier ?? '')
  const splits = rule.target?.kind === 'buchung' && rule.target.splits.length > 1 ? rule.target.splits : null
  const cats = ledger.categories.filter((c) => !c.archived && (dir === 'alle' || c.type === (dir === 'ein' ? 'Ertrag' : 'Kosten')))
  const target: Rule['target'] | null =
    kind === 'umbuchung' ? (acc ? { kind, accountId: acc } : null)
      : kind === 'konto' ? (member ? { kind, memberId: member } : null)
        : splits ? { kind, splits } : cc && cat ? { kind, splits: [{ costCenterId: cc, categoryId: cat, percent: 100 }] } : null
  const draft: Rule = { id: rule.id ?? newRuleId(), name: name.trim() || match.trim(), match: match.trim(), iban: iban.trim() || undefined, dir, target: target ?? { kind: 'konto', memberId: '' }, supplier: supplier.trim() || undefined, active: rule.active ?? true, by: rule.by ?? actor, at: rule.at ?? '2026-11-07' }
  const hits = match.trim() ? ledger.lines.filter((l) => ruleHits(draft, l)) : []
  const valid = match.trim() !== '' && !!target
  const suppliers = [...new Set(ledger.receipts.map((r) => r.supplier))].sort()

  return (
    <Drawer open title={existing ? `Regel: ${rule.name}` : 'Regel anlegen'} onClose={onClose}
      footer={<div className="relative flex items-center justify-between gap-2">{existing ? <ConfirmDelete what={rule.name ?? ''} onConfirm={() => { removeRule(rule.id!); onClose() }} /> : <span />}<div className="flex gap-2"><Button onClick={onClose}>Abbrechen</Button><Button variant="primary" disabled={!valid} onClick={() => { saveRule(draft); ledger.notify(existing ? 'Regel gespeichert' : `Regel angelegt: ${draft.name}`); onClose() }}>{existing ? 'Speichern' : 'Regel anlegen'}</Button></div></div>}>
      <div className="space-y-4 text-sm">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted">Wenn</div>
        <Field label="Bank-Text enthält"><input aria-label="Bank-Text enthält" value={match} onChange={(e) => setMatch(e.target.value)} placeholder="z. B. Shell Austria" className={`${field} w-full`} /></Field>
        <Field label="IBAN (optional)"><input aria-label="IBAN" value={iban} onChange={(e) => setIban(e.target.value)} placeholder="AT.." className={`${field} w-full font-mono`} /></Field>
        <Segmented<Rule['dir']> value={dir} onChange={setDir} options={[{ value: 'aus', label: 'Ausgang' }, { value: 'ein', label: 'Eingang' }, { value: 'alle', label: 'Beides' }]} />

        <div className="border-t border-line pt-3 text-xs font-semibold uppercase tracking-wide text-muted">Dann vorschlagen</div>
        <Segmented<Rule['target']['kind']> value={kind} onChange={setKind} options={[{ value: 'buchung', label: 'Kostenstelle' }, { value: 'umbuchung', label: 'Eigenes Konto' }, { value: 'konto', label: 'Betriebskonto' }]} />
        {kind === 'buchung' && (splits
          ? <div className="rounded-lg border border-line px-3 py-2">{ledger.label({ kind: 'buchung', splits })}</div>
          : <div className="grid grid-cols-2 gap-2">
            <select aria-label="Kostenstelle" value={cc} onChange={(e) => setCc(e.target.value)} className={field}><option value="">Kostenstelle wählen</option>{ccs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            <select aria-label="Kostenart" value={cat} onChange={(e) => setCat(e.target.value)} className={field}><option value="">Kostenart wählen</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          </div>)}
        {kind === 'umbuchung' && <select aria-label="Konto" value={acc} onChange={(e) => setAcc(e.target.value)} className={`${field} w-full`}><option value="">Konto wählen</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>}
        {kind === 'konto' && <MemberPicker ariaLabel="Mitglied" value={member} allow={(m) => hasAccount(m.id)} onChange={(id) => setMember(id ?? '')} />}
        {kind === 'buchung' && (
          <Field label="Rechnung erwartet von (optional)">
            <select aria-label="Lieferant" value={supplier} onChange={(e) => setSupplier(e.target.value)} className={`${field} w-full`}><option value="">Kein bestimmter Lieferant</option>{suppliers.map((s) => <option key={s} value={s}>{s}</option>)}</select>
          </Field>
        )}
        <Field label="Name der Regel"><input aria-label="Name der Regel" value={name} onChange={(e) => setName(e.target.value)} placeholder={match || 'z. B. Shell Treibstoff'} className={`${field} w-full`} /></Field>

        {match.trim() && (
          <div className="rounded-xl border border-line">
            <div className="border-b border-line bg-slate-50 px-3 py-1.5 text-xs font-medium text-muted">Passt auf {hits.length} Buchungen</div>
            <ul className="divide-y divide-line">
              {hits.slice(0, 5).map((l) => <li key={l.id} className="flex items-center gap-3 px-3 py-1.5"><span className="w-16 shrink-0 text-xs text-muted">{dmy(l.date)}</span><span className="min-w-0 flex-1 truncate">{l.text}</span><span className={clsx('shrink-0 tabular-nums', l.amount < 0 ? 'text-bad' : 'text-ok')}>{eur(l.amount)}</span></li>)}
              {hits.length > 5 && <li className="px-3 py-1.5 text-xs text-muted">und {hits.length - 5} weitere</li>}
            </ul>
          </div>
        )}
      </div>
    </Drawer>
  )
}
