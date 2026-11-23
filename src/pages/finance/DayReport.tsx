import { FileText } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CASH_ID, eur } from '../../data'
import PrintFrame, { PRINT_PAGE } from '../../PrintFrame'
import { useApp } from '../../state'
import { Button, Drawer } from '../../ui'
import { dmy, weekday } from '../manifest/data'
import LetterHead from '../members/LetterHead'
import { dayCash, reportTotals, type DayHow, type DayReport } from './cashDocs'

const HOW: Record<DayHow, string> = { konto: 'Betriebskonto belastet', bar: 'Bar, Betriebskonto belastet und gutgeschrieben', gast: 'Bar kassiert', voucher: 'Voucher eingelöst', online: 'Online bezahlt', ticket: 'Ticket bezahlt', offen: 'Überweisung offen' }

/**
 * [Entwurf] Tagesabschluss-Beleg: the document of a closed Sprungtag. It is the receipt of the Kassa booking (cash takings have no invoice),
 * so the principle "every booking has a document" holds for cash as well. The layout is the print layout of every document of the club.
 */
export function DayReportSheet({ report: r }: { report: DayReport }) {
  const { branding, ledger } = useApp()
  const t = reportTotals(r)
  const cash = dayCash(r)
  const line = ledger.lines.find((l) => l.id === r.cashLineId)
  const row = 'flex items-baseline justify-between gap-3 py-1'
  return (
    <PrintFrame name={`Tagesabschluss ${dmy(r.date)}`}>
      <div {...PRINT_PAGE} className="mx-auto flex w-full max-w-[600px] flex-col gap-4 rounded-sm border border-line bg-white p-8 text-[12px] leading-relaxed text-slate-900 shadow-md" style={{ minHeight: 640 }}>
        <LetterHead design={branding} compact />
        <div className="flex items-end justify-between gap-3">
          <div><div className="text-base font-semibold">Tagesabschluss Sprungtag {weekday(r.date)} {dmy(r.date)}</div><div className="text-[11px] text-slate-500">{r.aircraft} · {r.flights} Flüge · {r.jumps} Sprünge</div></div>
          <div className="text-right text-[11px] text-slate-500"><div className="font-mono text-slate-900">{r.number}</div>abgeschlossen von {r.by} am {dmy(r.at)}</div>
        </div>

        <table className="w-full text-left text-[11px]">
          <thead><tr className="border-b border-slate-400 text-slate-500"><th className="py-1 font-medium">Person</th><th className="py-1 font-medium">Leistung</th><th className="py-1 font-medium">Abrechnung</th><th className="py-1 text-right font-medium">Preis</th><th className="py-1 text-right font-medium">Bar</th></tr></thead>
          <tbody>
            {r.lines.map((l, i) => (
              <tr key={i} className="border-b border-slate-200 align-top">
                <td className="py-1 pr-2">{l.who}</td>
                <td className="py-1 pr-2">{l.what}{l.code ? ` · ${l.code}` : ''}</td>
                <td className="py-1 pr-2 text-slate-600">{HOW[l.how]}{l.ownLine ? ', einzeln in der Kassa' : ''}</td>
                <td className="py-1 text-right tabular-nums">{eur(l.price)}</td>
                <td className="py-1 text-right tabular-nums">{l.cash > 0 ? eur(l.cash) : '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="divide-y divide-slate-200 border-t border-slate-400 text-[11px]">
          <div className={row}><span>Betriebskonten belastet</span><span className="tabular-nums">− {eur(t.charged)}</span></div>
          <div className={row}><span>Bar auf Betriebskonten gutgeschrieben</span><span className="tabular-nums">{eur(t.memberCash)}</span></div>
          {t.prepaid > 0 && <div className={row}><span>Vorher bezahlt (Voucher, online, Ticket): Ertrag, heute kein Geld</span><span className="tabular-nums">{eur(t.prepaid)}</span></div>}
          {t.ticketCash > 0 && <div className={row}><span>Bar von Tandem-Gästen, einzeln in der Kassa gebucht</span><span className="tabular-nums">{eur(t.ticketCash)}</span></div>}
          {t.open > 0 && <div className={row}><span>Geflogen, Überweisung noch offen</span><span className="tabular-nums">{eur(t.open)}</span></div>}
          <div className={`${row} font-semibold`}><span>Bar in die Kassa gebucht (Tageskasse)</span><span className="tabular-nums">{eur(cash)}</span></div>
        </div>

        <div className="mt-auto grid grid-cols-2 gap-8 pt-8 text-[10px] text-slate-500">
          <div className="border-t border-slate-400 pt-1">Geld übergeben (Unterschrift)</div>
          <div className="border-t border-slate-400 pt-1">Geld übernommen, Kassa (Unterschrift)</div>
        </div>
        <div className="text-[10px] text-slate-500">{r.cashLineId && line ? `Kassabuchung ${dmy(line.date)}: ${eur(line.amount)} auf ${ledger.accountName(line.accountId)}` : 'Kein Bargeld an diesem Tag, keine Kassabuchung.'}</div>
      </div>
    </PrintFrame>
  )
}

/** The report in a drawer, with the way back to its Kassa booking. */
export function DayReportDrawer({ report, onClose }: { report: DayReport; onClose: () => void }) {
  return (
    <Drawer open title={`Tagesabschluss ${dmy(report.date)}`} size="xl" onClose={onClose}
      footer={<div className="flex flex-wrap items-center justify-between gap-2"><Link to={`/manifest/${report.dayId}`} className="text-sm text-brand hover:underline">Zum Sprungtag</Link>{report.cashLineId && <Link to={`/finanzen?tab=bank&konto=${CASH_ID}`} className="text-sm text-brand hover:underline">Kassabuchung in Finanzen</Link>}<Button onClick={onClose}>Schließen</Button></div>}>
      <DayReportSheet report={report} />
    </Drawer>
  )
}

/** A button for a closed day: opens its Tagesabschluss-Beleg. Nothing is shown for a day without one. */
export function DayReportLink({ dayId }: { dayId: string }) {
  const { ledger } = useApp()
  const [open, setOpen] = useState(false)
  const report = ledger.dayReports.find((r) => r.dayId === dayId)
  if (!report) return null
  return (
    <>
      <Button onClick={() => setOpen(true)}><FileText size={14} /> Tagesabschluss-Beleg</Button>
      {open && <DayReportDrawer report={report} onClose={() => setOpen(false)} />}
    </>
  )
}
