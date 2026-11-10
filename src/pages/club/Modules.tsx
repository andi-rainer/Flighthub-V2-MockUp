import { useState } from 'react'
import { AREA_HIDES, AREA_NAME, lastOn, type Area } from '../../modules'
import { useSession } from '../../session/session'
import { useApp } from '../../state'
import { Button, Drawer, Row, Section, Switch } from '../../ui'
import type { AfpConfig } from '../afp/config'

const guardPerm = 'settings.edit.system'
const AREA_TEXT: Record<Area, string> = {
  skydive: 'Manifest, Tandem-Shop, Tickets und Voucher, Sportspringer',
  charter: 'Reservierungen und Flüge, die Mitglieder selbst fliegen (Charter, Schulung, Privat)',
}

/** Features of the whole club that can be switched on or off. Every change needs a confirmation on public devices. */
export default function Modules() {
  const { afpConfig, setAfpConfig, modules, setModules, docVersioning, setDocVersioning } = useApp()
  const { guarded } = useSession()
  const [reserve, setReserve] = useState(String(afpConfig.reserveMin))
  const [alternate, setAlternate] = useState(String(afpConfig.alternateMin))
  const [off, setOff] = useState<Area | null>(null)
  const set = (p: Partial<AfpConfig>) => guarded(guardPerm, () => setAfpConfig({ ...afpConfig, ...p }))
  const reserveOk = Number.isInteger(Number(reserve)) && Number(reserve) >= 0
  const toggle = (a: Area, on: boolean) => (on ? guarded(guardPerm, () => setModules({ ...modules, [a]: true })) : setOff(a))

  return (
    <div className="max-w-3xl space-y-4">
      <Section title="Betrieb">
        {(['skydive', 'charter'] as Area[]).map((a) => (
          <Row key={a} label={AREA_NAME[a]} hint={AREA_TEXT[a]}>
            <span title={lastOn(modules, a) ? 'Mindestens ein Betrieb muss eingeschaltet bleiben' : undefined}>
              <Switch checked={modules[a]} disabled={lastOn(modules, a)} label={`${AREA_NAME[a]} aktiv`} onChange={(v) => toggle(a, v)} />
            </span>
          </Row>
        ))}
      </Section>

      <Section title="AFP (Abbreviated Flight Plan)" action={<Switch checked={afpConfig.enabled} label="AFP (Abbreviated Flight Plan) aktiv" onChange={(v) => set({ enabled: v })} />}>
        <Row label="Vorbereitung am Flugzeug" hint="Der Pilot bereitet Masse, Schwerpunkt und Treibstoff vor, auch bei Charter- und Privatflügen" />
        {afpConfig.enabled && (
          <>
            <Row label="Vorflugkontrolle bestätigen, unterschreiben, Nachweis-PDF erzeugen"><Switch checked={afpConfig.evidence} label="Vorflugkontrolle bestätigen, unterschreiben und Nachweis-PDF erzeugen" onChange={(v) => set({ evidence: v })} /></Row>
            <Row label="PDF bei der Freigabe per Mail an den Piloten senden"><Switch checked={afpConfig.mailPdf && afpConfig.evidence} disabled={!afpConfig.evidence} label="PDF bei der Freigabe per Mail an den Piloten senden" onChange={(v) => set({ mailPdf: v })} /></Row>
            <Row label="Reserve">
              <input aria-label="Reserve in Minuten" inputMode="numeric" value={reserve} onChange={(e) => setReserve(e.target.value.replace(/\D/g, ''))} onBlur={() => reserveOk && Number(reserve) !== afpConfig.reserveMin && set({ reserveMin: Number(reserve) })} className="h-9 w-20 rounded-lg border border-line bg-surface px-2.5 text-right text-sm tabular-nums outline-none focus:border-brand" />
              <span className="w-14 text-muted">Minuten</span>
            </Row>
            <Row label="Flugzeit zum Alternate" hint="Vorgabe im AFP, der Pilot ändert sie je Flug">
              <input aria-label="Alternate in Minuten" inputMode="numeric" value={alternate} onChange={(e) => setAlternate(e.target.value.replace(/\D/g, ''))} onBlur={() => alternate !== '' && Number(alternate) !== afpConfig.alternateMin && set({ alternateMin: Number(alternate) })} className="h-9 w-20 rounded-lg border border-line bg-surface px-2.5 text-right text-sm tabular-nums outline-none focus:border-brand" />
              <span className="w-14 text-muted">Minuten</span>
            </Row>
          </>
        )}
      </Section>

      <Section title="Flugzeugdokumente">
        <Row label="Versionierung" hint="Eine neue Datei wird als neue Version gespeichert, die alten bleiben einsehbar. Ausgeschaltet ersetzt sie die alte."><Switch checked={docVersioning} label="Versionierung der Flugzeugdokumente" onChange={(v) => guarded(guardPerm, () => setDocVersioning(v))} /></Row>
      </Section>

      {off && (
        <Drawer open title={`${AREA_NAME[off]} ausschalten`} onClose={() => setOff(null)}
          footer={<div className="flex justify-end gap-2"><Button onClick={() => setOff(null)}>Abbrechen</Button><Button variant="primary" onClick={() => { guarded(guardPerm, () => setModules({ ...modules, [off]: false })); setOff(null) }}>Ausschalten</Button></div>}>
          <div className="space-y-4 text-sm">
            <div>
              <div className="mb-1 font-medium">Das wird ausgeblendet</div>
              <ul className="list-disc space-y-0.5 pl-5">{AREA_HIDES[off].map((t) => <li key={t}>{t}</li>)}</ul>
            </div>
            <p className="text-muted">Alle Daten bleiben erhalten und sind wieder da, sobald du einschaltest.</p>
          </div>
        </Drawer>
      )}
    </div>
  )
}
