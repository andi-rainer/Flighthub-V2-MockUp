import { CheckCircle2, ChevronRight, FileDown, Lock } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useApp } from '../state'
import { Banner, Button, Card } from '../ui'
import FormFields, { answersOf, missingFields } from './members/FormFields'
import { lab, nameOf, type Lang } from './members/data'
import { ui } from './members/i18n'
import PdfSheet from './members/PdfSheet'
import SignaturePad from './members/SignaturePad'
import { NOW_TXT } from './members/appHelpers'
import { dmy, fullName, shortName, windowLabel, type TandemBooking } from './manifest/data'
import PublicShell, { Notice } from './PublicShell'

/** Values the booking already knows. They are filled into the locked fields of the contract (source "Tandem-Buchung: ..."). */
const known = (b: TandemBooking): Record<string, string> => ({ Vorname: b.first, Nachname: b.last, Telefon: b.phone ?? '', 'E-Mail': b.email ?? '', 'Gewicht in kg': b.weight ? String(b.weight) : '' })

/**
 * Tandem check-in on a second device (tablet at the entrance, or the guest's own phone): no login, no menu. The guest picks the
 * booking, reads and completes the carriage agreement and signs. The signed PDF is stored with the booking; the manifest sees the
 * guest as "eingecheckt". The coordinator can also open this page for a guest (`?b=<booking>`) and hand over the device.
 */
export default function TandemCheckin({ dayId }: { dayId: string }) {
  const { days, bookings, setBookings, forms, branding } = useApp()
  const [params, setParams] = useSearchParams()
  const [lang, setLang] = useState<Lang>('de')
  const t = ui(lang)
  const day = days.find((d) => d.id === dayId)
  const form = forms.find((f) => f.id === 'befoerderung')
  const version = form?.versions.find((v) => v.status === 'aktiv')
  const design = version?.design ?? branding
  const picked = bookings.find((b) => b.id === params.get('b'))
  const [vals, setVals] = useState<Record<string, string>>({})
  const [inked, setInked] = useState(false)
  const [done, setDone] = useState<TandemBooking | null>(null)

  const back = { label: 'Nur im Klickdummy: zurück zum Manifest', to: `/manifest/${dayId}` }
  const shell = (body: React.ReactNode) => <PublicShell design={design} lang={lang} onLang={setLang} back={back}>{body}</PublicShell>
  if (!day || !form || !version) return shell(<Notice icon={<Lock size={28} />} title={t.invalid} text={t.invalidText} />)

  const expected = bookings.filter((b) => b.dayId === dayId && b.state === 'gebucht' && !b.checkin)
  const reset = () => { setParams({}); setVals({}); setInked(false); setDone(null) }

  if (done) {
    return shell(
      <>
        <Card className="space-y-3 p-6 text-center">
          <CheckCircle2 size={32} className="mx-auto text-ok" />
          <div className="text-lg font-semibold">{t.checkedIn}</div>
          <p className="text-sm text-muted">{t.checkedInText}{done.email ? ` ${t.mailCopy(done.email)}` : ''}</p>
          <div className="flex justify-center gap-2"><Button><FileDown size={16} /> {t.download}</Button><Button variant="primary" onClick={reset}>{t.nextGuest}</Button></div>
        </Card>
        <PdfSheet title={nameOf(form, lang)} version={version} answers={done.checkin!.answers} signedAt={done.checkin!.at} channel="Vor Ort" lang={lang} />
      </>,
    )
  }

  if (!picked || picked.dayId !== dayId || picked.checkin) {
    return shell(
      <Card className="space-y-4 p-5 md:p-6">
        <div><h1 className="text-xl font-semibold tracking-tight">{t.checkinTitle}</h1><p className="mt-1 text-sm text-muted">{t.whoAreYou} {t.pickName}</p></div>
        <div className="space-y-2">
          {expected.map((b) => {
            const w = day.windows.find((x) => x.id === b.windowId)
            return (
              <button key={b.id} onClick={() => setParams({ b: b.id })} className="flex min-h-16 w-full items-center gap-3 rounded-xl border border-line bg-surface px-4 text-left transition hover:bg-slate-50 active:scale-[0.99]">
                <span className="flex-1"><span className="block text-lg font-medium">{shortName(b)}</span>{w && <span className="text-sm text-muted">{t.windowAt(windowLabel(w))}</span>}</span>
                <ChevronRight className="text-muted" />
              </button>
            )
          })}
          {expected.length === 0 && <p className="rounded-xl bg-slate-50 p-4 text-sm text-muted">{t.noOneExpected}</p>}
        </div>
        <Banner>{t.notInList}. {t.notInListText}</Banner>
      </Card>,
    )
  }

  const values = { ...known(picked), ...vals }
  const missing = missingFields(version, values)
  const submit = () => {
    const answers = answersOf(version, values)
    const checkin = { at: NOW_TXT, lang, pdf: `Befoerderungsvertrag-${picked.last}-${dmy(day.date).split('.').reverse().join('-')}.pdf`, answers }
    // The person who signs flies, and may differ from the one who booked or bought the voucher: the booking takes the signed details.
    const kg = Number(answers['Gewicht in kg'])
    const who = { first: answers.Vorname !== '–' ? answers.Vorname : picked.first, last: answers.Nachname !== '–' ? answers.Nachname : picked.last, weight: kg > 0 ? kg : picked.weight, phone: answers.Telefon !== '–' ? answers.Telefon : picked.phone, email: answers['E-Mail'] !== '–' ? answers['E-Mail'] : picked.email }
    setBookings((all) => all.map((b) => (b.id === picked.id ? { ...b, ...who, checkin } : b)))
    setDone({ ...picked, ...who, checkin })
  }
  return shell(
    <Card className="space-y-5 p-5 md:p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{nameOf(form, lang)}</h1>
        <p className="mt-1 text-sm text-muted">{t.hi(picked.first)}. {t.contractIntro} <button className="text-brand" onClick={reset}>{t.changeGuest}</button></p>
      </div>
      <FormFields version={version} values={values} onChange={(k, v) => setVals({ ...vals, [k]: v })} lang={lang} />
      <div className="space-y-2"><div className="text-sm font-medium">{t.signature}</div><SignaturePad onInk={setInked} lang={lang} /></div>
      <Button variant="primary" size="lg" className="w-full" disabled={!inked || missing.length > 0} onClick={submit}>{t.sign}</Button>
      {(!inked || missing.length > 0) && <p className="text-xs text-muted">{t.open}: {[...missing.map((k) => { const f = version.fields.find((x) => x.label === k); return f ? lab(f, lang) : k }), !inked && t.signature].filter(Boolean).join(', ')}</p>}
      <Banner>{t.privacy}</Banner>
      <span className="sr-only">{fullName(picked)}</span>
    </Card>,
  )
}
