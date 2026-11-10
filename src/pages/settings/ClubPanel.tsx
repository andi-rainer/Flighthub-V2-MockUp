import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../state'
import { useSession } from '../../session/session'
import { Badge, Banner, Button, Drawer, Row, Section } from '../../ui'
import LogoPicker from '../forms/LogoPicker'
import { outdatedForms, updateForms } from '../forms/clubSync'
import { type ClubData } from '../members/data'

const inp = 'h-9 w-full rounded-lg border border-line bg-surface px-2.5 text-sm outline-none focus:border-brand sm:w-80'

/**
 * The data of the club in ONE place: name, address, contact, ZVR, IBAN, logo. Forms, PDFs and invoices take it from here.
 * A change asks whether the forms that still show the old data get a new version.
 */
export default function ClubPanel() {
  const nav = useNavigate()
  const { club, setClub, forms, setForms } = useApp()
  const { guarded } = useSession()
  const [d, setD] = useState<ClubData>(club)
  const [note, setNote] = useState<string | null>(null)
  const [asking, setAsking] = useState(false)
  const changed = JSON.stringify(d) !== JSON.stringify(club)
  const set = (p: Partial<ClubData>) => { setD({ ...d, ...p }); setNote(null) }
  const stale = outdatedForms(forms, d)

  const save = () => guarded('settings.edit.system', () => {
    setClub(d)
    if (outdatedForms(forms, d).length > 0) setAsking(true); else setNote('Vereinsdaten gespeichert.')
  })
  const update = (publish: boolean) => {
    const n = stale.length
    setForms(updateForms(forms, d, publish)); setAsking(false)
    setNote(publish ? `Gespeichert. ${n} Formular(e) haben eine neue Version, sie ist veröffentlicht.` : `Gespeichert. ${n} Formular(e) haben einen Entwurf mit den neuen Angaben, du prüfst und veröffentlichst ihn unter Formulare.`)
  }
  const field = (k: keyof ClubData, label: string) => <Row key={k} label={label}><input aria-label={label} value={String(d[k] ?? '')} onChange={(e) => set({ [k]: e.target.value } as Partial<ClubData>)} className={inp} /></Row>

  return (
    <div className="max-w-3xl space-y-4">
      {note && <Banner><span className="flex flex-wrap items-center justify-between gap-2"><span>{note}</span>{note.includes('Formular') && <Button onClick={() => nav('/formulare')}>Zu den Formularen</Button>}</span></Banner>}
      <Section title="Logo"><div className="px-5 py-3"><LogoPicker name={d.name} logo={d.logo} onChange={(logo) => set({ logo })} /></div></Section>
      <Section title="Verein">{field('name', 'Vereinsname')}{field('street', 'Straße und Nummer')}{field('city', 'PLZ und Ort')}</Section>
      <Section title="Kontakt">{field('email', 'E-Mail')}{field('phone', 'Telefon')}{field('web', 'Website')}</Section>
      <Section title="Rechtliches und Bank">{field('zvr', 'ZVR-Zahl')}{field('iban', 'IBAN')}{field('court', 'Gerichtsstand (Ort)')}</Section>
      <div className="flex items-center gap-3"><Button variant="primary" disabled={!changed} onClick={save}>Speichern</Button>{changed && <button onClick={() => { setD(club); setNote(null) }} className="text-sm text-muted hover:text-ink">Verwerfen</button>}</div>

      <Drawer open={asking} title="Formulare aktualisieren" onClose={() => { setAsking(false); setNote('Vereinsdaten gespeichert. Die Formulare zeigen noch die alten Angaben.') }}
        footer={<div className="space-y-2"><Button variant="primary" size="lg" className="w-full" onClick={() => update(false)}>Neue Versionen als Entwurf anlegen</Button><Button size="lg" className="w-full" onClick={() => update(true)}>Neue Versionen gleich veröffentlichen</Button><button onClick={() => { setAsking(false); setNote('Vereinsdaten gespeichert. Die Formulare zeigen noch die alten Angaben.') }} className="block w-full py-2 text-center text-sm text-muted hover:text-ink">Formulare nicht ändern</button></div>}>
        <p className="mb-4 text-sm">Die Vereinsdaten sind gespeichert. {stale.length} {stale.length === 1 ? 'Formular zeigt' : 'Formulare zeigen'} noch die alten Angaben:</p>
        <div className="divide-y divide-line rounded-xl border border-line">
          {stale.map((o) => (
            <div key={o.form.id} className="px-4 py-3 text-sm">
              <div className="flex items-center justify-between gap-2"><span className="font-medium">{o.form.name}</span><Badge tone={o.draft ? 'warn' : 'ok'}>{o.draft ? `Entwurf V${o.version.v}` : `V${o.version.v}`}</Badge></div>
              <div className="mt-0.5 text-xs text-muted">Geändert: {o.parts.join(', ')}{o.draft ? ' · der Entwurf wird aktualisiert' : ''}</div>
            </div>
          ))}
        </div>
      </Drawer>
    </div>
  )
}
