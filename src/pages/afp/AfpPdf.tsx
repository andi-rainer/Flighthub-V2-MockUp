import { Check, X } from 'lucide-react'
import type { AfpData, AfpResult } from '../../state'
import { Chart } from '../aircraft/Envelope'
import type { Detail } from '../aircraft/data'
import { converter } from '../aircraft/units'
import LetterHead from '../members/LetterHead'
import type { Branding } from '../members/data'
import PrintFrame, { PRINT_PAGE } from '../../PrintFrame'
import { afpCalc, ARM, DENSITY } from './calc'


/**
 * The AFP as a document: the evidence of mass and balance for checks. It is made when the pilot releases the AFP, goes to the pilot by
 * mail and can be opened in the AFP at any time. The pilot is responsible for the values: they must be correct and match the AFM/POH.
 */
export default function AfpPdf({ title, date, reg, type, d, data, result, design }: { title: string; date: string; reg: string; type: string; d: Detail; data: AfpData; result: AfpResult; design: Branding }) {
  const reserveMin = data.reserveMin ?? 30
  const alternateMin = data.alternateMin ?? 0
  const c = afpCalc(d, { ...data, alternateMin, reserveMin })
  const u = converter(d.units) // the table is in the units of the aircraft
  const armDigits = u.units.length === 'm' ? 3 : 2
  // A document for inspections: only logo and name in the head (if the club set them), no address, bank or registration numbers.
  const head: Branding = { ...design, show: { ...design.show, address: false, contact: false, footer: false } }
  const shown = c.checks.filter((k) => ['Gewichte vollständig', 'Treibstoff', 'Endurance'].includes(k.label))
  const row = (label: string, kg: number, arm: number, note?: string) => (
    <tr key={label} className="border-b border-slate-100">
      <td className="py-1 pr-2">{label}{note && <span className="text-slate-500"> · {note}</span>}</td>
      <td className="py-1 text-right tabular-nums">{Math.round(u.mass(kg) * 10) / 10}</td>
      <td className="py-1 text-right tabular-nums">{u.length(arm).toFixed(armDigits)}</td>
      <td className="py-1 text-right tabular-nums">{(u.mass(kg) * u.length(arm)).toFixed(1)}</td>
    </tr>
  )
  const fuelKg = data.fuelL * DENSITY
  return (
    <PrintFrame name={title}>
    <div {...PRINT_PAGE} className="mx-auto w-full max-w-[600px] rounded-sm border border-line bg-white p-8 text-[11.5px] leading-relaxed text-slate-900 shadow-md">
      <LetterHead design={head} />
      <div className="mt-1 text-right text-[10px] text-slate-500">Nachweis Masse und Schwerpunkt</div>
      <h2 className="mt-2 text-base font-semibold">{title}</h2>
      <div className="mt-1 grid grid-cols-2 gap-x-6 text-[11px] text-slate-700">
        <div>Datum: <b>{date}</b></div><div>Flugzeug: <b>{reg}</b> {type}</div>
        <div>Pilot: <b>{result.pilot}</b></div><div>Freigabe: <b>{result.release?.signedAt ?? `${date} ${result.releasedAt}`}</b></div>
      </div>

      <table className="mt-3 w-full text-[11px]">
        <thead><tr className="border-b border-slate-300 text-left text-[10px] text-slate-500"><th className="py-1 font-medium">Posten</th><th className="py-1 text-right font-medium">{u.massUnit}</th><th className="py-1 text-right font-medium">Arm ({u.lengthUnit})</th><th className="py-1 text-right font-medium">Moment</th></tr></thead>
        <tbody>
          {row('Leermasse', d.emptyKg, d.emptyArm)}
          {row('Pilot', data.pilotKg, ARM.pilot)}
          {row('Passagiere', c.paxKg, ARM.cabin, `${data.pax.length} Personen, inkl. Ausrüstung`)}
          {row('Gepäck', data.bag, ARM.bag)}
          {row('Treibstoff', fuelKg, ARM.fuel, u.fuelText(data.fuelL))}
          <tr className="border-t border-slate-400 font-semibold"><td className="py-1">Abflugmasse</td><td className="py-1 text-right tabular-nums">{Math.round(u.mass(c.start.w))}</td><td className="py-1 text-right tabular-nums">{u.length(c.start.arm).toFixed(armDigits)}</td><td className="py-1 text-right tabular-nums">{(u.mass(c.start.w) * u.length(c.start.arm)).toFixed(1)}</td></tr>
          <tr className="font-semibold"><td className="py-1">Landemasse (nach {data.planned} min)</td><td className="py-1 text-right tabular-nums">{Math.round(u.mass(c.land.w))}</td><td className="py-1 text-right tabular-nums">{u.length(c.land.arm).toFixed(armDigits)}</td><td className="py-1 text-right tabular-nums">{(u.mass(c.land.w) * u.length(c.land.arm)).toFixed(1)}</td></tr>
          <tr className="text-slate-500"><td className="py-1">MTOM</td><td className="py-1 text-right tabular-nums">{Math.round(u.mass(d.mtow))}</td><td /><td /></tr>
        </tbody>
      </table>
      {data.pax.length > 0 && <p className="mt-1 text-[10px] text-slate-500">Personen: {data.pax.map((p) => `${p.name || '–'} ${p.kg} kg`).join(', ')}</p>}

      <ul className="mt-3 space-y-1">
        {shown.map((k) => (
          <li key={k.label} className="flex items-start gap-1.5"><span className={`mt-0.5 grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full text-white ${k.ok ? 'bg-emerald-600' : 'bg-red-600'}`}>{k.ok ? <Check size={9} /> : <X size={9} />}</span><span><b>{k.label}:</b> {k.text}</span></li>
        ))}
      </ul>
      {d.envelope && <div className="mt-3"><Chart c={u} env={d.envelope} start={c.start} land={c.land} mtow={d.mtow} /></div>}
      <p className="text-[9px] text-slate-400">Alternate {alternateMin} min, Reserve {reserveMin} min. Werte und Hebelarme der Demo sind erfunden, im echten System stammen sie aus dem AFM/POH.</p>

      <div className="mt-4 rounded-sm border-l-4 border-amber-500 bg-amber-50 p-2.5 text-[10.5px] text-slate-800">
        <b>Verantwortung des Piloten.</b> Der Pilot ist dafür verantwortlich, dass die Angaben richtig sind und mit den Werten des AFM/POH übereinstimmen. Dieses Dokument ersetzt weder die Vorflugkontrolle noch das Flughandbuch.
      </div>
      <p className="mt-3 text-[11px]">Der Pilot bestätigt mit seiner Unterschrift, dass die Vorflugkontrolle ordnungsgemäß durchgeführt wurde.</p>

      <div className="mt-4 grid grid-cols-2 gap-6 text-[10px] text-slate-500">
        <div><div className="min-h-[40px] border-b border-slate-400 pt-5 text-[12px] text-slate-900">{result.release?.signedAt ?? ''}</div>Ort, Datum und Uhrzeit</div>
        <div>
          <div className="flex min-h-[40px] items-end border-b border-slate-400">{result.release?.signature && <img src={result.release.signature} alt="Unterschrift" className="max-h-10 object-contain" />}</div>
          Unterschrift {result.pilot}
        </div>
      </div>
      <div className="mt-4 border-t border-slate-200 pt-2 text-[9px] text-slate-400">{result.release && <div>Erstellt {result.release.signedAt} · {result.release.pdf}</div>}</div>
    </div>
    </PrintFrame>
  )
}
