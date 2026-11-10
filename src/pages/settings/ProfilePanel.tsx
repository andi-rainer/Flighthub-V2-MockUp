import { useState } from 'react'
import { useApp } from '../../state'
import { Banner, Button, Card } from '../../ui'

const inp = 'mt-1 h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm outline-none focus:border-brand disabled:bg-slate-50 disabled:text-muted'

/** My own data. What the member may change herself; the club edits the same record in the member file. */
export default function ProfilePanel() {
  const { persona, profileOf, updateProfile, weights, memberCan } = useApp()
  const id = persona.memberId
  const saved = profileOf(id)
  const [form, setForm] = useState(saved)
  const [kg, setKg] = useState(weights[id] ? String(weights[id]) : '')
  const [note, setNote] = useState<string | null>(null)
  const set = (p: Partial<typeof form>) => { setForm({ ...form, ...p }); setNote(null) }
  const save = () => {
    updateProfile(id, form, Number(kg) || undefined)
    setNote(form.email !== saved.email ? `Gespeichert. An ${form.email} ging ein Bestätigungslink. Bis du ihn öffnest, melden wir dich weiter mit ${saved.email} an.` : 'Gespeichert. Die Änderung steht im Verlauf deiner Akte.')
  }
  const jumper = memberCan(id, 'manifest.jumps.sport')
  return (
    <Card className="max-w-3xl space-y-6 p-5">
      {note && <Banner>{note}</Banner>}
      <section>
        <h3 className="mb-3 text-sm font-semibold">Person</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">Vorname<input value={form.first} onChange={(e) => set({ first: e.target.value })} className={inp} /></label>
          <label className="text-sm font-medium">Nachname<input value={form.last} onChange={(e) => set({ last: e.target.value })} className={inp} /></label>
          <label className="text-sm font-medium">Geburtsdatum<input value={form.birth} disabled className={inp} /><span className="mt-1 block text-xs font-normal text-muted">Kann nur der Verein ändern.</span></label>
          <label className="text-sm font-medium">Telefon<input value={form.phone} onChange={(e) => set({ phone: e.target.value })} className={inp} /></label>
          <label className="text-sm font-medium sm:col-span-2">E-Mail (Anmeldename)<input type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} className={inp} /><span className="mt-1 block text-xs font-normal text-muted">Eine neue Adresse musst du per Link bestätigen.</span></label>
        </div>
      </section>
      <section>
        <h3 className="mb-3 text-sm font-semibold">Adresse</h3>
        <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
          <label className="text-sm font-medium">Straße<input value={form.street} onChange={(e) => set({ street: e.target.value })} className={inp} /></label>
          <label className="text-sm font-medium">Hausnummer<input value={form.no} onChange={(e) => set({ no: e.target.value })} className={inp} /></label>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-[120px_1fr_1fr]">
          <label className="text-sm font-medium">PLZ<input value={form.zip} onChange={(e) => set({ zip: e.target.value })} className={inp} /></label>
          <label className="text-sm font-medium">Stadt<input value={form.city} onChange={(e) => set({ city: e.target.value })} className={inp} /></label>
          <label className="text-sm font-medium">Land<input value={form.country} onChange={(e) => set({ country: e.target.value })} className={inp} /></label>
        </div>
      </section>
      <section>
        <h3 className="mb-3 text-sm font-semibold">Notfallkontakt</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">Name<input value={form.emName} onChange={(e) => set({ emName: e.target.value })} className={inp} /></label>
          <label className="text-sm font-medium">Telefon<input value={form.emPhone} onChange={(e) => set({ emPhone: e.target.value })} className={inp} /></label>
        </div>
      </section>
      <section>
        <h3 className="mb-3 text-sm font-semibold">Flugbetrieb und Sprache</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">Gewicht in kg {jumper && <span className="text-bad">(Pflicht)</span>}<input inputMode="numeric" value={kg} onChange={(e) => { setKg(e.target.value); setNote(null) }} className={inp} /></label>
          <label className="text-sm font-medium">Sprache<select value={form.lang} onChange={(e) => set({ lang: e.target.value as 'de' | 'en' })} className={inp}><option value="de">Deutsch</option><option value="en">English</option></select></label>
        </div>
      </section>
      <div className="flex gap-2"><Button variant="primary" onClick={save}>Speichern</Button><Button onClick={() => { setForm(saved); setKg(weights[id] ? String(weights[id]) : ''); setNote(null) }}>Zurücksetzen</Button></div>
    </Card>
  )
}
