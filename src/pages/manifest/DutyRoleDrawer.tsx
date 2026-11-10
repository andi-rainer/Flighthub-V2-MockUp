import clsx from 'clsx'
import { useState } from 'react'
import { useApp } from '../../state'
import { Button, Drawer, Segmented } from '../../ui'
import type { DutyRole } from './data'

/** Create or change a duty: its name, whether a day needs it, and which functions may cover it. */
export default function DutyRoleDrawer({ role, onSave, onDelete, onClose }: { role: DutyRole | 'new'; onSave: (r: DutyRole) => void; onDelete: (id: string) => void; onClose: () => void }) {
  const { functions } = useApp()
  const cur = role === 'new' ? undefined : role
  const [name, setName] = useState(cur?.name ?? '')
  const [required, setRequired] = useState(cur?.required ?? false)
  const [min, setMin] = useState(cur?.min ?? 1)
  const [fns, setFns] = useState<string[]>(cur?.functions ?? [])
  const toggle = (code: string) => setFns((f) => (f.includes(code) ? f.filter((x) => x !== code) : [...f, code]))
  return (
    <Drawer open title={cur ? `Dienst bearbeiten · ${cur.name}` : 'Neuer Dienst'} onClose={onClose}
      footer={<div className="flex items-center justify-between gap-2">{cur ? <Button variant="danger" onClick={() => onDelete(cur.id)}>Löschen</Button> : <span />}<span className="flex gap-2"><Button onClick={onClose}>Abbrechen</Button><Button variant="primary" disabled={!name.trim()} onClick={() => onSave({ id: cur?.id ?? `r-${Date.now()}`, name: name.trim(), required, min: required ? Math.max(1, min) : 1, functions: fns })}>Speichern</Button></span></div>}>
      <div className="space-y-5">
        <label className="block text-sm font-medium">Name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Shuttlebusfahrer" className="mt-1 h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm outline-none focus:border-brand" /></label>
        <div>
          <span className="mb-1 block text-sm font-medium">Am Manifest-Tag</span>
          <Segmented value={required ? 'pflicht' : 'optional'} onChange={(v) => setRequired(v === 'pflicht')} options={[{ value: 'optional', label: 'Optional' }, { value: 'pflicht', label: 'Pflicht' }]} />
        </div>
        {required && (
          <div>
            <span className="mb-1 block text-sm font-medium">Mindestens besetzt mit</span>
            <span className="inline-flex items-center gap-3"><Button disabled={min <= 1} onClick={() => setMin(min - 1)}>−</Button><span className="w-6 text-center font-medium tabular-nums">{min}</span><Button onClick={() => setMin(min + 1)}>+</Button><span className="text-sm text-muted">{min === 1 ? 'Person' : 'Personen'} zu jeder Stunde des Tags</span></span>
          </div>
        )}
        <div>
          <span className="mb-1 block text-sm font-medium">Erlaubte Funktionen (eine genügt)</span>
          <div className="flex flex-wrap gap-2">
            {functions.map((f) => <button key={f.code} onClick={() => toggle(f.code)} aria-pressed={fns.includes(f.code)} className={clsx('rounded-lg border px-3 py-2 text-sm', fns.includes(f.code) ? 'border-brand bg-brand-soft text-brand' : 'border-line bg-surface')}>{f.name}</button>)}
          </div>
          <p className="mt-2 text-xs text-muted">{fns.length === 0 ? 'Keine Auswahl: jedes Mitglied darf den Dienst übernehmen.' : `Mitglieder mit ${fns.map((c) => functions.find((f) => f.code === c)?.name ?? c).join(' oder ')}.`}</p>
        </div>
      </div>
    </Drawer>
  )
}
