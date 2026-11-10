import { useCallback } from 'react'
import MemberPicker from '../../MemberPicker'
import { useApp } from '../../state'
import { dutyCounts, type DutyRole } from './data'

/**
 * Choose who covers a duty: the person picker limited to members with one of the functions of the role. The list starts with those who
 * did the duty least often; behind each name stand how often and how many hours.
 */
export default function DutySelect({ role, value, onChange, disabled, placeholder, className }: { role: DutyRole; value?: string; onChange: (memberId: string) => void; disabled?: boolean; placeholder?: string; className?: string }) {
  const { days, hasFunction } = useApp()
  const counts = dutyCounts(days)
  const done = (id: string) => counts[id]?.[role.id]?.done ?? 0
  const hours = (id: string) => counts[id]?.[role.id]?.hours ?? 0
  const allow = useCallback((m: { id: string; membership: string }) => m.membership !== 'offen' && (role.functions.length === 0 || role.functions.some((fn) => hasFunction(m.id, fn))), [role.functions, hasFunction])
  return <MemberPicker ariaLabel={role.name} value={value} onChange={onChange} disabled={disabled} className={className} placeholder={placeholder ?? 'Person wählen'}
    allow={(m) => allow(m) || m.id === value} rank={(m) => done(m.id)} rankHint="Wenigste bisherige Dienste zuerst" info={(m) => `${done(m.id)}× · ${hours(m.id)} h`} />
}
