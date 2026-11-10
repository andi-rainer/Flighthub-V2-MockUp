import { ChevronRight, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { eur, members } from '../../data'
import { useApp } from '../../state'
import { Badge, Card, Segmented, usePaging } from '../../ui'
import { feeIsOpen, feeLabel, feeOf, feeTone } from './data'

const tone = { ok: 'ok', bald: 'warn', abgelaufen: 'bad' } as const
type Filter = 'alle' | 'offen' | 'bezahlt' | 'ausnahme'

/**
 * Dense PC list. The row says everything that needs attention (fee, documents, weight) and a click opens the
 * Mitgliederakte, where every action lives. No buttons in the rows: payments are booked in Finanzen.
 */
export default function List() {
  const nav = useNavigate()
  const { ledger, weights, hasAccount, windDown, functionNames, typeOf, fees, apps, docsOf } = useApp()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('alle')
  const feeFor = (name: string) => feeOf(fees, name)
  const manualCount = members.filter((m) => m.manual).length
  const openCount = members.filter((m) => feeIsOpen(feeFor(m.name))).length
  const list = useMemo(
    () => members.filter((m) => m.name.toLowerCase().includes(q.toLowerCase()) && (filter === 'alle' || (filter === 'ausnahme' ? !!m.manual : filter === 'offen' ? feeIsOpen(feeFor(m.name)) : feeFor(m.name)?.state === 'bezahlt'))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [q, filter, fees],
  )
  const paging = usePaging(list, `${q}|${filter}`)
  const ends = (name: string) => apps.find((a) => a.kind === 'Beendigung' && a.status === 'Genehmigt' && a.person === name)?.answers['Austritt zum']

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search size={16} className="absolute left-3 top-2.5 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Suchen" className="h-9 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-sm outline-none focus:border-brand" />
        </div>
        <Segmented value={filter} onChange={setFilter} options={[{ value: 'alle', label: 'Alle' }, { value: 'offen', label: `Beitrag offen (${openCount})` }, { value: 'bezahlt', label: 'Bezahlt' }, ...(manualCount ? [{ value: 'ausnahme' as Filter, label: `Ohne Formular (${manualCount})` }] : [])]} />
        <span className="text-sm text-muted">{list.length} Mitglieder</span>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">Mitgliedschaft</th>
              <th className="px-4 py-3 font-medium">Beitrag</th>
              <th className="hidden px-4 py-3 font-medium xl:table-cell">Funktionen</th>
              <th className="hidden px-4 py-3 font-medium lg:table-cell">Hinweise</th>
              <th className="px-4 py-3 text-right font-medium">Konto</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {paging.rows.map((m) => {
              const bal = ledger.balances[m.id] ?? 0
              const fee = feeFor(m.name)
              const hints = [...docsOf(m.id).filter((d) => d.state !== 'ok').map((d) => ({ label: d.label, tone: tone[d.state] })), ...(!weights[m.id] ? [{ label: 'Gewicht fehlt', tone: 'warn' as const }] : [])]
              const end = ends(m.name)
              return (
                <tr key={m.id} onClick={() => nav(`/mitglieder/${m.id}`)} className="cursor-pointer hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2 font-medium">{m.name}{m.manual && <Badge tone="warn">Ohne Formular</Badge>}</div>
                    {end && <div className="text-xs text-warn">Austritt zum {end}</div>}
                    {!end && m.membership === 'ruhend' && <div className="text-xs text-muted">ruhend</div>}
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">{typeOf(m.id).name}</td>
                  <td className="px-4 py-3">
                    {fee ? <div className="flex flex-wrap items-center gap-x-2"><Badge tone={feeTone[fee.state]}>{feeLabel[fee.state]}</Badge>{feeIsOpen(fee) && <span className="text-xs tabular-nums text-muted">{eur(fee.amount)}</span>}</div> : <span className="text-muted">–</span>}
                  </td>
                  <td className="hidden px-4 py-3 text-muted xl:table-cell">{functionNames(m.id).join(', ') || '–'}</td>
                  <td className="hidden px-4 py-3 lg:table-cell"><div className="flex flex-wrap gap-1">{hints.map((h) => <Badge key={h.label} tone={h.tone}>{h.label}</Badge>)}{hints.length === 0 && <span className="text-muted">in Ordnung</span>}</div></td>
                  <td className={`px-4 py-3 text-right tabular-nums ${bal < 0 ? 'text-bad' : ''}`}>{hasAccount(m.id) ? <>{eur(bal)}{windDown(m.id) && <div className="text-xs font-normal text-warn">läuft aus</div>}</> : <span className="text-muted">kein Konto</span>}</td>
                  <td className="pr-3 text-muted"><ChevronRight size={16} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {paging.bar}
      </Card>
    </>
  )
}
