import { ChevronDown, ChevronRight, Plus } from 'lucide-react'
import { useState } from 'react'
import { useSession } from '../../session/session'
import { TODAY_ISO, useApp } from '../../state'
import { ActionPanel, Badge, Button, Field, field } from '../../ui'
import { dmy } from '../manifest/data'
import { useActor } from '../tickets/parts'
import { STATE_LABEL, STATE_TONE, type MemberDocView } from './memberDocs'

const input = `${field} w-full`
const stamp = () => `${TODAY_ISO} ${new Date().toTimeString().slice(0, 5)}`

/**
 * The documents of one member (licence, medical ...). No file is stored (privacy): what counts is that a person with `documents.approve`
 * checked the ORIGINAL and confirms it, with name and day in the history. A newer document is announced by the member (new expiry date, it
 * waits for the check) or entered in person at the dropzone (the checker confirms, no second step). The old data stay in the history.
 * Used in the member file, in the manifest and on the own start page.
 */
export default function MemberDocuments({ memberId, title = 'Ausweise und Lizenzen' }: { memberId: string; title?: string }) {
  const { docsOf, persona, can } = useApp()
  const docs = docsOf(memberId)
  const [open, setOpen] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const staff = can('documents.approve')
  const own = persona.memberId === memberId
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2"><div className="text-sm font-semibold">{title}</div>{staff && !adding && <Button onClick={() => setAdding(true)}><Plus size={14} /> Dokument hinzufügen</Button>}</div>
      {adding && <div className="mb-3"><NewDoc memberId={memberId} onClose={() => setAdding(false)} /></div>}
      <div className="divide-y divide-line">
        {docs.map((d) => (
          <div key={d.id}>
            <button onClick={() => setOpen(open === d.id ? null : d.id)} className="flex w-full items-center justify-between gap-3 py-2.5 text-left text-sm hover:bg-slate-50">
              <span className="flex min-w-0 items-center gap-2">{open === d.id ? <ChevronDown size={14} className="shrink-0 text-muted" /> : <ChevronRight size={14} className="shrink-0 text-muted" />}<span className="truncate font-medium">{d.label}</span>{d.number && <span className="text-xs text-muted">{d.number}</span>}</span>
              <span className="flex shrink-0 items-center gap-2 text-muted">bis {dmy(d.expires)}{d.submitted && <Badge tone="info">zur Prüfung</Badge>}<Badge tone={STATE_TONE[d.state]}>{STATE_LABEL[d.state]}</Badge></span>
            </button>
            {open === d.id && <div className="pb-3 pl-6"><Detail memberId={memberId} doc={d} staff={staff} own={own} /></div>}
          </div>
        ))}
        {docs.length === 0 && <p className="py-2 text-sm text-muted">Keine erfasst.</p>}
      </div>
    </div>
  )
}

type Panel = 'renew' | 'review' | 'reject' | null

/** One document: facts, a presented newer document to check, the actions and the history. */
function Detail({ memberId, doc, staff, own }: { memberId: string; doc: MemberDocView; staff: boolean; own: boolean }) {
  const { setMemberDocs } = useApp()
  const { guarded } = useSession()
  const actor = useActor()
  const [panel, setPanel] = useState<Panel>(null)
  const [reason, setReason] = useState('')
  const [seen, setSeen] = useState(false)
  const change = (fn: (d: MemberDocView) => Partial<MemberDocView>, text: string) => {
    setMemberDocs(memberId, (all) => all.map((x) => (x.id === doc.id ? { ...x, ...(fn(doc) as object), history: [...x.history, { at: stamp(), by: actor, text }] } : x)))
    setPanel(null); setReason(''); setSeen(false)
  }
  const sub = doc.submitted
  const approve = () => guarded('documents.approve', () => change(() => ({ expires: sub!.expires, number: sub!.number ?? doc.number, submitted: undefined }), `Freigegeben, gültig bis ${dmy(sub!.expires)}, Original geprüft (gemeldet von ${sub!.by})`))
  const reject = () => guarded('documents.approve', () => change(() => ({ submitted: undefined }), `Abgelehnt: ${reason.trim()}`))

  return (
    <div className="space-y-3 text-sm">
      {sub && (
        <div className="space-y-2 rounded-xl border border-brand/30 bg-brand-soft/40 p-3">
          <div className="font-medium">Neues Dokument wartet auf die Prüfung</div>
          <div className="text-muted">Gemeldet von {sub.by} am {dmy(sub.at.slice(0, 10))} · neu gültig bis <b className="text-ink">{dmy(sub.expires)}</b>{sub.number ? ` · Nr. ${sub.number}` : ''}</div>
          {staff && panel !== 'reject' && (
            <>
              <label className="flex items-center gap-2"><input type="checkbox" checked={seen} onChange={(e) => setSeen(e.target.checked)} />Ich habe das Original geprüft</label>
              <div className="flex gap-2"><Button variant="primary" disabled={!seen} onClick={approve}>Freigeben</Button><Button onClick={() => setPanel('reject')}>Ablehnen</Button></div>
            </>
          )}
          {!staff && <div className="text-xs text-muted">Bis zur Freigabe gilt weiter das alte Ablaufdatum.</div>}
        </div>
      )}
      {panel === 'reject' && (
        <ActionPanel danger title="Ablehnen" confirm="Ablehnen" disabled={!reason.trim()} onConfirm={reject} onCancel={() => setPanel(null)}>
          <Field label="Grund"><textarea aria-label="Ablehnungsgrund" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} className="w-full rounded-lg border border-line bg-surface p-2.5 text-sm outline-none focus:border-brand" /></Field>
        </ActionPanel>
      )}
      {panel === 'renew' && <RenewForm doc={doc} staff={staff} onCancel={() => setPanel(null)} onDone={(f) => (staff
        ? guarded('documents.approve', () => change(() => ({ expires: f.expires, number: f.number || doc.number, submitted: undefined }), `Erneuert, gültig bis ${dmy(f.expires)}, Original geprüft`))
        : change(() => ({ submitted: { expires: f.expires, number: f.number || undefined, by: actor, at: stamp() } }), `Neues Dokument gemeldet, gültig bis ${dmy(f.expires)}, wartet auf die Prüfung des Originals`))} />}
      {panel === null && (staff || own) && !sub && <Button onClick={() => setPanel('renew')}>{staff ? 'Erneuern' : 'Neues Dokument melden'}</Button>}
      <ol className="space-y-1 border-l border-line pl-4">
        {[...doc.history].reverse().map((h, i) => <li key={i} className="text-xs"><span className="text-muted">{dmy(h.at.slice(0, 10))} · {h.by}</span><div className="text-sm">{h.text}</div></li>)}
      </ol>
    </div>
  )
}

interface RenewValues { expires: string; number: string }

/** A newer document: the new expiry date and number. Staff confirm they checked the original; a member only announces it. */
function RenewForm({ doc, staff, onDone, onCancel }: { doc: MemberDocView; staff: boolean; onDone: (v: RenewValues) => void; onCancel: () => void }) {
  const [expires, setExpires] = useState('')
  const [number, setNumber] = useState(doc.number ?? '')
  const [seen, setSeen] = useState(false)
  const min = (doc.expires > TODAY_ISO ? doc.expires : TODAY_ISO)
  const ok = expires > min && (!staff || seen)
  return (
    <ActionPanel title={staff ? `${doc.label} erneuern` : `Neues Dokument für ${doc.label}`} confirm={staff ? 'Erneuern' : 'Zur Prüfung melden'} disabled={!ok} onConfirm={() => onDone({ expires, number })} onCancel={onCancel}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Neu gültig bis"><input type="date" aria-label="Neu gültig bis" min={min} value={expires} onChange={(e) => setExpires(e.target.value)} className={input} /></Field>
        <Field label="Nummer (optional)"><input aria-label="Nummer" value={number} onChange={(e) => setNumber(e.target.value)} className={input} /></Field>
      </div>
      {staff && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={seen} onChange={(e) => setSeen(e.target.checked)} />Ich habe das Original geprüft</label>}
    </ActionPanel>
  )
}

/** A document that does not exist yet (staff). It is entered as checked. */
function NewDoc({ memberId, onClose }: { memberId: string; onClose: () => void }) {
  const { setMemberDocs } = useApp()
  const { guarded } = useSession()
  const actor = useActor()
  const [label, setLabel] = useState('')
  const [expires, setExpires] = useState('')
  const [number, setNumber] = useState('')
  const [seen, setSeen] = useState(false)
  const ok = label.trim() !== '' && expires > TODAY_ISO && seen
  const save = () => guarded('documents.approve', () => { setMemberDocs(memberId, (all) => [...all, { id: `${memberId}-${Date.now()}`, label: label.trim(), expires, number: number.trim() || undefined, history: [{ at: stamp(), by: actor, text: `Erfasst, gültig bis ${dmy(expires)}, Original geprüft` }] }]); onClose() })
  return (
    <ActionPanel title="Dokument hinzufügen" confirm="Hinzufügen" disabled={!ok} onConfirm={save} onCancel={onClose}>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Bezeichnung"><input aria-label="Bezeichnung" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="z. B. Lizenz B" className={input} /></Field>
        <Field label="Gültig bis"><input type="date" aria-label="Gültig bis" min={TODAY_ISO} value={expires} onChange={(e) => setExpires(e.target.value)} className={input} /></Field>
        <Field label="Nummer (optional)"><input aria-label="Nummer" value={number} onChange={(e) => setNumber(e.target.value)} className={input} /></Field>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={seen} onChange={(e) => setSeen(e.target.checked)} />Ich habe das Original geprüft</label>
    </ActionPanel>
  )
}
