import DutyEditor from './DutyEditor'
import type { DutyRole, DutyShift } from './data'

/** The duties of one day, one editor per role of the club. */
export default function DutyFields({ roles, duties, hours, onChange, disabled }: { roles: DutyRole[]; duties: Record<string, DutyShift[]>; hours: { from: number; to: number }; onChange: (roleId: string, shifts: DutyShift[]) => void; disabled?: boolean }) {
  return (
    <div className="grid gap-5">
      {roles.map((r) => <DutyEditor key={r.id} role={r} shifts={duties[r.id] ?? []} hours={hours} disabled={disabled} onChange={(s) => onChange(r.id, s)} />)}
      {roles.length === 0 && <p className="text-sm text-muted">Keine Dienste eingerichtet.</p>}
    </div>
  )
}
