import clsx from 'clsx'
import { Lock, Plus, Search } from 'lucide-react'
import { useState } from 'react'
import { members } from '../../data'
import { CATEGORY_LABELS, NEW_IN_V2, PERMISSION_CATALOG, isCurrent, isPermission, labelOf, missingRequirements, permissionRequirements, permissionsNeeding, withRequirements, type Permission } from '../../permissions'
import { TODAY_ISO, useApp } from '../../state'
import { Badge, Banner, Button, Card, Drawer, RowMenu, type RowAction } from '../../ui'
import FunctionDialog, { type FunctionMode } from './FunctionDialog'

/**
 * Functions and their permissions. Logic as in V1: functions are the only grant, the grants are editable data,
 * permissions that need another one bring it along and stay while needed, and the last holder of
 * `permissions.manage` can never be removed (lockout guard).
 */
export default function Functions() {
  const { grants, assignments, can, functions } = useApp()
  const [editing, setEditing] = useState<string | null>(null)
  const [dialog, setDialog] = useState<FunctionMode | null>(null)
  const holders = (fn: string) => members.filter((m) => (assignments[m.id] ?? []).some((a) => a.fn === fn && isCurrent(a, TODAY_ISO)))
  const rowActions = (code: string): RowAction[] => [
    ...(can('functions.edit') ? [{ label: 'Name und Gruppe ändern', onSelect: () => setDialog({ kind: 'edit', code }) }] : []),
    ...(can('functions.delete.custom') ? [{ label: 'Löschen', danger: true, onSelect: () => setDialog({ kind: 'delete', code }) }] : []),
  ]
  const publicCount = PERMISSION_CATALOG.filter((p) => p.grantedToAll).length

  return (
    <div className="space-y-4">
      <Banner>Funktionen sind die einzige Quelle für Rechte. Jede Person bekommt, was ihre aktuell gültigen Funktionen erlauben, dazu {publicCount} Rechte, die alle haben (zum Beispiel Flugzeuge, Bordbuch und Manifest ansehen).</Banner>
      {can('functions.create') && <div className="flex justify-end"><Button variant="primary" onClick={() => setDialog({ kind: 'new' })}><Plus size={16} /> Neue Funktion</Button></div>}
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-muted"><tr><th className="px-4 py-3 font-medium">Funktion</th><th className="hidden px-4 py-3 font-medium sm:table-cell">Gruppe</th><th className="px-4 py-3 font-medium">Inhaber</th><th className="px-4 py-3 text-right font-medium">Rechte</th><th className="w-32 px-2 py-3" /></tr></thead>
          <tbody className="divide-y divide-line">
            {functions.map((f) => (
              <tr key={f.code}>
                <td className="px-4 py-3 font-medium">{f.name}</td>
                <td className="hidden px-4 py-3 text-muted sm:table-cell">{f.group}</td>
                <td className="px-4 py-3 text-muted">{holders(f.code).map((m) => m.name).join(', ') || '–'}</td>
                <td className="px-4 py-3 text-right tabular-nums">{grants[f.code]?.length ?? 0}</td>
                <td className="px-2 py-3"><div className="flex items-center justify-end gap-1"><Button onClick={() => setEditing(f.code)}>{can('permissions.manage') ? 'Rechte' : 'Ansehen'}</Button>{rowActions(f.code).length > 0 && <RowMenu actions={rowActions(f.code)} />}</div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {dialog && <FunctionDialog key={dialog.kind + ('code' in dialog ? dialog.code : '')} mode={dialog} onClose={() => setDialog(null)} onCreated={setEditing} />}
      {editing && <Editor key={editing} fn={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function Editor({ fn, onClose }: { fn: string; onClose: () => void }) {
  const { grants, setGrants, assignments, can, fnName } = useApp()
  const readOnly = !can('permissions.manage')
  const [selected, setSelected] = useState<string[]>(grants[fn] ?? [])
  const [q, setQ] = useState('')
  const [error, setError] = useState<string | null>(null)
  const sel = new Set(selected)

  const toggle = (code: Permission, on: boolean) => {
    if (on) setSelected(withRequirements([...selected, code]))
    else if (permissionsNeeding(code, selected).length === 0) setSelected(selected.filter((c) => c !== code))
  }
  const save = () => {
    // 1. requirements must be complete
    if (missingRequirements(selected).length > 0) return setError('Es fehlen benötigte Rechte.')
    // 2. lockout guard: somebody currently valid must still hold permissions.manage afterwards
    const next = { ...grants, [fn]: selected }
    const someone = members.some((m) => (assignments[m.id] ?? []).some((a) => isCurrent(a, TODAY_ISO) && (next[a.fn] ?? []).includes('permissions.manage')))
    if (!someone) return setError('Die letzte Person mit „Berechtigungen verwalten“ darf nicht entfernt werden.')
    setGrants(next); onClose()
  }

  const categories = [...new Set(PERMISSION_CATALOG.map((p) => p.category))]
  const matches = (code: string) => labelOf(code).toLowerCase().includes(q.toLowerCase())

  return (
    <Drawer open title={`Berechtigungen von ${fnName(fn)}`} onClose={onClose}
      footer={readOnly ? <p className="text-sm text-muted">Du kannst diese Berechtigungen ansehen, aber nicht ändern.</p> : (
        <div className="space-y-2">{error && <p className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{error}</p>}<Button variant="primary" size="lg" className="w-full" onClick={save}>Berechtigungen speichern</Button></div>
      )}>
      <p className="mb-3 text-sm text-muted">Alle Personen mit dieser Funktion erhalten die ausgewählten Berechtigungen. {selected.length} ausgewählt.</p>
      <div className="relative mb-3"><Search size={16} className="absolute left-3 top-3.5 text-muted" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Berechtigungen suchen" className="h-11 w-full rounded-xl border border-line pl-9 pr-3 text-sm outline-none focus:border-brand" /></div>
      {!readOnly && <div className="mb-3 flex gap-3 text-sm"><button className="text-brand" onClick={() => setSelected(withRequirements(PERMISSION_CATALOG.filter((p) => !p.grantedToAll).map((p) => p.code)))}>Alle auswählen</button><button className="text-brand" onClick={() => setSelected([])}>Alle abwählen</button></div>}
      <div className="space-y-3">
        {categories.map((cat) => {
          const items = PERMISSION_CATALOG.filter((p) => p.category === cat && matches(p.code))
          if (items.length === 0) return null
          return (
            <details key={cat} open={q.length > 0 || cat === 'manifest'} className="rounded-xl border border-line">
              <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">{CATEGORY_LABELS[cat]} <span className="font-normal text-muted">({items.filter((p) => p.grantedToAll || sel.has(p.code)).length}/{items.length})</span></summary>
              <div className="divide-y divide-line border-t border-line">
                {items.map((p) => {
                  const needs = isPermission(p.code) ? permissionRequirements(p.code) : []
                  const neededFor = permissionsNeeding(p.code as Permission, selected)
                  const locked = p.grantedToAll || readOnly || neededFor.length > 0
                  return (
                    <label key={p.code} className={clsx('flex items-start gap-3 px-4 py-2.5 text-sm', locked ? 'cursor-default' : 'cursor-pointer')}>
                      <input type="checkbox" className="mt-1 h-4 w-4" checked={p.grantedToAll || sel.has(p.code)} disabled={locked} onChange={(e) => toggle(p.code as Permission, e.target.checked)} />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5">{labelOf(p.code)}
                          {p.grantedToAll && <Badge>Alle</Badge>}{p.sensitive && <Badge tone="warn"><Lock size={10} className="mr-1" />Sensibel</Badge>}{NEW_IN_V2.has(p.code) && <Badge tone="info">neu in V2</Badge>}</span>
                        <span className="block font-mono text-[11px] text-muted">{p.code}</span>
                        {needs.length > 0 && sel.has(p.code) && <span className="block text-xs text-muted">Benötigt: {needs.map(labelOf).join(', ')}</span>}
                        {neededFor.length > 0 && <span className="block text-xs text-muted">Wird benötigt für: {neededFor.map(labelOf).join(', ')}</span>}
                      </span>
                    </label>
                  )
                })}
              </div>
            </details>
          )
        })}
      </div>
    </Drawer>
  )
}
