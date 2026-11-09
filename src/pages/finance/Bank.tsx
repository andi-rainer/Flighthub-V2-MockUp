import clsx from 'clsx'
import { Check, FileCheck2, FilePlus2, Link2, Plus, Sparkles, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { eur, members, type BankLine, type Receipt, type Split, type Target } from '../../data'
import { Badge, Button, Card, Drawer, Segmented, usePaging } from '../../ui'
import { useApp } from '../../state'
import { type Ledger } from './ledger'

const SAFE = 0.85
type Filter = 'offen' | 'ohne-beleg' | 'belege' | 'gebucht'

const confTone = (c: number) => (c >= SAFE ? 'ok' : c >= 0.6 ? 'warn' : 'bad')
const confLabel = (c: number) => (c >= SAFE ? 'sicher' : c >= 0.6 ? 'bitte prüfen' : 'unsicher')
const Dot = ({ c }: { c: number }) => <span className={clsx('inline-block h-2 w-2 rounded-full', { ok: 'bg-ok', warn: 'bg-warn', bad: 'bg-bad' }[confTone(c)])} />

export default function Bank({ ledger }: { ledger: Ledger }) {
  const [filter, setFilter] = useState<Filter>('offen')
  const [editing, setEditing] = useState<BankLine | null>(null)
  const [pickFor, setPickFor] = useState<BankLine | null>(null)
  const [lineFor, setLineFor] = useState<Receipt | null>(null)
  const { lines, done, receipts } = ledger
  const uploadRef = useRef<HTMLInputElement>(null)

  const linked = (l: BankLine) => receipts.filter((r) => r.lineId === l.id)
  const open = lines.filter((l) => !done[l.id])
  const safe = open.filter((l) => l.suggestion && l.suggestion.confidence >= SAFE)
  const noReceipt = lines.filter((l) => l.needsReceipt && linked(l).length === 0)
  const unlinked = receipts.filter((r) => !r.lineId)
  const paging = usePaging(filter === 'offen' ? open : filter === 'gebucht' ? lines.filter((l) => done[l.id]) : noReceipt, filter)
  const shown = paging.rows

  return (
    <div className="space-y-4">

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented<Filter> value={filter} onChange={setFilter} options={[
          { value: 'offen', label: `Offen (${open.length})` },
          { value: 'ohne-beleg', label: `Ohne Beleg (${noReceipt.length})` },
          { value: 'belege', label: `Belegeingang (${unlinked.length})` },
          { value: 'gebucht', label: `Gebucht (${Object.keys(done).length})` },
        ]} />
        <div className="flex gap-2">
          <input ref={uploadRef} type="file" multiple accept="application/pdf,image/*" className="hidden" onChange={(e) => Array.from(e.target.files ?? []).forEach((f) => ledger.uploadReceipt(f.name))} />
          <Button onClick={() => uploadRef.current?.click()}><FilePlus2 size={16} /> Beleg hochladen</Button>
          <Button>Kontoauszug importieren</Button>
          <Button variant="primary" disabled={safe.length === 0} onClick={() => ledger.assignMany(safe.map((l) => ({ lineId: l.id, target: l.suggestion!.target })))}>
            {safe.length} sichere bestätigen
          </Button>
        </div>
      </div>

      {filter === 'belege' ? (
        <Inbox ledger={ledger} onPickLine={setLineFor} />
      ) : (
        <div className="space-y-3">
          {shown.map((l) => (
            <Row key={l.id} ledger={ledger} line={l} onEdit={() => setEditing(l)} onReceipts={() => setPickFor(l)} />
          ))}
          {shown.length === 0 && <Card className="p-8 text-center text-muted">{filter === 'offen' ? 'Alles zugeordnet.' : 'Nichts in dieser Ansicht.'}</Card>}
          <Card>{paging.bar}</Card>
        </div>
      )}

      {editing && <Assign key={editing.id} line={editing} ledger={ledger} onClose={() => setEditing(null)} />}
      <ReceiptPicker line={pickFor} ledger={ledger} onClose={() => setPickFor(null)} />
      <LinePicker receipt={lineFor} ledger={ledger} onClose={() => setLineFor(null)} />
    </div>
  )
}

function Row({ ledger, line: l, onEdit, onReceipts }: { ledger: Ledger; line: BankLine; onEdit: () => void; onReceipts: () => void }) {
  const target = ledger.done[l.id]
  const s = l.suggestion
  const rs = ledger.receipts.filter((r) => r.lineId === l.id)
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1 basis-64">
          <div className="flex items-center gap-2 text-xs text-muted">{l.date}{l.source === 'Kassa' && <Badge tone="warn">Kassa</Badge>}</div>
          <div className="font-medium">{l.text}</div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {rs.map((r) => (
              <span key={r.id} className="inline-flex items-center gap-1.5 rounded-full bg-ok-soft px-2.5 py-0.5 text-xs font-medium text-ok"><FileCheck2 size={12} />{r.name}
                <button aria-label="Beleg lösen" onClick={() => ledger.unlinkReceipt(r.id)}><X size={12} /></button></span>
            ))}
            {l.needsReceipt && rs.length === 0 && (
              <button onClick={onReceipts} className="inline-flex items-center gap-1 rounded-full bg-warn-soft px-2.5 py-0.5 text-xs font-medium text-warn hover:bg-amber-200"><Link2 size={12} /> Beleg fehlt, zuordnen</button>
            )}
            {l.needsReceipt && rs.length > 0 && <button onClick={onReceipts} className="text-xs text-brand">+ weiterer Beleg</button>}
          </div>
        </div>

        <div className="min-w-0 flex-1 basis-64">
          {target ? (
            <div className="text-sm"><Badge tone="ok"><Check size={12} className="mr-1" />gebucht</Badge><div className="mt-1 font-medium">{ledger.label(target)}</div></div>
          ) : s ? (
            <div className="text-sm">
              <div className="flex flex-wrap items-center gap-2"><Badge tone="info">{ledger.kindOf(s.target)}</Badge><span className="font-medium">{ledger.label(s.target)}</span></div>
              <div className="mt-1 flex items-center gap-2 text-muted"><Dot c={s.confidence} />{confLabel(s.confidence)} · {s.why}</div>
            </div>
          ) : (
            <div className="text-sm text-warn">Kein Vorschlag. Bitte von Hand zuordnen.</div>
          )}
        </div>

        <div className={clsx('w-28 text-right font-semibold tabular-nums', l.amount < 0 ? 'text-bad' : 'text-ok')}>{eur(l.amount)}</div>

        {!target && (
          <div className="flex gap-2">
            <Button onClick={onEdit}>Ändern</Button>
            {s && <Button variant="primary" onClick={() => ledger.assign(l.id, s.target)}>Bestätigen</Button>}
          </div>
        )}
      </div>
      {l.check && (
        <div className={clsx('mt-3 rounded-lg px-3 py-2 text-sm', l.check.tone === 'ok' ? 'bg-ok-soft text-ok' : 'bg-warn-soft text-amber-900')}>
          <span className="inline-flex items-center gap-1.5 font-medium"><Sparkles size={13} /> KI-Abgleich mit dem Bordbuch</span>
          <div>{l.check.text}</div>
          {l.check.lines && <ul className="mt-1 list-disc pl-5 text-xs">{l.check.lines.map((x) => <li key={x}>{x}</li>)}</ul>}
        </div>
      )}
    </Card>
  )
}

/** Receipts that arrived (upload, e-mail, Bordbuch) and are not yet linked to a booking. */
function Inbox({ ledger, onPickLine }: { ledger: Ledger; onPickLine: (r: Receipt) => void }) {
  const list = ledger.receipts
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">Hier landen alle Belege: hochgeladen, per E-Mail oder aus dem Bordbuch. Jeder Beleg gehört zu einer Buchung.</p>
      {list.map((r) => {
        const line = ledger.lines.find((l) => l.id === r.lineId)
        return (
          <Card key={r.id} className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="min-w-0 flex-1 basis-56">
                <div className="flex items-center gap-2 font-medium"><FileCheck2 size={16} className="text-muted" /> {r.name} <Badge>{r.source}</Badge></div>
                <div className="text-sm text-muted">{r.supplier} · {r.date}{r.note ? ` · ${r.note}` : ''}</div>
              </div>
              <div className="w-24 text-right font-semibold tabular-nums">{r.amount ? eur(r.amount) : '–'}</div>
              <div className="min-w-0 flex-1 basis-64 text-sm">
                {line ? <span className="inline-flex items-center gap-2"><Badge tone="ok"><Check size={12} className="mr-1" />zugeordnet</Badge>{line.text}</span>
                  : r.suggestion ? <span className="inline-flex flex-wrap items-center gap-2"><Dot c={r.suggestion.confidence} /> passt zu <b>{ledger.lines.find((l) => l.id === r.suggestion!.lineId)?.text}</b> · <span className="text-muted">{r.suggestion.why}</span></span>
                  : <span className="text-warn">Keine passende Bankzeile gefunden.</span>}
              </div>
              <div className="flex gap-2">
                {line && <Button onClick={() => ledger.unlinkReceipt(r.id)}>Lösen</Button>}
                {!line && r.suggestion && <Button variant="primary" onClick={() => ledger.linkReceipt(r.id, r.suggestion!.lineId)}>Bestätigen</Button>}
                {!line && <Button onClick={() => onPickLine(r)}>Zeile wählen</Button>}
                {!line && !r.suggestion && r.amount > 0 && <Button onClick={() => ledger.createCashLine(r.id)}>Als Kassa-Buchung</Button>}
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}

function ReceiptPicker({ line, ledger, onClose }: { line: BankLine | null; ledger: Ledger; onClose: () => void }) {
  const ref = useRef<HTMLInputElement>(null)
  const list = ledger.receipts.filter((r) => !r.lineId).sort((a, b) => Number(Math.abs(b.amount) === Math.abs(line?.amount ?? 0)) - Number(Math.abs(a.amount) === Math.abs(line?.amount ?? 0)))
  return (
    <Drawer open={!!line} title="Beleg zuordnen" onClose={onClose}>
      {line && (
        <div className="space-y-4">
          <div className="rounded-xl bg-slate-50 p-4"><div className="text-sm">{line.text}</div><div className="text-xl font-semibold tabular-nums">{eur(line.amount)}</div></div>
          <div className="text-sm font-medium">Belege im Eingang ({list.length})</div>
          {list.map((r) => {
            const match = Math.abs(r.amount) === Math.abs(line.amount)
            return (
              <div key={r.id} className="flex items-center gap-3 rounded-xl border border-line p-3 text-sm">
                <div className="min-w-0 flex-1"><div className="truncate font-medium">{r.name}</div><div className="text-xs text-muted">{r.supplier} · {r.amount ? eur(r.amount) : 'Betrag wird gelesen'} {match && <Badge tone="ok">Betrag passt</Badge>}</div></div>
                <Button onClick={() => { ledger.linkReceipt(r.id, line.id); onClose() }}>Zuordnen</Button>
              </div>
            )
          })}
          {list.length === 0 && <p className="text-sm text-muted">Kein freier Beleg im Eingang.</p>}
          <input ref={ref} type="file" accept="application/pdf,image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { ledger.uploadReceipt(f.name, line.id); onClose() } }} />
          <Button className="w-full" size="lg" onClick={() => ref.current?.click()}><FilePlus2 size={16} /> Neuen Beleg hochladen</Button>
        </div>
      )}
    </Drawer>
  )
}

function LinePicker({ receipt, ledger, onClose }: { receipt: Receipt | null; ledger: Ledger; onClose: () => void }) {
  const list = ledger.lines.filter((l) => l.needsReceipt && !ledger.receipts.some((r) => r.lineId === l.id))
  return (
    <Drawer open={!!receipt} title="Zu welcher Buchung gehört der Beleg?" onClose={onClose}>
      {receipt && (
        <div className="space-y-3">
          <div className="rounded-xl bg-slate-50 p-4 text-sm"><div className="font-medium">{receipt.name}</div><div className="text-muted">{receipt.supplier} · {receipt.amount ? eur(receipt.amount) : '–'}</div></div>
          {list.map((l) => (
            <button key={l.id} onClick={() => { ledger.linkReceipt(receipt.id, l.id); onClose() }} className="flex w-full items-center justify-between gap-3 rounded-xl border border-line p-3 text-left text-sm hover:bg-slate-50">
              <span><span className="block text-xs text-muted">{l.date}</span>{l.text}</span><span className="font-semibold tabular-nums">{eur(l.amount)}</span>
            </button>
          ))}
          {list.length === 0 && <p className="text-sm text-muted">Alle Buchungen haben schon einen Beleg.</p>}
        </div>
      )}
    </Drawer>
  )
}

/** Book to a member account OR to one or more cost centers (split). Cost centers and categories are user managed. */
function Assign({ line, ledger, onClose }: { line: BankLine; ledger: Ledger; onClose: () => void }) {
  const { hasAccount } = useApp()
  const accountMembers = members.filter((m) => hasAccount(m.id))
  const type = line.amount < 0 ? 'Kosten' : 'Ertrag'
  const sug = line.suggestion?.target
  const [mode, setMode] = useState<'konto' | 'buchung'>(sug?.kind ?? (line.amount > 0 && /ÜW/.test(line.text) ? 'konto' : 'buchung'))
  const [memberId, setMemberId] = useState(sug?.kind === 'konto' ? sug.memberId : accountMembers[0].id)
  const ccs = ledger.costCenters.filter((c) => !c.archived)
  const cats = ledger.categories.filter((c) => !c.archived && c.type === type)
  const [splits, setSplits] = useState<Split[]>(sug?.kind === 'buchung' ? sug.splits : [{ costCenterId: ccs[0].id, categoryId: cats[0]?.id ?? '', percent: 100 }])
  const [adding, setAdding] = useState<null | 'cc' | 'cat'>(null)
  const [newName, setNewName] = useState('')

  const sum = splits.reduce((n, s) => n + s.percent, 0)
  const valid = mode === 'konto' || (sum === 100 && splits.every((s) => s.categoryId))
  const patch = (i: number, p: Partial<Split>) => setSplits(splits.map((s, k) => (k === i ? { ...s, ...p } : s)))
  const spreadAircraft = () => {
    const ac = ccs.filter((c) => c.kind === 'Flugzeug')
    const each = Math.floor(100 / ac.length)
    setSplits(ac.map((c, i) => ({ costCenterId: c.id, categoryId: splits[0].categoryId, percent: i === 0 ? 100 - each * (ac.length - 1) : each })))
  }
  const field = 'h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm'
  const target: Target = mode === 'konto' ? { kind: 'konto', memberId } : { kind: 'buchung', splits }

  return (
    <Drawer open title="Zuordnen" onClose={onClose} footer={<Button variant="primary" size="lg" className="w-full" disabled={!valid} onClick={() => { ledger.assign(line.id, target); onClose() }}>Zuordnen und buchen</Button>}>
      <div className="space-y-5">
        <div className="rounded-xl bg-slate-50 p-4"><div className="text-sm">{line.text}</div><div className="text-xl font-semibold tabular-nums">{eur(line.amount)}</div></div>
        <Segmented<'konto' | 'buchung'> value={mode} onChange={setMode} options={[{ value: 'konto', label: 'Betriebskonto' }, { value: 'buchung', label: 'Kostenstelle' }]} />

        {mode === 'konto' ? (
          <label className="block text-sm">Mitglied
            <select className={clsx(field, 'mt-1')} value={memberId} onChange={(e) => setMemberId(e.target.value)}>{accountMembers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
          </label>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm"><span className="font-medium">{type} auf Kostenstelle(n)</span>
              <span className={clsx('tabular-nums', sum === 100 ? 'text-ok' : 'text-bad')}>{sum} %</span></div>
            {splits.map((s, i) => (
              <div key={i} className="space-y-2 rounded-xl border border-line p-3">
                <div className="flex gap-2">
                  <select className={field} value={s.costCenterId} onChange={(e) => patch(i, { costCenterId: e.target.value })}>{ccs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                  {splits.length > 1 && <button aria-label="Zeile entfernen" onClick={() => setSplits(splits.filter((_, k) => k !== i))} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg hover:bg-slate-100"><X size={16} /></button>}
                </div>
                <div className="flex gap-2">
                  <select className={field} value={s.categoryId} onChange={(e) => patch(i, { categoryId: e.target.value })}>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}{c.fixed ? ' (fix)' : ''}</option>)}</select>
                  <div className="flex items-center gap-1"><input inputMode="numeric" value={s.percent} onChange={(e) => patch(i, { percent: Number(e.target.value) || 0 })} className="h-11 w-16 rounded-lg border border-line text-right tabular-nums" />%</div>
                </div>
                <div className="text-xs text-muted">{eur((line.amount * s.percent) / 100)}</div>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setSplits([...splits, { costCenterId: ccs[0].id, categoryId: splits[0].categoryId, percent: Math.max(0, 100 - sum) }])}><Plus size={14} /> Aufteilen</Button>
              <Button onClick={spreadAircraft}>Auf alle Flugzeuge verteilen</Button>
            </div>
            <div className="border-t border-line pt-3 text-sm">
              {adding ? (
                <div className="flex gap-2"><input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={adding === 'cc' ? 'Name der Kostenstelle' : `Name der ${type === 'Kosten' ? 'Kostenart' : 'Ertragsart'}`} className={field} />
                  <Button variant="primary" disabled={!newName.trim()} onClick={() => { adding === 'cc' ? ledger.addCostCenter(newName.trim(), 'Allgemein') : ledger.addCategory(newName.trim(), type, false); setNewName(''); setAdding(null) }}>Anlegen</Button>
                  <Button onClick={() => setAdding(null)}>Abbrechen</Button></div>
              ) : (
                <div className="flex gap-4 text-brand"><button onClick={() => setAdding('cc')}>+ Neue Kostenstelle</button><button onClick={() => setAdding('cat')}>+ Neue {type === 'Kosten' ? 'Kostenart' : 'Ertragsart'}</button></div>
              )}
            </div>
          </div>
        )}
      </div>
    </Drawer>
  )
}
