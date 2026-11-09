import { useState } from 'react'
import { Badge, Button, Card, Switch } from '../../ui'
import { requirements } from './data'

export default function Settings() {
  const [flags, setFlags] = useState({ vouchers: true, tickets: true, redeem: true })
  const [req, setReq] = useState(requirements)
  const row = (k: keyof typeof flags, title: string, hint: string) => (
    <div className="flex items-center justify-between gap-4 py-3">
      <div><div className="font-medium">{title}</div><div className="text-sm text-muted">{hint}</div></div>
      <Switch checked={flags[k]} onChange={(v) => setFlags({ ...flags, [k]: v })} label={title} />
    </div>
  )
  return (
    <div className="grid max-w-4xl gap-5">
      <Card className="divide-y divide-line p-5">
        <h2 className="pb-2 font-semibold">Was der Shop anbietet</h2>
        {row('vouchers', 'Gutscheine verkaufen', 'Karte „Gutschein“ und Seite „Gutscheine“ sind sichtbar')}
        {row('tickets', 'Termine direkt buchen', 'Karte „Direkt buchen“ und Terminwahl sind sichtbar')}
        {row('redeem', 'Gutscheine einlösen', 'Karte „Einlösen“ ist sichtbar')}
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 font-semibold">Pflichtangaben beim Bezahlen</h2>
        <div className="divide-y divide-line">
          {req.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1 basis-60 text-sm">{r.text}</div>
              <button onClick={() => setReq(req.map((x) => (x.id === r.id ? { ...x, required: !x.required } : x)))}><Badge tone={r.required ? 'warn' : 'neutral'}>{r.required ? 'Pflicht' : 'Optional'}</Badge></button>
              <Switch checked={r.active} onChange={(v) => setReq(req.map((x) => (x.id === r.id ? { ...x, active: v } : x)))} label={`${r.text} anzeigen`} />
            </div>
          ))}
        </div>
        <div className="mt-3"><Button>Pflichtangabe hinzufügen</Button></div>
      </Card>

      <Card className="space-y-4 p-5">
        <h2 className="font-semibold">Zahlung und Weiterleitung</h2>
        <div className="flex items-center justify-between rounded-lg bg-ok-soft px-4 py-3 text-sm text-ok"><span>Stripe ist verbunden</span><Button>Neu verbinden</Button></div>
        <label className="block text-sm font-medium">Weiterleitung nach dem Kauf
          <input defaultValue="https://www.skydive-beispiel.at/danke" className="mt-1 h-11 w-full rounded-lg border border-line px-3 font-normal outline-none focus:border-brand" />
        </label>
        <Button variant="primary">Speichern</Button>
      </Card>
    </div>
  )
}
