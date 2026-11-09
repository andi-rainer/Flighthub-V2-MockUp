import { ExternalLink } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { type Member } from '../../data'
import { useApp } from '../../state'
import { Badge, Card, Segmented, usePaging } from '../../ui'
import { KIND_LABEL } from './data'

type Kind = 'Alle' | 'Formular' | 'Stammdaten' | 'Mitgliedschaft'
const tone = { Formular: 'info', Stammdaten: 'neutral', Mitgliedschaft: 'warn' } as const
/** "05.11.2026 14:12" or "Schriftführer, 22.10.2026" -> sortable "2026-11-05 14:12" */
const iso = (s: string, fallbackTime = '09:00') => {
  const m = s.match(/(\d{2})\.(\d{2})\.(\d{4})(?: (\d{2}:\d{2}))?/)
  return m ? `${m[3]}-${m[2]}-${m[1]} ${m[4] ?? fallbackTime}` : ''
}
const show = (at: string) => { const [d, t] = at.split(' '); return `${d.split('-').reverse().join('.')} ${t}` }
interface Row { key: string; at: string; type: Exclude<Kind, 'Alle'>; text: string; details?: string[]; by?: string; appId?: string; exception?: { from: string; reason: string; created?: boolean } }

/**
 * The history of one member shows only what matters for the administration: forms, changes of personal data and changes
 * of the membership. Check-ins and bookings on the Betriebskonto are tracked elsewhere and do not belong here.
 */
export default function MemberHistory({ member }: { member: Member }) {
  const nav = useNavigate()
  const { apps, history } = useApp()
  const formOf = (id?: string) => apps.find((a) => a.id === id)
  const [kind, setKind] = useState<Kind>('Alle')
  const rows: Row[] = [
    ...apps.filter((a) => a.memberId === member.id || a.person === member.name).flatMap((a): Row[] => [
      { key: `${a.id}-new`, at: iso(a.date), type: 'Formular', appId: a.id, text: `Antrag „${KIND_LABEL[a.kind]}“ angelegt${a.channel ? ` (${a.channel})` : ''}`, details: [`${a.formName}, Version ${a.formVersion}`] },
      ...(a.signedAt ? [{ key: `${a.id}-sig`, at: iso(a.signedAt), type: 'Formular' as const, text: a.channel === 'Vorstand' ? 'Ohne Unterschrift vom Vorstand abgelegt' : 'Formular unterschrieben', details: a.pdf ? [`PDF: ${a.pdf}`] : undefined, by: a.verified ? `Identität bestätigt: ${a.verified}` : undefined }] : []),
      ...(a.decidedBy ? [{ key: `${a.id}-dec`, at: iso(a.decidedBy, '12:00'), type: 'Formular' as const, text: `Antrag ${a.status.toLowerCase()}`, by: a.decidedBy.split(',')[0] }] : []),
    ]),
    ...history.filter((h) => h.memberId === member.id).map((h): Row => ({ key: `h${h.id}`, at: h.at, type: h.type, text: h.text, details: h.details, by: h.by, appId: h.appId, exception: h.exception })),
  ].sort((x, y) => y.at.localeCompare(x.at))
  const list = rows.filter((r) => kind === 'Alle' || r.type === kind)
  const paging = usePaging(list, `${member.id}|${kind}`, [10, 25, 50])
  return (
    <div className="max-w-3xl space-y-3">
      <Segmented<Kind> value={kind} onChange={setKind} options={[{ value: 'Alle', label: 'Alle' }, { value: 'Formular', label: 'Formulare' }, { value: 'Stammdaten', label: 'Stammdaten' }, { value: 'Mitgliedschaft', label: 'Mitgliedschaft' }]} />
      <Card className="divide-y divide-line overflow-hidden">
        {paging.rows.map((r) => (
          <div key={r.key} className="flex gap-4 px-5 py-3 text-sm">
            <span className="w-32 shrink-0 text-xs tabular-nums text-muted">{show(r.at)}</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><Badge tone={tone[r.type]}>{r.type === 'Formular' ? 'Formular' : r.type}</Badge><span className="font-medium">{r.text}</span></div>
              {r.exception && (
                <div className="mt-1.5 rounded-lg border border-warn/40 bg-warn-soft px-3 py-2 text-xs text-amber-900">
                  <div className="font-semibold">{r.exception.created ? `Ohne Formular angelegt (Ausnahme) · Mitglied ab ${r.exception.from}` : `Ohne Formular, Vorstandsausnahme · gültig ab ${r.exception.from}`}</div>
                  <div className="mt-0.5">Grund: {r.exception.reason}</div>
                </div>
              )}
              {r.appId && formOf(r.appId) && <button onClick={() => nav(`/mitglieder?tab=antraege&open=${r.appId}`)} className="mt-1 inline-flex items-center gap-1 text-xs text-brand hover:underline"><ExternalLink size={12} />{formOf(r.appId)!.formName}{formOf(r.appId)!.pdf ? ` · ${formOf(r.appId)!.pdf}` : ''}</button>}
              {r.details && <ul className="mt-1 space-y-0.5 text-xs text-muted">{r.details.map((d) => <li key={d}>{d}</li>)}</ul>}
              {r.by && <div className="mt-0.5 text-xs text-muted">{r.by}</div>}
            </div>
          </div>
        ))}
        {list.length === 0 && <p className="px-5 py-8 text-center text-sm text-muted">Noch nichts in dieser Auswahl.</p>}
        {list.length > 10 && paging.bar}
      </Card>
    </div>
  )
}
