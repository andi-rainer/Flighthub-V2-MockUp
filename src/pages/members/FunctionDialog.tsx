import clsx from 'clsx'
import { AlertTriangle } from 'lucide-react'
import { useState } from 'react'
import { members } from '../../data'
import { FUNCTION_GROUPS, isCurrent, type FunctionDef, type FunctionGroup } from '../../permissions'
import { TODAY_ISO, useApp } from '../../state'
import { useSession } from '../../session/session'
import { Banner, Button, Drawer } from '../../ui'

const inp = 'h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm outline-none focus:border-brand'
export type FunctionMode = { kind: 'new' } | { kind: 'edit'; code: string } | { kind: 'delete'; code: string }

/**
 * Create, rename or delete a function. No function is fixed: the list is only pre-filled. Deleting removes the function from everybody
 * who holds it, so the dialog names them first, and the last holder of `permissions.manage` can never be removed this way (lockout guard).
 */
export default function FunctionDialog({ mode, onClose, onCreated }: { mode: FunctionMode; onClose: () => void; onCreated: (code: string) => void }) {
  const { functions, grants, assignments, addFunction, updateFunction, deleteFunction } = useApp()
  const { guarded } = useSession()
  const code = mode.kind === 'new' ? '' : mode.code
  const current = mode.kind === 'new' ? undefined : functions.find((f) => f.code === code)
  const [name, setName] = useState(current?.name ?? '')
  const [group, setGroup] = useState<FunctionGroup>(current?.group ?? 'Betrieb')
  const [copyFrom, setCopyFrom] = useState('')
  const clean = name.trim()
  const taken = functions.some((f) => f.code !== current?.code && f.name.toLowerCase() === clean.toLowerCase())
  const valid = clean.length >= 2 && !taken

  const holders = current ? members.filter((m) => (assignments[m.id] ?? []).some((a) => a.fn === current.code)) : []
  const someoneKeepsManage = !current || members.some((m) => (assignments[m.id] ?? []).some((a) => a.fn !== current.code && isCurrent(a, TODAY_ISO) && (grants[a.fn] ?? []).includes('permissions.manage')))

  const title = mode.kind === 'new' ? 'Neue Funktion' : mode.kind === 'edit' ? `Funktion bearbeiten: ${current?.name}` : `Funktion löschen: ${current?.name}`
  const save = () => {
    if (mode.kind === 'new') guarded('functions.create', () => { const created = addFunction({ name: clean, group }, copyFrom || undefined); onCreated(created); onClose() })
    else if (mode.kind === 'edit') guarded('functions.edit', () => { updateFunction(code, { name: clean, group }); onClose() })
  }
  const remove = () => guarded('functions.delete.custom', () => { deleteFunction(code); onClose() })

  return (
    <Drawer open title={title} onClose={onClose}
      footer={mode.kind === 'delete'
        ? <Button variant="danger" size="lg" className="w-full" disabled={!someoneKeepsManage} onClick={remove}>Funktion löschen</Button>
        : <Button variant="primary" size="lg" className="w-full" disabled={!valid} onClick={save}>{mode.kind === 'new' ? 'Anlegen und Rechte festlegen' : 'Speichern'}</Button>}>
      {mode.kind === 'delete' ? (
        <div className="space-y-4">
          <Banner tone="warn"><span className="flex items-start gap-2"><AlertTriangle size={16} className="mt-0.5 shrink-0" /><span>{holders.length > 0 ? <>„{current?.name}“ wird bei <b>{holders.length} {holders.length === 1 ? 'Person' : 'Personen'}</b> entfernt, mit allen Rechten, die nur diese Funktion gibt.</> : <>Niemand hat „{current?.name}“. Die Funktion verschwindet samt ihren Rechten.</>}</span></span></Banner>
          {holders.length > 0 && <ul className="divide-y divide-line rounded-xl border border-line text-sm">{holders.map((m) => <li key={m.id} className="px-4 py-2.5 font-medium">{m.name}</li>)}</ul>}
          {!someoneKeepsManage && <p className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">Die letzte Person mit „Berechtigungen verwalten“ darf nicht entfernt werden. Vergib das Recht zuerst einer anderen Funktion.</p>}
        </div>
      ) : (
        <div className="space-y-5">
          <label className="block text-sm font-medium">Name<input autoFocus value={name} onChange={(e) => setName(e.target.value)} className={clsx(inp, 'mt-1', taken && 'border-bad')} />{taken && <span className="mt-1 block text-xs text-bad">Diese Funktion gibt es schon.</span>}</label>
          <div>
            <div className="mb-1 text-sm font-medium">Gruppe</div>
            <div className="flex flex-wrap gap-2">{FUNCTION_GROUPS.map((g) => <button key={g} onClick={() => setGroup(g)} className={clsx('rounded-lg border px-3 py-1.5 text-sm', group === g ? 'border-brand bg-brand-soft text-brand' : 'border-line hover:bg-slate-50')}>{g}</button>)}</div>
          </div>
          {mode.kind === 'new' && (
            <label className="block text-sm font-medium">Rechte übernehmen von (optional)
              <select value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)} className={clsx(inp, 'mt-1')}><option value="">Keine, ich wähle selbst</option>{functions.map((f: FunctionDef) => <option key={f.code} value={f.code}>{f.name} ({(grants[f.code] ?? []).length === 1 ? '1 Recht' : `${(grants[f.code] ?? []).length} Rechte`})</option>)}</select>
            </label>
          )}
        </div>
      )}
    </Drawer>
  )
}
